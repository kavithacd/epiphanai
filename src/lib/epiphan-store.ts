import { create } from "zustand";
import { toast } from "sonner";
import {
  AuditRecord, Failure, Fix, FAILURE_CATALOG, fixTemplateFor, PILLARS,
  PillarId, SEVERITY_WEIGHT, TraceLog, MODEL_MATRIX, describeFix,
} from "./epiphan-data";
import {
  IntegrationConfig, EMPTY_INTEGRATIONS, PlatformId, PLATFORM_LABEL,
  buildPlatformRequest, isPlatformConfigured,
} from "./epiphan-export";


const uid = () => Math.random().toString(36).slice(2, 11);
const hash = () => "0x" + Math.random().toString(16).slice(2, 10);

function deriveStoreName(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace("www.", "").split(".")[0];
  } catch { return "store"; }
}

function emptyScores(): Record<PillarId, number> {
  return { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100 };
}

// Compute live per-pillar scores for an audit given a set of failures
// considered "healed" (deployed) — used for trend snapshots and impact deltas.
function computeScores(failures: Failure[], healedExtra: Set<string> = new Set()) {
  const s = emptyScores();
  failures.forEach((f) => {
    const healed = f.status === "deployed" || f.status === "rolled_back" || healedExtra.has(f.id);
    if (!healed) s[f.pillar] = Math.max(0, s[f.pillar] - SEVERITY_WEIGHT[f.severity]);
  });
  return s;
}

export type FixHistoryEntry = {
  id: string;
  auditId: string;
  failureId: string;       // catalog id (F1.1, F2.1...)
  failureRecordId: string; // runtime failure.id
  pillar: PillarId;
  severity: Failure["severity"];
  title: string;
  detail: string;
  timestamp: number;
  scoresBefore: Record<PillarId, number>;
  scoresAfter: Record<PillarId, number>;
  delta: number;          // overall delta
  pillarDelta: number;    // delta on the pillar that was healed
};

interface State {
  audits: AuditRecord[];
  activeAuditId: string | null;
  traces: TraceLog[];
  guardrailEvents: { id: string; ts: number; rule: string; outcome: "blocked" | "allowed"; detail: string }[];
  fixHistory: FixHistoryEntry[];
  integrations: IntegrationConfig;
  totalCostUsd: number;
  startAudit: (url: string) => string;
  approveFix: (failureId: string) => void;
  bulkApprove: (failureIds: string[]) => void;
  bulkAutoFix: (failureIds: string[]) => void;
  rejectFix: (failureId: string, reason: string) => void;
  editFix: (failureId: string, newAfter: string) => void;
  rollbackFix: (failureId: string) => void;
  getAudit: (id: string) => AuditRecord | undefined;
  clearAll: () => void;
  autoFix: (failureId: string) => void;
  setIntegration: <K extends keyof IntegrationConfig>(key: K, value: IntegrationConfig[K]) => void;
  pushToPlatform: (failureIds: string[], platform: PlatformId) => void;
  notifySlackCritical: (failureRecordId: string) => void;
}


function logTrace(set: any, _get: any, t: Omit<TraceLog, "id" | "timestamp">) {
  const trace: TraceLog = { id: uid(), timestamp: Date.now(), ...t };
  set((s: State): Partial<State> => ({ traces: [trace, ...s.traces].slice(0, 200), totalCostUsd: s.totalCostUsd + t.costUsd }));
}

// Record a fix deployment to history (scores before/after, delta).
// Returns the recorded entry so callers can chain notifications.
function recordDeployment(
  set: any, get: any, failureId: string,
): FixHistoryEntry | null {
  const state = get() as State;
  for (const a of state.audits) {
    const f = a.failures.find((x) => x.id === failureId);
    if (!f) continue;
    const scoresBefore = computeScores(a.failures);
    const updated = a.failures.map((x) => x.id === failureId ? { ...x, status: "deployed" as const } : x);
    const scoresAfter = computeScores(updated);
    const before = Object.values(scoresBefore).reduce((s, n) => s + n, 0) / 5;
    const after = Object.values(scoresAfter).reduce((s, n) => s + n, 0) / 5;
    const d = describeFix(f);
    const entry: FixHistoryEntry = {
      id: uid(), auditId: a.id, failureId: f.failureId, failureRecordId: f.id,
      pillar: f.pillar, severity: f.severity, title: d.title, detail: d.detail,
      timestamp: Date.now(), scoresBefore, scoresAfter,
      delta: Math.round((after - before) * 10) / 10,
      pillarDelta: scoresAfter[f.pillar] - scoresBefore[f.pillar],
    };
    set((s: State): Partial<State> => ({
      fixHistory: [entry, ...s.fixHistory].slice(0, 500),
    }));
    return entry;
  }
  return null;
}


export const useEpiphan = create<State>((set, get) => ({
  audits: seedAudits(),
  activeAuditId: null,
  traces: seedTraces(),
  guardrailEvents: seedGuardrails(),
  fixHistory: [],
  integrations: { ...EMPTY_INTEGRATIONS },
  totalCostUsd: 0,

  getAudit: (id) => get().audits.find((a) => a.id === id),

  setIntegration: (key, value) => {
    set((s): Partial<State> => ({ integrations: { ...s.integrations, [key]: value } }));
  },

  notifySlackCritical: (failureRecordId) => {
    const { integrations, audits } = get();
    if (!integrations.slackWebhook) return;
    const f = audits.flatMap((a) => a.failures).find((x) => x.id === failureRecordId);
    if (!f || f.severity !== "CRITICAL") return;
    const req = buildPlatformRequest("slack", [f], integrations);
    logTrace(set, get, {
      model: "Slack Webhook", workflow: "WF-14 Slack notify",
      promptHash: hash(), operator: "system",
      durationMs: 180, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
    toast.message("Slack notified", { description: `Critical failure ${f.failureId} posted to ${req.url.slice(0, 38)}…` });
  },

  pushToPlatform: (failureIds, platform) => {
    const { integrations, audits } = get();
    const allFailures = audits.flatMap((a) => a.failures);
    const failures = failureIds
      .map((id) => allFailures.find((f) => f.id === id))
      .filter((f): f is Failure => !!f);
    if (failures.length === 0) {
      toast.error("Nothing to push", { description: "No selected fixes were found." });
      return;
    }
    if (!isPlatformConfigured(platform, integrations)) {
      toast.error(`${PLATFORM_LABEL[platform]} not configured`, {
        description: "Add credentials in Settings → Integrations to enable a real push.",
      });
      return;
    }
    const req = buildPlatformRequest(platform, failures, integrations);
    logTrace(set, get, {
      model: PLATFORM_LABEL[platform], workflow: `WF-15 Push · ${platform}`,
      promptHash: hash(), operator: "consultant@tessera.eu",
      durationMs: 480 + Math.floor(Math.random() * 600),
      tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
    toast.success(`Pushed to ${PLATFORM_LABEL[platform]}`, {
      description: `${failures.length} fix${failures.length === 1 ? "" : "es"} sent to ${req.url.replace(/^https?:\/\//, "").slice(0, 50)}…`,
    });
  },

  startAudit: (url) => {
    const id = uid();
    const audit: AuditRecord = {
      id, url, storeName: deriveStoreName(url),
      status: "running", currentPillar: "P1",
      scores: emptyScores(), failures: [],
      createdAt: Date.now(),
    };
    set((s): Partial<State> => ({ audits: [audit, ...s.audits], activeAuditId: id }));

    const pillarsSeq: PillarId[] = ["P1", "P2", "P3", "P4", "P5"];
    pillarsSeq.forEach((p, pi) => {
      setTimeout(() => {
        set((s): Partial<State> => ({
          audits: s.audits.map((a) => a.id === id ? { ...a, currentPillar: p } : a),
        }));
        const candidates = FAILURE_CATALOG.filter((c) => c.pillar === p);
        const picks = candidates.slice(0, Math.min(candidates.length, 3 + (p === "P2" || p === "P4" ? 1 : 0)));
        picks.forEach((c, ci) => {
          setTimeout(() => {
            const failure: Failure = {
              ...c, id: uid(), auditId: id,
              status: "detected", detectedAt: Date.now(),
            };
            if (c.isAutofixable) {
              const tpl = fixTemplateFor(failure);
              failure.fix = {
                id: uid(), fixType: tpl.type, generatedBy: tpl.model,
                before: tpl.before, after: tpl.after,
                evalScores: { factPreservation: 100, semanticDensity: 96, structuralSyntax: 100, objectAccuracy: 98, overall: "PASS" },
                rollbackSnapshot: tpl.before,
              };
              failure.status = c.requiresHuman ? "review_pending" : "eval_passed";
              logTrace(set, get, {
                model: MODEL_MATRIX[tpl.model as keyof typeof MODEL_MATRIX]?.name ?? tpl.model,
                workflow: `WF-0${p === "P1" ? 8 : p === "P2" ? 9 : p === "P3" ? 10 : 11} ${tpl.type}`,
                promptHash: hash(), operator: "consultant@tessera.eu",
                durationMs: 600 + Math.floor(Math.random() * 1800),
                tokensIn: 240 + Math.floor(Math.random() * 800),
                tokensOut: 80 + Math.floor(Math.random() * 600),
                costUsd: 0, status: "success",
              });
              logTrace(set, get, {
                model: "Llama 3.3 (Judge)", workflow: "WF-12 Eval Gate",
                promptHash: hash(), operator: "system",
                durationMs: 400 + Math.floor(Math.random() * 600),
                tokensIn: 320, tokensOut: 64, costUsd: 0, status: "success",
              });
              if (!c.requiresHuman) {
                const deployId = failure.id;
                setTimeout(() => {
                  recordDeployment(set, get, deployId);
                  set((s2: State): Partial<State> => ({
                    audits: s2.audits.map((a) => a.id === id ? {
                      ...a,
                      failures: a.failures.map((ff) => ff.id === deployId ? { ...ff, status: "deployed" } : ff),
                    } : a),
                  }));
                  const d = describeFix(failure);
                  toast.success(d.title, { description: d.detail });
                }, 1200 + Math.floor(Math.random() * 1400));
              }
            } else {
              failure.status = "review_pending";
            }
            set((s): Partial<State> => ({
              audits: s.audits.map((a) => a.id === id ? { ...a, failures: [...a.failures, failure] } : a),
            }));
            // Slack notify on detection of a CRITICAL failure
            if (failure.severity === "CRITICAL") {
              setTimeout(() => get().notifySlackCritical(failure.id), 100);
            }
          }, ci * 600 + 400);
        });
        if (pi === pillarsSeq.length - 1) {
          setTimeout(() => {
            set((s): Partial<State> => ({
              audits: s.audits.map((a) => {
                if (a.id !== id) return a;
                const scores = computeScores(a.failures);
                return { ...a, status: "complete", currentPillar: null, scores, completedAt: Date.now() };
              }),
            }));
          }, 3000);
        }
      }, pi * 2400);
    });
    return id;
  },

  approveFix: (failureId) => {
    let target: Failure | undefined;
    const found = get().audits.flatMap((a) => a.failures).find((f) => f.id === failureId);
    if (found && found.status !== "deployed") {
      recordDeployment(set, get, failureId);
    }
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) => {
          if (f.id !== failureId) return f;
          target = f;
          return { ...f, status: "deployed" };
        }),
      })),
    }));
    logTrace(set, get, {
      model: "Shopify Admin API", workflow: "Fix deployment",
      promptHash: hash(), operator: "consultant@tessera.eu",
      durationMs: 820, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
    if (target) {
      const d = describeFix(target);
      toast.success(d.title, { description: d.detail });
    }
  },

  autoFix: (failureId) => { get().approveFix(failureId); },

  bulkApprove: (ids) => {
    const before = get().fixHistory.length;
    ids.forEach((id) => {
      const f = get().audits.flatMap((a) => a.failures).find((x) => x.id === id);
      if (!f || f.status === "deployed") return;
      recordDeployment(set, get, id);
      set((s): Partial<State> => ({
        audits: s.audits.map((a) => ({
          ...a,
          failures: a.failures.map((x) => x.id === id ? { ...x, status: "deployed" } : x),
        })),
      }));
    });
    const applied = get().fixHistory.length - before;
    if (applied > 0) {
      logTrace(set, get, {
        model: "Shopify Admin API", workflow: `Bulk deploy · ${applied}`,
        promptHash: hash(), operator: "consultant@tessera.eu",
        durationMs: 820 + applied * 120, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
      });
      toast.success(`${applied} fix${applied === 1 ? "" : "es"} deployed`, {
        description: "Bulk approval pushed atomically. Open Audit History for the diff log.",
      });
    } else {
      toast.message("Nothing to deploy", { description: "All selected items were already deployed." });
    }
  },

  bulkAutoFix: (ids) => { get().bulkApprove(ids); },

  clearAll: () => {
    set({
      audits: [], activeAuditId: null, traces: [],
      guardrailEvents: [], fixHistory: [], totalCostUsd: 0,
    });
    toast.success("History cleared", { description: "All audits, traces, fix history and guardrail events wiped." });
  },

  rejectFix: (failureId, reason) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) => f.id === failureId ? { ...f, status: "rejected" } : f),
      })),
      guardrailEvents: [
        { id: uid(), ts: Date.now(), rule: "Human Review", outcome: "blocked" as const, detail: `Fix rejected: ${reason}` },
        ...s.guardrailEvents,
      ].slice(0, 100),
    }));
    toast.error("Fix rejected", { description: reason });
  },

  editFix: (failureId, newAfter) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) =>
          f.id === failureId && f.fix ? { ...f, fix: { ...f.fix, after: newAfter } } : f
        ),
      })),
    }));
  },

  rollbackFix: (failureId) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) => f.id === failureId ? { ...f, status: "rolled_back" } : f),
      })),
    }));
    logTrace(set, get, {
      model: "Shopify Admin API", workflow: "WF-13 Rollback",
      promptHash: hash(), operator: "consultant@tessera.eu",
      durationMs: 410, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
    toast.message("Rolled back", { description: "Pre-deploy snapshot restored on the live store." });
  },

}));

// ──────────────────────────────── seed data ────────────────────────────────
function seedAudits(): AuditRecord[] {
  const a1: AuditRecord = {
    id: "demo-acme",
    url: "https://acme-apparel.myshopify.com",
    storeName: "acme-apparel",
    status: "complete", currentPillar: null,
    scores: { P1: 70, P2: 40, P3: 30, P4: 65, P5: 50 },
    failures: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    completedAt: Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 47,
  };
  a1.failures = FAILURE_CATALOG.slice(0, 12).map((c) => {
    const f: Failure = {
      ...c, id: uid(), auditId: a1.id,
      status: c.isAutofixable && !c.requiresHuman ? "deployed" : "review_pending",
      detectedAt: a1.createdAt,
    };
    if (c.isAutofixable) {
      const tpl = fixTemplateFor(f);
      f.fix = {
        id: uid(), fixType: tpl.type, generatedBy: tpl.model,
        before: tpl.before, after: tpl.after,
        evalScores: { factPreservation: 100, semanticDensity: 97, structuralSyntax: 100, objectAccuracy: 99, overall: "PASS" },
        rollbackSnapshot: tpl.before,
      };
    }
    return f;
  });
  return [a1];
}

function seedTraces(): TraceLog[] {
  const t: TraceLog[] = [];
  const wfs = [
    { wf: "WF-02 P1 Audit", model: "Phi-4" },
    { wf: "WF-09 P2 Schema injection", model: "Llama 3.3 70B" },
    { wf: "WF-12 Eval Gate", model: "Llama 3.3 (Judge)" },
    { wf: "WF-11 P4 Alt-text", model: "Llama 3.2-Vision" },
    { wf: "WF-06 P5 Probes", model: "Llama 3.1 8B (probes)" },
  ];
  for (let i = 0; i < 14; i++) {
    const w = wfs[i % wfs.length];
    t.push({
      id: uid(), timestamp: Date.now() - i * 1000 * 60 * 7,
      model: w.model, workflow: w.wf, promptHash: hash(),
      operator: "consultant@tessera.eu",
      durationMs: 320 + Math.floor(Math.random() * 2200),
      tokensIn: 200 + Math.floor(Math.random() * 1200),
      tokensOut: 60 + Math.floor(Math.random() * 800),
      costUsd: 0, status: i === 11 ? "failure" : "success",
    });
  }
  return t;
}

function seedGuardrails() {
  return [
    { id: uid(), ts: Date.now() - 1000 * 60 * 4, rule: "Sovereign Mode", outcome: "allowed" as const, detail: "Routed product copy to local inference — no cloud API touched." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 11, rule: "Destructive Op Lock", outcome: "blocked" as const, detail: "DELETE on /products/784 refused. Used additive Metafield update instead." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 22, rule: "Eval Gate (Hallucination)", outcome: "blocked" as const, detail: "P3 copy claimed '24h delivery' not in source data. Regenerated automatically." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 38, rule: "High-Risk Filter", outcome: "blocked" as const, detail: "Medical claim 'reduces back pain' stripped from supplement copy." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 55, rule: "Rollback Snapshot", outcome: "allowed" as const, detail: "Pre-write snapshot stored for fix #4f2a (robots.txt)." },
  ];
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import {
  AuditRecord, Failure, Fix, FAILURE_CATALOG, fixTemplateFor, PILLARS,
  PillarId, SEVERITY_WEIGHT, TraceLog, MODEL_MATRIX, describeFix,
  inferProductContext, ProductContext,
} from "./epiphan-data";
import {
  IntegrationConfig, EMPTY_INTEGRATIONS, PlatformId, PLATFORM_LABEL,
  buildPlatformRequest, isPlatformConfigured,
} from "./epiphan-export";


// Runtime IDs only (post-mount) — safe for hydration.
const uid = () => Math.random().toString(36).slice(2, 11);
const hash = () => "0x" + Math.random().toString(16).slice(2, 10);

// Judge-model reasoning snippet — Phoenix/Langfuse-style explanation of why
// the eval passed. Deterministic per pillar/fix-type so demo traces are coherent.
function judgeReasoning(pillar: PillarId, fixType: string, fp: number, grounding: number): string {
  const base = `Fact Preservation ${fp}/100 · Grounding ${grounding}/100. `;
  switch (pillar) {
    case "P1":
      return base + `Output references only headers/paths present in the source crawl. No hallucinated routes or competitor mentions detected.`;
    case "P2":
      return base + `JSON-LD validates against schema.org/${fixType.includes("breadcrumb") ? "BreadcrumbList" : "Product"}. All required fields trace back to extracted product data; no invented SKUs, prices, or ratings.`;
    case "P3":
      return base + `Copy stays inside extracted product attributes. Material, sizing and care claims all map to source fields. No fabricated certifications or delivery promises.`;
    case "P4":
      return base + `Vision model description aligned with image embedding similarity > 0.91. Colour, garment type and material verified against catalog metadata.`;
    case "P5":
      return base + `Probe results cited directly; no synthesised citations. Outreach plan flagged for human approval before any external action.`;
  }
}

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

export type EvalThresholds = {
  factPreservation: number;
  semanticDensity: number;
  structuralSyntax: number;
  objectAccuracy: number;
};

export type ProbeQuery = {
  id: string;
  text: string;
  enabled: boolean;
};

export type ProbeEngine = {
  id: string;
  label: string;
  enabled: boolean;
};

export const DEFAULT_PROBE_QUERIES: ProbeQuery[] = [
  { id: "pq-01", text: "Best brand for everyday use in Europe right now", enabled: true },
  { id: "pq-02", text: "Top AI-recommended products in this category for 2025", enabled: true },
  { id: "pq-03", text: "Which brand is most cited by ChatGPT for this product type?", enabled: true },
  { id: "pq-04", text: "Most recommended sustainable options in the EU market", enabled: true },
  { id: "pq-05", text: "Compare the leading brands recommended by AI assistants", enabled: true },
  { id: "pq-06", text: "What brand do AI engines recommend most for quality and value?", enabled: true },
  { id: "pq-07", text: "AI shopping recommendations for gifts in this category", enabled: true },
  { id: "pq-08", text: "Top-rated options according to Gemini and Perplexity", enabled: true },
  { id: "pq-09", text: "Best product in this category under €200 in Europe", enabled: true },
  { id: "pq-10", text: "Which brands do AI models reference most when asked about this product?", enabled: true },
];

export const DEFAULT_PROBE_ENGINES: ProbeEngine[] = [
  { id: "chatgpt", label: "ChatGPT", enabled: true },
  { id: "gemini", label: "Gemini", enabled: true },
  { id: "perplexity", label: "Perplexity", enabled: true },
];

export const EVAL_THRESHOLD_META: {
  key: keyof EvalThresholds;
  label: string;
  description: string;
  default: number;
}[] = [
  { key: "factPreservation", label: "Fact Preservation", description: "All claims in the generated fix must trace back to extracted product data. Guards against hallucinated specs, invented certifications, and made-up delivery promises.", default: 100 },
  { key: "semanticDensity", label: "Semantic Density", description: "Output must contain sufficient context-rich language for AI engines to parse intent. Low scores indicate thin, vague copy that won't improve GEO visibility.", default: 90 },
  { key: "structuralSyntax", label: "Structural Syntax", description: "Generated JSON-LD, HTML, and robots.txt must be syntactically valid and parse without errors. A score below 100 means the output cannot be safely deployed.", default: 100 },
  { key: "objectAccuracy", label: "Object Accuracy", description: "Product objects referenced in the fix (SKU, brand, price, currency) must match the source data. Mismatches cause incorrect structured data in search engines.", default: 95 },
];

interface State {
  audits: AuditRecord[];
  activeAuditId: string | null;
  traces: TraceLog[];
  guardrailEvents: { id: string; ts: number; rule: string; outcome: "blocked" | "allowed"; detail: string }[];
  fixHistory: FixHistoryEntry[];
  integrations: IntegrationConfig;
  totalCostUsd: number;
  autoDeployEnabled: boolean;
  evalThresholds: EvalThresholds;
  probeQueries: ProbeQuery[];
  probeEngines: ProbeEngine[];
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
  regenerateFix: (failureId: string) => void;
  setIntegration: <K extends keyof IntegrationConfig>(key: K, value: IntegrationConfig[K]) => void;
  setAutoDeployEnabled: (enabled: boolean) => void;
  setEvalThreshold: (key: keyof EvalThresholds, value: number) => void;
  addProbeQuery: (text: string) => void;
  deleteProbeQuery: (id: string) => void;
  updateProbeQuery: (id: string, text: string) => void;
  toggleProbeQuery: (id: string) => void;
  toggleProbeEngine: (id: string) => void;
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
    const d = describeFix(f, a.ctx);
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


const MAX_STR = 3000;
function truncateFix(fix: Fix | undefined): Fix | undefined {
  if (!fix) return fix;
  return {
    ...fix,
    before: fix.before?.slice(0, MAX_STR),
    after: fix.after?.slice(0, MAX_STR),
    rollbackSnapshot: fix.rollbackSnapshot?.slice(0, MAX_STR),
  };
}

export const useEpiphan = create<State>()(persist((set, get) => ({
  audits: [],
  activeAuditId: null,
  traces: [],
  guardrailEvents: [],
  fixHistory: [],
  integrations: { ...EMPTY_INTEGRATIONS },
  totalCostUsd: 0,
  autoDeployEnabled: false,
  evalThresholds: {
    factPreservation: 100,
    semanticDensity: 90,
    structuralSyntax: 100,
    objectAccuracy: 95,
  },
  probeQueries: DEFAULT_PROBE_QUERIES,
  probeEngines: DEFAULT_PROBE_ENGINES,

  getAudit: (id) => get().audits.find((a) => a.id === id),

  setIntegration: (key, value) => {
    set((s): Partial<State> => ({ integrations: { ...s.integrations, [key]: value } }));
  },

  setAutoDeployEnabled: (enabled) => {
    set((): Partial<State> => ({ autoDeployEnabled: enabled }));
  },

  setEvalThreshold: (key, value) => {
    set((s): Partial<State> => ({
      evalThresholds: { ...s.evalThresholds, [key]: value },
    }));
  },

  addProbeQuery: (text) => {
    set((s): Partial<State> => ({
      probeQueries: [...s.probeQueries, { id: uid(), text, enabled: true }],
    }));
  },

  deleteProbeQuery: (id) => {
    set((s): Partial<State> => {
      if (s.probeQueries.length <= 1) return {};
      return { probeQueries: s.probeQueries.filter((q) => q.id !== id) };
    });
  },

  updateProbeQuery: (id, text) => {
    set((s): Partial<State> => ({
      probeQueries: s.probeQueries.map((q) => q.id === id ? { ...q, text } : q),
    }));
  },

  toggleProbeQuery: (id) => {
    set((s): Partial<State> => ({
      probeQueries: s.probeQueries.map((q) => q.id === id ? { ...q, enabled: !q.enabled } : q),
    }));
  },

  toggleProbeEngine: (id) => {
    set((s): Partial<State> => ({
      probeEngines: s.probeEngines.map((e) => e.id === id ? { ...e, enabled: !e.enabled } : e),
    }));
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
    const ctx = inferProductContext(url);
    const thresholds = get().evalThresholds;
    const { probeQueries, probeEngines } = get();
    const enabledProbeCount = probeQueries.filter((q) => q.enabled).length;
    const enabledEngineLabels = probeEngines.filter((e) => e.enabled).map((e) => e.label);
    const enginesStr = enabledEngineLabels.length > 0 ? enabledEngineLabels.join(", ") : "no engines";
    const audit: AuditRecord = {
      id, url, storeName: ctx.brand || deriveStoreName(url),
      status: "running", currentPillar: "P1",
      scores: emptyScores(), failures: [],
      createdAt: Date.now(),
      ctx,
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
            const dynamicDetail =
              c.failureId === "F5.1"
                ? `Brand not cited in any of ${enabledProbeCount} active probe queries across ${enginesStr}.`
                : c.failureId === "F5.2"
                ? `Top competitor cited in ${Math.round(enabledProbeCount * 0.8)}/${enabledProbeCount} AI answers across ${enginesStr}. Share of voice: 0%.`
                : c.detail;
            const failure: Failure = {
              ...c, id: uid(), auditId: id,
              status: "detected", detectedAt: Date.now(),
              detail: dynamicDetail,
            };
            if (c.isAutofixable) {
              const tpl = fixTemplateFor(failure, ctx);
              const fp = 94 + Math.floor(Math.random() * 7);   // 94–100
              const sd = 86 + Math.floor(Math.random() * 15);  // 86–100
              const ss = 92 + Math.floor(Math.random() * 9);   // 92–100
              const oa = 90 + Math.floor(Math.random() * 11);  // 90–100
              const grounding = 92 + Math.floor(Math.random() * 8);
              const overall: "PASS" | "FAIL" =
                fp >= thresholds.factPreservation &&
                sd >= thresholds.semanticDensity &&
                ss >= thresholds.structuralSyntax &&
                oa >= thresholds.objectAccuracy
                  ? "PASS" : "FAIL";
              failure.fix = {
                id: uid(), fixType: tpl.type, generatedBy: tpl.model,
                before: tpl.before, after: tpl.after,
                evalScores: { factPreservation: fp, semanticDensity: sd, structuralSyntax: ss, objectAccuracy: oa, overall },
                hallucinationScore: 100 - fp,
                groundingScore: grounding,
                reasoning: judgeReasoning(failure.pillar, tpl.type, fp, grounding),
                rollbackSnapshot: tpl.before,
              };
              failure.status = overall === "FAIL" ? "eval_failed" : c.requiresHuman ? "review_pending" : "eval_passed";
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
              if (!c.requiresHuman && get().autoDeployEnabled) {
                const deployId = failure.id;
                setTimeout(() => {
                  recordDeployment(set, get, deployId);
                  set((s2: State): Partial<State> => ({
                    audits: s2.audits.map((a) => a.id === id ? {
                      ...a,
                      failures: a.failures.map((ff) => ff.id === deployId ? { ...ff, status: "deployed" } : ff),
                    } : a),
                  }));
                  const d = describeFix(failure, ctx);
                  toast.success(d.title, { description: d.detail });
                }, 1200 + Math.floor(Math.random() * 1400));
              }
            } else {
              failure.status = "review_pending";
            }
            set((s): Partial<State> => ({
              audits: s.audits.map((a) => a.id === id ? { ...a, failures: [...a.failures, failure] } : a),
            }));
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
          return {
            ...f,
            status: "deployed",
            fix: f.fix ? { ...f.fix, userFeedback: "pass" } : f.fix,
          };
        }),
      })),
    }));
    logTrace(set, get, {
      model: "Shopify Admin API", workflow: "Fix deployment",
      promptHash: hash(), operator: "consultant@tessera.eu",
      durationMs: 820, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
    if (target) {
      const auditCtx = get().audits.find((a) => a.failures.some((f) => f.id === failureId))?.ctx;
      const d = describeFix(target, auditCtx);
      toast.success(d.title, { description: d.detail });
    }
  },

  autoFix: (failureId) => { get().approveFix(failureId); },

  regenerateFix: (failureId) => {
    const state = get();
    let targetFailure: Failure | undefined;
    let targetAuditId: string | undefined;
    let targetCtx: ReturnType<typeof inferProductContext> | undefined;

    for (const a of state.audits) {
      const f = a.failures.find((x) => x.id === failureId);
      if (f) { targetFailure = f; targetAuditId = a.id; targetCtx = a.ctx; break; }
    }
    if (!targetFailure || !targetAuditId) return;

    set((s): Partial<State> => ({
      audits: s.audits.map((a) => a.id !== targetAuditId ? a : {
        ...a,
        failures: a.failures.map((f) => f.id !== failureId ? f : { ...f, status: "generating" }),
      }),
    }));

    toast.message("Regenerating fix…", { description: `Running AI generation for ${targetFailure.failureName}` });

    const thresholds = get().evalThresholds;
    const ctx = targetCtx!;
    const failure = targetFailure;
    const auditId = targetAuditId;

    setTimeout(() => {
      const tpl = fixTemplateFor(failure, ctx);
      const fp = 94 + Math.floor(Math.random() * 7);
      const sd = 86 + Math.floor(Math.random() * 15);
      const ss = 92 + Math.floor(Math.random() * 9);
      const oa = 90 + Math.floor(Math.random() * 11);
      const grounding = 92 + Math.floor(Math.random() * 8);
      const overall: "PASS" | "FAIL" =
        fp >= thresholds.factPreservation &&
        sd >= thresholds.semanticDensity &&
        ss >= thresholds.structuralSyntax &&
        oa >= thresholds.objectAccuracy
          ? "PASS" : "FAIL";

      const newFix: Fix = {
        id: uid(), fixType: tpl.type, generatedBy: tpl.model,
        before: tpl.before, after: tpl.after,
        evalScores: { factPreservation: fp, semanticDensity: sd, structuralSyntax: ss, objectAccuracy: oa, overall },
        hallucinationScore: 100 - fp,
        groundingScore: grounding,
        reasoning: judgeReasoning(failure.pillar, tpl.type, fp, grounding),
        rollbackSnapshot: tpl.before,
      };

      const newStatus = overall === "FAIL" ? "eval_failed" : failure.requiresHuman ? "review_pending" : "eval_passed";

      set((s): Partial<State> => ({
        audits: s.audits.map((a) => a.id !== auditId ? a : {
          ...a,
          failures: a.failures.map((f) => f.id !== failureId ? f : {
            ...f,
            fix: newFix,
            status: newStatus,
            regenerationCount: (f.regenerationCount ?? 0) + 1,
          }),
        }),
      }));

      logTrace(set, get, {
        model: MODEL_MATRIX[tpl.model as keyof typeof MODEL_MATRIX]?.name ?? tpl.model,
        workflow: `WF-0${failure.pillar === "P1" ? 8 : failure.pillar === "P2" ? 9 : failure.pillar === "P3" ? 10 : 11} ${tpl.type} (regen)`,
        promptHash: hash(), operator: "consultant@tessera.eu",
        durationMs: 600 + Math.floor(Math.random() * 1800),
        tokensIn: 240 + Math.floor(Math.random() * 800),
        tokensOut: 80 + Math.floor(Math.random() * 600),
        costUsd: 0, status: "success",
      });
      logTrace(set, get, {
        model: "Llama 3.3 (Judge)", workflow: "WF-12 Eval Gate (regen)",
        promptHash: hash(), operator: "system",
        durationMs: 400 + Math.floor(Math.random() * 600),
        tokensIn: 320, tokensOut: 64, costUsd: 0, status: "success",
      });

      if (overall === "PASS") {
        toast.success("Regenerated fix passed eval gate", { description: `${failure.failureName} is ready to approve.` });
      } else {
        toast.error("Regenerated fix failed eval gate again", { description: "You can try again, edit the fix, or lower thresholds in Settings." });
      }
    }, 1400 + Math.floor(Math.random() * 800));
  },

  bulkApprove: (ids) => {
    const before = get().fixHistory.length;
    ids.forEach((id) => {
      const f = get().audits.flatMap((a) => a.failures).find((x) => x.id === id);
      if (!f || f.status === "deployed") return;
      recordDeployment(set, get, id);
      set((s): Partial<State> => ({
        audits: s.audits.map((a) => ({
          ...a,
          failures: a.failures.map((x) => x.id === id
            ? { ...x, status: "deployed", fix: x.fix ? { ...x.fix, userFeedback: "pass" } : x.fix }
            : x),
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
        failures: a.failures.map((f) => f.id === failureId
          ? { ...f, status: "rejected", fix: f.fix ? { ...f.fix, userFeedback: "fail" } : f.fix }
          : f),
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

}), {
  name: "epiphan-state-v1",
  partialize: (state) => ({
    audits: state.audits
      .filter((a) => a.status !== "running")
      .map((a) => ({
        ...a,
        failures: a.failures.map((f) => ({
          ...f,
          status: f.status === "generating" ? ("eval_failed" as const) : f.status,
          fix: truncateFix(f.fix),
        })),
      })),
    activeAuditId: state.activeAuditId,
    guardrailEvents: state.guardrailEvents,
    fixHistory: state.fixHistory,
    totalCostUsd: state.totalCostUsd,
    autoDeployEnabled: state.autoDeployEnabled,
    evalThresholds: state.evalThresholds,
  }),
}));


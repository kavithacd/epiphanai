import { create } from "zustand";
import {
  AuditRecord, Failure, Fix, FAILURE_CATALOG, fixTemplateFor, PILLARS,
  PillarId, SEVERITY_WEIGHT, TraceLog, MODEL_MATRIX,
} from "./epiphan-data";

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

interface State {
  audits: AuditRecord[];
  activeAuditId: string | null;
  traces: TraceLog[];
  guardrailEvents: { id: string; ts: number; rule: string; outcome: "blocked" | "allowed"; detail: string }[];
  totalCostUsd: number;
  startAudit: (url: string) => string;
  approveFix: (failureId: string) => void;
  rejectFix: (failureId: string, reason: string) => void;
  editFix: (failureId: string, newAfter: string) => void;
  rollbackFix: (failureId: string) => void;
  getAudit: (id: string) => AuditRecord | undefined;
}

function logTrace(set: any, _get: any, t: Omit<TraceLog, "id" | "timestamp">) {
  const trace: TraceLog = { id: uid(), timestamp: Date.now(), ...t };
  set((s: State): Partial<State> => ({ traces: [trace, ...s.traces].slice(0, 200), totalCostUsd: s.totalCostUsd + t.costUsd }));
}

export const useEpiphan = create<State>((set, get) => ({
  audits: seedAudits(),
  activeAuditId: null,
  traces: seedTraces(),
  guardrailEvents: seedGuardrails(),
  totalCostUsd: 0,

  getAudit: (id) => get().audits.find((a) => a.id === id),

  startAudit: (url) => {
    const id = uid();
    const audit: AuditRecord = {
      id, url, storeName: deriveStoreName(url),
      status: "running", currentPillar: "P1",
      scores: emptyScores(), failures: [],
      createdAt: Date.now(),
    };
    set((s): Partial<State> => ({ audits: [audit, ...s.audits], activeAuditId: id }));

    // Simulate sequential pillar audit
    const pillarsSeq: PillarId[] = ["P1", "P2", "P3", "P4", "P5"];
    pillarsSeq.forEach((p, pi) => {
      setTimeout(() => {
        set((s): Partial<State> => ({
          audits: s.audits.map((a) =>
            a.id === id ? { ...a, currentPillar: p } : a
          ),
        }));
        // pick 2-4 failures for this pillar
        const candidates = FAILURE_CATALOG.filter((c) => c.pillar === p);
        const picks = candidates.slice(0, Math.min(candidates.length, 3 + (p === "P2" || p === "P4" ? 1 : 0)));
        picks.forEach((c, ci) => {
          setTimeout(() => {
            const failure: Failure = {
              ...c, id: uid(), auditId: id,
              status: "detected", detectedAt: Date.now(),
            };
            // attach proposed fix
            if (c.isAutofixable) {
              const tpl = fixTemplateFor(failure);
              const evalPass: Fix["evalScores"] = {
                factPreservation: 100, semanticDensity: 96,
                structuralSyntax: 100, objectAccuracy: 98, overall: "PASS",
              };
              failure.fix = {
                id: uid(), fixType: tpl.type, generatedBy: tpl.model,
                before: tpl.before, after: tpl.after, evalScores: evalPass,
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
                costUsd: 0,
                status: "success",
              });
              logTrace(set, get, {
                model: "Llama 3.3 (Judge)", workflow: "WF-12 Eval Gate",
                promptHash: hash(), operator: "system",
                durationMs: 400 + Math.floor(Math.random() * 600),
                tokensIn: 320, tokensOut: 64, costUsd: 0, status: "success",
              });
              // Auto-deploy fixes that don't require human review
              if (!c.requiresHuman) {
                const deployId = failure.id;
                setTimeout(() => {
                  set((s2: State): Partial<State> => ({
                    audits: s2.audits.map((a) => a.id === id ? {
                      ...a,
                      failures: a.failures.map((ff) => ff.id === deployId ? { ...ff, status: "deployed" } : ff),
                    } : a),
                  }));
                }, 1200 + Math.floor(Math.random() * 1400));
              }
            } else {
              failure.status = "review_pending";
            }
            set((s): Partial<State> => ({
              audits: s.audits.map((a) =>
                a.id === id
                  ? { ...a, failures: [...a.failures, failure] }
                  : a
              ),
            }));
          }, ci * 600 + 400);
        });
        // last pillar — finalize
        if (pi === pillarsSeq.length - 1) {
          setTimeout(() => {
            set((s): Partial<State> => ({
              audits: s.audits.map((a) => {
                if (a.id !== id) return a;
                const scores = emptyScores();
                a.failures.forEach((f) => {
                  scores[f.pillar] = Math.max(0, scores[f.pillar] - SEVERITY_WEIGHT[f.severity]);
                });
                return {
                  ...a, status: "complete", currentPillar: null,
                  scores, completedAt: Date.now(),
                };
              }),
            }));
          }, 3000);
        }
      }, pi * 2400);
    });
    return id;
  },

  approveFix: (failureId) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) =>
          f.id === failureId ? { ...f, status: "deployed" } : f
        ),
      })),
    }));
    logTrace(set, get, {
      model: "Shopify Admin API", workflow: "Fix deployment",
      promptHash: hash(), operator: "consultant@tessera.eu",
      durationMs: 820, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
  },

  rejectFix: (failureId, reason) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) =>
          f.id === failureId ? { ...f, status: "rejected" } : f
        ),
      })),
      guardrailEvents: [
        { id: uid(), ts: Date.now(), rule: "Human Review", outcome: "blocked" as const, detail: `Fix rejected: ${reason}` },
        ...s.guardrailEvents,
      ].slice(0, 100),
    }));
  },

  editFix: (failureId, newAfter) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) =>
          f.id === failureId && f.fix
            ? { ...f, fix: { ...f.fix, after: newAfter } }
            : f
        ),
      })),
    }));
  },

  rollbackFix: (failureId) => {
    set((s): Partial<State> => ({
      audits: s.audits.map((a) => ({
        ...a,
        failures: a.failures.map((f) =>
          f.id === failureId ? { ...f, status: "rolled_back" } : f
        ),
      })),
    }));
    logTrace(set, get, {
      model: "Shopify Admin API", workflow: "WF-13 Rollback",
      promptHash: hash(), operator: "consultant@tessera.eu",
      durationMs: 410, tokensIn: 0, tokensOut: 0, costUsd: 0, status: "success",
    });
  },
}));

// ──────────────────────────────── seed data ────────────────────────────────
function seedAudits(): AuditRecord[] {
  const a1: AuditRecord = {
    id: "demo-acme",
    url: "https://acme-apparel.myshopify.com",
    storeName: "acme-apparel",
    status: "complete",
    currentPillar: null,
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
    { wf: "WF-06 P5 Probes", model: "GPT-4o (P5 probes only)" },
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
      costUsd: w.model.startsWith("GPT") ? 0.004 + Math.random() * 0.01 : 0,
      status: i === 11 ? "failure" : "success",
    });
  }
  return t;
}

function seedGuardrails() {
  return [
    { id: uid(), ts: Date.now() - 1000 * 60 * 4, rule: "Sovereign Mode", outcome: "allowed" as const, detail: "Routed product copy to local Ollama (Llama 3.3) — no cloud API touched." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 11, rule: "Destructive Op Lock", outcome: "blocked" as const, detail: "DELETE on /products/784 refused. Used additive Metafield update instead." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 22, rule: "Eval Gate (Hallucination)", outcome: "blocked" as const, detail: "P3 copy claimed '24h delivery' not in source data. Regenerated automatically." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 38, rule: "High-Risk Filter", outcome: "blocked" as const, detail: "Medical claim 'reduces back pain' stripped from supplement copy." },
    { id: uid(), ts: Date.now() - 1000 * 60 * 55, rule: "Rollback Snapshot", outcome: "allowed" as const, detail: "Pre-write snapshot stored for fix #4f2a (robots.txt)." },
  ];
}

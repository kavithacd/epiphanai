import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { Failure, describeFix } from "@/lib/epiphan-data";
import { PillarBadge, SeverityBadge } from "@/components/PillarRing";
import { FixStatusPill } from "./dashboard";
import { Check, X, Pencil, ChevronRight, Sparkles, Wand2 } from "lucide-react";


export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Review Queue · epiphanAI" }] }),
  component: ReviewQueue,
});

function ReviewQueue() {
  const { audits, approveFix, rejectFix, editFix } = useEpiphan();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const items = audits.flatMap((a) =>
    a.failures.filter((f) => f.status === "review_pending")
      .map((f) => ({ ...f, storeName: a.storeName }))
  );

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Review Queue</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Manual review · {items.length} fix{items.length === 1 ? "" : "es"} awaiting approval</h1>
          <p className="text-muted-foreground text-xs mt-1">
            Only fixes that require human judgement (P3 copy, P4 alt-text, brand-sensitive content) appear here. Auto-approved fixes deploy directly and live in <a className="text-primary hover:underline" href="/history">Audit History</a>.
          </p>
        </header>


        <div className="border border-border rounded-lg bg-surface overflow-hidden">
          {items.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground text-xs">
              No fixes awaiting review. Run an audit from the Audit Engine.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((f) => {
                const open = expandedId === f.id;
                return (
                  <div key={f.id}>
                    <button
                      onClick={() => {
                        setExpandedId(open ? null : f.id);
                        setEditMode(false);
                        setDraft(f.fix?.after ?? "");
                      }}
                      className="w-full grid grid-cols-[60px_1fr_90px_140px_140px_24px] gap-3 px-5 py-3 items-center hover:bg-accent/20 text-left"
                    >
                      <PillarBadge pillar={f.pillar} />
                      <div className="min-w-0">
                        <div className="text-xs text-foreground truncate">{f.failureName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{f.storeName} · {f.failureId}</div>
                      </div>
                      <SeverityBadge severity={f.severity} />
                      <div className="text-[10px] text-muted-foreground truncate">{f.fix?.generatedBy ?? "—"}</div>
                      <FixStatusPill status={f.status} />
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition ${open ? "rotate-90" : ""}`} />
                    </button>

                    {open && f.fix && (
                      <div className="bg-background border-t border-border p-5 space-y-4">
                        <EvalStrip fix={f.fix} />

                        <div className="grid md:grid-cols-2 gap-3">
                          <Pane label="CURRENT STATE" tone="bad">
                            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{f.fix.before}</pre>
                          </Pane>
                          <Pane label="AI-PROPOSED FIX" tone="good">
                            {editMode ? (
                              <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="w-full bg-transparent outline-none text-[11px] leading-relaxed text-foreground min-h-[180px] font-mono resize-y"
                              />
                            ) : (
                              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">{f.fix.after}</pre>
                            )}
                          </Pane>
                        </div>

                        {f.status === "review_pending" && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-primary" />
                              {editMode
                                ? "Editing the proposed fix. Save your edit, then approve to merge it into the live store."
                                : "Approving deploys this fix and immediately updates the Live Store Preview on the dashboard."}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {editMode ? (
                                <>
                                  <button
                                    onClick={() => { editFix(f.id, draft); setEditMode(false); }}
                                    className="px-3 py-1.5 rounded border border-primary/50 text-primary hover:bg-primary/10 text-[11px] flex items-center gap-1.5"
                                  >
                                    <Check className="w-3 h-3" /> Save edit
                                  </button>
                                  <button
                                    onClick={() => { editFix(f.id, draft); approveFix(f.id); setEditMode(false); }}
                                    className="px-3 py-1.5 rounded bg-sev-low text-background text-[11px] flex items-center gap-1.5 font-medium"
                                  >
                                    <Check className="w-3 h-3" /> Save & Approve
                                  </button>
                                  <button onClick={() => { setEditMode(false); setDraft(f.fix?.after ?? ""); }} className="px-3 py-1.5 rounded border border-border text-[11px]">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => approveFix(f.id)}
                                    className="px-3 py-1.5 rounded bg-sev-low text-background text-[11px] flex items-center gap-1.5 font-medium">
                                    <Check className="w-3 h-3" /> Approve & Deploy
                                  </button>
                                  <button onClick={() => { setDraft(f.fix?.after ?? ""); setEditMode(true); }}
                                    className="px-3 py-1.5 rounded border border-sev-medium/50 text-sev-medium hover:bg-sev-medium/10 text-[11px] flex items-center gap-1.5">
                                    <Pencil className="w-3 h-3" /> Edit
                                  </button>
                                  <select
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="text-[11px] bg-background border border-border rounded px-2 py-1.5 outline-none"
                                  >
                                    <option value="">Reason…</option>
                                    <option>Factually wrong</option>
                                    <option>Off-brand</option>
                                    <option>Not needed</option>
                                  </select>
                                  <button
                                    disabled={!rejectReason}
                                    onClick={() => { rejectFix(f.id, rejectReason); setRejectReason(""); }}
                                    className="px-3 py-1.5 rounded border border-sev-critical/50 text-sev-critical hover:bg-sev-critical/10 text-[11px] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                                    <X className="w-3 h-3" /> Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {f.status === "deployed" && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                            <div className="text-[10px] text-sev-low flex items-center gap-2">
                              <ShieldCheck className="w-3 h-3" /> Merged into store · snapshot retained · 30-day rollback
                            </div>
                            <div className="flex items-center gap-2">
                              <Link to="/dashboard" className="px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 text-[11px] flex items-center gap-1.5">
                                View in Live Store Preview <ArrowRight className="w-3 h-3" />
                              </Link>
                              <button onClick={() => rollbackFix(f.id)}
                                className="px-3 py-1.5 rounded border border-border hover:bg-accent/30 text-[11px] flex items-center gap-1.5">
                                <Undo2 className="w-3 h-3" /> Rollback
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EvalStrip({ fix }: { fix: NonNullable<Failure["fix"]> }) {
  const items: { label: string; value: string; pass: boolean }[] = [
    { label: "Fact Preservation", value: `${fix.evalScores.factPreservation}%`, pass: fix.evalScores.factPreservation === 100 },
    { label: "Semantic Density", value: `${fix.evalScores.semanticDensity}%`, pass: fix.evalScores.semanticDensity >= 90 },
    { label: "Structural Syntax", value: `${fix.evalScores.structuralSyntax}%`, pass: fix.evalScores.structuralSyntax === 100 },
    { label: "Object Accuracy", value: `${fix.evalScores.objectAccuracy}%`, pass: fix.evalScores.objectAccuracy >= 95 },
    { label: "Judge Verdict", value: fix.evalScores.overall, pass: fix.evalScores.overall === "PASS" },
  ];
  return (
    <div className="grid grid-cols-5 gap-px bg-border rounded overflow-hidden border border-border">
      {items.map((i) => (
        <div key={i.label} className="bg-background px-3 py-2.5">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{i.label}</div>
          <div className={`text-sm tabular-nums font-medium mt-0.5 ${i.pass ? "text-sev-low" : "text-sev-critical"}`}>
            {i.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pane({ label, tone, children }: { label: string; tone: "good" | "bad"; children: React.ReactNode }) {
  const c = tone === "bad" ? "var(--sev-critical)" : "var(--sev-low)";
  return (
    <div className="border rounded overflow-hidden" style={{ borderColor: c + "40" }}>
      <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest border-b"
        style={{ color: c, borderColor: c + "40", background: c + "08" }}>
        {label}
      </div>
      <div className="p-3 max-h-[280px] overflow-auto">{children}</div>
    </div>
  );
}

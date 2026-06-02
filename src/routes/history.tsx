import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { PillarRing, PillarBadge, SeverityBadge } from "@/components/PillarRing";
import { DiffPane } from "@/components/DiffPane";
import { PILLARS, describeFix, Failure } from "@/lib/epiphan-data";
import { FixStatusPill } from "@/components/StatusPills";
import { FileDown, Trash2, ChevronRight, Wand2, FileText, FileJson } from "lucide-react";
import { toCsv, toJson, downloadFile } from "@/lib/epiphan-export";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Audit History · epiphanAI" }] }),
  component: History,
});

function History() {
  const audits = useEpiphan((s) => s.audits);
  const clearAll = useEpiphan((s) => s.clearAll);
  const [confirming, setConfirming] = useState(false);

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mosaic Reports</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Audit history</h1>
            <p className="text-muted-foreground text-xs mt-1">
              Every audit, every fix, every before/after — auto-deployed and human-approved.
            </p>
          </div>
          {audits.length > 0 && (
            <div className="flex items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-[10px] text-sev-critical">Delete all audits, traces & guardrail events?</span>
                  <button
                    onClick={() => { clearAll(); setConfirming(false); }}
                    className="px-3 py-1.5 rounded bg-sev-critical text-background text-[11px] flex items-center gap-1.5 font-medium"
                  >
                    <Trash2 className="w-3 h-3" /> Confirm wipe
                  </button>
                  <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded border border-border text-[11px]">Cancel</button>
                </>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="px-3 py-1.5 rounded border border-sev-critical/40 text-sev-critical hover:bg-sev-critical/10 text-[11px] flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" /> Clear history
                </button>
              )}
            </div>
          )}
        </header>

        <div className="border border-border rounded-lg bg-surface overflow-hidden">
          {audits.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground text-xs">
              No audits yet. Start one from <a href="/dashboard" className="text-primary hover:underline">Audit Engine</a>.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_120px_100px_140px_100px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40 border-b border-border">
                <div>Store / Domain</div><div>Date</div><div>Score</div><div>Fixes deployed</div><div className="text-right">Status</div>
              </div>
              {audits.map((a) => {
                const overall = Math.round((a.scores.P1 + a.scores.P2 + a.scores.P3 + a.scores.P4 + a.scores.P5) / 5);
                const deployed = a.failures.filter((f) => f.status === "deployed").length;
                return (
                  <details key={a.id} className="border-b border-border last:border-b-0 group">
                    <summary className="grid grid-cols-[1fr_120px_100px_140px_100px] gap-3 px-5 py-3 cursor-pointer hover:bg-accent/20 list-none items-center">
                      <div>
                        <div className="text-xs text-foreground">{a.storeName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{a.url}</div>
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</div>
                      <div className="text-sm tabular-nums font-medium text-primary">{overall}</div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{deployed} / {a.failures.length}</div>
                      <div className="text-right"><FixStatusPill status={a.status === "complete" ? "deployed" : a.status} /></div>
                    </summary>
                    <div className="bg-background p-6 border-t border-border space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mosaic Report</div>
                        <button className="px-3 py-1.5 rounded border border-border hover:bg-accent/30 text-[11px] flex items-center gap-1.5">
                          <FileDown className="w-3 h-3" /> Export PDF
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-4">
                        {PILLARS.map((p) => (
                          <PillarRing key={p.id} pillar={p.id} score={a.scores[p.id]} label={p.short} />
                        ))}
                      </div>
                      <div className="grid grid-cols-5 gap-px bg-border border border-border rounded overflow-hidden">
                        {[["Total", a.failures.length, "var(--color-primary)"],
                          ["Critical", a.failures.filter(f => f.severity === "CRITICAL").length, "var(--sev-critical)"],
                          ["High", a.failures.filter(f => f.severity === "HIGH").length, "var(--sev-high)"],
                          ["Deployed", deployed, "var(--sev-low)"],
                          ["Pending", a.failures.filter(f => f.status === "review_pending").length, "var(--sev-medium)"],
                        ].map(([label, val, color]) => (
                          <div key={label as string} className="bg-background p-3 text-center">
                            <div className="text-xl tabular-nums font-medium" style={{ color: color as string }}>{val as number}</div>
                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label as string}</div>
                          </div>
                        ))}
                      </div>

                      {/* Per-fix log with before/after */}
                      <div className="border border-border rounded overflow-hidden">
                        <div className="px-4 py-2 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground bg-background/40">
                          Fix log · {a.failures.length} issues
                        </div>
                        <div className="divide-y divide-border">
                          {a.failures.map((f) => <FixHistoryRow key={f.id} f={f} />)}
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FixHistoryRow({ f }: { f: Failure }) {
  const [open, setOpen] = useState(false);
  const d = describeFix(f);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[60px_70px_90px_1fr_140px_24px] gap-3 px-4 py-2.5 items-center hover:bg-accent/20 text-left"
      >
        <PillarBadge pillar={f.pillar} />
        <div className="text-[11px] tabular-nums text-muted-foreground">{f.failureId}</div>
        <SeverityBadge severity={f.severity} />
        <div className="min-w-0">
          <div className="text-xs text-foreground truncate">{f.failureName}</div>
          {f.status === "deployed" && (
            <div className="text-[10px] text-sev-low truncate flex items-center gap-1 mt-0.5">
              <Wand2 className="w-2.5 h-2.5" /> {d.title}
            </div>
          )}
        </div>
        <FixStatusPill status={f.status} />
        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="bg-background/60 px-4 pb-4 space-y-3">
          {f.fix ? (
            <>
              <div className="border border-primary/30 bg-primary/5 rounded p-2.5 text-[11px] text-foreground">
                <span className="text-primary font-medium">{d.title}.</span>{" "}
                <span className="text-muted-foreground">{d.detail}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                <div className="border border-sev-critical/30 rounded overflow-hidden">
                  <div className="px-2 py-1 text-[9px] uppercase tracking-widest text-sev-critical bg-sev-critical/10 border-b border-sev-critical/30">Before</div>
                  <pre className="text-[10px] p-2 whitespace-pre-wrap max-h-52 overflow-auto text-muted-foreground">{f.fix.before}</pre>
                </div>
                <div className="border border-sev-low/30 rounded overflow-hidden">
                  <div className="px-2 py-1 text-[9px] uppercase tracking-widest text-sev-low bg-sev-low/10 border-b border-sev-low/30">After ({f.status === "deployed" ? "live" : f.status})</div>
                  <pre className="text-[10px] p-2 whitespace-pre-wrap max-h-52 overflow-auto text-foreground">{f.fix.after}</pre>
                </div>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-muted-foreground italic px-1">
              Manual remediation required — no AI fix template. {f.detail}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

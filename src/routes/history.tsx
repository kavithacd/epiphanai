import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { PillarRing } from "@/components/PillarRing";
import { PILLARS } from "@/lib/epiphan-data";
import { FixStatusPill } from "./dashboard";
import { FileDown } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Audit History · epiphanAI" }] }),
  component: History,
});

function History() {
  const audits = useEpiphan((s) => s.audits);
  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mosaic Reports</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Audit history</h1>
        </header>

        <div className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_120px_100px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40 border-b border-border">
            <div>Store / Domain</div><div>Date</div><div>Score</div><div>Fixes deployed</div><div className="text-right">Status</div>
          </div>
          {audits.map((a) => {
            const overall = Math.round((a.scores.P1 + a.scores.P2 + a.scores.P3 + a.scores.P4 + a.scores.P5) / 5);
            const deployed = a.failures.filter((f) => f.status === "deployed").length;
            return (
              <details key={a.id} className="border-b border-border last:border-b-0 group">
                <summary className="grid grid-cols-[1fr_120px_100px_120px_100px] gap-3 px-5 py-3 cursor-pointer hover:bg-accent/20 list-none items-center">
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
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

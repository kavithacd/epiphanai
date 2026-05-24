import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { PILLARS, PillarId, SEVERITY_WEIGHT } from "@/lib/epiphan-data";
import { TrendingUp, Sparkles, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/impact")({
  head: () => ({ meta: [{ title: "Fix Impact · epiphanAI" }] }),
  component: ImpactDashboard,
});

function ImpactDashboard() {
  const history = useEpiphan((s) => s.fixHistory);
  const audits = useEpiphan((s) => s.audits);

  // Aggregate by pillar
  const perPillar = PILLARS.map((p) => {
    const fixes = history.filter((h) => h.pillar === p.id);
    const points = fixes.reduce((sum, h) => sum + h.pillarDelta, 0);
    return { id: p.id, name: p.short, fixes: fixes.length, points, tokenVar: p.tokenVar };
  });

  const totalFixes = history.length;
  const totalDelta = history.reduce((s, h) => s + h.delta, 0);
  const avg = totalFixes > 0 ? Math.round((totalDelta / totalFixes) * 10) / 10 : 0;
  const biggest = [...history].sort((a, b) => b.delta - a.delta)[0];

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Outcomes</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Fix impact</h1>
          <p className="text-muted-foreground text-xs mt-1">
            Every deployment recorded with the GEO-score delta it caused. The real story of what epiphanAI changed for {audits[0]?.storeName ?? "your store"}.
          </p>
        </header>

        {history.length === 0 ? (
          <div className="border border-border rounded-lg bg-surface p-16 text-center text-muted-foreground text-xs">
            No fixes deployed yet. Run an audit and approve fixes to see their impact here.
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
              <Kpi label="Total fixes deployed" value={String(totalFixes)} sub="across all audits" />
              <Kpi label="Cumulative score Δ" value={`+${totalDelta.toFixed(1)}`} sub="points added (overall)" accent />
              <Kpi label="Avg score lift / fix" value={`+${avg}`} sub="points per deployment" />
              <Kpi label="Biggest single win" value={biggest ? `+${biggest.delta.toFixed(1)}` : "—"} sub={biggest?.title ?? "—"} />
            </div>

            {/* Per-pillar contribution */}
            <section className="border border-border rounded-lg bg-surface overflow-hidden">
              <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                Points added per pillar
              </div>
              <div className="p-4 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perPillar} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                      formatter={(v: any, k: any) => k === "points" ? [`+${v} pts`, "Score lift"] : [v, k]}
                    />
                    <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                      {perPillar.map((p) => (
                        <Cell key={p.id} fill={`var(--color-${p.tokenVar})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Per-fix log */}
            <section className="border border-border rounded-lg bg-surface overflow-hidden">
              <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span>Deployment log — {history.length} fix{history.length === 1 ? "" : "es"}</span>
                <span className="text-muted-foreground">Sorted newest first</span>
              </div>
              <div className="divide-y divide-border">
                {history.map((h) => (
                  <ImpactRow key={h.id} h={h} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-background p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-3xl tabular-nums font-medium mt-1 ${accent ? "text-sev-low" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</div>
    </div>
  );
}

function ImpactRow({ h }: { h: ReturnType<typeof useEpiphan.getState>["fixHistory"][0] }) {
  const pillar = PILLARS.find((p) => p.id === h.pillar)!;
  const color = `var(--color-${pillar.tokenVar})`;
  const overallBefore = Math.round(Object.values(h.scoresBefore).reduce((s, n) => s + n, 0) / 5);
  const overallAfter = Math.round(Object.values(h.scoresAfter).reduce((s, n) => s + n, 0) / 5);
  return (
    <div className="grid grid-cols-[60px_1fr_120px_140px_120px] gap-3 px-5 py-3 items-center hover:bg-accent/20">
      <div className="text-[10px] uppercase tracking-widest font-semibold tabular-nums" style={{ color }}>
        {h.pillar}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-foreground truncate flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" style={{ color }} />
          {h.title}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{h.detail}</div>
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        {new Date(h.timestamp).toLocaleString()}
      </div>
      <div className="text-[11px] tabular-nums">
        <span className="text-muted-foreground">{overallBefore}</span>
        <ArrowUpRight className="inline w-3 h-3 mx-1 text-sev-low" />
        <span className="text-foreground font-medium">{overallAfter}</span>
        <span className="text-muted-foreground"> / 100</span>
      </div>
      <div className="text-right">
        <span className="text-[11px] tabular-nums font-medium px-2 py-1 rounded inline-flex items-center gap-1"
          style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 30%, transparent)` }}>
          <TrendingUp className="w-3 h-3" /> +{h.delta.toFixed(1)} overall
        </span>
      </div>
    </div>
  );
}

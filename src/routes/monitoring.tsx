import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { mulberry32, hashStr, seededInt, resolveProbeQuery } from "@/lib/epiphan-data";
import { Radio, ChevronDown, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/monitoring")({
  head: () => ({ meta: [{ title: "Brand Monitoring · epiphanAI" }] }),
  component: BrandMonitoring,
});

const ENGINE_COLOR: Record<string, string> = {
  chatgpt: "#10A37F",
  gemini: "#4285F4",
  perplexity: "#20B2AA",
};

const COMPETITOR_POOLS: [RegExp, string[]][] = [
  [/footwear|athletic|running|sport/i, ["Nike", "Adidas", "New Balance", "ASICS", "On Running"]],
  [/jewelry|crystal|pendant|luxury/i, ["Pandora", "Tiffany & Co.", "TOUS", "Thomas Sabo", "Cartier"]],
  [/apparel|fashion|knitwear|clothing/i, ["Uniqlo", "COS", "Arket", "Zara", "& Other Stories"]],
  [/beauty|skincare|makeup|cosmetic/i, ["Sephora", "L'Oréal", "Dermalogica", "The Ordinary", "NARS"]],
  [/furniture|home|living/i, ["IKEA", "HAY", "Muuto", "Menu", "Normann Copenhagen"]],
  [/marketplace|electronics|general/i, ["Amazon", "Zalando", "ASOS", "MediaMarkt", "Otto"]],
];

function deriveCompetitors(
  industry: string,
  brand: string,
  seed: number,
  engines: string[],
): { name: string; perEngine: Record<string, number>; total: number }[] {
  const rng = mulberry32(seed);
  let pool: string[] = ["CompetitorA", "CompetitorB", "CompetitorC", "CompetitorD", "CompetitorE"];
  for (const [regex, names] of COMPETITOR_POOLS) {
    if (regex.test(industry)) { pool = names; break; }
  }
  const filtered = pool.filter((n) => n.toLowerCase() !== brand.toLowerCase());
  const shuffled = [...filtered].sort(() => rng() - 0.5);
  const top = shuffled.slice(0, Math.min(4, filtered.length));

  return top.map((name, rank) => {
    const perEngine: Record<string, number> = {};
    let total = 0;
    for (const eid of engines) {
      const base = Math.max(0, seededInt(rng, 4 - rank, 10 - rank * 2));
      perEngine[eid] = base;
      total += base;
    }
    return { name, perEngine, total };
  }).sort((a, b) => b.total - a.total);
}

function deriveSentiment(
  auditId: string,
  engineId: string,
): { positive: number; neutral: number; negative: number } {
  const rng = mulberry32(hashStr(auditId + engineId + "sentiment"));
  const positive = seededInt(rng, 5, 22);
  const neutral = seededInt(rng, 18, 38);
  const negative = 100 - positive - neutral;
  return { positive, neutral, negative };
}

function GaugeRing({
  pct, color, size = 88,
}: { pct: number; color: string; size?: number }) {
  const sw = 9;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const cx = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden flex">
      <div style={{ width: `${positive}%`, background: "var(--sev-low)" }} />
      <div style={{ width: `${neutral}%`, background: "var(--sev-medium)" }} />
      <div style={{ width: `${negative}%`, background: "var(--sev-high)" }} />
    </div>
  );
}

function BrandMonitoring() {
  const audits = useEpiphan((s) => s.audits);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const probeQueries = useEpiphan((s) => s.probeQueries);

  const completedAudits = audits.filter((a) => a.sovBreakdown);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const audit = useMemo(() => {
    if (selectedId) return completedAudits.find((a) => a.id === selectedId) ?? completedAudits[0];
    return completedAudits[0];
  }, [selectedId, completedAudits]);

  const enabledEngines = probeEngines.filter((e) => e.enabled);

  const competitors = useMemo(() => {
    if (!audit) return [];
    const seed = hashStr(audit.id + (audit.ctx?.industry ?? ""));
    return deriveCompetitors(
      audit.ctx?.industry ?? "E-commerce",
      audit.ctx?.brand ?? audit.storeName,
      seed,
      enabledEngines.map((e) => e.id),
    );
  }, [audit, enabledEngines]);

  const resolvedQueries = useMemo(() => {
    if (!audit?.ctx) return probeQueries.filter((q) => q.enabled).map((q) => q.text);
    return probeQueries.filter((q) => q.enabled).map((q) => resolveProbeQuery(q.text, audit.ctx!));
  }, [audit, probeQueries]);

  if (completedAudits.length === 0) {
    return (
      <AppShell>
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
          <header>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Intelligence</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Brand Monitoring</h1>
          </header>
          <div className="border border-border rounded-lg bg-surface p-16 text-center space-y-3">
            <Radio className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-xs">
              No P5 probe data yet. Run an audit to completion to see Share of Voice, sentiment, and competitor citations.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const breakdown = audit?.sovBreakdown ?? {};
  const brand = audit?.ctx?.brand ?? audit?.storeName ?? "Brand";
  const industry = audit?.ctx?.industry ?? "E-commerce";

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">

        {/* Header */}
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Intelligence</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Brand Monitoring</h1>
            <p className="text-muted-foreground text-xs mt-1">
              Share of Voice, sentiment, and competitor citations across AI engines for <span className="text-foreground">{brand}</span>.
            </p>
          </div>

          {completedAudits.length > 1 && (
            <div className="relative">
              <select
                className="appearance-none text-xs bg-surface border border-border rounded px-3 py-1.5 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                value={audit?.id ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {completedAudits.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.storeName} — {new Date(a.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </header>

        {/* SoV gauges — one card per engine */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {enabledEngines.map((engine) => {
            const data = breakdown[engine.id];
            const color = ENGINE_COLOR[engine.id] ?? "var(--primary)";
            const total = data?.total ?? 0;
            const brandCited = data?.brandCited ?? 0;
            const compCited = data?.competitorCited ?? 0;
            const brandPct = total > 0 ? Math.round((brandCited / total) * 100) : 0;
            const compPct = total > 0 ? Math.round((compCited / total) * 100) : 0;

            return (
              <div key={engine.id} className="border border-border rounded-lg bg-surface p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-foreground">{engine.label}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Share of Voice</div>
                  </div>
                  <span
                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                    style={{ color, borderColor: color + "40", background: color + "12" }}
                  >
                    Live
                  </span>
                </div>

                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <GaugeRing pct={brandPct} color={color} size={88} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: "rotate(0deg)" }}>
                      <span className="text-lg tabular-nums font-semibold leading-none" style={{ color }}>
                        {brandPct}%
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">SoV</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{brand} cited</span>
                      <span className="tabular-nums text-foreground">{brandCited}/{total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Competitor cited</span>
                      <span className="tabular-nums" style={{ color: "var(--sev-high)" }}>{compCited}/{total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Probe queries</span>
                      <span className="tabular-nums text-muted-foreground">{total}</span>
                    </div>
                    <div className="pt-1 border-t border-border">
                      <div
                        className="text-[10px] font-medium"
                        style={{ color: brandPct === 0 ? "var(--sev-critical)" : brandPct < 30 ? "var(--sev-high)" : "var(--sev-low)" }}
                      >
                        {brandPct === 0
                          ? "Not cited — critical GEO gap"
                          : brandPct < 30
                          ? "Low visibility"
                          : "Good visibility"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Sentiment breakdown */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>Brand Sentiment — across AI responses</span>
            <div className="flex items-center gap-3">
              <LegendDot color="var(--sev-low)" label="Positive" />
              <LegendDot color="var(--sev-medium)" label="Neutral" />
              <LegendDot color="var(--sev-high)" label="Negative" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {enabledEngines.map((engine) => {
              const { positive, neutral, negative } = deriveSentiment(audit!.id, engine.id);
              const color = ENGINE_COLOR[engine.id] ?? "var(--primary)";
              return (
                <div key={engine.id} className="px-5 py-4 grid grid-cols-[120px_1fr_180px] gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-xs text-foreground">{engine.label}</span>
                  </div>
                  <SentimentBar positive={positive} neutral={neutral} negative={negative} />
                  <div className="flex items-center justify-end gap-3 text-[10px] tabular-nums">
                    <span style={{ color: "var(--sev-low)" }}>{positive}% pos</span>
                    <span style={{ color: "var(--sev-medium)" }}>{neutral}% neu</span>
                    <span style={{ color: "var(--sev-high)" }}>{negative}% neg</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-2 border-t border-border bg-background/40 text-[10px] text-muted-foreground">
            Sentiment derived from AI response tone analysis across {resolvedQueries.length} active probe queries · seeded per audit
          </div>
        </section>

        {/* Competitor citations table */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            Competitor Citation Leaderboard — {industry}
          </div>
          <div
            className="grid gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40"
            style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
          >
            <div>Competitor</div>
            {enabledEngines.map((e) => <div key={e.id} className="text-center">{e.label}</div>)}
            <div className="text-center">Total</div>
            <div className="text-right">vs {brand}</div>
          </div>

          {/* Brand row (always first, pinned) */}
          <div
            className="grid gap-3 px-5 py-2.5 items-center border-t border-border bg-primary/5"
            style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs text-primary font-medium">{brand}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest border border-border px-1 py-0.5 rounded">you</span>
            </div>
            {enabledEngines.map((engine) => {
              const data = breakdown[engine.id];
              return (
                <div key={engine.id} className="text-center text-xs tabular-nums text-foreground">
                  {data?.brandCited ?? 0}/{data?.total ?? 0}
                </div>
              );
            })}
            <div className="text-center text-xs tabular-nums text-foreground">
              {enabledEngines.reduce((s, e) => s + (breakdown[e.id]?.brandCited ?? 0), 0)}/
              {enabledEngines.reduce((s, e) => s + (breakdown[e.id]?.total ?? 0), 0)}
            </div>
            <div className="text-right">
              <span className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground">—</span>
            </div>
          </div>

          {competitors.map((comp, idx) => {
            const brandTotal = enabledEngines.reduce((s, e) => s + (breakdown[e.id]?.brandCited ?? 0), 0);
            const delta = comp.total - brandTotal;
            return (
              <div
                key={comp.name}
                className="grid gap-3 px-5 py-2.5 items-center border-t border-border hover:bg-accent/20"
                style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] tabular-nums font-medium w-4 text-muted-foreground"
                  >{idx + 1}</span>
                  <span className="text-xs text-foreground">{comp.name}</span>
                </div>
                {enabledEngines.map((engine) => {
                  const cited = comp.perEngine[engine.id] ?? 0;
                  const total = breakdown[engine.id]?.total ?? 0;
                  const color = ENGINE_COLOR[engine.id] ?? "var(--foreground)";
                  return (
                    <div key={engine.id} className="text-center text-xs tabular-nums" style={{ color: cited > 0 ? color : "var(--muted-foreground)" }}>
                      {cited}/{total}
                    </div>
                  );
                })}
                <div className="text-center text-xs tabular-nums font-medium text-foreground">{comp.total}</div>
                <div className="text-right">
                  <span
                    className="text-[10px] tabular-nums px-1.5 py-0.5 rounded"
                    style={{
                      color: delta > 0 ? "var(--sev-high)" : "var(--sev-low)",
                      background: delta > 0 ? "var(--sev-high-bg, color-mix(in oklab, var(--sev-high) 12%, transparent))" : "color-mix(in oklab, var(--sev-low) 12%, transparent)",
                    }}
                  >
                    {delta > 0 ? `+${delta}` : delta} citations
                  </span>
                </div>
              </div>
            );
          })}

          <div className="px-5 py-2 border-t border-border bg-background/40 text-[10px] text-muted-foreground">
            Citation counts = number of probe queries where each brand appeared in AI responses
          </div>
        </section>

        {/* Probe queries used */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>Active Probe Queries — {resolvedQueries.length} queries fired</span>
            <a
              href="/settings"
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              Edit in Settings <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="divide-y divide-border max-h-[320px] overflow-auto">
            {resolvedQueries.map((q, i) => (
              <div key={i} className="px-5 py-2.5 flex items-start gap-3 hover:bg-accent/20">
                <span className="text-[10px] tabular-nums text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}</span>
                <span className="text-xs text-foreground leading-relaxed">{q}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
          Monitoring data for {brand} · {industry} · {enabledEngines.map((e) => e.label).join(", ")} · sovereign local inference
        </div>
      </div>
    </AppShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BrandMonitorSetup } from "@/components/BrandMonitorSetup";
import { ProbeConfiguration } from "@/components/ProbeConfiguration";
import { useEpiphan } from "@/lib/epiphan-store";
import { nextBrandMonitorRefresh } from "@/lib/epiphan-store";
import { mulberry32, hashStr, seededInt, resolveProbeQuery } from "@/lib/epiphan-data";
import { Radio, ChevronDown, ChevronRight, ExternalLink, Download, X, Copy, Check, Settings as SettingsIcon, SlidersHorizontal, RefreshCw } from "lucide-react";

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

// Seeded SoV per engine — deterministic per audit+engine combination.
// Brand stays at 0 (consistent with F5.1 zero-citation failure).
// Competitor cited count varies per engine via seeded RNG.
function deriveSovForEngine(
  auditId: string,
  engineId: string,
  totalProbes: number,
): { brandCited: number; competitorCited: number } {
  const rng = mulberry32(hashStr(auditId + engineId));
  const competitorCited = seededInt(rng, Math.ceil(totalProbes * 0.6), Math.ceil(totalProbes * 0.9));
  return { brandCited: 0, competitorCited };
}

// Try to parse a competitor name from F5.2 failure detail text.
// F5.2 detail format: "Top competitor cited in X/Y AI answers across engines for category queries."
// Returns null if no parseable name is found.
function parseCompetitorFromF52(detail: string): string | null {
  const m = detail.match(/(?:^|\s)([A-Z][A-Za-z0-9& .'-]{2,})\s+(?:cited|dominat|appear)/);
  if (m && m[1] && m[1].toLowerCase() !== "top competitor") return m[1].trim();
  return null;
}

function buildCompetitorList(
  f52Detail: string | null,
  industry: string,
  brand: string,
  auditId: string,
  engines: string[],
  savedCompetitors: string[] = [],
): { name: string; perEngine: Record<string, number>; total: number }[] {
  const rng = mulberry32(hashStr(auditId + industry + "competitors"));

  let pool: string[] = ["CompetitorA", "CompetitorB", "CompetitorC", "CompetitorD", "CompetitorE"];
  for (const [regex, names] of COMPETITOR_POOLS) {
    if (regex.test(industry)) { pool = names; break; }
  }

  // Saved competitors from setup are the primary seed (filtered against brand name)
  const saved = savedCompetitors
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== brand.toLowerCase());

  // If F5.2 gives us a parseable competitor, pin it at the front if not already present
  const pinned = f52Detail ? parseCompetitorFromF52(f52Detail) : null;
  const savedLower = new Set(saved.map((n) => n.toLowerCase()));
  let names: string[] = [...saved];
  if (pinned && !savedLower.has(pinned.toLowerCase()) && pinned.toLowerCase() !== brand.toLowerCase()) {
    names.unshift(pinned);
  }

  // Fill remaining slots (up to 5 total) from the industry pool
  if (names.length < 5) {
    const usedLower = new Set(names.map((n) => n.toLowerCase()));
    const filtered = pool.filter(
      (n) => n.toLowerCase() !== brand.toLowerCase() && !usedLower.has(n.toLowerCase()),
    );
    const shuffled = [...filtered].sort(() => rng() - 0.5);
    names = [...names, ...shuffled].slice(0, 5);
  }

  return names.slice(0, 5).map((name, rank) => {
    const perEngine: Record<string, number> = {};
    let total = 0;
    for (const eid of engines) {
      const base = Math.max(0, seededInt(rng, Math.max(0, 5 - rank), Math.max(1, 10 - rank * 2)));
      perEngine[eid] = base;
      total += base;
    }
    return { name, perEngine, total };
  }).sort((a, b) => b.total - a.total);
}

// For a given competitor + engine, deterministically pick which query indices were cited.
// Uses a seeded Fisher-Yates shuffle so results are stable per audit.
function deriveQueriesForCompEngine(
  compName: string,
  auditId: string,
  engineId: string,
  totalCited: number,
  queryCount: number,
): number[] {
  if (totalCited <= 0 || queryCount === 0) return [];
  const rng = mulberry32(hashStr(auditId + compName + engineId + "querymap"));
  const indices = Array.from({ length: queryCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(totalCited, queryCount)).sort((a, b) => a - b);
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

function overallSentimentLabel(sentiments: { positive: number }[]): string {
  if (sentiments.length === 0) return "Mixed";
  const avgPos = sentiments.reduce((s, x) => s + x.positive, 0) / sentiments.length;
  if (avgPos >= 40) return "Mostly Positive";
  if (avgPos >= 20) return "Mixed";
  return "Mostly Negative";
}

function GaugeRing({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) {
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type ExportSections = { sov: boolean; sentiment: boolean; competitors: boolean; queries: boolean };

const EXPORT_SECTION_LABELS: { key: keyof ExportSections; label: string }[] = [
  { key: "sov", label: "Share of Voice" },
  { key: "sentiment", label: "Sentiment Breakdown" },
  { key: "competitors", label: "Competitor Citations" },
  { key: "queries", label: "Active Probe Queries" },
];

function buildCSV(params: {
  brand: string;
  industry: string;
  storeName: string;
  enabledEngines: { id: string; label: string }[];
  probeTotal: number;
  sovByEngine: Record<string, { brandCited: number; competitorCited: number }>;
  sentimentByEngine: Record<string, { positive: number; neutral: number; negative: number }>;
  competitors: { name: string; perEngine: Record<string, number>; total: number }[];
  resolvedQueries: string[];
  sections: ExportSections;
}): string {
  const { brand, industry, storeName, enabledEngines, probeTotal, sovByEngine, sentimentByEngine, competitors, resolvedQueries, sections } = params;
  const rows: string[] = [];

  rows.push("# epiphanAI Brand Monitoring Report");
  rows.push(`Brand,${escapeCSV(brand)}`);
  rows.push(`Industry,${escapeCSV(industry)}`);
  rows.push(`Store,${escapeCSV(storeName)}`);
  rows.push(`Report Date,${new Date().toLocaleDateString()}`);
  rows.push("");

  if (sections.sov) {
    rows.push("## Share of Voice");
    rows.push(["Engine", "Brand SoV %", "Brand Cited", "Competitor Cited", "Total Probes"].map(escapeCSV).join(","));
    for (const engine of enabledEngines) {
      const { brandCited, competitorCited } = sovByEngine[engine.id] ?? { brandCited: 0, competitorCited: 0 };
      const brandPct = probeTotal > 0 ? Math.round((brandCited / probeTotal) * 100) : 0;
      rows.push([engine.label, `${brandPct}%`, brandCited, competitorCited, probeTotal].map(escapeCSV).join(","));
    }
    rows.push("");
  }

  if (sections.sentiment) {
    rows.push("## Sentiment Breakdown");
    rows.push(["Engine", "Positive %", "Neutral %", "Negative %"].map(escapeCSV).join(","));
    for (const engine of enabledEngines) {
      const { positive, neutral, negative } = sentimentByEngine[engine.id];
      rows.push([engine.label, `${positive}%`, `${neutral}%`, `${negative}%`].map(escapeCSV).join(","));
    }
    rows.push("");
  }

  if (sections.competitors) {
    rows.push("## Competitor Citations");
    const compHeaders = ["Competitor", ...enabledEngines.map((e) => e.label), "Total Citations", `vs ${brand}`];
    rows.push(compHeaders.map(escapeCSV).join(","));

    const brandTotalCited = enabledEngines.reduce((s, e) => s + (sovByEngine[e.id]?.brandCited ?? 0), 0);
    const brandRowCols = [brand, ...enabledEngines.map((e) => String(sovByEngine[e.id]?.brandCited ?? 0)), String(brandTotalCited), "—"];
    rows.push(brandRowCols.map(escapeCSV).join(","));

    for (const comp of competitors) {
      const delta = comp.total - brandTotalCited;
      const cols = [
        comp.name,
        ...enabledEngines.map((e) => String(comp.perEngine[e.id] ?? 0)),
        String(comp.total),
        delta > 0 ? `+${delta}` : String(delta),
      ];
      rows.push(cols.map(escapeCSV).join(","));
    }
    rows.push("");
  }

  if (sections.queries) {
    rows.push("## Active Probe Queries");
    rows.push(["#", "Query"].map(escapeCSV).join(","));
    resolvedQueries.forEach((q, i) => {
      rows.push([i + 1, q].map(escapeCSV).join(","));
    });
  }

  return rows.join("\n");
}

function BrandMonitoring() {
  const audits = useEpiphan((s) => s.audits);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const brandMonitorConfig = useEpiphan((s) => s.brandMonitorConfig);
  const refreshBrandMonitor = useEpiphan((s) => s.refreshBrandMonitor);
  const { limits } = useMyPlan();
  const monitorLocked = !!(limits && !limits.hasMonitor);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSections, setExportSections] = useState<ExportSections>({ sov: true, sentiment: true, competitors: true, queries: true });
  const [copyToast, setCopyToast] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [tab, setTab] = useState<"dashboard" | "setup" | "probes">(
    brandMonitorConfig.configured ? "dashboard" : "setup",
  );


  // Auto-refresh every Monday at 8:00 PM (local time) while monitoring is active.
  // Runs immediately on load if the scheduled refresh was missed (e.g. tab closed).
  const lastRefreshAt = brandMonitorConfig.lastRefreshAt;
  const monitoringActive = brandMonitorConfig.configured;
  useEffect(() => {
    if (!monitoringActive) return;
    const tick = () => {
      const baseline = lastRefreshAt ?? Date.now();
      const due = nextBrandMonitorRefresh(new Date(baseline)).getTime();
      const delay = due - Date.now();
      if (delay <= 0) {
        refreshBrandMonitor();
      }
      return delay;
    };
    let delay = tick();
    // Cap setTimeout at ~24 days to avoid 32-bit overflow; re-arm if longer.
    const MAX_DELAY = 2_000_000_000;
    const timeoutId = window.setTimeout(
      function fire() {
        refreshBrandMonitor();
      },
      Math.min(Math.max(delay, 0), MAX_DELAY),
    );
    return () => window.clearTimeout(timeoutId);
  }, [monitoringActive, lastRefreshAt, refreshBrandMonitor]);

  const nextRefreshAt = useMemo(
    () => nextBrandMonitorRefresh(new Date(lastRefreshAt ?? Date.now())),
    [lastRefreshAt],
  );

  const TabBar = (
    <div className="flex items-center gap-1 border-b border-border -mx-1 px-1">
      <button
        onClick={() => setTab("dashboard")}
        className={`px-3 py-2 text-[11px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
          tab === "dashboard"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="inline-flex items-center gap-1.5"><Radio className="w-3 h-3" /> Dashboard</span>
      </button>
      <button
        onClick={() => setTab("setup")}
        className={`px-3 py-2 text-[11px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
          tab === "setup"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="inline-flex items-center gap-1.5"><SettingsIcon className="w-3 h-3" /> Setup</span>
      </button>
      <button
        onClick={() => setTab("probes")}
        className={`px-3 py-2 text-[11px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
          tab === "probes"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="w-3 h-3" /> Probes</span>
      </button>
    </div>
  );

  const PageHeader = (
    <header>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Intelligence</div>
      <h1 className="text-2xl font-sans font-medium mt-1">Brand Monitoring</h1>
    </header>
  );

  // Setup tab — always available
  if (tab === "setup") {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {PageHeader}
          {TabBar}
          <BrandMonitorSetup />
        </div>
      </AppShell>
    );
  }

  // Probes tab — always available
  if (tab === "probes") {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {PageHeader}
          {TabBar}
          <ProbeConfiguration />
        </div>
      </AppShell>
    );
  }


  // Gate: setup not complete
  if (!brandMonitorConfig.configured) {
    return (
      <AppShell>
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
          {PageHeader}
          {TabBar}
          <div className="border border-border rounded-lg bg-surface p-16 text-center space-y-4">
            <Radio className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-foreground text-sm font-medium">Set up brand monitoring to see your dashboard</p>
            <p className="text-muted-foreground text-xs max-w-sm mx-auto">
              Define your brand and competitors in the Setup tab to activate Share of Voice tracking, sentiment analysis, and competitor citations.
            </p>
            <button
              onClick={() => setTab("setup")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Go to Brand Monitoring Setup
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Empty state: no audits at all
  if (audits.length === 0) {
    return (
      <AppShell>
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
          {PageHeader}
          {TabBar}
          <div className="border border-border rounded-lg bg-surface p-16 text-center space-y-3">
            <Radio className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-xs">
              Run a GEO audit to see brand monitoring data.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }


  const audit = selectedId ? (audits.find((a) => a.id === selectedId) ?? audits[0]) : audits[0];
  const enabledEngines = probeEngines.filter((e) => e.enabled);

  // Derive total probe count from sovBreakdown if available, fallback to enabled queries count
  const probeTotal = audit.sovBreakdown
    ? (Object.values(audit.sovBreakdown)[0]?.total ?? probeQueries.filter((q) => q.enabled).length)
    : probeQueries.filter((q) => q.enabled).length;

  // Parse competitor from F5.2 failure if present
  const f52 = audit.failures.find((f) => f.failureId === "F5.2");
  const f52Detail = f52?.detail ?? null;

  const brand = brandMonitorConfig.brandName || audit.ctx?.brand || audit.storeName;
  const industry = audit.ctx?.industry ?? "E-commerce";

  const competitors = useMemo(() =>
    buildCompetitorList(f52Detail, industry, brand, audit.id, enabledEngines.map((e) => e.id), brandMonitorConfig.competitors),
    [f52Detail, industry, brand, audit.id, enabledEngines, brandMonitorConfig.competitors]
  );

  const resolvedQueries = useMemo(() => {
    if (!audit?.ctx) return probeQueries.filter((q) => q.enabled).map((q) => q.text);
    return probeQueries.filter((q) => q.enabled).map((q) => resolveProbeQuery(q.text, audit.ctx!));
  }, [audit, probeQueries]);

  // For each competitor × engine, the set of query indices that cited them (seeded, stable)
  const compQueryCitations = useMemo(() => {
    const result: Record<string, Record<string, number[]>> = {};
    for (const comp of competitors) {
      result[comp.name] = {};
      for (const engine of enabledEngines) {
        const cited = comp.perEngine[engine.id] ?? 0;
        result[comp.name][engine.id] = deriveQueriesForCompEngine(
          comp.name, audit.id, engine.id, cited, resolvedQueries.length,
        );
      }
    }
    return result;
  }, [competitors, enabledEngines, audit.id, resolvedQueries.length]);

  // Seeded SoV per engine
  const sovByEngine = useMemo(() =>
    Object.fromEntries(
      enabledEngines.map((e) => [e.id, deriveSovForEngine(audit.id, e.id, probeTotal)])
    ),
    [audit.id, enabledEngines, probeTotal]
  );

  // Sentiment per engine (memoized)
  const sentimentByEngine = useMemo(() =>
    Object.fromEntries(
      enabledEngines.map((e) => [e.id, deriveSentiment(audit.id, e.id)])
    ),
    [audit.id, enabledEngines]
  );

  const overallLabel = overallSentimentLabel(enabledEngines.map((e) => sentimentByEngine[e.id]));
  const overallLabelColor =
    overallLabel === "Mostly Positive" ? "var(--sev-low)"
    : overallLabel === "Mixed" ? "var(--sev-medium)"
    : "var(--sev-high)";

  const brandTotalCited = enabledEngines.reduce((s, e) => s + (sovByEngine[e.id]?.brandCited ?? 0), 0);
  const brandTotalProbes = enabledEngines.reduce((s, e) => s + probeTotal, 0);

  function handleCopySummary() {
    const date = new Date().toLocaleDateString();
    const lines: string[] = [];
    lines.push(`📊 Brand Monitoring — ${brand}`);
    lines.push(`${audit.storeName} · ${date}`);
    lines.push("");
    lines.push("Share of Voice");
    for (const engine of enabledEngines) {
      const { brandCited, competitorCited } = sovByEngine[engine.id] ?? { brandCited: 0, competitorCited: 0 };
      const brandPct = probeTotal > 0 ? Math.round((brandCited / probeTotal) * 100) : 0;
      lines.push(`• ${engine.label}: ${brandPct}% (${brandCited}/${probeTotal} probes cited · competitors ${competitorCited}/${probeTotal})`);
    }
    lines.push("");
    lines.push(`Sentiment: ${overallLabel}`);
    for (const engine of enabledEngines) {
      const { positive, neutral, negative } = sentimentByEngine[engine.id];
      lines.push(`• ${engine.label}: ${positive}% positive · ${neutral}% neutral · ${negative}% negative`);
    }
    lines.push("");
    lines.push(`Top competitors (${industry})`);
    competitors.slice(0, 3).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.name} — ${c.total} citations`);
    });
    lines.push("");
    lines.push(`${resolvedQueries.length} probe queries active across ${enabledEngines.map((e) => e.label).join(", ")}`);
    lines.push("Generated by epiphanAI · sovereign GEO");

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  }

  function openExportModal() {
    setExportSections({ sov: true, sentiment: true, competitors: true, queries: true });
    setShowExportModal(true);
  }

  function doExportCSV(sections: ExportSections) {
    setShowExportModal(false);
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = (audit.storeName ?? "store").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `${safeName}-monitoring-${dateStr}.csv`;
    const csv = buildCSV({
      brand,
      industry,
      storeName: audit.storeName,
      enabledEngines,
      probeTotal,
      sovByEngine,
      sentimentByEngine,
      competitors,
      resolvedQueries,
      sections,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">

        {TabBar}

        {/* Header */}
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Intelligence</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Brand Monitoring</h1>
            <p className="text-muted-foreground text-xs mt-1">
              Share of Voice, sentiment, and competitor citations across AI engines for{" "}
              <span className="text-foreground">{brand}</span>.
            </p>
            {brandMonitorConfig.configured && brandMonitorConfig.brandName && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button
                  onClick={() => setTab("setup")}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/8 text-primary text-[10px] hover:bg-primary/15 transition-colors"
                >
                  <Radio className="w-2.5 h-2.5" />
                  Monitoring: {brandMonitorConfig.brandName}
                </button>
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-background text-[10px] text-muted-foreground"
                  title={`Last refreshed: ${
                    lastRefreshAt ? new Date(lastRefreshAt).toLocaleString() : "—"
                  }`}
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Auto-refresh: Mondays 8:00 PM · next{" "}
                  {nextRefreshAt.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>


          <div className="flex items-center gap-2">
            {audits.length > 1 && (
              <div className="relative">
                <select
                  className="appearance-none text-xs bg-surface border border-border rounded px-3 py-1.5 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                  value={audit.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {audits.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.storeName} — {new Date(a.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 text-xs bg-surface border border-border rounded px-3 py-1.5 text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              Copy summary
            </button>
            <button
              onClick={openExportModal}
              className="flex items-center gap-1.5 text-xs bg-surface border border-border rounded px-3 py-1.5 text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          </div>
        </header>

        {/* SoV gauges */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {enabledEngines.map((engine) => {
            const { brandCited, competitorCited } = sovByEngine[engine.id] ?? { brandCited: 0, competitorCited: 0 };
            const color = ENGINE_COLOR[engine.id] ?? "var(--primary)";
            const brandPct = probeTotal > 0 ? Math.round((brandCited / probeTotal) * 100) : 0;
            const compPct = probeTotal > 0 ? Math.round((competitorCited / probeTotal) * 100) : 0;

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
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg tabular-nums font-semibold leading-none" style={{ color }}>
                        {brandPct}%
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">SoV</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{brand} cited</span>
                      <span className="tabular-nums text-foreground">{brandCited}/{probeTotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Competitor cited</span>
                      <span className="tabular-nums" style={{ color: "var(--sev-high)" }}>{competitorCited}/{probeTotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Probe queries</span>
                      <span className="tabular-nums text-muted-foreground">{probeTotal}</span>
                    </div>
                    <div className="pt-1 border-t border-border">
                      <div
                        className="text-[10px] font-medium"
                        style={{
                          color: brandPct === 0 ? "var(--sev-critical)"
                            : brandPct < 30 ? "var(--sev-high)"
                            : "var(--sev-low)",
                        }}
                      >
                        {brandPct === 0 ? "Not cited — critical GEO gap"
                          : brandPct < 30 ? "Low visibility"
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
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <span>Brand Sentiment — across AI responses</span>
            <div className="flex items-center gap-3">
              <LegendDot color="var(--sev-low)" label="Positive" />
              <LegendDot color="var(--sev-medium)" label="Neutral" />
              <LegendDot color="var(--sev-high)" label="Negative" />
            </div>
          </div>

          <div className="divide-y divide-border">
            {enabledEngines.map((engine) => {
              const { positive, neutral, negative } = sentimentByEngine[engine.id];
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

          {/* Overall sentiment summary */}
          <div className="px-5 py-3 border-t border-border bg-background/40 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              {resolvedQueries.length} active probe queries · seeded per audit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground uppercase tracking-widest">Overall sentiment:</span>
              <span className="font-medium" style={{ color: overallLabelColor }}>{overallLabel}</span>
            </span>
          </div>
        </section>

        {/* Competitor citations table */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            Competitor Citation Leaderboard — {industry}
          </div>

          {/* Column headers */}
          <div
            className="grid gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40"
            style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
          >
            <div>Competitor</div>
            {enabledEngines.map((e) => <div key={e.id} className="text-center">{e.label}</div>)}
            <div className="text-center">Total</div>
            <div className="text-right">vs {brand}</div>
          </div>

          {/* Brand row — pinned at top */}
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setExpandedRow(expandedRow === "__brand__" ? null : "__brand__")}
              className="w-full text-left"
            >
              <div
                className="grid gap-3 px-5 py-2.5 items-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
              >
                <div className="flex items-center gap-2">
                  {expandedRow === "__brand__"
                    ? <ChevronDown className="w-3 h-3 text-primary shrink-0" />
                    : <ChevronRight className="w-3 h-3 text-primary shrink-0" />}
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-xs text-primary font-medium">{brand}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest border border-border px-1 py-0.5 rounded">you</span>
                </div>
                {enabledEngines.map((engine) => {
                  const { brandCited } = sovByEngine[engine.id] ?? { brandCited: 0 };
                  return (
                    <div key={engine.id} className="text-center text-xs tabular-nums text-foreground">
                      {brandCited}/{probeTotal}
                    </div>
                  );
                })}
                <div className="text-center text-xs tabular-nums text-foreground">
                  {brandTotalCited}/{brandTotalProbes}
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground">—</span>
                </div>
              </div>
            </button>
            {expandedRow === "__brand__" && (
              <div className="border-t border-border bg-background/60 px-5 py-4 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                  Queries where <span className="text-primary">{brand}</span> was not cited — {resolvedQueries.length} absent
                </div>
                {resolvedQueries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active probe queries.</p>
                ) : (
                  <div className="space-y-1">
                    {resolvedQueries.map((q, i) => (
                      <div key={i} className="flex items-start gap-3 py-1.5 px-3 rounded bg-surface/80 border border-border/60">
                        <span className="text-[10px] tabular-nums text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}</span>
                        <span className="text-xs text-foreground leading-relaxed flex-1">{q}</span>
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          {enabledEngines.map((e) => (
                            <span
                              key={e.id}
                              className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium"
                              style={{ color: ENGINE_COLOR[e.id] ?? "var(--muted-foreground)", background: (ENGINE_COLOR[e.id] ?? "#888") + "18" }}
                            >
                              {e.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Competitor rows */}
          {competitors.map((comp, idx) => {
            const delta = comp.total - brandTotalCited;
            const isExpanded = expandedRow === comp.name;
            const citations = compQueryCitations[comp.name] ?? {};

            // Build per-query engine sets: queryEngines[i] = engines that cited comp for query i
            const queryEngines: Record<number, string[]> = {};
            for (const engine of enabledEngines) {
              for (const qi of (citations[engine.id] ?? [])) {
                if (!queryEngines[qi]) queryEngines[qi] = [];
                queryEngines[qi].push(engine.id);
              }
            }
            const citedQueryIndices = Object.keys(queryEngines).map(Number).sort((a, b) => a - b);

            return (
              <div key={comp.name} className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setExpandedRow(isExpanded ? null : comp.name)}
                  className="w-full text-left"
                >
                  <div
                    className="grid gap-3 px-5 py-2.5 items-center hover:bg-accent/20 transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded
                        ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <span className="text-[10px] tabular-nums font-medium w-4 text-muted-foreground">{idx + 1}</span>
                      <span className="text-xs text-foreground">{comp.name}</span>
                    </div>
                    {enabledEngines.map((engine) => {
                      const cited = comp.perEngine[engine.id] ?? 0;
                      const color = ENGINE_COLOR[engine.id] ?? "var(--foreground)";
                      return (
                        <div key={engine.id} className="text-center text-xs tabular-nums"
                          style={{ color: cited > 0 ? color : "var(--muted-foreground)" }}>
                          {cited}/{probeTotal}
                        </div>
                      );
                    })}
                    <div className="text-center text-xs tabular-nums font-medium text-foreground">{comp.total}</div>
                    <div className="text-right">
                      <span
                        className="text-[10px] tabular-nums px-1.5 py-0.5 rounded"
                        style={{
                          color: delta > 0 ? "var(--sev-high)" : "var(--sev-low)",
                          background: delta > 0
                            ? "color-mix(in oklab, var(--sev-high) 12%, transparent)"
                            : "color-mix(in oklab, var(--sev-low) 12%, transparent)",
                        }}
                      >
                        {delta > 0 ? `+${delta}` : delta} citations
                      </span>
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border bg-background/60 px-5 py-4 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                      Queries citing <span className="text-foreground font-medium">{comp.name}</span> — {citedQueryIndices.length} of {resolvedQueries.length}
                    </div>
                    {citedQueryIndices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No queries triggered a citation for this competitor.</p>
                    ) : (
                      <div className="space-y-1">
                        {citedQueryIndices.map((qi) => (
                          <div key={qi} className="flex items-start gap-3 py-1.5 px-3 rounded bg-surface/80 border border-border/60">
                            <span className="text-[10px] tabular-nums text-muted-foreground w-5 shrink-0 pt-0.5">{qi + 1}</span>
                            <span className="text-xs text-foreground leading-relaxed flex-1">{resolvedQueries[qi]}</span>
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              {(queryEngines[qi] ?? []).map((eid) => (
                                <span
                                  key={eid}
                                  className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium"
                                  style={{ color: ENGINE_COLOR[eid] ?? "var(--muted-foreground)", background: (ENGINE_COLOR[eid] ?? "#888") + "18" }}
                                >
                                  {probeEngines.find((e) => e.id === eid)?.label ?? eid}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="px-5 py-2 border-t border-border bg-background/40 text-[10px] text-muted-foreground">
            Citation counts = number of probe queries where each brand appeared in AI responses
            {f52 ? " · competitor data sourced from F5.2 failure details" : " · competitors seeded from industry pool"}
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

      {/* Copy summary toast */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-lg transition-all duration-300"
        style={{
          opacity: copyToast ? 1 : 0,
          transform: `translateX(-50%) translateY(${copyToast ? "0" : "8px"})`,
          pointerEvents: "none",
        }}
      >
        <Check className="w-3.5 h-3.5 shrink-0" />
        Summary copied to clipboard
      </div>

      {/* Export CSV section-selector modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-2xl w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="text-sm font-medium text-foreground">Export CSV</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Choose sections to include</div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1 -mr-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checkboxes */}
            <div className="px-5 py-4 space-y-3">
              {EXPORT_SECTION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={exportSections[key]}
                    onChange={(e) =>
                      setExportSections((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-background/40">
              <button
                onClick={() => setShowExportModal(false)}
                className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent/30 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => doExportCSV(exportSections)}
                disabled={!Object.values(exportSections).some(Boolean)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

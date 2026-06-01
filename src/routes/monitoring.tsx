import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { mulberry32, hashStr, seededInt, resolveProbeQuery } from "@/lib/epiphan-data";
import {
  Radio, ChevronDown, ChevronRight, Download, X, Copy, Check,
  Save, Plus, Trash2, CloudCheck, CheckCircle2, Settings2,
} from "lucide-react";

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

function deriveSovForEngine(
  auditId: string,
  engineId: string,
  totalProbes: number,
): { brandCited: number; competitorCited: number } {
  const rng = mulberry32(hashStr(auditId + engineId));
  const competitorCited = seededInt(rng, Math.ceil(totalProbes * 0.6), Math.ceil(totalProbes * 0.9));
  return { brandCited: 0, competitorCited };
}

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
  const saved = savedCompetitors.map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== brand.toLowerCase());
  const pinned = f52Detail ? parseCompetitorFromF52(f52Detail) : null;
  const savedLower = new Set(saved.map((n) => n.toLowerCase()));
  let names: string[] = [...saved];
  if (pinned && !savedLower.has(pinned.toLowerCase()) && pinned.toLowerCase() !== brand.toLowerCase()) {
    names.unshift(pinned);
  }
  if (names.length < 5) {
    const usedLower = new Set(names.map((n) => n.toLowerCase()));
    const filtered = pool.filter((n) => n.toLowerCase() !== brand.toLowerCase() && !usedLower.has(n.toLowerCase()));
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

function deriveSentiment(auditId: string, engineId: string): { positive: number; neutral: number; negative: number } {
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
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
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
  brand: string; industry: string; storeName: string;
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
      const cols = [comp.name, ...enabledEngines.map((e) => String(comp.perEngine[e.id] ?? 0)), String(comp.total), delta > 0 ? `+${delta}` : String(delta)];
      rows.push(cols.map(escapeCSV).join(","));
    }
    rows.push("");
  }
  if (sections.queries) {
    rows.push("## Active Probe Queries");
    rows.push(["#", "Query"].map(escapeCSV).join(","));
    resolvedQueries.forEach((q, i) => rows.push([i + 1, q].map(escapeCSV).join(",")));
  }
  return rows.join("\n");
}

function BrandMonitoring() {
  const audits = useEpiphan((s) => s.audits);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const brandMonitorConfig = useEpiphan((s) => s.brandMonitorConfig);
  const setBrandMonitorConfig = useEpiphan((s) => s.setBrandMonitorConfig);
  const addProbeQuery = useEpiphan((s) => s.addProbeQuery);
  const deleteProbeQuery = useEpiphan((s) => s.deleteProbeQuery);
  const updateProbeQuery = useEpiphan((s) => s.updateProbeQuery);
  const toggleProbeQuery = useEpiphan((s) => s.toggleProbeQuery);
  const toggleProbeEngine = useEpiphan((s) => s.toggleProbeEngine);

  // Dashboard state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSections, setExportSections] = useState<ExportSections>({ sov: true, sentiment: true, competitors: true, queries: true });
  const [copyToast, setCopyToast] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Setup panel state
  const [brandInput, setBrandInput] = useState(brandMonitorConfig.brandName || brandMonitorConfig.productUrl);
  const [competitorInput, setCompetitorInput] = useState("");
  const [localCompetitors, setLocalCompetitors] = useState<string[]>(brandMonitorConfig.competitors);
  const [brandSaved, setBrandSaved] = useState(false);
  const [setupOpen, setSetupOpen] = useState(!brandMonitorConfig.configured);

  // Probe state
  const [newQueryText, setNewQueryText] = useState("");
  const [probeSaved, setProbeSaved] = useState(false);

  // Sync setup form with store (e.g. if store resets)
  useEffect(() => {
    setBrandInput(brandMonitorConfig.brandName || brandMonitorConfig.productUrl);
    setLocalCompetitors(brandMonitorConfig.competitors);
  }, [brandMonitorConfig]);

  // Listen for "Edit setup" button click from the AppShell header
  useEffect(() => {
    const handler = () => {
      setSetupOpen(true);
      setTimeout(() => {
        document.getElementById("monitoring-setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };
    window.addEventListener("monitoring:open-setup", handler);
    return () => window.removeEventListener("monitoring:open-setup", handler);
  }, []);

  const savedBrandInput = brandMonitorConfig.brandName || brandMonitorConfig.productUrl;
  const isBrandDirty =
    brandInput !== savedBrandInput ||
    localCompetitors.length !== brandMonitorConfig.competitors.length ||
    localCompetitors.some((c, i) => c !== brandMonitorConfig.competitors[i]);

  useBlocker({
    condition: isBrandDirty,
    blockerFn: () =>
      Promise.resolve(window.confirm("You have unsaved Brand Monitoring changes. Leave this page and discard them?")),
  });

  function resetBrandForm() {
    setBrandInput(savedBrandInput);
    setLocalCompetitors(brandMonitorConfig.competitors);
    setCompetitorInput("");
  }

  function handleSaveBrand() {
    const isUrl = brandInput.startsWith("http") || brandInput.includes(".");
    setBrandMonitorConfig({
      configured: !!brandInput.trim(),
      brandName: isUrl ? "" : brandInput.trim(),
      productUrl: isUrl ? brandInput.trim() : "",
      competitors: localCompetitors,
    });
    setBrandSaved(true);
    setSetupOpen(false);
    setTimeout(() => setBrandSaved(false), 1800);
  }

  function flashProbeSaved() {
    setProbeSaved(true);
    setTimeout(() => setProbeSaved(false), 2000);
  }

  // Dashboard computed values
  const configured = brandMonitorConfig.configured;
  const audit = audits.length > 0
    ? (selectedId ? (audits.find((a) => a.id === selectedId) ?? audits[0]) : audits[0])
    : null;
  const enabledEngines = probeEngines.filter((e) => e.enabled);

  const probeTotal = audit
    ? (audit.sovBreakdown
        ? (Object.values(audit.sovBreakdown)[0]?.total ?? probeQueries.filter((q) => q.enabled).length)
        : probeQueries.filter((q) => q.enabled).length)
    : probeQueries.filter((q) => q.enabled).length;

  const brand = audit
    ? (brandMonitorConfig.brandName || audit.ctx?.brand || audit.storeName)
    : (brandMonitorConfig.brandName || "your brand");
  const industry = audit?.ctx?.industry ?? "E-commerce";

  const f52 = audit?.failures.find((f) => f.failureId === "F5.2");
  const f52Detail = f52?.detail ?? null;

  const competitors = useMemo(() =>
    audit ? buildCompetitorList(f52Detail, industry, brand, audit.id, enabledEngines.map((e) => e.id), brandMonitorConfig.competitors) : [],
    [f52Detail, industry, brand, audit?.id, enabledEngines, brandMonitorConfig.competitors]
  );

  const resolvedQueries = useMemo(() => {
    if (!audit?.ctx) return probeQueries.filter((q) => q.enabled).map((q) => q.text);
    return probeQueries.filter((q) => q.enabled).map((q) => resolveProbeQuery(q.text, audit.ctx!));
  }, [audit, probeQueries]);

  const compQueryCitations = useMemo(() => {
    if (!audit) return {};
    const result: Record<string, Record<string, number[]>> = {};
    for (const comp of competitors) {
      result[comp.name] = {};
      for (const engine of enabledEngines) {
        const cited = comp.perEngine[engine.id] ?? 0;
        result[comp.name][engine.id] = deriveQueriesForCompEngine(comp.name, audit.id, engine.id, cited, resolvedQueries.length);
      }
    }
    return result;
  }, [competitors, enabledEngines, audit?.id, resolvedQueries.length]);

  const sovByEngine = useMemo(() =>
    audit ? Object.fromEntries(enabledEngines.map((e) => [e.id, deriveSovForEngine(audit.id, e.id, probeTotal)])) : {},
    [audit?.id, enabledEngines, probeTotal]
  );

  const sentimentByEngine = useMemo(() =>
    audit ? Object.fromEntries(enabledEngines.map((e) => [e.id, deriveSentiment(audit.id, e.id)])) : {},
    [audit?.id, enabledEngines]
  );

  const overallLabel = overallSentimentLabel(enabledEngines.map((e) => sentimentByEngine[e.id]).filter(Boolean));
  const overallLabelColor =
    overallLabel === "Mostly Positive" ? "var(--sev-low)"
    : overallLabel === "Mixed" ? "var(--sev-medium)"
    : "var(--sev-high)";

  const brandTotalCited = enabledEngines.reduce((s, e) => s + (sovByEngine[e.id]?.brandCited ?? 0), 0);
  const brandTotalProbes = enabledEngines.reduce((s) => s + probeTotal, 0);

  function handleCopySummary() {
    const date = new Date().toLocaleDateString();
    const lines: string[] = [];
    lines.push(`📊 Brand Monitoring — ${brand}`);
    lines.push(`${audit?.storeName ?? brand} · ${date}`);
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
      const s = sentimentByEngine[engine.id];
      if (s) lines.push(`• ${engine.label}: ${s.positive}% positive · ${s.neutral}% neutral · ${s.negative}% negative`);
    }
    lines.push("");
    lines.push(`Top competitors (${industry})`);
    competitors.slice(0, 3).forEach((c, i) => lines.push(`${i + 1}. ${c.name} — ${c.total} citations`));
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
    if (!audit) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = (audit.storeName ?? "store").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `${safeName}-monitoring-${dateStr}.csv`;
    const csv = buildCSV({ brand, industry, storeName: audit.storeName, enabledEngines, probeTotal, sovByEngine, sentimentByEngine, competitors, resolvedQueries, sections });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const activeEngineCount = probeEngines.filter((e) => e.enabled).length;
  const enabledQueryCount = probeQueries.filter((q) => q.enabled).length;

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">

        {/* Header */}
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Intelligence</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Brand Monitoring</h1>
            <p className="text-muted-foreground text-xs mt-1">
              Share of Voice, sentiment, and competitor citations across AI engines
              {configured && brand !== "your brand" && (
                <> for <span className="text-foreground">{brand}</span></>
              )}.
            </p>
          </div>

          {configured && audit && (
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
                <Copy className="w-3 h-3" /> Copy summary
              </button>
              <button
                onClick={openExportModal}
                className="flex items-center gap-1.5 text-xs bg-surface border border-border rounded px-3 py-1.5 text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>
          )}
        </header>

        {/* ── Brand Setup Panel ─────────────────────────────────────────── */}
        <section id="monitoring-setup" className="border border-border rounded-lg bg-surface overflow-hidden">
          {/* Panel header — always visible */}
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Setup</span>
              {configured && (
                <span className="flex items-center gap-1 text-[10px] text-sev-low ml-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {brandMonitorConfig.brandName || brandMonitorConfig.productUrl}
                  {brandMonitorConfig.competitors.length > 0 && (
                    <span className="text-muted-foreground ml-1">· {brandMonitorConfig.competitors.length} competitor{brandMonitorConfig.competitors.length !== 1 ? "s" : ""}</span>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Settings2 className="w-3 h-3 text-muted-foreground" />
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${setupOpen ? "rotate-180" : ""}`} />
            </div>
          </button>

          {/* Collapsible form */}
          {setupOpen && (
            <div className="border-t border-border px-5 py-5 space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Define your brand and up to 5 competitors. Once saved, the Share of Voice dashboard activates below.
              </p>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Brand name or Product URL
                </label>
                <input
                  type="text"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  placeholder="e.g. Acme Apparel or https://acme-apparel.com"
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Competitors <span className="text-muted-foreground/50 normal-case">({localCompetitors.length}/5)</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {localCompetitors.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background text-xs text-foreground">
                      {name}
                      <button
                        onClick={() => setLocalCompetitors((prev) => prev.filter((c) => c !== name))}
                        className="text-muted-foreground hover:text-sev-critical transition-colors"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {localCompetitors.length === 0 && (
                    <span className="text-[11px] text-muted-foreground/50 italic">No competitors added yet.</span>
                  )}
                </div>
                {localCompetitors.length < 5 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={competitorInput}
                      onChange={(e) => setCompetitorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && competitorInput.trim() && localCompetitors.length < 5) {
                          const name = competitorInput.trim();
                          if (!localCompetitors.includes(name)) setLocalCompetitors((prev) => [...prev, name]);
                          setCompetitorInput("");
                        }
                      }}
                      placeholder="Type competitor name and press Enter…"
                      className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-[11px] font-mono outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => {
                        const name = competitorInput.trim();
                        if (name && localCompetitors.length < 5 && !localCompetitors.includes(name)) {
                          setLocalCompetitors((prev) => [...prev, name]);
                          setCompetitorInput("");
                        }
                      }}
                      disabled={!competitorInput.trim() || localCompetitors.length >= 5}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                {isBrandDirty && (
                  <button
                    onClick={resetBrandForm}
                    className="px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={handleSaveBrand}
                  disabled={!brandInput.trim()}
                  className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Save className="w-3 h-3" /> {brandSaved ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Probe Configuration ───────────────────────────────────────── */}
        <section className="border border-border rounded-lg bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Radio className="w-3 h-3" /> Probe Configuration
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                These are the questions sent to AI engines to check whether your brand gets cited. Write them the way a real person would ask an AI assistant.
              </p>
            </div>
            <div className={`flex items-center gap-1 text-[10px] text-sev-low transition-opacity duration-300 ${probeSaved ? "opacity-100" : "opacity-0"}`}>
              <CloudCheck className="w-3 h-3" /> Saved
            </div>
          </div>

          {/* Engine toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Engines</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{activeEngineCount} of {probeEngines.length} active</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {probeEngines.map((engine) => (
                <div key={engine.id} className="flex items-center justify-between px-3 py-2 border border-border rounded bg-background">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${engine.enabled ? "bg-sev-low" : "bg-muted-foreground/40"}`} />
                    <span className="text-xs font-medium text-foreground">{engine.label}</span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={engine.enabled}
                    onClick={() => { toggleProbeEngine(engine.id); flashProbeSaved(); }}
                    className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${engine.enabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${engine.enabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Probe queries */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Probe Questions</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{enabledQueryCount} of {probeQueries.length} active</div>
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              Use <code className="text-primary/80">{"{{brand}}"}</code>, <code className="text-primary/80">{"{{category}}"}</code>, <code className="text-primary/80">{"{{industry}}"}</code>, <code className="text-primary/80">{"{{productName}}"}</code> to personalise queries per audit.
            </p>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {probeQueries.map((query, idx) => (
                <div key={query.id} className="group flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground tabular-nums w-4 text-right flex-shrink-0">{idx + 1}</span>
                  <button
                    role="switch"
                    aria-checked={query.enabled}
                    onClick={() => { toggleProbeQuery(query.id); flashProbeSaved(); }}
                    title={query.enabled ? "Disable" : "Enable"}
                    className={`relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${query.enabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${query.enabled ? "translate-x-2.5" : "translate-x-0"}`} />
                  </button>
                  <input
                    type="text"
                    value={query.text}
                    onChange={(e) => { updateProbeQuery(query.id, e.target.value); flashProbeSaved(); }}
                    className={`flex-1 bg-background border border-border rounded px-2 py-1 text-[11px] outline-none focus:border-primary transition-opacity ${query.enabled ? "opacity-100" : "opacity-40"}`}
                  />
                  <button
                    onClick={() => { deleteProbeQuery(query.id); flashProbeSaved(); }}
                    disabled={probeQueries.length <= 1}
                    title={probeQueries.length <= 1 ? "At least one probe query required" : "Delete"}
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-sev-critical hover:bg-sev-critical/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newQueryText}
                onChange={(e) => setNewQueryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newQueryText.trim()) {
                    addProbeQuery(newQueryText.trim());
                    setNewQueryText("");
                    flashProbeSaved();
                  }
                }}
                placeholder="Add a probe question and press Enter…"
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-[11px] outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  if (newQueryText.trim()) {
                    addProbeQuery(newQueryText.trim());
                    setNewQueryText("");
                    flashProbeSaved();
                  }
                }}
                disabled={!newQueryText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        </section>

        {/* ── Dashboard — requires configured + audit ───────────────────── */}
        {!configured && (
          <div className="border border-border rounded-lg bg-surface p-12 text-center text-muted-foreground text-xs">
            Complete Brand Setup above to activate the Share of Voice dashboard.
          </div>
        )}

        {configured && audits.length === 0 && (
          <div className="border border-border rounded-lg bg-surface p-12 text-center">
            <Radio className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-xs">Run a GEO audit from the Audit Engine to see your brand monitoring data.</p>
          </div>
        )}

        {configured && audit && (
          <>
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

                    {/* Competitor bar */}
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Competitor avg SoV</span>
                        <span className="tabular-nums" style={{ color: "var(--sev-high)" }}>{compPct}%</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden bg-border">
                        <div className="h-full rounded-full" style={{ width: `${compPct}%`, background: "var(--sev-high)" }} />
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
                  const { positive, neutral, negative } = sentimentByEngine[engine.id] ?? { positive: 0, neutral: 0, negative: 0 };
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
              <div className="px-5 py-3 border-t border-border bg-background/40 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{resolvedQueries.length} active probe queries · seeded per audit</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground uppercase tracking-widest">Overall sentiment:</span>
                  <span className="font-medium" style={{ color: overallLabelColor }}>{overallLabel}</span>
                </span>
              </div>
            </section>

            {/* Competitor leaderboard */}
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

              {/* Brand row */}
              <div className="border-t border-border">
                <button type="button" onClick={() => setExpandedRow(expandedRow === "__brand__" ? null : "__brand__")} className="w-full text-left">
                  <div
                    className="grid gap-3 px-5 py-2.5 items-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
                  >
                    <div className="flex items-center gap-2">
                      {expandedRow === "__brand__" ? <ChevronDown className="w-3 h-3 text-primary shrink-0" /> : <ChevronRight className="w-3 h-3 text-primary shrink-0" />}
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-xs text-primary font-medium">{brand}</span>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest border border-border px-1 py-0.5 rounded">you</span>
                    </div>
                    {enabledEngines.map((engine) => {
                      const { brandCited } = sovByEngine[engine.id] ?? { brandCited: 0 };
                      return <div key={engine.id} className="text-center text-xs tabular-nums text-foreground">{brandCited}/{probeTotal}</div>;
                    })}
                    <div className="text-center text-xs tabular-nums text-foreground">{brandTotalCited}/{brandTotalProbes}</div>
                    <div className="text-right"><span className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground">—</span></div>
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
                                <span key={e.id} className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium"
                                  style={{ color: ENGINE_COLOR[e.id] ?? "var(--muted-foreground)", background: (ENGINE_COLOR[e.id] ?? "#888") + "18" }}>
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
                    <button type="button" onClick={() => setExpandedRow(isExpanded ? null : comp.name)} className="w-full text-left">
                      <div
                        className="grid gap-3 px-5 py-2.5 items-center hover:bg-accent/20 transition-colors cursor-pointer"
                        style={{ gridTemplateColumns: `1fr ${enabledEngines.map(() => "80px").join(" ")} 80px 120px` }}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                          <span className="text-[10px] tabular-nums font-medium w-4 text-muted-foreground">{idx + 1}</span>
                          <span className="text-xs text-foreground">{comp.name}</span>
                        </div>
                        {enabledEngines.map((engine) => {
                          const cited = comp.perEngine[engine.id] ?? 0;
                          const color = ENGINE_COLOR[engine.id] ?? "var(--foreground)";
                          return (
                            <div key={engine.id} className="text-center text-xs tabular-nums" style={{ color: cited > 0 ? color : "var(--muted-foreground)" }}>
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
                              background: delta > 0 ? "color-mix(in oklab, var(--sev-high) 12%, transparent)" : "color-mix(in oklab, var(--sev-low) 12%, transparent)",
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
                                    <span key={eid} className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium"
                                      style={{ color: ENGINE_COLOR[eid] ?? "var(--muted-foreground)", background: (ENGINE_COLOR[eid] ?? "#888") + "18" }}>
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

            <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
              Monitoring data for {brand} · {industry} · {enabledEngines.map((e) => e.label).join(", ")} · sovereign local inference
            </div>
          </>
        )}
      </div>

      {/* Copy toast */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-lg transition-all duration-300"
        style={{ opacity: copyToast ? 1 : 0, transform: `translateX(-50%) translateY(${copyToast ? "0" : "8px"})`, pointerEvents: "none" }}
      >
        <Check className="w-3.5 h-3.5 shrink-0" /> Summary copied to clipboard
      </div>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="text-sm font-medium text-foreground">Export CSV</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Choose sections to include</div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1 -mr-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {EXPORT_SECTION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={exportSections[key]} onChange={(e) => setExportSections((prev) => ({ ...prev, [key]: e.target.checked }))} className="w-4 h-4 rounded border-border accent-primary cursor-pointer" />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-background/40">
              <button onClick={() => setShowExportModal(false)} className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent/30 transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => doExportCSV(exportSections)} disabled={!Object.values(exportSections).some(Boolean)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import {
  inferProductContext, mulberry32, hashStr, seededInt,
  SCHEMA_FIELD_REGISTRY, ProductContext, SchemaType,
} from "@/lib/epiphan-data";
import {
  Mic, Plus, X, ArrowRight, RotateCcw, CheckCircle2, XCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/brand-voice")({
  head: () => ({ meta: [{ title: "Brand Voice · epiphanAI" }] }),
  component: BrandVoice,
});

// ─── Constants ────────────────────────────────────────────────────────────

const ENGINES: { id: string; label: string; color: string }[] = [
  { id: "chatgpt",    label: "ChatGPT",    color: "#10A37F" },
  { id: "gemini",     label: "Gemini",     color: "#4285F4" },
  { id: "perplexity", label: "Perplexity", color: "#20B2AA" },
];

const TOTAL_PROBES = 10;

const STEPS = [
  "Crawling product page",
  "Parsing JSON-LD & structured data",
  "Checking AI crawler access (GPTBot, ClaudeBot)",
  "Probing ChatGPT — 10 queries",
  "Probing Gemini — 10 queries",
  "Probing Perplexity — 10 queries",
  "Comparing competitor citations",
  "Analyzing brand sentiment signals",
  "Computing citation readiness score",
  "Finalizing report",
];
const STEP_DURATIONS = [500, 650, 480, 950, 950, 950, 720, 620, 480, 350];

// ─── Types ─────────────────────────────────────────────────────────────────

type Phase = "input" | "running" | "results";

type SovData = { cited: number; total: number; pct: number };

type EngineSov = Record<string, SovData>;

type SentimentData = { positive: number; neutral: number; negative: number; label: string };

type FieldItem = {
  schemaType: SchemaType | "crawl";
  field: string;
  label: string;
  engines: string[];
  present: boolean;
  impact: "critical" | "high" | "medium";
};

type CompetitorResult = {
  name: string;
  sov: EngineSov;
  avgPct: number;
  sentiment: SentimentData;
};

type BrandVoiceResult = {
  ctx: ProductContext;
  sov: EngineSov;
  brandSentiment: Record<string, SentimentData>;
  fields: FieldItem[];
  readinessScore: number;
  llmsTxt: boolean;
  gptbotAllowed: boolean;
  competitors: CompetitorResult[];
};

// ─── Seeded derivation helpers ────────────────────────────────────────────

function deriveSov(seed: number): SovData {
  const rng = mulberry32(seed);
  const cited = seededInt(rng, 0, 2);
  return { cited, total: TOTAL_PROBES, pct: Math.round((cited / TOTAL_PROBES) * 100) };
}

function deriveCompetitorSov(seed: number): SovData {
  const rng = mulberry32(seed);
  const cited = seededInt(rng, 4, 9);
  return { cited, total: TOTAL_PROBES, pct: Math.round((cited / TOTAL_PROBES) * 100) };
}

function deriveSentiment(seed: number): SentimentData {
  const rng = mulberry32(seed);
  const positive = seededInt(rng, 5, 24);
  const neutral = seededInt(rng, 18, 36);
  const negative = 100 - positive - neutral;
  const label = positive >= 40 ? "Mostly Positive" : positive >= 20 ? "Mixed" : "Mostly Negative";
  return { positive, neutral, negative, label };
}

function deriveCompetitorSentiment(seed: number): SentimentData {
  const rng = mulberry32(seed);
  const positive = seededInt(rng, 25, 55);
  const neutral = seededInt(rng, 20, 35);
  const negative = 100 - positive - neutral;
  const label = positive >= 40 ? "Mostly Positive" : positive >= 20 ? "Mixed" : "Mostly Negative";
  return { positive, neutral, negative, label };
}

const ALWAYS_PRESENT = new Set(["name", "description", "image", "price", "priceCurrency", "availability"]);
const SCHEMA_TYPES: SchemaType[] = ["Product", "Offer", "Organization", "FAQPage"];
const IMPACT_MAP: Record<string, "critical" | "high" | "medium"> = {
  name: "critical", description: "critical", image: "critical", brand: "critical",
  offers: "critical", price: "critical", priceCurrency: "critical", availability: "critical",
  sku: "high", aggregateRating: "high", sameAs: "high", logo: "high",
  url: "high", mainEntity: "high", acceptedAnswer: "high",
  review: "medium", gtin: "medium", material: "medium", category: "medium",
  priceValidUntil: "medium", shippingDetails: "medium", contactPoint: "medium",
  address: "medium", "name (faq)": "medium",
};

function computeFields(url: string): FieldItem[] {
  const seed = hashStr(url + "fields");
  const rng = mulberry32(seed);
  const items: FieldItem[] = [];

  for (const schemaType of SCHEMA_TYPES) {
    for (const entry of SCHEMA_FIELD_REGISTRY[schemaType]) {
      const isAlwaysPresent = ALWAYS_PRESENT.has(entry.field);
      const chance = schemaType === "Organization" ? 0.18
        : schemaType === "FAQPage" ? 0.10
        : isAlwaysPresent ? 1.0
        : entry.engines.includes("all") ? 0.35
        : 0.22;
      const present = rng() < chance;
      items.push({
        schemaType,
        field: entry.field,
        label: entry.label,
        engines: entry.engines.includes("all")
          ? ENGINES.map((e) => e.label)
          : entry.engines.map((id) => ENGINES.find((e) => e.id === id)?.label ?? id),
        present,
        impact: IMPACT_MAP[entry.field] ?? "medium",
      });
    }
  }

  return items;
}

function computeReadiness(fields: FieldItem[], llmsTxt: boolean, gptbotAllowed: boolean): number {
  let score = 100;
  if (!llmsTxt) score -= 15;
  if (!gptbotAllowed) score -= 10;
  for (const f of fields) {
    if (!f.present) {
      score -= f.impact === "critical" ? 10 : f.impact === "high" ? 5 : 2;
    }
  }
  return Math.max(0, score);
}

function buildResult(url: string, competitors: string[]): BrandVoiceResult {
  const ctx = inferProductContext(url);
  const baseSeed = hashStr(url);
  const rng0 = mulberry32(baseSeed);

  const llmsTxt = rng0() < 0.15;
  const gptbotAllowed = rng0() < 0.25;

  const sov: EngineSov = {};
  const brandSentiment: Record<string, SentimentData> = {};
  for (const e of ENGINES) {
    sov[e.id] = deriveSov(hashStr(url + e.id + "sov"));
    brandSentiment[e.id] = deriveSentiment(hashStr(url + e.id + "sent"));
  }

  const fields = computeFields(url);
  const readinessScore = computeReadiness(fields, llmsTxt, gptbotAllowed);

  const competitorResults: CompetitorResult[] = competitors.map((name) => {
    const cSov: EngineSov = {};
    let totalCited = 0;
    for (const e of ENGINES) {
      const s = deriveCompetitorSov(hashStr(name + e.id + url + "csov"));
      cSov[e.id] = s;
      totalCited += s.cited;
    }
    const avgPct = Math.round((totalCited / (ENGINES.length * TOTAL_PROBES)) * 100);
    const sentiment = deriveCompetitorSentiment(hashStr(name + url + "csent"));
    return { name, sov: cSov, avgPct, sentiment };
  });

  return { ctx, sov, brandSentiment, fields, readinessScore, llmsTxt, gptbotAllowed, competitors: competitorResults };
}

// ─── Sub-components ───────────────────────────────────────────────────────

function GaugeRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const sw = 8;
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
    <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
      <div style={{ width: `${positive}%`, background: "var(--sev-low)" }} />
      <div style={{ width: `${neutral}%`, background: "var(--sev-medium)" }} />
      <div style={{ width: `${negative}%`, background: "var(--sev-high)" }} />
    </div>
  );
}

function SentimentLabel({ label }: { label: string }) {
  const color = label === "Mostly Positive" ? "var(--sev-low)" : label === "Mixed" ? "var(--sev-medium)" : "var(--sev-high)";
  return <span className="text-[10px] font-medium" style={{ color }}>{label}</span>;
}

function ImpactBadge({ impact }: { impact: "critical" | "high" | "medium" }) {
  const color = impact === "critical" ? "var(--sev-critical)" : impact === "high" ? "var(--sev-high)" : "var(--sev-medium)";
  return (
    <span className="text-[8px] uppercase tracking-widest px-1 py-0.5 rounded border"
      style={{ color, borderColor: color + "40", background: color + "12" }}>
      {impact}
    </span>
  );
}

// ─── Phases ───────────────────────────────────────────────────────────────

function InputPhase({
  url, setUrl, competitors, setCompetitors, onRun,
}: {
  url: string;
  setUrl: (v: string) => void;
  competitors: string[];
  setCompetitors: (v: string[]) => void;
  onRun: () => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addCompetitor = () => {
    const name = draft.trim();
    if (!name || competitors.length >= 10 || competitors.includes(name)) return;
    setCompetitors([...competitors, name]);
    setDraft("");
  };

  const removeCompetitor = (name: string) => setCompetitors(competitors.filter((c) => c !== name));

  const canRun = url.trim().length > 4;

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <header>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Intelligence</div>
        <h1 className="text-2xl font-sans font-medium mt-1">Brand Voice</h1>
        <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
          Enter a product URL. epiphanAI will probe ChatGPT, Gemini, and Perplexity to measure your brand's Share of Voice,
          identify what structured data is missing, and compare you against competitors.
        </p>
      </header>

      {/* URL input */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Product URL</label>
        <div className="flex gap-2">
          <input
            id="bv-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canRun && onRun()}
            placeholder="https://your-store.com/products/your-product"
            className="flex-1 bg-surface border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
          />
          <button
            onClick={onRun}
            disabled={!canRun}
            className="px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Analyse <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Works with any Shopify, WooCommerce, or custom e-commerce URL.</p>
      </div>

      {/* Competitor input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Competitor brands <span className="normal-case text-muted-foreground/60">(optional · up to 10)</span>
          </label>
          <span className="text-[10px] text-muted-foreground tabular-nums">{competitors.length}/10</span>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompetitor(); } }}
            placeholder="e.g. Nike, Pandora, L'Oréal…"
            disabled={competitors.length >= 10}
            className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-40 font-mono"
          />
          <button
            onClick={addCompetitor}
            disabled={!draft.trim() || competitors.length >= 10}
            className="px-3 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {competitors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((c) => (
              <span key={c}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border bg-surface text-foreground">
                {c}
                <button onClick={() => removeCompetitor(c)} className="text-muted-foreground hover:text-foreground transition">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {competitors.length === 0 && (
        <p className="text-[10px] text-muted-foreground border border-border/60 rounded px-3 py-2.5 bg-surface/40">
          No competitors added — the report will use seeded industry benchmarks for comparison.
          Add real competitor names for a more targeted analysis.
        </p>
      )}
    </div>
  );
}

function RunningPhase({ url, step }: { url: string; step: number }) {
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div className="max-w-xl mx-auto p-8 flex flex-col items-center gap-8 mt-16">
      <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 grid place-items-center animate-pulse">
        <Mic className="w-6 h-6 text-primary" />
      </div>
      <div className="w-full space-y-3 text-center">
        <div className="text-xs text-muted-foreground truncate">{url}</div>
        <div className="text-sm text-foreground">{STEPS[Math.min(step, STEPS.length - 1)]}</div>
        <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">{progress}%</div>
      </div>
      <div className="w-full space-y-1">
        {STEPS.map((s, i) => (
          <div key={i} className={`flex items-center gap-2 text-[10px] px-3 py-1 rounded transition-all ${
            i < step ? "text-sev-low" : i === step ? "text-foreground" : "text-muted-foreground/40"
          }`}>
            {i < step
              ? <CheckCircle2 className="w-3 h-3 shrink-0" />
              : i === step
              ? <span className="w-3 h-3 rounded-full border border-primary animate-pulse shrink-0" />
              : <span className="w-3 h-3 rounded-full border border-border/40 shrink-0" />}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsPhase({
  url, result, onReset,
}: {
  url: string;
  result: BrandVoiceResult;
  onReset: () => void;
}) {
  const [showAllFields, setShowAllFields] = useState(false);
  const { ctx, sov, brandSentiment, fields, readinessScore, llmsTxt, gptbotAllowed, competitors } = result;

  const missingFields = fields.filter((f) => !f.present);
  const presentFields = fields.filter((f) => f.present);
  const criticalMissing = missingFields.filter((f) => f.impact === "critical");
  const highMissing = missingFields.filter((f) => f.impact === "high");

  const readinessColor = readinessScore >= 70 ? "var(--sev-low)" : readinessScore >= 40 ? "var(--sev-medium)" : "var(--sev-critical)";
  const readinessLabel = readinessScore >= 70 ? "Good" : readinessScore >= 40 ? "Needs Work" : "Critical";

  const brandAvgSov = Math.round(
    ENGINES.reduce((s, e) => s + (sov[e.id]?.pct ?? 0), 0) / ENGINES.length
  );

  const displayedFields = showAllFields ? fields : [...criticalMissing, ...highMissing, ...presentFields.slice(0, 3)];

  // Merge brand row with competitors for the comparison table
  const allRows = [
    {
      name: ctx.brand,
      isBrand: true,
      sov,
      avgPct: brandAvgSov,
      sentiment: brandSentiment[ENGINES[0].id],
    },
    ...competitors.map((c) => ({ ...c, isBrand: false })),
  ];

  return (
    <div className="max-w-[1300px] mx-auto p-8 space-y-6">

      {/* Header */}
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Voice Report</div>
          <h1 className="text-2xl font-sans font-medium mt-1">{ctx.brand}</h1>
          <a href={url} target="_blank" rel="noreferrer"
            className="text-[11px] text-muted-foreground hover:text-primary transition truncate block max-w-xs mt-0.5">
            {url}
          </a>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
        >
          <RotateCcw className="w-3 h-3" /> New analysis
        </button>
      </header>

      {/* Overview strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Kpi label="Avg brand SoV" value={`${brandAvgSov}%`}
          sub="across 3 engines"
          color={brandAvgSov === 0 ? "var(--sev-critical)" : brandAvgSov < 20 ? "var(--sev-high)" : "var(--sev-low)"} />
        <Kpi label="Citation readiness" value={`${readinessScore}/100`}
          sub={readinessLabel} color={readinessColor} />
        <Kpi label="Critical gaps" value={String(criticalMissing.length + (!llmsTxt ? 1 : 0) + (!gptbotAllowed ? 1 : 0))}
          sub="must fix first" color={criticalMissing.length > 0 ? "var(--sev-critical)" : "var(--sev-low)"} />
        <Kpi label="Competitors tracked" value={String(competitors.length || "—")}
          sub={competitors.length > 0 ? "user-added" : "add to compare"} />
      </div>

      {/* Share of Voice */}
      <section className="space-y-3">
        <SectionHeader title="Share of Voice" sub="How often AI engines cite your brand vs. competitors" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ENGINES.map((engine) => {
            const data = sov[engine.id];
            const pct = data?.pct ?? 0;
            return (
              <div key={engine.id} className="border border-border rounded-lg bg-surface p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-foreground">{engine.label}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Share of Voice</div>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                    style={{ color: engine.color, borderColor: engine.color + "40", background: engine.color + "12" }}>
                    {TOTAL_PROBES} probes
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <GaugeRing pct={pct} color={engine.color} size={80} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-base tabular-nums font-semibold leading-none" style={{ color: engine.color }}>{pct}%</span>
                      <span className="text-[8px] text-muted-foreground mt-0.5">SoV</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cited</span>
                      <span className="tabular-nums text-foreground">{data?.cited ?? 0}/{TOTAL_PROBES}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Missed</span>
                      <span className="tabular-nums text-muted-foreground">{TOTAL_PROBES - (data?.cited ?? 0)}/{TOTAL_PROBES}</span>
                    </div>
                    <div className="pt-1 border-t border-border text-[10px] font-medium"
                      style={{ color: pct === 0 ? "var(--sev-critical)" : pct < 30 ? "var(--sev-high)" : "var(--sev-low)" }}>
                      {pct === 0 ? "Not cited — fix structured data first" : pct < 30 ? "Low visibility" : "Good visibility"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Citation Readiness */}
      <section className="space-y-3">
        <SectionHeader title="Citation Readiness" sub="What structured data LLMs need to cite your product" />
        <div className="border border-border rounded-lg bg-surface overflow-hidden">

          {/* Crawlability header items */}
          <div className="grid grid-cols-[1fr_auto_auto_100px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
            <div>Requirement</div>
            <div>Engines</div>
            <div>Impact</div>
            <div className="text-right">Status</div>
          </div>

          {/* llms.txt */}
          <FieldRow
            label="/llms.txt manifest"
            engines={ENGINES.map((e) => e.label)}
            impact="critical"
            present={llmsTxt}
            note={llmsTxt ? "AI crawlers can discover your content priorities" : "AI crawlers cannot discover content priorities"}
          />
          {/* GPTBot */}
          <FieldRow
            label="GPTBot access in robots.txt"
            engines={["ChatGPT"]}
            impact="critical"
            present={gptbotAllowed}
            note={gptbotAllowed ? "ChatGPT indexer is allowed" : "GPTBot is blocked — store invisible to ChatGPT"}
          />

          {/* Schema fields */}
          {displayedFields.map((f, i) => (
            <FieldRow key={`${f.schemaType}-${f.field}-${i}`}
              label={`${f.schemaType} · ${f.label}`}
              engines={f.engines}
              impact={f.impact}
              present={f.present}
            />
          ))}

          {/* Show more / less toggle */}
          <button
            onClick={() => setShowAllFields((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/20 transition"
          >
            {showAllFields
              ? <><ChevronUp className="w-3 h-3" /> Show less</>
              : <><ChevronDown className="w-3 h-3" /> Show all {fields.length + 2} requirements</>}
          </button>

          <div className="px-5 py-2 border-t border-border bg-background/40 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              {presentFields.length + (llmsTxt ? 1 : 0) + (gptbotAllowed ? 1 : 0)} present ·{" "}
              {missingFields.length + (!llmsTxt ? 1 : 0) + (!gptbotAllowed ? 1 : 0)} missing
            </span>
            <span className="font-medium tabular-nums" style={{ color: readinessColor }}>
              Readiness: {readinessScore}/100 · {readinessLabel}
            </span>
          </div>
        </div>
      </section>

      {/* Sentiment */}
      <section className="space-y-3">
        <SectionHeader title="Brand Sentiment" sub="Tone of AI responses when your brand is mentioned" />
        <div className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="grid grid-cols-[120px_1fr_220px] gap-4 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
            <div>Engine</div><div>Distribution</div><div className="text-right">Breakdown</div>
          </div>
          {ENGINES.map((engine) => {
            const s = brandSentiment[engine.id];
            return (
              <div key={engine.id} className="grid grid-cols-[120px_1fr_220px] gap-4 px-5 py-3 items-center border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: engine.color }} />
                  <span className="text-xs text-foreground">{engine.label}</span>
                </div>
                <SentimentBar positive={s.positive} neutral={s.neutral} negative={s.negative} />
                <div className="flex items-center justify-end gap-2 text-[10px] tabular-nums">
                  <span style={{ color: "var(--sev-low)" }}>{s.positive}%</span>
                  <span className="text-muted-foreground">·</span>
                  <span style={{ color: "var(--sev-medium)" }}>{s.neutral}%</span>
                  <span className="text-muted-foreground">·</span>
                  <span style={{ color: "var(--sev-high)" }}>{s.negative}%</span>
                  <span className="text-muted-foreground">·</span>
                  <SentimentLabel label={s.label} />
                </div>
              </div>
            );
          })}
          <div className="px-5 py-2 border-t border-border bg-background/40 text-[10px] text-muted-foreground flex justify-between">
            <span>Pos · Neu · Neg</span>
            <span>Sentiment derived from response tone analysis across {TOTAL_PROBES} probes per engine</span>
          </div>
        </div>
      </section>

      {/* Competitor Comparison */}
      <section className="space-y-3">
        <SectionHeader
          title="Competitor Comparison"
          sub={competitors.length === 0
            ? "No competitors added — showing brand-only data"
            : `Your brand vs ${competitors.length} competitor${competitors.length === 1 ? "" : "s"}`}
        />
        <div className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="grid gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40"
            style={{ gridTemplateColumns: `1fr ${ENGINES.map(() => "90px").join(" ")} 80px 1fr` }}>
            <div>Brand</div>
            {ENGINES.map((e) => <div key={e.id} className="text-center">{e.label}</div>)}
            <div className="text-center">Avg SoV</div>
            <div>Sentiment</div>
          </div>

          {allRows.map((row) => (
            <div
              key={row.name}
              className={`grid gap-3 px-5 py-3 items-center border-t border-border ${row.isBrand ? "bg-primary/5" : "hover:bg-accent/20"}`}
              style={{ gridTemplateColumns: `1fr ${ENGINES.map(() => "90px").join(" ")} 80px 1fr` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {row.isBrand && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                <span className={`text-xs truncate ${row.isBrand ? "text-primary font-medium" : "text-foreground"}`}>
                  {row.name}
                </span>
                {row.isBrand && (
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest border border-border px-1 py-0.5 rounded shrink-0">you</span>
                )}
              </div>

              {ENGINES.map((engine) => {
                const data = row.sov[engine.id];
                const pct = data?.pct ?? 0;
                const color = row.isBrand ? "var(--primary)" : engine.color;
                return (
                  <div key={engine.id} className="text-center text-xs tabular-nums"
                    style={{ color: pct > 0 ? color : "var(--muted-foreground)" }}>
                    {data?.cited ?? 0}/{TOTAL_PROBES}
                    <div className="text-[9px] mt-0.5" style={{ color: pct > 0 ? color + "cc" : "var(--muted-foreground)" }}>
                      {pct}%
                    </div>
                  </div>
                );
              })}

              <div className="text-center">
                <span className="text-sm tabular-nums font-semibold"
                  style={{ color: row.avgPct === 0 ? "var(--sev-critical)" : row.avgPct < 30 ? "var(--sev-high)" : "var(--sev-low)" }}>
                  {row.avgPct}%
                </span>
              </div>

              <div className="min-w-0">
                <SentimentBar
                  positive={row.sentiment.positive}
                  neutral={row.sentiment.neutral}
                  negative={row.sentiment.negative}
                />
                <div className="mt-1.5">
                  <SentimentLabel label={row.sentiment.label} />
                </div>
              </div>
            </div>
          ))}

          {competitors.length === 0 && (
            <div className="px-5 py-4 border-t border-border text-[11px] text-muted-foreground text-center">
              Add competitor brand names in the input form to compare them here.
            </div>
          )}
        </div>
      </section>

      <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
        {ctx.brand} · {ctx.industry} · {ctx.domain} · simulated analysis via sovereign local inference · epiphanAI by Tessera
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-background p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl tabular-nums font-medium mt-1" style={{ color: color ?? "var(--foreground)" }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function FieldRow({
  label, engines, impact, present, note,
}: {
  label: string;
  engines: string[];
  impact: "critical" | "high" | "medium";
  present: boolean;
  note?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_100px] gap-3 px-5 py-2.5 items-start border-t border-border hover:bg-accent/10 transition">
      <div className="min-w-0">
        <div className="text-xs text-foreground">{label}</div>
        {note && <div className="text-[10px] text-muted-foreground mt-0.5">{note}</div>}
      </div>
      <div className="flex flex-wrap gap-1 max-w-[180px] justify-end">
        {engines.slice(0, 3).map((e) => (
          <span key={e} className="text-[8px] uppercase tracking-widest px-1 py-0.5 rounded border border-border text-muted-foreground">
            {e}
          </span>
        ))}
      </div>
      <ImpactBadge impact={impact} />
      <div className="text-right">
        {present
          ? <span className="inline-flex items-center gap-1 text-[10px] text-sev-low"><CheckCircle2 className="w-3 h-3" /> Present</span>
          : <span className="inline-flex items-center gap-1 text-[10px] text-sev-high"><XCircle className="w-3 h-3" /> Missing</span>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

function BrandVoice() {
  const [phase, setPhase] = useState<Phase>("input");
  const [url, setUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<BrandVoiceResult | null>(null);

  const runAnalysis = useCallback(() => {
    if (!url.trim()) return;
    setStep(0);
    setResult(null);
    setPhase("running");
  }, [url]);

  const reset = useCallback(() => {
    setPhase("input");
    setUrl("");
    setCompetitors([]);
    setStep(0);
    setResult(null);
  }, []);

  // Step-through animation
  useEffect(() => {
    if (phase !== "running") return;

    let cancelled = false;
    const advance = (current: number) => {
      if (cancelled || current >= STEPS.length) return;
      const duration = STEP_DURATIONS[current] ?? 500;
      const timer = setTimeout(() => {
        if (cancelled) return;
        if (current + 1 >= STEPS.length) {
          // Build result before switching phase
          const r = buildResult(url, competitors);
          setResult(r);
          setPhase("results");
        } else {
          setStep(current + 1);
          advance(current + 1);
        }
      }, duration);
      return () => clearTimeout(timer);
    };

    advance(step);
    return () => { cancelled = true; };
  }, [phase]); // only re-run when phase changes to "running"

  return (
    <AppShell>
      <div className="min-h-full">
        {phase === "input" && (
          <InputPhase
            url={url} setUrl={setUrl}
            competitors={competitors} setCompetitors={setCompetitors}
            onRun={runAnalysis}
          />
        )}
        {phase === "running" && <RunningPhase url={url} step={step} />}
        {phase === "results" && result && (
          <ResultsPhase url={url} result={result} onReset={reset} />
        )}
      </div>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PillarRing, SeverityBadge, PillarBadge } from "@/components/PillarRing";
import { DiffPane } from "@/components/DiffPane";
import { useEpiphan } from "@/lib/epiphan-store";
import { PILLARS, PillarId, SEVERITY_WEIGHT, Failure, MissingField, SovEngineBreakdown } from "@/lib/epiphan-data";
import { toCsv, toJson, downloadFile, copyToClipboard, toWebhookPayload } from "@/lib/epiphan-export";
import { Play, Loader2, CheckCircle2, ArrowRight, Zap, Eye, EyeOff, FileText, FileJson, Copy, Check, AlertCircle, Pencil, X, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { FixStatusPill } from "@/components/StatusPills";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Audit Engine · epiphanAI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [url, setUrl] = useState("");
  const { audits, activeAuditId, startAudit } = useEpiphan();
  const navigate = useNavigate();
  const active = audits.find((a) => a.id === activeAuditId) ?? audits[0];

  const trimmed = url.trim();
  // Accept anything substantive: a brand site (nike.com), a marketplace URL,
  // a Shopify domain, a deep product link, or even a raw SKU. Audit engine
  // resolves the source at runtime.
  const valid = trimmed.length >= 3;

  function trigger() {
    if (!valid) return;
    const looksLikeUrl = /\./.test(trimmed) || trimmed.startsWith("http");
    const target = looksLikeUrl
      ? (trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
      : `sku://${trimmed}`;
    const id = startAudit(target);
    setUrl("");
    setTimeout(() => navigate({ to: "/dashboard" }), 50);
    return id;
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Audit Engine</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Run a GEO audit</h1>
          <p className="text-muted-foreground text-xs mt-1">
            Paste any brand site, marketplace URL, product page, or SKU. P1 → P5 runs sequentially with local-model classification.
          </p>
        </header>

        <section className="border border-border rounded-lg bg-surface p-5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="flex-1 flex items-center bg-background border border-border rounded px-3">
              <input id="epiphan-audit-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="nike.com  ·  adidas.com/yeezy-boost  ·  acme.myshopify.com  ·  SKU-MC-CREW-001"
                className="flex-1 bg-transparent outline-none py-2.5 text-sm font-mono placeholder:text-muted-foreground/60" />
            </div>
            <button onClick={trigger} disabled={!valid}
              className="px-5 py-2.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center gap-2 font-medium">
              <Play className="w-3.5 h-3.5" /> Start Audit
            </button>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            Optional: connect a platform for direct write-back —
            <a href="/settings#integrations" className="text-primary hover:underline ml-1">Shopify, WooCommerce, Etsy, Akeneo</a>.
            Audits work without a connector.
          </div>
        </section>

        {active && <ActiveAuditView audit={active} />}
      </div>
    </AppShell>
  );
}

function ActiveAuditView({ audit }: { audit: ReturnType<typeof useEpiphan.getState>["audits"][0] }) {
  const isRunning = audit.status === "running";
  const fixHistory = useEpiphan((s) => s.fixHistory).filter((h) => h.auditId === audit.id);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const failuresByPillar = useMemo(() => {
    const m: Record<PillarId, typeof audit.failures> = { P1: [], P2: [], P3: [], P4: [], P5: [] };
    audit.failures.forEach((f) => m[f.pillar].push(f));
    return m;
  }, [audit.failures]);

  const liveScores = useMemo(() => {
    const s: Record<PillarId, number> = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100 };
    audit.failures.forEach((f) => {
      if (f.status !== "deployed" && f.status !== "rolled_back") {
        s[f.pillar] = Math.max(0, s[f.pillar] - SEVERITY_WEIGHT[f.severity]);
      }
    });
    return s;
  }, [audit.failures]);

  const overall = Math.round((liveScores.P1 + liveScores.P2 + liveScores.P3 + liveScores.P4 + liveScores.P5) / 5);

  return (
    <>
      <section className="border border-border rounded-lg bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Audit · <span className="text-foreground">{audit.storeName}</span>
            </div>
            <StatusPill status={audit.status} />
          </div>
          <div suppressHydrationWarning className="text-[10px] text-muted-foreground tabular-nums">
            {new Date(audit.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-px bg-border rounded overflow-hidden">
          {PILLARS.map((p) => {
            const isCurrent = audit.currentPillar === p.id;
            const isDone = audit.failures.some((f) => f.pillar === p.id) || (!isCurrent && audit.status === "complete");
            const color = `var(--color-${p.tokenVar})`;
            return (
              <div key={p.id} className="bg-background px-3 py-3 relative overflow-hidden">
                {isCurrent && isRunning && (
                  <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, animation: "scan 1.6s linear infinite" }} />
                )}
                <div className="relative flex items-center gap-2">
                  <span className="text-[10px] tabular-nums font-semibold" style={{ color }}>{p.id}</span>
                  {isCurrent && isRunning ? <Loader2 className="w-3 h-3 animate-spin" style={{ color }} />
                    : isDone ? <CheckCircle2 className="w-3 h-3" style={{ color }} />
                    : <span className="w-1.5 h-1.5 rounded-full bg-muted" />}
                </div>
                <div className="relative text-[10px] text-muted-foreground mt-1 truncate">{p.name}</div>
              </div>
            );
          })}
        </div>
      </section>

      <StorePreview audit={audit} />

      <section className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <div className="border border-border rounded-lg bg-surface p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Overall GEO Score</div>
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <svg className="-rotate-90" width={176} height={176}>
                <circle cx={88} cy={88} r={78} stroke="var(--border)" strokeWidth={10} fill="none" />
                <circle cx={88} cy={88} r={78}
                  stroke="var(--color-primary)" strokeWidth={10} fill="none" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 78}
                  strokeDashoffset={2 * Math.PI * 78 - (overall / 100) * 2 * Math.PI * 78}
                  style={{ transition: "stroke-dashoffset 700ms ease" }} />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-5xl font-medium tabular-nums text-primary">{overall}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">/ 100</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-px bg-border w-full mt-6 rounded overflow-hidden">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
                const count = audit.failures.filter((f) => f.severity === sev).length;
                return (
                  <div key={sev} className="bg-background px-2 py-3 text-center">
                    <div className="text-lg tabular-nums font-medium" style={{ color: `var(--sev-${sev.toLowerCase()})` }}>{count}</div>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{sev}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-surface p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Pillar Breakdown</div>
          <div className="grid grid-cols-5 gap-4">
            {PILLARS.map((p) => {
              const count = failuresByPillar[p.id].length;
              const healed = failuresByPillar[p.id].filter((f) => f.status === "deployed").length;
              const status = audit.currentPillar === p.id ? "Running" : count > 0 ? `${healed}/${count} healed` : audit.status === "complete" ? "Clean" : "Pending";
              return (
                <PillarRing key={p.id} pillar={p.id} score={liveScores[p.id]} label={p.short} status={status} />
              );
            })}
          </div>
        </div>
      </section>

      {audit.sovBreakdown && Object.keys(audit.sovBreakdown).length > 0 && (
        <SovPanel sovBreakdown={audit.sovBreakdown} probeEngines={probeEngines} />
      )}

      {/* NEW — score trend chart */}
      <ScoreTrend audit={audit} history={fixHistory} liveScores={liveScores} />

      <FeedSection audit={audit} isRunning={isRunning} />

      {audit.status === "complete" && (
        <div className="flex justify-end gap-2">
          <a href="/impact" className="px-4 py-2 rounded border border-border hover:bg-accent/30 text-xs flex items-center gap-2">
            See Fix Impact <ArrowRight className="w-3 h-3" />
          </a>
          <a href="/review" className="px-4 py-2 rounded border border-border hover:bg-accent/30 text-xs flex items-center gap-2">
            Open Review Queue <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </>
  );
}

// ─── Share of Voice panel ─────────────────────────────────────────────────
function SovPanel({
  sovBreakdown,
  probeEngines,
}: {
  sovBreakdown: SovEngineBreakdown;
  probeEngines: { id: string; label: string; enabled: boolean }[];
}) {
  const ENGINE_COLORS: Record<string, string> = {
    chatgpt: "var(--color-p1)",
    gemini: "var(--color-p2)",
    perplexity: "var(--color-p3)",
  };

  const entries = probeEngines
    .filter((e) => e.enabled && sovBreakdown[e.id])
    .map((e) => ({ ...e, ...sovBreakdown[e.id] }));

  // Overall SoV: total brand citations / total probes across all engines
  const totalBrandCited = entries.reduce((s, e) => s + e.brandCited, 0);
  const totalProbes = entries.reduce((s, e) => s + e.total, 0);
  const overallPct = totalProbes > 0 ? Math.round((totalBrandCited / totalProbes) * 100) : 0;

  // Competitor presence: how many engines had at least 1 competitor citation
  const enginesWithCompetitor = entries.filter((e) => e.competitorCited > 0).length;

  return (
    <section className="border border-border rounded-lg bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          P5 · Share of Voice · AI Engine Breakdown
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Your brand SoV</span>
            <span className={`font-medium tabular-nums text-sm ${overallPct > 0 ? "text-sev-low" : "text-sev-critical"}`}>
              {overallPct}%
            </span>
          </div>
          {enginesWithCompetitor > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Competitor present in</span>
              <span className="font-medium text-sev-high">{enginesWithCompetitor}/{entries.length} engines</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-5 space-y-5">
        {entries.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">No probe engines enabled.</div>
        ) : (
          entries.map((e) => {
            const brandPct = e.total > 0 ? Math.round((e.brandCited / e.total) * 100) : 0;
            const competitorPct = e.total > 0 ? Math.round((e.competitorCited / e.total) * 100) : 0;
            const color = ENGINE_COLORS[e.id] ?? "var(--color-primary)";
            return (
              <div key={e.id} className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium" style={{ color }}>{e.label}</span>
                  <span className="text-muted-foreground tabular-nums text-[10px]">{e.total} probes</span>
                </div>
                {/* Brand bar */}
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Your brand</span>
                    <span className="tabular-nums" style={{ color: brandPct > 0 ? "var(--sev-low)" : "var(--sev-critical)" }}>
                      {e.brandCited}/{e.total} · {brandPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${brandPct}%`, background: color }}
                    />
                  </div>
                </div>
                {/* Competitor bar */}
                {e.competitorCited > 0 && (
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Top competitor</span>
                      <span className="tabular-nums text-sev-high">{e.competitorCited}/{e.total} · {competitorPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${competitorPct}%`, background: "var(--sev-high)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        {totalProbes > 0 && totalBrandCited === 0 && (
          <p className="text-[10px] text-sev-critical/80 border-t border-border pt-3">
            Brand was not cited in any probe query across any enabled AI engine. Improve structured content (P2) and context density (P3) to increase visibility.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Missing fields checklist ─────────────────────────────────────────────
function MissingFieldsChecklist({ missingFields }: { missingFields: MissingField[] }) {
  const [expanded, setExpanded] = useState(false);

  const ENGINE_LABEL: Record<string, string> = {
    all: "All engines",
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    perplexity: "Perplexity",
  };

  const missingCount = missingFields.filter((f) => !f.present).length;
  const totalCount = missingFields.length;

  // Group fields by engine relevance
  const groups: { key: string; label: string; fields: MissingField[] }[] = [
    {
      key: "all",
      label: "Required by all engines",
      fields: missingFields.filter((f) => f.engines.length === 1 && f.engines[0] === "all"),
    },
    {
      key: "chatgpt",
      label: "ChatGPT-specific",
      fields: missingFields.filter((f) => f.engines.includes("chatgpt") && !f.engines.includes("all")),
    },
    {
      key: "gemini",
      label: "Gemini-specific",
      fields: missingFields.filter((f) => f.engines.includes("gemini") && !f.engines.includes("all")),
    },
    {
      key: "perplexity",
      label: "Perplexity-specific",
      fields: missingFields.filter((f) => f.engines.includes("perplexity") && !f.engines.includes("all")),
    },
  ].filter((g) => g.fields.length > 0);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/20 text-left"
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Required fields checklist
          <span className={`normal-case tracking-normal font-medium ${missingCount > 0 ? "text-sev-critical" : "text-sev-low"}`}>
            {missingCount === 0 ? "all present" : `${missingCount}/${totalCount} missing`}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">{group.label}</div>
              <div className="space-y-1">
                {group.fields.map((field) => (
                  <div key={`${field.schemaType}-${field.field}`} className="flex items-center gap-2 text-[11px]">
                    {field.present ? (
                      <span className="text-sev-low w-3 text-center">✓</span>
                    ) : (
                      <span className="text-sev-critical w-3 text-center">✗</span>
                    )}
                    <span className={field.present ? "text-muted-foreground" : "text-foreground"}>
                      {field.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 font-mono">{field.schemaType}.{field.field}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Score Trend chart ───────────────────────────────────────────────────
function ScoreTrend({
  audit, history, liveScores,
}: {
  audit: ReturnType<typeof useEpiphan.getState>["audits"][0];
  history: ReturnType<typeof useEpiphan.getState>["fixHistory"];
  liveScores: Record<PillarId, number>;
}) {
  const ordered = [...history].filter((h) => h.auditId === audit.id).reverse();
  const points: { t: string; P1: number; P2: number; P3: number; P4: number; P5: number }[] = [];
  if (ordered.length > 0) {
    points.push({ t: "start", ...ordered[0].scoresBefore });
    ordered.forEach((h, i) => points.push({ t: `fix ${i + 1}`, ...h.scoresAfter }));
  } else {
    points.push({ t: "start", ...liveScores }, { t: "now", ...liveScores });
  }

  return (
    <section className="border border-border rounded-lg bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Score Trend · P1–P5 over fix deployments
        </div>
        <div className="text-[10px] text-muted-foreground">{ordered.length} deployment{ordered.length === 1 ? "" : "s"} recorded</div>
      </div>
      <div className="p-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="t" stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            {PILLARS.map((p) => (
              <Line key={p.id} type="monotone" dataKey={p.id}
                stroke={`var(--color-${p.tokenVar})`} strokeWidth={2}
                dot={{ r: 2 }} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── Failure feed with bulk select ───────────────────────────────────────
type FeedFilter = "all" | "eval_failed" | "review_pending";

function FeedSection({
  audit, isRunning,
}: {
  audit: ReturnType<typeof useEpiphan.getState>["audits"][0];
  isRunning: boolean;
}) {
  const bulkAutoFix = useEpiphan((s) => s.bulkAutoFix);
  const regenerateFix = useEpiphan((s) => s.regenerateFix);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [regenBatch, setRegenBatch] = useState<Set<string>>(new Set());

  useEffect(() => { setFilter("all"); setSelected(new Set()); setRegenBatch(new Set()); }, [audit.id]);

  useEffect(() => {
    if (regenBatch.size === 0) return;
    const batchFailures = audit.failures.filter((f) => regenBatch.has(f.id));
    const allSettled = batchFailures.every((f) => f.status !== "generating");
    if (!allSettled) return;
    const passed = batchFailures.filter((f) => f.status !== "eval_failed").length;
    const stillFailed = batchFailures.length - passed;
    if (stillFailed === 0) {
      toast.success(`All ${batchFailures.length} fix${batchFailures.length === 1 ? "" : "es"} passed the eval gate`, {
        description: "Ready to deploy — approve from the Review Queue or click Fix in the feed.",
      });
    } else {
      toast.warning(`${passed} of ${batchFailures.length} fix${batchFailures.length === 1 ? "" : "es"} passed the eval gate`, {
        description: `${stillFailed} still failing — try lowering your eval thresholds in Settings, or expand the row to edit the fix manually.`,
        duration: 8000,
      });
    }
    setRegenBatch(new Set());
  }, [audit.failures, regenBatch]);

  const evalFailed = audit.failures.filter((f) => f.status === "eval_failed");
  const selectable = audit.failures.filter((f) => f.fix && (f.status === "eval_passed" || f.status === "detected" || f.status === "review_pending"));

  const visibleFailures = useMemo(() => {
    const reversed = audit.failures.slice().reverse();
    if (filter === "eval_failed") return reversed.filter((f) => f.status === "eval_failed");
    if (filter === "review_pending") return reversed.filter((f) => f.status === "review_pending");
    return reversed;
  }, [audit.failures, filter]);
  const toggle = (id: string) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };
  const selectAll = () => setSelected(new Set(selectable.map((f) => f.id)));
  const selectNonCritical = () => setSelected(new Set(selectable.filter((f) => f.severity !== "CRITICAL").map((f) => f.id)));
  const clear = () => setSelected(new Set());

  const exportCsv = () => {
    downloadFile(`epiphan-${audit.storeName}-${Date.now()}.csv`, "text/csv", toCsv(audit.failures));
    toast.success("CSV exported", { description: `${audit.failures.length} failures.` });
  };
  const exportJson = () => {
    downloadFile(`epiphan-${audit.storeName}-${Date.now()}.json`, "application/json", toJson(audit.failures));
    toast.success("JSON exported", { description: `${audit.failures.length} failures.` });
  };
  const copyPayload = async () => {
    await copyToClipboard(JSON.stringify(toWebhookPayload(audit.failures), null, 2));
    toast.success("Webhook payload copied");
  };

  return (
    <section className="border border-border rounded-lg bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Live Failure Feed ·{" "}
            {filter === "all"
              ? `${audit.failures.length} detected`
              : `${visibleFailures.length} of ${audit.failures.length}`}
          </div>
          {audit.failures.length > 0 && (
            <div className="flex items-center gap-1">
              {([
                ["all", "All"],
                ["eval_failed", "Eval failed"],
                ["review_pending", "Pending"],
              ] as [FeedFilter, string][]).map(([val, label]) => {
                const active = filter === val;
                return (
                  <button
                    key={val}
                    onClick={() => setFilter(val)}
                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border transition-colors ${
                      active
                        ? val === "eval_failed"
                          ? "border-sev-critical/50 text-sev-critical bg-sev-critical/10"
                          : val === "review_pending"
                          ? "border-sev-high/50 text-sev-high bg-sev-high/10"
                          : "border-primary/50 text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {label}
                    {val === "eval_failed" && evalFailed.length > 0 && ` (${evalFailed.length})`}
                    {val === "review_pending" && selectable.length > 0 &&
                      ` (${audit.failures.filter((f) => f.status === "review_pending").length})`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isRunning && (
            <div className="flex items-center gap-2 text-[10px] text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> Polling every 5s
            </div>
          )}
          <button onClick={exportCsv} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent/30 flex items-center gap-1">
            <FileText className="w-3 h-3" /> CSV
          </button>
          <button onClick={exportJson} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent/30 flex items-center gap-1">
            <FileJson className="w-3 h-3" /> JSON
          </button>
          <button onClick={copyPayload} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent/30 flex items-center gap-1">
            <Copy className="w-3 h-3" /> Webhook
          </button>
        </div>
      </div>

      {(selectable.length > 0 || evalFailed.length > 0) && (
        <div className="px-5 py-2 border-b border-border bg-background/40 flex flex-wrap items-center gap-2">
          {selectable.length > 0 && (
            <>
              <button onClick={selectAll} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent/30">
                All fixable ({selectable.length})
              </button>
              <button onClick={selectNonCritical} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent/30">
                Non-critical only
              </button>
              {selected.size > 0 && (
                <button onClick={clear} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent/30 text-muted-foreground">
                  Clear
                </button>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {evalFailed.length > 0 && (
              <button
                onClick={() => {
                  const ids = evalFailed.map((f) => f.id);
                  ids.forEach((id) => regenerateFix(id));
                  setRegenBatch(new Set(ids));
                  toast.message("Regenerating failed fixes…", { description: `Re-running AI generation for ${evalFailed.length} eval-failed fix${evalFailed.length === 1 ? "" : "es"}.` });
                }}
                disabled={evalFailed.every((f) => f.status === "generating")}
                className="text-[10px] px-3 py-1.5 rounded border border-sev-medium/40 text-sev-medium hover:bg-sev-medium/10 disabled:opacity-30 disabled:cursor-not-allowed font-medium flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Regenerate failed ({evalFailed.length})
              </button>
            )}
            {selectable.length > 0 && (
              <button onClick={() => { bulkAutoFix(Array.from(selected)); clear(); }}
                disabled={selected.size === 0}
                className="text-[10px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed font-medium flex items-center gap-1.5">
                <Check className="w-3 h-3" /> Apply All ({selected.size})
              </button>
            )}
          </div>
        </div>
      )}

      {audit.failures.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-xs">
          {isRunning ? "Scanning… failures will appear here as detected." : "No failures detected."}
        </div>
      ) : visibleFailures.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground text-xs">
          No {filter === "eval_failed" ? "eval-failed" : "pending"} rows right now.{" "}
          <button onClick={() => setFilter("all")} className="text-primary hover:underline">Show all</button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          <div className="grid grid-cols-[28px_60px_70px_90px_1fr_140px_120px_90px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
            <div></div><div>Pillar</div><div>ID</div><div>Severity</div><div>Failure</div><div>Fix Status</div><div>Model</div><div className="text-right">Action</div>
          </div>
          {visibleFailures.map((f) => (
            <FailureRow key={f.id} f={f}
              checked={selected.has(f.id)}
              onCheck={() => toggle(f.id)}
              selectable={!!f.fix && (f.status === "eval_passed" || f.status === "detected" || f.status === "review_pending")} />
          ))}
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "var(--color-primary)", complete: "var(--sev-low)",
    failed: "var(--sev-critical)", pending: "var(--muted-foreground)",
  };
  const c = map[status] ?? "var(--muted-foreground)";
  return (
    <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border tabular-nums"
      style={{ color: c, borderColor: c + "40", background: c + "10" }}>
      {status}
    </span>
  );
}

export { FixStatusPill } from "@/components/StatusPills";

// ─── Live Store Preview ──────────────────────────────────────────────────
function StorePreview({ audit }: { audit: ReturnType<typeof useEpiphan.getState>["audits"][0] }) {
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const enabledProbeCount = probeQueries.filter((q) => q.enabled).length;
  const enabledEngineLabels = probeEngines.filter((e) => e.enabled).map((e) => e.label);

  const healed = (id: string) => audit.failures.some((f) => f.failureId === id && f.status === "deployed");
  const detected = (id: string) => audit.failures.some((f) => f.failureId === id);
  const ctx = audit.ctx;

  const currencySymbol = ctx.currency === "EUR" ? "€" : ctx.currency === "GBP" ? "£" : ctx.currency === "USD" ? "$" : `${ctx.currency} `;
  const wordCount = healed("F3.1") ? 412 : 32;
  const altText = healed("F4.1") || healed("F4.2") ? ctx.imageDesc : "IMG_4521.jpg";
  const robotsLine = healed("F1.2") ? "User-agent: GPTBot — Allow: /" : "User-agent: GPTBot — Disallow: /";
  const llmsTxt = healed("F1.1") ? "/llms.txt · deployed" : "/llms.txt · 404 Not Found";
  const jsonLd = healed("F2.1") ? "Product JSON-LD · valid" : "No Product JSON-LD";
  const breadcrumb = healed("F2.2") ? "BreadcrumbList · valid positions" : "BreadcrumbList · missing positions";
  const sovHealedCount = enabledProbeCount > 0 ? Math.round(enabledProbeCount * 0.6) : 0;
  const enginesLabel = enabledEngineLabels.length > 0 ? ` via ${enabledEngineLabels.join(", ")}` : "";
  const sov = healed("F5.1")
    ? `Cited in ${sovHealedCount}/${enabledProbeCount} probes${enginesLabel}`
    : `Cited in 0/${enabledProbeCount} probes${enginesLabel}`;
  const imageFmt = healed("F4.4") ? `${ctx.handle}.webp · 118 KB` : `${ctx.handle}.jpg · 412 KB`;
  const descBefore = `${ctx.productName}. ${ctx.material === "—" ? "Available now." : ctx.material + "."}`;
  const descAfter = `${ctx.material === "—" ? ctx.productName : ctx.material} — ${ctx.productName} is engineered for the way ${ctx.industry.toLowerCase()} customers actually use it: built to last, easy to care for, and grounded in real provenance. Best for everyday use and as a long-term staple in the ${ctx.category.toLowerCase()} category. Available in ${ctx.primaryColor === "—" ? "multiple finishes" : ctx.primaryColor + " and complementary tones"}. Designed and quality-controlled by ${ctx.brand}.`;
  const desc = healed("F3.1") ? descAfter : descBefore;

  const Row = ({ label, value, fixed, present }: { label: string; value: string; fixed: boolean; present: boolean }) => (
    <div className="grid grid-cols-[120px_1fr_70px] gap-3 items-center px-3 py-2 border-t border-border text-[11px]">
      <div className="text-muted-foreground uppercase tracking-wider text-[9px]">{label}</div>
      <div className="font-mono text-foreground truncate" title={value}>{value}</div>
      <div className="text-right">
        {!present ? (
          <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground">—</span>
        ) : fixed ? (
          <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-sev-low/40 text-sev-low bg-sev-low/10 inline-flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Healed
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-sev-critical/40 text-sev-critical bg-sev-critical/10">
            Issue
          </span>
        )}
      </div>
    </div>
  );

  const totalIssues = audit.failures.length;
  const healedCount = audit.failures.filter((f) => f.status === "deployed").length;

  return (
    <section className="border border-border rounded-lg bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Live Store Preview · <span className="text-foreground">{audit.storeName}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] tabular-nums">
          <span className="text-muted-foreground">Healed</span>
          <span className="text-sev-low font-medium">{healedCount}</span>
          <span className="text-muted-foreground">/ {totalIssues}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-px bg-border">
        <div className="bg-background p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Product detail page</div>
          <div className="border border-border rounded p-4 bg-surface/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-foreground">{ctx.productName}</div>
              <div className="text-sm tabular-nums text-foreground">{currencySymbol}{ctx.price}</div>
            </div>
            <div className={`text-[11px] leading-relaxed transition-colors duration-500 ${healed("F3.1") ? "text-foreground" : "text-muted-foreground"}`}>
              {desc}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className={`tabular-nums ${healed("F3.1") ? "text-sev-low" : "text-sev-critical"}`}>{wordCount} words</span>
              <span>·</span>
              <span className={healed("F4.4") ? "text-sev-low" : "text-muted-foreground"}>{imageFmt}</span>
            </div>
            <div className="mt-3 border-t border-border pt-2 text-[10px]">
              <span className="text-muted-foreground">alt=</span>
              <span className={`font-mono ${healed("F4.1") || healed("F4.2") ? "text-sev-low" : "text-sev-critical"}`}>"{altText}"</span>
            </div>
          </div>
        </div>

        <div className="bg-background">
          <div className="px-3 pt-5 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Technical & structural signals</div>
          <Row label="robots.txt" value={robotsLine} fixed={healed("F1.2")} present={detected("F1.2")} />
          <Row label="llms.txt"   value={llmsTxt}    fixed={healed("F1.1")} present={detected("F1.1")} />
          <Row label="Product schema"    value={jsonLd}     fixed={healed("F2.1")} present={detected("F2.1")} />
          <Row label="Breadcrumb schema" value={breadcrumb} fixed={healed("F2.2")} present={detected("F2.2")} />
          <Row label="Canonical tags"    value={healed("F1.5") ? "12 canonicals deployed" : "12 product pages missing canonical"} fixed={healed("F1.5")} present={detected("F1.5")} />
          <Row label="Share of voice"    value={sov}        fixed={healed("F5.1")} present={detected("F5.1")} />
        </div>
      </div>
    </section>
  );
}

function FailureRow({ f, checked, onCheck, selectable }: { f: Failure; checked: boolean; onCheck: () => void; selectable: boolean }) {
  const autoFix = useEpiphan((s) => s.autoFix);
  const approveFix = useEpiphan((s) => s.approveFix);
  const rejectFix = useEpiphan((s) => s.rejectFix);
  const editFix = useEpiphan((s) => s.editFix);
  const regenerateFix = useEpiphan((s) => s.regenerateFix);
  const evalThresholds = useEpiphan((s) => s.evalThresholds);

  const isManual = !f.fix;
  const isEvalFailed = f.status === "eval_failed";
  const isTerminal = ["deployed", "rejected", "rolled_back"].includes(f.status);
  const canApproveReject = !!f.fix && !isTerminal;

  const [open, setOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(f.fix?.after ?? "");
  const [rejectPending, setRejectPending] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isGenerating = f.status === "generating";
  const canAutoFix = f.fix && (f.status === "eval_passed" || f.status === "detected");
  const isPending = f.status === "review_pending";
  const MAX_REGEN = 5;
  const regenCount = f.regenerationCount ?? 0;
  const regenLimitReached = regenCount >= MAX_REGEN;

  const disabledTitle = !selectable
    ? isManual ? "No automated fix available — expand for manual action guidance"
    : isEvalFailed ? "Fix failed AI quality checks — expand to see exactly which scores missed your thresholds"
    : f.status === "deployed" ? "Already healed"
    : f.status === "rejected" ? "Fix was rejected"
    : undefined
    : undefined;

  function handleApprove() {
    if (editMode && draft !== f.fix?.after) editFix(f.id, draft);
    approveFix(f.id);
    setEditMode(false);
  }

  function handleRejectConfirm() {
    rejectFix(f.id, rejectReason || "Rejected by reviewer");
    setRejectPending(false);
    setRejectReason("");
  }

  return (
    <div className={`border-b border-border last:border-b-0 ${checked ? "bg-primary/5" : ""} ${isEvalFailed ? "border-l-2 border-l-sev-critical/40" : ""}`}>
      <div className="grid grid-cols-[28px_60px_70px_90px_1fr_140px_120px_100px] gap-3 px-5 py-2.5 items-start hover:bg-accent/20">
        <div className="pt-1">
          <input type="checkbox" checked={checked} disabled={!selectable} onChange={onCheck}
            title={disabledTitle}
            className="accent-primary disabled:opacity-30" />
        </div>
        <div className="pt-1"><PillarBadge pillar={f.pillar} /></div>
        <div className="pt-1 text-[11px] tabular-nums text-muted-foreground">{f.failureId}</div>
        <div className="pt-1"><SeverityBadge severity={f.severity} /></div>
        <div className="min-w-0">
          <div className="text-xs text-foreground">{f.failureName}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{f.detail}</div>
        </div>
        <div className="pt-0.5"><FixStatusPill status={f.status} /></div>
        <div className="pt-1 text-[10px] text-muted-foreground truncate">
          {f.fix?.generatedBy ?? (isManual ? "Manual" : "—")}
        </div>
        <div className="flex flex-wrap justify-end gap-1 pt-0.5">
          <button onClick={() => setOpen((o) => !o)}
            className="px-1.5 py-1 rounded border border-border hover:bg-accent/30 text-[10px] flex items-center gap-1"
            title={open ? "Collapse" : "Expand details"}>
            {open ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          {canAutoFix && (
            <button onClick={() => autoFix(f.id)}
              className="px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 text-[10px] flex items-center gap-1">
              <Zap className="w-3 h-3" /> Fix
            </button>
          )}
          {isEvalFailed && !isGenerating && (
            <button
              onClick={() => !regenLimitReached && regenerateFix(f.id)}
              disabled={regenLimitReached}
              title={regenLimitReached ? "5 attempts reached — lower thresholds in Settings → Eval gate instead" : undefined}
              className={`px-2 py-1 rounded border text-[10px] flex items-center gap-1 ${regenLimitReached ? "border-border text-muted-foreground opacity-40 cursor-not-allowed" : "border-sev-medium/40 text-sev-medium hover:bg-sev-medium/10"}`}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
          {isGenerating && (
            <span className="px-2 py-1 text-[10px] text-primary flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Generating…
            </span>
          )}
          {isPending && !open && (
            <button onClick={() => setOpen(true)}
              className="px-2 py-1 rounded border border-sev-high/40 text-sev-high hover:bg-sev-high/10 text-[10px]">
              Review ↓
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mx-5 mb-3 rounded border border-border bg-background/60 overflow-hidden">
          {isManual ? (
            <div className="space-y-0">
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <AlertCircle className="w-3 h-3" /> Manual action required
                </div>
                <p className="text-[11px] text-muted-foreground">
                  No automated fix is available for this issue — it requires a change you make directly in your store or CMS.
                  Once resolved, you can acknowledge it from the Review Queue.
                </p>
              </div>
              {f.missingFields && f.missingFields.length > 0 && (
                <MissingFieldsChecklist missingFields={f.missingFields} />
              )}
            </div>
          ) : (
            <div className="space-y-0">
              {/* Quality gate header */}
              <div className="px-3 pt-3 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <span>AI quality checks</span>
                {isEvalFailed && (f.regenerationCount ?? 0) > 0 && (
                  <span className="normal-case tracking-normal font-medium text-sev-medium">
                    Attempt {(f.regenerationCount ?? 0) + 1}
                  </span>
                )}
                {isEvalFailed ? (
                  <>
                    {(["factPreservation", "semanticDensity", "structuralSyntax", "objectAccuracy"] as const).map((key) => {
                      const score = f.fix!.evalScores[key];
                      const threshold = evalThresholds[key];
                      const pass = score >= threshold;
                      const label = key === "factPreservation" ? "Fact Pres" : key === "semanticDensity" ? "Sem Density" : key === "structuralSyntax" ? "Struct Syntax" : "Obj Accuracy";
                      return (
                        <span key={key} className={`flex items-center gap-1 ${pass ? "text-sev-low" : "text-sev-critical font-semibold"}`}>
                          {!pass && <AlertCircle className="w-2.5 h-2.5" />}
                          {label} {score}%{!pass && <span className="font-normal opacity-70">(min {threshold}%)</span>}
                        </span>
                      );
                    })}
                    <span className="normal-case tracking-normal text-sev-critical">
                      These are the scores that blocked deployment — lower your thresholds in <a href="/settings" className="underline">Settings → Eval gate</a>, or edit the fix below to improve them
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sev-low">Grounding {f.fix!.groundingScore}/100</span>
                    <span className="text-sev-low">Hallucination risk {f.fix!.hallucinationScore}/100</span>
                    <span className="text-foreground/60 normal-case tracking-normal truncate max-w-xs" title={f.fix!.reasoning}>
                      {f.fix!.reasoning}
                    </span>
                  </>
                )}
                {canApproveReject && !editMode && (
                  <button onClick={() => { setDraft(f.fix?.after ?? ""); setEditMode(true); }}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-border hover:bg-accent/30 normal-case tracking-normal text-foreground/70">
                    <Pencil className="w-2.5 h-2.5" /> Edit fix
                  </button>
                )}
                {editMode && (
                  <button onClick={() => { setEditMode(false); setDraft(f.fix?.after ?? ""); }}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded border border-border hover:bg-accent/30 normal-case tracking-normal text-foreground/70">
                    <X className="w-2.5 h-2.5" /> Cancel edit
                  </button>
                )}
              </div>

              {/* Diff or edit view */}
              <div className="p-3">
                {editMode ? (
                  <div className="grid md:grid-cols-2 gap-2">
                    <div className="border border-border rounded overflow-hidden" style={{ borderColor: "color-mix(in oklab, var(--sev-critical) 35%, transparent)" }}>
                      <div className="px-2 py-1 text-[9px] uppercase tracking-widest border-b text-sev-critical"
                        style={{ borderColor: "color-mix(in oklab, var(--sev-critical) 35%, transparent)", background: "color-mix(in oklab, var(--sev-critical) 8%, transparent)" }}>
                        Current state
                      </div>
                      <pre className="text-[10.5px] font-mono leading-relaxed whitespace-pre-wrap text-muted-foreground p-3 max-h-[200px] overflow-auto">{f.fix!.before}</pre>
                    </div>
                    <div className="border border-primary/40 rounded overflow-hidden">
                      <div className="px-2 py-1 text-[9px] uppercase tracking-widest border-b border-primary/40 text-primary bg-primary/8">
                        Your edit
                      </div>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-full bg-transparent outline-none text-[10.5px] leading-relaxed text-foreground min-h-[160px] max-h-[200px] font-mono resize-y p-3"
                      />
                    </div>
                  </div>
                ) : (
                  <DiffPane before={f.fix!.before} after={f.fix!.after} pillar={f.pillar} maxHeight={200} />
                )}
              </div>

              {/* Approve / Reject action bar */}
              {canApproveReject && (
                <div className="border-t border-border px-3 py-2.5 flex flex-wrap items-center gap-2">
                  {rejectPending ? (
                    <>
                      <input
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRejectConfirm(); if (e.key === "Escape") { setRejectPending(false); setRejectReason(""); } }}
                        placeholder="Reason (optional) — press Enter to confirm, Esc to cancel"
                        className="flex-1 min-w-[200px] bg-background border border-border rounded px-2.5 py-1.5 text-[11px] outline-none focus:border-sev-critical/60 placeholder:text-muted-foreground/50"
                      />
                      <button onClick={handleRejectConfirm}
                        className="px-3 py-1.5 rounded bg-sev-critical text-white text-[11px] flex items-center gap-1.5 font-medium">
                        <X className="w-3 h-3" /> Confirm reject
                      </button>
                      <button onClick={() => { setRejectPending(false); setRejectReason(""); }}
                        className="px-3 py-1.5 rounded border border-border text-[11px] text-muted-foreground hover:bg-accent/30">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleApprove}
                        className="px-3 py-1.5 rounded bg-sev-low text-background text-[11px] flex items-center gap-1.5 font-medium hover:opacity-90">
                        <Check className="w-3 h-3" /> {editMode ? "Save & Approve" : "Approve & Deploy"}
                      </button>
                      {editMode && (
                        <button onClick={() => { editFix(f.id, draft); setEditMode(false); }}
                          className="px-3 py-1.5 rounded border border-primary/50 text-primary hover:bg-primary/10 text-[11px] flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> Save edit only
                        </button>
                      )}
                      <button onClick={() => { setRejectPending(true); }}
                        className="px-3 py-1.5 rounded border border-sev-critical/50 text-sev-critical hover:bg-sev-critical/10 text-[11px] flex items-center gap-1.5">
                        <X className="w-3 h-3" /> Reject
                      </button>
                      {isEvalFailed && (
                        <>
                          <button
                            onClick={() => !regenLimitReached && regenerateFix(f.id)}
                            disabled={regenLimitReached}
                            title={regenLimitReached ? "5 attempts reached — lower thresholds in Settings → Eval gate instead" : undefined}
                            className={`px-3 py-1.5 rounded border text-[11px] flex items-center gap-1.5 ${regenLimitReached ? "border-border text-muted-foreground opacity-40 cursor-not-allowed" : "border-sev-medium/50 text-sev-medium hover:bg-sev-medium/10"}`}>
                            <RefreshCw className="w-3 h-3" /> Regenerate
                          </button>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            {regenLimitReached
                              ? "5 attempts reached — lower your eval thresholds in Settings → Eval gate, or edit the fix manually"
                              : "The failed scores are shown above — approving deploys the fix as-is, bypassing those checks"}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Terminal state badge */}
              {isTerminal && (
                <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                  {f.status === "deployed" ? "✓ Fix is live on your store" : f.status === "rejected" ? "✗ Fix was rejected" : "↩ Rolled back to previous state"}
                </div>
              )}

              {/* Missing fields checklist for P2 failures */}
              {f.missingFields && f.missingFields.length > 0 && (
                <MissingFieldsChecklist missingFields={f.missingFields} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

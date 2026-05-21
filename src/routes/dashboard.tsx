import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { PillarRing, SeverityBadge, PillarBadge } from "@/components/PillarRing";
import { useEpiphan } from "@/lib/epiphan-store";
import { PILLARS, PillarId, SEVERITY_WEIGHT, Failure } from "@/lib/epiphan-data";
import { Play, Plug, Loader2, CheckCircle2, ArrowRight, Zap, Eye } from "lucide-react";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Audit Engine · epiphanAI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [url, setUrl] = useState("");
  const { audits, activeAuditId, startAudit } = useEpiphan();
  const navigate = useNavigate();
  const active = audits.find((a) => a.id === activeAuditId) ?? audits[0];

  const valid = /(\.myshopify\.com|\.com|\.eu|\.io|\.co)/.test(url);

  function trigger() {
    if (!valid) return;
    const id = startAudit(url.startsWith("http") ? url : `https://${url}`);
    setUrl("");
    setTimeout(() => navigate({ to: "/dashboard" }), 50);
    return id;
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Audit Engine</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Run a sovereign GEO audit</h1>
          <p className="text-muted-foreground text-xs mt-1">Enter any Shopify domain. P1 → P5 runs sequentially, with local-model classification.</p>
        </header>

        {/* Trigger panel */}
        <section className="border border-border rounded-lg bg-surface p-5">
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="flex-1 flex items-center bg-background border border-border rounded px-3">
              <span className="text-muted-foreground text-xs mr-2">https://</span>
              <input
                id="epiphan-audit-url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="acme-apparel.myshopify.com"
                className="flex-1 bg-transparent outline-none py-2.5 text-sm font-mono"
              />
            </div>

            <button className="px-4 py-2.5 rounded border border-border bg-background hover:bg-accent/30 text-xs flex items-center gap-2">
              <Plug className="w-3.5 h-3.5" /> Connect Shopify
            </button>
            <button
              onClick={trigger}
              disabled={!valid}
              className="px-5 py-2.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center gap-2 font-medium"
            >
              <Play className="w-3.5 h-3.5" /> Start Audit
            </button>
          </div>
          {!valid && url.length > 0 && (
            <div className="mt-2 text-[10px] text-sev-high">Domain must match Shopify or top-level domain pattern.</div>
          )}
        </section>

        {active && <ActiveAuditView audit={active} />}
      </div>
    </AppShell>
  );
}

function ActiveAuditView({ audit }: { audit: ReturnType<typeof useEpiphan.getState>["audits"][0] }) {
  const isRunning = audit.status === "running";
  const failuresByPillar = useMemo(() => {
    const m: Record<PillarId, typeof audit.failures> = { P1: [], P2: [], P3: [], P4: [], P5: [] };
    audit.failures.forEach((f) => m[f.pillar].push(f));
    return m;
  }, [audit.failures]);

  // Live scores — deduct only for failures NOT yet healed (deployed)
  const liveScores = useMemo(() => {
    const s: Record<PillarId, number> = { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100 };
    audit.failures.forEach((f) => {
      if (f.status !== "deployed" && f.status !== "rolled_back") {
        s[f.pillar] = Math.max(0, s[f.pillar] - SEVERITY_WEIGHT[f.severity]);
      }
    });
    return s;
  }, [audit.failures]);

  const overall = Math.round(
    (liveScores.P1 + liveScores.P2 + liveScores.P3 + liveScores.P4 + liveScores.P5) / 5
  );

  return (
    <>
      {/* Progress strip */}
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
                  {isCurrent && isRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color }} />
                  ) : isDone ? (
                    <CheckCircle2 className="w-3 h-3" style={{ color }} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                  )}
                </div>
                <div className="relative text-[10px] text-muted-foreground mt-1 truncate">{p.name}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Store Preview — reflects healed state as fixes deploy */}
      <StorePreview audit={audit} />

      {/* Mosaic Report */}
      <section className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <div className="border border-border rounded-lg bg-surface p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Overall GEO Score</div>
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44">
              <svg className="-rotate-90" width={176} height={176}>
                <circle cx={88} cy={88} r={78} stroke="oklch(0.28 0.03 260)" strokeWidth={10} fill="none" />
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
                <PillarRing
                  key={p.id}
                  pillar={p.id}
                  score={liveScores[p.id]}
                  label={`${p.short}`}
                  status={status}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Live Failure Feed */}
      <section className="border border-border rounded-lg bg-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Live Failure Feed · {audit.failures.length} detected
          </div>
          {isRunning && (
            <div className="flex items-center gap-2 text-[10px] text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> Polling every 5s
            </div>
          )}
        </div>
        {audit.failures.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            {isRunning ? "Scanning… failures will appear here as detected." : "No failures detected. Trigger a new audit above."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-[60px_70px_90px_1fr_140px_120px_90px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
              <div>Pillar</div><div>ID</div><div>Severity</div><div>Failure</div><div>Fix Status</div><div>Model</div><div className="text-right">Action</div>
            </div>
            {audit.failures.slice().reverse().map((f) => (
              <FailureRow key={f.id} f={f} />
            ))}

          </div>
        )}
      </section>

      {audit.status === "complete" && (
        <div className="flex justify-end gap-2">
          <a href="/review" className="px-4 py-2 rounded border border-border hover:bg-accent/30 text-xs flex items-center gap-2">
            Open Review Queue <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "var(--color-primary)",
    complete: "var(--sev-low)",
    failed: "var(--sev-critical)",
    pending: "var(--muted-foreground)",
  };
  const c = map[status] ?? "var(--muted-foreground)";
  return (
    <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border tabular-nums"
      style={{ color: c, borderColor: c + "40", background: c + "10" }}>
      {status}
    </span>
  );
}

export function FixStatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; l: string }> = {
    detected: { c: "var(--muted-foreground)", l: "Detected" },
    generating: { c: "var(--color-primary)", l: "Generating" },
    eval_pending: { c: "var(--sev-medium)", l: "Eval pending" },
    eval_passed: { c: "var(--sev-low)", l: "Eval passed" },
    eval_failed: { c: "var(--sev-critical)", l: "Eval failed" },
    review_pending: { c: "var(--sev-high)", l: "Awaiting review" },
    approved: { c: "var(--sev-low)", l: "Approved" },
    deployed: { c: "var(--sev-low)", l: "✓ Healed" },
    rolled_back: { c: "var(--muted-foreground)", l: "Rolled back" },
    rejected: { c: "var(--sev-critical)", l: "Rejected" },
  };
  const x = map[status] ?? map.detected;
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border tabular-nums w-fit"
      style={{ color: x.c, borderColor: x.c + "40", background: x.c + "10" }}>
      {x.l}
    </span>
  );
}

// ─── Live Store Preview ──────────────────────────────────────────────────
function StorePreview({ audit }: { audit: ReturnType<typeof useEpiphan.getState>["audits"][0] }) {
  const healed = (id: string) => audit.failures.some((f) => f.failureId === id && f.status === "deployed");
  const detected = (id: string) => audit.failures.some((f) => f.failureId === id);

  // Simulated metrics that shift as fixes heal
  const wordCount = healed("F3.1") ? 412 : 32;
  const altText = healed("F4.1")
    ? "Charcoal merino wool crew-neck sweater, ribbed collar"
    : healed("F4.2") ? "Stone cashmere scarf on wooden chair" : "IMG_4521.jpg";
  const robotsLine = healed("F1.2") ? "User-agent: GPTBot — Allow: /" : "User-agent: GPTBot — Disallow: /";
  const llmsTxt = healed("F1.1") ? "/llms.txt · deployed" : "/llms.txt · 404 Not Found";
  const jsonLd = healed("F2.1") ? "Product JSON-LD · valid" : "No Product JSON-LD";
  const breadcrumb = healed("F2.2") ? "BreadcrumbList · valid positions" : "BreadcrumbList · missing positions";
  const sov = healed("F5.1") ? "Cited in 6/10 probes" : "Cited in 0/10 probes";
  const imageFmt = healed("F4.4") ? "merino.webp · 118 KB" : "merino.jpg · 412 KB";
  const desc = healed("F3.1")
    ? "100% Italian merino wool sourced in Biella. Best for office layering, smart-casual dinners, and weekend coats. 19.5-micron yarn, breathable, pill-resistant. Pairs with denim, wool trousers, selvedge chinos…"
    : "Soft merino crew. Made in Italy.";

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
        {/* Product card mock */}
        <div className="bg-background p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Product detail page</div>
          <div className="border border-border rounded p-4 bg-surface/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-foreground">Merino Crew Sweater</div>
              <div className="text-sm tabular-nums text-foreground">€189</div>
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

        {/* Technical signals */}
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



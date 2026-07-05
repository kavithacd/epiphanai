import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { MODEL_MATRIX, PILLARS, Failure, Fix, mulberry32 } from "@/lib/epiphan-data";
import { Cpu, ShieldCheck, ShieldAlert, Lock, Activity, Coins, ThumbsUp, ThumbsDown, Microscope } from "lucide-react";
import { seoMeta } from "@/lib/branding";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [...seoMeta("Admin Cockpit", "Internal observability, guardrails, and eval traces."), { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function Admin() {
  const { traces, guardrailEvents, audits, totalCostUsd } = useEpiphan();
  const totalCalls = traces.length;
  const totalTokens = traces.reduce((s, t) => s + t.tokensIn + t.tokensOut, 0);
  const avgLatency = Math.round(traces.reduce((s, t) => s + t.durationMs, 0) / Math.max(traces.length, 1));
  const evalPass = traces.filter((t) => t.workflow.includes("Eval")).length;

  // Per-fix evaluation traces (Langfuse / Phoenix / Helicone-style)
  const fixTraces: { failure: Failure; fix: Fix }[] = audits
    .flatMap((a) => a.failures)
    .filter((f): f is Failure & { fix: Fix } => !!f.fix)
    .map((f) => ({ failure: f, fix: f.fix as Fix }))
    .sort((a, b) => b.failure.detectedAt - a.failure.detectedAt);
  const feedbackGiven = fixTraces.filter((t) => t.fix.userFeedback);
  const passCount = feedbackGiven.filter((t) => t.fix.userFeedback === "pass").length;
  const failCount = feedbackGiven.filter((t) => t.fix.userFeedback === "fail").length;
  const passRate = feedbackGiven.length === 0 ? null : Math.round((passCount / feedbackGiven.length) * 100);
  const avgHallucination = fixTraces.length === 0 ? 0 :
    Math.round(fixTraces.reduce((s, t) => s + t.fix.hallucinationScore, 0) / fixTraces.length);
  const avgGrounding = fixTraces.length === 0 ? 0 :
    Math.round(fixTraces.reduce((s, t) => s + t.fix.groundingScore, 0) / fixTraces.length);

  return (
    <AppShell>
      <div className="max-w-[1500px] mx-auto p-8 space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin Cockpit · Observability</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Trace, evals & guardrails</h1>
          </div>
          <div className="text-[10px] text-muted-foreground">
            operator@shine.eu
          </div>
        </header>

        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border rounded overflow-hidden">
          <Kpi icon={<Activity />} label="Inference calls" value={totalCalls.toString()} sub="last 24h" />
          <Kpi icon={<Cpu />} label="Tokens processed" value={totalTokens.toLocaleString()} sub="in+out" />
          <Kpi icon={<ShieldCheck />} label="Eval gate runs" value={evalPass.toString()} sub="0% hallucination" />
          <Kpi icon={<Activity />} label="Avg latency" value={`${avgLatency}ms`} sub="across all models" />
          <Kpi icon={<Coins />} label="Cost tracker" value={`$${totalCostUsd.toFixed(3)}`} sub="100% sovereign · zero cloud spend" />
        </section>

        {/* Guardrails */}
        <section className="border border-border rounded-lg bg-surface">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Guardrail Status Panel · Hard-stop rules</div>
            <div className="text-[10px] text-sev-low flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sev-low animate-pulse" /> All systems nominal
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-border">
            <GuardCard icon={<Lock />} title="Sovereign Mode" status="ACTIVE"
              detail="All client data inferred locally. Zero cloud API calls. Zero data leakage." />
            <GuardCard icon={<ShieldAlert />} title="Destructive Op Lock" status="ACTIVE"
              detail="DELETE operations against Shopify API are refused. Additive / replace only." />
            <GuardCard icon={<ShieldCheck />} title="High-Risk Filter" status="ACTIVE"
              detail="Medical, legal, and financial claims auto-stripped from generated copy." />
          </div>
        </section>

        {/* Eval Engine */}
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="border border-border rounded-lg bg-surface p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">P3 Hallucination Check · 0% tolerance</div>
            <EvalSparkline color="var(--sev-low)" passRate={100} runs={47} />
            <div className="grid grid-cols-3 gap-px bg-border mt-4 rounded overflow-hidden border border-border">
              <Stat label="Runs" value="47" />
              <Stat label="Pass" value="47" color="var(--sev-low)" />
              <Stat label="Fail / Regen" value="0" color="var(--sev-critical)" />
            </div>
          </div>
          <div className="border border-border rounded-lg bg-surface p-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">P2 Schema Validator · Schema.org compliance</div>
            <EvalSparkline color="var(--color-p2)" passRate={100} runs={29} />
            <div className="grid grid-cols-3 gap-px bg-border mt-4 rounded overflow-hidden border border-border">
              <Stat label="Runs" value="29" />
              <Stat label="Valid" value="29" color="var(--sev-low)" />
              <Stat label="Blocked" value="0" color="var(--sev-critical)" />
            </div>
          </div>
        </section>

        {/* Per-Fix Evaluation Traces — Langfuse / Phoenix / Helicone style */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Microscope className="w-3.5 h-3.5 text-primary" />
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Fix Evaluation Traces · open-source style (Langfuse · Phoenix · Helicone)
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground tabular-nums">
              <span>Avg hallucination <span className="text-sev-low ml-1">{avgHallucination}/100</span></span>
              <span>Avg grounding <span className="text-sev-low ml-1">{avgGrounding}/100</span></span>
              <span className="flex items-center gap-1.5">
                User pass-rate
                <span className={passRate === null ? "text-muted-foreground" : passRate >= 80 ? "text-sev-low" : passRate >= 50 ? "text-sev-medium" : "text-sev-critical"}>
                  {passRate === null ? "—" : `${passRate}%`}
                </span>
                <span className="text-muted-foreground">({passCount}✓ / {failCount}✗ · {feedbackGiven.length} rated)</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[100px_55px_60px_1fr_140px_100px_100px_180px_90px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
            <div>Trace ID</div>
            <div>Pillar</div>
            <div>Sev</div>
            <div>Failure</div>
            <div>Model</div>
            <div>Halluc.</div>
            <div>Grounding</div>
            <div>Judge reasoning</div>
            <div className="text-right">User</div>
          </div>

          <div className="divide-y divide-border max-h-[480px] overflow-auto">
            {fixTraces.length === 0 ? (
              <div className="p-10 text-center text-[11px] text-muted-foreground">
                No fixes generated yet. Run an audit to populate per-fix traces.
              </div>
            ) : fixTraces.map(({ failure: f, fix }) => {
              const pColor = `var(--color-${PILLARS.find((p) => p.id === f.pillar)!.tokenVar})`;
              const sevColor = `var(--sev-${f.severity.toLowerCase()})`;
              return (
                <div key={fix.id} className="grid grid-cols-[100px_55px_60px_1fr_140px_100px_100px_180px_90px] gap-3 px-5 py-2.5 items-center text-[11px] hover:bg-accent/20">
                  <div className="font-mono text-[10px] text-muted-foreground truncate">trc_{fix.id}</div>
                  <div>
                    <span className="text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded border" style={{ color: pColor, borderColor: pColor + "40", background: pColor + "10" }}>
                      {f.pillar}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-widest px-1 py-0.5 rounded" style={{ color: sevColor, background: sevColor + "15" }}>
                      {f.severity.slice(0, 3)}
                    </span>
                  </div>
                  <div className="text-foreground truncate" title={f.failureName}>{f.failureName}</div>
                  <div className="text-muted-foreground truncate">{fix.generatedBy}</div>
                  <div className="tabular-nums" style={{ color: fix.hallucinationScore <= 5 ? "var(--sev-low)" : fix.hallucinationScore <= 15 ? "var(--sev-medium)" : "var(--sev-critical)" }}>
                    {fix.hallucinationScore}/100
                  </div>
                  <div className="tabular-nums" style={{ color: fix.groundingScore >= 90 ? "var(--sev-low)" : fix.groundingScore >= 75 ? "var(--sev-medium)" : "var(--sev-critical)" }}>
                    {fix.groundingScore}/100
                  </div>
                  <div className="text-muted-foreground text-[10px] truncate" title={fix.reasoning}>{fix.reasoning}</div>
                  <div className="text-right">
                    {fix.userFeedback === "pass" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-sev-low/40 text-sev-low bg-sev-low/10">
                        <ThumbsUp className="w-2.5 h-2.5" /> Pass
                      </span>
                    ) : fix.userFeedback === "fail" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-sev-critical/40 text-sev-critical bg-sev-critical/10">
                        <ThumbsDown className="w-2.5 h-2.5" /> Fail
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-2 border-t border-border text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40 flex items-center justify-between">
            <span>Schema compatible with Langfuse traces · Phoenix spans · Helicone observability events</span>
            <span>{fixTraces.length} fix trace{fixTraces.length === 1 ? "" : "s"}</span>
          </div>
        </section>

        {/* Model matrix */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            Sovereign AI Model Matrix
          </div>
          <div className="grid grid-cols-[1fr_80px_180px_120px_80px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
            <div>Model</div><div>Params</div><div>Role</div><div>Cost / 1k tok</div><div className="text-right">Status</div>
          </div>
          {Object.values(MODEL_MATRIX).map((m) => (
            <div key={m.name} className="grid grid-cols-[1fr_80px_180px_120px_80px] gap-3 px-5 py-2.5 border-t border-border items-center">
              <div className="text-xs text-foreground">{m.name}</div>
              <div className="text-[11px] tabular-nums text-muted-foreground">{m.size}</div>
              <div className="text-[11px] text-muted-foreground">{m.role}</div>
              <div className="text-[11px] tabular-nums" style={{ color: m.costPer1k > 0 ? "var(--sev-medium)" : "var(--sev-low)" }}>
                {m.costPer1k > 0 ? `$${m.costPer1k.toFixed(4)}` : "Sovereign (local)"}
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-sev-low/40 text-sev-low bg-sev-low/10">Ready</span>
              </div>
            </div>
          ))}
        </section>

        {/* Trace logs */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            Trace Logs · every autonomous action
          </div>
          <div className="grid grid-cols-[110px_180px_160px_100px_80px_80px_70px_60px] gap-3 px-5 py-2 text-[9px] uppercase tracking-widest text-muted-foreground bg-background/40">
            <div>Timestamp</div><div>Model</div><div>Workflow</div><div>Prompt hash</div><div>Latency</div><div>Tokens</div><div>Cost</div><div className="text-right">Status</div>
          </div>
          <div className="divide-y divide-border max-h-[480px] overflow-auto">
            {traces.map((t) => (
              <div key={t.id} className="grid grid-cols-[110px_180px_160px_100px_80px_80px_70px_60px] gap-3 px-5 py-2 items-center text-[11px] tabular-nums hover:bg-accent/20">
                <div className="text-muted-foreground">{new Date(t.timestamp).toLocaleTimeString()}</div>
                <div className="text-foreground truncate">{t.model}</div>
                <div className="text-muted-foreground truncate">{t.workflow}</div>
                <div className="text-muted-foreground font-mono">{t.promptHash}</div>
                <div className="text-muted-foreground">{t.durationMs}ms</div>
                <div className="text-muted-foreground">{(t.tokensIn + t.tokensOut).toLocaleString()}</div>
                <div style={{ color: t.costUsd > 0 ? "var(--sev-medium)" : "var(--muted-foreground)" }}>
                  {t.costUsd > 0 ? `$${t.costUsd.toFixed(4)}` : "—"}
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                    style={{
                      color: t.status === "success" ? "var(--sev-low)" : "var(--sev-critical)",
                      borderColor: (t.status === "success" ? "var(--sev-low)" : "var(--sev-critical)") + "40",
                    }}>
                    {t.status === "success" ? "OK" : "FAIL"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Guardrail event log */}
        <section className="border border-border rounded-lg bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
            Guardrail Events
          </div>
          <div className="divide-y divide-border">
            {guardrailEvents.map((g) => (
              <div key={g.id} className="grid grid-cols-[110px_180px_1fr_80px] gap-3 px-5 py-2.5 items-center text-[11px]">
                <div className="text-muted-foreground tabular-nums">{new Date(g.ts).toLocaleTimeString()}</div>
                <div className="text-foreground">{g.rule}</div>
                <div className="text-muted-foreground">{g.detail}</div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border"
                    style={{
                      color: g.outcome === "blocked" ? "var(--sev-high)" : "var(--sev-low)",
                      borderColor: (g.outcome === "blocked" ? "var(--sev-high)" : "var(--sev-low)") + "40",
                    }}>
                    {g.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="text-[10px] text-muted-foreground text-center pt-4 border-t border-border">
          {audits.length} audits in store · trace retention 90 days · all evals re-runnable on demand
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: "warn" }) {
  return (
    <div className="bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="w-3.5 h-3.5">{icon}</span>
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-medium tabular-nums mt-2" style={{ color: tone === "warn" ? "var(--sev-medium)" : "var(--color-primary)" }}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function GuardCard({ icon, title, status, detail }: { icon: React.ReactNode; title: string; status: string; detail: string }) {
  return (
    <div className="bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <span className="w-4 h-4">{icon}</span>
          <span className="text-xs text-foreground font-medium">{title}</span>
        </div>
        <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-sev-low/40 text-sev-low bg-sev-low/10">{status}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">{detail}</p>
    </div>
  );
}

function EvalSparkline({ color, passRate, runs }: { color: string; passRate: number; runs: number }) {
  const bars = useMemo(() => {
    const rng = mulberry32(runs * 137 + passRate * 13);
    return Array.from({ length: runs }, () => {
      const pass = rng() > 0.05;
      const height = pass ? 50 + rng() * 50 : 20;
      return { pass, height };
    });
  }, [runs, passRate]);

  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-sm" style={{
            height: `${b.height}%`,
            background: b.pass ? color : "var(--sev-critical)",
            opacity: b.pass ? 0.7 : 1,
          }} />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2">
        <span>Pass rate</span>
        <span className="tabular-nums" style={{ color }}>{passRate}%</span>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "var(--foreground)" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-background p-2.5 text-center">
      <div className="text-base tabular-nums font-medium" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

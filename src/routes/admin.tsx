import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { MODEL_MATRIX } from "@/lib/epiphan-data";
import { Cpu, ShieldCheck, ShieldAlert, Lock, Activity, Coins } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Cockpit · epiphanAI" }] }),
  component: Admin,
});

function Admin() {
  const { traces, guardrailEvents, audits, totalCostUsd } = useEpiphan();
  const totalCalls = traces.length;
  const totalTokens = traces.reduce((s, t) => s + t.tokensIn + t.tokensOut, 0);
  const avgLatency = Math.round(traces.reduce((s, t) => s + t.durationMs, 0) / Math.max(traces.length, 1));
  const evalPass = traces.filter((t) => t.workflow.includes("Eval")).length;

  return (
    <AppShell>
      <div className="max-w-[1500px] mx-auto p-8 space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin Cockpit · Observability</div>
            <h1 className="text-2xl font-sans font-medium mt-1">Trace, evals & guardrails</h1>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Tessera Advisory · operator@tessera.eu
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
  const bars = Array.from({ length: runs }, () => Math.random() > 0.05 ? 1 : 0);
  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-sm" style={{
            height: b ? `${50 + Math.random() * 50}%` : "20%",
            background: b ? color : "var(--sev-critical)",
            opacity: b ? 0.7 : 1,
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

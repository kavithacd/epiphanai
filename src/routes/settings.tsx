import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEpiphan, EVAL_THRESHOLD_META } from "@/lib/epiphan-store";
import { resolveProbeQuery, ProductContext, DEMO_CTX } from "@/lib/epiphan-data";
import { useState } from "react";
import { Save, Webhook, Slack as SlackIcon, ShoppingBag, Globe, Database, Layers, Zap, ShieldCheck, Radio, Trash2, Plus } from "lucide-react";
import { IntegrationConfig } from "@/lib/epiphan-export";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · epiphanAI" }] }),
  component: Settings,
});

function Settings() {
  const integrations = useEpiphan((s) => s.integrations);
  const setIntegration = useEpiphan((s) => s.setIntegration);
  const autoDeployEnabled = useEpiphan((s) => s.autoDeployEnabled);
  const setAutoDeployEnabled = useEpiphan((s) => s.setAutoDeployEnabled);
  const evalThresholds = useEpiphan((s) => s.evalThresholds);
  const setEvalThreshold = useEpiphan((s) => s.setEvalThreshold);
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const addProbeQuery = useEpiphan((s) => s.addProbeQuery);
  const deleteProbeQuery = useEpiphan((s) => s.deleteProbeQuery);
  const updateProbeQuery = useEpiphan((s) => s.updateProbeQuery);
  const toggleProbeQuery = useEpiphan((s) => s.toggleProbeQuery);
  const toggleProbeEngine = useEpiphan((s) => s.toggleProbeEngine);
  const audits = useEpiphan((s) => s.audits);
  const previewCtx: ProductContext = audits[0]?.ctx ?? DEMO_CTX;
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [n8nUrl, setN8nUrl] = useState("https://n8n.tessera.internal/webhook/audit/start");
  const [saved, setSaved] = useState(false);
  const [newQueryText, setNewQueryText] = useState("");

  const upd = <K extends keyof IntegrationConfig>(k: K) =>
    (v: IntegrationConfig[K]) => setIntegration(k, v);

  const activeEngineCount = probeEngines.filter((e) => e.enabled).length;
  const enabledQueryCount = probeQueries.filter((q) => q.enabled).length;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Configuration</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Settings</h1>
        </header>

        {/* Audit behaviour */}
        <section className="border border-border rounded-lg bg-surface p-6 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Audit behaviour</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Control how detected fixes are handled after the eval gate passes.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 py-3 border-t border-border">
            <div className="flex items-start gap-3">
              <Zap className={`w-4 h-4 mt-0.5 ${autoDeployEnabled ? "text-sev-low" : "text-muted-foreground"}`} />
              <div>
                <div className="text-xs font-medium text-foreground">Auto-deploy safe fixes</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
                  When <span className="text-foreground">ON</span> — technical fixes (robots.txt, JSON-LD, canonical tags, WebP conversion) are deployed automatically after passing the eval gate. Copy and image fixes always require human review.<br />
                  When <span className="text-foreground">OFF</span> — every fix lands in the Review Queue for your approval before anything is deployed.
                </div>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={autoDeployEnabled}
              onClick={() => setAutoDeployEnabled(!autoDeployEnabled)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${autoDeployEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${autoDeployEnabled ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>
          <div className={`text-[10px] px-3 py-2 rounded border ${autoDeployEnabled ? "border-sev-low/30 bg-sev-low/5 text-sev-low" : "border-border text-muted-foreground"}`}>
            {autoDeployEnabled
              ? "● Auto-deploy ON — safe fixes will deploy automatically after eval gate."
              : "● Auto-deploy OFF — all fixes route to the Review Queue for manual approval."}
          </div>
        </section>

        {/* Eval gate */}
        <section className="border border-border rounded-lg bg-surface p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="w-3 h-3" /> Eval gate thresholds
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Every AI-generated fix is scored by a judge model (Llama 3.3) on four axes before it can be approved or deployed.
              A fix that misses <em>any</em> threshold is marked <span className="text-sev-critical">Eval failed</span> and blocked from the deploy path until regenerated.
            </p>
          </div>

          {EVAL_THRESHOLD_META.map((m) => (
            <div key={m.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-foreground">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 max-w-lg">{m.description}</div>
                </div>
                <div className="text-sm tabular-nums font-medium text-foreground ml-4 w-12 text-right">
                  {evalThresholds[m.key]}%
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-muted-foreground w-4">0</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={evalThresholds[m.key]}
                  onChange={(e) => setEvalThreshold(m.key, Number(e.target.value))}
                  className="flex-1 accent-primary h-1.5"
                />
                <span className="text-[9px] text-muted-foreground w-6">100</span>
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground px-7">
                <span>← More permissive</span>
                <span className={evalThresholds[m.key] >= 95 ? "text-sev-low" : evalThresholds[m.key] >= 80 ? "text-sev-medium" : "text-sev-critical"}>
                  {evalThresholds[m.key] >= 95 ? "Strict" : evalThresholds[m.key] >= 80 ? "Balanced" : "Permissive"}
                </span>
                <span>Stricter →</span>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-border">
            <button
              onClick={() => EVAL_THRESHOLD_META.forEach((m) => setEvalThreshold(m.key, m.default))}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Reset to defaults
            </button>
            <span className="text-[10px] text-muted-foreground ml-3">
              (Fact Preservation: 100 · Semantic Density: 90 · Structural Syntax: 100 · Object Accuracy: 95)
            </span>
          </div>
        </section>

        {/* Probe configuration */}
        <section className="border border-border rounded-lg bg-surface p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Radio className="w-3 h-3" /> Probe configuration
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Configure which AI engines and query strings are used during P5 Share-of-Voice probing.
              Changes apply to the next audit you run.
            </p>
          </div>

          {/* Engine toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Probe engines</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {activeEngineCount} of {probeEngines.length} active
              </div>
            </div>
            {probeEngines.map((engine) => (
              <div key={engine.id} className="flex items-center justify-between px-3 py-2.5 border border-border rounded bg-background">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${engine.enabled ? "bg-sev-low" : "bg-muted-foreground/40"}`} />
                  <span className="text-xs font-medium text-foreground">{engine.label}</span>
                </div>
                <button
                  role="switch"
                  aria-checked={engine.enabled}
                  onClick={() => toggleProbeEngine(engine.id)}
                  className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${engine.enabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${engine.enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Probe queries */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Probe queries</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {enabledQueryCount} of {probeQueries.length} active
              </div>
            </div>

            {/* Variable legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 rounded border border-border bg-background/60 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground/60">Template variables:</span>
              {[
                ["{{brand}}", previewCtx.brand],
                ["{{category}}", previewCtx.category],
                ["{{industry}}", previewCtx.industry],
                ["{{productName}}", previewCtx.productName],
              ].map(([variable, example]) => (
                <span key={variable}>
                  <code className="text-primary/80 font-mono">{variable}</code>
                  <span className="text-muted-foreground/60"> → {example}</span>
                </span>
              ))}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {probeQueries.map((query, idx) => {
                const resolved = resolveProbeQuery(query.text, previewCtx);
                const hasVars = resolved !== query.text;
                return (
                  <div key={query.id} className="group">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground tabular-nums w-4 text-right flex-shrink-0">{idx + 1}</span>
                      <button
                        role="switch"
                        aria-checked={query.enabled}
                        onClick={() => toggleProbeQuery(query.id)}
                        title={query.enabled ? "Disable query" : "Enable query"}
                        className={`relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${query.enabled ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${query.enabled ? "translate-x-2.5" : "translate-x-0"}`} />
                      </button>
                      <input
                        type="text"
                        value={query.text}
                        onChange={(e) => updateProbeQuery(query.id, e.target.value)}
                        className={`flex-1 bg-background border border-border rounded px-2 py-1 text-[11px] font-mono outline-none focus:border-primary transition-opacity ${query.enabled ? "opacity-100" : "opacity-40"}`}
                      />
                      <button
                        onClick={() => deleteProbeQuery(query.id)}
                        disabled={probeQueries.length <= 1}
                        title={probeQueries.length <= 1 ? "At least one probe query required" : "Delete query"}
                        className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-sev-critical hover:bg-sev-critical/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {hasVars && (
                      <div className="ml-[52px] mt-0.5 text-[10px] text-muted-foreground/70 font-mono truncate">
                        ↳ {resolved}
                      </div>
                    )}
                  </div>
                );
              })}
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
                  }
                }}
                placeholder="Type a new probe query and press Enter…"
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-[11px] font-mono outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  if (newQueryText.trim()) {
                    addProbeQuery(newQueryText.trim());
                    setNewQueryText("");
                  }
                }}
                disabled={!newQueryText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> Add probe
              </button>
            </div>
          </div>
        </section>

        {/* Core stack */}
        <section className="border border-border rounded-lg bg-surface p-6 space-y-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Core stack</div>

          <Field label="n8n webhook URL" hint="POST endpoint that triggers WF-01 Master Orchestrator.">
            <input value={n8nUrl} onChange={(e) => setN8nUrl(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Ollama endpoint" hint="Local inference. Default: http://localhost:11434">
            <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className={inputCls} />
          </Field>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground">
              Connection health · <span className="text-sev-low">●</span> Ollama · <span className="text-sev-low">●</span> Supabase · <span className="text-sev-medium">●</span> n8n
            </div>
            <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs flex items-center gap-2">
              <Save className="w-3 h-3" /> {saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </section>

        {/* Integrations */}
        <section className="border border-border rounded-lg bg-surface p-6 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Push integrations</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Configured destinations appear in the Review Queue's <span className="text-foreground">Push</span> menu.
              Empty fields run in <span className="text-foreground">simulated mode</span> — payloads are still generated and logged so you can preview the exact request body before swapping in a real key.
            </p>
          </div>

          <Field icon={<SlackIcon className="w-3 h-3" />} label="Slack webhook URL"
            hint="A bot posts a notification when a CRITICAL failure is detected.">
            <input value={integrations.slackWebhook} onChange={(e) => upd("slackWebhook")(e.target.value)}
              placeholder="https://hooks.slack.com/services/T000/B000/XXXXXXXX" className={inputCls} />
          </Field>

          <Field icon={<ShoppingBag className="w-3 h-3" />} label="Shopify Admin API token"
            hint="Required for bulk product/metafield writes via Admin REST.">
            <input type="password" value={integrations.shopifyToken} onChange={(e) => upd("shopifyToken")(e.target.value)}
              placeholder="shpat_••••" className={inputCls} />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field icon={<Globe className="w-3 h-3" />} label="WooCommerce REST URL">
              <input value={integrations.woocommerceUrl} onChange={(e) => upd("woocommerceUrl")(e.target.value)}
                placeholder="https://store.example.com/wp-json" className={inputCls} />
            </Field>
            <Field label="WooCommerce consumer key / secret">
              <input type="password" value={integrations.woocommerceKey} onChange={(e) => upd("woocommerceKey")(e.target.value)}
                placeholder="ck_••••:cs_••••" className={inputCls} />
            </Field>
          </div>

          <Field icon={<ShoppingBag className="w-3 h-3" />} label="Etsy Open API key">
            <input type="password" value={integrations.etsyKey} onChange={(e) => upd("etsyKey")(e.target.value)}
              placeholder="••••" className={inputCls} />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field icon={<Layers className="w-3 h-3" />} label="Akeneo PIM URL">
              <input value={integrations.akeneoUrl} onChange={(e) => upd("akeneoUrl")(e.target.value)}
                placeholder="https://pim.example.com" className={inputCls} />
            </Field>
            <Field label="Akeneo API token">
              <input type="password" value={integrations.akeneoKey} onChange={(e) => upd("akeneoKey")(e.target.value)}
                placeholder="••••" className={inputCls} />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field icon={<Database className="w-3 h-3" />} label="Pimcore URL">
              <input value={integrations.pimcoreUrl} onChange={(e) => upd("pimcoreUrl")(e.target.value)}
                placeholder="https://pimcore.example.com" className={inputCls} />
            </Field>
            <Field label="Pimcore API key">
              <input type="password" value={integrations.pimcoreKey} onChange={(e) => upd("pimcoreKey")(e.target.value)}
                placeholder="••••" className={inputCls} />
            </Field>
          </div>

          <Field icon={<Webhook className="w-3 h-3" />} label="Generic webhook URL"
            hint="Send the standard epiphanAI fix payload to any HTTP endpoint (Zapier, n8n, Make, custom service).">
            <input value={integrations.genericWebhook} onChange={(e) => upd("genericWebhook")(e.target.value)}
              placeholder="https://hooks.example.com/epiphan" className={inputCls} />
          </Field>
        </section>

        <section className="border border-border rounded-lg bg-surface p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Compliance posture</div>
          <ul className="space-y-2 text-[11px] text-muted-foreground">
            <li>• Inference of client product data routed exclusively to local Ollama instance.</li>
            <li>• External API access limited to WF-06 (P5 sentiment probes, category-level only).</li>
            <li>• All writes preceded by a rollback snapshot stored in Supabase.</li>
            <li>• Audit trail retention: 90 days · Eval gate outputs: indefinitely.</li>
            <li>• GDPR data controller: Tessera · EU AI Act risk class: limited.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

const inputCls = "w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary";

function Field({ label, hint, icon, children }: { label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {icon}{label}
      </div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-1.5">{hint}</div>}
    </div>
  );
}

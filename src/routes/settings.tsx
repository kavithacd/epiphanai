import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { useState } from "react";
import { Save, Lock, Webhook, Slack as SlackIcon, ShoppingBag, Globe, Database, Layers } from "lucide-react";
import { IntegrationConfig } from "@/lib/epiphan-export";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · epiphanAI" }] }),
  component: Settings,
});

function Settings() {
  const integrations = useEpiphan((s) => s.integrations);
  const setIntegration = useEpiphan((s) => s.setIntegration);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [n8nUrl, setN8nUrl] = useState("https://n8n.tessera.internal/webhook/audit/start");
  const [saved, setSaved] = useState(false);

  const upd = <K extends keyof IntegrationConfig>(k: K) =>
    (v: IntegrationConfig[K]) => setIntegration(k, v);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Configuration</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Settings</h1>
        </header>

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

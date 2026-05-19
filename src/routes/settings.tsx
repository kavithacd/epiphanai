import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { Save, Lock } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · epiphanAI" }] }),
  component: Settings,
});

function Settings() {
  const [shopifyToken, setShopifyToken] = useState("shpat_••••••••••••••••a3f9");
  const [n8nUrl, setN8nUrl] = useState("https://n8n.tessera.internal/webhook/audit/start");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [saved, setSaved] = useState(false);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Configuration</div>
          <h1 className="text-2xl font-sans font-medium mt-1">Settings</h1>
        </header>

        <section className="border border-border rounded-lg bg-surface p-6 space-y-5">
          <Field label="Shopify Admin API token" hint="Stored encrypted in Supabase vault. Required for fix deployment."
            icon={<Lock className="w-3 h-3" />}>
            <input type="password" value={shopifyToken} onChange={(e) => setShopifyToken(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary" />
          </Field>

          <Field label="n8n webhook URL" hint="POST endpoint that triggers WF-01 Master Orchestrator.">
            <input value={n8nUrl} onChange={(e) => setN8nUrl(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary" />
          </Field>

          <Field label="Ollama endpoint" hint="Local sovereign inference. Default: http://localhost:11434">
            <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary" />
          </Field>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground">
              Connection health · <span className="text-sev-low">●</span> Ollama · <span className="text-sev-low">●</span> Supabase · <span className="text-sev-medium">●</span> n8n
            </div>
            <button
              onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs flex items-center gap-2"
            >
              <Save className="w-3 h-3" /> {saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </section>

        <section className="border border-border rounded-lg bg-surface p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Compliance posture</div>
          <ul className="space-y-2 text-[11px] text-muted-foreground">
            <li>• Inference of client product data routed exclusively to local Ollama instance.</li>
            <li>• External API access limited to WF-06 (P5 sentiment probes, category-level only).</li>
            <li>• All writes to Shopify preceded by a rollback snapshot stored in Supabase.</li>
            <li>• Audit trail retention: 90 days · Eval gate outputs: indefinitely.</li>
            <li>• GDPR data controller: Tessera Advisory · EU AI Act risk class: limited.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

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

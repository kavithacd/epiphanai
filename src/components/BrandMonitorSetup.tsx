import { useBlocker } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Radio, Save, X } from "lucide-react";
import { useEpiphan } from "@/lib/epiphan-store";

const inputCls =
  "w-full bg-background border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary";

export function BrandMonitorSetup() {
  const brandMonitorConfig = useEpiphan((s) => s.brandMonitorConfig);
  const setBrandMonitorConfig = useEpiphan((s) => s.setBrandMonitorConfig);
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const probeEngines = useEpiphan((s) => s.probeEngines);

  const savedBrandInput =
    brandMonitorConfig.brandName || brandMonitorConfig.productUrl;

  const [brandInput, setBrandInput] = useState(savedBrandInput);
  const [competitorInput, setCompetitorInput] = useState("");
  const [localCompetitors, setLocalCompetitors] = useState<string[]>(
    brandMonitorConfig.competitors,
  );
  const [brandSaved, setBrandSaved] = useState(false);

  useEffect(() => {
    setBrandInput(brandMonitorConfig.brandName || brandMonitorConfig.productUrl);
    setLocalCompetitors(brandMonitorConfig.competitors);
  }, [brandMonitorConfig]);

  const isBrandDirty =
    brandInput !== savedBrandInput ||
    localCompetitors.length !== brandMonitorConfig.competitors.length ||
    localCompetitors.some((c, i) => c !== brandMonitorConfig.competitors[i]);

  useBlocker({
    condition: isBrandDirty,
    blockerFn: () =>
      Promise.resolve(
        window.confirm(
          "You have unsaved Brand Monitoring changes. Leave this page and discard them?",
        ),
      ),
  });

  function resetBrandForm() {
    setBrandInput(savedBrandInput);
    setLocalCompetitors(brandMonitorConfig.competitors);
    setCompetitorInput("");
  }

  return (
    <section
      id="brand-monitoring"
      className="border border-border rounded-lg bg-surface p-6 space-y-5"
    >
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Radio className="w-3 h-3" /> Brand Monitoring Setup
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Define your brand and up to 5 competitors. Once saved, the Brand
          Monitoring dashboard will activate.
        </p>
      </div>

      {brandMonitorConfig.configured && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-sev-low/30 bg-sev-low/5 text-sev-low text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Brand monitoring is active for{" "}
          <span className="font-medium ml-1">
            {brandMonitorConfig.brandName || brandMonitorConfig.productUrl}
          </span>
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">
          Brand name or Product URL
        </label>
        <input
          type="text"
          value={brandInput}
          onChange={(e) => setBrandInput(e.target.value)}
          placeholder="e.g. Acme Apparel or https://acme-apparel.com"
          className={inputCls}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Competitors{" "}
            <span className="text-muted-foreground/50 normal-case">
              ({localCompetitors.length}/5)
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {localCompetitors.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background text-xs text-foreground"
            >
              {name}
              <button
                onClick={() =>
                  setLocalCompetitors((prev) => prev.filter((c) => c !== name))
                }
                className="text-muted-foreground hover:text-sev-critical transition-colors"
                aria-label={`Remove ${name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {localCompetitors.length === 0 && (
            <span className="text-[11px] text-muted-foreground/50 italic">
              No competitors added yet.
            </span>
          )}
        </div>
        {localCompetitors.length < 5 && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  competitorInput.trim() &&
                  localCompetitors.length < 5
                ) {
                  const name = competitorInput.trim();
                  if (!localCompetitors.includes(name)) {
                    setLocalCompetitors((prev) => [...prev, name]);
                  }
                  setCompetitorInput("");
                }
              }}
              placeholder="Type competitor name and press Enter…"
              className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-[11px] font-mono outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                const name = competitorInput.trim();
                if (
                  name &&
                  localCompetitors.length < 5 &&
                  !localCompetitors.includes(name)
                ) {
                  setLocalCompetitors((prev) => [...prev, name]);
                  setCompetitorInput("");
                }
              }}
              disabled={
                !competitorInput.trim() || localCompetitors.length >= 5
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border flex items-center justify-between flex-wrap gap-3">
        <div className="text-[11px] text-muted-foreground">
          Active probe queries:{" "}
          <span className="text-foreground">
            {probeQueries.filter((q) => q.enabled).length} queries ·{" "}
            {probeEngines.filter((e) => e.enabled).length} engines
          </span>
          <span className="text-muted-foreground/60"> — edit in the Probes tab</span>
        </div>
        <div className="flex items-center gap-2">
          {isBrandDirty && (
            <button
              onClick={resetBrandForm}
              className="px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => {
              const isUrl =
                brandInput.startsWith("http") || brandInput.includes(".");
              const next = {
                configured: !!brandInput.trim(),
                brandName: isUrl ? "" : brandInput.trim(),
                productUrl: isUrl ? brandInput.trim() : "",
                competitors: localCompetitors,
              };
              setBrandMonitorConfig(next);
              setBrandSaved(true);
              setTimeout(() => setBrandSaved(false), 1800);
            }}
            disabled={!brandInput.trim()}
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3 h-3" /> {brandSaved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}

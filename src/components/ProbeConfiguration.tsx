import { useState } from "react";
import { CloudCheck, Plus, Radio, Trash2 } from "lucide-react";
import { useEpiphan } from "@/lib/epiphan-store";
import { resolveProbeQuery, ProductContext } from "@/lib/epiphan-data";

export function ProbeConfiguration() {
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const addProbeQuery = useEpiphan((s) => s.addProbeQuery);
  const deleteProbeQuery = useEpiphan((s) => s.deleteProbeQuery);
  const updateProbeQuery = useEpiphan((s) => s.updateProbeQuery);
  const toggleProbeQuery = useEpiphan((s) => s.toggleProbeQuery);
  const toggleProbeEngine = useEpiphan((s) => s.toggleProbeEngine);
  const audits = useEpiphan((s) => s.audits);
  const previewCtx: ProductContext | null = audits[0]?.ctx ?? null;

  const [newQueryText, setNewQueryText] = useState("");
  const [probeSaved, setProbeSaved] = useState(false);

  function flashProbeSaved() {
    setProbeSaved(true);
    setTimeout(() => setProbeSaved(false), 2000);
  }

  const activeEngineCount = probeEngines.filter((e) => e.enabled).length;
  const enabledQueryCount = probeQueries.filter((q) => q.enabled).length;

  return (
    <section id="probe-configuration" className="border border-border rounded-lg bg-surface p-6 space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Radio className="w-3 h-3" /> Probe configuration
          </div>
          <div className={`flex items-center gap-1 text-[10px] text-sev-low transition-opacity duration-300 ${probeSaved ? "opacity-100" : "opacity-0"}`}>
            <CloudCheck className="w-3 h-3" />
            Changes auto-saved
          </div>
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
              onClick={() => { toggleProbeEngine(engine.id); flashProbeSaved(); }}
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
        <div className="flex flex-col gap-1 px-3 py-2 rounded border border-border bg-background/60 text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/60 mb-0.5">Template variables</span>
          {([
            ["{{brand}}", "audited brand name", previewCtx?.brand],
            ["{{productName}}", "inferred product title", previewCtx?.productName],
            ["{{category}}", "inferred product category", previewCtx?.category],
            ["{{industry}}", "inferred industry / vertical", previewCtx?.industry],
          ] as [string, string, string | undefined][]).map(([variable, meaning, value]) => (
            <div key={variable} className="flex items-baseline gap-2 flex-wrap">
              <code className="text-primary/80 font-mono">{variable}</code>
              <span className="text-muted-foreground/60">— {meaning}</span>
              {value && <span className="text-muted-foreground/50 italic">({value})</span>}
            </div>
          ))}
          {!previewCtx && <span className="italic text-muted-foreground/40 mt-0.5">Run an audit to see the current resolved values.</span>}
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {probeQueries.map((query, idx) => {
            const resolved = previewCtx ? resolveProbeQuery(query.text, previewCtx) : query.text;
            return (
              <div key={query.id} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground tabular-nums w-4 text-right flex-shrink-0">{idx + 1}</span>
                  <button
                    role="switch"
                    aria-checked={query.enabled}
                    onClick={() => { toggleProbeQuery(query.id); flashProbeSaved(); }}
                    title={query.enabled ? "Disable query" : "Enable query"}
                    className={`relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${query.enabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${query.enabled ? "translate-x-2.5" : "translate-x-0"}`} />
                  </button>
                  <input
                    type="text"
                    value={query.text}
                    onChange={(e) => { updateProbeQuery(query.id, e.target.value); flashProbeSaved(); }}
                    className={`flex-1 bg-background border border-border rounded px-2 py-1 text-[11px] font-mono outline-none focus:border-primary transition-opacity ${query.enabled ? "opacity-100" : "opacity-40"}`}
                  />
                  <button
                    onClick={() => { deleteProbeQuery(query.id); flashProbeSaved(); }}
                    disabled={probeQueries.length <= 1}
                    title={probeQueries.length <= 1 ? "At least one probe query required" : "Delete query"}
                    className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-sev-critical hover:bg-sev-critical/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="ml-[52px] mt-0.5 text-[10px] text-muted-foreground/60 font-mono truncate">
                  ↳ {resolved}
                </div>
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
                flashProbeSaved();
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
                flashProbeSaved();
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
  );
}

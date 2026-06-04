import { useState } from "react";
import { CloudCheck, Plus, Radio, Trash2 } from "lucide-react";
import {
  useEpiphan,
  PROBE_INTENT_META,
  type ProbeIntent,
  type ProbeQuery,
} from "@/lib/epiphan-store";
import { resolveProbeQuery, ProductContext, DEMO_CTX } from "@/lib/epiphan-data";

export function ProbeConfiguration() {
  const probeQueries = useEpiphan((s) => s.probeQueries);
  const probeEngines = useEpiphan((s) => s.probeEngines);
  const addProbeQuery = useEpiphan((s) => s.addProbeQuery);
  const deleteProbeQuery = useEpiphan((s) => s.deleteProbeQuery);
  const updateProbeQuery = useEpiphan((s) => s.updateProbeQuery);
  const toggleProbeQuery = useEpiphan((s) => s.toggleProbeQuery);
  const toggleProbeEngine = useEpiphan((s) => s.toggleProbeEngine);
  const audits = useEpiphan((s) => s.audits);
  const brandMonitorConfig = useEpiphan((s) => s.brandMonitorConfig);

  // Use the latest audit context when available, otherwise build a context from
  // the configured brand so the user always sees plain, readable questions.
  const ctx: ProductContext = audits[0]?.ctx ?? {
    ...DEMO_CTX,
    brand:
      brandMonitorConfig.brandName ||
      brandMonitorConfig.productUrl ||
      DEMO_CTX.brand,
  };

  const [newQueryText, setNewQueryText] = useState("");
  const [newQueryIntent, setNewQueryIntent] = useState<ProbeIntent>("discovery");
  const [probeSaved, setProbeSaved] = useState(false);

  function flashProbeSaved() {
    setProbeSaved(true);
    setTimeout(() => setProbeSaved(false), 2000);
  }

  const activeEngineCount = probeEngines.filter((e) => e.enabled).length;
  const enabledQueryCount = probeQueries.filter((q) => q.enabled).length;

  // Group queries by intent, preserving original order within each group.
  const grouped = PROBE_INTENT_META.map((meta) => ({
    meta,
    queries: probeQueries.filter((q) => q.intent === meta.id),
  }));

  // Catch-all bucket for any legacy queries with an unknown intent.
  const knownIntents = new Set(PROBE_INTENT_META.map((m) => m.id));
  const orphans = probeQueries.filter((q) => !knownIntents.has(q.intent));

  return (
    <section
      id="probe-configuration"
      className="border border-border rounded-lg bg-surface p-6 space-y-5"
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Radio className="w-3 h-3" /> Probe configuration
          </div>
          <div
            className={`flex items-center gap-1 text-[10px] text-sev-low transition-opacity duration-300 ${
              probeSaved ? "opacity-100" : "opacity-0"
            }`}
          >
            <CloudCheck className="w-3 h-3" />
            Changes auto-saved
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Questions are grouped by search intent — the same buckets real shoppers
          use when prompting AI assistants. Changes apply to the next audit you run.
        </p>
      </div>

      {/* Engine toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Probe engines
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {activeEngineCount} of {probeEngines.length} active
          </div>
        </div>
        {probeEngines.map((engine) => (
          <div
            key={engine.id}
            className="flex items-center justify-between px-3 py-2.5 border border-border rounded bg-background"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  engine.enabled ? "bg-sev-low" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-xs font-medium text-foreground">{engine.label}</span>
            </div>
            <button
              role="switch"
              aria-checked={engine.enabled}
              onClick={() => {
                toggleProbeEngine(engine.id);
                flashProbeSaved();
              }}
              className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                engine.enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ${
                  engine.enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Probe queries grouped by intent */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Probe questions by intent
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {enabledQueryCount} of {probeQueries.length} active
          </div>
        </div>

        {grouped.map(({ meta, queries }) => (
          <IntentGroup
            key={meta.id}
            label={meta.label}
            bucket={meta.bucket}
            description={meta.description}
            queries={queries}
            ctx={ctx}
            disableDelete={probeQueries.length <= 1}
            onToggle={(id) => {
              toggleProbeQuery(id);
              flashProbeSaved();
            }}
            onChange={(id, text) => {
              updateProbeQuery(id, text);
              flashProbeSaved();
            }}
            onDelete={(id) => {
              deleteProbeQuery(id);
              flashProbeSaved();
            }}
          />
        ))}

        {orphans.length > 0 && (
          <IntentGroup
            label="Other"
            bucket="Informational"
            description="Custom questions without an assigned intent."
            queries={orphans}
            ctx={ctx}
            disableDelete={probeQueries.length <= 1}
            onToggle={(id) => {
              toggleProbeQuery(id);
              flashProbeSaved();
            }}
            onChange={(id, text) => {
              updateProbeQuery(id, text);
              flashProbeSaved();
            }}
            onDelete={(id) => {
              deleteProbeQuery(id);
              flashProbeSaved();
            }}
          />
        )}

        {/* Add new probe */}
        <div className="pt-2 border-t border-border space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Add a question
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newQueryIntent}
              onChange={(e) => setNewQueryIntent(e.target.value as ProbeIntent)}
              className="bg-background border border-border rounded px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary cursor-pointer"
            >
              {PROBE_INTENT_META.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.bucket} · {m.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newQueryText}
              onChange={(e) => setNewQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newQueryText.trim()) {
                  addProbeQuery(newQueryText.trim(), newQueryIntent);
                  setNewQueryText("");
                  flashProbeSaved();
                }
              }}
              placeholder="e.g. What's the best gift under €100 from this brand?"
              className="flex-1 min-w-[200px] bg-background border border-border rounded px-3 py-1.5 text-[11px] outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (newQueryText.trim()) {
                  addProbeQuery(newQueryText.trim(), newQueryIntent);
                  setNewQueryText("");
                  flashProbeSaved();
                }
              }}
              disabled={!newQueryText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntentGroup({
  label,
  bucket,
  description,
  queries,
  ctx,
  disableDelete,
  onToggle,
  onChange,
  onDelete,
}: {
  label: string;
  bucket: string;
  description: string;
  queries: ProbeQuery[];
  ctx: ProductContext;
  disableDelete: boolean;
  onToggle: (id: string) => void;
  onChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const enabled = queries.filter((q) => q.enabled).length;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-foreground/80">
            {label}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">
            · {bucket}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {enabled}/{queries.length}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/70 -mt-1">{description}</p>

      {queries.length === 0 ? (
        <div className="text-[10px] text-muted-foreground/50 italic px-3 py-2 border border-dashed border-border rounded bg-background/40">
          No questions in this intent yet — add one below.
        </div>
      ) : (
        <div className="space-y-1.5">
          {queries.map((query) => {
            const resolved = resolveProbeQuery(query.text, ctx);
            return (
              <div key={query.id} className="group flex items-center gap-2">
                <button
                  role="switch"
                  aria-checked={query.enabled}
                  onClick={() => onToggle(query.id)}
                  title={query.enabled ? "Disable question" : "Enable question"}
                  className={`relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    query.enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ${
                      query.enabled ? "translate-x-2.5" : "translate-x-0"
                    }`}
                  />
                </button>
                <input
                  type="text"
                  value={resolved}
                  onChange={(e) => onChange(query.id, e.target.value)}
                  className={`flex-1 bg-background border border-border rounded px-2 py-1 text-[11px] outline-none focus:border-primary transition-opacity ${
                    query.enabled ? "opacity-100" : "opacity-40"
                  }`}
                />
                <button
                  onClick={() => onDelete(query.id)}
                  disabled={disableDelete}
                  title={
                    disableDelete
                      ? "At least one probe question required"
                      : "Delete question"
                  }
                  className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-sev-critical hover:bg-sev-critical/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

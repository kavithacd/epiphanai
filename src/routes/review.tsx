import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useEpiphan } from "@/lib/epiphan-store";
import { Failure, describeFix } from "@/lib/epiphan-data";
import { PillarBadge, SeverityBadge } from "@/components/PillarRing";
import { DiffPane } from "@/components/DiffPane";
import { FixStatusPill } from "@/components/StatusPills";
import {
  Check, X, Pencil, ChevronRight, Sparkles, Wand2, Download, FileJson,
  FileText, Copy, Send, ChevronDown,
} from "lucide-react";
import {
  toCsv, toJson, downloadFile, copyToClipboard, toWebhookPayload,
  PLATFORM_LABEL, PlatformId, isPlatformConfigured,
} from "@/lib/epiphan-export";
import { toast } from "sonner";


export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Review Queue · epiphanAI" }] }),
  component: ReviewQueue,
});

function ReviewQueue() {
  const { audits, approveFix, rejectFix, editFix, bulkApprove, pushToPlatform, integrations } = useEpiphan();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushOpen, setPushOpen] = useState(false);

  const items = useMemo(() =>
    audits.flatMap((a) => a.failures.filter((f) => f.status === "review_pending")
      .map((f) => ({ ...f, storeName: a.storeName }))),
    [audits]);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const nonCritical = items.filter((i) => i.severity !== "CRITICAL");

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(items.map((i) => i.id)));
  const selectNonCritical = () => setSelected(new Set(nonCritical.map((i) => i.id)));
  const clearSel = () => setSelected(new Set());

  const exportCsv = () => {
    const target = selectedItems.length ? selectedItems : items;
    downloadFile(`epiphan-fixes-${Date.now()}.csv`, "text/csv", toCsv(target));
    toast.success("CSV downloaded", { description: `${target.length} fix${target.length === 1 ? "" : "es"} exported.` });
  };
  const exportJson = () => {
    const target = selectedItems.length ? selectedItems : items;
    downloadFile(`epiphan-fixes-${Date.now()}.json`, "application/json", toJson(target));
    toast.success("JSON downloaded", { description: `${target.length} fix${target.length === 1 ? "" : "es"} exported.` });
  };
  const copyWebhook = async () => {
    const target = selectedItems.length ? selectedItems : items;
    await copyToClipboard(JSON.stringify(toWebhookPayload(target), null, 2));
    toast.success("Webhook payload copied", { description: "Standard epiphanAI envelope on your clipboard." });
  };
  const applyBulk = () => {
    if (selectedItems.length === 0) return;
    bulkApprove(selectedItems.map((i) => i.id));
    clearSel();
  };
  const push = (platform: PlatformId) => {
    const target = selectedItems.length ? selectedItems : items;
    pushToPlatform(target.map((i) => i.id), platform);
    setPushOpen(false);
  };

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto p-8 space-y-6">
        <header>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Review Queue</div>
          <h1 className="text-2xl font-sans font-medium mt-1">
            Manual review · {items.length} fix{items.length === 1 ? "" : "es"} awaiting approval
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Only fixes that require human judgement (P3 copy, P4 alt-text, brand-sensitive content) appear here. Auto-approved fixes deploy directly and live in <a className="text-primary hover:underline" href="/history">Audit History</a>.
          </p>
        </header>

        {/* Bulk action bar */}
        <div className="border border-border rounded-lg bg-surface p-3 flex flex-wrap items-center gap-2">
          <button onClick={selectAll}
            className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:bg-accent/30">
            Select all ({items.length})
          </button>
          <button onClick={selectNonCritical}
            className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:bg-accent/30">
            Select non-critical ({nonCritical.length})
          </button>
          {selected.size > 0 && (
            <button onClick={clearSel}
              className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:bg-accent/30 text-muted-foreground">
              Clear
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={applyBulk} disabled={selected.size === 0}
              className="text-[11px] px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed font-medium flex items-center gap-1.5">
              <Check className="w-3 h-3" /> Apply All ({selected.size})
            </button>
            <div className="h-5 w-px bg-border" />
            <button onClick={exportCsv}
              className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:bg-accent/30 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> CSV
            </button>
            <button onClick={exportJson}
              className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:bg-accent/30 flex items-center gap-1.5">
              <FileJson className="w-3 h-3" /> JSON
            </button>
            <button onClick={copyWebhook}
              className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:bg-accent/30 flex items-center gap-1.5">
              <Copy className="w-3 h-3" /> Webhook JSON
            </button>
            <div className="relative">
              <button onClick={() => setPushOpen((o) => !o)}
                className="text-[11px] px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5">
                <Send className="w-3 h-3" /> Push to platform <ChevronDown className="w-3 h-3" />
              </button>
              {pushOpen && (
                <div className="absolute right-0 mt-1 w-64 border border-border rounded-md bg-card shadow-lg z-10 overflow-hidden">
                  {(Object.keys(PLATFORM_LABEL) as PlatformId[])
                    .filter((p) => p !== "slack")
                    .map((p) => {
                      const ok = isPlatformConfigured(p, integrations);
                      return (
                        <button key={p} onClick={() => push(p)}
                          className="w-full text-left px-3 py-2 text-[11px] hover:bg-accent/30 flex items-center justify-between">
                          <span className="text-foreground">{PLATFORM_LABEL[p]}</span>
                          <span className={`text-[9px] uppercase tracking-widest ${ok ? "text-sev-low" : "text-muted-foreground"}`}>
                            {ok ? "● live" : "○ simulated"}
                          </span>
                        </button>
                      );
                    })}
                  <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                    Configure credentials in <a href="/settings" className="text-primary hover:underline">Settings → Integrations</a>.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg bg-surface overflow-hidden">
          {items.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground text-xs">
              No fixes awaiting review. Run an audit from the Audit Engine.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((f) => {
                const open = expandedId === f.id;
                const checked = selected.has(f.id);
                return (
                  <div key={f.id}>
                    <div className={`grid grid-cols-[28px_60px_1fr_90px_140px_140px_24px] gap-3 px-5 py-3 items-center ${checked ? "bg-primary/5" : "hover:bg-accent/20"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(f.id)}
                        className="accent-primary" onClick={(e) => e.stopPropagation()} />
                      <PillarBadge pillar={f.pillar} />
                      <button onClick={() => { setExpandedId(open ? null : f.id); setEditMode(false); setDraft(f.fix?.after ?? ""); }}
                        className="text-left min-w-0">
                        <div className="text-xs text-foreground truncate">{f.failureName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{f.storeName} · {f.failureId}</div>
                      </button>
                      <SeverityBadge severity={f.severity} />
                      <div className="text-[10px] text-muted-foreground truncate">{f.fix?.generatedBy ?? "—"}</div>
                      <FixStatusPill status={f.status} />
                      <button onClick={() => { setExpandedId(open ? null : f.id); setEditMode(false); setDraft(f.fix?.after ?? ""); }}>
                        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition ${open ? "rotate-90" : ""}`} />
                      </button>
                    </div>

                    {open && f.fix && (() => {
                      const d = describeFix(f);
                      return (
                      <div className="bg-background border-t border-border p-5 space-y-4">
                        <div className="border border-primary/30 bg-primary/5 rounded p-3 flex gap-3 items-start">
                          <Wand2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs text-primary font-medium">{d.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{d.detail}</div>
                          </div>
                        </div>

                        <EvalStrip fix={f.fix} />

                        {editMode ? (
                          <div className="grid md:grid-cols-2 gap-2">
                            <Pane label="CURRENT STATE">
                              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground p-3">{f.fix.before}</pre>
                            </Pane>
                            <Pane label="YOUR EDIT">
                              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                                className="w-full bg-transparent outline-none text-[11px] leading-relaxed text-foreground min-h-[220px] font-mono resize-y p-3" />
                            </Pane>
                          </div>
                        ) : (
                          <DiffPane before={f.fix.before} after={f.fix.after} pillar={f.pillar} maxHeight={280} />
                        )}

                        {f.status === "review_pending" && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-primary" />
                              {editMode ? "Editing the proposed fix. Save your edit, then approve to merge." : "Approving deploys this fix and updates the Live Store Preview."}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {editMode ? (
                                <>
                                  <button onClick={() => { editFix(f.id, draft); setEditMode(false); }}
                                    className="px-3 py-1.5 rounded border border-primary/50 text-primary hover:bg-primary/10 text-[11px] flex items-center gap-1.5">
                                    <Check className="w-3 h-3" /> Save edit
                                  </button>
                                  <button onClick={() => { editFix(f.id, draft); approveFix(f.id); setEditMode(false); }}
                                    className="px-3 py-1.5 rounded bg-sev-low text-background text-[11px] flex items-center gap-1.5 font-medium">
                                    <Check className="w-3 h-3" /> Save & Approve
                                  </button>
                                  <button onClick={() => { setEditMode(false); setDraft(f.fix?.after ?? ""); }}
                                    className="px-3 py-1.5 rounded border border-border text-[11px]">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => approveFix(f.id)}
                                    className="px-3 py-1.5 rounded bg-sev-low text-background text-[11px] flex items-center gap-1.5 font-medium">
                                    <Check className="w-3 h-3" /> Approve & Deploy
                                  </button>
                                  <button onClick={() => { setDraft(f.fix?.after ?? ""); setEditMode(true); }}
                                    className="px-3 py-1.5 rounded border border-sev-medium/50 text-sev-medium hover:bg-sev-medium/10 text-[11px] flex items-center gap-1.5">
                                    <Pencil className="w-3 h-3" /> Edit
                                  </button>
                                  <button onClick={async () => { await copyToClipboard(JSON.stringify(toWebhookPayload([f]), null, 2)); toast.success("Payload copied"); }}
                                    className="px-3 py-1.5 rounded border border-border text-[11px] flex items-center gap-1.5">
                                    <Copy className="w-3 h-3" /> Copy payload
                                  </button>
                                  <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                    className="text-[11px] bg-background border border-border rounded px-2 py-1.5 outline-none">
                                    <option value="">Reason…</option>
                                    <option>Factually wrong</option>
                                    <option>Off-brand</option>
                                    <option>Not needed</option>
                                  </select>
                                  <button disabled={!rejectReason}
                                    onClick={() => { rejectFix(f.id, rejectReason); setRejectReason(""); }}
                                    className="px-3 py-1.5 rounded border border-sev-critical/50 text-sev-critical hover:bg-sev-critical/10 text-[11px] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                                    <X className="w-3 h-3" /> Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EvalStrip({ fix }: { fix: NonNullable<Failure["fix"]> }) {
  const t = useEpiphan((s) => s.evalThresholds);
  const items: { label: string; value: string; pass: boolean; threshold?: number }[] = [
    { label: "Fact Preservation", value: `${fix.evalScores.factPreservation}%`, pass: fix.evalScores.factPreservation >= t.factPreservation, threshold: t.factPreservation },
    { label: "Semantic Density",  value: `${fix.evalScores.semanticDensity}%`,  pass: fix.evalScores.semanticDensity  >= t.semanticDensity,  threshold: t.semanticDensity  },
    { label: "Structural Syntax", value: `${fix.evalScores.structuralSyntax}%`, pass: fix.evalScores.structuralSyntax >= t.structuralSyntax, threshold: t.structuralSyntax },
    { label: "Object Accuracy",   value: `${fix.evalScores.objectAccuracy}%`,   pass: fix.evalScores.objectAccuracy   >= t.objectAccuracy,   threshold: t.objectAccuracy   },
    { label: "Judge Verdict", value: fix.evalScores.overall, pass: fix.evalScores.overall === "PASS" },
  ];
  return (
    <div className="grid grid-cols-5 gap-px bg-border rounded overflow-hidden border border-border">
      {items.map((i) => (
        <div key={i.label} className="bg-background px-3 py-2.5">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{i.label}</div>
          <div className={`text-sm tabular-nums font-medium mt-0.5 ${i.pass ? "text-sev-low" : "text-sev-critical"}`}>
            {i.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-muted-foreground border-b border-border bg-background/40">{label}</div>
      <div className="max-h-[280px] overflow-auto">{children}</div>
    </div>
  );
}

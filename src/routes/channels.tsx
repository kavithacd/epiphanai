import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { seoMeta } from "@/lib/branding";
import { useChannels } from "@/lib/channel-store";
import {
  CHANNELS, CHANNEL_BY_ID, ChannelId, SEGMENT_META, SegmentLabel,
  buildFeed, downloadText, buildTitle, TOKEN_LABEL, TitleToken,
} from "@/lib/channels";
import { toast } from "sonner";
import {
  Upload, Wand2, Download, Store, ShoppingBag, Globe, AlertTriangle,
  CheckCircle2, ChevronRight, Trash2, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/channels")({
  head: () => ({
    meta: seoMeta(
      "Channel Readiness",
      "Prepare one product catalog for Amazon EU, Zalando, Otto, Google CSS, Shopify and WooCommerce.",
    ),
  }),
  component: ChannelsPage,
});

type Tab = "catalog" | "readiness" | "optimizer" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "catalog", label: "Catalog" },
  { id: "readiness", label: "Readiness" },
  { id: "optimizer", label: "Optimizer" },
  { id: "export", label: "Export" },
];

const GROUP_ICON = { marketplace: ShoppingBag, ads: Globe, storefront: Store } as const;

function ChannelsPage() {
  const [tab, setTab] = useState<Tab>("catalog");
  const products = useChannels((s) => s.products);

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">EU launch preparation</div>
          <h1 className="text-xl font-sans font-medium">Channel Readiness</h1>
          <p className="text-sm text-muted-foreground">
            One catalog, validated and fixed for every European channel you sell on.
          </p>
        </header>

        <ChannelPicker />

        <nav className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs border-b-2 -mb-px transition ${
                tab === t.id
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.id === "catalog" && products.length > 0 && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">{products.length}</span>
              )}
            </button>
          ))}
        </nav>

        {tab === "catalog" && <CatalogTab />}
        {tab === "readiness" && <ReadinessTab />}
        {tab === "optimizer" && <OptimizerTab />}
        {tab === "export" && <ExportTab />}
      </div>
    </AppShell>
  );
}

function ChannelPicker() {
  const selected = useChannels((s) => s.selected);
  const toggle = useChannels((s) => s.toggleChannel);
  return (
    <div className="flex flex-wrap gap-2">
      {CHANNELS.map((c) => {
        const Icon = GROUP_ICON[c.group];
        const on = selected.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            title={c.blurb}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition ${
              on
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
      {hint}
    </div>
  );
}

// ───────────────────────────── Catalog ─────────────────────────────

function CatalogTab() {
  const { products, importCsv, loadSample, clear } = useChannels();
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const text = await file.text();
    const n = importCsv(text);
    setBusy(false);
    e.target.value = "";
    n ? toast.success(`Imported ${n} products`) : toast.error("No rows found in that file");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="px-3 py-2 rounded border border-border text-xs inline-flex items-center gap-2 cursor-pointer hover:bg-accent/30">
          <Upload className="w-3.5 h-3.5" />
          {busy ? "Reading…" : "Import CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <button
          onClick={() => toast.success(`Loaded ${loadSample()} sample products`)}
          className="px-3 py-2 rounded border border-border text-xs inline-flex items-center gap-2 hover:bg-accent/30"
        >
          <Sparkles className="w-3.5 h-3.5" /> Load sample catalog
        </button>
        {products.length > 0 && (
          <button
            onClick={() => { clear(); toast.success("Catalog cleared"); }}
            className="px-3 py-2 rounded border border-border text-xs inline-flex items-center gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Accepted columns: sku, title, description, brand, ean/gtin, price, color, material, size, gender, type, images.
      </p>

      {products.length === 0 ? (
        <Empty hint="No products yet. Import a CSV export from your shop or PIM, or load the sample catalog." />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">SKU</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">EAN</th>
                <th className="text-left px-3 py-2 font-medium">Price</th>
                <th className="text-left px-3 py-2 font-medium">Colour</th>
                <th className="text-left px-3 py-2 font-medium">Material</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{p.sku}</td>
                  <td className="px-3 py-2">{p.title || <span className="text-destructive">—</span>}</td>
                  <td className="px-3 py-2 font-mono">{p.gtin || <span className="text-destructive">missing</span>}</td>
                  <td className="px-3 py-2">{p.price ? `€${p.price.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2">{p.color || "—"}</td>
                  <td className="px-3 py-2">{p.material || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Readiness ─────────────────────────────

function ReadinessTab() {
  const products = useChannels((s) => s.products);
  const selected = useChannels((s) => s.selected);
  const reports = useChannels((s) => s.reports)();
  const fixAll = useChannels((s) => s.fixAll);
  const fixOne = useChannels((s) => s.fixOne);
  const [open, setOpen] = useState<string | null>(null);

  const segments = useMemo(() => {
    const acc: Record<SegmentLabel, number> = { hero: 0, sidekick: 0, zombie: 0, villain: 0 };
    reports.forEach((r) => acc[r.label]++);
    return acc;
  }, [reports]);

  const perChannel = useMemo(
    () =>
      selected.map((c) => {
        const scores = reports.map((r) => r.byChannel[c]?.score ?? 100);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const blocked = reports.filter((r) => (r.byChannel[c]?.issues ?? []).some((i) => i.severity === "critical")).length;
        return { channel: c, avg, blocked };
      }),
    [reports, selected],
  );

  if (!products.length) return <Empty hint="Import a catalog first to see channel readiness." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(SEGMENT_META) as SegmentLabel[]).map((k) => (
          <div key={k} className="border border-border rounded-lg p-4 bg-surface">
            <div className={`text-2xl font-sans ${SEGMENT_META[k].tone}`}>{segments[k]}</div>
            <div className="text-xs font-medium mt-1">{SEGMENT_META[k].name}</div>
            <div className="text-[11px] text-muted-foreground">{SEGMENT_META[k].hint}</div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {perChannel.map(({ channel, avg, blocked }) => (
          <div key={channel} className="flex items-center gap-4 px-4 py-3">
            <div className="w-40 text-xs font-medium">{CHANNEL_BY_ID[channel].name}</div>
            <div className="flex-1 h-1.5 rounded bg-accent/40 overflow-hidden">
              <div
                className={`h-full ${avg >= 90 ? "bg-p2" : avg >= 70 ? "bg-primary" : "bg-destructive"}`}
                style={{ width: `${avg}%` }}
              />
            </div>
            <div className="w-12 text-right text-xs tabular-nums">{avg}%</div>
            <div className="w-32 text-right text-[11px] text-muted-foreground">
              {blocked ? `${blocked} blocked` : "all clear"}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">{reports.length} products checked across {selected.length} channels</div>
        <button
          onClick={() => {
            const n = fixAll();
            n ? toast.success(`Auto-fixed ${n} products`) : toast.info("Nothing left to auto-fix");
          }}
          className="px-3 py-2 rounded bg-primary text-primary-foreground text-xs inline-flex items-center gap-2 hover:opacity-90"
        >
          <Wand2 className="w-3.5 h-3.5" /> Auto-fix everything
        </button>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {reports.map((r) => (
          <div key={r.product.id}>
            <button
              onClick={() => setOpen(open === r.product.id ? null : r.product.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/20"
            >
              <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition ${open === r.product.id ? "rotate-90" : ""}`} />
              <span className="font-mono text-[11px] text-muted-foreground w-24">{r.product.sku}</span>
              <span className="flex-1 text-xs truncate">{r.product.title || "Untitled product"}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border border-border ${SEGMENT_META[r.label].tone}`}>
                {SEGMENT_META[r.label].name.replace(/s$/, "")}
              </span>
              <span className="text-xs tabular-nums w-10 text-right">{r.score}%</span>
            </button>
            {open === r.product.id && (
              <div className="px-12 pb-4 space-y-2">
                {r.issues.length === 0 ? (
                  <div className="text-xs text-p2 inline-flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready to publish on every selected channel.
                  </div>
                ) : (
                  <>
                    {r.issues.map((i, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 mt-0.5 ${i.severity === "critical" ? "text-destructive" : "text-p4"}`}
                        />
                        <div>
                          <span className="text-muted-foreground">{CHANNEL_BY_ID[i.channel].name} · </span>
                          {i.message}
                          {i.autoFixable && <span className="ml-2 text-[10px] text-primary">auto-fixable</span>}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const applied = fixOne(r.product.id);
                        applied.length
                          ? toast.success(applied.join(" · "))
                          : toast.info("Remaining issues need your data (EAN, GPSR, packaging ID).");
                      }}
                      className="mt-2 px-3 py-1.5 rounded border border-primary/40 text-primary text-[11px] inline-flex items-center gap-1.5 hover:bg-primary/10"
                    >
                      <Wand2 className="w-3 h-3" /> Auto-fix this product
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── Optimizer ─────────────────────────────

function OptimizerTab() {
  const products = useChannels((s) => s.products);
  const selected = useChannels((s) => s.selected);
  const updateProduct = useChannels((s) => s.updateProduct);
  const [channel, setChannel] = useState<ChannelId>(selected[0] ?? "amazon-eu");
  const spec = CHANNEL_BY_ID[channel];
  const [formula, setFormula] = useState<string[]>(spec.titleFormula);

  function pickChannel(c: ChannelId) {
    setChannel(c);
    setFormula(CHANNEL_BY_ID[c].titleFormula);
  }

  function toggleToken(t: TitleToken) {
    setFormula((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));
  }

  if (!products.length) return <Empty hint="Import a catalog first to optimise titles." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {selected.map((c) => (
          <button
            key={c}
            onClick={() => pickChannel(c)}
            className={`px-3 py-1.5 rounded border text-xs ${
              channel === c ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {CHANNEL_BY_ID[c].name}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-lg p-4 space-y-3 bg-surface">
        <div className="text-xs font-medium">Title formula · {spec.name} · max {spec.titleLimit} characters</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TOKEN_LABEL) as TitleToken[]).map((t) => (
            <button
              key={t}
              onClick={() => toggleToken(t)}
              className={`px-2.5 py-1 rounded text-[11px] border ${
                formula.includes(t) ? "border-primary/50 bg-primary/10" : "border-border text-muted-foreground"
              }`}
            >
              {TOKEN_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {formula.length ? formula.map((t) => `[${TOKEN_LABEL[t as TitleToken]}]`).join(" + ") : "Pick at least one field"}
        </div>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {products.map((p) => {
          const next = buildTitle(p, formula, spec.titleLimit);
          const changed = next && next !== p.title;
          return (
            <div key={p.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted-foreground w-24">{p.sku}</span>
                <span className="flex-1 text-xs text-muted-foreground line-through truncate">{p.title || "—"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24" />
                <span className="flex-1 text-xs truncate">{next || <span className="text-muted-foreground">not enough data</span>}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{next.length}/{spec.titleLimit}</span>
                <button
                  disabled={!changed}
                  onClick={() => { updateProduct(p.id, { title: next }); toast.success("Title applied"); }}
                  className="px-2.5 py-1 rounded border border-border text-[11px] disabled:opacity-40 hover:bg-accent/30"
                >
                  Apply
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────── Export ─────────────────────────────

function ExportTab() {
  const products = useChannels((s) => s.products);
  const selected = useChannels((s) => s.selected);
  const reports = useChannels((s) => s.reports)();

  if (!products.length) return <Empty hint="Import a catalog first to generate channel feeds." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Feeds are generated in each channel's native format. Products still blocked are included but flagged.
      </p>
      {selected.map((c) => {
        const blocked = reports.filter((r) => (r.byChannel[c]?.issues ?? []).some((i) => i.severity === "critical")).length;
        const ready = products.length - blocked;
        return (
          <div key={c} className="border border-border rounded-lg px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs font-medium">{CHANNEL_BY_ID[c].name}</div>
              <div className="text-[11px] text-muted-foreground">{CHANNEL_BY_ID[c].blurb}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">{ready} ready · {blocked} blocked</div>
            <button
              onClick={() => {
                const f = buildFeed(c, products);
                downloadText(f.filename, f.mime, f.content);
                toast.success(`${f.filename} downloaded`);
              }}
              className="px-3 py-1.5 rounded border border-border text-xs inline-flex items-center gap-1.5 hover:bg-accent/30"
            >
              <Download className="w-3.5 h-3.5" /> Feed
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEpiphan } from "@/lib/epiphan-store";
import {
  ArrowRight, ArrowLeft, Sparkles, Store, ShoppingBag, Globe, Plug, Play,
  CheckCircle2, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/start")({
  head: () => ({ meta: [{ title: "Start an audit · epiphanAI" }] }),
  component: StartFlow,
});

type Mode = "brand" | "marketplace";
type Source = "website" | "shopify" | "etsy" | "woocommerce";

// Lightweight industry inference from URL — purely cosmetic for the wizard.
// Real product would route through the P0 classifier; we mirror the shape.
function inferIndustry(rawUrl: string): { industry: string; taxonomy: string[]; note: string } {
  const u = rawUrl.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => u.includes(k));
  if (has("nike", "adidas", "puma", "asics", "newbalance"))
    return {
      industry: "Athletic Footwear & Apparel",
      taxonomy: ["Footwear / Running", "Footwear / Lifestyle", "Apparel / Performance", "Apparel / Lifestyle", "Accessories"],
      note: "Detected multi-category athletic retailer. Suggested split: Performance vs Lifestyle to improve AI-routing precision.",
    };
  if (has("zara", "hm", "uniqlo", "mango", "cos"))
    return {
      industry: "Fast Fashion / Apparel",
      taxonomy: ["Women / Tops", "Women / Bottoms", "Men / Tops", "Men / Bottoms", "Kids", "Accessories"],
      note: "Detected high-velocity apparel SKU base. AI agents need gender-first taxonomy with sub-category breadcrumbs.",
    };
  if (has("sephora", "ulta", "loreal", "douglas"))
    return {
      industry: "Beauty & Personal Care",
      taxonomy: ["Skincare", "Makeup", "Fragrance", "Haircare", "Tools"],
      note: "Beauty marketplaces benefit from concern-based facets (anti-aging, hydration) layered on category taxonomy.",
    };
  if (has("merino", "wool", "knit", "apparel", "shopify"))
    return {
      industry: "Premium Apparel (Single Brand)",
      taxonomy: ["Knitwear", "Outerwear", "Accessories"],
      note: "Single-brand merchandiser. Taxonomy can stay shallow; depth comes from product-attribute schema.",
    };
  return {
    industry: "General E-commerce",
    taxonomy: ["Featured", "Categories", "Collections", "Sale"],
    note: "Industry not inferred from domain — taxonomy suggestions will be regenerated after the crawl.",
  };
}

function StartFlow() {
  const navigate = useNavigate();
  const startAudit = useEpiphan((s) => s.startAudit);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<Mode | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inference = useMemo(() => (url.trim() ? inferIndustry(url) : null), [url]);

  function chooseMode(m: Mode) {
    setMode(m);
    // Marketplaces always work via website URL; brands pick a source.
    setSource(m === "marketplace" ? "website" : null);
    setStep(2);
  }

  function chooseSource(s: Source) {
    setSource(s);
    setStep(3);
  }

  function launch() {
    if (!url.trim()) return;
    setSubmitting(true);
    const target = url.startsWith("http") ? url : `https://${url}`;
    startAudit(target);
    setTimeout(() => navigate({ to: "/dashboard" }), 700);
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="font-semibold tracking-tight">epiphanAI</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-widest border-l border-border pl-2 ml-1">Tessera</div>
          </Link>
          <Link to="/dashboard" className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest">
            Skip wizard →
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-10 text-[10px] uppercase tracking-widest text-muted-foreground">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 grid place-items-center rounded-full border ${
                step >= n ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
              }`}>
                {step > n ? <CheckCircle2 className="w-3 h-3" /> : n}
              </div>
              {n < 3 && <div className={`w-12 h-px ${step > n ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
          <div className="ml-3">
            {step === 1 && "Who are you?"}
            {step === 2 && "Source"}
            {step === 3 && "Confirm & launch"}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-3xl font-sans font-medium mb-2">Are you auditing a brand or a marketplace?</h1>
              <p className="text-muted-foreground text-sm mb-8">
                We use this to pick the right taxonomy strategy and the right pillar weights — single-brand DTC audits and multi-category marketplaces score very differently.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <ModeCard
                  icon={<Store className="w-5 h-5" />}
                  title="Brand"
                  body="One brand, one catalog. We'll infer your industry and check that AI agents can route around your product line cleanly."
                  examples="Acme Apparel · Allbirds · Glossier"
                  onClick={() => chooseMode("brand")}
                />
                <ModeCard
                  icon={<ShoppingBag className="w-5 h-5" />}
                  title="Marketplace"
                  body="Multi-category retailer. We crawl breadcrumbs, detect taxonomy inefficiencies, and propose a structure that AI agents disambiguate better."
                  examples="Nike · Sephora · MediaMarkt"
                  onClick={() => chooseMode("marketplace")}
                />
              </div>
            </motion.div>
          )}

          {step === 2 && mode === "brand" && (
            <motion.div key="s2b" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-3xl font-sans font-medium mb-2">Where does your catalog live?</h1>
              <p className="text-muted-foreground text-sm mb-8">
                Pick the source. You can connect a real platform now (write-back enabled), or run a read-only audit from a public URL.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <SourceCard icon={<Globe />} title="Own website" body="Public site or headless. Read-only audit." onClick={() => chooseSource("website")} />
                <SourceCard icon={<Plug />} title="Shopify" body="Connect store for live write-back of fixes." onClick={() => chooseSource("shopify")} />
                <SourceCard icon={<Plug />} title="Etsy" body="Connect shop via API key." onClick={() => chooseSource("etsy")} />
              </div>
              <BackButton onClick={() => setStep(1)} />
            </motion.div>
          )}

          {step === 2 && mode === "marketplace" && (
            <motion.div key="s2m" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-3xl font-sans font-medium mb-2">Marketplace audit</h1>
              <p className="text-muted-foreground text-sm mb-8">
                We'll crawl your top-level category tree and surface taxonomy inefficiencies — duplicated facets, ambiguous breadcrumbs, and category bloat that confuses AI agents.
              </p>
              <button onClick={() => setStep(3)} className="px-5 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
              <BackButton onClick={() => setStep(1)} />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-3xl font-sans font-medium mb-2">
                {source === "shopify" || source === "etsy" ? "Paste your store URL" : "Enter your URL"}
              </h1>
              <p className="text-muted-foreground text-sm mb-6">
                {mode === "marketplace"
                  ? "Any category, sub-category, or homepage URL works. We'll infer the rest."
                  : "Brand homepage, product page, or a single SKU — anything that resolves to your catalog."}
              </p>

              <div className="border border-border rounded-lg bg-surface p-4">
                <div className="flex items-center bg-background border border-border rounded px-3">
                  <input
                    autoFocus
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={mode === "marketplace" ? "nike.com  ·  adidas.com/yeezy-boost" : "acme.eu  ·  acme.myshopify.com  ·  SKU-12345"}
                    className="flex-1 bg-transparent outline-none py-2.5 text-sm font-mono placeholder:text-muted-foreground/60"
                  />
                </div>

                {inference && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 border border-border rounded p-4 bg-background/40">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Inferred · industry & proposed taxonomy
                    </div>
                    <div className="text-sm text-foreground mt-2 font-medium">{inference.industry}</div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {inference.taxonomy.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/5">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">{inference.note}</p>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={launch}
                  disabled={!url.trim() || submitting}
                  className="px-5 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Launching…</>) : (<><Play className="w-4 h-4" /> Start audit</>)}
                </button>
                <div className="text-[10px] text-muted-foreground">
                  {mode === "brand" ? `Brand · via ${source ?? "website"}` : "Marketplace audit"}
                </div>
              </div>
              <BackButton onClick={() => setStep(2)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ModeCard({ icon, title, body, examples, onClick }: { icon: React.ReactNode; title: string; body: string; examples: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-left border border-border rounded-lg bg-surface p-5 hover:border-primary hover:bg-surface-elevated transition group">
      <div className="w-9 h-9 rounded border border-border bg-background grid place-items-center text-primary mb-4 group-hover:border-primary/60">
        {icon}
      </div>
      <div className="text-foreground font-medium">{title}</div>
      <p className="text-muted-foreground text-xs leading-relaxed mt-2">{body}</p>
      <div className="text-[10px] text-muted-foreground/70 mt-3 uppercase tracking-widest">{examples}</div>
      <div className="mt-4 inline-flex items-center gap-1 text-[10px] text-primary uppercase tracking-widest">
        Choose <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

function SourceCard({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-left border border-border rounded-lg bg-surface p-4 hover:border-primary hover:bg-surface-elevated transition">
      <div className="w-8 h-8 rounded border border-border bg-background grid place-items-center text-primary mb-3">
        {icon}
      </div>
      <div className="text-foreground text-sm font-medium">{title}</div>
      <p className="text-muted-foreground text-[11px] leading-relaxed mt-1">{body}</p>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-6 text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest inline-flex items-center gap-1">
      <ArrowLeft className="w-3 h-3" /> Back
    </button>
  );
}

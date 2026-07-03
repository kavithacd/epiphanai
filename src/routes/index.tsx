import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Cpu, Lock, Sparkles, Activity, CheckCircle2, XCircle, Mic } from "lucide-react";
import { useState } from "react";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "description", content: BRAND.description },
      { property: "og:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { property: "og:description", content: BRAND.description },
      { name: "twitter:title", content: `${BRAND.name} — ${BRAND.tagline}` },
      { name: "twitter:description", content: BRAND.description },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <TopNav />
      <Hero />
      <Pillars />
      <BeforeAfter />
      <Trust />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="font-semibold tracking-tight">{BRAND.name}</div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
          <a href="#pillars" className="hover:text-foreground">{BRAND.visibilityTaxonomyLabel}</a>
          <Link to="/dashboard" className="px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5 text-xs">
            Open Console <ArrowRight className="w-3 h-3" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <h1 className="text-5xl md:text-7xl font-sans font-medium tracking-tight leading-[1.05] text-foreground">
            Make your <span className="bg-gradient-to-r from-primary via-p2 to-p5 bg-clip-text text-transparent">Hero Products</span> the most-cited on AI
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground leading-relaxed">
            Identify why your products are not being cited as they should on generative engines. Heal your content to make your brand top-cited on LLMs.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/start" className="px-5 py-2.5 rounded bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-2 text-sm font-medium">
              Run a live audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/settings" hash="brand-monitoring" className="px-5 py-2.5 rounded border border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 inline-flex items-center gap-2 text-sm font-medium transition">
              <Mic className="w-4 h-4" /> Setup brand monitoring
            </Link>
            <Link to="/admin" className="px-5 py-2.5 rounded border border-border hover:bg-accent/30 text-sm">
              Admin cockpit
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px bg-border max-w-3xl">
            {[
              ["0%", "Hallucination rate"],
              ["≥96%", "Visibility Taxonomy routing"],
              ["<60min", "Audit → report"],
              ["100%", "Schema.org pass"],
            ].map(([n, l]) => (
              <div key={l} className="bg-background p-4">
                <div className="text-xl font-medium tabular-nums text-primary">{n}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{l}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const PILLAR_META = [
  { id: "P1", name: "Technical Accessibility", color: "var(--color-p1)", ex: "llms.txt · robots.txt · TTFB · JS rendering" },
  { id: "P2", name: "Structured Content", color: "var(--color-p2)", ex: "Product JSON-LD · Breadcrumb · Organization" },
  { id: "P3", name: "Context Density & Copy", color: "var(--color-p3)", ex: "Word count · FAQ schema · scenario language" },
  { id: "P4", name: "Image & Multimodal", color: "var(--color-p4)", ex: "Alt-text · image schema · WebP" },
  { id: "P5", name: "Brand Sentiment / SoV", color: "var(--color-p5)", ex: "Share of voice · competitor citations" },
];

function Pillars() {
  return (
    <section id="pillars" className="border-b border-border py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div className="md:col-span-1">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3">Visibility Taxonomy</div>
            <h2 className="text-3xl font-sans font-medium leading-tight">The five pillars that decide whether AI cites you.</h2>
          </div>
          <p className="md:col-span-2 text-muted-foreground leading-relaxed text-base">
            Each failure is classified, scored, and routed to the correct remediation.
          </p>
        </div>
        <div className="grid md:grid-cols-5 gap-px bg-border border border-border">
          {PILLAR_META.map((p, i) => (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-surface p-5 group hover:bg-surface-elevated transition">
              <div className="text-2xl font-medium tabular-nums" style={{ color: p.color }}>{p.id}</div>
              <div className="text-foreground font-medium text-sm mt-2">{p.name}</div>
              <div className="text-[10px] text-muted-foreground mt-3 leading-relaxed">{p.ex}</div>
              <div className="mt-4 h-0.5 w-6 transition-all group-hover:w-full" style={{ background: p.color }} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfter() {
  const [pos, setPos] = useState(45);
  return (
    <section id="remediation" className="border-b border-border py-20 bg-surface/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[10px] uppercase tracking-widest text-primary mb-3">Before · After</div>
          <h2 className="text-3xl font-sans font-medium leading-tight">From AI-invisible to AI-cited.</h2>
          <p className="text-muted-foreground mt-3 text-sm">Drag the divider to see the same store before and after Shine remediation.</p>
        </div>
        <div
          className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border select-none cursor-ew-resize bg-background"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPos(Math.min(95, Math.max(5, ((e.clientX - r.left) / r.width) * 100)));
          }}
          onTouchMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = e.touches[0].clientX - r.left;
            setPos(Math.min(95, Math.max(5, (x / r.width) * 100)));
          }}
        >
          <BeforePane />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <AfterPane />
          </div>
          <div className="absolute top-0 bottom-0 w-px bg-primary shadow-[0_0_20px_var(--color-primary)] pointer-events-none"
            style={{ left: `${pos}%` }}>
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-semibold border-2 border-background">
              ⇄
            </div>
          </div>
          <div className="absolute top-3 left-3 text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-sev-critical/15 text-sev-critical border border-sev-critical/40">Before</div>
          <div className="absolute top-3 right-3 text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-sev-low/15 text-sev-low border border-sev-low/40">After · Healed</div>
        </div>
      </div>
    </section>
  );
}

function BeforePane() {
  return (
    <div className="absolute inset-0 bg-background p-8 font-mono text-xs">
      <div className="text-muted-foreground mb-3">https://acme-apparel.myshopify.com</div>
      <div className="border border-border rounded p-4 bg-surface/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-foreground font-medium">Merino Crew Sweater</div>
          <div className="text-foreground tabular-nums">€189</div>
        </div>
        <div className="text-muted-foreground text-[10px]">Soft merino crew. Made in Italy.</div>
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
          <Tag type="bad" label="Missing JSON-LD" />
          <Tag type="bad" label="Blocked: GPTBot" />
          <Tag type="bad" label="Alt: IMG_4521" />
          <Tag type="bad" label="32-word body" />
          <Tag type="bad" label="No llms.txt" />
          <Tag type="bad" label="SoV: 0%" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sev-critical text-[11px]">
        <XCircle className="w-3.5 h-3.5" /> GEO Visibility Score · 28 / 100
      </div>
    </div>
  );
}

function AfterPane() {
  return (
    <div className="absolute inset-0 bg-background p-8 font-mono text-xs">
      <div className="text-muted-foreground mb-3">https://acme-apparel.myshopify.com · healed by Shine</div>
      <div className="border border-primary/30 rounded p-4 bg-surface/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-foreground font-medium">Merino Crew Sweater</div>
          <div className="text-foreground tabular-nums">€189</div>
        </div>
        <div className="text-muted-foreground text-[10px] leading-relaxed">
          100% Italian merino wool sourced in Biella. Best for office layering, smart-casual dinners, and weekend coats. Pairs with denim, wool trousers, selvedge chinos…
        </div>
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
          <Tag type="good" label="Product JSON-LD ✓" />
          <Tag type="good" label="GPTBot allowed" />
          <Tag type="good" label="Alt: descriptive" />
          <Tag type="good" label="412-word body" />
          <Tag type="good" label="llms.txt deployed" />
          <Tag type="good" label="Cited in ChatGPT" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sev-low text-[11px]">
        <CheckCircle2 className="w-3.5 h-3.5" /> GEO Visibility Score · 91 / 100
      </div>
    </div>
  );
}

function Tag({ type, label }: { type: "bad" | "good"; label: string }) {
  const c = type === "bad" ? "var(--sev-critical)" : "var(--sev-low)";
  return (
    <span className="text-[10px] px-2 py-1 rounded border tabular-nums"
      style={{ color: c, borderColor: c + "40", background: c + "10" }}>
      {label}
    </span>
  );
}

function Trust() {
  return (
    <section id="trust" className="border-b border-border py-20">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-px bg-border border border-border">
        <Pillar icon={<Lock />} title="Sovereign by default"
          body="Every audit, generation, and evaluation runs inside your perimeter. No client product data, copy, or imagery ever leaves to a third-party API." />
        <Pillar icon={<ShieldCheck />} title="Eval Gate enforcement"
          body="Every fix passes a binary rubric — Fact Preservation, Schema validity, Object accuracy. Failures are regenerated, never silently downgraded." />
        <Pillar icon={<Activity />} title="One-click rollback"
          body="Every write to Shopify takes a snapshot. Restore the original state in a single click — 30-day retention on every fix." />
      </div>
    </section>
  );
}

function Pillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-background p-8">
      <div className="w-9 h-9 rounded border border-border bg-surface grid place-items-center text-primary mb-4">
        {icon}
      </div>
      <div className="text-foreground font-medium">{title}</div>
      <p className="text-muted-foreground text-xs leading-relaxed mt-2">{body}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-10 text-xs text-muted-foreground">
      <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-4 items-center justify-between">
        <div>© 2026 Shine v1.0</div>
      </div>
    </footer>
  );
}

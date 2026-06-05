import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { PRICING_TIERS } from "@/lib/plan";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · epiphanAI" },
      { name: "description", content: "Audit Engine, Brand Monitoring, or both. Starter from €25/mo, Pro from €100/mo. EU billing." },
      { property: "og:title", content: "Pricing · epiphanAI" },
      { property: "og:description", content: "Audit Engine, Brand Monitoring, or both. Starter from €25/mo, Pro from €100/mo." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="font-semibold tracking-tight">epiphanAI</div>
          </Link>
          <nav className="flex items-center gap-4 text-xs">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/dashboard" className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs flex items-center gap-1.5">
              Open Console <ArrowRight className="w-3 h-3" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pricing</div>
          <h1 className="text-3xl md:text-4xl font-sans font-medium mt-2">
            Pick a workflow. Or run both.
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            Audit Engine, Brand Monitoring, or the Bundle. EU-friendly billing.
            All paid plans renew monthly. Cancel anytime.
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING_TIERS.map((t) => (
            <article
              key={t.id}
              className={`flex flex-col border rounded-lg p-5 bg-surface ${
                t.highlight ? "border-primary/60 shadow-[0_0_0_1px_var(--color-primary)]" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.name}
                </div>
                {t.highlight && (
                  <span className="text-[9px] uppercase tracking-widest text-primary border border-primary/40 rounded px-1.5 py-0.5">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-medium tabular-nums">{t.price}</span>
                <span className="text-[11px] text-muted-foreground">{t.cadence}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t.blurb}</p>
              <ul className="mt-4 space-y-1.5 flex-1">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[11px] text-foreground">
                    <Check className="w-3 h-3 mt-0.5 text-sev-low shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {t.id === "enterprise" ? (
                <a
                  href="mailto:sales@epiphanai.eu?subject=Enterprise%20enquiry"
                  className="mt-5 px-4 py-2 rounded border border-border text-xs text-center hover:border-primary"
                >
                  Talk to sales
                </a>
              ) : t.id === "free" ? (
                <Link
                  to="/auth"
                  className="mt-5 px-4 py-2 rounded border border-border text-xs text-center hover:border-primary"
                >
                  Get started free
                </Link>
              ) : (
                <button
                  onClick={() => alert("Checkout is not wired yet. Drop us a line at sales@epiphanai.eu and we'll get you onboarded.")}
                  className={`mt-5 px-4 py-2 rounded text-xs ${
                    t.highlight
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:border-primary"
                  }`}
                >
                  {t.cta}
                </button>
              )}
            </article>
          ))}
        </div>

        <div className="mt-10 text-center text-[11px] text-muted-foreground">
          Need a custom volume, on-prem deployment, or to bundle both workflows above Pro limits?
          <a href="mailto:sales@epiphanai.eu" className="text-primary hover:underline ml-1">
            Talk to sales →
          </a>
        </div>
      </section>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, ArrowRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ENGINES,
  ANNUAL_DISCOUNT,
  ENGINE_ADDON_PRICE,
  computeTierPrice,
  tiersFor,
  type Audience,
  type Billing,
  type PricingTierV2,
} from "@/lib/plan";
import { BRAND, seoMeta } from "@/lib/branding";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: seoMeta(
      "Pricing",
      `Brand or agency plans, priced by the AI engines you track. Starter from €39/mo. Undercut Searchable and Profound. EU billing.`,
    ),
  }),
  component: PricingPage,
});

const DEFAULT_ENGINE_IDS = ENGINES.slice(0, 3).map((e) => e.id);

function PricingPage() {
  const [audience, setAudience] = useState<Audience>("brand");
  const [billing, setBilling] = useState<Billing>("monthly");
  const [engineIds, setEngineIds] = useState<string[]>(DEFAULT_ENGINE_IDS);

  const tiers = tiersFor(audience);
  const engineCount = engineIds.length;

  const toggleEngine = (id: string) => {
    setEngineIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <Header />

      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Pricing
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-medium mt-2">
            Price that scales with the engines you actually track.
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            Pick your audience, billing cadence, and the AI engines you want
            probed. Prices update live. Every paid plan includes 14-day free
            trial. Cancel anytime.
          </p>
        </div>

        {/* Audience + billing toggles */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          <Toggle
            options={[
              { id: "brand", label: "Brands" },
              { id: "agency", label: "Agencies" },
            ]}
            value={audience}
            onChange={(v) => setAudience(v as Audience)}
          />
          <Toggle
            options={[
              { id: "monthly", label: "Monthly" },
              {
                id: "annual",
                label: `Annual · −${Math.round(ANNUAL_DISCOUNT * 100)}%`,
              },
            ]}
            value={billing}
            onChange={(v) => setBilling(v as Billing)}
          />
        </div>

        {/* Engine picker */}
        <div className="mt-8 max-w-4xl mx-auto border border-border rounded-lg p-4 bg-surface">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                AI engines to track
              </div>
              <div className="text-xs text-foreground mt-0.5">
                Selected: <span className="tabular-nums">{engineCount}</span> ·
                each extra beyond a tier's included set is +€{ENGINE_ADDON_PRICE}
                /mo
              </div>
            </div>
            <button
              onClick={() =>
                setEngineIds(
                  engineCount === ENGINES.length
                    ? DEFAULT_ENGINE_IDS
                    : ENGINES.map((e) => e.id),
                )
              }
              className="text-[11px] text-primary hover:underline"
            >
              {engineCount === ENGINES.length ? "Reset to default" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ENGINES.map((e) => {
              const on = engineIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggleEngine(e.id)}
                  className={`px-2.5 py-1.5 rounded border text-[11px] flex items-center gap-1.5 transition ${
                    on
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {on ? <Check className="w-3 h-3 text-primary" /> : <X className="w-3 h-3" />}
                  {e.name}
                  <span className="text-muted-foreground/70">· {e.vendor}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier cards */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t) => (
            <TierCard
              key={t.id}
              tier={t}
              engineCount={engineCount}
              billing={billing}
            />
          ))}
        </div>

        <div className="mt-10 text-center text-[11px] text-muted-foreground">
          Need a custom volume, on-prem deployment, or bundled agency licensing?{" "}
          <a
            href={`mailto:${BRAND.contactEmail}`}
            className="text-primary hover:underline"
          >
            Talk to sales →
          </a>
        </div>

        <div className="mt-14 text-center">
          <Link
            to="/compare"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            See how {BRAND.name} compares to Searchable, Profound &amp; Peec →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="font-semibold tracking-tight">{BRAND.name}</div>
        </Link>
        <nav className="flex items-center gap-4 text-xs">
          <Link to="/compare" className="text-muted-foreground hover:text-foreground">
            Compare
          </Link>
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs flex items-center gap-1.5"
          >
            Open Console <ArrowRight className="w-3 h-3" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex border border-border rounded-md p-0.5 bg-surface">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded text-[11px] uppercase tracking-widest transition ${
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TierCard({
  tier,
  engineCount,
  billing,
}: {
  tier: PricingTierV2;
  engineCount: number;
  billing: Billing;
}) {
  const price = useMemo(
    () => computeTierPrice(tier, engineCount, billing),
    [tier, engineCount, billing],
  );

  const priceLabel =
    price === null
      ? "Custom"
      : price === 0
      ? "€0"
      : `€${price.toLocaleString("en-GB")}`;
  const cadence =
    price === null
      ? "talk to sales"
      : price === 0
      ? "forever"
      : billing === "annual"
      ? "per month · billed yearly"
      : "per month";

  const engineDelta = engineCount - tier.enginesIncluded;
  const clampedNote =
    engineCount > tier.maxEngines
      ? `Priced at max ${tier.maxEngines} engines — upgrade for more`
      : engineDelta > 0
      ? `+${engineDelta} engine${engineDelta > 1 ? "s" : ""} above included ${tier.enginesIncluded}`
      : engineDelta < 0
      ? `Using ${engineCount} of ${tier.enginesIncluded} included engines`
      : `${tier.enginesIncluded} engines included`;

  return (
    <article
      className={`relative flex flex-col border rounded-lg p-5 bg-surface ${
        tier.highlight
          ? "border-primary/60 shadow-[0_0_0_1px_var(--color-primary)]"
          : "border-border"
      }`}
    >
      {tier.highlight && (
        <span className="absolute -top-2 right-4 text-[9px] uppercase tracking-widest text-primary-foreground bg-primary rounded px-1.5 py-0.5">
          Popular
        </span>
      )}
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {tier.name}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-medium tabular-nums">{priceLabel}</span>
        <span className="text-[11px] text-muted-foreground">{cadence}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{clampedNote}</p>
      <p className="text-xs text-muted-foreground mt-2 min-h-8">{tier.blurb}</p>
      <ul className="mt-3 space-y-1.5 flex-1">
        {tier.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[11px] text-foreground"
          >
            <Check className="w-3 h-3 mt-0.5 text-sev-low shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {price === null ? (
        <a
          href={`mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(
            `${tier.name} enquiry`,
          )}`}
          className="mt-4 px-4 py-2 rounded border border-border text-xs text-center hover:border-primary"
        >
          {tier.cta}
        </a>
      ) : tier.basePriceMonthly === 0 ? (
        <Link
          to="/auth"
          className="mt-4 px-4 py-2 rounded border border-border text-xs text-center hover:border-primary"
        >
          {tier.cta}
        </Link>
      ) : (
        <button
          onClick={() =>
            alert(
              `Checkout is not wired yet. Drop us a line at ${BRAND.contactEmail} and we'll get you onboarded.`,
            )
          }
          className={`mt-4 px-4 py-2 rounded text-xs ${
            tier.highlight
              ? "bg-primary text-primary-foreground"
              : "border border-border hover:border-primary"
          }`}
        >
          {tier.cta}
        </button>
      )}
    </article>
  );
}

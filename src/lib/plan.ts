// Plan limits — single source of truth. Used by both UI and server fns.
export type PlanKind = "free" | "audit" | "monitor" | "bundle";
export type TierKind = "free" | "starter" | "pro" | "enterprise";

export interface PlanLimits {
  auditRuns: number; // per month
  monitorRuns: number; // per month
  competitors: number;
  skus: number;
  hasAudit: boolean;
  hasMonitor: boolean;
}

export const TIER_LIMITS: Record<TierKind, PlanLimits> = {
  free: {
    auditRuns: 2,
    monitorRuns: 1,
    competitors: 1,
    skus: 25,
    hasAudit: true,
    hasMonitor: true,
  },
  starter: {
    auditRuns: 5,
    monitorRuns: 5,
    competitors: 5,
    skus: 100,
    hasAudit: true,
    hasMonitor: true,
  },
  pro: {
    auditRuns: 10,
    monitorRuns: 10,
    competitors: 10,
    skus: 2000,
    hasAudit: true,
    hasMonitor: true,
  },
  enterprise: {
    auditRuns: Number.POSITIVE_INFINITY,
    monitorRuns: Number.POSITIVE_INFINITY,
    competitors: Number.POSITIVE_INFINITY,
    skus: Number.POSITIVE_INFINITY,
    hasAudit: true,
    hasMonitor: true,
  },
};

export function getLimitsFor(plan: PlanKind, tier: TierKind): PlanLimits {
  const base = TIER_LIMITS[tier];
  return {
    ...base,
    hasAudit: plan === "audit" || plan === "bundle" || plan === "free",
    hasMonitor: plan === "monitor" || plan === "bundle" || plan === "free",
  };
}

export const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    cadence: "forever",
    blurb: "Try Shine on a single brand.",
    bullets: [
      "2 audit engine runs (total)",
      "1 brand monitoring run",
      "1 competitor · up to 25 SKUs",
    ],
    cta: "Current plan",
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "€25",
    cadence: "per month · single workflow",
    blurb: "Pick Audit Engine or Brand Monitoring.",
    bullets: [
      "Up to 100 SKUs (Audit)",
      "Up to 5 competitors (Monitor)",
      "5 runs per month",
      "Weekly auto-refresh · safe auto-fixes",
    ],
    cta: "Upgrade",
    highlight: false,
  },
  {
    id: "starter-bundle",
    name: "Starter · Bundle",
    price: "€40",
    cadence: "per month · both workflows",
    blurb: "Both workflows at Starter limits.",
    bullets: [
      "100 SKUs · 5 competitors",
      "5 runs each per month",
      "Everything in Starter",
    ],
    cta: "Upgrade",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "€100",
    cadence: "per month · single workflow",
    blurb: "Heavier catalogs and deeper competitive sets.",
    bullets: [
      "Up to 2,000 SKUs (Audit)",
      "Up to 10 competitors (Monitor)",
      "10 runs per month",
      "All Starter features",
    ],
    cta: "Upgrade",
    highlight: false,
  },
  {
    id: "pro-bundle",
    name: "Pro · Bundle",
    price: "€150",
    cadence: "per month · both workflows",
    blurb: "Both workflows at Pro limits.",
    bullets: [
      "2,000 SKUs · 10 competitors",
      "10 runs each per month",
      "Everything in Pro",
    ],
    cta: "Upgrade",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "talk to sales",
    blurb: "Larger volumes, custom integrations, SLAs.",
    bullets: [
      "Unlimited SKUs & runs",
      "SSO, audit log retention",
      "Dedicated support",
    ],
    cta: "Contact sales",
    highlight: false,
  },
] as const;

// ---------------------------------------------------------------------------
// v2 pricing model — audience × tier × engines. Used by /pricing and /compare.
// ---------------------------------------------------------------------------

export type Audience = "brand" | "agency";
export type Billing = "monthly" | "annual";

export interface Engine {
  id: string;
  name: string;
  vendor: string;
}

// Nine engines to match category expectations. Order matters — first three are
// the default "included" set on Starter/Launch tiers.
export const ENGINES: readonly Engine[] = [
  { id: "chatgpt",       name: "ChatGPT",             vendor: "OpenAI" },
  { id: "google-aio",    name: "Google AI Overviews", vendor: "Google" },
  { id: "perplexity",    name: "Perplexity",          vendor: "Perplexity" },
  { id: "claude",        name: "Claude",              vendor: "Anthropic" },
  { id: "gemini",        name: "Gemini",              vendor: "Google" },
  { id: "google-ai-mode",name: "Google AI Mode",      vendor: "Google" },
  { id: "copilot",       name: "Microsoft Copilot",   vendor: "Microsoft" },
  { id: "grok",          name: "Grok",                vendor: "xAI" },
  { id: "deepseek",      name: "DeepSeek",            vendor: "DeepSeek" },
] as const;

export const ENGINE_ADDON_PRICE = 19;   // per extra engine / month (monthly billing)
export const ENGINE_ADDON_PRICE_ANNUAL = 15;
export const ENGINE_CREDIT = 10;        // deselecting an included engine credits this back
export const ENGINE_CREDIT_ANNUAL = 8;
export const ANNUAL_DISCOUNT = 0.20;    // 20% off annual

export interface PricingTierV2 {
  id: string;
  name: string;
  basePriceMonthly: number | null;   // null → contact sales
  enginesIncluded: number;           // count included in base price
  maxEngines: number;                // upper bound (9 for enterprise/custom)
  prompts: number | "custom";
  audits: number | "custom";
  articles: number | "custom";
  projects: number | "custom";       // "projects" = client brands for agencies, "brands" for brands audience
  highlight?: boolean;
  cta: string;
  blurb: string;
  bullets: readonly string[];
}

export const BRAND_TIERS: readonly PricingTierV2[] = [
  {
    id: "free",
    name: "Free",
    basePriceMonthly: 0,
    enginesIncluded: 1,
    maxEngines: 1,
    prompts: 25,
    audits: 2,
    articles: 0,
    projects: 1,
    cta: "Get started free",
    blurb: "Try Shine on one brand, one engine.",
    bullets: [
      "1 engine of your choice",
      "25 tracked prompts",
      "2 audit runs total",
      "1 project · 25 SKUs",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    basePriceMonthly: 39,
    enginesIncluded: 3,
    maxEngines: 5,
    prompts: 200,
    audits: 200,
    articles: 20,
    projects: 3,
    cta: "Start 14-day trial",
    blurb: "For a single brand serious about AI visibility.",
    bullets: [
      "3 engines included · add more from €19/mo",
      "200 tracked prompts · daily refresh",
      "200 site audits/mo · 20 articles/mo",
      "3 projects · up to 100 SKUs",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    basePriceMonthly: 99,
    enginesIncluded: 5,
    maxEngines: 7,
    prompts: 500,
    audits: 1000,
    articles: 80,
    projects: 5,
    highlight: true,
    cta: "Start 14-day trial",
    blurb: "For growing brands with deeper competitive sets.",
    bullets: [
      "5 engines included",
      "500 tracked prompts · daily refresh",
      "1,000 audits/mo · 80 articles/mo",
      "5 projects · up to 500 SKUs · white-label reports",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    basePriceMonthly: 249,
    enginesIncluded: 7,
    maxEngines: 9,
    prompts: 1250,
    audits: 3000,
    articles: 200,
    projects: 10,
    cta: "Start 14-day trial",
    blurb: "Heavy catalogs, multi-region tracking.",
    bullets: [
      "7 engines included",
      "1,250 tracked prompts",
      "3,000 audits/mo · 200 articles/mo",
      "10 projects · up to 2,000 SKUs · API access",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    basePriceMonthly: null,
    enginesIncluded: 9,
    maxEngines: 9,
    prompts: "custom",
    audits: "custom",
    articles: "custom",
    projects: "custom",
    cta: "Talk to sales",
    blurb: "Unlimited SKUs, SLA, SSO, custom integrations.",
    bullets: [
      "All 9 engines",
      "Unlimited prompts, audits, articles",
      "Unlimited projects & seats",
      "SSO, audit-log retention, dedicated support",
    ],
  },
];

export const AGENCY_TIERS: readonly PricingTierV2[] = [
  {
    id: "launch",
    name: "Launch",
    basePriceMonthly: 199,
    enginesIncluded: 3,
    maxEngines: 5,
    prompts: 200,
    audits: 200,
    articles: 20,
    projects: 5,
    cta: "Start 14-day trial",
    blurb: "For solo operators and small agency offerings.",
    bullets: [
      "3 engines included",
      "200 prompts per model",
      "200 audits/mo · 20 articles/mo",
      "5 client projects · white-label reports",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    basePriceMonthly: 329,
    enginesIncluded: 5,
    maxEngines: 7,
    prompts: 500,
    audits: 1000,
    articles: 80,
    projects: 10,
    highlight: true,
    cta: "Start 14-day trial",
    blurb: "For growing agencies with several clients.",
    bullets: [
      "5 engines included",
      "500 prompts per model",
      "1,000 audits/mo · 80 articles/mo",
      "10 client projects · MCP · Looker Studio",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    basePriceMonthly: 799,
    enginesIncluded: 7,
    maxEngines: 9,
    prompts: 1250,
    audits: 3000,
    articles: 200,
    projects: 999,
    cta: "Get started",
    blurb: "For independent agencies with white-label needs.",
    bullets: [
      "7 engines included",
      "1,250 prompts per model",
      "3,000 audits/mo · 200 articles/mo",
      "Unlimited client projects · API access",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    basePriceMonthly: null,
    enginesIncluded: 9,
    maxEngines: 9,
    prompts: "custom",
    audits: "custom",
    articles: "custom",
    projects: "custom",
    cta: "Talk to sales",
    blurb: "For global agencies needing custom coverage.",
    bullets: [
      "All 9 engines",
      "Custom prompt setup · daily or weekly frequency",
      "Unlimited projects & seats",
      "API access · SSO · dedicated specialist",
    ],
  },
];

export function tiersFor(audience: Audience): readonly PricingTierV2[] {
  return audience === "brand" ? BRAND_TIERS : AGENCY_TIERS;
}

/**
 * Compute the final monthly price for a tier given the selected engine count
 * and billing cadence. Returns null for contact-sales tiers.
 *
 * Rules: base includes N engines. Extras billed per engine per month.
 * Deselecting an included engine credits back at a smaller amount. Annual
 * billing applies a 20% multiplier on the resulting monthly figure.
 */
export function computeTierPrice(
  tier: PricingTierV2,
  selectedEngines: number,
  billing: Billing,
): number | null {
  if (tier.basePriceMonthly === null) return null;
  const isAnnual = billing === "annual";
  const addon = isAnnual ? ENGINE_ADDON_PRICE_ANNUAL : ENGINE_ADDON_PRICE;
  const credit = isAnnual ? ENGINE_CREDIT_ANNUAL : ENGINE_CREDIT;

  const clamped = Math.max(1, Math.min(selectedEngines, tier.maxEngines));
  const delta = clamped - tier.enginesIncluded;
  let price = tier.basePriceMonthly;
  if (delta > 0) price += delta * addon;
  else if (delta < 0) price = Math.max(0, price + delta * credit);
  if (isAnnual) price = price * (1 - ANNUAL_DISCOUNT);
  return Math.round(price);
}


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
    blurb: "Try epiphanAI on a single brand.",
    bullets: [
      "2 audit engine runs (total)",
      "1 brand monitoring run",
      "1 competitor",
      "Up to 25 SKUs",
    ],
    cta: "Current plan",
    highlight: false,
  },
  {
    id: "starter-audit",
    name: "Audit Engine · Starter",
    price: "€25",
    cadence: "per month",
    blurb: "GEO remediation for small catalogs.",
    bullets: [
      "Up to 100 SKUs",
      "5 audit runs per month",
      "Auto-deploy safe fixes",
      "Review Queue for copy/image",
    ],
    cta: "Upgrade",
    highlight: false,
  },
  {
    id: "starter-monitor",
    name: "Brand Monitoring · Starter",
    price: "€25",
    cadence: "per month",
    blurb: "Track your brand across AI engines.",
    bullets: [
      "Up to 5 competitors",
      "5 monitoring runs per month",
      "Weekly auto-refresh",
      "Probe queries by intent",
    ],
    cta: "Upgrade",
    highlight: false,
  },
  {
    id: "starter-bundle",
    name: "Bundle · Starter",
    price: "€49",
    cadence: "per month",
    blurb: "Both workflows. Save €1.",
    bullets: [
      "Everything in both Starters",
      "100 SKUs · 5 competitors",
      "5 runs each per month",
    ],
    cta: "Upgrade",
    highlight: true,
  },
  {
    id: "pro-audit",
    name: "Audit Engine · Pro",
    price: "€100",
    cadence: "per month",
    blurb: "Heavier catalogs, more runs.",
    bullets: [
      "Up to 2,000 SKUs",
      "10 audit runs per month",
      "All Starter features",
    ],
    cta: "Upgrade",
    highlight: false,
  },
  {
    id: "pro-monitor",
    name: "Brand Monitoring · Pro",
    price: "€100",
    cadence: "per month",
    blurb: "Deeper competitive set.",
    bullets: [
      "Up to 10 competitors",
      "10 monitoring runs per month",
      "All Starter features",
    ],
    cta: "Upgrade",
    highlight: false,
  },
  {
    id: "pro-bundle",
    name: "Bundle · Pro",
    price: "€150",
    cadence: "per month",
    blurb: "Both workflows, Pro limits.",
    bullets: [
      "Everything in both Pros",
      "2,000 SKUs · 10 competitors",
      "10 runs each per month",
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

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

// Export & integration helpers — simulated, but structured so each
// adapter can be swapped for a real API client without touching call sites.

import { Failure, describeFix, PillarId } from "./epiphan-data";

export type IntegrationConfig = {
  slackWebhook: string;
  shopifyToken: string;
  woocommerceUrl: string;
  woocommerceKey: string;
  etsyKey: string;
  akeneoUrl: string;
  akeneoKey: string;
  pimcoreUrl: string;
  pimcoreKey: string;
  genericWebhook: string;
};

export const EMPTY_INTEGRATIONS: IntegrationConfig = {
  slackWebhook: "",
  shopifyToken: "",
  woocommerceUrl: "",
  woocommerceKey: "",
  etsyKey: "",
  akeneoUrl: "",
  akeneoKey: "",
  pimcoreUrl: "",
  pimcoreKey: "",
  genericWebhook: "",
};

export type PlatformId =
  | "shopify"
  | "woocommerce"
  | "etsy"
  | "akeneo"
  | "pimcore"
  | "webhook"
  | "slack";

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  shopify: "Shopify Admin API",
  woocommerce: "WooCommerce REST",
  etsy: "Etsy Open API",
  akeneo: "Akeneo PIM",
  pimcore: "Pimcore PIM",
  webhook: "Generic Webhook",
  slack: "Slack",
};

// ───────────────────────── Payload shapes ─────────────────────────

export function toWebhookPayload(failures: Failure[]) {
  return {
    source: "Shine",
    version: "1.0",
    deployedAt: new Date().toISOString(),
    count: failures.length,
    fixes: failures.map((f) => {
      const d = describeFix(f);
      return {
        failureId: f.failureId,
        pillar: f.pillar,
        severity: f.severity,
        title: d.title,
        detail: d.detail,
        change: f.fix
          ? { before: f.fix.before, after: f.fix.after, type: f.fix.fixType }
          : null,
      };
    }),
  };
}

function csvEscape(v: unknown) {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function toCsv(failures: Failure[]) {
  const header = [
    "auditId", "pillar", "failureId", "failureName", "severity",
    "status", "fixTitle", "fixDetail", "before", "after",
  ];
  const rows = failures.map((f) => {
    const d = describeFix(f);
    return [
      f.auditId, f.pillar, f.failureId, f.failureName, f.severity,
      f.status, d.title, d.detail,
      f.fix?.before ?? "", f.fix?.after ?? "",
    ].map(csvEscape).join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function toJson(failures: Failure[]) {
  return JSON.stringify(toWebhookPayload(failures), null, 2);
}

// ───────────────────────── Browser download ─────────────────────────

export function downloadFile(name: string, mime: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
}

// ───────────────────────── Simulated push ─────────────────────────
// Each adapter returns a "request envelope" — what a real call would
// look like. Real wiring just replaces the body of `pushToPlatform`.

export function buildPlatformRequest(
  platform: PlatformId,
  failures: Failure[],
  cfg: IntegrationConfig,
) {
  const payload = toWebhookPayload(failures);
  switch (platform) {
    case "shopify":
      return {
        method: "PUT",
        url: "https://{shop}.myshopify.com/admin/api/2024-10/products/bulk.json",
        headers: { "X-Shopify-Access-Token": cfg.shopifyToken || "<token>" },
        body: payload,
      };
    case "woocommerce":
      return {
        method: "POST",
        url: `${cfg.woocommerceUrl || "https://store.example/wp-json"}/wc/v3/products/batch`,
        headers: { Authorization: `Basic ${cfg.woocommerceKey ? "***" : "<key>"}` },
        body: payload,
      };
    case "etsy":
      return {
        method: "PUT",
        url: "https://openapi.etsy.com/v3/application/shops/{shop_id}/listings",
        headers: { "x-api-key": cfg.etsyKey || "<key>" },
        body: payload,
      };
    case "akeneo":
      return {
        method: "PATCH",
        url: `${cfg.akeneoUrl || "https://pim.example"}/api/rest/v1/products`,
        headers: { Authorization: `Bearer ${cfg.akeneoKey ? "***" : "<token>"}` },
        body: payload,
      };
    case "pimcore":
      return {
        method: "POST",
        url: `${cfg.pimcoreUrl || "https://pimcore.example"}/webservice/rest/object`,
        headers: { "X-API-Key": cfg.pimcoreKey || "<key>" },
        body: payload,
      };
    case "webhook":
      return {
        method: "POST",
        url: cfg.genericWebhook || "https://hooks.example/epiphan",
        headers: { "Content-Type": "application/json" },
        body: payload,
      };
    case "slack":
      return {
        method: "POST",
        url: cfg.slackWebhook || "https://hooks.slack.com/services/T000/B000/XXX",
        headers: { "Content-Type": "application/json" },
        body: {
          text: `:rotating_light: Shine · ${failures.length} GEO fix${failures.length === 1 ? "" : "es"} deployed`,
          blocks: failures.slice(0, 5).map((f) => {
            const d = describeFix(f);
            return {
              type: "section",
              text: { type: "mrkdwn", text: `*${d.title}*\n${d.detail}` },
            };
          }),
        },
      };
  }
}

export function isPlatformConfigured(platform: PlatformId, cfg: IntegrationConfig) {
  switch (platform) {
    case "shopify": return !!cfg.shopifyToken;
    case "woocommerce": return !!cfg.woocommerceUrl && !!cfg.woocommerceKey;
    case "etsy": return !!cfg.etsyKey;
    case "akeneo": return !!cfg.akeneoUrl && !!cfg.akeneoKey;
    case "pimcore": return !!cfg.pimcoreUrl && !!cfg.pimcoreKey;
    case "webhook": return !!cfg.genericWebhook;
    case "slack": return !!cfg.slackWebhook;
  }
}

// ───────────────────────── Score helpers ─────────────────────────

export function emptyScoreMap(): Record<PillarId, number> {
  return { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100 };
}

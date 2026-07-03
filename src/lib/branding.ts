// Single source of truth for product branding.
// Update values here to rename the product everywhere (UI labels, SEO meta,
// email templates, generated reports). Avoid hard-coding the product name
// elsewhere — import from this module.

export const BRAND = {
  name: "Shine",
  tagline: "Make your Hero Products the most-cited on AI",
  description:
    "Identify why your products aren't cited on generative engines and heal your content to become top-cited on LLMs.",
  contactEmail: "sales@shine.ai",
  supportEmail: "support@shine.ai",
  twitterHandle: "@ShineAI",
  domain: "shine.ai",
  // Vocabulary — rename in one place
  visibilityTaxonomyLabel: "Visibility Taxonomy",
} as const;

export const seoTitle = (page?: string) =>
  page ? `${page} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;

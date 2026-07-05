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

// Build a complete SEO meta bundle for a route so per-route head() calls
// stay in sync with the brand. Pass a page label and an optional page-specific
// description; falls back to BRAND.description.
export const seoMeta = (page: string, description?: string) => {
  const title = seoTitle(page);
  const desc = description ?? BRAND.description;
  return [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: desc },
  ];
};

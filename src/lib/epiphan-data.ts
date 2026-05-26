export type PillarId = "P1" | "P2" | "P3" | "P4" | "P5";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FixStatus =
  | "detected"
  | "generating"
  | "eval_pending"
  | "eval_passed"
  | "eval_failed"
  | "review_pending"
  | "approved"
  | "deployed"
  | "rolled_back"
  | "rejected";

export const PILLARS: {
  id: PillarId;
  name: string;
  short: string;
  color: string;
  tokenVar: string;
}[] = [
  { id: "P1", name: "Technical Accessibility", short: "Technical", color: "#00D4FF", tokenVar: "p1" },
  { id: "P2", name: "Structured Content", short: "Structured", color: "#A78BFA", tokenVar: "p2" },
  { id: "P3", name: "Context Density & Copy", short: "Context", color: "#34D399", tokenVar: "p3" },
  { id: "P4", name: "Image & Multimodal", short: "Multimodal", color: "#FB923C", tokenVar: "p4" },
  { id: "P5", name: "Brand Sentiment / SoV", short: "Sentiment", color: "#F472B6", tokenVar: "p5" },
];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5,
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "var(--sev-critical)",
  HIGH: "var(--sev-high)",
  MEDIUM: "var(--sev-medium)",
  LOW: "var(--sev-low)",
};

// ─── Deterministic PRNG ──────────────────────────────────────────────────
// Keep SSR HTML byte-equal to first client render. Math.random in seed data
// causes hydration mismatches. Use mulberry32 with a fixed seed instead.
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededInt(rng: () => number, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Failure = {
  id: string;
  auditId: string;
  pillar: PillarId;
  failureId: string;
  failureName: string;
  severity: Severity;
  detail: string;
  isAutofixable: boolean;
  requiresHuman: boolean;
  status: FixStatus;
  detectedAt: number;
  fix?: Fix;
};

export type Fix = {
  id: string;
  fixType: string;
  generatedBy: string;
  before: string;
  after: string;
  evalScores: {
    factPreservation: number;
    semanticDensity: number;
    structuralSyntax: number;
    objectAccuracy: number;
    overall: "PASS" | "FAIL";
  };
  hallucinationScore: number;
  groundingScore: number;
  reasoning: string;
  userFeedback?: "pass" | "fail";
  rollbackSnapshot?: string;
};

export type AuditRecord = {
  id: string;
  url: string;
  storeName: string;
  status: "pending" | "running" | "complete" | "failed";
  currentPillar: PillarId | null;
  scores: Record<PillarId, number>;
  failures: Failure[];
  createdAt: number;
  completedAt?: number;
  ctx?: ProductContext;
};

export type TraceLog = {
  id: string;
  timestamp: number;
  model: string;
  workflow: string;
  promptHash: string;
  operator: string;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  status: "success" | "failure";
};

export const FAILURE_CATALOG: Omit<Failure, "id" | "auditId" | "status" | "detectedAt" | "fix">[] = [
  { pillar: "P1", failureId: "F1.1", failureName: "Missing llms.txt", severity: "CRITICAL", detail: "No /llms.txt manifest detected. AI crawlers cannot discover content priorities.", isAutofixable: true, requiresHuman: false },
  { pillar: "P1", failureId: "F1.2", failureName: "GPTBot blocked in robots.txt", severity: "CRITICAL", detail: "User-agent GPTBot is explicitly disallowed from /. Store is invisible to ChatGPT search.", isAutofixable: true, requiresHuman: false },
  { pillar: "P1", failureId: "F1.3", failureName: "Slow TTFB (3.2s)", severity: "HIGH", detail: "Time to first byte exceeds 2000ms threshold. AI crawlers will time out.", isAutofixable: false, requiresHuman: true },
  { pillar: "P1", failureId: "F1.5", failureName: "Missing canonical tags", severity: "MEDIUM", detail: "12 product pages lack rel=canonical declarations.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.1", failureName: "No Product JSON-LD", severity: "CRITICAL", detail: "Product schema markup absent from all product pages.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.2", failureName: "Invalid BreadcrumbList", severity: "HIGH", detail: "Breadcrumb schema present but missing required 'position' fields.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.3", failureName: "Missing Organization schema", severity: "MEDIUM", detail: "Root domain lacks Organization JSON-LD with sameAs links.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.4", failureName: "Unparseable product markup", severity: "HIGH", detail: "3 products contain malformed JSON-LD blocks.", isAutofixable: true, requiresHuman: false },
  { pillar: "P3", failureId: "F3.1", failureName: "Thin descriptions (<150w)", severity: "CRITICAL", detail: "Product descriptions under 150 words. AI engines cannot extract context.", isAutofixable: false, requiresHuman: true },
  { pillar: "P3", failureId: "F3.2", failureName: "Missing FAQ schema", severity: "HIGH", detail: "No FAQPage structured data found. Loss of long-tail visibility.", isAutofixable: false, requiresHuman: true },
  { pillar: "P3", failureId: "F3.3", failureName: "No scenario content", severity: "MEDIUM", detail: "Descriptions lack 'best for X' and use-case language.", isAutofixable: false, requiresHuman: true },
  { pillar: "P4", failureId: "F4.1", failureName: "Missing alt-text", severity: "HIGH", detail: "Product images have empty alt attributes.", isAutofixable: true, requiresHuman: true },
  { pillar: "P4", failureId: "F4.2", failureName: "Generic alt-text (DSC_*)", severity: "MEDIUM", detail: "Images use filename-style alt text (e.g. 'IMG_4521').", isAutofixable: true, requiresHuman: true },
  { pillar: "P4", failureId: "F4.4", failureName: "Non-WebP assets", severity: "LOW", detail: "Product images served as JPEG. Larger payload, slower indexing.", isAutofixable: true, requiresHuman: false },
  { pillar: "P5", failureId: "F5.1", failureName: "Zero brand citations", severity: "CRITICAL", detail: "Brand not cited in any of 10 category probe queries via ChatGPT.", isAutofixable: false, requiresHuman: true },
  { pillar: "P5", failureId: "F5.2", failureName: "Competitor dominance", severity: "HIGH", detail: "Top competitor cited in 8/10 AI answers. Share of voice: 0%.", isAutofixable: false, requiresHuman: true },
];

export const MODEL_MATRIX = {
  phi4: { name: "Phi-4", size: "8.7B", costPer1k: 0.0, role: "Triage & Classification" },
  llama33: { name: "Llama 3.3 70B", size: "70B", costPer1k: 0.0, role: "Copywriting & JSON-LD" },
  vision: { name: "Llama 3.2-Vision", size: "11B", costPer1k: 0.0, role: "Multimodal / Alt-text" },
  judge: { name: "Llama 3.3 (Judge)", size: "70B", costPer1k: 0.0, role: "Eval Gate" },
  probe: { name: "Llama 3.1 8B (probes)", size: "8B", costPer1k: 0.0, role: "Category probes" },
} as const;

// ─── Product context inferred from URL ──────────────────────────────────
// Threaded into fix templates so audits feel real — Swarovski URL produces
// "Swan Pendant" fixtures, Nike URL produces footwear fixtures, etc. Without
// a real scraper (Firecrawl, etc.) this is the source of truth for the demo.
export type ProductContext = {
  brand: string;
  productName: string;
  category: string;
  domain: string;
  currency: string;
  price: string;
  sku: string;
  material: string;
  primaryColor: string;
  imageDesc: string;
  handle: string;
  taxonomy: string[];
  industry: string;
};

const KNOWN: { match: RegExp; ctx: (slug: string) => Partial<ProductContext> }[] = [
  { match: /swarovski/i, ctx: (s) => ({ brand: "Swarovski", industry: "Luxury Jewelry & Crystal", category: "Pendants & Necklaces", material: "Lead-glass crystal with rhodium plating", primaryColor: "White", currency: "EUR", price: "129.00", taxonomy: ["Jewelry / Necklaces", "Jewelry / Earrings", "Jewelry / Bracelets", "Watches", "Home / Decoration"], imageDesc: titleFromSlug(s) + " on a soft grey reflective surface, studio lighting catching crystal facets" }) },
  { match: /nike|adidas|puma|asics|newbalance|onrunning|hoka/i, ctx: () => ({ industry: "Athletic Footwear & Apparel", category: "Performance Footwear", material: "Engineered mesh upper with foam midsole", primaryColor: "Black/White", currency: "EUR", price: "139.99", taxonomy: ["Footwear / Running", "Footwear / Lifestyle", "Apparel / Performance", "Accessories"], imageDesc: "Three-quarter side view of running shoe on white seamless background, side profile of mesh upper visible" }) },
  { match: /sephora|ulta|loreal|douglas|notino/i, ctx: () => ({ industry: "Beauty & Personal Care", category: "Skincare & Makeup", material: "Cosmetic formulation", primaryColor: "—", currency: "EUR", price: "39.00", taxonomy: ["Skincare", "Makeup", "Fragrance", "Haircare", "Tools"], imageDesc: "Product bottle on soft pink background, dropper visible, ingredient label readable" }) },
  { match: /zara|hm|uniqlo|mango|cos|asos|zalando/i, ctx: (s) => ({ industry: "Fashion & Apparel", category: "Apparel", material: "Cotton blend", primaryColor: "Stone", currency: "EUR", price: "59.95", taxonomy: ["Women / Tops", "Women / Bottoms", "Men / Tops", "Men / Bottoms", "Kids", "Accessories"], imageDesc: titleFromSlug(s) + " on neutral model, full-body on white seamless background" }) },
  { match: /ikea|wayfair|maisonsdumonde/i, ctx: (s) => ({ industry: "Home & Furniture", category: "Furniture", material: "FSC-certified oak veneer", primaryColor: "Natural oak", currency: "EUR", price: "249.00", taxonomy: ["Living Room", "Bedroom", "Kitchen", "Dining", "Outdoor", "Storage"], imageDesc: titleFromSlug(s) + " styled in a minimalist Scandinavian living room with natural light" }) },
  { match: /amazon|ebay|otto|bol\.com|mediamarkt/i, ctx: () => ({ industry: "General Marketplace", category: "Electronics & Lifestyle", material: "—", primaryColor: "—", currency: "EUR", price: "—", taxonomy: ["Electronics", "Home & Kitchen", "Fashion", "Beauty", "Sports", "Books"], imageDesc: "Product on white background, marketplace-standard catalog photo" }) },
  { match: /merino|wool|knit|acme-apparel/i, ctx: () => ({ brand: "Acme Apparel", industry: "Premium Apparel", category: "Knitwear", material: "100% Italian merino wool, 19.5-micron yarn from Biella", primaryColor: "Charcoal", currency: "EUR", price: "189.00", taxonomy: ["Knitwear", "Outerwear", "Accessories"], imageDesc: "Charcoal grey merino wool crew-neck sweater on white background, ribbed collar and cuffs visible" }) },
];

function titleFromSlug(slug: string): string {
  if (!slug) return "Featured Product";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w))
    .slice(0, 6)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function inferProductContext(rawUrl: string): ProductContext {
  let url: URL | null = null;
  try {
    url = new URL(rawUrl.startsWith("http") || rawUrl.startsWith("sku://") ? rawUrl : `https://${rawUrl}`);
  } catch { /* noop */ }
  const domain = url ? url.hostname.replace(/^www\./, "") : rawUrl.slice(0, 40);
  const brandGuess = domain.split(".")[0].replace(/-/g, " ");
  // Find the longest "wordy" path segment as the product slug
  const segments = url ? url.pathname.split("/").filter((s) => s && s.length > 2 && !/^[a-z]{2}-[A-Z]{2}$/.test(s) && !/^p-/.test(s)) : [];
  const productSlug = segments.sort((a, b) => b.length - a.length)[0] ?? "";
  const productName = productSlug ? titleFromSlug(productSlug) : `${brandGuess[0].toUpperCase()}${brandGuess.slice(1)} Featured Product`;

  let base: Partial<ProductContext> = {};
  for (const k of KNOWN) {
    if (k.match.test(rawUrl) || k.match.test(domain)) {
      base = k.ctx(productSlug);
      break;
    }
  }

  const rng = mulberry32(hashStr(domain + productName));
  const skuPrefix = (base.brand ?? brandGuess).slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  const sku = `${skuPrefix}-${seededInt(rng, 1000, 9999)}`;

  return {
    brand: base.brand ?? (brandGuess[0].toUpperCase() + brandGuess.slice(1)),
    productName: base.productName ?? productName,
    category: base.category ?? "Featured Products",
    domain,
    currency: base.currency ?? "EUR",
    price: base.price ?? `${seededInt(rng, 29, 499)}.00`,
    sku,
    material: base.material ?? "—",
    primaryColor: base.primaryColor ?? "—",
    imageDesc: base.imageDesc ?? `${productName} product photo on white background`,
    handle: productSlug || productName.toLowerCase().replace(/\s+/g, "-"),
    taxonomy: base.taxonomy ?? ["Featured", "Collections", "Categories", "Sale"],
    industry: base.industry ?? "E-commerce",
  };
}

export const DEMO_CTX: ProductContext = inferProductContext("https://acme-apparel.myshopify.com/products/merino-crew-charcoal");

// ─── Fix templates (context-aware) ──────────────────────────────────────
export function fixTemplateFor(f: Failure, ctx: ProductContext = DEMO_CTX): { type: string; model: string; before: string; after: string } {
  const baseUrl = `https://${ctx.domain}`;
  switch (f.failureId) {
    case "F1.1":
      return {
        type: "llms_txt",
        model: "phi4",
        before: "// No llms.txt file present at /llms.txt",
        after: `# ${ctx.brand} — LLM Manifest
# Generated by epiphanAI

> ${ctx.industry}. Focus pages for AI ingestion below.

## Core Pages
- [Homepage](/) — Brand overview and category navigation
- [About](/pages/about) — Provenance, materials, sustainability
- [Sizing & Specs](/pages/specs) — Reference data

## Product Categories
${ctx.taxonomy.slice(0, 4).map((t) => `- [${t}](/collections/${t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")})`).join("\n")}

## Policies
- [Shipping & Returns](/policies/refund-policy)
- [Privacy (GDPR)](/policies/privacy-policy)`,
      };
    case "F1.2":
      return {
        type: "robots_txt",
        model: "phi4",
        before: `User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Disallow: /`,
        after: `User-agent: *
Allow: /

# GEO Accessibility — Added by epiphanAI
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /`,
      };
    case "F2.1":
      return {
        type: "schema_injection",
        model: "llama33",
        before: "// No Product JSON-LD detected on product detail pages.",
        after: `{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "${ctx.productName}",
  "image": "${baseUrl}/cdn/${ctx.handle}.webp",
  "description": "${ctx.material === "—" ? ctx.productName : ctx.material}.",
  "sku": "${ctx.sku}",
  "brand": { "@type": "Brand", "name": "${ctx.brand}" },
  "offers": {
    "@type": "Offer",
    "url": "${baseUrl}/products/${ctx.handle}",
    "priceCurrency": "${ctx.currency}",
    "price": "${ctx.price}",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "42"
  }
}`,
      };
    case "F2.2":
      return {
        type: "schema_injection",
        model: "llama33",
        before: `{ "@type": "BreadcrumbList", "itemListElement": [
  { "name": "Home" },
  { "name": "${ctx.category}" }
]}`,
        after: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "${baseUrl}/" },
    { "@type": "ListItem", "position": 2, "name": "${ctx.category}", "item": "${baseUrl}/collections/${ctx.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}" },
    { "@type": "ListItem", "position": 3, "name": "${ctx.productName}", "item": "${baseUrl}/products/${ctx.handle}" }
  ]
}`,
      };
    case "F2.3":
      return {
        type: "schema_injection",
        model: "llama33",
        before: "// Organization schema missing from <head>.",
        after: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${ctx.brand}",
  "url": "${baseUrl}",
  "logo": "${baseUrl}/logo.svg",
  "sameAs": [
    "https://instagram.com/${ctx.brand.toLowerCase().replace(/\s+/g, "")}",
    "https://linkedin.com/company/${ctx.brand.toLowerCase().replace(/\s+/g, "-")}"
  ]
}`,
      };
    case "F2.4":
      return {
        type: "schema_injection",
        model: "llama33",
        before: `{"@type":"Product","name":"${ctx.productName}",,"price":${ctx.price}}`,
        after: `{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "${ctx.productName}",
  "offers": { "@type": "Offer", "price": "${ctx.price}", "priceCurrency": "${ctx.currency}" }
}`,
      };
    case "F3.1":
      return {
        type: "copy_rewrite",
        model: "llama33",
        before: `${ctx.productName}. ${ctx.material === "—" ? "Available now." : ctx.material + "."}`,
        after: `${ctx.material === "—" ? ctx.productName : ctx.material} — ${ctx.productName} is engineered for the way ${ctx.industry.toLowerCase()} customers actually use it: built to last, easy to care for, and grounded in real provenance. Sourced and finished with quality controls that are documented end-to-end.

**Best for:** everyday use, gift occasions, and as a long-term staple in the ${ctx.category.toLowerCase()} category. Pairs naturally with the rest of the ${ctx.brand} catalog.

**Care & specs:** follow brand care guidance on the product label; warranty and returns covered per policy. Material specifications and dimensions verified per SKU ${ctx.sku}.

**FAQ — Is it true to size?** Yes, true to standard sizing for the ${ctx.category}. **Where does it ship from?** EU fulfillment center, 2–4 business days.

Available in ${ctx.primaryColor === "—" ? "multiple finishes" : ctx.primaryColor + " and complementary tones"}. Designed and quality-controlled by ${ctx.brand}.`,
      };
    case "F3.2":
      return {
        type: "copy_rewrite",
        model: "llama33",
        before: "// No FAQPage schema on site.",
        after: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "Is the ${ctx.productName} true to size?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — standard sizing for ${ctx.category}." }},
    { "@type": "Question", "name": "Do you ship to the EU?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — free EU shipping over €100, 2–4 business days." }}
  ]
}`,
      };
    case "F3.3":
      return {
        type: "copy_rewrite",
        model: "llama33",
        before: `${ctx.productName} — a great choice.`,
        after: `Best for everyday ${ctx.category.toLowerCase()} use, gifting, and as a staple in the ${ctx.brand} line. Compared to entry-level alternatives, the ${ctx.productName} delivers measurably better durability and finish. Pairs well across the broader ${ctx.industry.toLowerCase()} category.`,
      };
    case "F4.1":
      return {
        type: "alt_text",
        model: "vision",
        before: `<img src="${ctx.handle}.webp" alt="">`,
        after: `<img src="${ctx.handle}.webp" alt="${ctx.imageDesc}">`,
      };
    case "F4.2":
      return {
        type: "alt_text",
        model: "vision",
        before: `<img src="..." alt="IMG_4521.jpg">`,
        after: `<img src="..." alt="${ctx.imageDesc}">`,
      };
    case "F1.5":
      return {
        type: "canonical",
        model: "phi4",
        before: "// 12 product pages: no canonical link.",
        after: `<link rel="canonical" href="${baseUrl}/products/${ctx.handle}" />`,
      };
    case "F4.4":
      return {
        type: "image_format",
        model: "phi4",
        before: `${ctx.handle}.jpg (412 KB)`,
        after: `${ctx.handle}.webp (118 KB) — 71% size reduction`,
      };
    default:
      return {
        type: "generic",
        model: "phi4",
        before: "// Manual review required",
        after: "// Manual review required",
      };
  }
}

export function describeFix(f: Pick<Failure, "failureId" | "failureName" | "pillar">, ctx: ProductContext = DEMO_CTX): {
  title: string;
  detail: string;
} {
  switch (f.failureId) {
    case "F1.1": return { title: "llms.txt manifest published", detail: `Created /llms.txt for ${ctx.brand} with prioritized URLs (homepage, ${ctx.taxonomy.slice(0, 2).join(", ")}, policies).` };
    case "F1.2": return { title: "robots.txt opened to AI crawlers", detail: "Allowed GPTBot, OAI-SearchBot, PerplexityBot and ClaudeBot. Previous Disallow rule snapshot stored." };
    case "F1.5": return { title: "Canonical tags injected", detail: `Added rel=canonical for ${ctx.productName} (SKU ${ctx.sku}) and 11 sibling product pages.` };
    case "F2.1": return { title: "Product JSON-LD deployed", detail: `Injected schema.org/Product markup for ${ctx.productName} — name, sku, price (${ctx.currency} ${ctx.price}), brand, offers, aggregateRating.` };
    case "F2.2": return { title: "BreadcrumbList repaired", detail: `Added required position fields (1→Home, 2→${ctx.category}, 3→${ctx.productName}) and absolute item URLs.` };
    case "F2.3": return { title: "Organization schema added", detail: `Published Organization JSON-LD for ${ctx.brand} with logo and sameAs links.` };
    case "F2.4": return { title: "Malformed JSON-LD rewritten", detail: "Repaired 3 unparseable Product blocks (trailing commas, missing offer wrappers)." };
    case "F3.1": return { title: "Product description expanded", detail: `Rewrote thin copy for ${ctx.productName} from 8 to 412 words — added materials, use-cases, care, and FAQ block.` };
    case "F3.2": return { title: "FAQPage schema deployed", detail: `Added structured Q&A covering sizing, material, and EU shipping for ${ctx.productName}.` };
    case "F3.3": return { title: "Scenario language added", detail: `Inserted 'best for…' use-cases and competitor comparisons into ${ctx.productName} copy.` };
    case "F4.1": return { title: `Alt-text generated for ${ctx.brand} images`, detail: `Vision model wrote descriptive alt text — colour, material, ${ctx.category} type, setting.` };
    case "F4.2": return { title: "Generic filename alts replaced", detail: `Replaced 47 'IMG_*.jpg' alt strings with descriptive text from vision model for ${ctx.brand} catalog.` };
    case "F4.4": return { title: "Images converted to WebP", detail: "All product imagery re-encoded to WebP — average 71% size reduction (412KB → 118KB)." };
    case "F5.1":
    case "F5.2": return { title: "SoV remediation plan queued", detail: `Probe results stored; outreach + content roadmap drafted for ${ctx.brand} vs category competitors.` };
    default: return { title: `${f.failureName} resolved`, detail: "Fix deployed to the live store." };
  }
}

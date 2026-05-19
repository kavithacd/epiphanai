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
    factPreservation: number; // 0-100
    semanticDensity: number;
    structuralSyntax: number;
    objectAccuracy: number;
    overall: "PASS" | "FAIL";
  };
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

// Seeded failure catalog used by the simulator
export const FAILURE_CATALOG: Omit<Failure, "id" | "auditId" | "status" | "detectedAt" | "fix">[] = [
  // P1
  { pillar: "P1", failureId: "F1.1", failureName: "Missing llms.txt", severity: "CRITICAL", detail: "No /llms.txt manifest detected. AI crawlers cannot discover content priorities.", isAutofixable: true, requiresHuman: false },
  { pillar: "P1", failureId: "F1.2", failureName: "GPTBot blocked in robots.txt", severity: "CRITICAL", detail: "User-agent GPTBot is explicitly disallowed from /. Store is invisible to ChatGPT search.", isAutofixable: true, requiresHuman: false },
  { pillar: "P1", failureId: "F1.3", failureName: "Slow TTFB (3.2s)", severity: "HIGH", detail: "Time to first byte exceeds 2000ms threshold. AI crawlers will time out.", isAutofixable: false, requiresHuman: true },
  { pillar: "P1", failureId: "F1.5", failureName: "Missing canonical tags", severity: "MEDIUM", detail: "12 product pages lack rel=canonical declarations.", isAutofixable: true, requiresHuman: false },
  // P2
  { pillar: "P2", failureId: "F2.1", failureName: "No Product JSON-LD", severity: "CRITICAL", detail: "Product schema markup absent from all 47 product pages.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.2", failureName: "Invalid BreadcrumbList", severity: "HIGH", detail: "Breadcrumb schema present but missing required 'position' fields.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.3", failureName: "Missing Organization schema", severity: "MEDIUM", detail: "Root domain lacks Organization JSON-LD with sameAs links.", isAutofixable: true, requiresHuman: false },
  { pillar: "P2", failureId: "F2.4", failureName: "Unparseable product markup", severity: "HIGH", detail: "3 products contain malformed JSON-LD blocks.", isAutofixable: true, requiresHuman: false },
  // P3
  { pillar: "P3", failureId: "F3.1", failureName: "Thin descriptions (<150w)", severity: "CRITICAL", detail: "32 products have descriptions under 150 words. AI engines cannot extract context.", isAutofixable: false, requiresHuman: true },
  { pillar: "P3", failureId: "F3.2", failureName: "Missing FAQ schema", severity: "HIGH", detail: "No FAQPage structured data found. Loss of long-tail visibility.", isAutofixable: false, requiresHuman: true },
  { pillar: "P3", failureId: "F3.3", failureName: "No scenario content", severity: "MEDIUM", detail: "Descriptions lack 'best for X' and use-case language.", isAutofixable: false, requiresHuman: true },
  // P4
  { pillar: "P4", failureId: "F4.1", failureName: "Missing alt-text", severity: "HIGH", detail: "184 product images have empty alt attributes.", isAutofixable: true, requiresHuman: true },
  { pillar: "P4", failureId: "F4.2", failureName: "Generic alt-text (DSC_*)", severity: "MEDIUM", detail: "47 images use filename-style alt text (e.g. 'IMG_4521').", isAutofixable: true, requiresHuman: true },
  { pillar: "P4", failureId: "F4.4", failureName: "Non-WebP assets", severity: "LOW", detail: "All product images served as JPEG. Larger payload, slower indexing.", isAutofixable: true, requiresHuman: false },
  // P5
  { pillar: "P5", failureId: "F5.1", failureName: "Zero brand citations", severity: "CRITICAL", detail: "Store not cited in any of 10 category probe queries via ChatGPT.", isAutofixable: false, requiresHuman: true },
  { pillar: "P5", failureId: "F5.2", failureName: "Competitor dominance", severity: "HIGH", detail: "Top competitor cited in 8/10 AI answers. Share of voice: 0%.", isAutofixable: false, requiresHuman: true },
];

export const MODEL_MATRIX = {
  phi4: { name: "Phi-4", size: "8.7B", costPer1k: 0.0, role: "Triage & Classification" },
  llama33: { name: "Llama 3.3 70B", size: "70B", costPer1k: 0.0, role: "Copywriting & JSON-LD" },
  vision: { name: "Llama 3.2-Vision", size: "11B", costPer1k: 0.0, role: "Multimodal / Alt-text" },
  judge: { name: "Llama 3.3 (Judge)", size: "70B", costPer1k: 0.0, role: "Eval Gate" },
  openai: { name: "GPT-4o (P5 probes only)", size: "cloud", costPer1k: 0.005, role: "Category probes" },
} as const;

export function fixTemplateFor(f: Failure): { type: string; model: string; before: string; after: string } {
  switch (f.failureId) {
    case "F1.1":
      return {
        type: "llms_txt",
        model: "phi4",
        before: "// No llms.txt file present at /llms.txt",
        after: `# Acme Apparel — LLM Manifest
# Generated by epiphanAI

> Premium EU-made apparel. Focus pages for AI ingestion below.

## Core Pages
- [Homepage](/) — Brand overview and category navigation
- [About](/pages/about) — Provenance, materials, sustainability
- [Sizing](/pages/sizing-guide) — Fit & measurement reference

## Product Categories
- [Jackets](/collections/jackets)
- [Knitwear](/collections/knitwear)
- [Accessories](/collections/accessories)

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
  "name": "Merino Crew Sweater",
  "image": "https://cdn.shopify.com/.../merino-crew.webp",
  "description": "100% Italian merino wool crew-neck sweater, knitted in Biella.",
  "sku": "MC-CREW-001",
  "brand": { "@type": "Brand", "name": "Acme Apparel" },
  "offers": {
    "@type": "Offer",
    "url": "https://acme.eu/products/merino-crew",
    "priceCurrency": "EUR",
    "price": "189.00",
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
  { "name": "Knitwear" }
]}`,
        after: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://acme.eu/" },
    { "@type": "ListItem", "position": 2, "name": "Knitwear", "item": "https://acme.eu/collections/knitwear" },
    { "@type": "ListItem", "position": 3, "name": "Merino Crew", "item": "https://acme.eu/products/merino-crew" }
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
  "name": "Acme Apparel",
  "url": "https://acme.eu",
  "logo": "https://acme.eu/logo.svg",
  "sameAs": [
    "https://instagram.com/acmeapparel",
    "https://linkedin.com/company/acme-apparel"
  ]
}`,
      };
    case "F2.4":
      return {
        type: "schema_injection",
        model: "llama33",
        before: `{"@type":"Product","name":"Cashmere Scarf",,"price":129}`,
        after: `{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Cashmere Scarf",
  "offers": { "@type": "Offer", "price": "129.00", "priceCurrency": "EUR" }
}`,
      };
    case "F3.1":
      return {
        type: "copy_rewrite",
        model: "llama33",
        before: `Soft merino crew. Made in Italy. Available in 4 colours.`,
        after: `Crafted from 100% Italian merino wool sourced in Biella, this crew-neck sweater is the year-round workhorse for capsule wardrobes. The 19.5-micron yarn is fine enough to wear next to skin, breathable enough for spring, and dense enough to layer through autumn. Reinforced ribbing at the collar, cuffs and hem holds its shape after dozens of cold washes.

**Best for:** office layering, smart-casual dinners, weekend coats. Pairs naturally with denim, wool trousers and selvedge chinos.

**Care:** cold hand-wash or wool cycle, dry flat. Avoid tumble drying. Pilling resistance verified at 4.5/5 on the Martindale scale.

**FAQ — Does it run small?** No. We use true EU sizing — order your normal size. **Is it itchy?** No. 19.5-micron merino is below the skin's prickle threshold.

Available in Charcoal, Stone, Forest and Ecru. Designed in Stockholm, knitted in Italy. Carbon-traceable supply chain.`,
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
    { "@type": "Question", "name": "Is merino itchy?", "acceptedAnswer": { "@type": "Answer", "text": "No. Our 19.5-micron yarn is below the prickle threshold." }},
    { "@type": "Question", "name": "Do you ship to the EU?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — free EU shipping over €100, 2–4 business days." }}
  ]
}`,
      };
    case "F3.3":
      return {
        type: "copy_rewrite",
        model: "llama33",
        before: `A timeless crew sweater.`,
        after: `Best for office layering, smart-casual dinners, and weekend wear. Compared to traditional lambswool, our merino is finer and less prone to pilling. Pairs naturally with selvedge denim or wool trousers.`,
      };
    case "F4.1":
      return {
        type: "alt_text",
        model: "vision",
        before: `<img src="merino-crew-charcoal.webp" alt="">`,
        after: `<img src="merino-crew-charcoal.webp" alt="Charcoal grey merino wool crew-neck sweater on white background, ribbed collar and cuffs visible">`,
      };
    case "F4.2":
      return {
        type: "alt_text",
        model: "vision",
        before: `<img src="..." alt="IMG_4521.jpg">`,
        after: `<img src="..." alt="Stone-coloured cashmere scarf draped over wooden chair, soft natural light from window">`,
      };
    case "F1.5":
      return {
        type: "canonical",
        model: "phi4",
        before: "// 12 product pages: no canonical link.",
        after: `<link rel="canonical" href="https://acme.eu/products/merino-crew" />`,
      };
    case "F4.4":
      return {
        type: "image_format",
        model: "phi4",
        before: "merino-crew-charcoal.jpg (412 KB)",
        after: "merino-crew-charcoal.webp (118 KB) — 71% size reduction",
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

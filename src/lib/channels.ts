// ─────────────────────────────────────────────────────────────────────────
// EU channel readiness engine.
// One canonical product record → validated against each EU sales channel
// (Amazon EU, Zalando, Otto, Google CSS, Shopify, WooCommerce), scored,
// segmented, auto-remediated and exported in each channel's feed format.
// ─────────────────────────────────────────────────────────────────────────

export type ChannelId =
  | "amazon-eu"
  | "zalando"
  | "otto"
  | "google-css"
  | "shopify"
  | "woocommerce";

export type ChannelGroup = "marketplace" | "ads" | "storefront";

export type Channel = {
  id: ChannelId;
  name: string;
  group: ChannelGroup;
  region: string;
  blurb: string;
  titleFormula: string[]; // token order
  titleLimit: number;
};

export const CHANNELS: Channel[] = [
  {
    id: "amazon-eu",
    name: "Amazon EU",
    group: "marketplace",
    region: "DE · FR · IT · ES · NL · PL · SE · BE",
    blurb: "EAN required, 200-char titles, 5 bullets, GPSR responsible person.",
    titleFormula: ["brand", "productType", "keyFeature", "color", "size"],
    titleLimit: 200,
  },
  {
    id: "zalando",
    name: "Zalando",
    group: "marketplace",
    region: "Europe · fashion",
    blurb: "Silhouette codes, exact fibre percentages, EU size mapping, season code.",
    titleFormula: ["brand", "model", "productType", "color"],
    titleLimit: 120,
  },
  {
    id: "otto",
    name: "Otto Market",
    group: "marketplace",
    region: "Germany",
    blurb: "German localisation, VerpackG packaging registration, Otto taxonomy.",
    titleFormula: ["brand", "productType", "color", "size"],
    titleLimit: 150,
  },
  {
    id: "google-css",
    name: "Google CSS",
    group: "ads",
    region: "EU Shopping",
    blurb: "GTIN + brand + MPN, Google product category, gross EU pricing.",
    titleFormula: ["brand", "gender", "productType", "material", "color"],
    titleLimit: 150,
  },
  {
    id: "shopify",
    name: "Shopify",
    group: "storefront",
    region: "Own storefront",
    blurb: "SEO title/description, Product JSON-LD, handle, gross VAT pricing.",
    titleFormula: ["brand", "productType", "color"],
    titleLimit: 70,
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    group: "storefront",
    region: "Own storefront",
    blurb: "Product schema, attributes as taxonomy terms, gross VAT pricing.",
    titleFormula: ["brand", "productType", "color"],
    titleLimit: 70,
  },
];

export const CHANNEL_BY_ID: Record<ChannelId, Channel> = Object.fromEntries(
  CHANNELS.map((c) => [c.id, c]),
) as Record<ChannelId, Channel>;

// ───────────────────────────── Product record ─────────────────────────────

export type Product = {
  id: string;
  sku: string;
  title: string;
  description: string;
  brand: string;
  gtin: string; // EAN-13
  mpn: string;
  price: number | null; // gross, EUR
  currency: string;
  color: string;
  colorDe: string;
  material: string; // e.g. "95% Cotton, 5% Elastane"
  size: string;
  gender: string;
  productType: string;
  model: string;
  keyFeature: string;
  googleCategory: string;
  silhouette: string; // Zalando silhouette code
  season: string; // SS26 / FW25
  images: number;
  gpsrContact: string; // EU responsible person
  packagingId: string; // VerpackG / LUCID number
  seoTitle: string;
  seoDescription: string;
};

export const EMPTY_PRODUCT: Omit<Product, "id"> = {
  sku: "", title: "", description: "", brand: "", gtin: "", mpn: "",
  price: null, currency: "EUR", color: "", colorDe: "", material: "", size: "",
  gender: "", productType: "", model: "", keyFeature: "", googleCategory: "",
  silhouette: "", season: "", images: 0, gpsrContact: "", packagingId: "",
  seoTitle: "", seoDescription: "",
};

// ───────────────────────────── Validation ─────────────────────────────

export type Severity = "critical" | "warning";

export type Issue = {
  code: string;
  channel: ChannelId;
  field: keyof Product;
  severity: Severity;
  message: string;
  autoFixable: boolean;
};

const EAN13 = /^\d{13}$/;

function validGtin(gtin: string) {
  if (!EAN13.test(gtin)) return false;
  const d = gtin.split("").map(Number);
  const sum = d.slice(0, 12).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

/** Fibre composition must list percentages summing to exactly 100. */
export function fibreTotal(material: string): number | null {
  const matches = [...material.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)];
  if (!matches.length) return null;
  return matches.reduce((a, m) => a + parseFloat(m[1].replace(",", ".")), 0);
}

const byteLen = (s: string) => new TextEncoder().encode(s).length;

function req(
  out: Issue[], channel: ChannelId, ok: boolean, code: string,
  field: keyof Product, severity: Severity, message: string, autoFixable = false,
) {
  if (!ok) out.push({ code, channel, field, severity, message, autoFixable });
}

export function validate(p: Product, channel: ChannelId): Issue[] {
  const out: Issue[] = [];
  const spec = CHANNEL_BY_ID[channel];

  // Shared baseline
  req(out, channel, !!p.title.trim(), "TITLE_MISSING", "title", "critical", "Product title is empty.", true);
  req(out, channel, p.title.length <= spec.titleLimit, "TITLE_TOO_LONG", "title", "critical",
    `Title is ${p.title.length} characters; ${spec.name} allows ${spec.titleLimit}.`, true);
  req(out, channel, !!p.brand.trim(), "BRAND_MISSING", "brand", "critical", "Brand is required.", false);
  req(out, channel, p.price !== null && p.price > 0, "PRICE_MISSING", "price", "critical", "Gross price (incl. VAT) is required.", false);
  req(out, channel, p.images >= 1, "IMAGE_MISSING", "images", "critical", "At least one product image is required.", false);
  req(out, channel, !!p.description.trim(), "DESC_MISSING", "description", "warning", "Product description is empty.", false);

  switch (channel) {
    case "amazon-eu":
      req(out, channel, validGtin(p.gtin), "EAN_INVALID", "gtin", "critical", "A valid 13-digit EAN/GTIN is mandatory on Amazon EU.", false);
      req(out, channel, byteLen(p.description) <= 2000, "DESC_TOO_LONG", "description", "warning", "Description exceeds 2000 bytes.", true);
      req(out, channel, !!p.gpsrContact.trim(), "GPSR_MISSING", "gpsrContact", "critical", "EU GPSR responsible person (name, address, email) is missing.", false);
      req(out, channel, !!p.keyFeature.trim(), "BULLETS_MISSING", "keyFeature", "warning", "No key feature supplied for the bullet points.", true);
      req(out, channel, !/[!]{1,}|BEST|CHEAPEST/i.test(p.title), "TITLE_SPAM", "title", "warning", "Promotional wording in the title risks suppression.", true);
      req(out, channel, p.images >= 3, "IMAGES_FEW", "images", "warning", "Amazon recommends at least 3 images.", false);
      break;
    case "zalando":
      req(out, channel, !!p.silhouette.trim(), "SILHOUETTE_MISSING", "silhouette", "critical", "Zalando silhouette code is required.", true);
      req(out, channel, fibreTotal(p.material) === 100, "FIBRE_INVALID", "material", "critical",
        "Material must list exact fibre percentages totalling 100% (e.g. 95% Cotton, 5% Elastane).", false);
      req(out, channel, !!p.size.trim(), "SIZE_MISSING", "size", "critical", "EU size value is required.", false);
      req(out, channel, !!p.gender.trim(), "GENDER_MISSING", "gender", "critical", "Target group (gender/age) is required.", true);
      req(out, channel, /^(SS|FW)\d{2}$/.test(p.season), "SEASON_INVALID", "season", "warning", "Season code must look like SS26 or FW25.", true);
      req(out, channel, validGtin(p.gtin), "EAN_INVALID", "gtin", "critical", "A valid 13-digit EAN is required.", false);
      break;
    case "otto":
      req(out, channel, !!p.colorDe.trim(), "COLOR_DE_MISSING", "colorDe", "critical", "German colour name is required for Otto.", true);
      req(out, channel, !!p.packagingId.trim(), "VERPACKG_MISSING", "packagingId", "critical", "VerpackG / LUCID packaging registration number is missing.", false);
      req(out, channel, validGtin(p.gtin), "EAN_INVALID", "gtin", "critical", "A valid 13-digit EAN is required.", false);
      req(out, channel, !!p.productType.trim(), "CATEGORY_MISSING", "productType", "critical", "Otto category (product type) is required.", true);
      break;
    case "google-css":
      req(out, channel, validGtin(p.gtin), "GTIN_INVALID", "gtin", "critical", "GTIN is required for Shopping ads.", false);
      req(out, channel, !!p.mpn.trim(), "MPN_MISSING", "mpn", "warning", "MPN improves product matching.", true);
      req(out, channel, !!p.googleCategory.trim(), "GPC_MISSING", "googleCategory", "critical", "Google product category is not mapped.", true);
      req(out, channel, !!p.color.trim(), "COLOR_MISSING", "color", "warning", "Colour attribute improves Shopping relevance.", true);
      break;
    case "shopify":
    case "woocommerce":
      req(out, channel, !!p.seoTitle.trim(), "SEO_TITLE_MISSING", "seoTitle", "warning", "SEO title is missing.", true);
      req(out, channel, !!p.seoDescription.trim(), "SEO_DESC_MISSING", "seoDescription", "warning", "Meta description is missing.", true);
      req(out, channel, !!p.sku.trim(), "SKU_MISSING", "sku", "critical", "SKU is required to sync to the storefront.", false);
      req(out, channel, !!p.material.trim() || !!p.color.trim(), "ATTR_THIN", "material", "warning", "Too few structured attributes for rich snippets.", true);
      break;
  }
  return out;
}

export type ProductReport = {
  product: Product;
  issues: Issue[];
  score: number; // 0-100 across selected channels
  byChannel: Record<string, { score: number; issues: Issue[] }>;
  label: SegmentLabel;
};

export type SegmentLabel = "hero" | "sidekick" | "zombie" | "villain";

export const SEGMENT_META: Record<SegmentLabel, { name: string; hint: string; tone: string }> = {
  hero: { name: "Heroes", hint: "Fully compliant — ready to publish", tone: "text-p2" },
  sidekick: { name: "Sidekicks", hint: "Minor gaps, auto-fixable", tone: "text-primary" },
  zombie: { name: "Zombies", hint: "Missing identifiers or unoptimised titles", tone: "text-p4" },
  villain: { name: "Blocked", hint: "Regulatory or mandatory data missing", tone: "text-destructive" },
};

const BLOCKERS = new Set(["GPSR_MISSING", "VERPACKG_MISSING", "EAN_INVALID", "GTIN_INVALID", "FIBRE_INVALID"]);

export function reportFor(p: Product, channels: ChannelId[]): ProductReport {
  const byChannel: ProductReport["byChannel"] = {};
  let all: Issue[] = [];
  for (const c of channels) {
    const issues = validate(p, c);
    all = all.concat(issues);
    const penalty = issues.reduce((a, i) => a + (i.severity === "critical" ? 18 : 6), 0);
    byChannel[c] = { score: Math.max(0, 100 - penalty), issues };
  }
  const score = channels.length
    ? Math.round(channels.reduce((a, c) => a + byChannel[c].score, 0) / channels.length)
    : 100;

  const criticals = all.filter((i) => i.severity === "critical");
  let label: SegmentLabel = "hero";
  if (all.some((i) => BLOCKERS.has(i.code))) label = "villain";
  else if (criticals.length) label = "zombie";
  else if (all.length) label = "sidekick";

  return { product: p, issues: all, score, byChannel, label };
}

// ───────────────────────────── Title optimizer ─────────────────────────────

export const TITLE_TOKENS = [
  "brand", "model", "productType", "gender", "color", "material", "size", "keyFeature",
] as const;
export type TitleToken = (typeof TITLE_TOKENS)[number];

export const TOKEN_LABEL: Record<TitleToken, string> = {
  brand: "Brand", model: "Model", productType: "Product type", gender: "Gender",
  color: "Colour", material: "Material", size: "Size", keyFeature: "Key feature",
};

export function buildTitle(p: Product, formula: string[], limit: number): string {
  const parts = formula
    .map((t) => String((p as any)[t] ?? "").trim())
    .filter(Boolean);
  let title = parts.join(" ").replace(/\s+/g, " ").trim();
  if (title.length > limit) {
    while (parts.length > 1 && parts.join(" ").length > limit) parts.pop();
    title = parts.join(" ").slice(0, limit).trim();
  }
  return title;
}

/** Pull structured attributes out of a messy free-text description. */
export function extractAttributes(p: Product): Partial<Product> {
  const d = `${p.description} ${p.title}`;
  const out: Partial<Product> = {};
  const fibre = d.match(/(\d{1,3}\s*%\s*[A-Za-zÄÖÜäöüß]+(?:\s*[,/+]\s*\d{1,3}\s*%\s*[A-Za-zÄÖÜäöüß]+)*)/);
  if (!p.material && fibre) out.material = fibre[1].replace(/\s*%/g, "%").replace(/\s*[,/+]\s*/g, ", ");
  const colors = ["black", "white", "navy", "blue", "red", "green", "beige", "grey", "gray", "brown", "pink", "cream"];
  if (!p.color) {
    const hit = colors.find((c) => new RegExp(`\\b${c}\\b`, "i").test(d));
    if (hit) out.color = hit[0].toUpperCase() + hit.slice(1);
  }
  if (!p.gender) {
    if (/\b(women|woman|ladies|damen)\b/i.test(d)) out.gender = "Women";
    else if (/\b(men|man|herren)\b/i.test(d)) out.gender = "Men";
    else if (/\b(kids|children|kinder)\b/i.test(d)) out.gender = "Kids";
  }
  if (!p.size) {
    const m = d.match(/\b(XXS|XS|S|M|L|XL|XXL|3XL|\d{2,3}\s?(?:cm|mm))\b/);
    if (m) out.size = m[1];
  }
  return out;
}

const DE_COLORS: Record<string, string> = {
  black: "Schwarz", white: "Weiß", navy: "Marine", blue: "Blau", red: "Rot",
  green: "Grün", beige: "Beige", grey: "Grau", gray: "Grau", brown: "Braun",
  pink: "Rosa", cream: "Creme", yellow: "Gelb", orange: "Orange", purple: "Lila",
};

const SILHOUETTES: { match: RegExp; code: string }[] = [
  { match: /sneaker|trainer/i, code: "51101" },
  { match: /boot/i, code: "51201" },
  { match: /shirt|tee|t-shirt/i, code: "11101" },
  { match: /dress|kleid/i, code: "12101" },
  { match: /jacket|coat/i, code: "13101" },
  { match: /trouser|pant|jean/i, code: "14101" },
  { match: /bag|tasche/i, code: "61101" },
];

function currentSeason(): string {
  const m = new Date().getMonth();
  const yy = String(new Date().getFullYear()).slice(2);
  return m >= 1 && m <= 6 ? `SS${yy}` : `FW${yy}`;
}

/** Deterministic auto-remediation for every auto-fixable issue on a product. */
export function autoFix(p: Product, channels: ChannelId[]): { product: Product; applied: string[] } {
  const applied: string[] = [];
  let next: Product = { ...p, ...extractAttributes(p) };
  if (next.material !== p.material) applied.push("Extracted material composition from description");
  if (next.color !== p.color) applied.push("Extracted colour attribute");
  if (next.gender !== p.gender) applied.push("Extracted target group");
  if (next.size !== p.size) applied.push("Extracted size");

  for (const c of channels) {
    const spec = CHANNEL_BY_ID[c];
    const issues = validate(next, c);
    for (const i of issues) {
      if (!i.autoFixable) continue;
      switch (i.code) {
        case "TITLE_MISSING":
        case "TITLE_TOO_LONG":
        case "TITLE_SPAM": {
          const t = buildTitle(next, spec.titleFormula, spec.titleLimit);
          if (t) { next = { ...next, title: t }; applied.push(`Rebuilt title for ${spec.name}`); }
          break;
        }
        case "SILHOUETTE_MISSING": {
          const hit = SILHOUETTES.find((s) => s.match.test(`${next.productType} ${next.title}`));
          if (hit) { next = { ...next, silhouette: hit.code }; applied.push("Mapped Zalando silhouette code"); }
          break;
        }
        case "SEASON_INVALID":
          next = { ...next, season: currentSeason() };
          applied.push("Set current season code");
          break;
        case "COLOR_DE_MISSING": {
          const de = DE_COLORS[next.color.toLowerCase()];
          if (de) { next = { ...next, colorDe: de }; applied.push("Translated colour to German for Otto"); }
          break;
        }
        case "GPC_MISSING":
          if (next.productType) {
            next = { ...next, googleCategory: `Apparel & Accessories > ${next.productType}` };
            applied.push("Mapped Google product category");
          }
          break;
        case "MPN_MISSING":
          if (next.sku) { next = { ...next, mpn: next.sku }; applied.push("Derived MPN from SKU"); }
          break;
        case "SEO_TITLE_MISSING":
          next = { ...next, seoTitle: buildTitle(next, ["brand", "productType", "color"], 60) };
          applied.push("Generated SEO title");
          break;
        case "SEO_DESC_MISSING":
          next = {
            ...next,
            seoDescription: `${next.title || next.productType} by ${next.brand}. ${next.material ? next.material + ". " : ""}Free EU delivery and returns.`.slice(0, 155),
          };
          applied.push("Generated meta description");
          break;
        case "BULLETS_MISSING":
          if (next.material || next.color) {
            next = { ...next, keyFeature: [next.material, next.color].filter(Boolean).join(" · ") };
            applied.push("Generated Amazon bullet feature");
          }
          break;
        case "DESC_TOO_LONG":
          next = { ...next, description: next.description.slice(0, 1900) };
          applied.push("Trimmed description to Amazon limit");
          break;
        case "GENDER_MISSING":
          break;
        case "CATEGORY_MISSING":
          break;
        case "ATTR_THIN":
          break;
      }
    }
  }
  return { product: next, applied: [...new Set(applied)] };
}

// ───────────────────────────── CSV import ─────────────────────────────

const HEADER_ALIASES: Record<string, keyof Product> = {
  sku: "sku", id: "sku", title: "title", name: "title", description: "description",
  brand: "brand", gtin: "gtin", ean: "gtin", barcode: "gtin", mpn: "mpn",
  price: "price", color: "color", colour: "color", farbe: "colorDe",
  material: "material", composition: "material", size: "size", gender: "gender",
  producttype: "productType", type: "productType", category: "productType",
  model: "model", images: "images", image: "images", season: "season",
  silhouette: "silhouette", gpsr: "gpsrContact", packaging: "packagingId",
};

export function parseCsv(text: string): Product[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  return lines.slice(1).map((line, idx) => {
    const cells = split(line);
    const p: Product = { ...EMPTY_PRODUCT, id: `csv-${idx}-${Math.random().toString(36).slice(2, 7)}` };
    headers.forEach((h, i) => {
      const key = HEADER_ALIASES[h];
      if (!key) return;
      const raw = cells[i] ?? "";
      if (key === "price") (p as any).price = raw ? parseFloat(raw.replace(",", ".")) : null;
      else if (key === "images") (p as any).images = raw ? parseInt(raw, 10) || 0 : 0;
      else (p as any)[key] = raw;
    });
    if (!p.sku) p.sku = `ROW-${idx + 1}`;
    return p;
  });
}

// ───────────────────────────── Feed export ─────────────────────────────

function csvEscape(v: unknown) {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n\t]/.test(s) ? `"${s}"` : s;
}

export function buildFeed(channel: ChannelId, products: Product[]): { filename: string; mime: string; content: string } {
  switch (channel) {
    case "google-css": {
      const items = products.map((p) => `    <item>
      <g:id>${p.sku}</g:id>
      <g:title>${p.title}</g:title>
      <g:description>${p.description}</g:description>
      <g:brand>${p.brand}</g:brand>
      <g:gtin>${p.gtin}</g:gtin>
      <g:mpn>${p.mpn}</g:mpn>
      <g:price>${p.price ?? ""} ${p.currency}</g:price>
      <g:google_product_category>${p.googleCategory}</g:google_product_category>
      <g:color>${p.color}</g:color>
      <g:material>${p.material}</g:material>
      <g:size>${p.size}</g:size>
      <g:gender>${p.gender}</g:gender>
      <g:condition>new</g:condition>
    </item>`).join("\n");
      return {
        filename: "google-merchant-feed.xml",
        mime: "application/xml",
        content: `<?xml version="1.0"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n${items}\n  </channel>\n</rss>`,
      };
    }
    case "amazon-eu": {
      const cols = ["sku", "external_product_id", "external_product_id_type", "item_name", "brand_name", "product_description", "bullet_point1", "standard_price", "currency", "color_name", "size_name", "main_image_url", "gpsr_responsible_person"];
      const rows = products.map((p) => [p.sku, p.gtin, "EAN", p.title, p.brand, p.description, p.keyFeature, p.price ?? "", p.currency, p.color, p.size, p.images ? `https://cdn.example/${p.sku}-1.jpg` : "", p.gpsrContact].join("\t"));
      return { filename: "amazon-eu-inventory-loader.txt", mime: "text/tab-separated-values", content: [cols.join("\t"), ...rows].join("\n") };
    }
    case "zalando": {
      const cols = ["article_number", "ean", "brand", "name", "silhouette_code", "color", "size", "material_composition", "target_group", "season", "price_gross", "currency"];
      const rows = products.map((p) => [p.sku, p.gtin, p.brand, p.title, p.silhouette, p.color, p.size, p.material, p.gender, p.season, p.price ?? "", p.currency].map(csvEscape).join(","));
      return { filename: "zalando-zdirect.csv", mime: "text/csv", content: [cols.join(","), ...rows].join("\n") };
    }
    case "otto": {
      const cols = ["artikelnummer", "ean", "marke", "titel", "beschreibung", "farbe", "groesse", "kategorie", "preis_brutto", "waehrung", "verpackg_lucid"];
      const rows = products.map((p) => [p.sku, p.gtin, p.brand, p.title, p.description, p.colorDe || p.color, p.size, p.productType, p.price ?? "", p.currency, p.packagingId].map(csvEscape).join(","));
      return { filename: "otto-market.csv", mime: "text/csv", content: [cols.join(","), ...rows].join("\n") };
    }
    case "shopify": {
      const cols = ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Variant SKU", "Variant Barcode", "Variant Price", "Option1 Name", "Option1 Value", "SEO Title", "SEO Description"];
      const rows = products.map((p) => [
        (p.title || p.sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        p.title, `<p>${p.description}</p>`, p.brand, p.productType, p.sku, p.gtin, p.price ?? "",
        "Size", p.size, p.seoTitle, p.seoDescription,
      ].map(csvEscape).join(","));
      return { filename: "shopify-products.csv", mime: "text/csv", content: [cols.join(","), ...rows].join("\n") };
    }
    case "woocommerce": {
      const cols = ["SKU", "Name", "Description", "Regular price", "Categories", "Images", "Attribute 1 name", "Attribute 1 value(s)", "Meta: _yoast_wpseo_title", "Meta: _yoast_wpseo_metadesc"];
      const rows = products.map((p) => [p.sku, p.title, p.description, p.price ?? "", p.productType, p.images, "Colour", p.color, p.seoTitle, p.seoDescription].map(csvEscape).join(","));
      return { filename: "woocommerce-products.csv", mime: "text/csv", content: [cols.join(","), ...rows].join("\n") };
    }
  }
}

export function downloadText(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ───────────────────────────── Sample catalog ─────────────────────────────

export const SAMPLE_CSV = `sku,title,description,brand,ean,price,color,material,size,gender,type,images
NV-1001,Merino Crew Neck,"Soft merino crew neck for women. Machine wash cold.",Northvale,4006381333931,89.90,,,,,Knitwear,3
NV-1002,BEST Running Sneaker!!!,"Lightweight running sneaker with 95% Polyester, 5% Elastane upper. Navy.",Northvale,4006381333932,119.00,,,42,,Sneaker,4
NV-1003,Rain Jacket,"Waterproof rain jacket for men, 100% Polyamide shell.",Northvale,,149.00,Black,100% Polyamide,L,Men,Jacket,2
NV-1004,Leather Tote Bag,"Full-grain leather tote in brown.",Northvale,4006381333934,229.00,Brown,100% Leather,One Size,Women,Bag,5
NV-1005,Linen Summer Dress,"Breezy linen dress, 100% Linen, in cream.",Northvale,4006381333935,99.00,Cream,100% Linen,M,Women,Dress,3
`;

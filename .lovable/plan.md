## 1. Fixed already (this turn)
Failure codes renumbered contiguous: `F1.5 → F1.4`, `F4.4 → F4.3`. Applied in `epiphan-data.ts` (catalog + healed-summary switches) and `dashboard.tsx` (2 references).

---

## 2. Searchable.com competitive audit — what they do that we don't

Ranked by impact on paying-customer conversion.

| # | They have | We don't | Priority |
|---|-----------|----------|----------|
| 1 | Audience toggle on pricing: **Brands vs Agencies** (different tiers, limits, white-label) | Single-audience pricing | High |
| 2 | Pricing scales by **prompts tracked** AND **LLM engines selected** (checkboxes multiply price) | Fixed tiers | High (your ask) |
| 3 | 9 engines: ChatGPT, Google AI Overviews, Perplexity, Copilot, DeepSeek, Google AI Mode, Gemini, Grok, Claude | We reference only "ChatGPT / probes" generically | High |
| 4 | **/compare** page — head-to-head vs competitors (Profound, AthenaHQ, Peec, etc.) | None | High (your ask) |
| 5 | **Free Visibility Report** lead-gen tool (enter domain → get scan) | None | High |
| 6 | Feature pages: AEO Insights · LLM Analytics · Prompt Intelligence · Content Studio · Technical Optimisation · AI Shopping · MCP · Agent | Landing page only | Medium |
| 7 | Customers / case studies (Momentum, 303, etc.) | None | Medium |
| 8 | Resource Center (blog, guides, glossary) | None | Medium |
| 9 | White-label reports, Looker Studio, MCP, API access | Not exposed | Medium (agencies) |
| 10 | Annual billing → 20% off | Only monthly | Low |
| 11 | Solutions pages: Brands / Agencies / Enterprise | None | Low |
| 12 | Careers | — | **Skipped per your request** |

Their prompt-frequency (daily/weekly), multi-country/region tracking, and data retention tiers also gate plans.

---

## 3. Their published prices (for reference)

**Brands** — Pro $125/mo · Scale $400/mo · Custom.
**Agencies** — Launch $250/mo · Growth $400/mo · Enterprise $999+/mo · Custom.
Annual −20%. Engines beyond 3 default (ChatGPT / GAIO / Perplexity) require Enterprise/Custom.

---

## 4. Proposed Shine pricing (undercut ~15–25%, EUR)

Structure: **Audience toggle** (Brands ↔ Agencies) × **plan tier** × **engines picker**. Base plan includes N engines; each extra engine +€19/mo (annual: +€15). Falls back to current €0 free tier.

### Brands
| Plan | Price / mo | vs Searchable | Engines incl. | Prompts | Audits | SKUs | Projects |
|------|-----------|---------------|---------------|---------|--------|------|----------|
| Free | €0 | — | 1 | 25 | 2 | 25 | 1 |
| Starter | **€39** | Pro $125 (−66%) | 3 | 200 | 200 | 100 | 3 |
| Growth ★ | **€99** | Scale $400 (−73%) | 5 | 500 | 1,000 | 500 | 5 |
| Scale | **€249** | (new mid-tier) | 7 | 1,250 | 3,000 | 2,000 | 10 |
| Enterprise | Custom | Custom | 9 (all) | Custom | Custom | ∞ | ∞ |

### Agencies (multi-brand + white-label baked in)
| Plan | Price / mo | vs Searchable | Engines incl. | Prompts | Audits | Client projects |
|------|-----------|---------------|---------------|---------|--------|-----------------|
| Launch | **€199** | $250 (−20%) | 3 | 200 | 200 | 5 |
| Growth ★ | **€329** | $400 (−18%) | 5 | 500 | 1,000 | 10 |
| Enterprise | **€799** | $999 (−20%) | 7 | 1,250 | 3,000 | ∞ |
| Custom | Custom | Custom | 9 (all) | Custom | Custom | ∞ |

**Engine picker economics:** deselecting an included engine credits −€10/mo (annual −€8); adding above the base is +€19/mo. Free plan is locked to 1 engine of choice.

**Annual toggle:** −20% across all paid tiers.

**Why these numbers work:** our unit cost is dominated by AI Gateway inference per probe. At 200 prompts × 3 engines × daily = 18,000 answers/mo — call it ~€6–10 pass-through at current gateway rates. Even at Starter €39/mo we retain a 4–6× gross margin. Growth (500 prompts × 5 engines × daily = 75,000 answers ≈ €25–35 cost) still leaves €65+ margin on €99. Scale/Enterprise cover heavier competitor sets and stay comfortably above cost.

**Please confirm or tweak these numbers before I wire them in.**

---

## 5. Build plan (once prices are confirmed)

### Phase A — Pricing overhaul (delivers your headline ask)
1. Extend `src/lib/plan.ts`: add `AUDIENCE` (`"brand" | "agency"`), `ENGINES` catalog (9 providers with slug/name/logo), tier tables above, engine add-on price, annual multiplier.
2. Rewrite `src/routes/pricing.tsx`:
   - Audience toggle (Brands / Agencies)
   - Billing toggle (Monthly / Annual −20%)
   - Engine multi-select with live price recompute per tier card
   - Prompt/audit/project rows per tier
   - Comparison table matching Searchable's layout
3. Sync `PRICING_TIERS` consumers (`useMyPlan`, `UpgradeDialog`, `settings.tsx`) to the new shape without breaking existing free/enterprise gates.

### Phase B — Compare page
New route `src/routes/compare.tsx` with a matrix of Shine vs Searchable / Profound / AthenaHQ / Peec across ~12 capability rows (multi-engine, EU billing, agency white-label, auto-heal on-page, price/mo at 500 prompts, etc.). Also linked from the top nav.

### Phase C — Free Visibility Report lead magnet
Public route `/visibility-report` — enter domain, get a mock preview (uses existing `epiphan-data.ts` scoring), gated email capture to unlock full PDF export. Feeds sign-up funnel.

### Phase D — Feature pages + customers stubs (medium priority)
Skeleton routes for `/features/{aeo,llm-analytics,prompts,content,technical,shopping,mcp,agent}` and `/customers`. Content-light but SEO-complete via `seoMeta`.

Careers **out of scope** per your instruction.

---

## 6. Decisions needed from you
1. **Approve or edit the price table** in §4. Reply with any tier changes.
2. Ship Phase A only, or A+B, or all four (A–D)?
3. Confirm the 9-engine list matches what we can actually probe (any we should drop for launch?).

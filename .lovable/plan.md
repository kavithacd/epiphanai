## Goal

Make `src/lib/branding.ts` the single source of truth so a rename in one place propagates to every UI label, SEO tag, email/report template, and generated file.

## Audit results

- **No stale refs found** for `epiphanai`, `Tessera`, or `v1.0` anywhere under `src/` or `public/` — that cleanup is already complete.
- **Landing page + root SEO** already use `BRAND` correctly.
- **"Visibility Taxonomy"** appears exactly where it should (nav link, hero stat, section eyebrow), all via `BRAND.visibilityTaxonomyLabel`. AppShell has no Taxonomy nav item, so no mobile-menu/breadcrumb entry to update. The lone remaining word "Taxonomy" in `src/routes/start.tsx:45` is unrelated prose ("product taxonomy depth"), not the product feature — leave it.
- **Hardcoded "Shine" strings still to route through `BRAND`:**
  - Per-route SEO titles in `auth.tsx`, `dashboard.tsx`, `history.tsx`, `impact.tsx`, `monitoring.tsx`, `review.tsx`, `settings.tsx`, `start.tsx`, `admin.tsx` — all use literal `"… · Shine"`.
  - `src/components/AppShell.tsx` — sidebar brand label and page-title fallback.
  - `src/lib/epiphan-export.ts` — JSON report `source: "Shine"` and Slack webhook text.
  - `src/lib/epiphan-data.ts` — generated `llms.txt` / `robots.txt` template comments.
  - `src/routes/review.tsx` toast copy `"Standard Shine envelope"`.
  - `src/routes/pricing.tsx` — pricing description already partly uses `BRAND`, but the free-text "on Shine" copy hardcodes.

## Changes

### 1. `src/lib/branding.ts`
Add small helpers so callers don't rebuild strings:

- `seoTitle(page)` already exists — keep.
- Add `pageTitle(page)` alias that returns `` `${page} · ${BRAND.name}` `` for per-route `head()` (this is the exact pattern the app routes use).
- Add `reportSource` and `slackHeader(count)` helpers used by export/report code (or just export `BRAND.name` and let callers template) — simplest: keep it minimal and just import `BRAND` where needed.

### 2. Per-route SEO tags → `seoTitle(...)`
Replace hardcoded titles across:

- `src/routes/auth.tsx`, `dashboard.tsx`, `history.tsx`, `impact.tsx`, `monitoring.tsx`, `review.tsx`, `settings.tsx`, `start.tsx`, `admin.tsx`

For each, upgrade `head()` to include title + description + og:title + og:description + twitter:title + twitter:description, all derived from `BRAND` + a per-route page label + a per-route short description constant defined at the top of the file. This closes the SEO gap the user called out (currently only title is set on these routes).

### 3. `src/components/AppShell.tsx`
- Replace `"Shine"` sidebar label with `{BRAND.name}`.
- Replace `?? "Shine"` fallback with `?? BRAND.name`.
- Import `BRAND` from `@/lib/branding`.

### 4. Reports & generated files
- `src/lib/epiphan-export.ts`: import `BRAND`; use `BRAND.name` in `source` field, Slack `text`, and any other string templates.
- `src/lib/epiphan-data.ts`: import `BRAND`; use `BRAND.name` in the `llms.txt`/`robots.txt` comment headers.

### 5. Misc
- `src/routes/review.tsx` toast description → `` `Standard ${BRAND.name} envelope on your clipboard.` ``.
- `src/routes/pricing.tsx` — sweep remaining literal "Shine" strings in body copy → `{BRAND.name}` (JSX) or template literals.

### 6. Verification
- `rg -n "Shine|epiphanai|Tessera|v1\.0"` under `src/` and `public/` returns only `src/lib/branding.ts` (the definition) plus any legitimate `BRAND`-derived usages.
- Manual scan of `head()` blocks confirms every page has title + description + og:* + twitter:* driven from `BRAND`.

## Out of scope

- Renaming the actual product (still "Shine").
- Auto-generated files (`routeTree.gen.ts`, Supabase integration files) — not touched.
- The `epiphan-*` module filenames — internal identifiers only, no user-visible impact.

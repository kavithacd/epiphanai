# Scale to 100k-SKU catalogs

Move the product off client-only zustand into a server-backed pipeline: catalog ingest → job queue → per-SKU pillar checks → server-persisted failures/fixes → real observability + eval framework. Delivered in 4 phases so each ships something usable.

## Phase 1 — Persistent audit storage (foundation)

Move the audit data model from `localStorage` into Postgres. No behavior change for the single-URL flow, but every write now lands server-side and is queryable.

**Tables** (all RLS-scoped to `auth.uid()`; `service_role` for workers):

- `audits` — one row per audit run. Fields: `user_id`, `store_name`, `root_url`, `status` (pending/running/complete/failed), `sku_count`, `failure_count`, `pillar_scores jsonb`, `started_at`, `completed_at`.
- `catalog_items` — one row per SKU. Fields: `user_id`, `audit_id`, `sku`, `url`, `title`, `status` (queued/running/done/failed/skipped), `last_audited_at`, `attempts`, `next_run_at`, `error`. Indexes on `(audit_id, status)`, `(user_id, sku)`, `(status, next_run_at)` for the worker pull.
- `failures` — one row per detected failure. Fields: `user_id`, `audit_id`, `catalog_item_id`, `pillar`, `severity`, `failure_code`, `title`, `detail jsonb`, `status`, `detected_at`. Indexes on `(audit_id, pillar, severity)`, `(user_id, status, detected_at desc)`.
- `fixes` — one row per generated fix. Fields: `user_id`, `failure_id`, `generated_by` (model), `before`, `after`, `hallucination_score`, `grounding_score`, `reasoning`, `user_feedback`, `status`, `deployed_at`.
- `fix_history` — deploy events (before/after scores, delta) — same shape as today's zustand entry.

**Server functions** (`createServerFn` + `requireSupabaseAuth`) in `src/lib/audits.functions.ts`:
- `listAudits({ cursor, limit })`, `getAudit(id)`, `listFailures({ auditId, pillar?, severity?, cursor })`, `listFixes({ auditId, cursor })`, `submitFixFeedback({ fixId, verdict })`.

**Migration path**: keep zustand as an in-memory cache hydrated from server queries. Delete `persist` so localStorage stops accumulating.

## Phase 2 — Catalog ingest + job queue (the 100k-SKU pipe)

**Tables**:

- `audit_jobs` — one per submitted catalog audit. Fields: `user_id`, `audit_id`, `source` (sitemap/shopify/csv/manual), `source_url`, `total_items`, `processed`, `failed`, `budget_cents`, `spent_cents`, `status`, `concurrency`.
- `ingest_sources` — reusable catalog connections. Fields: `user_id`, `kind`, `config jsonb` (sitemap URL, Shopify shop+token ref, etc.), `last_synced_at`.

**Server routes** (`src/routes/api/public/hooks/`):
- `POST /api/public/hooks/ingest-catalog` — called from `pg_cron` or a UI "Start audit" action. Reads `ingest_sources`, streams sitemap.xml or paginates Shopify `/products.json`, bulk-inserts `catalog_items` in 1000-row chunks with `status='queued'`. Idempotent on `(audit_id, sku)`.
- `POST /api/public/hooks/run-audit-batch` — pulls up to `N` (default 25) `catalog_items` where `status='queued' AND next_run_at <= now()`, locks them via `FOR UPDATE SKIP LOCKED`, runs the pillar checks per item, writes `failures` + `fixes`, updates counters on `audit_jobs`. On error: `attempts++`, `next_run_at = now() + backoff`.
- `POST /api/public/hooks/rollup-audit` — when `processed + failed = total_items`, computes `pillar_scores`, marks the audit `complete`.

**pg_cron** (SQL-only, in `pg_net`): every minute call `run-audit-batch`; every 5 minutes call `rollup-audit`. Auth via `apikey` header = anon key.

**UI**: replace the single-URL Start page with a "New audit" form offering (a) paste sitemap URL, (b) upload CSV of URLs, (c) connect Shopify (deferred stub). Show live progress bar hitting `getAudit(id)` on a 3s poll.

**Quota**: `audit_runs_used` becomes SKU-cost accounting on `audit_jobs.spent_cents`; per-tier `sku_cap` and `concurrency` on `profiles` / plan config.

## Phase 3 — Observability at scale

**Tables** (append-only, partitioned by day via native Postgres range partitioning; workers use `service_role`):

- `ai_traces` — `id`, `user_id`, `audit_id`, `catalog_item_id`, `model`, `workflow`, `pillar`, `prompt_hash`, `tokens_in`, `tokens_out`, `duration_ms`, `cost_usd`, `status`, `error`, `created_at`. Partitioned daily; 90-day retention job.
- `guardrail_events` — same idea, one row per hard-stop hit.
- `eval_daily_rollup` — materialized aggregations: `day`, `model`, `pillar`, `runs`, `pass`, `fail`, `p50_ms`, `p95_ms`, `p99_ms`, `avg_hallucination`, `avg_grounding`, `total_cost_usd`.

**Sampling**: writer helper `logTrace()` writes 100% of failures + a stratified sample (default 5%, configurable per tier) of successes. Judge scores always written for sampled + all failures.

**Rollup**: `pg_cron` hourly → SQL-only `INSERT ... ON CONFLICT DO UPDATE` into `eval_daily_rollup` from the last hour of `ai_traces`. `/admin` reads only rollups + last 200 raw traces — not the whole table.

**Admin UI changes**: paginated trace table (cursor on `created_at`), time-window filter (1h / 24h / 7d / 30d), per-model + per-pillar breakdown chart driven by `eval_daily_rollup`. Cost tracker reads `sum(cost_usd)` from the rollup, not zustand.

## Phase 4 — Eval framework (regression + drift)

**Tables**:

- `eval_datasets` — named golden sets. Fields: `user_id` (nullable = system-wide), `name`, `description`, `pillar`.
- `eval_cases` — pinned inputs. Fields: `dataset_id`, `input jsonb`, `expected jsonb`, `weight`.
- `eval_experiments` — one row per named run. Fields: `dataset_id`, `model`, `prompt_version`, `started_at`, `pass_rate`, `avg_hallucination`, `avg_grounding`, `p95_ms`.
- `eval_case_results` — per-case scores in an experiment.

**Server**:
- `runExperiment({ datasetId, model, promptVersion })` — replays every case, writes results, computes summary.
- `POST /api/public/hooks/nightly-eval` — pg_cron 03:00 UTC, runs the "default" dataset against the current pinned models, alerts (row in `eval_alerts` + toast on `/admin`) when pass-rate drops > 5% vs. the last 7-day average.

**Admin UI**: `/admin/evals` — dataset picker, experiment comparison (side-by-side score deltas), per-case drill-down. Drift banner on `/admin` header when an alert is open.

## Phased rollout

- **P1** — audits/failures/fixes tables + server fns, dashboard/review/history read from server, zustand becomes a hydration cache. Ships 100% feature parity for the current single-URL flow. **~1 day.**
- **P2** — audit_jobs/catalog_items tables, ingest + batch worker routes, pg_cron, new "New audit" UI with progress + CSV/sitemap ingest. Product now handles 100k SKUs (throughput bound only by worker concurrency + LLM quota). **~1.5 days.**
- **P3** — ai_traces/guardrail_events partitioning, sampling helper, hourly rollup, refactored `/admin`. **~1 day.**
- **P4** — eval_datasets/experiments, nightly regression cron, `/admin/evals`, drift alerts. **~1 day.**

## Technical notes

- `catalog_items.status` transitions: `queued → running → done | failed → (retry) queued`. `FOR UPDATE SKIP LOCKED` prevents double-processing across concurrent workers.
- All `/api/public/hooks/*` routes authenticate via `apikey: <anon key>` header (pg_cron pattern). No custom shared secret.
- Worker route uses `supabaseAdmin` loaded inside the handler (never at module scope of a client-reachable file).
- Trace/failure/fix tables use daily range partitioning for cheap 90-day retention drops; `pg_cron` creates tomorrow's partition each night.
- 100% of tables get `GRANT SELECT/INSERT/UPDATE/DELETE ON ... TO authenticated`, `GRANT ALL ... TO service_role`, RLS on, policies scoped to `auth.uid()`. No `anon` grants.
- Zustand keeps only ephemeral UI state (active audit id, filters). Persist middleware removed.
- Existing routes (`/dashboard`, `/review`, `/history`, `/impact`, `/monitoring`, `/admin`) migrate to server-fn reads via TanStack Query loaders — the current shape is already the canonical `ensureQueryData` / `useSuspenseQuery` pattern.
- Cost per SKU capped per plan tier; `audit_jobs` refuses to start (or auto-pauses) when `spent_cents > budget_cents`.

Reply with **"build P1"** (or "build P1 and P2", etc.) to start; each phase is safe to ship independently.


-- ─── audits ──────────────────────────────────────────────────────────────
CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  root_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed')),
  sku_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  pillar_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audits_user_created_idx ON public.audits (user_id, created_at DESC);
CREATE INDEX audits_status_idx ON public.audits (status) WHERE status IN ('pending','running');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own audits" ON public.audits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own audits" ON public.audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own audits" ON public.audits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own audits" ON public.audits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER audits_updated_at BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── catalog_items ───────────────────────────────────────────────────────
CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  sku text,
  url text NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','skipped')),
  last_audited_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalog_items_audit_status_idx ON public.catalog_items (audit_id, status);
CREATE INDEX catalog_items_worker_pull_idx ON public.catalog_items (status, next_run_at) WHERE status = 'queued';
CREATE INDEX catalog_items_user_sku_idx ON public.catalog_items (user_id, sku);
CREATE UNIQUE INDEX catalog_items_audit_sku_uniq ON public.catalog_items (audit_id, sku) WHERE sku IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own catalog items" ON public.catalog_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own catalog items" ON public.catalog_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own catalog items" ON public.catalog_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own catalog items" ON public.catalog_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER catalog_items_updated_at BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── failures ────────────────────────────────────────────────────────────
CREATE TABLE public.failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  pillar text NOT NULL CHECK (pillar IN ('P1','P2','P3','P4','P5')),
  severity text NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  failure_code text NOT NULL,
  title text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'detected',
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX failures_audit_pillar_sev_idx ON public.failures (audit_id, pillar, severity);
CREATE INDEX failures_user_status_idx ON public.failures (user_id, status, detected_at DESC);
CREATE INDEX failures_item_idx ON public.failures (catalog_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.failures TO authenticated;
GRANT ALL ON public.failures TO service_role;
ALTER TABLE public.failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own failures" ON public.failures FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own failures" ON public.failures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own failures" ON public.failures FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own failures" ON public.failures FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER failures_updated_at BEFORE UPDATE ON public.failures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── fixes ───────────────────────────────────────────────────────────────
CREATE TABLE public.fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  failure_id uuid NOT NULL REFERENCES public.failures(id) ON DELETE CASCADE,
  generated_by text NOT NULL,
  before_text text,
  after_text text,
  hallucination_score integer NOT NULL DEFAULT 0,
  grounding_score integer NOT NULL DEFAULT 0,
  reasoning text,
  user_feedback text CHECK (user_feedback IN ('pass','fail')),
  status text NOT NULL DEFAULT 'generating',
  deployed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fixes_failure_idx ON public.fixes (failure_id);
CREATE INDEX fixes_user_created_idx ON public.fixes (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixes TO authenticated;
GRANT ALL ON public.fixes TO service_role;
ALTER TABLE public.fixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own fixes" ON public.fixes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own fixes" ON public.fixes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own fixes" ON public.fixes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own fixes" ON public.fixes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER fixes_updated_at BEFORE UPDATE ON public.fixes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── fix_history ─────────────────────────────────────────────────────────
CREATE TABLE public.fix_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  failure_id uuid NOT NULL REFERENCES public.failures(id) ON DELETE CASCADE,
  pillar text NOT NULL CHECK (pillar IN ('P1','P2','P3','P4','P5')),
  severity text NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  title text NOT NULL,
  detail text,
  scores_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  delta numeric NOT NULL DEFAULT 0,
  pillar_delta numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fix_history_user_created_idx ON public.fix_history (user_id, created_at DESC);
CREATE INDEX fix_history_audit_idx ON public.fix_history (audit_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fix_history TO authenticated;
GRANT ALL ON public.fix_history TO service_role;
ALTER TABLE public.fix_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own fix history" ON public.fix_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own fix history" ON public.fix_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own fix history" ON public.fix_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

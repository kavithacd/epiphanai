
-- 1. Restrict client-side UPDATE on profiles to non-sensitive columns only.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (email, full_name) ON public.profiles TO authenticated;

-- 2. Defense-in-depth trigger: block changes to sensitive columns unless the caller
-- is service_role (server-side supabaseAdmin) or a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.audit_runs_used IS DISTINCT FROM OLD.audit_runs_used
     OR NEW.monitor_runs_used IS DISTINCT FROM OLD.monitor_runs_used
     OR NEW.period_started_at IS DISTINCT FROM OLD.period_started_at THEN
    RAISE EXCEPTION 'Cannot modify billing or usage fields from client'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3. Atomic quota increment RPCs. Enforce the limit in the same UPDATE, so
-- concurrent requests can't both pass a stale read-check.
CREATE OR REPLACE FUNCTION public.increment_audit_run(_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_val integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles
     SET audit_runs_used = audit_runs_used + 1
   WHERE id = auth.uid()
     AND (_limit < 0 OR audit_runs_used < _limit)
   RETURNING audit_runs_used INTO new_val;
  IF new_val IS NULL THEN
    RAISE EXCEPTION 'AUDIT_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
  RETURN new_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_monitor_run(_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_val integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles
     SET monitor_runs_used = monitor_runs_used + 1
   WHERE id = auth.uid()
     AND (_limit < 0 OR monitor_runs_used < _limit)
   RETURNING monitor_runs_used INTO new_val;
  IF new_val IS NULL THEN
    RAISE EXCEPTION 'MONITOR_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;
  RETURN new_val;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_audit_run(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_monitor_run(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_audit_run(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_monitor_run(integer) TO authenticated;

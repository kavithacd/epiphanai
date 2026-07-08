-- Lock down SECURITY DEFINER function execution privileges
-- Trigger-only functions: revoke from anon and authenticated (they only run as triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- RPCs called from the app: only signed-in users, never anon
REVOKE EXECUTE ON FUNCTION public.increment_audit_run(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_monitor_run(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_audit_run(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_monitor_run(integer) TO authenticated;
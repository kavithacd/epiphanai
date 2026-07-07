import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLimitsFor, type PlanKind, type TierKind } from "./plan";

export interface MyPlan {
  plan: PlanKind;
  tier: TierKind;
  auditRunsUsed: number;
  monitorRunsUsed: number;
  email: string | null;
  fullName: string | null;
}

async function ensureProfile(ctx: { supabase: any; userId: string }) {
  const { supabase, userId } = ctx;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, plan, tier, audit_runs_used, monitor_runs_used")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const { data: inserted, error: insErr } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select("id, email, full_name, plan, tier, audit_runs_used, monitor_runs_used")
    .single();
  if (insErr) throw new Error(insErr.message);
  return inserted;
}

// Convert plan limits (which may be Infinity) to an integer suitable for the
// atomic Postgres RPC. -1 means "no limit".
function toRpcLimit(n: number): number {
  return Number.isFinite(n) ? Math.floor(n) : -1;
}

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    const row = await ensureProfile(context as any);
    return {
      plan: row.plan as PlanKind,
      tier: row.tier as TierKind,
      auditRunsUsed: row.audit_runs_used ?? 0,
      monitorRunsUsed: row.monitor_runs_used ?? 0,
      email: row.email,
      fullName: row.full_name,
    };
  });

export const incrementAuditRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    const ctx = context as any;
    const row = await ensureProfile(ctx);
    const limits = getLimitsFor(row.plan as PlanKind, row.tier as TierKind);
    const { data: newVal, error } = await ctx.supabase.rpc("increment_audit_run", {
      _limit: toRpcLimit(limits.auditRuns),
    });
    if (error) {
      if (error.message?.includes("AUDIT_LIMIT_REACHED")) {
        throw new Error("AUDIT_LIMIT_REACHED");
      }
      throw new Error(error.message);
    }
    return {
      plan: row.plan,
      tier: row.tier,
      auditRunsUsed: newVal ?? (row.audit_runs_used ?? 0) + 1,
      monitorRunsUsed: row.monitor_runs_used ?? 0,
      email: row.email,
      fullName: row.full_name,
    };
  });

export const incrementMonitorRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    const ctx = context as any;
    const row = await ensureProfile(ctx);
    const limits = getLimitsFor(row.plan as PlanKind, row.tier as TierKind);
    const { data: newVal, error } = await ctx.supabase.rpc("increment_monitor_run", {
      _limit: toRpcLimit(limits.monitorRuns),
    });
    if (error) {
      if (error.message?.includes("MONITOR_LIMIT_REACHED")) {
        throw new Error("MONITOR_LIMIT_REACHED");
      }
      throw new Error(error.message);
    }
    return {
      plan: row.plan,
      tier: row.tier,
      auditRunsUsed: row.audit_runs_used ?? 0,
      monitorRunsUsed: newVal ?? (row.monitor_runs_used ?? 0) + 1,
      email: row.email,
      fullName: row.full_name,
    };
  });

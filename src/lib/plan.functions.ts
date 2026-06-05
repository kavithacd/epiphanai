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
    const next = (row.audit_runs_used ?? 0) + 1;
    if (next > limits.auditRuns) {
      throw new Error("AUDIT_LIMIT_REACHED");
    }
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ audit_runs_used: next })
      .eq("id", ctx.userId);
    if (error) throw new Error(error.message);
    return {
      plan: row.plan,
      tier: row.tier,
      auditRunsUsed: next,
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
    const next = (row.monitor_runs_used ?? 0) + 1;
    if (next > limits.monitorRuns) {
      throw new Error("MONITOR_LIMIT_REACHED");
    }
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ monitor_runs_used: next })
      .eq("id", ctx.userId);
    if (error) throw new Error(error.message);
    return {
      plan: row.plan,
      tier: row.tier,
      auditRunsUsed: row.audit_runs_used ?? 0,
      monitorRunsUsed: next,
      email: row.email,
      fullName: row.full_name,
    };
  });

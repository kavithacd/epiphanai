import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AuditRecord, Failure, PillarId } from "./epiphan-data";
import type { FixHistoryEntry } from "./epiphan-store";

// ─── Types exchanged with the client ─────────────────────────────────────
export interface PersistAuditInput {
  audit: AuditRecord;
  fixHistory: FixHistoryEntry[]; // only entries belonging to this audit
}

export interface ListAuditsRow {
  id: string;
  store_name: string;
  root_url: string;
  status: string;
  sku_count: number;
  failure_count: number;
  pillar_scores: Record<PillarId, number>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Server-authoritative snapshot returned to the client for hydration.
export interface HydratedAudit {
  audit: AuditRecord;
  fixHistory: FixHistoryEntry[];
}

// ─── Read: list audits for the signed-in user ────────────────────────────
export const listAudits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListAuditsRow[]> => {
    const ctx = context as any;
    const { data, error } = await ctx.supabase
      .from("audits")
      .select("id, store_name, root_url, status, sku_count, failure_count, pillar_scores, started_at, completed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ListAuditsRow[];
  });

// ─── Read: hydrate a single audit (with failures, fixes, history) ───────
export const hydrateAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { auditId: string }) => input)
  .handler(async ({ data, context }): Promise<HydratedAudit | null> => {
    const ctx = context as any;
    const { data: a, error } = await ctx.supabase
      .from("audits")
      .select("*")
      .eq("id", data.auditId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!a) return null;

    const { data: failuresRaw } = await ctx.supabase
      .from("failures")
      .select("*, fixes(*)")
      .eq("audit_id", data.auditId)
      .order("detected_at", { ascending: true });

    const { data: historyRaw } = await ctx.supabase
      .from("fix_history")
      .select("*")
      .eq("audit_id", data.auditId)
      .order("created_at", { ascending: false });

    const failures: Failure[] = (failuresRaw ?? []).map((row: any) => {
      const fixRow = row.fixes?.[0];
      return {
        id: row.id,
        auditId: row.audit_id,
        failureId: row.failure_code,
        failureName: row.title,
        pillar: row.pillar as PillarId,
        severity: row.severity,
        status: row.status,
        detectedAt: new Date(row.detected_at).getTime(),
        detail: row.detail?.detail ?? row.title,
        isAutofixable: row.detail?.isAutofixable ?? false,
        requiresHuman: row.detail?.requiresHuman ?? false,
        missingFields: row.detail?.missingFields,
        regenerationCount: row.detail?.regenerationCount,
        fix: fixRow ? {
          id: fixRow.id,
          fixType: fixRow.detail?.fixType ?? "generic",
          generatedBy: fixRow.generated_by,
          before: fixRow.before_text ?? "",
          after: fixRow.after_text ?? "",
          evalScores: fixRow.detail?.evalScores ?? { factPreservation: 100, semanticDensity: 100, structuralSyntax: 100, objectAccuracy: 100, overall: "PASS" as const },
          hallucinationScore: fixRow.hallucination_score,
          groundingScore: fixRow.grounding_score,
          reasoning: fixRow.reasoning ?? "",
          rollbackSnapshot: fixRow.detail?.rollbackSnapshot ?? fixRow.before_text ?? "",
          userFeedback: fixRow.user_feedback ?? undefined,
        } : undefined,
      } as Failure;
    });

    const audit: AuditRecord = {
      id: a.id,
      url: a.root_url,
      storeName: a.store_name,
      status: a.status,
      currentPillar: null,
      scores: a.pillar_scores ?? { P1: 100, P2: 100, P3: 100, P4: 100, P5: 100 },
      failures,
      createdAt: new Date(a.created_at).getTime(),
      completedAt: a.completed_at ? new Date(a.completed_at).getTime() : undefined,
      ctx: a.pillar_scores?._ctx ?? undefined,
      sovBreakdown: a.pillar_scores?._sov ?? undefined,
    } as AuditRecord;

    const fixHistory: FixHistoryEntry[] = (historyRaw ?? []).map((h: any) => ({
      id: h.id,
      auditId: h.audit_id,
      failureId: h.detail ? (h as any).failure_code ?? "" : "",
      failureRecordId: h.failure_id,
      pillar: h.pillar,
      severity: h.severity,
      title: h.title,
      detail: h.detail ?? "",
      timestamp: new Date(h.created_at).getTime(),
      scoresBefore: h.scores_before,
      scoresAfter: h.scores_after,
      delta: Number(h.delta),
      pillarDelta: Number(h.pillar_delta),
    }));

    return { audit, fixHistory };
  });

// ─── Write: persist an audit (upsert audit + all its failures/fixes) ────
// Called after the client-side audit run completes, and after every fix
// mutation. Idempotent — safe to call repeatedly.
export const persistAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PersistAuditInput) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ctx = context as any;
    const userId: string = ctx.userId;
    const a = data.audit;

    // 1. Upsert audit
    const scoresPayload = { ...a.scores, _ctx: a.ctx, _sov: a.sovBreakdown };
    const { error: aErr } = await ctx.supabase.from("audits").upsert({
      id: a.id,
      user_id: userId,
      store_name: a.storeName,
      root_url: a.url,
      status: a.status,
      sku_count: 1,
      failure_count: a.failures.length,
      pillar_scores: scoresPayload,
      started_at: new Date(a.createdAt).toISOString(),
      completed_at: a.completedAt ? new Date(a.completedAt).toISOString() : null,
    }, { onConflict: "id" });
    if (aErr) throw new Error(aErr.message);

    // 2. Upsert failures (skip ones still generating)
    const failureRows = a.failures
      .filter((f) => f.status !== "generating")
      .map((f) => ({
        id: f.id,
        user_id: userId,
        audit_id: a.id,
        pillar: f.pillar,
        severity: f.severity,
        failure_code: f.failureId,
        title: f.failureName,
        detail: {
          detail: f.detail,
          isAutofixable: f.isAutofixable,
          requiresHuman: f.requiresHuman,
          missingFields: f.missingFields,
          regenerationCount: f.regenerationCount,
        },
        status: f.status,
        detected_at: new Date(f.detectedAt).toISOString(),
      }));
    if (failureRows.length > 0) {
      const { error: fErr } = await ctx.supabase.from("failures").upsert(failureRows, { onConflict: "id" });
      if (fErr) throw new Error(fErr.message);
    }

    // 3. Upsert fixes
    const fixRows = a.failures
      .filter((f) => f.fix)
      .map((f) => ({
        id: f.fix!.id,
        user_id: userId,
        failure_id: f.id,
        generated_by: f.fix!.generatedBy,
        before_text: f.fix!.before?.slice(0, 8000),
        after_text: f.fix!.after?.slice(0, 8000),
        hallucination_score: f.fix!.hallucinationScore,
        grounding_score: f.fix!.groundingScore,
        reasoning: f.fix!.reasoning,
        user_feedback: f.fix!.userFeedback ?? null,
        status: f.status,
        deployed_at: f.status === "deployed" ? new Date().toISOString() : null,
      }));
    if (fixRows.length > 0) {
      const { error: xErr } = await ctx.supabase.from("fixes").upsert(fixRows, { onConflict: "id" });
      if (xErr) throw new Error(xErr.message);
    }

    // 4. Insert new fix_history entries (id is the natural dedupe)
    if (data.fixHistory.length > 0) {
      const historyRows = data.fixHistory.map((h) => ({
        id: h.id,
        user_id: userId,
        audit_id: h.auditId,
        failure_id: h.failureRecordId,
        pillar: h.pillar,
        severity: h.severity,
        title: h.title,
        detail: h.detail,
        scores_before: h.scoresBefore,
        scores_after: h.scoresAfter,
        delta: h.delta,
        pillar_delta: h.pillarDelta,
        created_at: new Date(h.timestamp).toISOString(),
      }));
      const { error: hErr } = await ctx.supabase
        .from("fix_history")
        .upsert(historyRows, { onConflict: "id", ignoreDuplicates: true });
      if (hErr) throw new Error(hErr.message);
    }

    return { ok: true };
  });

// ─── Write: fix feedback (thumbs up/down) ───────────────────────────────
export const submitFixFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fixId: string; verdict: "pass" | "fail" }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ctx = context as any;
    const { error } = await ctx.supabase
      .from("fixes")
      .update({ user_feedback: data.verdict })
      .eq("id", data.fixId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Write: delete an audit ─────────────────────────────────────────────
export const deleteAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { auditId: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ctx = context as any;
    const { error } = await ctx.supabase.from("audits").delete().eq("id", data.auditId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

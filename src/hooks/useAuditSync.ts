import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useEpiphan } from "@/lib/epiphan-store";
import { useAuthUser } from "@/hooks/useMyPlan";
import { persistAudit, listAudits, hydrateAudit } from "@/lib/audits.functions";

// Mirrors zustand audits → Postgres, and hydrates on first sign-in.
// P1 pattern: zustand is now an in-memory cache; source of truth is the DB.
export function useAuditSync() {
  const { user } = useAuthUser();
  const persistFn = useServerFn(persistAudit);
  const listFn = useServerFn(listAudits);
  const hydrateFn = useServerFn(hydrateAudit);
  const audits = useEpiphan((s) => s.audits);
  const fixHistory = useEpiphan((s) => s.fixHistory);
  const hydratedRef = useRef<string | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSyncedRef = useRef<Record<string, string>>({});

  // ─── Hydrate on first sign-in ──────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      hydratedRef.current = null;
      return;
    }
    if (hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    (async () => {
      try {
        const rows = await listFn();
        if (!rows || rows.length === 0) return;
        // Hydrate up to the 25 most recent audits
        const hydrated = await Promise.all(
          rows.slice(0, 25).map((r) => hydrateFn({ data: { auditId: r.id } })),
        );
        const validAudits = hydrated
          .filter((h): h is NonNullable<typeof h> => !!h)
          .map((h) => h.audit);
        const validHistory = hydrated
          .filter((h): h is NonNullable<typeof h> => !!h)
          .flatMap((h) => h.fixHistory);
        useEpiphan.setState((s) => {
          const existingIds = new Set(s.audits.map((a) => a.id));
          const merged = [...validAudits.filter((a) => !existingIds.has(a.id)), ...s.audits];
          const existingHistoryIds = new Set(s.fixHistory.map((h) => h.id));
          const mergedHistory = [
            ...validHistory.filter((h) => !existingHistoryIds.has(h.id)),
            ...s.fixHistory,
          ].sort((a, b) => b.timestamp - a.timestamp);
          return { audits: merged, fixHistory: mergedHistory };
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[audit-sync] hydrate failed", err);
      }
    })();
  }, [user, listFn, hydrateFn]);

  // ─── Mirror writes → server (debounced per-audit) ─────────────────────
  useEffect(() => {
    if (!user) return;
    for (const a of audits) {
      // Skip in-flight audits to avoid thrashing; the completion tick will fire.
      if (a.status === "running") continue;
      const snapshot = JSON.stringify({
        st: a.status,
        n: a.failures.length,
        fs: a.failures.map((f) => `${f.id}:${f.status}:${f.fix?.userFeedback ?? ""}`).join("|"),
      });
      if (lastSyncedRef.current[a.id] === snapshot) continue;
      lastSyncedRef.current[a.id] = snapshot;

      if (debounceRef.current[a.id]) clearTimeout(debounceRef.current[a.id]);
      debounceRef.current[a.id] = setTimeout(() => {
        const relatedHistory = fixHistory.filter((h) => h.auditId === a.id);
        persistFn({ data: { audit: a, fixHistory: relatedHistory } }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn("[audit-sync] persist failed", a.id, err);
        });
      }, 800);
    }
  }, [audits, fixHistory, user, persistFn]);
}

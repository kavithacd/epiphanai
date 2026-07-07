import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlan, incrementAuditRun, incrementMonitorRun, type MyPlan } from "@/lib/plan.functions";
import { getLimitsFor } from "@/lib/plan";

export function useAuthUser() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { user, loading };
}

export function useMyPlan() {
  const fetchPlan = useServerFn(getMyPlan);
  const { user } = useAuthUser();
  const query = useQuery<MyPlan>({
    queryKey: ["my-plan", user?.id ?? "anon"],
    queryFn: () => fetchPlan(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const limits = query.data ? getLimitsFor(query.data.plan, query.data.tier) : null;
  return { ...query, limits };
}

// Show the user how many runs they have left after each successful run so
// they can plan their usage without hunting for it in the sidebar.
function notifyRemaining(kind: "Audit" | "Brand monitor", used: number, max: number) {
  const remaining = Math.max(0, max - used);
  const infinite = !Number.isFinite(max);
  if (infinite) {
    toast.success(`${kind} run complete`, { description: "Unlimited on your plan." });
    return;
  }
  if (remaining === 0) {
    toast.warning(`${kind} run complete · last run used`, {
      description: "Upgrade to keep going this period.",
    });
  } else if (remaining <= 1) {
    toast.warning(`${kind} run complete · ${remaining} left this period`, {
      description: "Running low — consider upgrading.",
    });
  } else {
    toast.success(`${kind} run complete · ${remaining} of ${max} left`);
  }
}

export function useIncrementAudit() {
  const fn = useServerFn(incrementAuditRun);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: (data) => {
      qc.setQueryData(["my-plan", data ? "*" : "anon"], data);
      if (data) {
        const limits = getLimitsFor(data.plan, data.tier);
        notifyRemaining("Audit", data.auditRunsUsed, limits.auditRuns);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-plan"] }),
  });
}

export function useIncrementMonitor() {
  const fn = useServerFn(incrementMonitorRun);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: (data) => {
      if (data) {
        const limits = getLimitsFor(data.plan, data.tier);
        notifyRemaining("Brand monitor", data.monitorRunsUsed, limits.monitorRuns);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-plan"] }),
  });
}

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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

export function useIncrementAudit() {
  const fn = useServerFn(incrementAuditRun);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: (data) => qc.setQueryData(["my-plan", data ? "*" : "anon"], data),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-plan"] }),
  });
}

export function useIncrementMonitor() {
  const fn = useServerFn(incrementMonitorRun);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-plan"] }),
  });
}

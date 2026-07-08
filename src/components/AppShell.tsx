import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, Inbox, History, Shield, Settings as Cog, Sparkles, Plus, TrendingUp, Radio, LogOut, Loader2, Lock, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { useEpiphan } from "@/lib/epiphan-store";
import { useAuthUser, useMyPlan } from "@/hooks/useMyPlan";
import { useAuditSync } from "@/hooks/useAuditSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { BRAND } from "@/lib/branding";

type NavReq = "audit" | "monitor" | null;
const NAV: { to: string; label: string; icon: any; req: NavReq }[] = [
  { to: "/dashboard", label: "Audit Engine", icon: Activity, req: "audit" },
  { to: "/review", label: "Review Queue", icon: Inbox, req: "audit" },
  { to: "/monitoring", label: "Brand Monitoring", icon: Radio, req: "monitor" },
  { to: "/impact", label: "Fix Impact", icon: TrendingUp, req: "audit" },
  { to: "/history", label: "Audit History", icon: History, req: "audit" },
  { to: "/admin", label: "Admin Cockpit", icon: Shield, req: null },
  { to: "/settings", label: "Settings", icon: Cog, req: null },
];

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const audits = useEpiphan((s) => s.audits);
  const resetForUser = useEpiphan((s) => s.resetForUser);
  const { user, loading } = useAuthUser();
  const { data: plan, limits } = useMyPlan();
  const [upgrade, setUpgrade] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Clean slate per account — wipes local audits/monitor data on user change.
  useEffect(() => {
    if (user?.id) resetForUser(user.id);
    else if (!loading && !user) resetForUser(null);
  }, [user?.id, loading, resetForUser, user]);

  const pendingReview = audits
    .flatMap((a) => a.failures)
    .filter((f) => f.status === "review_pending").length;

  async function handleLogout() {
    await supabase.auth.signOut();
    resetForUser(null);
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  function hasAccess(req: NavReq): boolean {
    if (!req) return true;
    if (!limits) return true; // optimistic until plan loads
    return req === "audit" ? limits.hasAudit : limits.hasMonitor;
  }

  function blockNav(e: React.MouseEvent, req: NavReq) {
    if (hasAccess(req)) return;
    e.preventDefault();
    setUpgrade({
      open: true,
      title: req === "audit" ? "Audit Engine is locked" : "Brand Monitoring is locked",
      message:
        req === "audit"
          ? "Your current plan only includes Brand Monitoring. Upgrade to the Bundle to unlock the Audit Engine."
          : "Your current plan only includes the Audit Engine. Upgrade to the Bundle to unlock Brand Monitoring.",
    });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const isInfinite = (n: number) => !Number.isFinite(n);
  const auditRemaining = limits && plan ? Math.max(0, limits.auditRuns - plan.auditRunsUsed) : null;
  const monitorRemaining = limits && plan ? Math.max(0, limits.monitorRuns - plan.monitorRunsUsed) : null;
  const auditLow = limits && plan && !isInfinite(limits.auditRuns) && auditRemaining !== null && auditRemaining <= 1 && limits.hasAudit;
  const monitorLow = limits && plan && !isInfinite(limits.monitorRuns) && monitorRemaining !== null && monitorRemaining <= 1 && limits.hasMonitor;

  return (
    <div className="min-h-screen flex bg-background text-foreground font-mono text-sm">
      <aside className="w-60 border-r border-border bg-surface flex flex-col shrink-0">
        <Link to="/" className="px-5 py-5 border-b border-border flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-foreground font-semibold tracking-tight">{BRAND.name}</div>
          </div>
        </Link>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            const locked = !hasAccess(n.req);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={(e) => blockNav(e, n.req)}
                aria-disabled={locked}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs transition ${
                  locked
                    ? "text-muted-foreground/40 cursor-not-allowed border border-transparent hover:bg-accent/20"
                    : active
                    ? "bg-primary/10 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" /> {n.label}
                </span>
                {locked ? (
                  <Lock className="w-3 h-3" />
                ) : n.to === "/review" && pendingReview > 0 ? (
                  <span className="text-[10px] bg-sev-high/20 text-sev-high px-1.5 py-0.5 rounded">
                    {pendingReview}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {plan && limits && (
          <div className="border-t border-border p-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Usage this period</div>
            {limits.hasAudit && (
              <UsageRow
                label="Audits"
                used={plan.auditRunsUsed}
                max={limits.auditRuns}
                low={!!auditLow}
              />
            )}
            {limits.hasMonitor && (
              <UsageRow
                label="Monitor runs"
                used={plan.monitorRunsUsed}
                max={limits.monitorRuns}
                low={!!monitorLow}
              />
            )}
            {(auditLow || monitorLow) && plan.tier !== "enterprise" && (
              <Link
                to="/pricing"
                className="block text-center mt-1 px-2 py-1 rounded bg-primary/15 border border-primary/40 text-primary text-[10px] hover:bg-primary/25"
              >
                Running low — upgrade
              </Link>
            )}
          </div>
        )}

        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-foreground truncate">{user.email}</div>
              <Link
                to="/pricing"
                className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Plan: {plan ? TIER_LABEL[plan.tier] : "…"}
                {plan && plan.tier === "free" && (
                  <span className="ml-1 text-primary normal-case tracking-normal">· Upgrade</span>
                )}
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/pricing"
                title="Billing & plans"
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/40"
              >
                <CreditCard className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/40"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        <header className="h-12 border-b border-border bg-surface/60 backdrop-blur flex items-center justify-between px-6 shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {NAV.find((n) => loc.pathname.startsWith(n.to))?.label ?? BRAND.name}
          </div>
          {!loc.pathname.startsWith("/monitoring") && (
            <button
              onClick={() => {
                if (!hasAccess("audit")) {
                  setUpgrade({
                    open: true,
                    title: "Audit Engine is locked",
                    message: "Your current plan only includes Brand Monitoring. Upgrade to the Bundle to run audits.",
                  });
                  return;
                }
                navigate({ to: "/dashboard" });
                setTimeout(() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  document.getElementById("epiphan-audit-url")?.focus();
                }, 80);
              }}
              className="px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 text-[11px] flex items-center gap-1.5 font-medium"
            >
              <Plus className="w-3 h-3" /> New audit
            </button>
          )}
        </header>
        <div className="flex-1 min-w-0 flex flex-col">
          <OnboardingBanner userId={user.id} />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </main>
      <UpgradeDialog
        open={upgrade.open}
        onClose={() => setUpgrade((u) => ({ ...u, open: false }))}
        title={upgrade.title}
        message={upgrade.message}
      />
    </div>
  );
}

function UsageRow({ label, used, max, low }: { label: string; used: number; max: number; low: boolean }) {
  const infinite = !Number.isFinite(max);
  const pct = infinite ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums ${low ? "text-primary" : "text-foreground"}`}>
          {used}/{infinite ? "∞" : max}
        </span>
      </div>
      {!infinite && (
        <div className="h-1 rounded-full bg-border overflow-hidden mt-0.5">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: low ? "var(--color-primary)" : "var(--color-muted-foreground)",
            }}
          />
        </div>
      )}
    </div>
  );
}

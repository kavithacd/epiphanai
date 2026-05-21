import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, Inbox, History, Shield, Settings as Cog, Cpu, Sparkles, Plus } from "lucide-react";
import { useEpiphan } from "@/lib/epiphan-store";

const NAV = [
  { to: "/dashboard", label: "Audit Engine", icon: Activity },
  { to: "/review", label: "Review Queue", icon: Inbox },
  { to: "/history", label: "Audit History", icon: History },
  { to: "/admin", label: "Admin Cockpit", icon: Shield },
  { to: "/settings", label: "Settings", icon: Cog },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const audits = useEpiphan((s) => s.audits);
  const pendingReview = audits
    .flatMap((a) => a.failures)
    .filter((f) => f.status === "review_pending").length;

  return (
    <div className="min-h-screen flex bg-background text-foreground font-mono text-sm">
      <aside className="w-60 border-r border-border bg-surface flex flex-col shrink-0">
        <Link to="/" className="px-5 py-5 border-b border-border flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-foreground font-semibold tracking-tight">epiphanAI</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Tessera Advisory</div>
          </div>
        </Link>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to} to={n.to}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs transition ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-transparent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" /> {n.label}
                </span>
                {n.to === "/review" && pendingReview > 0 && (
                  <span className="text-[10px] bg-sev-high/20 text-sev-high px-1.5 py-0.5 rounded">
                    {pendingReview}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-sev-low animate-pulse" />
            <span>Local Ollama · 11434</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Cpu className="w-3 h-3" /> Phi-4 · Llama 3.3 · Vision
          </div>
          <div className="text-[9px] text-muted-foreground/70 leading-tight pt-1 border-t border-border/50">
            Zero-data-leakage · GDPR / EU AI Act
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        <header className="h-12 border-b border-border bg-surface/60 backdrop-blur flex items-center justify-between px-6 shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {NAV.find((n) => loc.pathname.startsWith(n.to))?.label ?? "epiphanAI"}
          </div>
          <button
            onClick={() => navigate({ to: "/dashboard", search: { new: 1 } as never })}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 text-[11px] flex items-center gap-1.5 font-medium"
          >
            <Plus className="w-3 h-3" /> New audit
          </button>
        </header>
        <div className="flex-1 min-w-0">{children}</div>
      </main>
    </div>
  );
}


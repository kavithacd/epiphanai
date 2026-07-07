import { Link } from "@tanstack/react-router";
import { X, Sparkles, Play, Radio, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "shine.onboarding.dismissed";

// Simple localStorage-backed first-run banner. Shown on the first entry into
// the app after signup and dismissible from any page. When the user returns,
// it stays dismissed. Keeps this out of the DB to avoid a migration.
export function OnboardingBanner({ userId }: { userId: string | undefined }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(KEY);
      const set = raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
      setDismissed(set.has(userId));
    } catch {
      setDismissed(false);
    }
  }, [userId]);

  function dismiss() {
    if (!userId) return;
    try {
      const raw = window.localStorage.getItem(KEY);
      const set = raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
      set.add(userId);
      window.localStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {}
    setDismissed(true);
  }

  if (dismissed) return null;
  return (
    <div className="border-b border-border bg-primary/5">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-start gap-4">
        <div className="w-8 h-8 rounded bg-primary/15 border border-primary/40 grid place-items-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">Welcome — three ways to see value in the next 5 minutes</div>
          <div className="mt-3 grid sm:grid-cols-3 gap-2">
            <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:border-primary/40 hover:bg-primary/5 text-xs">
              <Play className="w-3.5 h-3.5 text-primary" />
              <span><span className="text-foreground">1. Run an audit</span><span className="text-muted-foreground"> on any URL</span></span>
            </Link>
            <Link to="/settings" hash="brand-monitoring" className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:border-primary/40 hover:bg-primary/5 text-xs">
              <Radio className="w-3.5 h-3.5 text-primary" />
              <span><span className="text-foreground">2. Set up</span><span className="text-muted-foreground"> brand monitoring</span></span>
            </Link>
            <Link to="/pricing" className="flex items-center gap-2 px-3 py-2 rounded border border-border hover:border-primary/40 hover:bg-primary/5 text-xs">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span><span className="text-foreground">3. Upgrade</span><span className="text-muted-foreground"> when you're ready</span></span>
            </Link>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

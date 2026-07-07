import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { seoMeta, BRAND } from "@/lib/branding";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: seoMeta("Reset password", "Choose a new password.") }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // The user arrives here via a recovery link. Supabase fires a
  // PASSWORD_RECOVERY event which unlocks updateUser. We wait for that
  // (or a session) before allowing submission.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground font-mono">
      <div className="m-auto w-full max-w-sm p-6">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">{BRAND.name}</span>
        </Link>

        <h1 className="text-xl font-sans font-medium">Choose a new password</h1>
        <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters.</p>

        {!ready ? (
          <div className="mt-5 text-xs text-muted-foreground">
            Waiting for reset link to validate…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">New password</label>
              <div className="flex items-center bg-background border border-border rounded px-2.5 focus-within:border-primary">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none px-2 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Confirm password</label>
              <div className="flex items-center bg-background border border-border rounded px-2.5 focus-within:border-primary">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="flex-1 bg-transparent outline-none px-2 py-2 text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Mail, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { seoMeta, BRAND } from "@/lib/branding";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: seoMeta("Forgot password", "Reset your password.") }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your inbox.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send reset link");
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

        <h1 className="text-xl font-sans font-medium">Forgot your password?</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Enter your email and we'll send a reset link.
        </p>

        {sent ? (
          <div className="mt-6 border border-border rounded-lg p-4 bg-surface text-xs text-muted-foreground">
            Check your inbox at <span className="text-foreground">{email}</span>. The link expires in 1 hour.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Email</label>
              <div className="flex items-center bg-background border border-border rounded px-2.5 focus-within:border-primary">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
              Send reset link
            </button>
          </form>
        )}

        <div className="mt-4">
          <Link to="/auth" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

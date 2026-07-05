import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { seoMeta } from "@/lib/branding";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: seoMeta("Sign in", "Sign in to your account.") }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw new Error((result.error as Error).message ?? "Google sign-in failed");
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
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
          <span className="font-semibold tracking-tight">Shine</span>
        </Link>

        <h1 className="text-xl font-sans font-medium">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {mode === "signin"
            ? "Welcome back."
            : "Free plan: 2 audits, 1 brand monitor run, 1 competitor."}
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-5 w-full px-4 py-2.5 rounded border border-border bg-background hover:bg-accent/40 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1A6.97 6.97 0 015.46 12c0-.73.13-1.45.36-2.1V7.07H2.18A11 11 0 001 12c0 1.78.43 3.47 1.18 4.93l3.66-2.83z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-background border border-border rounded px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>
          )}
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
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Password</label>
            <div className="flex items-center bg-background border border-border rounded px-2.5 focus-within:border-primary">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-muted-foreground text-center">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-primary hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link to="/pricing" className="text-[11px] text-muted-foreground hover:text-foreground">
            View pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}

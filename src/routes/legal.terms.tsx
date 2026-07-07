import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { BRAND, seoMeta } from "@/lib/branding";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({ meta: seoMeta("Terms of Service", `${BRAND.name} terms of service and acceptable use.`) }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">{BRAND.name}</span>
          </Link>
          <Link to="/legal/privacy" className="text-xs text-muted-foreground hover:text-foreground">Privacy →</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 prose prose-invert text-sm leading-relaxed">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="text-3xl font-sans font-medium mt-2 mb-6">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="mt-8 space-y-6 text-muted-foreground">
          <div>
            <h2 className="text-base font-medium text-foreground">1. Acceptance</h2>
            <p className="mt-2">By creating an account or using {BRAND.name} (the "Service"), you agree to these Terms. If you use the Service on behalf of an organization, you accept these Terms on that organization's behalf.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">2. Service description</h2>
            <p className="mt-2">{BRAND.name} audits websites and product content for AI-search visibility, generates remediation suggestions, and monitors brand share of voice across generative engines.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">3. Accounts</h2>
            <p className="mt-2">You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">4. Acceptable use</h2>
            <p className="mt-2">You agree not to (a) probe or scan the Service, (b) reverse engineer it, (c) use it to violate any law, or (d) audit content you don't have permission to modify.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">5. Fees & billing</h2>
            <p className="mt-2">Paid plans are billed monthly or annually in advance and are non-refundable. Usage above plan limits is either blocked or billed as overage, as noted on the pricing page.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">6. Termination</h2>
            <p className="mt-2">You may cancel at any time from your billing settings. We may suspend or terminate accounts that violate these Terms.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">7. Disclaimer</h2>
            <p className="mt-2">The Service is provided "as is" without warranty. {BRAND.name} does not guarantee any particular ranking, citation, or visibility outcome on any generative engine.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">8. Contact</h2>
            <p className="mt-2">Questions? Email <a className="text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</p>
          </div>
        </section>
      </article>
    </div>
  );
}

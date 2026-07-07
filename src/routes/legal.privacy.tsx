import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { BRAND, seoMeta } from "@/lib/branding";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({ meta: seoMeta("Privacy Policy", `${BRAND.name} privacy policy — what we collect, why, and your rights.`) }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
          <Link to="/legal/terms" className="text-xs text-muted-foreground hover:text-foreground">Terms →</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 text-sm leading-relaxed">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="text-3xl font-sans font-medium mt-2 mb-6">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="mt-8 space-y-6 text-muted-foreground">
          <div>
            <h2 className="text-base font-medium text-foreground">What we collect</h2>
            <p className="mt-2">Account info (email, name), authentication tokens, URLs you audit, generated remediations, and usage counters. When you pay, our payment processor handles billing details — we store only the customer/subscription references.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Why</h2>
            <p className="mt-2">To provide the Service, enforce plan limits, contact you about your account, and comply with legal obligations.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Cookies</h2>
            <p className="mt-2">We use strictly necessary cookies for authentication. No third-party ad or tracking cookies.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Sub-processors</h2>
            <p className="mt-2">Hosting and database: Supabase / Lovable Cloud. Email: our transactional email provider. Payments: Paddle. AI inference: hosted models via the Lovable AI Gateway.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Your rights</h2>
            <p className="mt-2">You can access, correct, or delete your account data at any time from settings, or by emailing <a className="text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>. EU/UK users retain their GDPR/UK-GDPR rights.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Retention</h2>
            <p className="mt-2">Account data is kept for as long as your account is active plus 30 days. Deleted accounts are purged after 30 days.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Contact</h2>
            <p className="mt-2">Privacy questions: <a className="text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</p>
          </div>
        </section>
      </article>
    </div>
  );
}

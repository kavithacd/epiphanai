import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Minus, Sparkles, ArrowRight } from "lucide-react";
import { BRAND, seoMeta } from "@/lib/branding";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: seoMeta(
      "Compare",
      `See how ${BRAND.name} stacks up against Searchable, Profound, AthenaHQ and Peec across AI visibility tracking, on-page healing, engines covered, and price.`,
    ),
  }),
  component: ComparePage,
});

type Cell = string | boolean;

interface Row {
  label: string;
  cells: [Cell, Cell, Cell, Cell, Cell]; // Shine, Searchable, Profound, AthenaHQ, Peec
  hint?: string;
}

const COLUMNS = [
  { id: "shine", name: BRAND.name, highlight: true, tagline: "EU-native · auto-heals on-page" },
  { id: "searchable", name: "Searchable", highlight: false, tagline: "US · AEO tracker" },
  { id: "profound", name: "Profound", highlight: false, tagline: "US · enterprise AEO" },
  { id: "athena", name: "AthenaHQ", highlight: false, tagline: "US · brand monitor" },
  { id: "peec", name: "Peec AI", highlight: false, tagline: "EU · brand monitor" },
] as const;

const ROWS: Row[] = [
  { label: "AI engines tracked", cells: ["9 (all major)", "9 (Custom plan only)", "7", "5", "6"] },
  { label: "Multi-engine on entry plan", cells: [true, false, false, false, true] },
  { label: "Daily prompt refresh", cells: [true, true, true, false, true] },
  { label: "Competitor share-of-voice", cells: [true, true, true, true, true] },
  { label: "Technical / on-page audit", cells: [true, true, false, false, false] },
  { label: "Auto-heals your site (llms.txt, JSON-LD, canonicals…)", cells: [true, false, false, false, false], hint: "Shine ships fixes, not just findings." },
  { label: "White-label agency reports", cells: ["Growth+", "Growth+", "Enterprise", false, false] },
  { label: "API / MCP integration", cells: [true, true, true, false, false] },
  { label: "EU billing & data residency", cells: [true, false, false, false, true] },
  { label: "Free tier", cells: [true, false, false, false, false] },
  { label: "Entry price / mo (3 engines)", cells: ["€39", "$125 (≈€115)", "$499", "$99", "€99"] },
  { label: "Growth plan / mo", cells: ["€99", "$400 (≈€370)", "$999", "$399", "€299"] },
  { label: "Annual discount", cells: ["20%", "20%", "—", "—", "10%"] },
];

function ComparePage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <Header />
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Compare
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-medium mt-2">
            {BRAND.name} vs the AI-visibility category.
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            The category is crowded but most tools stop at telling you what's
            wrong. {BRAND.name} tracks visibility across 9 engines AND heals your
            content — usually at half the price. Numbers below are the current
            public list price for each vendor at the same tier size.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto border border-border rounded-lg bg-surface">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-normal text-[10px] uppercase tracking-widest text-muted-foreground">
                  Capability
                </th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.id}
                    className={`text-left p-3 font-normal ${
                      c.highlight ? "bg-primary/8" : ""
                    }`}
                  >
                    <div
                      className={`text-xs ${
                        c.highlight ? "text-primary font-semibold" : "text-foreground"
                      }`}
                    >
                      {c.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {c.tagline}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.label}
                  className={i % 2 === 0 ? "" : "bg-background/50"}
                >
                  <td className="p-3 align-top text-foreground">
                    {r.label}
                    {r.hint && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {r.hint}
                      </div>
                    )}
                  </td>
                  {r.cells.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`p-3 align-top ${
                        COLUMNS[ci].highlight ? "bg-primary/5" : ""
                      }`}
                    >
                      <CellView value={cell} highlight={COLUMNS[ci].highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-[10px] text-muted-foreground max-w-3xl">
          Data reflects public list prices and feature pages as of{" "}
          {new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}.
          Vendors update pricing frequently; if anything is out of date{" "}
          <a href={`mailto:${BRAND.contactEmail}`} className="text-primary hover:underline">
            let us know
          </a>
          .
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/pricing"
            className="px-5 py-2.5 rounded bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"
          >
            See {BRAND.name} pricing <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/start"
            className="px-5 py-2.5 rounded border border-border text-sm hover:border-primary"
          >
            Run a live audit
          </Link>
        </div>
      </section>
    </div>
  );
}

function CellView({ value, highlight }: { value: Cell; highlight: boolean }) {
  if (value === true) {
    return (
      <Check
        className={`w-4 h-4 ${highlight ? "text-primary" : "text-sev-low"}`}
      />
    );
  }
  if (value === false) {
    return <Minus className="w-4 h-4 text-muted-foreground/50" />;
  }
  return (
    <span className={`${highlight ? "text-primary font-medium" : "text-foreground"} tabular-nums`}>
      {value}
    </span>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/15 border border-primary/40 grid place-items-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="font-semibold tracking-tight">{BRAND.name}</div>
        </Link>
        <nav className="flex items-center gap-4 text-xs">
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs flex items-center gap-1.5"
          >
            Open Console <ArrowRight className="w-3 h-3" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

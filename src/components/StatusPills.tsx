export function FixStatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; l: string }> = {
    detected:      { c: "var(--muted-foreground)", l: "Detected" },
    generating:    { c: "var(--color-primary)",    l: "Generating" },
    eval_pending:  { c: "var(--sev-medium)",       l: "Eval pending" },
    eval_passed:   { c: "var(--sev-low)",          l: "Eval passed" },
    eval_failed:   { c: "var(--sev-critical)",     l: "Eval failed" },
    review_pending:{ c: "var(--sev-high)",         l: "Awaiting review" },
    approved:      { c: "var(--sev-low)",          l: "Approved" },
    deployed:      { c: "var(--sev-low)",          l: "✓ Healed" },
    rolled_back:   { c: "var(--muted-foreground)", l: "Rolled back" },
    rejected:      { c: "var(--sev-critical)",     l: "Rejected" },
  };
  const x = map[status] ?? map.detected;
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border tabular-nums w-fit"
      style={{ color: x.c, borderColor: x.c + "40", background: x.c + "10" }}
    >
      {x.l}
    </span>
  );
}

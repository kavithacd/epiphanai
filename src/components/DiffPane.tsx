// Side-by-side before/after with changed lines tinted in the pillar colour.
// Tiny LCS-free diff — good enough for short JSON-LD / copy snippets.

import { PillarId, PILLARS } from "@/lib/epiphan-data";

function pillarColor(p: PillarId) {
  return `var(--color-${PILLARS.find((x) => x.id === p)!.tokenVar})`;
}

function classify(lines: string[], other: string[]) {
  const otherSet = new Set(other.map((l) => l.trim()));
  return lines.map((l) => ({ line: l, changed: !otherSet.has(l.trim()) && l.trim().length > 0 }));
}

export function DiffPane({
  before,
  after,
  pillar,
  maxHeight = 240,
}: {
  before: string;
  after: string;
  pillar: PillarId;
  maxHeight?: number;
}) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeMarked = classify(beforeLines, afterLines);
  const afterMarked = classify(afterLines, beforeLines);
  const color = pillarColor(pillar);

  return (
    <div className="grid md:grid-cols-2 gap-2">
      <Side
        label="BEFORE"
        labelColor="var(--sev-critical)"
        lines={beforeMarked}
        highlight="var(--sev-critical)"
        kind="removed"
        maxHeight={maxHeight}
      />
      <Side
        label="AFTER (PILLAR FIX)"
        labelColor={color}
        lines={afterMarked}
        highlight={color}
        kind="added"
        maxHeight={maxHeight}
      />
    </div>
  );
}

function Side({
  label,
  labelColor,
  lines,
  highlight,
  kind,
  maxHeight,
}: {
  label: string;
  labelColor: string;
  lines: { line: string; changed: boolean }[];
  highlight: string;
  kind: "added" | "removed";
  maxHeight: number;
}) {
  const marker = kind === "added" ? "+" : "−";
  return (
    <div
      className="border rounded overflow-hidden"
      style={{ borderColor: `color-mix(in oklab, ${highlight} 35%, transparent)` }}
    >
      <div
        className="px-2 py-1 text-[9px] uppercase tracking-widest border-b"
        style={{
          color: labelColor,
          borderColor: `color-mix(in oklab, ${highlight} 35%, transparent)`,
          background: `color-mix(in oklab, ${highlight} 8%, transparent)`,
        }}
      >
        {label}
      </div>
      <div
        className="text-[10.5px] font-mono leading-relaxed overflow-auto"
        style={{ maxHeight }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className="px-2 py-px flex gap-2 whitespace-pre-wrap break-words"
            style={
              l.changed
                ? {
                    background: `color-mix(in oklab, ${highlight} 14%, transparent)`,
                    borderLeft: `2px solid ${highlight}`,
                  }
                : { borderLeft: "2px solid transparent" }
            }
          >
            <span
              className="select-none tabular-nums"
              style={{ color: l.changed ? highlight : "var(--muted-foreground)", opacity: l.changed ? 1 : 0.4 }}
            >
              {l.changed ? marker : " "}
            </span>
            <span className={l.changed ? "text-foreground" : "text-muted-foreground"}>
              {l.line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

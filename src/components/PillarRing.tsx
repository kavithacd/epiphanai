import { PILLARS, PillarId } from "@/lib/epiphan-data";

export function PillarRing({
  pillar, score, size = 96, label, status,
}: {
  pillar: PillarId; score: number; size?: number;
  label?: string; status?: string;
}) {
  const meta = PILLARS.find((p) => p.id === pillar)!;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = `var(--color-${meta.tokenVar})`;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r}
            stroke="oklch(0.28 0.03 260)" strokeWidth={stroke} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={c} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 700ms ease" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-xl font-semibold tabular-nums" style={{ color }}>
              {score}
            </div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">{pillar}</div>
          </div>
        </div>
      </div>
      {label && <div className="text-[10px] text-muted-foreground text-center leading-tight">{label}</div>}
      {status && (
        <div className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
          style={{ color, borderColor: color + "40", background: color + "10" }}>
          {status}
        </div>
      )}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }) {
  const v = `var(--sev-${severity.toLowerCase()})`;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded border tabular-nums"
      style={{ color: v, borderColor: v + "40", background: v + "12" }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: v }} />
      {severity}
    </span>
  );
}

export function PillarBadge({ pillar }: { pillar: PillarId }) {
  const meta = PILLARS.find((p) => p.id === pillar)!;
  const v = `var(--color-${meta.tokenVar})`;
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border tabular-nums"
      style={{ color: v, borderColor: v + "40", background: v + "12" }}
    >
      {pillar}
    </span>
  );
}

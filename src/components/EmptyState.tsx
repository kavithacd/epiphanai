import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="max-w-md mx-auto text-center py-16 px-6">
      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 grid place-items-center mx-auto mb-4">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-base font-sans font-medium text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{description}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { X, Sparkles } from "lucide-react";

export function UpgradeDialog({
  open,
  onClose,
  title,
  message,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative max-w-md w-full bg-surface border border-border rounded-lg p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded bg-primary/15 border border-primary/40 grid place-items-center mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1.5">{message}</p>
        <div className="mt-5 flex items-center gap-2">
          <Link
            to="/pricing"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-medium text-center hover:opacity-90"
          >
            See plans
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

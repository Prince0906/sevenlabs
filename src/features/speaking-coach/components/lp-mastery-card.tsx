import type { MatchedLP } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";

interface LPMasteryCardProps {
  lp: MatchedLP;
  compact?: boolean;
}

export function LPMasteryCard({ lp, compact = false }: LPMasteryCardProps) {
  const theme = SIGNAL_THEME[lp.signalLevel];

  return (
    <div
      className={cn(
        "rounded-lg border border-l-2 bg-card p-4",
        theme.border
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium leading-snug">{lp.name}</p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            theme.bg,
            theme.text
          )}
        >
          {SIGNAL_LABEL[lp.signalLevel]}
        </span>
      </div>
      {!compact && lp.evidence && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {lp.evidence}
        </p>
      )}
    </div>
  );
}

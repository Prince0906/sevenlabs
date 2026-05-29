import type { RubricScores } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";

interface RubricScoreBlockProps {
  rubricScores: RubricScores;
}

export function RubricScoreBlock({ rubricScores }: RubricScoreBlockProps) {
  const { matchedLPs, overallSignal, weakestArea } = rubricScores;
  const overall = SIGNAL_THEME[overallSignal];

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Leadership signal
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            overall.bg,
            overall.text
          )}
        >
          {SIGNAL_LABEL[overallSignal]}
        </span>
      </div>

      {matchedLPs.length > 0 && (
        <div className="space-y-2">
          {matchedLPs.map((lp) => {
            const theme = SIGNAL_THEME[lp.signalLevel];
            return (
              <div
                key={lp.name}
                className={cn("flex flex-col gap-1 border-l-2 pl-3", theme.border)}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{lp.name}</p>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium tabular-nums",
                      theme.text
                    )}
                  >
                    {SIGNAL_LABEL[lp.signalLevel]}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {lp.evidence}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border-l-2 border-foreground bg-accent/40 px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Level up next
        </p>
        <p className="mt-1 text-sm leading-relaxed">{weakestArea}</p>
      </div>
    </div>
  );
}

import type { SignalLevel } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";
import { splitPersona } from "../lib/seat-theme";

interface SeatRollup {
  seatId: string;
  personaName: string;
  ownedLPs: string[];
  seatSignal: SignalLevel;
}

/** Multi-rater consensus — a per-evaluator breakdown is the peer-credibility
 * differentiator (not one monolithic score). */
export function SeatRollupCard({ seatRollup }: { seatRollup: SeatRollup[] }) {
  if (seatRollup.length === 0) return null;
  const signals = seatRollup.map((s) => s.seatSignal);
  const agree = signals.every((s) => s === signals[0]);
  const headlineTheme = SIGNAL_THEME[signals[0]!];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">The panel</h2>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
            agree ? cn(headlineTheme.bg, headlineTheme.text) : "bg-accent text-muted-foreground"
          )}
        >
          {agree ? `Unanimous · ${SIGNAL_LABEL[signals[0]!]}` : "Split read"}
        </span>
      </div>

      <div className="space-y-2.5">
        {seatRollup.map((seat) => {
          const theme = SIGNAL_THEME[seat.seatSignal];
          const { name, role } = splitPersona(seat.personaName);
          return (
            <div
              key={seat.seatId}
              className={cn("flex flex-col gap-2.5 rounded-lg border border-l-2 bg-card p-3.5", theme.border)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-display text-lg font-semibold tracking-tight">{name}</span>
                  {role && (
                    <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {role}
                    </span>
                  )}
                </div>
                <span className={cn("flex shrink-0 items-center gap-1.5 text-[13px] font-medium", theme.text)}>
                  <span className={cn("size-2 rounded-full", theme.dot)} />
                  {SIGNAL_LABEL[seat.seatSignal]}
                </span>
              </div>
              {seat.ownedLPs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {seat.ownedLPs.map((lp) => (
                    <span
                      key={lp}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {lp}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

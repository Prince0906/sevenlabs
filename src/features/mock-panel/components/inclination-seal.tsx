import type { SignalLevel, Inclination } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";

const INCLINATION_LABEL: Record<Inclination, string> = {
  STRONG_HIRE: "Strong Hire",
  HIRE: "Hire",
  LEAN_HIRE: "Lean Hire",
  LEAN_NO_HIRE: "Lean No Hire",
  NO_HIRE: "No Hire",
  STRONG_NO_HIRE: "Strong No Hire",
};

interface InclinationSealProps {
  overallSignal: SignalLevel;
  inclination: Inclination;
  barRaiserVeto: boolean;
  summary: string;
}

/** The hero verdict: the level reached in Fraunces + signal color (the editorial
 * seal-of-authority moment), the inclination, and — if the Bar Raiser vetoed —
 * a composed callout that visually OVERRIDES the inclination. */
export function InclinationSeal({ overallSignal, inclination, barRaiserVeto, summary }: InclinationSealProps) {
  const theme = SIGNAL_THEME[overallSignal];
  const veto = SIGNAL_THEME.SENIOR; // emerald, the Bar Raiser's tint

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Signal reached</p>
        <p className={cn("mt-1 font-display text-5xl font-semibold tracking-tight", theme.text)}>
          {SIGNAL_LABEL[overallSignal]}
        </p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Committee inclination: </span>
          <span className={cn("font-medium", barRaiserVeto && "text-muted-foreground line-through")}>
            {INCLINATION_LABEL[inclination]}
          </span>
        </p>
      </div>

      {barRaiserVeto && (
        <div className={cn("rounded-lg border bg-card p-4", veto.border)} style={{ backgroundColor: "color-mix(in oklch, var(--signal-senior) 8%, var(--card))" }}>
          <p className={cn("font-display text-sm font-semibold tracking-tight", veto.text)}>
            Bar Raiser veto
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            The Bar Raiser could not endorse at this level — a veto is decisive and
            overrides the committee inclination above.
          </p>
        </div>
      )}

      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{summary}</p>
    </section>
  );
}

import type { SignalLevel, Inclination } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL, SIGNAL_THEME } from "@/lib/signal";
import { cn } from "@/lib/utils";
import { SIGNAL_CSS_VAR } from "../lib/seat-theme";

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
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Signal reached</p>
        <p
          className={cn("mt-1.5 font-display text-6xl font-semibold tracking-[-0.02em]", theme.text)}
          style={{ textShadow: `0 0 30px color-mix(in oklch, ${SIGNAL_CSS_VAR[overallSignal]} 50%, transparent)` }}
        >
          {SIGNAL_LABEL[overallSignal]}
        </p>
        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-muted-foreground">Committee inclination</span>
          <span
            className={cn(
              "inline-block -rotate-2 rounded-md border-2 px-2.5 py-1 font-display text-sm font-semibold uppercase tracking-[0.06em]",
              barRaiserVeto
                ? "border-border text-muted-foreground line-through"
                : "border-[var(--clay)] text-[var(--clay-strong)]"
            )}
          >
            {INCLINATION_LABEL[inclination]}
          </span>
        </div>
      </div>

      {barRaiserVeto && (
        <div className={cn("rounded-lg border bg-card p-4", veto.border)} style={{ backgroundColor: "color-mix(in oklch, var(--signal-senior) 8%, var(--card))" }}>
          <p className={cn("font-display text-[15px] font-semibold tracking-tight", veto.text)}>
            Bar Raiser veto
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            The Bar Raiser could not endorse at this level — a veto is decisive and
            overrides the committee inclination above.
          </p>
        </div>
      )}

      <p className="max-w-prose text-base leading-relaxed text-foreground/85">{summary}</p>
    </section>
  );
}

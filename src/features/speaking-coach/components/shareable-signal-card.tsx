import { forwardRef } from "react";
import type { MatchedLP, SignalLevel } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL } from "@/lib/signal";
import { BRAND } from "@/lib/brand";

// Dark-optimized signal colors so they stay vivid on the card's ink background,
// independent of the app's light/dark theme. Explicit oklch (not CSS vars) so
// html-to-image exports them faithfully.
const SIGNAL_COLOR: Record<SignalLevel, string> = {
  NEW_GRAD: "oklch(0.78 0.14 68)",
  SDE_II: "oklch(0.72 0.13 248)",
  SENIOR: "oklch(0.74 0.14 162)",
};

const SIGNAL_POS: Record<SignalLevel, string> = {
  NEW_GRAD: "16.67%",
  SDE_II: "50%",
  SENIOR: "83.33%",
};

interface ShareableSignalCardProps {
  signal: SignalLevel;
  topLP: MatchedLP | null;
  weakestArea: string | null;
}

export const ShareableSignalCard = forwardRef<
  HTMLDivElement,
  ShareableSignalCardProps
>(function ShareableSignalCard({ signal, topLP, weakestArea }, ref) {
  const color = SIGNAL_COLOR[signal];

  return (
    <div
      ref={ref}
      className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 p-7"
      style={{
        backgroundColor: "oklch(0.19 0.012 60)",
        backgroundImage: `radial-gradient(120% 80% at 85% -10%, color-mix(in oklch, ${color} 26%, transparent), transparent 60%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-semibold tracking-tight text-white">
          {BRAND.name}
          <span style={{ color }}>.</span>
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">
          Leadership signal
        </span>
      </div>

      <div className="mt-7">
        <p className="text-[11px] uppercase tracking-[0.1em] text-white/45">
          You read as
        </p>
        <p
          className="font-display text-5xl font-semibold tracking-tight"
          style={{ color }}
        >
          {SIGNAL_LABEL[signal]}
        </p>
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-3 text-center text-[10px] text-white/40">
          <span>New Grad</span>
          <span>SDE II</span>
          <span>Senior</span>
        </div>
        <div
          className="relative mt-2 h-1.5 rounded-full"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.78 0.14 68), oklch(0.72 0.13 248), oklch(0.74 0.14 162))",
          }}
        >
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: SIGNAL_POS[signal], backgroundColor: color }}
          />
        </div>
      </div>

      {topLP && (
        <div className="mt-6 border-l-2 pl-3" style={{ borderColor: color }}>
          <p className="text-sm font-medium text-white">{topLP.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/55">
            &ldquo;{topLP.evidence}&rdquo;
          </p>
        </div>
      )}

      {weakestArea && (
        <div className="mt-5 rounded-lg bg-white/[0.04] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/40">
            Level up next
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            {weakestArea}
          </p>
        </div>
      )}

      <p className="mt-7 text-[10px] text-white/35">{BRAND.tagline}</p>
    </div>
  );
});

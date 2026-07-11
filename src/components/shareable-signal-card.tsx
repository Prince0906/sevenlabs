import { forwardRef } from "react";
import type { MatchedLP, SignalLevel } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL } from "@/lib/signal";
import { BRAND } from "@/lib/brand";

// Deliberately dark: this card is exported as a social image (html-to-image),
// so it keeps an ink ground regardless of the app's light theme. Colors are
// explicit hexes (not CSS vars) so the export renders faithfully — the values
// are the Chalk & Cobalt identity: ink ground, cobalt brand dot, signal trio.
// Flat fills only; the level bar is three hard-stop segments, never a blend.
const SIGNAL_COLOR: Record<SignalLevel, string> = {
  NEW_GRAD: "#ED7A1E",
  SDE_II: "#3AA4EC",
  SENIOR: "#199D5C",
};

const INK = "#15181E";
const COBALT = "#2B50F0";
const SEGMENTS: SignalLevel[] = ["NEW_GRAD", "SDE_II", "SENIOR"];

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
      className="w-full max-w-md overflow-hidden rounded-2xl border-2 p-7"
      style={{ backgroundColor: INK, borderColor: "rgba(255,255,255,0.14)" }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-semibold tracking-tight text-white">
          {BRAND.name}
          <span style={{ color: COBALT }}>.</span>
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
        <div className="relative mt-2 flex h-1.5 gap-1">
          {SEGMENTS.map((level) => (
            <span
              key={level}
              className="h-full flex-1 rounded-full"
              style={{
                backgroundColor: SIGNAL_COLOR[level],
                opacity: level === signal ? 1 : 0.32,
              }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{
              left: `${(SEGMENTS.indexOf(signal) * 2 + 1) * (100 / 6)}%`,
              backgroundColor: color,
            }}
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
        <div className="mt-5 rounded-lg bg-white/[0.06] px-3 py-2.5">
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

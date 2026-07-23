import { forwardRef } from "react";
import type { MatchedLP, SignalLevel } from "@sevenlabs/shared-types";
import { SIGNAL_LABEL } from "@/lib/signal";
import { BRAND } from "@/lib/brand";

// Exported as a social image (html-to-image), so colors are explicit hexes,
// not CSS vars, and the card is self-contained: the same paper game piece as
// the rest of the app (one world), with a hard ink frame + offset shadow so
// it still pops on any feed. Flat fills only; the level bar is three
// hard-stop segments, never a blend.
const SIGNAL_COLOR: Record<SignalLevel, string> = {
  NEW_GRAD: "#ED7A1E",
  SDE_II: "#3AA4EC",
  SENIOR: "#199D5C",
};

// Deepened per-level tones for TEXT on white: the display word must clear
// large-text contrast (the raw trio orange sits below 3:1 on white).
const SIGNAL_TEXT: Record<SignalLevel, string> = {
  NEW_GRAD: "#C2620E",
  SDE_II: "#1E7FC2",
  SENIOR: "#147A47",
};

const INK = "#15181E";
const SLATE = "#5C6673";
const COBALT = "#2B50F0";
const SEGMENTS: SignalLevel[] = ["NEW_GRAD", "SDE_II", "SENIOR"];

interface ShareableSignalCardProps {
  signal: SignalLevel;
  // Only the displayed fields — the card never renders the per-LP gap.
  topLP: Pick<MatchedLP, "name" | "signalLevel" | "evidence"> | null;
  weakestArea: string | null;
}

export const ShareableSignalCard = forwardRef<
  HTMLDivElement,
  ShareableSignalCardProps
>(function ShareableSignalCard({ signal, topLP, weakestArea }, ref) {
  return (
    <div
      ref={ref}
      className="w-full max-w-md overflow-hidden rounded-2xl p-7"
      style={{
        backgroundColor: "#FFFFFF",
        border: `2px solid ${INK}`,
        boxShadow: `6px 6px 0 0 ${INK}`,
        color: INK,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold tracking-tight">
          {BRAND.name}
          <span style={{ color: COBALT }}>.</span>
        </span>
        <span
          className="text-[10px] font-medium uppercase tracking-[0.12em]"
          style={{ color: SLATE }}
        >
          Leadership signal
        </span>
      </div>

      <div className="mt-7">
        <p
          className="text-[11px] uppercase tracking-[0.1em]"
          style={{ color: SLATE }}
        >
          You read as
        </p>
        <p
          className="font-display text-5xl font-bold tracking-tight"
          style={{ color: SIGNAL_TEXT[signal] }}
        >
          {SIGNAL_LABEL[signal]}
        </p>
      </div>

      <div className="mt-6">
        <div
          className="grid grid-cols-3 text-center text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{ color: SLATE }}
        >
          <span>New Grad</span>
          <span>SDE II</span>
          <span>Senior</span>
        </div>
        <div className="relative mt-2 flex h-2 gap-1">
          {SEGMENTS.map((level) => (
            <span
              key={level}
              className="h-full flex-1 rounded-full"
              style={{
                backgroundColor: SIGNAL_COLOR[level],
                opacity: level === signal ? 1 : 0.28,
              }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${(SEGMENTS.indexOf(signal) * 2 + 1) * (100 / 6)}%`,
              backgroundColor: SIGNAL_COLOR[signal],
              border: `2px solid ${INK}`,
            }}
          />
        </div>
      </div>

      {topLP && (
        <div
          className="mt-6 pl-3"
          style={{ borderLeft: `3px solid ${SIGNAL_COLOR[signal]}` }}
        >
          <p className="text-sm font-semibold">{topLP.name}</p>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: SLATE }}
          >
            &ldquo;{topLP.evidence}&rdquo;
          </p>
        </div>
      )}

      {weakestArea && (
        <div
          className="mt-5 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: "#EFF1F5" }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.1em]"
            style={{ color: SLATE }}
          >
            Level up next
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: INK }}>
            {weakestArea}
          </p>
        </div>
      )}

      <p className="mt-7 text-[10px]" style={{ color: SLATE }}>
        {BRAND.tagline}
      </p>
    </div>
  );
});

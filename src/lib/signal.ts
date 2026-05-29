import type { SignalLevel } from "@sevenlabs/shared-types";

/**
 * The Signal progression is the soul of the product's color language:
 * New Grad (amber, "emerging") → SDE II (blue, "competent") → Senior
 * (emerald, "arrived"). Color tokens are defined in globals.css; the class
 * strings below are static so Tailwind's scanner generates them.
 */
export const SIGNAL_LABEL: Record<SignalLevel, string> = {
  NEW_GRAD: "New Grad",
  SDE_II: "SDE II",
  SENIOR: "Senior",
};

export const SIGNAL_RANK: Record<SignalLevel, number> = {
  NEW_GRAD: 0,
  SDE_II: 1,
  SENIOR: 2,
};

export interface SignalTheme {
  text: string;
  bg: string;
  border: string;
  dot: string;
}

export const SIGNAL_THEME: Record<SignalLevel, SignalTheme> = {
  NEW_GRAD: {
    text: "text-signal-newgrad",
    bg: "bg-signal-newgrad/10",
    border: "border-signal-newgrad/35",
    dot: "bg-signal-newgrad",
  },
  SDE_II: {
    text: "text-signal-sde2",
    bg: "bg-signal-sde2/10",
    border: "border-signal-sde2/35",
    dot: "bg-signal-sde2",
  },
  SENIOR: {
    text: "text-signal-senior",
    bg: "bg-signal-senior/10",
    border: "border-signal-senior/35",
    dot: "bg-signal-senior",
  },
};

"use client";

import { motion } from "framer-motion";
import type { SignalLevel } from "@sevenlabs/shared-types";
import { cn } from "@/lib/utils";
import { SIGNAL_THEME } from "@/lib/signal";
import { signalSlide } from "@/lib/motion";

const TIERS: { level: SignalLevel; label: string }[] = [
  { level: "NEW_GRAD", label: "New Grad" },
  { level: "SDE_II", label: "SDE II" },
  { level: "SENIOR", label: "Senior" },
];

const POS_PCT: Record<SignalLevel, number> = {
  NEW_GRAD: 16.67,
  SDE_II: 50,
  SENIOR: 83.33,
};

interface SignalPointerProps {
  current: SignalLevel | null;
  previous?: SignalLevel | null;
  className?: string;
}

export function SignalPointer({
  current,
  previous,
  className,
}: SignalPointerProps) {
  const fromPct = previous ? POS_PCT[previous] : current ? POS_PCT[current] : 50;
  const targetPct = current ? POS_PCT[current] : 50;

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-3 text-center">
        {TIERS.map((t) => (
          <span
            key={t.level}
            className={cn(
              "text-sm transition-colors",
              current === t.level
                ? cn("font-semibold", SIGNAL_THEME[t.level].text)
                : "text-muted-foreground"
            )}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div className="relative mt-2 h-px w-full bg-border">
        {current && (
          <motion.span
            initial={{ left: `${fromPct}%` }}
            animate={{ left: `${targetPct}%` }}
            transition={signalSlide}
            className={cn(
              "absolute -top-px block h-0.75 w-[28%] -translate-x-1/2 rounded-full",
              SIGNAL_THEME[current].dot
            )}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

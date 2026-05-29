"use client";

import type { SignalLevel } from "@sevenlabs/shared-types";
import { StatCard } from "@/components/stat-card";
import { SIGNAL_LABEL, SIGNAL_RANK, SIGNAL_THEME } from "@/lib/signal";

interface SignalCardProps {
  current: SignalLevel | null;
  previous: SignalLevel | null;
}

export function SignalCard({ current, previous }: SignalCardProps) {
  const improved =
    current && previous && SIGNAL_RANK[current] > SIGNAL_RANK[previous];

  return (
    <StatCard
      label="Signal"
      value={
        current ? (
          <span className={SIGNAL_THEME[current].text}>
            {SIGNAL_LABEL[current]}
          </span>
        ) : (
          "—"
        )
      }
      sub={
        !current
          ? "Practice in interview mode"
          : improved && previous
            ? `Up from ${SIGNAL_LABEL[previous]}`
            : previous
              ? `Last session ${SIGNAL_LABEL[previous]}`
              : "Your latest signal"
      }
      muted={!current}
    />
  );
}

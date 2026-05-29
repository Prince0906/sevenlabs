"use client";

import { StatCard } from "@/components/stat-card";

interface StreakCardProps {
  streakDays: number;
}

export function StreakCard({ streakDays }: StreakCardProps) {
  return (
    <StatCard
      label="Streak"
      value={streakDays > 0 ? streakDays : "—"}
      sub={
        streakDays === 0
          ? "Start a session to begin"
          : streakDays === 1
            ? "1 day in a row"
            : `${streakDays} days in a row`
      }
      muted={streakDays === 0}
    />
  );
}

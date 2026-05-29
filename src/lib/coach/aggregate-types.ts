import type { SignalLevel } from "@sevenlabs/shared-types";

export interface SignalTrend {
  current: SignalLevel | null;
  previous: SignalLevel | null;
  history: SignalLevel[];
}

export type LPMastery = Record<string, SignalLevel | null>;

export interface WeekStats {
  sessionsThisWeek: number;
  sessionsTarget: number;
  fillersPerMinNow: number | null;
  fillersPerMinPrior: number | null;
  deltaPct: number | null;
}

export interface TodaysDrill {
  lpName: string;
  questionText: string;
  questionId: string;
  estMinutes: number;
  reason: string;
}

export interface CockpitData {
  streakDays: number;
  signal: SignalTrend;
  mastery: LPMastery;
  weekStats: WeekStats;
  drill: TodaysDrill;
  daysToInterview: number | null;
  targetCompany: string;
}

export function masterySeniorLPs(mastery: LPMastery): string[] {
  return Object.entries(mastery)
    .filter(([, sig]) => sig === "SENIOR")
    .map(([name]) => name);
}

import {
  AMAZON_LEADERSHIP_PRINCIPLES,
  getDrillQuestion,
  getFallbackDrillQuestion,
} from "@sevenlabs/coach-core";
import {
  rubricScoresSchema,
  speechMetricsSchema,
  type RubricScores,
  type SignalLevel,
  type SpeechMetrics,
} from "@sevenlabs/shared-types";
import { prisma } from "@/lib/db";
import type {
  CockpitData,
  LPMastery,
  SignalTrend,
  TodaysDrill,
  WeekStats,
} from "./aggregate-types";

export type {
  CockpitData,
  LPMastery,
  SignalTrend,
  TodaysDrill,
  WeekStats,
} from "./aggregate-types";
export { masterySeniorLPs } from "./aggregate-types";

const SIGNAL_RANK: Record<SignalLevel, number> = {
  NEW_GRAD: 0,
  SDE_II: 1,
  SENIOR: 2,
};

function maxSignal(a: SignalLevel, b: SignalLevel): SignalLevel {
  return SIGNAL_RANK[a] >= SIGNAL_RANK[b] ? a : b;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRubric(json: unknown): RubricScores | null {
  if (!json) return null;
  const result = rubricScoresSchema.safeParse(json);
  return result.success ? result.data : null;
}

function parseMetrics(json: unknown): SpeechMetrics | null {
  if (!json) return null;
  const result = speechMetricsSchema.safeParse(json);
  return result.success ? result.data : null;
}

export async function getStreakDays(userId: string): Promise<number> {
  const sessions = await prisma.practiceSession.findMany({
    where: { userId },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
  });
  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((s) => utcDayKey(s.startedAt)));
  const today = utcDayKey(new Date());
  const yesterday = utcDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  let cursor: string;
  if (days.has(today)) cursor = today;
  else if (days.has(yesterday)) cursor = yesterday;
  else return 0;

  let streak = 0;
  let day = new Date(`${cursor}T00:00:00.000Z`);
  while (days.has(utcDayKey(day))) {
    streak += 1;
    day = new Date(day.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export async function getSignalTrend(
  userId: string,
  limit = 10
): Promise<SignalTrend> {
  const turns = await prisma.practiceTurn.findMany({
    where: {
      role: "USER",
      session: { userId },
      rubricScoresJson: { not: { equals: null } },
    },
    select: { rubricScoresJson: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const signals = turns
    .map((t) => parseRubric(t.rubricScoresJson))
    .filter((r): r is RubricScores => r !== null)
    .map((r) => r.overallSignal);

  return {
    current: signals[0] ?? null,
    previous: signals[1] ?? null,
    history: signals.slice().reverse(),
  };
}

export async function getLPMastery(userId: string): Promise<LPMastery> {
  const turns = await prisma.practiceTurn.findMany({
    where: {
      role: "USER",
      session: { userId },
      rubricScoresJson: { not: { equals: null } },
    },
    select: { rubricScoresJson: true },
  });

  const mastery: LPMastery = Object.fromEntries(
    AMAZON_LEADERSHIP_PRINCIPLES.map((p) => [p.name, null])
  );

  for (const turn of turns) {
    const rubric = parseRubric(turn.rubricScoresJson);
    if (!rubric) continue;
    for (const lp of rubric.matchedLPs) {
      const existing = mastery[lp.name];
      mastery[lp.name] = existing
        ? maxSignal(existing, lp.signalLevel)
        : lp.signalLevel;
    }
  }
  return mastery;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function getThisWeekStats(userId: string): Promise<WeekStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [sessionsThisWeek, turnsThisWeek, turnsPriorWeek] = await Promise.all([
    prisma.practiceSession.count({
      where: { userId, startedAt: { gte: startOfDay(sevenDaysAgo) } },
    }),
    prisma.practiceTurn.findMany({
      where: {
        role: "USER",
        session: { userId },
        createdAt: { gte: startOfDay(sevenDaysAgo) },
      },
      select: { metricsJson: true },
    }),
    prisma.practiceTurn.findMany({
      where: {
        role: "USER",
        session: { userId },
        createdAt: {
          gte: startOfDay(fourteenDaysAgo),
          lt: startOfDay(sevenDaysAgo),
        },
      },
      select: { metricsJson: true },
    }),
  ]);

  function fillersPerMin(rows: { metricsJson: unknown }[]): number | null {
    let fillers = 0;
    let durationSec = 0;
    for (const r of rows) {
      const m = parseMetrics(r.metricsJson);
      if (!m) continue;
      fillers += m.fillerCount;
      durationSec += m.turnDurationSec;
    }
    if (durationSec <= 0) return null;
    return Math.round((fillers / durationSec) * 60 * 10) / 10;
  }

  const now_ = fillersPerMin(turnsThisWeek);
  const prior_ = fillersPerMin(turnsPriorWeek);
  const deltaPct =
    now_ !== null && prior_ !== null && prior_ > 0
      ? Math.round(((now_ - prior_) / prior_) * 100)
      : null;

  return {
    sessionsThisWeek,
    sessionsTarget: 7,
    fillersPerMinNow: now_,
    fillersPerMinPrior: prior_,
    deltaPct,
  };
}

const DEFAULT_LP = "Ownership";

export async function getTodaysDrill(userId: string): Promise<TodaysDrill> {
  const mastery = await getLPMastery(userId);
  const company = "amazon";

  const ranked = Object.entries(mastery)
    .filter(([, sig]) => sig !== null)
    .sort((a, b) => SIGNAL_RANK[a[1]!] - SIGNAL_RANK[b[1]!]);

  const weakestLP = ranked[0]?.[0] ?? DEFAULT_LP;
  const reason =
    ranked.length === 0
      ? "Start with the most common Amazon LP."
      : `Your weakest LP so far is ${weakestLP}.`;

  const question =
    getDrillQuestion(company, weakestLP) ?? getFallbackDrillQuestion(company);

  if (!question) {
    return {
      lpName: weakestLP,
      questionText: `Tell me about a time you demonstrated ${weakestLP}.`,
      questionId: "fallback",
      estMinutes: 5,
      reason,
    };
  }

  return {
    lpName: question.lp,
    questionText: question.text,
    questionId: question.id,
    estMinutes: question.estMinutes,
    reason,
  };
}

export async function getCockpitData(userId: string): Promise<CockpitData> {
  const [user, streakDays, signal, mastery, weekStats, drill] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { targetCompanies: true, interviewDate: true },
      }),
      getStreakDays(userId),
      getSignalTrend(userId),
      getLPMastery(userId),
      getThisWeekStats(userId),
      getTodaysDrill(userId),
    ]);

  let daysToInterview: number | null = null;
  if (user?.interviewDate) {
    const ms = user.interviewDate.getTime() - Date.now();
    daysToInterview = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  return {
    streakDays,
    signal,
    mastery,
    weekStats,
    drill,
    daysToInterview,
    targetCompany: user?.targetCompanies?.[0] ?? "amazon",
  };
}

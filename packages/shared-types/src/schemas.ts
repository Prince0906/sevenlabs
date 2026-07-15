import { z } from "zod";

export const wordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const speechMetricsSchema = z.object({
  wpm: z.number(),
  pauseCount: z.number().int().nonnegative(),
  avgPauseMs: z.number().nonnegative(),
  longestPauseMs: z.number().nonnegative(),
  fillerCount: z.number().int().nonnegative(),
  speakingRatio: z.number().min(0).max(1),
  turnDurationSec: z.number().nonnegative(),
});

export const signalLevelSchema = z.enum(["NEW_GRAD", "SDE_II", "SENIOR"]);

export const matchedLPSchema = z.object({
  name: z.string(),
  signalLevel: signalLevelSchema,
  evidence: z.string(),
  // Per-LP coaching gap: the actionable next step for THIS competency alone
  // (the seat-wide weakestArea is a separate, committee-facing field).
  gap: z.string(),
});

export const rubricScoresSchema = z.object({
  matchedLPs: z.array(matchedLPSchema).max(3),
  overallSignal: signalLevelSchema,
  weakestArea: z.string(),
});

export type WordTimestamp = z.infer<typeof wordTimestampSchema>;
export type SpeechMetrics = z.infer<typeof speechMetricsSchema>;
export type SignalLevel = z.infer<typeof signalLevelSchema>;
export type MatchedLP = z.infer<typeof matchedLPSchema>;
export type RubricScores = z.infer<typeof rubricScoresSchema>;

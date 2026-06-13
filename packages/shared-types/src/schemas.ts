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

export const coachingModeSchema = z.enum([
  "interview",
  "pitch",
  "presentation",
  "delivery",
]);

export const createSessionRequestSchema = z.object({
  mode: coachingModeSchema.default("delivery"),
});

export const turnCompleteRequestSchema = z.object({
  sessionId: z.string().min(1),
  clientTurnId: z.string().min(1),
});

export const signalLevelSchema = z.enum(["NEW_GRAD", "SDE_II", "SENIOR"]);

export const matchedLPSchema = z.object({
  name: z.string(),
  signalLevel: signalLevelSchema,
  evidence: z.string(),
});

export const rubricScoresSchema = z.object({
  matchedLPs: z.array(matchedLPSchema).max(3),
  overallSignal: signalLevelSchema,
  weakestArea: z.string(),
});

export const turnCompleteResponseSchema = z.object({
  turnId: z.string(),
  transcript: z.string(),
  words: z.array(wordTimestampSchema),
  metrics: speechMetricsSchema.nullable(),
  coachText: z.string(),
  coachAudioUrl: z.string().optional(),
  duplicate: z.boolean().optional(),
  rubricScores: rubricScoresSchema.nullable().optional(),
});

export type WordTimestamp = z.infer<typeof wordTimestampSchema>;
export type SpeechMetrics = z.infer<typeof speechMetricsSchema>;
export type SignalLevel = z.infer<typeof signalLevelSchema>;
export type MatchedLP = z.infer<typeof matchedLPSchema>;
export type RubricScores = z.infer<typeof rubricScoresSchema>;
export type TurnCompleteResponse = z.infer<typeof turnCompleteResponseSchema>;

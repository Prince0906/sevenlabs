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

export const createSessionRequestSchema = z.object({
  mode: z.string().default("delivery"),
});

export const createSessionResponseSchema = z.object({
  sessionId: z.string(),
  openingCoachText: z.string(),
  openingCoachAudioUrl: z.string().optional(),
});

export const turnCompleteRequestSchema = z.object({
  sessionId: z.string().min(1),
  clientTurnId: z.string().min(1),
});

export const turnCompleteResponseSchema = z.object({
  turnId: z.string(),
  transcript: z.string(),
  words: z.array(wordTimestampSchema),
  metrics: speechMetricsSchema.nullable(),
  coachText: z.string(),
  coachAudioUrl: z.string().optional(),
  duplicate: z.boolean().optional(),
});

export const wsClientTurnAudioSchema = z.object({
  type: z.literal("turn_audio"),
  clientTurnId: z.string().min(1),
  base64: z.string().min(1),
});

export const wsServerTranscriptSchema = z.object({
  type: z.literal("transcript"),
  clientTurnId: z.string(),
  transcript: z.string(),
  words: z.array(wordTimestampSchema),
});

export const wsServerMetricsSchema = z.object({
  type: z.literal("metrics"),
  clientTurnId: z.string(),
  metrics: speechMetricsSchema,
});

export const wsServerCoachTextSchema = z.object({
  type: z.literal("coach_text"),
  clientTurnId: z.string(),
  coachText: z.string(),
});

export const wsServerCoachAudioSchema = z.object({
  type: z.literal("coach_audio"),
  clientTurnId: z.string(),
  url: z.string(),
});

export const wsServerErrorSchema = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
  clientTurnId: z.string().optional(),
});

export type WordTimestamp = z.infer<typeof wordTimestampSchema>;
export type SpeechMetrics = z.infer<typeof speechMetricsSchema>;
export type TurnCompleteResponse = z.infer<typeof turnCompleteResponseSchema>;

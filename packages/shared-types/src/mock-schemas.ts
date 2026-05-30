import { z } from "zod";
import { signalLevelSchema } from "./schemas";

/**
 * Confidence-engine (real-time panel) schemas. See SYSTEM_DESIGN.md §5/§8/§9.
 * Frozen P0 ordinal map: the rubric scorer emits a SignalLevel per LP (no
 * numeric score), so DimensionScore.score is derived from this map.
 */
export const SIGNAL_TO_SCORE = { NEW_GRAD: 40, SDE_II: 70, SENIOR: 90 } as const;

export const interviewTypeSchema = z.enum([
  "BEHAVIORAL",
  "SYSTEM_DESIGN",
  "CODING_VERBAL",
  "HIRING_MANAGER",
  "BAR_RAISER_PANEL",
]);

export const mockStatusSchema = z.enum([
  "PENDING",
  "LIVE",
  "DEBRIEF",
  "COMPLETED",
  "ABANDONED",
  "FAILED",
  "INTERRUPTED",
]);

export const scoreDimensionSchema = z.enum([
  "LP",
  "STAR_STRUCTURE",
  "TECHNICAL_DEPTH",
  "COMMUNICATION",
  "DELIVERY",
]);

export const inclinationSchema = z.enum([
  "STRONG_HIRE",
  "HIRE",
  "LEAN_HIRE",
  "LEAN_NO_HIRE",
  "NO_HIRE",
  "STRONG_NO_HIRE",
]);

export const dimensionScoreSchema = z.object({
  seatId: z.string().nullable().optional(),
  dimension: scoreDimensionSchema,
  key: z.string(),
  score: z.number().int().min(0).max(100),
  signalLevel: signalLevelSchema,
  evidence: z.string(),
  gap: z.string(),
});

/** The committee verdict the judgment model must emit (validated, then the
 * deterministic veto override is applied in code — SYSTEM_DESIGN §8.4). */
export const panelVerdictSchema = z.object({
  overallSignal: signalLevelSchema,
  inclination: inclinationSchema,
  barRaiserVeto: z.boolean(),
  summary: z.string(),
  seatRollup: z.array(
    z.object({
      seatId: z.string(),
      personaName: z.string(),
      ownedLPs: z.array(z.string()),
      seatSignal: signalLevelSchema,
    })
  ),
  topStrengths: z.array(z.string()).max(3),
  topRisks: z.array(z.string()).max(3),
});

export const confidenceMetricSchema = z.object({
  score: z.number().int().min(0).max(100),
  composure: z.number().int().min(0).max(100),
  resilience: z.number().int().min(0).max(100).nullable(),
  selfEfficacy: z.number().int().min(0).max(100).nullable(),
  difficultyApplied: z.number().int().min(1).max(5).nullable(),
});

/** Per-turn events the browser checkpoints from the realtime session.
 * Strict (no passthrough) so the type is clean JSON for Prisma; extend explicitly
 * (e.g. barge-in timestamp arrays) when P2 Resilience needs richer capture. */
export const turnEventsSchema = z.object({
  interruptions: z.number().int().nonnegative().optional(),
  latencyToAnswerMs: z.number().nonnegative().optional(),
  bargeIns: z.number().int().nonnegative().optional(),
  realtimeMsConsumed: z.number().nonnegative().optional(),
});

export type Inclination = z.infer<typeof inclinationSchema>;
export type ScoreDimensionT = z.infer<typeof scoreDimensionSchema>;
export type MockStatusT = z.infer<typeof mockStatusSchema>;
export type InterviewTypeT = z.infer<typeof interviewTypeSchema>;
export type DimensionScoreData = z.infer<typeof dimensionScoreSchema>;
export type PanelVerdictData = z.infer<typeof panelVerdictSchema>;
export type ConfidenceMetricData = z.infer<typeof confidenceMetricSchema>;
export type TurnEvents = z.infer<typeof turnEventsSchema>;

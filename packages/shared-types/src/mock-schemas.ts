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

// ── Client-facing request/response contracts for /api/mock/* ────────────────
// These let the browser client import typed contracts. Response schemas mirror
// what the routes actually return; keep them in lockstep with the routes.

/** POST /sessions/:id/mint body (mirrors the route's bodySchema). */
export const mintRequestSchema = z.object({
  reason: z
    .enum(["ttl_expiry", "resume_interrupted", "seat_handoff"])
    .default("ttl_expiry"),
  seatIndex: z.number().int().nonnegative().default(0),
});

/** One panel seat as returned to the browser by POST /sessions. */
export const panelSeatPublicSchema = z.object({
  id: z.string(),
  personaName: z.string(),
  ownedLPs: z.array(z.string()),
  isBarRaiser: z.boolean(),
  voice: z.string(),
});

/** The config-locked, use-once ephemeral the browser opens WebRTC with. */
export const realtimeEphemeralSchema = z.object({
  value: z.string(),
  expiresAt: z.number(),
  model: z.string(),
  realtimeUrl: z.string(),
});

/** POST /sessions success body. */
export const createMockSessionResponseSchema = z.object({
  sessionId: z.string(),
  seats: z.array(panelSeatPublicSchema),
  ephemeral: realtimeEphemeralSchema,
  spend: z.object({
    sessionCeilingUsd: z.number(),
    maxDurationSec: z.number(),
    estimatedUsd: z.number(),
  }),
});

/** GET /sessions/:id rehydrate body. maxSeq is -1 when no turns exist yet. */
export const statusResponseSchema = z.object({
  status: mockStatusSchema,
  scenarioId: z.string(),
  maxSeq: z.number().int(),
});

/** POST /sessions/:id/turns success body. metrics is null when word timings
 * are absent (the live realtime path sends words:[] -> metrics:null). */
export const turnResponseSchema = z.object({
  turnId: z.string(),
  seq: z.number().int().nonnegative(),
  duplicate: z.boolean(),
  metrics: z.unknown().nullable(),
  sessionExpired: z.boolean().optional(),
});

/** The persisted reportJson returned by GET /report when COMPLETED. Matches
 * src/lib/mock/panel-orchestrator.ts reportJson EXACTLY — do not let it drift.
 * `confidence` is the single composure score (0-100); in live mode it can be 0
 * when no USER-turn delivery metrics survived (decision 5) — render gracefully. */
export const mockReportDimensionSchema = z.object({
  key: z.string(),
  seatId: z.string().nullable(),
  signalLevel: signalLevelSchema,
  score: z.number().int().min(0).max(100),
  evidence: z.string(),
  gap: z.string(),
});

/** End-report fluency / delivery rollup, derived from per-answer Whisper word
 * timings (coach-core analyzeSpeech). OPTIONAL on the report: historical sessions
 * (and any run where no answer audio was analyzed) won't have it — render a
 * graceful fallback. Mirrors panel-orchestrator.ts reportJson.fluency EXACTLY. */
export const fluencySchema = z.object({
  answersScored: z.number().int().nonnegative(),
  meanWpm: z.number().nonnegative(),
  fillerCount: z.number().int().nonnegative(),
  fillerPer100: z.number().nonnegative(),
  pauseCount: z.number().int().nonnegative(),
  longestPauseMs: z.number().nonnegative(),
  speakingRatio: z.number().min(0).max(1),
  perAnswer: z.array(
    z.object({
      wpm: z.number().nonnegative(),
      fillerCount: z.number().int().nonnegative(),
      pauseCount: z.number().int().nonnegative(),
      longestPauseMs: z.number().nonnegative(),
      turnDurationSec: z.number().nonnegative(),
    })
  ),
});

export const mockReportSchema = z.object({
  verdict: panelVerdictSchema,
  confidence: z.number().int().min(0).max(100),
  dimensions: z.array(mockReportDimensionSchema),
  oneRep: z
    .object({
      questionId: z.string(),
      lp: z.string(),
      text: z.string(),
      estMinutes: z.number(),
    })
    .nullable(),
  fluency: fluencySchema.nullish(),
});

export type MintRequest = z.infer<typeof mintRequestSchema>;
export type PanelSeatPublic = z.infer<typeof panelSeatPublicSchema>;
export type RealtimeEphemeral = z.infer<typeof realtimeEphemeralSchema>;
export type CreateMockSessionResponse = z.infer<
  typeof createMockSessionResponseSchema
>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type TurnResponse = z.infer<typeof turnResponseSchema>;
export type MockReport = z.infer<typeof mockReportSchema>;
export type MockReportDimension = z.infer<typeof mockReportDimensionSchema>;
export type MockFluency = z.infer<typeof fluencySchema>;

export type Inclination = z.infer<typeof inclinationSchema>;
export type ScoreDimensionT = z.infer<typeof scoreDimensionSchema>;
export type MockStatusT = z.infer<typeof mockStatusSchema>;
export type InterviewTypeT = z.infer<typeof interviewTypeSchema>;
export type DimensionScoreData = z.infer<typeof dimensionScoreSchema>;
export type PanelVerdictData = z.infer<typeof panelVerdictSchema>;
export type ConfidenceMetricData = z.infer<typeof confidenceMetricSchema>;
export type TurnEvents = z.infer<typeof turnEventsSchema>;

---
title: Data Model
tags: [architecture]
updated: 2026-06-01
---

# Data Model

**Prisma 7** with the new generator (`provider = "prisma-client"`, `output = "../src/generated/prisma"`) — import from `@/generated/prisma` (or `src/lib/db.ts`), **never** `@prisma/client`. Postgres. Every user-data query is **userId-scoped** (no organization concept). All confidence-engine additions are purely additive.

## Enums (new with the confidence engine)
`SignalLevel {NEW_GRAD, SDE_II, SENIOR}` (enables typed `GROUP BY signalLevel` — see [[Signal Levels]]) · `LlmProvider` · `InterviewType {…, BAR_RAISER_PANEL}` · `ScenarioDifficulty {WARMUP, CALIBRATED, ADVERSARIAL}` · `MockStatus {PENDING, LIVE, DEBRIEF, COMPLETED, ABANDONED, FAILED, INTERRUPTED}` · `ScoreDimension` · `DrillStatus` · `JobStatus {PENDING, RUNNING, DONE, FAILED}`.

## Key models
- **Auth.js:** `User` (`targetCompanies String[] @default(["amazon"])`, `interviewDate`, `targetLevel`, nullable `passwordHash`), `Account`, `Session`, `VerificationToken`. See [[Auth and Routing]].
- **[[Speaking Coach]]:** `PracticeSession`, `PracticeTurn` (`@@unique([sessionId, clientTurnId])`, `rubricScoresJson`). `PracticeTurnRole {USER, COACH}`.
- **[[Bar-Raiser Panel]]:** `Scenario` → `PanelSeat[]` (`@@unique([scenarioId, seatOrder])`, `ownedLPs String[]`, `isBarRaiser`, `voice`, `systemPrompt`); `MockSession` (`@@unique([userId, clientRequestId])` idempotency; `spendCents`, `audioOptIn` default false, denormalized `overallSignal/confidence/passed/reportJson`); `MockTurn` (`@@unique([sessionId, seq])`, `transcriptionMissing`, `audioStartMs/EndMs`).
- **[[Judgment Pipeline]]:** `DimensionScore` (**`userId` denormalized** for join-free weakest-LP `GROUP BY`), `PanelVerdict` (`@unique sessionId`; `inclination` stores the 6-value enum as String), `ConfidenceMetric` (`composure`, nullable `resilience/selfEfficacy`, `onDelete: SetNull` so the user trend survives session purge), `DrillAssignment`, `JudgmentJob` (PK=sessionId, `leaseUntil` — the durable work-ticket).
- **[[Security|Spend/abuse]]:** `RateBucket` (`@@id([key, windowStart])`), `GlobalSpend` (`day` PK, `estUsd Decimal`), `SpendReservation`.

## Not in the schema yet
The envelope-encrypted **`UserApiKey`** (BYOK at-rest) is **P1**, gated on real KMS+IAM — see [[Pricing and BYOK]].

> Deploy note: the Dockerfile manually COPYs `src/generated/prisma` into the runner stage (standalone output misses it) — keep that COPY in sync if the output path moves.

## Related
[[Architecture Overview]] · [[Judgment Pipeline]] · [[Realtime Panel]] · [[Auth and Routing]] · [[Speaking Coach]]

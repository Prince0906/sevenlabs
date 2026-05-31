---
title: Judgment Pipeline
tags: [architecture]
updated: 2026-06-01
---

# Judgment Pipeline

The off-band, durable scoring engine — the **proprietary** part of the [[Moat]]. Runs in `src/lib/mock/panel-orchestrator.ts` `runJudgment(sessionId)` **after** the HTTP response flushes, on Aloud's **pinned `gpt-4o-mini`** (never the user's key — calibration must be model-stable; see [[Pricing and BYOK]]).

## Durable queue (`judgment-queue.ts`)
`complete` writes a `JudgmentJob{PENDING}` row in the **same transaction** as the LIVE→DEBRIEF flip (a crash can't strand a DEBRIEF with no job). `claimNext()` uses `… WHERE status=PENDING OR (RUNNING AND leaseUntil<now) … FOR UPDATE SKIP LOCKED` (lease 120s). An on-boot sweep + 60s interval re-claim stale jobs (`after()` alone dies on redeploy/OOM). `MAX_ATTEMPTS=3` → on exhaust, both `JudgmentJob` and `MockSession` go FAILED with a redacted error.

## Scoring partitioned by LP, not transcript
**Every seat scores the full candidate (USER-only) transcript**; the partition is over the **rubric** a seat is given (its `ownedLPs` — see [[Leadership Principles]]), so seat A literally never sees Customer Obsession as scorable and can't launder a fluent answer. Each seat returns `{ matchedLPs: [{name, signalLevel, evidence}]≤3, overallSignal, weakestArea }`; evidence must be a transcript substring or it's dropped/turn-anchored.

## Deterministic Bar-Raiser veto (NOT model-decided)
`barRaiserDrillDepth()` counts consecutive Bar-Raiser COACH turns **server-side** (the browser can't self-mark or be jailbroken to suppress it). `evaluateDrill()`: if depth `>= 2` **and** the Bar-Raiser's LPs collapsed (no matched LPs / all NEW_GRAD) → `barRaiserVeto = true`. The `>= 2` threshold is the anti-anxiety guardrail ([[Vision]]). Mirrors the real [[Amazon Bar Raiser]].

## Committee verdict
A dedicated `judgeCommittee()` call (`max_tokens: 1200` so prose+rollup never truncate into invalid JSON) emits `panelVerdictSchema`: `overallSignal`, `inclination` (6-value enum), `barRaiserVeto`, `summary`, `seatRollup[]`, `topStrengths≤3`, `topRisks≤3`. `finalizeVerdict()` applies the veto **in code** after the model returns (veto → inclination forced NO_HIRE, signal clamped down). The Bar-Raiser seat is **required** — if it never parses, the session FAILs rather than emit a HIRE that should've been a veto.

## Composure + report
[[Confidence Metric|Composure]] is computed here. One `$transaction` writes `DimensionScore[]` + `PanelVerdict` + `ConfidenceMetric` + `DrillAssignment`, flips → COMPLETED with denormalized `overallSignal/confidence/passed/reportJson`, then reconciles spend. The report is polled (202→200, ETag/304) and renders weakest-first with a `oneRep` drill.

## Related
[[Bar-Raiser Panel]] · [[Leadership Principles]] · [[Amazon Bar Raiser]] · [[Confidence Metric]] · [[Signal Levels]] · [[Data Model]] · [[Security]] · [[Architecture Overview]]

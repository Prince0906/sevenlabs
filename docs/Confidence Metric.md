---
title: Confidence Metric
tags: [product]
updated: 2026-06-01
---

# Confidence Metric

The north-star metric ([[Vision]]). v1 is **Composure-only** — one frozen formula — because a wobbling, judgmental confidence number would induce the very anxiety it's meant to cure.

## The formula (v1, frozen)
`computeComposure` runs per USER turn (excluding turns where transcription was missing) and combines:
- **Filler score** (fillers per 100 words) — weight **0.45**
- **WPM steadiness** (coefficient of variation of words-per-minute) — weight **0.35**
- **Pause control** (CV of longest pause) — weight **0.20**

…then multiplied by a `DIFFICULTY_WEIGHT` (WARMUP / CALIBRATED / ADVERSARIAL → 0.95 / 1.00 / 1.06; see [[Coaching Modes]]) and clamped to 0–100. WPM is derived from the **speech word-span**, not wall-clock (which would deflate it).

## What's deferred (and why it's safe to defer)
`resilience` and `selfEfficacy` are stored as separate, NULL columns until P2. Re-weighting later is a *recompute*, never data loss.

## Honesty rules
- In live mode the [[Realtime Panel]] gives **text-only** transcripts (no word timings), so composure leans on answer latency + barge-ins + turn count, and the report renders a graceful "—" rather than faking a number ([[Judgment Pipeline]]).
- It is **never shown as a single falling number** until validated against hand-labeled "felt confident" data (a stated kill-criterion in [[Open Questions]]).

The whole bet rests on the rehearsal→self-efficacy→performance chain in [[Evidence Base]].

## Related
[[Evidence Base]] · [[Signal Levels]] · [[Judgment Pipeline]] · [[Vision]] · [[Open Questions]] · [[Coaching Modes]]

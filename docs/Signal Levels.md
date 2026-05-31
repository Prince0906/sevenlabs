---
title: Signal Levels
tags: [product]
updated: 2026-06-01
---

# Signal Levels

The **Signal** is the level a candidate reads as — the thing no competitor grades (see [[Moat]], [[Competitive Landscape]]). It is also the soul of the visual language ([[Design System]]): the one place saturated color is allowed, so color always means *level*, never decoration.

## The three levels
| Level | Meaning | Color | Score |
|---|---|---|---|
| **New Grad** | "emerging" | 🟠 amber | 40 |
| **SDE II** | "competent" | 🔵 blue | 70 |
| **Senior** | "arrived" | 🟢 emerald | 90 |

- `SIGNAL_RANK`: `NEW_GRAD: 0, SDE_II: 1, SENIOR: 2`.
- `SIGNAL_TO_SCORE` (the ordinal map the [[Judgment Pipeline]] uses): **`{NEW_GRAD: 40, SDE_II: 70, SENIOR: 90}`**.
- `SignalLevel` is a real Postgres enum (added with the confidence engine) so the [[Data Model]] can do typed `GROUP BY signalLevel`.

## Where it shows up
- The **seat colors** in the [[Bar-Raiser Panel]] follow the climb (seat 0/1/2 = amber/blue/emerald).
- Each interviewer in the [[Judgment Pipeline]] returns an `overallSignal`; the committee rolls them into one `overallSignal` for the verdict.
- The report's "Signal reached" hero and the shareable Signal card render it.
- A user has a `targetLevel` (default `NEW_GRAD`).

Defined in `src/lib/signal.ts` (labels/rank/Tailwind theme classes) and `seat-theme.ts` (seat→color).

## Related
[[Design System]] · [[Bar-Raiser Panel]] · [[Judgment Pipeline]] · [[Confidence Metric]] · [[Product Overview]]

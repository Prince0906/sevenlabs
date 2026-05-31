---
title: Bar-Raiser Panel
tags: [product]
updated: 2026-06-01
---

# Bar-Raiser Panel

The core feature and the [[Moat|moat]]: **one Amazon `BAR_RAISER_PANEL` scenario with three seats**, each owning a different slice of the 16 [[Leadership Principles]] so every interviewer scores **independently**. Their disagreement is signal a single chat can't fake. Modeled on the real [[Amazon Bar Raiser]] loop.

## The three seats
Seeded interviewers, colored by the seniority climb ([[Signal Levels]]):

| Seat | Persona | Voice | Tint | Owns (LPs) |
|---|---|---|---|---|
| 0 | **Maya** — Builder (SDM) | `alloy` | amber / New Grad | Customer Obsession, Ownership, Invent & Simplify, Deliver Results, Hire & Develop |
| 1 | **Dev** — Operator (Senior SDE) | `verse` | blue / SDE II | Dive Deep, Highest Standards, Bias for Action, Frugality, Success & Scale |
| 2 | **Priya** — **Bar Raiser** (Principal) | `sage` | emerald / Senior | Earn Trust, Have Backbone, Are Right A Lot, Think Big |

Priya runs a "why/how ladder" that drills your **strongest** story until it either holds up or cracks.

## How a session flows
1. Mic granted **before** any spend.
2. Maya interviews → says the handoff sentinel *"Handing you to my colleague"* →
3. Dev interviews → hands off →
4. Priya (the Bar Raiser) drills →
5. **End** → the panel "deliberates" → a committee verdict appears.

Mechanically the panel is **three consecutive real-time voice sessions** (one per seat, because voice is locked per connection) — see [[Realtime Panel]] for why. Scoring, the deterministic veto, and the verdict happen off-band in the [[Judgment Pipeline]]. The result is a [[Signal Levels|Signal]] + inclination + a [[Confidence Metric]] + one drill to run next.

## The anti-anxiety guardrails
Warm by default; the Bar-Raiser only vetoes at follow-up depth `>= 2` (never on the first vague sentence). See [[Vision]].

## Related
[[Realtime Panel]] · [[Judgment Pipeline]] · [[Amazon Bar Raiser]] · [[Leadership Principles]] · [[Signal Levels]] · [[Confidence Metric]] · [[Moat]] · [[Design System]]

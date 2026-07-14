# ADR-0005: Difficulty is the Pressure Ladder — one integer rung, 1–5

- Status: Accepted (2026-06-11) — partially implemented

## Context
Three competing difficulty representations existed on paper: a 6-knob pressure
vector, the `ScenarioDifficulty` enum (WARMUP/CALIBRATED/ADVERSARIAL), and
ad-hoc per-turn pressure. Multiple canonical forms guarantee drift.

## Decision
One canonical representation: the **Pressure Ladder, integer rung 1–5**, stored
as the user-facing and persisted value. The knob vector becomes an internal
per-rung preset table in panel-core; `ScenarioDifficulty` maps via
`DIFFICULTY_TO_INT` (WARMUP→2, CALIBRATED→3, ADVERSARIAL→4).

## Consequences
Every future difficulty feature speaks in rungs. Rungs 1 and 5 and the preset
table are not fully wired yet — the enum mapping is; treat the rung as the
target representation when touching difficulty.

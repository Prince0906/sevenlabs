# ADR-0008: Report IA is recovery-first, verdict second

- Status: Accepted (2026-06-11)

## Context
A brutal committee verdict as the report's first screen is demoralizing for a
confidence product — and the panel deliberately runs harder than the real
thing.

## Decision
The report leads with what builds the next rep ("since last time" delta,
strongest recovery moment); the verdict renders second, always inside the
over-calibration frame ("this panel runs harder than Amazon's").

## Consequences
The report component order is a product decision, not a layout accident —
don't "fix" it to verdict-first. Pedagogy copy and verdict copy stay separate
concerns in the report components.

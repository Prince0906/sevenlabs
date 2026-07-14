# ADR-0009: Warmup is a phase of every session, not a standalone scenario

- Status: Accepted (2026-06-11)

## Context
Warmup could be modeled as its own scenario/session kind or as the opening
phase of every session. A standalone warmup fragments the session record and
loses the within-session baseline.

## Decision
`MockTurn.phase` (`WARMUP | MAIN | DRILL`) — warmup is the opening phase of
**every** session.

## Consequences
The warmup answers double as the candidate's own calm baseline for composure /
resilience deltas (self-relative measurement, never cross-candidate). Composure
math depends on warmup turns being tagged, so the phase tag is load-bearing,
not cosmetic.

# ADR-0007: The drill loop's atom is the Moment

- Status: Accepted (2026-06-11) — partially implemented

## Context
Three overlapping drill designs existed (rubric-dimension drills, LP drills,
moment replays). Multiple atoms fragment the "what should I practice next?"
answer.

## Decision
**The Moment is the atom.** A `DrillAssignment` points at a Moment (a specific
weak answer/exchange), max 3 active assignments, max 3 attempts (then decompose
into a micro-drill). The single highest-priority open Moment becomes question 2
of the next session's warmup. Drills never move the headline Signal
(`MockSession.kind = PANEL | DRILL`).

## Consequences
One prioritization queue instead of three. The Signal stays a panel-earned
credential — drill grinding can't inflate it. `DrillAssignment` exists in the
schema; the Moment extraction pipeline is not fully wired yet.

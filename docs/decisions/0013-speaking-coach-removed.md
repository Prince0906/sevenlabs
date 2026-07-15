# ADR-0013: The speaking coach was removed; one product remains

- Status: Accepted (2026-07-11). The "`COACH` kept" clause below was closed by
  [ADR-0016](0016-db-rename-and-reset-at-zero-users.md) (2026-07-15): the enum
  is now `TurnRole` with `COACH` renamed `INTERVIEWER`.

## Context
Aloud began as a synchronous speaking coach (record → Whisper → feedback →
TTS). The real-time interview panel became the product; the coach sat parked,
dragging naming, docs, env vars, and dead config everywhere ("two products"
framing with only one invested in).

## Decision
Remove the coach entirely: migration `20260711094329_remove_speaking_coach`
drops `PracticeSession`/`PracticeTurn` + `PracticeSessionStatus`. Recover from
git history if ever needed. **Kept deliberately:** the `PracticeTurnRole` enum
— `MockTurn.role` reuses it, where `COACH` means "interviewer seat".

## Consequences
One product, one funnel, one set of docs. The `COACH` enum value is a frozen
naming fossil in the DB layer (see ADR-0014) — code treats it as the
interviewer role and must not rename it outside a coordinated migration.
Speech/disfluency analysis survives — it was never coach-only; it powers the
panel's fluency read.

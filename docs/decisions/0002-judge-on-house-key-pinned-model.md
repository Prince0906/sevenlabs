# ADR-0002: Judgment always runs on the house key with a code-pinned model

- Status: Accepted (2026-06-11)

## Context
Live voice may run on the user's BYOK key. The committee judge (per-seat
scoring, debrief, verdict) could also run there — it's cheaper for the house —
but the verdict is the product's core artifact and the moat's calibration
label.

## Decision
Judgment **always** runs on Aloud's `OPENAI_API_KEY` with a model **pinned in
code** (never config-driven, never the user's key or model choice). Every
verdict is stamped with `judgeModel` + `rubricVersion`.

## Consequences
Honest marginal cost (~$0.02–0.05/session) stays on the house. Removing a BYOK
key loses live voice, never the report. Verdicts are comparable across users
and time — a config-driven judge would silently re-base the calibration data.
An owning test enforces the pin (`panel-orchestrator.test.ts`).

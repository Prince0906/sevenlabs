# ADR-0016: DB layer renamed and reset while the product has zero users

- Status: Accepted (2026-07-15) — supersedes the frozen-DB-layer clause and the
  compat-shim consequence of [ADR-0014](0014-ubiquitous-language.md); updates
  the "`COACH` kept" note in [ADR-0013](0013-speaking-coach-removed.md)

## Context
ADR-0014 froze the DB layer (`MockSession`/`MockTurn`/`MockStatus`,
`PracticeTurnRole.COACH`, the `Mock*` Zod mirrors) and added `/mock` redirects
plus an `/api/mock` rewrite, on the assumption that prod was live with users.
The owner clarified there are **zero users** — prod holds only disposable test
data, and backward compatibility protects nobody.

## Decision
- **Schema renamed for real** (no `@map` indirection): `MockSession →
  InterviewSession`, `MockTurn → InterviewTurn`, `MockStatus →
  InterviewStatus`, `PracticeTurnRole → TurnRole` with `COACH → INTERVIEWER`.
  The `Mock*` Zod mirrors became `Interview*`; the client FSM's `coach`
  vocabulary became `interviewer`.
- **Migration history squashed**: the 9 historical migrations were replaced by
  one fresh init migration generated from the renamed schema (verified to
  reproduce `schema.prisma` exactly via the same replay+diff the CI drift gate
  runs). Dead columns dropped in the same pass
  (`transcriptKey`/`audioOptIn`/`audioKey`/`rawS3Key` S3 fossils,
  `User.targetLevel`).
- **Databases reset**: dev immediately; prod via the runbook at merge time
  (wipe schema → deploy applies init → seed re-runs).
- **Compat shims removed**: no `/mock` redirects, no `/api/mock` rewrite.

## Consequences
The ubiquitous language now reaches the data layer — new code never sees
`mock`/`coach`/`practice` naming anywhere. Pre-squash migration history exists
only in git history. Any old database (none should exist) is incompatible with
the squashed history and must be reset, not migrated. The write-only
calibration corpus (`ConfidenceMetric`, `DrillAssignment`,
`InterviewTurn.events`) was deliberately kept — it is accruing moat data, not
dead weight.

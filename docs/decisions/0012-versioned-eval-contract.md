# ADR-0012: The eval contract is versioned; predictions are immutable snapshots

- Status: Accepted (2026-06-12); capture funnel shipped

## Context
A prediction label is only valid relative to the rubric + judge that produced
it. Unstamped verdicts mean a single rubric edit silently re-bases every prior
prediction — degrading the (prediction → real outcome) calibration data, the
product's long-term moat, to noise.

## Decision
One `RUBRIC_VERSION` const in panel-core; every `PanelVerdict` is stamped
`rubricVersion` + `judgeModel`; `Outcome` (the user-reported real result,
captured on the returning-visit report card with PENDING/GHOSTED as
first-class states) **snapshots** `predictedSignal`/`rubricVersion` at capture
time.

## Consequences
Never recompute a stored prediction from the current rubric at read time.
Rubric edits require bumping `RUBRIC_VERSION`. Calibration analysis groups by
`rubricVersion` — mixed-version pools are apples and oranges.

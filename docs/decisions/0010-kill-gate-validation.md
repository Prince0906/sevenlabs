# ADR-0010: Nothing past the session-1 slice ships until the kill-gate passes

- Status: Accepted (2026-06-11) — gate not yet passed

## Context
The roadmap holds an endless supply of buildable features (scenario tiers,
Gemini, KMS, story memory, managed tier). Building them before real humans
validate the core loop is the classic solo-founder failure mode.

## Decision
**Kill-gate:** 10 real humans complete a full panel; ≥5 say they'd do another;
≥5 screenshot-worthy reports. Until it passes, only the session-1 wow slice
(live panel → verdict → share) gets investment.

## Consequences
Feature requests get sequenced *behind* the gate by default. The gate is why
"deliberately not doing" lists exist across the docs — cite this ADR when
declining scope.

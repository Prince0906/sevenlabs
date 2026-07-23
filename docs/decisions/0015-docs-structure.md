# ADR-0015: Docs structure — living docs in docs/, superseded plans deleted

- Status: Accepted (2026-07-14)

## Context
Ten markdown files sat at the repo root; deployment was documented in five
places; the two large planning docs (ENGINEERING.md, INTERVIEW_ENGINE_PLAN.md)
duplicated each other's decision logs and roadmaps and had drifted ~a month
behind the code. Point-in-time plans kept masquerading as current docs.

## Decision
- **Root keeps only GitHub-surfaced files**: `README.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, `LICENSE`, plus `CLAUDE.md` (= `AGENTS.md` symlink, the agent
  working guide).
- **Living docs move to `docs/`**: `architecture.md` (current state only — no
  roadmaps), `decisions/` (immutable ADRs), `runbooks/deploy.md` (deployment
  documented ONCE), `testing.md`, `design.md`.
- **Superseded planning docs are deleted, not archived** — git history is the
  archive (`ENGINEERING.md`, `INTERVIEW_ENGINE_PLAN.md`, `DEPLOY.md`,
  `CICD.md` all end at this commit; their binding content was extracted into
  the ADRs and the runbook first).

## Consequences
A doc that stops being true gets fixed or deleted — never left to drift as
"probably still mostly right". New binding decisions get a new ADR, not a
section in a growing plan file. Deployment changes are edited in exactly one
place (`docs/runbooks/deploy.md`).

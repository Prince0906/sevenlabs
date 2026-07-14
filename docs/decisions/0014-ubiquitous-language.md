# ADR-0014: Ubiquitous language — interview / panel / providers; DB layer frozen

- Status: Accepted (2026-07-14) — supersedes the `interview-core`/`lib/llm`
  naming proposals from the 2026-06-12 audit

## Context
One product answered to six names (`mock`, `panel`, `coach`, `interview`,
`room`, `COACH`) across URL, API, feature dir, packages, and DB. The `coach`
names were lies (removed product); the rest was scatter.

## Decision
Three terms, each with one meaning:
- **interview** — the product surface: URL `/interview`, API
  `/api/interview/*`, `src/features/interview/`, `src/lib/interview/`.
- **panel** — the 3-interviewer committee mechanism: `@sevenlabs/panel-core`,
  `panel-machine`, `panel-orchestrator`, `PanelSeat`/`PanelVerdict`.
- **providers** — vendor clients: `src/lib/providers/{openai,deepgram}.ts`.

The **DB layer is frozen**: `MockSession`/`MockTurn`/`MockStatus` (read
"interview session/turn/status"), `PracticeTurnRole.COACH` (read "interviewer
seat"), and the Zod contract names mirroring them (`MockReport`). Renaming
those requires a coordinated schema+contract migration against live prod —
out of scope until deliberately taken on.

## Consequences
Old URLs 308-redirect (`/mock` → `/interview`); `/api/mock/*` is transparently
rewritten to `/api/interview/*` in `next.config.ts` until pre-rename clients
age out (then delete the rewrite). New code must pick the term by meaning —
"interview" for the surface, "panel" for the committee — never reintroduce
`mock`/`coach` naming in code paths.

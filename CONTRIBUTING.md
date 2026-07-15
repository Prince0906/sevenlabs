# Contributing to Aloud

Thanks for contributing! This guide covers setup, conventions, and the checks every change must pass.

## Setup

Follow the Quick Start in [README.md](README.md): `npm install`, copy `.env.example` → `.env`, `npm run db:push && npm run prisma:seed`, then `npm run dev`.

## CI

Every pull request runs **CI** (`.github/workflows/ci.yml`) — on every PR, including forks, with **no secrets**. Five checks must be green: **Lint**, **Typecheck**, **Tests + coverage gate** (a ratchet — see [`docs/testing.md`](docs/testing.md)), **Clean build**, **Schema/migration drift**.

### One command before you push

```bash
npm run verify
```

Runs **lint → typecheck → tests+coverage → build** in the exact env CI uses. If `verify` is green locally, CI will be green too. (Schema-drift isn't in `verify` — it needs a throwaway Postgres; run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` only if you touched the schema.) Single file: `npx vitest run path/to/file.test.ts`; by name: `-t "name of test"`.

### Merging & deployment

A PR merges once all five checks are green and a maintainer approves. Deploys are **automatic and maintainer-only**: merging to `main` triggers the Deploy workflow (re-gate → build → migrate → approval-gated roll). You never touch it. Pipeline + operations: [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md).

## Branches & commits

- Branch off `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- **Conventional Commits**: `feat(scope): …`, `fix(scope): …`. Imperative subject; the *why* in the body.
- Open a PR against `main`; describe **what changed and how you verified it**.

## Code conventions

- **Surgical changes.** Don't refactor adjacent code, reformat, or add features the task didn't ask for. Match the surrounding style. No speculative abstractions.
- **Naming** ([ADR-0014](docs/decisions/0014-ubiquitous-language.md)): *interview* = the product surface (`/interview`, `/api/interview`, `src/features/interview/`, `src/lib/interview/`) · *panel* = the 3-interviewer committee mechanism (`packages/panel-core`, `panel-machine`, `panel-orchestrator`) · *providers* = vendor clients (`src/lib/providers/`). Never reintroduce `mock`/`coach` naming anywhere — the DB layer speaks the same language since [ADR-0016](docs/decisions/0016-db-rename-and-reset-at-zero-users.md) (`InterviewSession`, `TurnRole.INTERVIEWER`).
- **Feature shape.** A route file (page/layout) imports a feature **only through its `views/`**; `components/`, `hooks/`, `lib/` are feature-internal. Sibling imports within a feature are relative (`../components/…`); cross-boundary imports use `@/`. No barrel `index.ts` files.
- **Workspace split.** Pure, testable logic (rubrics, verdict math, disfluency) lives in `packages/panel-core` (**no I/O**); shared Zod contracts in `packages/shared-types`; ALL I/O (Prisma / OpenAI / Deepgram) in `src/lib/`.
- **Prisma.** Import the client via the singleton in `src/lib/db.ts`, **never** `@prisma/client`. Every query touching user data is **userId-scoped**. Schema changes are additive; review migrations as CREATE-only.
- **Security.** Never commit `.env*` or `.claude/`. Provider secrets are use-once/ephemeral — only `mintRealtimeEphemeral` ever sees an `sk-` key, and **all logging goes through `redact()` via `src/lib/log.ts`** (`console.*` is blocked by ESLint). Spend is metered on the server clock, never client-reported time.
- **Design system.** Semantic Tailwind tokens (`bg-card`, `text-foreground`, `border`, …). Saturated color is reserved for the **Signal** levels (amber/blue/emerald = New Grad/SDE II/Senior) — color always means *level*, never decoration. Full rules: [`docs/design.md`](docs/design.md).
- **React 19 / React Compiler.** Don't read or write refs during render.

## Tests

Vitest. **Two homes**: package tests in `packages/*/src/__tests__/`; app tests (routes, lib, feature engines) in `src/__tests__/{unit,integration}/` — never inside `src/features/`. Add or extend tests for any new pure logic. The full contract (layers, mocking policy, invariants, coverage ratchet): [`docs/testing.md`](docs/testing.md).

## Docs

Living docs only ([ADR-0015](docs/decisions/0015-docs-structure.md)): update [`docs/architecture.md`](docs/architecture.md) when the system changes; record a new load-bearing decision as a new ADR in [`docs/decisions/`](docs/decisions/); update `CLAUDE.md` if it's a working instruction for agents/contributors. Don't create new root-level docs.

## Reporting issues & security

Open a GitHub issue for bugs and feature requests. For anything security-sensitive (BYOK keys, spend, auth, secrets), follow [`SECURITY.md`](SECURITY.md) — report privately, never in a public issue.

# Contributing to Aloud

Thanks for contributing! This guide covers setup, conventions, and the checks every change must pass.

## Setup

Follow the Quick Start in [README.md](README.md): `npm install`, copy `.env.example` → `.env`, `npm run db:push && npm run prisma:seed`, then `npm run dev`.

## CI/CD

Every pull request runs one workflow — **CI** (`.github/workflows/ci.yml`). It
runs on every PR, including from forks, and needs **no secrets**. Five checks
must be green to merge:

| Check | What it means | Reproduce locally |
|---|---|---|
| **Lint** | ESLint passes (incl. `no-console` — secrets must go through `redact()`). | `npm run lint` |
| **Typecheck** | `tsc --noEmit` compiles the whole repo. | `npm run typecheck` |
| **Tests + coverage gate** | Vitest suite passes **and** coverage doesn't regress (the threshold is a ratchet — see [`TESTING.md`](TESTING.md)). | `npm run test:coverage` |
| **Clean build** | `next build` succeeds from a fresh `npm ci` — catches a `HEAD` that imports an untracked file. | `npm run build` |
| **Schema/migration drift** | `prisma/schema.prisma` matches the committed migrations. If you changed the schema, add a migration. | `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` |

### One command before you push

```bash
npm run verify
```

This runs **lint → typecheck → tests+coverage → build** with the exact env CI
uses. If `verify` is green locally, CI will be green too. (Schema-drift isn't in
`verify` because it needs a throwaway Postgres; run the `prisma migrate diff`
above only if you touched the schema.) Run a single test file with
`npx vitest run path/to/file.test.ts`, or by name with `-t "name of test"`.

### Merging

A PR merges once **all five CI checks are green** and a maintainer approves. CI
runs automatically — you don't configure anything.

### Deployment (maintainers only)

Deploys are **automatic and out of a contributor's hands**. When a PR merges to
`main`, the **Deploy** workflow (`.github/workflows/deploy.yml`) re-gates the
commit, builds the Docker image, pushes it to GHCR, applies DB migrations, and
rolls the app on our single EC2 box. It uses maintainer-only secrets and
**never runs on a PR or a fork** — you never touch it. See [`DEPLOY.md`](DEPLOY.md).

## Branches & commits

- Branch off `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Use **Conventional Commits**: `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`. Keep the subject imperative and short; put the *why* in the body.
- Open a PR against `main`. Make sure the gate is green and describe **what changed and how you verified it**.

## Code conventions

- **Surgical changes.** Don't refactor adjacent code, reformat, or add features the task didn't ask for. Match the surrounding style.
- **No speculative abstractions.** No config knobs, no error handling for impossible cases, no generalizing single-use code.
- **Workspace split.** Pure, testable logic (speech analysis, prompts, rubric shapes) goes in `packages/panel-core` (**no I/O**) and gets unit tests; I/O-bound pipelines (Prisma / S3 / OpenAI) stay in `src/lib/`. Shared Zod schemas live in `packages/shared-types`.
- **Prisma.** Import the client from `@/generated/prisma` (or `src/lib/db.ts`), **never** `@prisma/client`. Every query that touches user data is **userId-scoped**. Schema changes are additive; review migrations as CREATE-only.
- **Security.** Never commit `.env*` or `.claude/`. Provider secrets are use-once/ephemeral — only `mintRealtimeEphemeral` ever sees an `sk-` key, and **all logging goes through `redact()` via `src/lib/log.ts`** (`console.*` is blocked by ESLint). Spend is metered on the server clock, never client-reported time.
- **Design system.** Use semantic Tailwind tokens (`bg-card`, `text-foreground`, `border`, …) so the forced-dark theme adapts automatically. Saturated color is reserved for the **Signal** levels (amber/blue/emerald = New Grad/SDE II/Senior) — color always means *level*, never decoration.
- **React 19 / React Compiler.** Don't read or write refs during render.

## Tests

Vitest. Tests live next to the logic they cover (`packages/panel-core/src/__tests__/`, `src/**/__tests__/`, `src/__tests__/`). Add or extend tests for any new pure logic — scoring, the panel state machine, the turn queue, composure.

## Docs

If you change what we're building or the order, update [`ENGINEERING.md`](ENGINEERING.md) (system design + sequenced roadmap) or [`INTERVIEW_ENGINE_PLAN.md`](INTERVIEW_ENGINE_PLAN.md) (product/feature plan) — whichever the change affects. Update `CLAUDE.md` if it's a working instruction for future contributors.

## Reporting issues & security

Open a GitHub issue for bugs and feature requests. For anything
security-sensitive (BYOK keys, spend, auth, secrets), follow
[`SECURITY.md`](SECURITY.md) — report privately, never in a public issue.

# Contributing to Aloud

Thanks for contributing! This guide covers setup, conventions, and the checks every change must pass.

## Setup

Follow the Quick Start in [README.md](README.md): `npm install`, copy `.env.example` → `.env`, `npm run db:push && npm run prisma:seed`, then `npm run dev`.

## The gate — run before every push

Every change must keep all four green:

```bash
npx tsc --noEmit                        # types
npm run lint                            # ESLint
SKIP_ENV_VALIDATION=true npm test       # Vitest
SKIP_ENV_VALIDATION=true npm run build  # production build
```

Run a single test file with `npx vitest run path/to/file.test.ts`, or by name with `npx vitest run -t "name of test"`.

## Branches & commits

- Branch off `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Use **Conventional Commits**: `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`. Keep the subject imperative and short; put the *why* in the body.
- Open a PR against `main`. Make sure the gate is green and describe **what changed and how you verified it**.

## Code conventions

- **Surgical changes.** Don't refactor adjacent code, reformat, or add features the task didn't ask for. Match the surrounding style.
- **No speculative abstractions.** No config knobs, no error handling for impossible cases, no generalizing single-use code.
- **Workspace split.** Pure, testable logic (speech analysis, prompts, rubric shapes) goes in `packages/coach-core` (**no I/O**) and gets unit tests; I/O-bound pipelines (Prisma / S3 / OpenAI) stay in `src/lib/`. Shared Zod schemas live in `packages/shared-types`.
- **Prisma.** Import the client from `@/generated/prisma` (or `src/lib/db.ts`), **never** `@prisma/client`. Every query that touches user data is **userId-scoped**. Schema changes are additive; review migrations as CREATE-only.
- **Security.** Never commit `.env*` or `.claude/`. Provider secrets are use-once/ephemeral — only `mintRealtimeEphemeral` ever sees an `sk-` key, and **all logging goes through `redact()` via `src/lib/log.ts`** (`console.*` is blocked by ESLint). Spend is metered on the server clock, never client-reported time. See [docs/Security.md](docs/Security.md).
- **Design system.** Use semantic Tailwind tokens (`bg-card`, `text-foreground`, `border`, …) so the forced-dark theme adapts automatically. Saturated color is reserved for the **Signal** levels (amber/blue/emerald = New Grad/SDE II/Senior) — color always means *level*, never decoration. See [docs/Design System.md](docs/Design%20System.md).
- **React 19 / React Compiler.** Don't read or write refs during render.

## Tests

Vitest. Tests live next to the logic they cover (`packages/coach-core/src/__tests__/`, `src/**/__tests__/`, `src/__tests__/`). Add or extend tests for any new pure logic — scoring, the panel state machine, the turn queue, composure.

## Docs

If you change architecture or product behavior, update the [`docs/`](docs/Home.md) vault (and `CLAUDE.md` if it's a working instruction). Keep `[[wikilinks]]` resolving — a quick check:

```bash
cd docs && comm -23 \
  <(grep -rhoE '\[\[[^]]+\]\]' *.md | sed -E 's/\[\[//;s/\]\]//;s/\|.*//' | sort -u) \
  <(ls *.md | sed 's/\.md$//' | sort)
# prints nothing when every link resolves
```

## Reporting issues & security

Open a GitHub issue for bugs and feature requests. For anything security-sensitive (API keys, spend, auth), email `support@aloud.app` rather than filing a public issue.

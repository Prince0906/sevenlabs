# CLAUDE.md

Guidance for Claude Code (`AGENTS.md` is a **symlink to this file**) in the **Aloud** repo — a Next.js monorepo with **one product**: the real-time **interview panel** (3-seat Bar-Raiser over the OpenAI Realtime API, BYOK, resume-grounded, off-band judge). The legacy speaking coach was REMOVED ([ADR-0013](docs/decisions/0013-speaking-coach-removed.md)).

**Docs map** (read on demand): design → `docs/architecture.md` · why → `docs/decisions/` (ADRs) · deploy/ops → `docs/runbooks/deploy.md` · testing contract → `docs/testing.md` · UI rules → `docs/design.md` · contributor conventions → `CONTRIBUTING.md`.

## Commands

```bash
npm run dev                         # Next.js 16 / React 19 at :3000
npm run build
npm run db:push                     # dev only — schema push WITHOUT a migration; never for shared schema changes
npx prisma migrate deploy           # applies prisma/migrations/* — CI and prod use this
npm run prisma:seed

npm test                            # vitest run
npm run test:coverage               # suite + the coverage ratchet (what CI runs)
npx vitest run src/__tests__/unit/panel-orchestrator.test.ts   # single file
npx vitest run -t "name of test"                                # by name
npm run lint
npm run verify                      # the FULL CI gate locally: lint → typecheck → tests+coverage → build
```

`postinstall` runs `prisma generate && npm run copy:vad`. `copy:vad` copies from **three** sources into `public/vad/`: `@ricky0123/vad-web/dist/.`, `onnxruntime-web/dist/*.mjs`, and `onnxruntime-web/dist/*.wasm` — all must exist for the app to boot.

**DB is Prisma Postgres CLOUD** (`.env` `DATABASE_URL` → `db.prisma.io:5432`; `.env.example` shows a localhost placeholder). **Migration tooling lives in `prisma.config.ts`** (Prisma 7): `migrations.path = prisma/migrations`, `datasource.url = DATABASE_URL`, `datasource.shadowDatabaseUrl = SHADOW_DATABASE_URL` (migrate-dev/diff only; unset at runtime).

`SKIP_ENV_VALIDATION=true` bypasses the Zod-validated env in `src/lib/env.ts` — set by CI, the Dockerfile, and the `verify:test`/`verify:build` scripts.

**CI**: `ci.yml` runs five secret-free jobs on every PR + push-to-main (Lint · Typecheck · Tests + coverage gate · Clean build · Schema/migration drift vs a throwaway `postgres:16`); `deploy.yml` on push-to-main runs `gate → build (GHCR) → migrate → deploy` (approval-gated by the `production` Environment). Details: `docs/runbooks/deploy.md`.

## Architecture (map + invariants — full detail in `docs/architecture.md`)

npm-workspaces monorepo (`packages/*`), Next.js app at repo root (`src/`), single process at :3000. The **server is never in the audio path** — the browser talks WebRTC directly to OpenAI on a short-TTL ephemeral the server mints (ADR-0004). BFF routes: `src/app/api/interview/sessions/*` + `/api/{keys,resume,user}` (enumerated in `docs/architecture.md` §2).

Where things live:

- **Client engine** `src/features/interview/`: `lib/panel-machine.ts` (pure reducer FSM) + `hooks/use-interview.ts` (side effects on phase transitions) + `lib/realtime-connection.ts` (WebRTC, one ephemeral/one seat) + `lib/realtime-events.ts` (the ONE place untrusted OpenAI JSON becomes typed state; malformed → `null`, never throws) + `lib/turn-queue.ts` (single-writer seq commit queue) + `lib/api-client.ts` (the one BFF URL chokepoint).
- **`REALTIME_INPUT_CONFIG`** (`packages/shared-types/src/realtime-config.ts`) is the single source of truth for the input session, imported by BOTH the server mint and the client patch — divergence silently breaks PTT transcription (ADR-0011).
- **Judgment**: lease-based durable queue (`src/lib/interview/judgment-queue.ts`, started from `src/instrumentation.ts`) → `runJudgment` (`src/lib/interview/panel-orchestrator.ts`) → `judgeCommittee()` (`src/lib/providers/openai.ts`). Removing a BYOK key loses live voice, never the report.
- **BYOK** (ADR-0001): `src/lib/byok.ts` + `src/lib/crypto.ts` (AES-256-GCM under `KEY_ENCRYPTION_SECRET`; unset ⇒ `/api/keys` returns 503 and everything runs on the house key). Raw key transits the server exactly once; no read-back endpoint; revoke = hard delete.
- **Spend**: `src/lib/interview/spend.ts` — reserve-then-settle; defaults $4/session (house), 3600 s (BYOK), $50/day; metered on the server clock. Bypassing reservation lets a session exceed the cap.
- **Resume grounding**: `validateResumeFacts` (`packages/panel-core/src/resume.ts`) drops unquotable facts; the digest (`src/lib/interview/resume-digest.ts`) fails CLOSED on schema mismatch.
- **Disfluency**: Deepgram verbatim ASR when `DEEPGRAM_API_KEY` is set; Whisper fallback cleans speech, so disfluency reads artificially low (`disfluencyJson` null).
- **Moat data**: `Outcome` snapshots `predictedSignal`/`rubricVersion` **at capture time** (ADR-0012) — never recompute from the current rubric at read time.

**Highest-stakes invariants** (each has an owning test — `docs/testing.md` §6):
1. every user-data query is **userId-scoped**; 2. the judge ALWAYS runs on the **house key** with a **code-pinned model** (never config-driven, ADR-0002); 3. BYOK keys are **never echoed back** (display = `last4`/fingerprint; all logging flows through `redact()` via `src/lib/log.ts`); 4. **`turn_detection` stays `null`** (push-to-talk); 5. `InterviewTurn` is **single-writer, seq-ordered** — the judge scores `orderBy seq asc`.

## Workspace packages & the pure-logic boundary

`packages/panel-core` (verdict math, rubrics + `RUBRIC_VERSION`, disfluency engine, guardrails, redaction) and `packages/shared-types` (Zod contracts, realtime config) are **pure — no I/O, no React** — as are `src/features/interview/lib/{panel-machine,realtime-events,turn-queue}`; all are unit-tested directly. ALL Prisma/OpenAI/fetch I/O lives in `src/lib` (`providers/`, `interview/`, auth/byok/crypto/db/env/log/resume…). Don't mix I/O into the pure tier — it breaks the test boundary. File-by-file inventory: `docs/architecture.md` §2–§3.

## Auth & routing

Auth.js v5 (NextAuth beta), Prisma adapter + **JWT sessions**; providers = Google OAuth + Credentials (bcrypt). Edge enforcement lives in **`src/proxy.ts`** (Next 16's middleware file — there is no `middleware.ts`); config split `src/auth.config.ts` (edge-safe) / `src/lib/auth.ts` (adapter + authorize). Public routes: `/`, `/sign-in`, `/sign-up`, `/api/auth/*`, `/api/health`. **No organization concept** — user-owned rows cascade-delete with the User. Detail: `docs/architecture.md` §6.

## Data model

Prisma generator `provider = "prisma-client"` (not `prisma-client-js`), `output = "../src/generated/prisma"` (gitignored; regenerated on postinstall; the Dockerfile COPYs it into the runner stage manually — keep that COPY in sync if the path moves). **Import via the `prisma` singleton in `src/lib/db.ts`**; never `@prisma/client`. The DB speaks the code's language (ADR-0016): `InterviewSession`/`InterviewTurn`/`InterviewStatus`, `TurnRole` = `USER | INTERVIEWER`. **One squashed init migration**; any DB predating the squash must be reset, not migrated. Model/constraint detail: `docs/architecture.md` §6.

## Deployment

Single EC2 t3.micro running Docker behind Caddy (Terraform in `terraform/`); GHCR image `ghcr.io/prince0906/sevenlabs` (must stay **Public**); migrations apply automatically before the box rolls; secrets live only in GitHub Actions secrets — never commit them. Runbook: `docs/runbooks/deploy.md`.

## Conventions

`.cursor/rules/karpathy-behavioral-guidelines.mdc` is `alwaysApply: true`:
- **Surgical changes.** Don't refactor adjacent code, reformat, or "improve" what the task didn't ask for. Match existing style.
- **No speculative abstractions.** No config knobs, no error handling for impossible cases, no generalizing single-use code.
- **Surface uncertainty before coding.** If a task has multiple reasonable readings, ask.
- **Goal-driven.** State the verification step (usually a specific `vitest` invocation) before implementing.

Repo conventions (details in `CONTRIBUTING.md`):
- **Naming** (ADR-0014 + ADR-0016): *interview* = product surface, *panel* = the committee mechanism, *providers* = vendor clients — through every layer including the DB. Never reintroduce `mock`/`coach` naming.
- **Feature shape**: route files import a feature ONLY through its `views/`; `components/`/`hooks/`/`lib/` are internal; sibling imports relative, cross-boundary `@/`; no barrels.
- **Test homes**: package tests in `packages/*/src/__tests__/`; app tests in `src/__tests__/{unit,integration}/`; never inside `src/features/`.

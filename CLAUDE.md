# CLAUDE.md

Guidance for Claude Code (and `AGENTS.md`, which is a **symlink to this file** — editing one edits both) when working in the **Aloud** repo. Aloud is a Next.js monorepo with **one product**: the real-time **interview panel** (3-seat Bar-Raiser over the OpenAI Realtime API, BYOK, resume-grounded, off-band judge). The legacy speaking coach was REMOVED ([ADR-0013](docs/decisions/0013-speaking-coach-removed.md)); recover from git history if ever needed.

**Docs map**: current design → `docs/architecture.md` · why → `docs/decisions/` (ADRs) · deploy/ops → `docs/runbooks/deploy.md` · testing contract → `docs/testing.md` · UI rules → `docs/design.md`.

## Commands

```bash
# Web (Next.js 16 / React 19) — runs at :3000
npm run dev
npm run build                       # SKIP_ENV_VALIDATION=true set in the Dockerfile build, not locally
npm run start

# Database (Prisma 7, generator provider "prisma-client", client output: src/generated/prisma)
npm run db:push                     # dev only — pushes schema WITHOUT a migration; never for shared schema changes
npx prisma migrate deploy           # applies prisma/migrations/* — CI (deploy migrate job) and prod use this
npm run prisma:seed                 # tsx prisma/seed.ts

# Tests (Vitest)
npm test                            # one-shot (vitest run)
npm run test:watch
npm run test:coverage               # suite + the coverage ratchet (what CI runs)
npx vitest run src/__tests__/unit/panel-orchestrator.test.ts   # single file
npx vitest run -t "name of test"                                # by name

npm run lint                        # eslint
npm run verify                      # the FULL CI gate locally: lint → typecheck → tests+coverage → build
```

`postinstall` runs `prisma generate && npm run copy:vad`. `copy:vad` copies from **three** sources into `public/vad/`: `@ricky0123/vad-web/dist/.`, `onnxruntime-web/dist/*.mjs`, and `onnxruntime-web/dist/*.wasm` — all must exist for the app to boot.

**DB is Prisma Postgres CLOUD** (`.env` `DATABASE_URL` → `db.prisma.io:5432`; `.env.example` shows a localhost placeholder). **Migration tooling lives in `prisma.config.ts`** (Prisma 7): `migrations.path = prisma/migrations`, `datasource.url = DATABASE_URL`, `datasource.shadowDatabaseUrl = SHADOW_DATABASE_URL` (migrate-dev/diff only; unset at runtime).

`SKIP_ENV_VALIDATION=true` bypasses the Zod-validated env in `src/lib/env.ts`. CI sets it; the Dockerfile sets it for `next build`.

**CI gates** — two workflows:
- `.github/workflows/ci.yml` — **five** secret-free jobs on every PR + push-to-main: **Lint**, **Typecheck** (`tsc --noEmit`), **Tests + coverage gate** (ratchet), **Clean build** (fresh `npm ci` + `next build` — catches HEAD importing untracked files), **Schema/migration drift** (`prisma migrate diff` against a throwaway `postgres:16`).
- `.github/workflows/deploy.yml` — push-to-main only: `gate` (re-runs typecheck+tests) → `build` (image → GHCR) → `migrate` (`prisma migrate deploy`, needs build) → `deploy` (needs both; pauses on the `production` Environment approval, rolls the box, polls `/api/health`). See `docs/runbooks/deploy.md`.

## Architecture

**Monorepo via npm workspaces** (`packages/*`). Next.js app at repo root (`src/`). Single process at :3000. Full design: `docs/architecture.md`.

### The interview panel (the product)

A live 3-interviewer voice session over the **OpenAI Realtime API (WebRTC)**. The **server is never in the audio path** — the browser connects directly to OpenAI via a short-TTL ephemeral the server mints (ADR-0004). BFF routes under `src/app/api/interview/sessions/*`: `route.ts` (create+list), `[id]`, `[id]/mint`, `[id]/turns`, `[id]/turns/audio` (best-effort verbatim fluency-audio upload), `[id]/complete`, `[id]/report`, `[id]/outcome` (moat capture). Plus `/api/keys` (BYOK CRUD), `/api/resume` (upload+extract), `/api/user/interview-date`.

- **Client engine** (`src/features/interview/`): pure reducer FSM `lib/panel-machine.ts` (no I/O, unit-tested) drives the conversation; `hooks/use-interview.ts` performs side effects (mint/connect/post/timers) on phase transitions. Transport split: `lib/realtime-connection.ts` (WebRTC around one ephemeral/one seat; SDP offer POSTed with `Content-Type: application/sdp`) calls the **pure** `lib/realtime-events.ts` (`mapRealtimeEvent` — the single place untrusted OpenAI data-channel JSON becomes typed app state; malformed/unknown → `null`, never throws). `lib/turn-queue.ts` is the single-writer seq commit queue. `lib/api-client.ts` is the one URL chokepoint for the BFF.
- **Realtime input config**: `REALTIME_INPUT_CONFIG` in `packages/shared-types/src/realtime-config.ts` is the **single source of truth** for the input session (`transcription: {model:'gpt-4o-transcribe', language:'en'}`, `turn_detection: null` = push-to-talk, half-duplex). Imported by BOTH the server mint (`src/lib/providers/openai.ts`) and the client patch. Divergence silently breaks PTT transcription (ADR-0011).
- **Turns**: `InterviewTurn` is single-writer, `seq`-ordered (`@@unique([sessionId, seq])`, seq assigned at dequeue). `role` is `TurnRole` (`USER` | `INTERVIEWER`). The judge scores by `orderBy seq asc` — dropping/duplicating an INTERVIEWER turn corrupts the verdict.
- **Judgment**: a lease-based durable worker queue (`src/lib/interview/judgment-queue.ts`, leases `JudgmentJob` rows by `(status, leaseUntil)`; started from `src/instrumentation.ts`) dispatches `runJudgment` in `src/lib/interview/panel-orchestrator.ts`, which assembles the seq-ordered transcript and calls `judgeCommittee()` in `src/lib/providers/openai.ts`. Results land in `PanelVerdict` / `DimensionScore` / `ConfidenceMetric`. **The judge ALWAYS runs on the house key** (`env.OPENAI_API_KEY`) with a **code-pinned model** (never config-driven, ADR-0002). Removing a BYOK key loses live voice, never the report.
- **BYOK custody** (ADR-0001): `src/lib/byok.ts` (`resolveSessionKey`/`validateKeyViaMint`) + `src/lib/crypto.ts` (AES-256-GCM under `KEY_ENCRYPTION_SECRET`). The raw key transits the server **exactly once** (`POST /api/keys`) and is decrypted only inside the mint frame. **No read-back endpoint**; only `last4`/`fingerprint` are display-safe; revoke = hard delete. `ProviderKey` is `@@unique([userId, provider])`. When `KEY_ENCRYPTION_SECRET` is unset, `/api/keys` returns **503** and everything runs on the house key.
- **Spend safety** (`src/lib/interview/spend.ts`): house sessions bounded by `SESSION_CEILING_USD` (default $4 ≈ 13min @ $0.30/min); BYOK sessions bounded by time only (`MAX_SESSION_SEC`, default 3600s); `DAILY_CAP_USD` (default $50) is a daily house admission gate. All four spend knobs env-tunable. Backed by `SpendReservation` (reserve-then-settle per session), `GlobalSpend` (daily cap), `RateBucket` (sliding window). Metered on the server clock. Bypassing reservation lets a session exceed the cap.
- **Resume grounding**: `ResumeProfile.factsJson` holds only **anti-hallucination-validated** facts — `validateResumeFacts` (`packages/panel-core/src/resume.ts`) drops any fact whose verbatim quote isn't a substring of the resume text; the digest (`src/lib/interview/resume-digest.ts`) fails CLOSED on schema mismatch; only survivors reach interviewer instructions. PDF text via `unpdf` in `src/lib/resume.ts` (MAX 20k chars / 2MB).
- **Disfluency / fluency**: `DEEPGRAM_API_KEY` set ⇒ verbatim ASR (`src/lib/providers/deepgram.ts`, `filler_words:true`) measures fillers/repeats/false-starts into `InterviewTurn.disfluencyJson`; unset ⇒ Whisper fallback, which cleans speech so disfluency reads artificially low (`disfluencyJson` null).
- **Moat data**: `Outcome` (real hire/no-hire label, one per session) snapshots `predictedSignal`/`predictedWeakest`/`rubricVersion` **at capture time** (ADR-0012) — never recompute from the current rubric at read time.

Highest-stakes invariants: every interview query is **userId-scoped**; the **judge stays on the house key** (pinned model); BYOK keys are **never echoed back**; **`turn_detection` stays `null`** (push-to-talk); `InterviewTurn` is **single-writer seq-ordered**. Each has an owning test (`docs/testing.md` §6).

## Workspace packages

- `packages/panel-core` — **pure panel logic, no I/O** (Vitest aliases `@sevenlabs/panel-core` → source): `panel-composition.ts` (Bar-Raiser veto + verdict math: `finalizeVerdict`, `computeComposure`, `aggregateFluency`), `rubric-definitions.ts` (`RUBRIC_VERSION`, Amazon LP + React/JS rubrics), `disfluency.ts` (vendor-agnostic engine over a verbatim word stream), `speech-analysis.ts` (WPM/filler/pause over word timestamps), `question-bank.ts`, `panel-context.ts` (cross-seat digest), `seat-openers.ts`, `interviewer-guardrails.ts` (prompt-injection hardening), `resume.ts` (grounding validation), `realtime-cost.ts`, `redaction.ts` (`redact()` masks `sk-`/`sk-ant-`/`AIza`/`ek_`/`Bearer`).
- `packages/shared-types` — Zod contracts (no I/O): `interview-schemas.ts` (mint/turn/report/verdict/dimension/confidence/outcome + `SIGNAL_TO_SCORE`), `schemas.ts` (speech-metrics), `realtime-config.ts` (`REALTIME_INPUT_CONFIG`).

**Pure-logic boundary**: the two packages + `src/features/interview/lib/{panel-machine,realtime-events,turn-queue}` are pure (no I/O / no React) and unit-tested. ALL Prisma/OpenAI/fetch I/O lives in `src/lib`: `providers/{openai,deepgram}.ts` (vendor HTTP; `openai.ts` is raw `fetch`, not the SDK — `mintRealtimeEphemeral` is BYOK-or-house via `params.apiKey ?? env.OPENAI_API_KEY`, model `env.OPENAI_REALTIME_MODEL`; judge + resume-extraction models pinned in code), `interview/` (orchestrator, queue, spend, resume-digest), `auth.ts`, `byok.ts`, `crypto.ts`, `db.ts` (Prisma singleton via `PrismaPg` adapter), `env.ts`, `log.ts` (single stdout chokepoint — every provider secret flows through `redaction.ts` before any log line or Error), `resume.ts`, `signal.ts`, `brand.ts`, `motion.ts`, `utils.ts`. Don't mix I/O into the pure tier — it breaks the test boundary.

## Auth & routing

**Auth.js v5 (NextAuth beta)** with Prisma adapter + JWT session strategy (Credentials can't use DB sessions). Providers: Google OAuth (`allowDangerousEmailAccountLinking: true`) and Credentials (email/password, bcrypt via `src/app/api/auth/register/route.ts`). Config split: `src/auth.config.ts` is edge-safe; **`src/proxy.ts`** (Next 16's middleware file — there is no `middleware.ts`) enforces auth at the edge; `src/lib/auth.ts` adds the Prisma adapter + `Credentials.authorize`. Session shape extended with `user.id` via `src/types/next-auth.d.ts`.

Public routes: `/`, `/sign-in`, `/sign-up`, `/api/auth/*`, `/api/health`; everything else redirects to `/sign-in?callbackUrl=...`. **No organization concept** — every user-data query is **userId-scoped**, and all user-owned rows cascade-delete with the User.

## Data model

Prisma generator `provider = "prisma-client"` (not `prisma-client-js`), `output = "../src/generated/prisma"` (gitignored; regenerated on postinstall; the Dockerfile COPYs it into the runner stage manually — keep that COPY in sync if the path moves). **Import via the `prisma` singleton in `src/lib/db.ts`**; never `@prisma/client`. Prisma 7.5.x via `@prisma/adapter-pg`.

Models by domain — the DB layer speaks the code's language since ADR-0016 (`InterviewSession`/`InterviewTurn`/`InterviewStatus`; `TurnRole` = `USER | INTERVIEWER`):
- **Auth.js**: `User` (tenant root; passwordHash nullable for Google-only users; carries `targetCompanies String[]`, `interviewDate?`), `Account`, `Session`, `VerificationToken`.
- **Interview**: `Scenario`, `PanelSeat` (`@@unique([scenarioId, seatOrder])`), `InterviewSession` (central run — `@@unique([userId, clientRequestId])` idempotency; `keySource`/`provider`/`apiKeyId`→ProviderKey/`spendCents`/`reportJson`), `InterviewTurn` (`@@unique([sessionId, seq])`, `clientTurnId`, `disfluencyJson`, `transcriptionMissing`), `DimensionScore`, `PanelVerdict` (`sessionId @unique`, `barRaiserVeto`, `rubricVersion`+`judgeModel`), `ConfidenceMetric`, `DrillAssignment`, `JudgmentJob` (PK=sessionId; lease queue, index `(status, leaseUntil)`).
- **Moat / custody / infra**: `Outcome` (`sessionId @unique`), `ProviderKey` (`@@unique([userId, provider])`; AES-256-GCM `ciphertextB64`/`ivB64`/`tagB64` under the env KEK, `dekVersion`), `ResumeProfile` (`userId @unique`; validated `factsJson` + `sourceText`), `RateBucket` (PK `[key, windowStart]`), `GlobalSpend` (PK=day), `SpendReservation` (PK=sessionId; reserve-then-settle).

**One squashed init migration** under `prisma/migrations/` (lock `provider = postgresql`) — history was squashed and both DBs reset at zero users (ADR-0016). Pre-squash migrations live in git history only; any DB predating the squash must be reset, not migrated.

## Deployment

Prod is a **single AWS EC2 t3.micro** (Amazon Linux 2023, Elastic IP) running the app as a **Docker container behind Caddy** (auto-HTTPS), provisioned by Terraform in `terraform/` (default VPC, local state, us-east-1). Postgres is external (Prisma Postgres cloud); no S3. `deploy.yml` job graph: `gate → build (GHCR: ghcr.io/prince0906/sevenlabs :latest + :<sha>) → migrate → deploy` (approval-gated by the `production` GitHub Environment; SCPs `deploy/docker-compose.yml` + `deploy/Caddyfile`; box path `/opt/sevenlabs`; writes `.env` under `umask 077`; health-checks `/api/health`). **Migrations ARE applied automatically** (before the box rolls, so schema is current before new code serves). The GHCR image must be **Public** so the box can pull without auth. Secrets live only in GitHub Actions secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`+`AUTH_URL`, `KEY_ENCRYPTION_SECRET`, optional `DEEPGRAM_API_KEY`, Google OAuth, `EC2_HOST`/`EC2_SSH_KEY`, `SITE_ADDRESS`) — never commit them. Runbook: `docs/runbooks/deploy.md`.

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

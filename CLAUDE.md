# CLAUDE.md

Guidance for Claude Code (and `AGENTS.md`, which is a **symlink to this file** — editing one edits both) when working in the **Aloud** repo. Aloud is a Next.js monorepo with **two products**: the ACTIVE one is the real-time **interview panel** (3-seat Bar-Raiser over the OpenAI Realtime API, BYOK, resume-grounded, off-band judge); the PARKED one is the legacy synchronous **speaking coach**.

## Commands

```bash
# Web (Next.js 16 / React 19) — runs at :3000
npm run dev
npm run build                       # SKIP_ENV_VALIDATION=true set in the Dockerfile build, not locally
npm run start

# Database (Prisma 7, generator provider "prisma-client", client output: src/generated/prisma)
npm run db:push                     # dev only — pushes schema WITHOUT a migration (this is what caused moat-table drift; avoid for shared schema changes)
npx prisma migrate deploy           # applies prisma/migrations/* — run in CI (Phase 2) and prod; use this, not db:push, for shared schema changes
npm run prisma:seed                 # tsx prisma/seed.ts

# Tests (Vitest)
npm test                            # one-shot (vitest run)
npm run test:watch
npm run test:ci                     # junit → test-reports/junit.xml (SKIP_ENV_VALIDATION=true)
npm run test:coverage
npx vitest run src/__tests__/unit/practice-session.test.ts   # single file
npx vitest run -t "name of test"                              # by name

npm run lint                        # eslint
```

`postinstall` runs `prisma generate && npm run copy:vad`. `copy:vad` copies from **three** sources into `public/vad/`: `@ricky0123/vad-web/dist/.`, `onnxruntime-web/dist/*.mjs`, and `onnxruntime-web/dist/*.wasm` — all must exist for the app to boot.

**DB is Prisma Postgres CLOUD** (`.env` `DATABASE_URL` → `db.prisma.io:5432`; `.env.example` still shows a localhost placeholder). No local Postgres by default. **Migration tooling lives in `prisma.config.ts`** (Prisma 7), not in the schema datasource: `migrations.path = prisma/migrations`, `datasource.url = DATABASE_URL`, `datasource.shadowDatabaseUrl = SHADOW_DATABASE_URL`. The shadow DB is used **only** by `prisma migrate dev`/`migrate diff` (drift computation); unset at runtime/prod, set in CI + local migration work. There is no `db:migrate` script.

`SKIP_ENV_VALIDATION=true` bypasses the Zod-validated env in `src/lib/env.ts`. CI sets it; the Dockerfile sets it for `next build`. Tests under `src/__tests__/integration/build.test.ts` import `@/lib/env` and fail locally without it or a complete `.env`.

**CI gates** — two workflows, both on push-to-main + PR:
- `.github/workflows/ci.yml` ("CI gates"), three independent jobs: **typecheck** (`tsc --noEmit`), **clean build** (`npm ci && next build` from a fresh clone — catches HEAD importing untracked files), **schema-drift** (`prisma migrate diff --from-migrations --to-schema --exit-code` against a throwaway `postgres:16` — fails if `schema.prisma` drifted from committed migrations).
- `.github/workflows/deploy.yml` ("CI/CD Pipeline"): see Deployment.

## Architecture

**Monorepo via npm workspaces** (`packages/*`). Next.js app at repo root (`src/`). Single-process at :3000 — interview panel, coach, and dashboard share one web container. The two products share a pure-logic core and provider clients but **must not be merged** (different transports). Full system design: `ENGINEERING.md` (plain-English: `ENGINEERING_EXPLAINED.md`).

### Interview panel (Bar-Raiser, real-time) — the ACTIVE product

A live 3-interviewer voice session over the **OpenAI Realtime API (WebRTC)**. The **server is never in the audio path** — the browser connects directly to OpenAI via a short-TTL ephemeral the server mints. BFF routes under `src/app/api/mock/sessions/*`: `route.ts` (create+list), `[id]`, `[id]/mint`, `[id]/turns`, `[id]/turns/audio` (best-effort verbatim fluency-audio upload), `[id]/complete`, `[id]/report`, `[id]/outcome` (moat capture). Plus `/api/keys` (BYOK CRUD), `/api/resume` (upload+extract), `/api/user/interview-date`.

- **Client engine** (`src/features/mock-panel/`): pure reducer FSM `lib/panel-machine.ts` (no I/O, unit-tested) drives the conversation; `hooks/use-mock-panel.ts` performs side effects (mint/connect/post/timers) on phase transitions. Transport split: `lib/realtime-connection.ts` (WebRTC around one ephemeral/one seat; SDP offer POSTed with `Content-Type: application/sdp`) calls the **pure** `lib/realtime-events.ts` (`mapRealtimeEvent` — the single place untrusted OpenAI data-channel JSON becomes typed app state; malformed/unknown → `null`, never throws). `lib/turn-queue.ts` is the single-writer seq commit queue.
- **Realtime input config**: `REALTIME_INPUT_CONFIG` in `packages/shared-types/src/realtime-config.ts` is the **single source of truth** for the input session (`transcription: {model:'gpt-4o-transcribe', language:'en'}`, `turn_detection: null` = push-to-talk, half-duplex). Imported by BOTH the server mint (`src/lib/coach/openai.ts`) and the client patch (`realtime-connection.ts`). Divergence silently breaks PTT transcription.
- **Turns**: `MockTurn` is single-writer, `seq`-ordered (`@@unique([sessionId, seq])`, seq assigned at dequeue), posted through the queue. `role` reuses `PracticeTurnRole`; `role=COACH` means an interviewer seat. The judge scores by `orderBy seq asc` — dropping/duplicating a COACH turn corrupts the verdict.
- **Judgment**: a lease-based durable worker queue (`src/lib/mock/judgment-queue.ts`, leases `JudgmentJob` rows by `(status, leaseUntil)`) dispatches `runJudgment` in `src/lib/mock/panel-orchestrator.ts`, which assembles the seq-ordered transcript and calls `judgeCommittee()` (`src/lib/coach/openai.ts:288`). Results land in `PanelVerdict` / `DimensionScore` / `ConfidenceMetric`. **The judge ALWAYS runs on the house key** (`env.OPENAI_API_KEY`) with **PINNED `gpt-4o-mini`** (never config-driven). Removing a BYOK key loses live voice, never the report.
- **BYOK custody**: users may paste their own OpenAI key. `src/lib/byok.ts` (`resolveSessionKey`/`validateKeyViaMint`) + `src/lib/crypto.ts` (AES-256-GCM under `KEY_ENCRYPTION_SECRET`). The raw key transits the server **exactly once** (`POST /api/keys`) and is decrypted only inside the mint frame. **No read-back endpoint**; only `last4`/`fingerprint` are display-safe; revoke = hard delete. `ProviderKey` is `@@unique([userId, provider])`. When `KEY_ENCRYPTION_SECRET` is unset, `/api/keys` returns **503** ("BYOK is not configured on this server") and everything runs on the house key.
- **Spend safety** (`src/lib/mock/spend.ts`): house sessions bounded by `SESSION_CEILING_USD` (default $4 ≈ 13min @ $0.30/min); USER/BYOK sessions bounded by time only (`MAX_SESSION_SEC`, default 3600s); `DAILY_CAP_USD` (default $50) is a daily house admission gate. All four spend knobs (incl. `REALTIME_USD_PER_MIN`) are env-tunable. Backed by `SpendReservation` (reserve-then-settle per session), `GlobalSpend` (daily cap), `RateBucket` (sliding window). Bypassing reservation lets a session exceed the cap.
- **Resume grounding**: `ResumeProfile.factsJson` holds only **anti-hallucination-validated** facts — `validateResumeFacts` (`packages/coach-core/src/resume.ts`) drops any fact whose verbatim quote isn't a substring of the resume text; only survivors reach interviewer instructions (`src/lib/mock/resume-digest.ts`). PDF text via `unpdf` in `src/lib/resume.ts` (MAX 20k chars / 2MB).
- **Disfluency / fluency**: `DEEPGRAM_API_KEY` (optional) toggles verbatim ASR — set ⇒ Deepgram (`filler_words:true`, `src/lib/coach/deepgram.ts`) measures fillers/repeats/false-starts into `MockTurn.disfluencyJson`; unset ⇒ Whisper fallback, which cleans speech so disfluency reads artificially low (`disfluencyJson` null).
- **Moat data**: `Outcome` (real hire/no-hire label, one per session) snapshots `predictedSignal`/`predictedWeakest`/`rubricVersion` **at capture time** so the (prediction → outcome) calibration pair survives rubric/model churn — don't recompute from current rubric at read time.

Highest-stakes invariants: every mock query is **userId-scoped**; the **judge stays on the house key** (pinned `gpt-4o-mini`); BYOK keys are **never echoed back**; **`turn_detection` stays `null`** (push-to-talk); `MockTurn` is **single-writer seq-ordered**.

### Speaking coach — PARKED (legacy, kept not invested)

Synchronous delivery coach. BFF routes under `src/app/api/coach/*` call `src/lib/coach/turn-orchestrator.ts`, which runs the full pipeline in-process: Whisper → speech analysis (`packages/coach-core/speech-analysis.ts`) → GPT reply → TTS → S3 → Prisma. Frontend uses `@ricky0123/vad-web` (Silero VAD) for browser-side speech start/end, handing a WAV blob to `usePracticeSession`. No separate coach service.

## Workspace packages

- `packages/coach-core` — **pure logic, no I/O** (Vitest aliases `@sevenlabs/coach-core` → source). **Naming caveat**: despite the name, most of its 13 source files (one is the `index.ts` barrel) are interview-PANEL logic, not coach logic. `speech-analysis.ts` (coach: WPM/filler/pause), `coach-prompt.ts` (legacy coach prompts), `disfluency.ts` (vendor-agnostic disfluency engine over a verbatim word stream), `rubric-definitions.ts` (Amazon LP + React/JS rubrics, ~21KB), `question-bank.ts` (STAR drill pools), `panel-composition.ts` (Bar-Raiser veto + verdict math: `finalizeVerdict`, `computeComposure`, `aggregateFluency`), `panel-context.ts` (`buildPanelContextDigest` cross-seat digest), `seat-openers.ts` (deterministic question variety), `interviewer-guardrails.ts` (prompt-injection hardening + turn-control), `resume.ts` (grounding), `realtime-cost.ts` (display-only BYOK spend estimate), `redaction.ts` (`redact()` masks `sk-`/`sk-ant-`/`AIza`/`ek_`/`Bearer` to non-reversible fingerprints).
- `packages/shared-types` — Zod contracts (no I/O): `schemas.ts` (coach contracts), `mock-schemas.ts` (panel: mint/turn/report/verdict/dimension/confidence + `interviewOutcomeSchema`, `SIGNAL_TO_SCORE`), `realtime-config.ts` (`REALTIME_INPUT_CONFIG`).

`src/lib/coach/openai.ts` is the **shared provider client** for both products (raw `fetch` against `api.openai.com/v1`, not the SDK): `transcribeAudio` (whisper-1), `generateCoachText`/`scoreAgainstRubric` (gpt-4o-mini), `extractResumeJson` (PINNED gpt-4o-mini), `synthesizeCoachSpeech` (tts-1/nova), `mintRealtimeEphemeral` (BYOK-or-house: `params.apiKey ?? env.OPENAI_API_KEY`, model `env.OPENAI_REALTIME_MODEL`, default `gpt-realtime`), `judgeCommittee` (house key, pinned). Other `src/lib` modules: `byok.ts`, `crypto.ts`, `resume.ts`, `log.ts` (single stdout chokepoint — every line is redacted JSON; all provider secrets MUST flow through `redaction.ts` before any log line or Error), `mock/` (orchestrator, queue, spend, resume-digest), `s3.ts`, `signal.ts`, `brand.ts`, `db.ts` (Prisma via `PrismaPg` adapter), `env.ts`.

**Pure-logic boundary**: `packages/coach-core` + `packages/shared-types` and `src/features/mock-panel/lib/{panel-machine,realtime-events,turn-queue}` are pure (no I/O / no React) and unit-tested. All Prisma/S3/OpenAI/fetch I/O lives in `src/lib`. Don't mix I/O into the pure packages — it breaks the test boundary.

## Auth & routing

**Auth.js v5 (NextAuth beta)** with Prisma adapter + JWT session strategy (Credentials can't use DB sessions). Providers: Google OAuth (`allowDangerousEmailAccountLinking: true`) and Credentials (email/password, bcrypt via `src/app/api/auth/register/route.ts`). Config split: `src/auth.config.ts` is edge-safe (used by `src/middleware.ts`); `src/lib/auth.ts` adds the Prisma adapter + `Credentials.authorize`. Session shape extended with `user.id` via `src/types/next-auth.d.ts`.

`src/middleware.ts` enforces auth: public routes are `/sign-in`, `/sign-up`, `/api/auth/*`, `/api/health`; everything else redirects to `/sign-in?callbackUrl=...`. **No organization concept** — every DB query touching user data is **userId-scoped**, and all user-owned rows cascade-delete with the User.

## Data model

Prisma generator `provider = "prisma-client"` (new generator, not `prisma-client-js`), `output = "../src/generated/prisma"`, datasource `postgresql`. **Import the Prisma client via the `prisma` singleton in `src/lib/db.ts`** (the generated client itself lives at `@/generated/prisma/client`); never import `@prisma/client`. Prisma 7.5.x via `@prisma/adapter-pg`. The Dockerfile copies the generated client (`src/generated/prisma`) manually to the runner stage — keep that COPY in sync if the output path moves.

**6 migrations** under `prisma/migrations/` (lock `provider = postgresql`); the latest, `20260612151833_byok_resume_outcome_catchup` (2026-06-12), adds the BYOK/resume/Outcome tables + their enums — those models ARE migrated.

Models by domain:
- **Auth.js**: `User` (passwordHash nullable for Google-only users; also carries interview-prep fields `targetCompanies String[]`, `interviewDate?`, `targetLevel SignalLevel`), `Account`, `Session`, `VerificationToken`.
- **Speaking coach (parked)**: `PracticeSession` (userId-scoped), `PracticeTurn` (`@@unique([sessionId, clientTurnId])`).
- **Interview panel (active)**: `Scenario`, `PanelSeat` (`@@unique([scenarioId, seatOrder])`), `MockSession` (central run — `@@unique([userId, clientRequestId])` idempotency; `keySource`/`provider`/`apiKeyId`→ProviderKey/`spendCents`/`reportJson`; `MockStatus`), `MockTurn` (`@@unique([sessionId, seq])`, `clientTurnId`, `disfluencyJson`, `transcriptionMissing`), `DimensionScore`, `PanelVerdict` (`sessionId @unique`, `barRaiserVeto`), `ConfidenceMetric`, `DrillAssignment` (`@@unique([userId, questionId, sourceSessionId])`), `JudgmentJob` (PK=sessionId; lease queue, index `(status, leaseUntil)`).
- **Moat / custody / infra**: `Outcome` (`sessionId @unique`; the one label a foundation model can't manufacture), `ProviderKey` (`@@unique([userId, provider])`; AES-256-GCM `ciphertextB64`/`ivB64`/`tagB64` under env KEK, `dekVersion`), `ResumeProfile` (`userId @unique`; validated `factsJson` + `sourceText`), `RateBucket` (PK `[key, windowStart]`), `GlobalSpend` (PK=day), `SpendReservation` (PK=sessionId; reserve-then-settle).

**13 enums**: `PracticeSessionStatus`, `PracticeTurnRole`, `SignalLevel` (NEW_GRAD/SDE_II/SENIOR), `LlmProvider` (OPENAI/ANTHROPIC/GEMINI), `InterviewType`, `ScenarioDifficulty` (WARMUP/CALIBRATED/ADVERSARIAL), `MockStatus` (PENDING/LIVE/DEBRIEF/COMPLETED/ABANDONED/FAILED/INTERRUPTED), `ScoreDimension` (LP/STAR_STRUCTURE/TECHNICAL_DEPTH/COMMUNICATION/DELIVERY), `DrillStatus`, `JobStatus`, `InterviewOutcome` (ADVANCED/REJECTED/GHOSTED/OFFER/PENDING), `KeySource` (ALOUD/USER), `KeyStatus` (ACTIVE/INVALID/EXHAUSTED/REVOKED).

## Deployment

Prod is a **single AWS Free-Tier EC2 box** (t3.micro, Amazon Linux 2023, Elastic IP) running the app as a **Docker container behind Caddy** (auto-HTTPS). **Not ECS/Fargate, not an ALB** (the ECS→EC2 rewrite is committed). Provisioned by Terraform in `terraform/` (default VPC + public subnets, local state, us-east-1; `terraform output` gives `app_public_ip`/`ssh_command`). Postgres is external (Prisma Postgres cloud); no S3 — the interview panel stores no audio (S3 was coach-only and removed from terraform).

`.github/workflows/deploy.yml` runs in phases on push-to-main: Phase 1 lint + test → **Phase 2 migrate** (`needs: [lint, test]`) runs `npx prisma migrate deploy` then `migrate status` against `secrets.DATABASE_URL` → **Phase 3 deploy** (`needs: migrate`) builds the image, pushes to **GHCR** (`ghcr.io/<repo>:latest` + `:<sha>`), SCPs `deploy/docker-compose.yml` + `deploy/Caddyfile` to the box, SSHes in (`ec2-user`, `/opt/sevenlabs`) to write `.env`, `docker compose pull`, `docker compose up -d`. **Migrations ARE applied automatically** (Phase 2, before Phase 3 — so the DB schema is current before new code serves). The GHCR image must be **Public** so the box can `docker compose pull` without auth. Secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`, OAuth + AWS creds) live only in GitHub Actions secrets and are written to `/opt/sevenlabs/.env` at deploy time — never commit them. Operating doc: `DEPLOY.md`.

## Conventions

`.cursor/rules/karpathy-behavioral-guidelines.mdc` is `alwaysApply: true`:
- **Surgical changes.** Don't refactor adjacent code, reformat, or "improve" what the task didn't ask for. Match existing style.
- **No speculative abstractions.** No config knobs, no error handling for impossible cases, no generalizing single-use code.
- **Surface uncertainty before coding.** If a task has multiple reasonable readings (e.g. "fix the orchestrator" — coach or panel?), ask.
- **Goal-driven.** State the verification step (usually a specific `vitest` invocation) before implementing.

Canonical docs: `ENGINEERING.md` / `ENGINEERING_EXPLAINED.md` (current system design), `INTERVIEW_ENGINE_PLAN.md` (binding decisions), `AUDIT_FINDINGS.md` (audit evidence). Earlier planning memos (ROADMAP, CONFIDENCE_*, DEFENSIBILITY_PLAN) were removed as superseded — recover from git history if needed.

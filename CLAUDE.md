# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Web (Next.js) — runs at :3000
npm run dev
npm run build                       # SKIP_ENV_VALIDATION=true is set inside the Dockerfile build, not locally
npm run start

# Database (Prisma 7, client output: src/generated/prisma)
npm run db:push                     # dev only — pushes schema without migration
npx prisma migrate deploy           # production — applies prisma/migrations/*
npm run prisma:seed

# Tests (Vitest)
npm test                            # one-shot
npm run test:watch
npm run test:ci                     # junit reporter → test-reports/junit.xml
npm run test:coverage
npx vitest run src/__tests__/unit/practice-session.test.ts   # single file
npx vitest run -t "name of test"                              # by name

npm run lint
```

Postinstall runs `prisma generate` and copies Silero VAD assets from `node_modules/@ricky0123/vad-web/dist/` into `public/vad/` — both must exist for the app to boot. If VAD assets are missing, run `npm run copy:vad`.

`SKIP_ENV_VALIDATION=true` bypasses the Zod-validated env in `src/lib/env.ts`. CI sets it for `test:ci`; the Dockerfile sets it for `next build`. Some tests under `src/__tests__/integration/build.test.ts` import `@/lib/env` and will fail locally without it or a complete `.env`.

## Architecture

**Monorepo via npm workspaces** (`packages/*`). Next.js app at repo root (`src/`). Single-process: speaking coach and dashboard run inside the web container.

### Speaking coach

BFF routes under `src/app/api/coach/*` call `src/lib/coach/turn-orchestrator.ts` directly. The orchestrator runs the full pipeline inside the web process: Whisper → speech analysis (`packages/coach-core`) → GPT coach reply → TTS → S3 upload → Prisma row write. There is no separate coach service.

`src/lib/coach/openai.ts` wraps three OpenAI API calls: `transcribeAudio` (Whisper `whisper-1`, word-level timestamps), `generateCoachText` (GPT `gpt-4o-mini`, 2-sentence delivery feedback), and `synthesizeCoachSpeech` (TTS `tts-1`, `nova` voice). All use raw `fetch` against `api.openai.com/v1`, not the OpenAI SDK.

The frontend uses `@ricky0123/vad-web` (Silero VAD) for browser-side voice activity detection — it auto-detects speech start/end and hands a WAV blob to `usePracticeSession`. VAD WASM/ONNX assets must exist in `public/vad/` (copied by postinstall).

Pure analysis/prompt code lives in `packages/coach-core` (`speech-analysis.ts`, `coach-prompt.ts`) — no I/O, easy to test in isolation. The full pipeline (with Prisma/S3/OpenAI deps) stays in `src/lib/coach/`.

### Workspace packages

- `packages/coach-core` — pure logic: `speech-analysis.ts` (WPM, filler ratio, pause stats from Whisper word timings) and `coach-prompt.ts` (GPT system prompt for delivery feedback). No I/O.
- `packages/shared-types` — Zod schemas (`createSessionRequestSchema`, `turnCompleteResponseSchema`, etc.) used by the BFF.

Vitest aliases (`vitest.config.ts`) resolve `@sevenlabs/coach-core` and `@sevenlabs/shared-types` to source paths so package tests run from the root.

### Auth & routing

**Auth.js v5 (NextAuth beta)** with Prisma adapter + JWT session strategy (Credentials provider can't use database sessions). Providers: Google OAuth (`allowDangerousEmailAccountLinking: true` — Google verifies email) and Credentials (email/password, bcrypt-hashed via `src/app/api/auth/register/route.ts`). Config is split: `src/auth.config.ts` is edge-safe (used by `src/middleware.ts`), `src/lib/auth.ts` adds the Prisma adapter + Credentials.authorize. Session shape extended with `user.id` via `src/types/next-auth.d.ts`.

`src/middleware.ts` enforces auth: public routes are `/sign-in`, `/sign-up`, `/api/auth/*`, `/api/health`; everything else redirects to `/sign-in?callbackUrl=...`. There is no organization concept — every DB query that touches user data is **userId-scoped**.

Custom sign-in/up forms live in `src/features/auth/components/`; they call `signIn("credentials", {...})` / `signIn("google", {...})` from `next-auth/react`. The dashboard user menu (avatar + sign out) is in `dashboard-sidebar.tsx`.

### Data model

Prisma `provider = "prisma-client"` (new generator, not `prisma-client-js`) with `output = "../src/generated/prisma"`. Import the client from `@/generated/prisma` (or `src/lib/db.ts`), not `@prisma/client`. Models: Auth.js (`User`, `Account`, `Session`, `VerificationToken`), `PracticeSession`, `PracticeTurn` (speaking coach). `User.passwordHash` is nullable — Google-only users have no password. `PracticeTurn` has `@@unique([sessionId, clientTurnId])` for idempotent turn submission. `PracticeSession.userId` is required.

The Dockerfile copies the generated Prisma client manually to the runner stage (`src/generated/prisma`) because Next.js standalone output doesn't pick up arbitrary generated directories — keep that COPY in sync if the output path moves.

### Deployment

AWS ECS Fargate behind an ALB, provisioned by Terraform in `terraform/`. One target group: web on port 3000 (`/api/health`). GitHub Actions (`.github/workflows/deploy.yml`) runs lint → test → terraform → docker build/push → ECS update. Prisma migrations are not run automatically — operators must invoke `npx prisma migrate deploy` manually against the prod DB.

## Conventions

`.cursor/rules/karpathy-behavioral-guidelines.mdc` is `alwaysApply: true` and applies here too. The points that bite most often in this repo:

- **Surgical changes.** Don't refactor adjacent code, reformat, or "improve" things the task didn't ask for. Match existing style.
- **No speculative abstractions or flexibility.** Don't add config knobs, error handling for impossible cases, or generalize single-use code.
- **Surface uncertainty before coding.** If the task has multiple reasonable interpretations (e.g., "fix the orchestrator" — which copy?), ask rather than picking silently.
- **Goal-driven.** State the verification step before implementing — usually a specific vitest invocation or a manual practice-turn run.

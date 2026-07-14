# Aloud

[![CI](https://github.com/Prince0906/sevenlabs/actions/workflows/ci.yml/badge.svg)](https://github.com/Prince0906/sevenlabs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Interview prep, out loud.** Voice-first FAANG behavioral interview practice that scores your answers against the company's real rubric and tells you whether you read as **New Grad, SDE II, or Senior** — built to grow your confidence speaking under pressure.

Two surfaces:
- **Speaking Coach** — turn-based: record an answer → transcript → delivery + rubric feedback (spoken back).
- **Bar-Raiser Panel** — real-time: three AI interviewers in a live voice loop, then a committee verdict.

**Source of truth:** product/feature plan is [`INTERVIEW_ENGINE_PLAN.md`](INTERVIEW_ENGINE_PLAN.md); system design + long-run maintenance is [`ENGINEERING.md`](ENGINEERING.md); UI/UX rules are in [`DESIGN_PRINCIPLES.md`](DESIGN_PRINCIPLES.md). The active product is the **Bar-Raiser Panel**; the **Speaking Coach** is a parked surface (kept, not currently invested in). Working notes are in [`CLAUDE.md`](CLAUDE.md).

## Prerequisites

- **Node.js 22+** (active LTS) and npm
- A **PostgreSQL** database
- An **OpenAI API key** — with Realtime access (and a GA realtime model) for the panel
- **Google OAuth** credentials (for Google sign-in; email/password sign-up also works)

## Quick start

```bash
# 1. Install — postinstall runs `prisma generate` and copies the Silero VAD
#    assets into public/vad/ (both are required for the app to boot).
npm install

# 2. Configure your environment
cp .env.example .env        # then fill in the values (see Environment below)

# 3. Set up the database and seed the panel
npm run db:push             # dev: pushes the schema without a migration
npm run prisma:seed         # seeds the Amazon Bar-Raiser scenario + 3 interviewer seats

# 4. Start the dev server
npm run dev                 # → http://localhost:3000
```

> **Just want to see the UI?** Boot without real secrets using `SKIP_ENV_VALIDATION=true npm run dev` — this bypasses the Zod env check in `src/lib/env.ts`. The Speaking Coach and Bar-Raiser Panel still need a real `OPENAI_API_KEY` to actually run.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on `:3000` |
| `npm run build` · `npm run start` | production build · serve |
| `npm run db:push` | push the Prisma schema (dev, no migration) |
| `npx prisma migrate deploy` | apply migrations (production) |
| `npm run prisma:seed` | seed the scenario + interviewer seats |
| `npm test` · `npm run test:watch` | run Vitest once · in watch mode |
| `npm run test:coverage` | tests with the coverage gate |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| **`npm run verify`** | **the full CI gate locally** (lint → typecheck → tests+coverage → build) — run before every push |
| `npm run copy:vad` | re-copy the VAD assets to `public/vad/` |

## Environment

Validated by `src/lib/env.ts`. Copy `.env.example` → `.env` and fill in:

**Required**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `OPENAI_API_KEY` | Whisper / GPT / TTS + Realtime |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | Google OAuth |

**Optional (sensible defaults)**

| Variable | Default |
|---|---|
| `OPENAI_REALTIME_MODEL` | `gpt-realtime` *(use a GA id, not a `*-preview` one)* |
| `OPENAI_REALTIME_MINT_URL` | `…/v1/realtime/client_secrets` |
| `OPENAI_REALTIME_URL` | `…/v1/realtime/calls` |
| `SESSION_CEILING_USD` · `MAX_SESSION_SEC` · `DAILY_CAP_USD` · `REALTIME_USD_PER_MIN` | `4` · `3600` · `50` · `0.3` |

## Project layout

```
src/                   Next.js app (App Router), API routes, features, lib
packages/coach-core    pure analysis/prompt logic (no I/O, unit-tested)
packages/shared-types  Zod schemas shared by the API layer
prisma/                schema + seed
terraform/             single-EC2 deploy infrastructure
```

## Deployment

Single AWS EC2 instance running the app as a Docker container behind Caddy (auto-HTTPS). See [`DEPLOY.md`](DEPLOY.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

# Aloud

[![CI](https://github.com/Prince0906/sevenlabs/actions/workflows/ci.yml/badge.svg)](https://github.com/Prince0906/sevenlabs/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Interview prep, out loud.** A real-time **3-seat AI interview panel**
("Bar-Raiser"): three interviewers in a live voice loop over the OpenAI
Realtime API, grounded in your resume, followed by a committee verdict that
tells you whether you read as **New Grad, SDE II, or Senior** — and exactly
what to drill next. Bring your own OpenAI key for long sessions, or run short
ones on the house.

*Aloud is the product; `sevenlabs` (the repo/org name) is the builder — Seven
Labs.*

## Docs

| Doc | What it covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | current system design: flows, boundaries, data model, invariants |
| [`docs/decisions/`](docs/decisions/) | ADRs — why the load-bearing choices are what they are |
| [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md) | CI/CD pipeline + provisioning + operating the prod box |
| [`docs/testing.md`](docs/testing.md) | the testing contract: layers, mocking policy, coverage ratchet |
| [`docs/design.md`](docs/design.md) | UI/UX rules (Chalk & Cobalt) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`SECURITY.md`](SECURITY.md) | contributing & disclosure |
| [`CLAUDE.md`](CLAUDE.md) | working guide for coding agents (= `AGENTS.md`) |

## Prerequisites

- **Node.js 22+** (active LTS) and npm
- A **PostgreSQL** database
- An **OpenAI API key** — with Realtime access (GA realtime model)
- **Google OAuth** credentials (email/password sign-up also works)
- *(Optional)* A **Deepgram** key — verbatim ASR so filler-word/disfluency
  metrics are real; without it the fluency read falls back to Whisper

## Quick start

```bash
# 1. Install — postinstall runs `prisma generate` and copies the Silero VAD
#    assets into public/vad/ (both are required for the app to boot).
npm install

# 2. Configure your environment
cp .env.example .env        # then fill in the values (see Environment below)

# 3. Set up the database and seed the panel
npm run db:push             # dev: pushes the schema without a migration
npm run prisma:seed         # seeds the scenario + 3 interviewer seats

# 4. Start the dev server
npm run dev                 # → http://localhost:3000  (the panel lives at /interview)
```

> **Just want to see the UI?** Boot without real secrets using
> `SKIP_ENV_VALIDATION=true npm run dev` — this bypasses the Zod env check in
> `src/lib/env.ts`. The live panel still needs a real `OPENAI_API_KEY` to run.

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
| `OPENAI_API_KEY` | house key: Realtime mint fallback, pinned judge, Whisper fallback, resume extraction |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | Google OAuth |

**Optional**

| Variable | Notes |
|---|---|
| `KEY_ENCRYPTION_SECRET` | BYOK master key (≥ 32 chars, `openssl rand -base64 48`). **Unset ⇒ `/api/keys` returns 503** and everything runs on the house key |
| `DEEPGRAM_API_KEY` | verbatim ASR for disfluency metrics; unset ⇒ Whisper fallback (fillers read artificially low) |
| `OPENAI_REALTIME_MODEL` | default `gpt-realtime` *(use a GA id, not `*-preview`)* |
| `OPENAI_REALTIME_MINT_URL` · `OPENAI_REALTIME_URL` | default GA endpoints |
| `SESSION_CEILING_USD` · `MAX_SESSION_SEC` · `DAILY_CAP_USD` · `REALTIME_USD_PER_MIN` | spend caps: `4` · `3600` · `50` · `0.3` |
| `SHADOW_DATABASE_URL` | **migrate-only** (`prisma migrate dev`/`diff`); never set at runtime |

## Project layout

```
src/app/               routes only: pages, layouts, /api/interview BFF
src/features/          feature slices (interview, dashboard, auth, marketing, settings)
src/lib/               the I/O tier: db, auth, env, byok, crypto, log,
                       interview/ (judgment, spend), providers/ (openai, deepgram)
packages/panel-core    pure panel logic — rubrics, verdict math, disfluency (no I/O)
packages/shared-types  Zod contracts shared by server + client (no I/O)
prisma/                schema + migrations + seed
docs/                  architecture, ADRs, runbooks, testing, design
terraform/ deploy/     single-EC2 infrastructure + box runtime files
```

## Deployment

Push to `main` → CI gates → build → migrate → approval-gated roll of a single
EC2 box behind Caddy. Everything: [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security reports: [`SECURITY.md`](SECURITY.md).

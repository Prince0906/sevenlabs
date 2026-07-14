# Architecture

Current-state system design for **Aloud** — one product: a real-time 3-seat AI
interview panel ("Bar-Raiser") over the OpenAI Realtime API. This document
describes **what is built**, not plans; the reasoning behind load-bearing
choices lives in [`docs/decisions/`](decisions/). Agent-facing working notes:
[`CLAUDE.md`](../CLAUDE.md).

## 1. System overview

```
Browser ──────────── WebRTC (audio + data channel) ──────────── OpenAI Realtime
   │                                                                  ▲
   │  HTTPS (BFF: create / mint / turns / complete / report)          │
   ▼                                                                  │
Next.js 16 (one container, :3000) ── mint ephemeral (BYOK or house) ──┘
   │            │
   │            └── judgment worker (lease queue, started by instrumentation.ts)
   ▼                     └── OpenAI Chat (house key, pinned judge model)
Prisma Postgres (cloud)                          Deepgram (optional verbatim ASR)
```

- **The server is never in the audio path** ([ADR-0004](decisions/0004-server-never-in-audio-path.md)).
  The browser connects directly to OpenAI with a short-TTL ephemeral the server
  mints. Voice quality and per-minute COGS never touch the box.
- **One process** serves marketing, dashboard, the live interview room, and the
  BFF API. Prod is a single EC2 t3.micro behind Caddy
  ([runbook](runbooks/deploy.md)).
- **Judgment is off-band**: completing a session enqueues a `JudgmentJob`; a
  lease-based worker (`src/lib/interview/judgment-queue.ts`) assembles the
  seq-ordered transcript and calls the committee judge on the **house key with a
  code-pinned model** ([ADR-0002](decisions/0002-judge-on-house-key-pinned-model.md)).

## 2. Repository map

```
src/app/                    routes only — thin pages/layouts + BFF route handlers
  (dashboard)/              authed shell: dashboard, interview, interview/[id], settings
  api/interview/sessions/*  create, [id], mint, turns, turns/audio, complete, outcome, report
  api/{keys,resume,user,health,auth}
src/features/<feature>/     feature slices: interview, dashboard, auth, marketing, settings
  views/                    the ONLY entry route files may import
  components/ hooks/ lib/   feature-internal
src/lib/                    cross-cutting infra + server domain logic (the only I/O tier)
  interview/                judgment-queue, panel-orchestrator, spend, resume-digest
  providers/                vendor clients: openai.ts, deepgram.ts
  auth.ts db.ts env.ts byok.ts crypto.ts log.ts resume.ts …
packages/panel-core         pure panel logic (rubrics, verdict math, disfluency…) — no I/O
packages/shared-types       Zod contracts (interview-schemas, realtime-config) — no I/O
prisma/                     schema + 9 migrations + seed
docs/                       this file, decisions/ (ADRs), runbooks/, testing.md, design.md
```

## 3. Dependency rules (all currently hold — keep them holding)

1. **Pure tier**: `packages/*` and `src/features/interview/lib/{panel-machine,realtime-events,turn-queue}`
   contain no I/O and no React. Unit-tested directly.
2. **I/O lives only in `src/lib`** (Prisma, OpenAI/Deepgram HTTP, crypto, log).
3. **`src/lib` never imports from `src/features` or `src/components`.**
4. Packages never import from `src/`; `panel-core → shared-types` is the only
   package→package edge.
5. Prisma is imported via the `prisma` singleton in `src/lib/db.ts`
   (generated client at `src/generated/prisma`; never `@prisma/client`).
6. **Feature shape**: a route file (page/layout) enters a feature only through
   its `views/`; `components/`, `hooks/`, `lib/` are internal. Sibling imports
   are relative; cross-boundary imports use `@/`. No barrels.

## 4. The interview engine (client)

`src/features/interview/`:

- `lib/panel-machine.ts` — pure reducer FSM (13 phases) driving the session;
  no I/O, unit-tested.
- `hooks/use-interview.ts` — performs the side effects (mint/connect/post/
  timers) on phase transitions; the orchestration sink.
- `lib/realtime-connection.ts` — WebRTC shell around one ephemeral/one seat;
  SDP offer POSTed as `application/sdp`.
- `lib/realtime-events.ts` — pure `mapRealtimeEvent`: the single place
  untrusted OpenAI data-channel JSON becomes typed app state; malformed/unknown
  → `null`, never throws.
- `lib/turn-queue.ts` — single-writer seq commit queue; a dropped/duplicated
  interviewer turn corrupts the verdict.
- `lib/api-client.ts` — typed fetch wrappers for the `/api/interview` BFF (the
  single URL chokepoint).

Input session config (`turn_detection: null` push-to-talk, verbatim-leaning
transcription) is the shared `REALTIME_INPUT_CONFIG` const in
`packages/shared-types/src/realtime-config.ts`, imported by **both** the server
mint and the client patch ([ADR-0011](decisions/0011-push-to-talk-shared-input-config.md)).

## 5. Key flows (server)

- **Create → mint → turns → complete → report**: create is idempotent
  (`@@unique([userId, clientRequestId])`); mint resolves BYOK-or-house via
  `resolveSessionKey` (fail-closed to house); turns commit `seq`-ordered;
  complete enqueues judgment; report polls until the verdict lands.
- **BYOK custody** ([ADR-0001](decisions/0001-byok-key-custody.md)): raw key
  transits the server exactly once (`POST /api/keys`), stored AES-256-GCM under
  the `KEY_ENCRYPTION_SECRET` KEK, decrypted only inside the mint frame, never
  echoed (display = `last4`/fingerprint), revoke = hard delete. KEK unset ⇒
  `/api/keys` returns 503 and everything runs on the house key.
- **Spend safety** (`src/lib/interview/spend.ts`): reserve-then-settle per
  session (`SpendReservation`), daily house cap (`GlobalSpend`), sliding-window
  rate limit (`RateBucket`). House sessions bounded by `SESSION_CEILING_USD`;
  BYOK by time only (`MAX_SESSION_SEC`). Metered on the **server clock**, never
  client-reported time.
- **Resume grounding**: `validateResumeFacts` (panel-core) drops any extracted
  fact whose verbatim quote isn't a substring of the resume text; the digest
  fails **closed** (no grounding) on schema mismatch; resume content is fenced
  as untrusted data in interviewer instructions.
- **Moat capture**: `Outcome` (one per session) snapshots
  `predictedSignal`/`rubricVersion` at capture time so the prediction→outcome
  calibration pair survives rubric churn ([ADR-0012](decisions/0012-versioned-eval-contract.md)).

## 6. Data model (domains)

- **Auth** (Auth.js v5): `User` (sole tenant root; every owned row is
  `userId`-scoped + cascade-deletes), `Account`, `Session`, `VerificationToken`.
- **Interview**: `Scenario`, `PanelSeat`, `MockSession` (central run),
  `MockTurn` (`@@unique([sessionId, seq])`), `DimensionScore`, `PanelVerdict`,
  `ConfidenceMetric`, `DrillAssignment`, `JudgmentJob`.
- **Moat / custody / infra**: `Outcome`, `ProviderKey`, `ResumeProfile`,
  `RateBucket`, `GlobalSpend`, `SpendReservation`.

**Naming note** ([ADR-0014](decisions/0014-ubiquitous-language.md)): the DB
layer predates the interview/panel/providers language and is **frozen** —
`MockSession`/`MockTurn`/`MockStatus` mean "interview session/turn/status", and
`PracticeTurnRole.COACH` means "interviewer seat"
([ADR-0013](decisions/0013-speaking-coach-removed.md)). Do not rename DB
identifiers outside a coordinated schema+contract pass.

## 7. Invariants (review-blocking if violated)

1. Every query touching user data is **userId-scoped**.
2. The judge always runs on the **house key** with a **code-pinned model**.
3. BYOK keys are **never echoed back**; decrypt only inside the call frame; all
   logging flows through `redact()` via `src/lib/log.ts`.
4. **`turn_detection` stays `null`** (push-to-talk) via the one shared config.
5. `MockTurn` is **single-writer, seq-ordered**.

Each invariant has a named owning test — see [`docs/testing.md`](testing.md) §6.

## 8. CI/CD topology

Two workflows: `ci.yml` (five secret-free checks on every PR: Lint, Typecheck,
Tests + coverage gate, Clean build, Schema/migration drift) and `deploy.yml`
(push-to-main only: re-gate → build+push GHCR → migrate → approval-gated roll of
the EC2 box with a `/api/health` check). Reproduce CI locally with
`npm run verify`. Full pipeline + box operations: [runbook](runbooks/deploy.md).

## 9. Known gaps (tracked)

- `POST /api/interview/sessions` (create) has no handler test — the top gap;
  closing it lets the coverage ratchet rise. Also untested:
  `api/user/interview-date`, `panel-core/question-bank.ts`.
- No single-active-connection fence for LIVE sessions (two tabs can race the
  seq space; only the `@@unique` constraint guards).
- The daily spend cap reconciles against the reservation **estimate**, not
  measured provider usage.
- Data lifecycle: deletion is done + cascade-tested (unit level); export and a
  retention policy are not.
- `/api/mock/:path*` compatibility rewrite in `next.config.ts` should be
  removed once pre-rename clients age out.

# Aloud — Engineering Health Scorecard

*Staff-level read for a solo founder. Stage: pre-launch, zero users, single t3.micro, AI-assisted build. Lens: ship live → scale → stay maintainable → read as senior for an agentic-AI job.*

> Produced by a 21-agent engineering-practices audit (`aloud-engineering-practices-audit`, 2026-06-09): 6 dimension reviewers grounded in the code → adversarial verification of every high-severity gap (real problem vs. premature gold-plating) → this scorecard. Verdicts that downgraded an auditor's finding are respected here.

---

## 1. Verdict

**Overall grade: B+ (strong foundation, two process gaps that block a safe launch).** You are following proper industry strategy, at a level genuinely above what most solo pre-PMF projects look like: clean BFF → orchestrator → pure-logic layering, vendor adapters behind a typed boundary, Zod contracts at every API edge, userId-scoping on every query, atomic spend metering on the server clock, and a durable job queue with lease-based recovery. The architecture is *correctly calibrated* for the stage — you have not over-engineered, and the scaling decisions you've deferred are documented with reasoning, which is the senior move. The honest gaps are not in the design; they're in **release discipline**: 13 commits of your actual product (including the entire fluency route) live only on your laptop while GitHub points at known-broken code, you have zero production observability, and the live 3-seat panel has never been validated by a human. None of those are architectural debt — they're a Saturday afternoon of work — but until they're closed you have a beautiful engine nobody has turned the key on, and a remote repo that produces a broken clone.

---

## 2. What we're doing RIGHT (speak to this in interviews)

- **Genuinely pure core logic.** `packages/coach-core` takes data and returns data — no Prisma, no `fetch`, no I/O; unit-tested without mocking infrastructure. The single strongest "I know where boundaries go" signal in the codebase.
- **Vendor-adapter discipline with a safety contract.** Deepgram and Whisper both normalize to a common `DisfluencyWord[]`; `ProviderError` (`src/lib/coach/openai.ts`) carries *only* `{code, status}` — secrets never reach a log or client even on the exception path. BYOK-ready posture before BYOK.
- **Contracts at the edge.** `packages/shared-types` Zod schemas validate every request/response; even streaming JSON from OpenAI gets `.parse()`'d.
- **Money cannot run away.** `src/lib/mock/spend.ts` — atomic global daily cap via conditional raw SQL `UPDATE`, per-session reservation ledger, fixed-window rate-limiting, all on server wall-clock, never client-reported time.
- **Durable, crash-safe judgment.** `src/lib/mock/judgment-queue.ts` claims jobs with `FOR UPDATE SKIP LOCKED` + leases; the LIVE→DEBRIEF transition + job upsert happen in one transaction.
- **Idempotency everywhere it matters.** `@@unique([sessionId, clientTurnId])` on turns, `userId_clientRequestId` on session creation — retries don't double-bill or double-score.
- **Auth and scoping are textbook.** Auth.js v5, bcrypt(10), every sensitive query gated on `userId` (no IDOR), non-root Docker user, signed S3 URLs (1h), secret redaction at the single `log.ts` chokepoint.
- **The deferrals are documented, not accidental.** The plan docs sketch the BYOK refactor as a surgical future change — they're themselves an interview asset.

---

## 3. Scorecard

| Dimension | Score | One-line why |
|---|---|---|
| **Architecture & Modularity** | **4 / 5** | Clean BFF→orchestrator→pure-core layering, real vendor abstraction, enforced workspace boundaries. |
| **Scalability (DB / deploy / cost)** | **3 / 5** | Disciplined queries (no N+1), great indexing, authoritative cost meter; held back by unconfigured connection pool, process-bound sweeper, single-instance deploy — all fine at zero users, all flagged. |
| **Maintainability & Code Quality** | **4 / 5** | Strict TS, Zod contracts, pure logic isolation, 176 green tests; dinged by the uncommitted/unpushed git state and a couple of inconsistent validation shortcuts. |
| **Reliability & Observability** | **3 / 5** | Strong error *handling* (idempotency, durable retries, graceful degradation) but **zero** error *visibility* — a stalled judgment fails silently. |
| **Security & Data Handling** | **4 / 5** | Mature for the stage — redaction, userId-scoping, CSRF on mint, ephemeral tokens, spend caps; gaps are pre-scale. |
| **Dev Process & CI/CD** | **3 / 5** | Solid single-pipeline CI (lint→test→migrate→build→deploy), good conventional commits; undercut by no PR gate, no staging, and a critical unpushed branch. |

---

## 4. Fix NOW (cheap, high-leverage, before any more features or users)

1. **Push the branch — the #1 thing.** HEAD is 13 commits ahead of origin (which sits at the pre-everything `9ce40b6`), and the *entire* fluency route is untracked. A fresh clone today produces broken code and CI fails on a missing import. Commit the untracked audio route, push, open a draft PR so CI runs. Until this is done, nothing you've built is real — it exists on one disk.
2. **Minimal observability — ~2h, ~$0/mo.** The durable judgment queue has *no downstream alert*: exhaust `MAX_ATTEMPTS` and the only signal is a stdout line; the user's debrief silently never appears. (a) Email yourself (e.g. Resend) on `JudgmentJob → FAILED` or 3+ API retries; (b) add a structured `error_code` enum to every error log. You're finishing a half-built system (`log.ts` + `ProviderError` exist), not starting one.
3. **Safari/iOS handoff cutoff — one constant + one log line.** `realtime-connection.ts:268`: when the audio analyser is null (Safari/iOS autoplay-suspend), `awaitPlayoutEnd` falls back to `1200`ms vs the real `9000` default — closing lines run 2–3s, so they clip mid-sentence on a big share of mobile. Raise to `3000`, add a `log.info` when the fallback fires, verify on a real iPhone.
4. **Human live-test the 3-seat panel, once, and log it.** Everything green is unit/integration; the end-to-end has never been run by a person — the explicit blocking gate in ROADMAP Increment 0. Answer 4–5 questions, confirm no cutoff (esp. iOS after #3), confirm the report renders, log date/device/browser/screenshot in a `LIVE_TEST_LOG.md`.
5. **Guard the unguarded `JSON.parse` on the committee verdict.** `judgeCommittee` is parsed unguarded in `panel-orchestrator.ts` — a truncated/malformed model response throws a native `SyntaxError`, the queue retries 3×, then marks the session `FAILED` with no readable cause. Wrap it (and `scoreAgainstRubric`) → `throw new ProviderError('invalid_json_from_model', 500)`. ~10 min; converts a mystery failure into a debuggable one.

---

## 5. Fix BEFORE scale (design-debt that forces a rewrite if ignored)

- **Warmup baseline + self-relative delta — the moat, and cheapest to build at zero users.** `ConfidenceMetric.resilience`/`selfEfficacy` are hardwired `null`; `computeComposure` aggregates session-wide with no baseline. The defensible signal is the *within-speaker delta* (warmup = personal calm baseline), not an absolute "62% composure." Build before user history exists, or retrofitting breaks every session. **Do NOT touch the frozen `computeComposure`** — add `MockTurn.isWarmup`, snapshot warmup metrics, apply the delta downstream in the orchestrator. (~2–3 hrs.)
- **Wire the dead drill loop.** `DrillAssignment.resultSessionId` exists but is never written → re-attempt lift is never measured → zero compounding moat. Fix in Increment 2, after outcome capture is validated; don't ship "adaptive curriculum" language before it's real.
- **Surface the Outcome capture UI.** The `Outcome` model + `outcome/route.ts` already exist (the audit's "missing model" finding was stale). What's missing is the UI affordance to *call* it — a button on the report. Without it you can't record real results, which is the data that calibrates everything.
- **Replace the unsafe cast in the idempotency path.** `turn-orchestrator.ts:108` does `existing.metricsJson as …` — type-checks but doesn't validate, so corrupted/stale metrics flow to the client. Everywhere else uses `safeParse`. One-line fix; do it before any data seeding could produce malformed rows.
- **Connection pool config — a 3-line change, NOT now.** `src/lib/db.ts` inherits `pg`'s default `max: 10`, which saturates ~50–100 concurrent users on a t3.micro. Don't guess the number at zero users — add a `TODO` in `db.ts` + a note in `DEPLOY.md` ("tune before 50 concurrent users"), set it from real latency data when the first cohort tests.
- **Keep the analysis seam in mind.** The turn-based coach and the realtime panel are separate paths; that's *fine* today (disjoint session types). When you build a unified cross-feature progress dashboard, design new metrics path-agnostic — but don't merge the code yet.
- **TTL cleanup** for the unbounded `RateBucket` / `GlobalSpend` tables before high traffic.

---

## 6. Deliberately DON'T do yet (premature at zero users)

Resisting these *is* the senior move (the adversarial review downgraded each to "real-but-premature"):
- **KMS / envelope encryption for credentials** — there are no user keys to encrypt; you run on Aloud's capped key. Build after you instrument BYOK conversion.
- **Comprehensive readiness health checks** (DB ping + S3 + OpenAI in `/api/health`) — a bad boot on a single box costs a 5-min restart, maybe quarterly. Add a minimal Prisma ping the day before opening to users.
- **Read replicas, RDS Proxy, HTTP query caching, pagination** — real at 1k+ users, irrelevant at 0.
- **Staging, blue-green, rollback automation, PR-review gates, commitlint, branch protection** — the trigger is "first collaborator or first user," not "feels professional."
- **Merging the realtime + turn-based analysis pathways** — premature coupling for two features users can't run simultaneously.

---

## 7. The AI-assisted build process

**The process is sound senior engineering, not a toy.** Conventional commits with real scopes, surgical focused diffs, a `.cursor/rules` guideline that discourages speculative abstraction, planning docs that record *why*, a 176-test suite gating `tsc --noEmit`, a CLAUDE.md that encodes the architecture, and a CI pipeline (lint → test → migrate → build → deploy). The docs-as-memory + tests-per-change + surgical-diff loop is how disciplined teams work, and it's a strength to describe in interviews ("I drove an AI-assisted build with a documented decision log and a test gate on every change").

**The one process gap to close before inviting anyone in: branch & push hygiene.** "Done" currently means "committed to my laptop," and the tree silently diverges from origin. For a solo dev it's a footgun; with a reviewer it's a non-starter. (1) **Push immediately and keep feature branches < 3 days from origin.** (2) When the first collaborator/user arrives, turn on **branch protection** (require CI + 1 review on `main`) and add a **staging deploy**. Husky/commitlint are deferrable.

---

## 8. Bottom line — the job-portfolio angle

**What already reads as senior:** the boundaries. A reviewer opening this repo sees pure-logic packages with no I/O, vendor adapters behind a typed contract, a `ProviderError` that refuses to leak secrets even on the exception path, server-authoritative spend metering, idempotent writes via DB constraints, and a durable lease-based job queue — the things that distinguish someone who has *operated* software from someone who has only written it. The decision docs double as "here's how I sequence tech-debt vs. PMF." And you *didn't over-build* — the calibrated restraint is itself a senior signal.

**The 1–2 things that most raise the signal:**
1. **Push everything + one green PR + a logged human live-test.** A reviewer's first move is to clone and read the diff; a remote that produces broken code caps your score regardless of how good the local code is. Free, and it moves you from "trust me, it works locally" to a verifiable artifact.
2. **Add the minimal observability + `error_code` taxonomy** (§4.2). "I have a durable job queue *and* I get alerted when it fails, with structured error codes for triage" is a complete operational story; "I have a durable queue" alone invites "and how do you know when it breaks?" — for which the current answer is "I don't."

Files worth pointing a reviewer at, in order: `packages/coach-core/src/speech-analysis.ts` (pure boundary), `src/lib/coach/openai.ts` (`ProviderError` safety contract), `src/lib/mock/spend.ts` (atomic server-clock metering), `src/lib/mock/judgment-queue.ts` (lease-based durability), `prisma/schema.prisma` (idempotency + scoping).

# Aloud — Master Status & Roadmap

**Single source of truth.** Supersedes the scattered planning docs for *what we are doing and in what order*. The three deep-dive memos remain as references: [`DEFENSIBILITY_PLAN.md`](DEFENSIBILITY_PLAN.md) (the moat thesis), [`CONFIDENCE_DETECTION_PLAN.md`](CONFIDENCE_DETECTION_PLAN.md) (the speech/ML path), [`CONFIDENCE_ENGINE_PLAN.md`](CONFIDENCE_ENGINE_PLAN.md) (the realtime/BYOK architecture). Where those disagree with the code, this doc resolves it.

**Date:** 2026-06-06 · **Branch:** `fix/mock-panel-turn-taking` · **Maintainer:** tech lead

---

## Executive summary

Aloud today is a working React/JS adversarial mock-interview panel: a 3-seat real-time voice loop with push-to-talk turn-taking, an off-band Bar-Raiser judgment pipeline, and an end-of-session report with per-answer fluency metrics — and it is one commit away from being real, because the entire feature increment (including the live-panel blocker fixes and the fluency-analysis route) sits **uncommitted and partly untracked** on top of `HEAD` (commit `9ce40b6`), which still cuts the interviewer off mid-handoff. The product is a *commodity sensor* that is built; the *moat* — an outcome-validated, self-baselined, version-pinned record — is almost entirely unbuilt, and both surviving strategy memos independently name the same keystone for it: **A1 outcome capture** (no `Outcome` model exists in `prisma/schema.prisma`). The single highest-leverage truth in this doc is that the confidence feature and the defensibility moat are not two roadmaps — they share one keystone (outcome capture) and one blocker (an unvalidated live panel), so they ship as one ladder. **Honest verdict: the panel is built but unlanded and unvalidated; commit it, live-test it, then start the outcome clock — everything else is downstream of those three moves.**

---

## 1. Where the product is today

### What Aloud IS, right now
A React/JavaScript mock-interview product. A candidate joins a live 3-seat panel (Maya / Dev / Priya — JS fundamentals, React internals, rendering performance), the interviewer speaks first, the candidate answers via **push-to-talk** (PTT), and a Bar-Raiser drills until a claim holds or breaks. Audio goes browser↔OpenAI Realtime directly (Aloud is not in the audio path); each turn's transcript is checkpointed to Postgres; on completion an **off-band judgment pipeline** scores each seat against a frozen React/JS rubric, applies a deterministic Bar-Raiser veto, and writes a `reportJson` with a single composure score plus per-answer fluency (WPM, fillers, pauses).

This is the P0 "Confidence Engine" slice from `CONFIDENCE_ENGINE_PLAN.md §9`, pivoted from Amazon-LP behavioral to React/JS technical (the live-test pivot in memory). The earlier generic "delivery coach" still exists at `/api/coach/*` but is not the product direction.

### What works end-to-end
- **PTT turn-taking** — explicit user-driven recording; no auto-VAD race. `use-mock-panel.ts` (`toggleCapture`, `beginCapture`/`commitCapture`/`discardCapture` in `realtime-connection.ts`), sticky PTT button outside the scroll area in `mock-panel-view.tsx`.
- **Per-answer fluency analysis** — Whisper (`verbose_json`, word timings) → `analyzeSpeech()` → metrics joined to the `MockTurn` via `clientTurnId`, best-effort (a transcription failure never breaks the interview). `src/app/api/mock/sessions/[id]/turns/audio/route.ts` line 88.
- **Off-band judgment** — durable queue (`judgment-queue.ts`, lease + retry, `MAX_ATTEMPTS=3`), per-seat scoring with timeout, deterministic evidence filter (`fullTranscript.includes(lp.evidence)`) and veto (`evaluateDrill` → `finalizeVerdict`), atomic transaction writes verdict + dimensions + confidence + drill. `panel-orchestrator.ts`.
- **Report** — `mock-report-view.tsx` renders composure (0–100, graceful null), session-wide + per-answer fluency, per-seat signal rollup.
- **Spend / lifecycle** — server-clock spend metering, per-user/IP rate limits, global daily cap, `PENDING→LIVE→DEBRIEF→COMPLETED` with idempotent turn checkpointing (`@@unique([sessionId, seq])`).
- **Tests green** — 97/97 vitest (unit + integration + TS compile). Frozen `computeComposure()` (0.45 filler + 0.35 WPM-CV + 0.20 pause-CV) is intact and untouched.

### Committed vs uncommitted — the critical distinction
The whole increment is **dirty**. `HEAD` (`9ce40b6`) shipped only PTT; it does **not** contain the live-panel blocker fixes or the fluency seam.

| State | Contents | Risk |
|---|---|---|
| **Committed at `HEAD`** | PTT capture flow only. `doHandoff` calls `closePeer()` directly; `realtime-connection.ts` has **zero** `playout` references. | `HEAD` still clips the interviewer mid-handoff. |
| **Uncommitted (22 modified)** | Handoff-cutoff fix (`awaitPlayoutEnd` before `closePeer`), sticky PTT, multi-company rubric scaffolding, `aggregateFluency`, schema `clientTurnId`, report wiring. | Vanishes on a clean checkout / CI clone. |
| **Untracked (not in git at all)** | `src/app/api/mock/sessions/[id]/turns/audio/route.ts` — the entire fluency foundation. Plus `CONFIDENCE_DETECTION_PLAN.md`, `DEFENSIBILITY_PLAN.md`. | A re-clone has **no fluency route**. The load-bearing Phase-1 seam is not under version control. |

**Verified contradiction (survey vs git):** the survey says "97/97 pass, ready for commit or deployment" and treats Increment-0 as done. Git proves it is *done but unlanded* — `git show HEAD:…use-mock-panel.ts` has no `awaitPlayoutEnd`, `git show HEAD:…realtime-connection.ts` has no `playout`, and `git ls-files` returns nothing for the audio directory. **Resolution: "Increment 0 is done" is false at `HEAD`. It is "written, working in the tree, not committed."**

### What is known-broken / unverified
- **Handoff audio cutoff (fallback path).** `awaitPlayoutEnd` exists in the tree (`realtime-connection.ts:254-293`) and is awaited before `closePeer` (`use-mock-panel.ts:384`), but when the remote analyser fails to init (autoplay/AudioContext-suspend on Safari/iOS) it falls back to a **1200ms hard timeout** (`:268-269`) that can still clip the interviewer mid-sentence. Marked `broken` in the survey.
- **PTT-Done → reply timing, unverified.** `response.create` fires on `commitCapture`; not verified against a late `COACH .done` from a torn-down peer post-handoff (risk of an orphaned reply).
- **No human live-test on record.** Unit/integration are green, but the actual human end-to-end live-test both plans gate everything on is not evidenced.

### One-line health verdict
**Built, but unlanded and unvalidated** — the panel works in the working tree, `HEAD` is still the broken panel, and the moat clock has not started.

---

## 2. Status matrix: plan vs reality

Legend: **built** = real & committed-or-tested · **partial** = exists but uncommitted/incomplete · **stub** = present-but-dead · **dead-loop** = field/plumbing exists, write is a no-op · **missing** = no code.

| Feature (plan) | Tier | Status | Evidence |
|---|---|---|---|
| React/JS pivot (seats, competencies, committee prompt) | Inc 0 | **built** | `rubric-definitions.ts` (`REACT_JS_COMPETENCIES`, `getRubricForCompany`); `seed.ts` seeds `react-js-panel-p0`. Multi-company (Stripe/Google/Meta) scaffolded, only AMAZON+REACT populated — fine per plan ("stay narrow"). |
| Handoff audio-cutoff fix (`awaitPlayoutEnd` before `closePeer`) | Inc 0 (BLOCKING) | **partial** | In tree (`realtime-connection.ts:254-293`, `use-mock-panel.ts:384`); **`HEAD` has 0 `playout` refs and calls `closePeer()` directly.** Uncommitted. |
| Sticky PTT button (outside scroll area) | Inc 0 (BLOCKING) | **partial** | `mock-panel-view.tsx:86-95`; `HEAD` has 0 matches for "OUTSIDE the scroll area". Uncommitted. |
| Live human end-to-end validation | Inc 0 (BLOCKING) | **partial** | 97/97 unit/integration; no e2e of WebRTC handoff; no-analyser 1200ms fallback is a known fragility. |
| Per-answer fluency seam (Whisper→`analyzeSpeech` on PTT audio) | Conf P1 foundation | **partial** | Works end-to-end (`turns/audio/route.ts:88` → `aggregateFluency` → report). **Entire file UNTRACKED.** |
| LLM transcript-repair before `analyzeSpeech` | Conf P1 #1 (top fairness fix) | **missing** | 0 hits for `repairTranscript`; raw Whisper words used directly. |
| Mandatory warmup answer + self-relative delta scoring | Conf P1 #4 (the moat core) | **missing** | 0 functional `warmup`/`baseline` hits; `computeComposure` aggregates session-wide with no baseline partition; no `WARMUP_ANSWER` turn type. |
| Silent-pause ratio | Conf P1 #2 | **missing** | `speech-analysis.ts` has `pauseCount`/`avgPauseMs`/`longestPauseMs` but no `totalSilentMs/turnDurationSec`. ~3-line add. |
| Multi-word fillers / false-starts / lexical hedging | Conf P1 #2–3 | **stub** | `FILLER_WORDS` lists "you know"/"sort of" but matches single tokens only ("kept for documentation, not relied on"); no hedging lexicon; no false-start detection. |
| Populate `ConfidenceMetric.resilience` / `selfEfficacy` | Conf P1 | **dead-loop** | Schema + Zod + write site exist; `panel-orchestrator.ts:246-247` hardwires both to `null`. |
| **A1 — Real-Outcome Capture** (`Outcome` model / `nextRoundResult`) | **Tier A / Inc 1 #1 (keystone)** | **missing** | 0 hits for `model Outcome`/`nextRoundResult`. No model, field, enum, or route. **The dependency root of A2/A4/B1 and all of Tier C.** |
| A2 — Longitudinal trajectory / verdict timeline | Tier A / Inc 1 #3 (pure read) | **missing** | No cross-session reads; only per-session `ReportBody`. Index `@@index([userId,key,createdAt desc])` is ready. |
| A3 — Evidence filter (literal-substring grounding) | Tier A / Inc 1 #2 | **built** | `panel-composition.ts:101-102` filter; rendered in report. The one A3 piece that's real. |
| A3 — Dispute / flag→human-review queue | Tier A / Inc 1 #2 | **missing** | No model, route, or UI flag. "Without it there is no flywheel." |
| A3 — `rubricVersion` / `ruleHash` on `PanelVerdict` | Tier A / Inc 1 #2 | **missing** | No version/hash field; verdicts not re-derivable. Blocks the C3 calibration claim. |
| A3 — Turn-level anchoring (which `MockTurn.seq` proved a signal) | Tier A | **missing** | Evidence anchored to a transcript substring, not a `seq`. Self-acknowledged P1 deferral. |
| A4 — Before/After evidence reel | Tier A / Inc 1 #4 | **missing** | No multi-session same-competency comparison. (Survey's "before/after placeholders" claim is **not** borne out by `mock-report-view.tsx`.) |
| B1 — Adaptive drill curriculum / `DrillAssignment.resultSessionId` loop | Tier B / Inc 2 #5 | **dead-loop** | `resultSessionId` defined, **never written**; one one-rep drill created with `sourceSessionId` only. "Until a re-attempt is scored against its source, there is literally zero moat." |
| B2 — "Survived the Bar Raiser" reel | Tier B / Inc 2 #6 | **missing** | Deterministic veto (the data substrate) exists; no share/clip/deep-link surface. |
| B3 — Bootcamp cohort dashboard | Tier B / Inc 2 #7 | **missing** | No admin surface. |
| B4 — Prep-cycle / application ledger | Tier B | **missing** | Only `User.targetCompanies`/`interviewDate` precursors. |
| FROZEN `computeComposure` (do-not-touch) | Frozen v1 | **built** | `panel-composition.ts:175-209`; intact, correctly untouched. |
| Deterministic veto + evidence filter (judgment kernel) | Tier A substrate | **built** | `evaluateDrill`/`finalizeVerdict`; tested 19/19. (Veto reason-text reword is cosmetic, **untested** against expected verdicts.) |

---

## 3. The one critical path

Both memos were written *after* the code and independently converge on the same structure. They are not two roadmaps — they are one ladder with **one keystone** and **one blocker**.

- **One keystone — A1 outcome capture.** `DEFENSIBILITY_PLAN §3/A1`: *"Capturing one outcome label per session is the single most important instrumented event in the product. Build it before anything else."* `CONFIDENCE_DETECTION_PLAN §4`: the self-baselined confidence delta is only defensible once calibrated to outcomes, and *"there is no `Outcome` model, no `nextRoundResult` field… at launch the calibrator degenerates to an uncalibrated LLM opinion."* The confidence signal and the defensibility moat **read from the same missing table.** Build it once; both features turn on.

- **One blocker — the unvalidated live panel.** `DEFENSIBILITY_PLAN §5`: *"Nothing in Tiers B/C is worth a line of code until a candidate can complete a panel without the interviewer getting cut off."* `CONFIDENCE_DETECTION_PLAN §6` gates Phase 1 on the same milestone. The handoff-cutoff fix that clears this blocker is **written but uncommitted** — so the gate is failed at `HEAD` for a reason that is one commit, not one sprint, away.

```
                    LIVE-TESTED PANEL  ◄── the blocker (handoff fix is written, uncommitted)
                           │
                           ▼
                  A1 OUTCOME CAPTURE  ◄── the keystone (no Outcome model exists)
                     ┌─────┴─────┐
                     ▼           ▼
        CONFIDENCE delta   DEFENSIBILITY moat
     (warmup baseline +    (A2 trajectory, A4 reel,
      transcript-repair,    B1 drill lift, C-tier
      populate resilience)  calibration/credential)
```

**The defensible product is not the panel** (built, a commodity any lab will keep improving). It is the outcome-bound, version-pinned, self-baselined *record*. Step 1 is unblocking work that already exists; steps 2+ are the entire moat.

---

## 4. The organized roadmap

Constraints in force: small team, single t3.micro EC2, transcript-only cost posture, zero users. The binding constraint is the moat clock, not features.

### Increment 0 — Earn the right (BLOCKING; do this first)
**Goal:** a candidate completes a React/JS panel without the interviewer getting cut off, on a committed tree.

**Tasks**
1. **Commit the dirty tree + `git add` the untracked audio route.** Lands the handoff-cutoff fix (`use-mock-panel.ts:384` `awaitPlayoutEnd` before `closePeer`), sticky PTT (`mock-panel-view.tsx:86-95`), and the fluency foundation (`turns/audio/route.ts`). Zero new code; highest-leverage action in the doc.
2. **Harden the no-analyser fallback.** `realtime-connection.ts:268-269` — the 1200ms hard timeout clips handoff when `remoteAnalyser` is null (Safari/iOS autoplay-suspend). Lengthen/condition the fallback or retry analyser init before tearing down `closePeer`.
3. **Verify PTT-Done→reply.** Confirm `response.create` on `commitCapture` doesn't produce orphaned replies against a torn-down post-handoff peer.
4. **Run the human live-test.** One full 3-seat panel, end to end, no mid-sentence cutoff, PTT obvious and reachable, report renders.

**Files/seams:** `use-mock-panel.ts` (`doHandoff`, `toggleCapture`), `realtime-connection.ts` (`awaitPlayoutEnd`), `mock-panel-view.tsx` (sticky PTT), `turns/audio/route.ts` (add to git).
**Schema deltas:** none.
**Done looks like:** clean checkout builds + the route exists in git; a human completes a panel with no cutoff; the live-test is recorded as passed.
**Serves both:** it is the literal gate (`DEFENSIBILITY_PLAN §5`, `CONFIDENCE_DETECTION_PLAN §6`) on every downstream feature for *both* product and moat.

### Increment 1 — The two-for-one (start the clock + the only novel signal)
**Goal:** start the outcome clock and turn the commodity fluency sensor into a self-baselined delta — shipped together because they share the keystone.

**Tasks**
1. **A1 Outcome capture.** Add an `Outcome` model + write site in the existing `panel-orchestrator.ts:226-274` transaction (or a dedicated gated POST route). Round-level, not offer-level (days not years, less gameable — `DEFENSIBILITY_PLAN A1` reframe).
2. **Warmup baseline + self-relative delta.** Add a `WARMUP_ANSWER` turn type at interview start (`use-mock-panel.ts`); cache its `SpeechMetrics`; in `panel-orchestrator.ts:246-247` **stop the dead `null,null` write** and populate `resilience`/`selfEfficacy` as deltas-vs-warmup. **Do not touch FROZEN `computeComposure`.**
3. **LLM transcript-repair.** One `gpt-4o-mini` call at `turns/audio/route.ts:88` *before* `analyzeSpeech`; keep raw + repaired, use repaired for denominators. Top fairness fix (`CONFIDENCE_DETECTION_PLAN §3`).
4. **Cheap speech-analysis adds (bundle with #3).** Silent-pause ratio (`totalSilentMs/turnDurationSec`, ~3 lines); real multi-word filler / hedging detection (replace single-token match at `speech-analysis.ts:74-76`).
5. **Report framing.** `mock-report-view.tsx` — render deltas as *"relative to your own warmup, your X changed by Y%."* Never an absolute cross-person number (`CONFIDENCE_DETECTION_PLAN §5`).

**Files/seams:** `prisma/schema.prisma`, `panel-orchestrator.ts:226-274` & `:246-247`, `turns/audio/route.ts:88`, `speech-analysis.ts:74-76`, `use-mock-panel.ts`, `mock-schemas.ts ~199`, `mock-report-view.tsx`.
**Schema deltas:** `model Outcome { id, userId, mockSessionId FK, nextRoundResult enum(ADVANCED|REJECTED|GHOSTED|OFFER_LEVEL_X), capturedAt }`; extend `mockReportSchema` with confidence delta fields; `WARMUP_ANSWER` turn handling.
**Done looks like:** every completed session can store one real outcome label; `resilience`/`selfEfficacy` are non-null self-relative deltas; the report says "relative to your own warmup"; non-native filler/pause penalty drops via transcript-repair.
**Serves both:** A1 is the moat keystone; the warmup delta is the one genuinely novel/defensible confidence signal — and they share the same write path, so this is literally two outcomes for one increment.

### Increment 2 — Trust substrate (make the verdict defensible + close the loop)
**Goal:** make verdicts contestable, reproducible, and longitudinal; wire the dead drill loop so re-attempts produce a real lift signal.

**Tasks**
1. **A3 dispute/flag→human-review queue.** Add the model + route + a UI flag affordance in `mock-report-view.tsx`. The substring evidence filter is the existing half; ship the queue half.
2. **A3 reproducibility.** Add `rubricVersion` + `ruleHash` to `PanelVerdict`, populated from a hash of the rubric + veto rules at judgment time (`panel-orchestrator.ts ~:165`). Makes "lift" a treatment effect, not judge drift.
3. **B1 wire the dead loop.** When a session resolving an open `DrillAssignment` completes judgment, set `resultSessionId` in `panel-orchestrator.ts`. Then compute lift = `DimensionScore(source)` vs `DimensionScore(result)`. Expert-prior routing first; lift-ranked only after a cohort cell clears minimum-N.
4. **A2 trajectory read.** Per-user dashboard over the existing `@@index([userId,key,createdAt desc])` on `DimensionScore` + `ConfidenceMetric` over time. Pure read, no new capture; gate at N≥6 with confidence bands.

**Files/seams:** `panel-orchestrator.ts:226-274` & `~:165`, `prisma/schema.prisma` (`PanelVerdict`, dispute model, `DrillAssignment.resultSessionId` write), new trajectory route + view.
**Schema deltas:** `PanelVerdict.rubricVersion`/`ruleHash`; a `DisputeFlag`/review model; `DrillAssignment.resultSessionId` finally written.
**Done looks like:** a candidate can flag a finding and it routes to review; any verdict is re-derivable from its pinned version; a re-attempt links to its source and shows a measured delta; an N≥6 user sees a competency trajectory.
**Serves both:** A3 is the trust substrate the whole credential/calibration story depends on; the B1 loop is the first compounding moat; A2 is the cheapest Tier-A win and the surface A4 plugs into.

### Increment 3 — Distribution (gated on a validated verdict + real volume)
**Goal:** one viral wedge and one distribution partner — only after the verdict is credible.

**Tasks**
1. **B2 "Survived the Bar Raiser" reel.** A short shareable artifact on the **binary, code-enforced** veto-survival claim only (true at N=1). "Launch this exact panel" deep-link. **No percentile leaderboard** until cells are dense (`DEFENSIBILITY_PLAN B2`).
2. **B3 one bootcamp partner.** Cohort readiness rollup over existing aggregations; sell it as a *placement-outcome instrument*, not a dashboard. This is the fastest path to dense, corroborated outcome labels (the `§6 risk 1` mitigation).

**Files/seams:** new share/clip surface over `PanelVerdict` + `evaluateDrill`; cohort aggregation views over `DimensionScore`/`PanelVerdict`.
**Schema deltas:** minimal (share artifact metadata; cohort grouping is read-only).
**Done looks like:** a candidate can share a veto-survival clip with a deep-link that launches the same panel; one bootcamp pushes required mocks and gets a cohort rollup tied to their placement KPI.
**Serves both:** the reel is the acquisition loop that *feeds the calibration corpus*; the bootcamp is the distribution answer **and** the first dense source of real outcome labels — both compound A1.

---

## 5. Explicit DEFER / DO-NOT-BUILD list

These failed the adversarial filter or are infra-blocked. Do not pour roadmap into them.

- **Praat / openSMILE acoustic prosody sidecar** — needs ffmpeg + Python + a process on a 1 GiB t3.micro; per-answer upload is opus/webm with no decoder on the box. Transcript-only gets ~80% of the value with zero new infra. (`CONFIDENCE_DETECTION_PLAN §3` Tier-3.)
- **BYOK as a *feature*** — it's a cost posture, not a barrier to entry, and brutal onboarding friction for a nervous candidate. Eat inference cost for individuals; reserve BYOK for B2B2C. Never pitch it. (`DEFENSIBILITY_PLAN §2`.)
- **Employer pool / req marketplace / referral loop (C4)** — double cold-start, adverse selection; impossible to bootstrap at zero users. Gated on a *validated* verdict.
- **Multi-scenario expansion (Amazon LP seats, Stripe/Google/Meta panels)** — depth of calibration on *one* stack (React/JS) beats breadth. The multi-company scaffolding can sit dormant.
- **Proctoring / anti-cheat** — defeated by a second device; catastrophic false-positives on calm/non-native speakers; HackerRank/Karat own employer-trusted proctoring.
- **Absolute confidence number on a shareable credential** — uncalibrated + accent-biased + on a credential inverts the anti-anxiety thesis and re-imports AEDT/LL-144 risk. Keep confidence candidate-facing and self-relative. (`CONFIDENCE_DETECTION_PLAN §5`.)
- **Multi-model adversarial panel (each seat a different lab)** — correlated frontier models give redundant, not independent, reads; unvalidated. Software hygiene, not a moat.

---

## 6. Immediate next actions (this week, in order)

1. **Commit the working tree and `git add` `src/app/api/mock/sessions/[id]/turns/audio/`.** Until this lands, `HEAD` is the broken panel and the fluency foundation isn't in version control. Zero new code. *(Also decide #1 in §7 — commit the two plan `.md`s or move them to the vault.)*
2. **Harden the handoff no-analyser fallback** (`realtime-connection.ts:268-269`) so Safari/iOS autoplay-suspend can't clip the interviewer mid-sentence.
3. **Run the human live-test** of one full React/JS panel end-to-end; record it as passed (or file the specific cutoff bug). This is the literal "earn the right" gate.
4. **Land A1 outcome capture** — one `Outcome` model + one write in the existing `panel-orchestrator.ts` transaction. Smallest possible row; starts the only clock that matters.
5. **Stop the dead `resilience/selfEfficacy` write** (`panel-orchestrator.ts:246-247`) by adding the `WARMUP_ANSWER` baseline and computing deltas — the first concrete step of the novel signal, without touching FROZEN `computeComposure`.

---

## 7. Open decisions for the founder

These are genuine forks the tech lead should not resolve silently.

1. **Commit the pivot now vs keep iterating uncommitted.** The increment is live-validated on the last two commits but the blocker fixes + fluency route are dirty/untracked. *Recommendation: commit now* — a clean checkout/CI loses the fluency route entirely; iterate on a committed base. (Also: are `CONFIDENCE_DETECTION_PLAN.md` / `DEFENSIBILITY_PLAN.md` repo docs or Obsidian-vault notes?)
2. **Eat inference cost vs BYOK for the consumer funnel.** A nervous new-grad pasting a frontier API key is the worst onboarding in the product. *Lean: eat the (capped, subsidized) cost for individuals; BYOK/seat-billed for B2B2C cohorts.* Needs a unit-economics check against the spend ceilings in `spend.ts`.
3. **Round-level vs offer-level outcome label.** Offers take years to densify a cell and are survivorship-biased; round-level ("did your next round match our predicted weakest dimension") is days, less gameable. *Lean: round-level as the primary `nextRoundResult`; offer-level optional.* Decide before the `Outcome` enum is written.
4. **What model performs transcript-repair, and is its per-answer `gpt-4o-mini` cost in the inference budget?** It's a second pass over text the realtime model already transcribed via `gpt-4o-transcribe` — confirm it's complementary (fixing disfluency mis-transcription), not redundant, and accounted for in `openai.ts` cost tracking.
5. **Store original + repaired transcript, or overwrite `MockTurn.transcript`?** Repaired for metric denominators; do we surface raw, repaired, or both to the user?
6. **The cold-start bet: can we get ~50–100 corroborated labels in one React-SDE_II cell within two increments?** If not, the entire Tier-C trust story slips, and the bootcamp partner (B3) becomes a P0 GTM task, not "later." (`DEFENSIBILITY_PLAN §6 risk 1`.)

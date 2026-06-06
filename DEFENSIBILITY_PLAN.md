# Strategic Planning Memo — Aloud Defensibility Roadmap

**To:** Founding team
**From:** Head of Product & Strategy
**Re:** What to build that big-tech AI cannot commoditize
**Date:** 2026-06-06
**Status:** Decision memo — act on this.

> Produced by a 114-agent research+adversarial-filter workflow (`aloud-defensibility-plan`):
> 4 research threads (big-tech trajectory, competitors, moat theory, hiring domain) →
> 7 ideation lenses → 54 raw ideas → 33 deduped → 3 skeptic judges each
> ("could OpenAI/Anthropic/Google ship this with a model update?") →
> **19 survived, 14 killed.** Every surviving feature uses its strongest adversarial reframe.

---

## 1. The core strategic insight

**The transport is the commodity. The judgment, the longitudinal record, and the outcome-validated trust are the moat.**

Everything in the conversation layer — the lifelike voices, the barge-in, the real-time transcription, the "act like a FAANG interviewer" persona, even the question generation — is rented infrastructure that OpenAI, Google, and Anthropic will keep making better and cheaper for *everyone, including us*. Realtime audio pricing already fell ~20% in 2026; Claude voice has been free since June 2025; Google built the exact generic product (Interview Warmup), ran it four years, and **walked away** in April 2026, redirecting users to Gemini Live. That last fact is the single most important signal in the research: a trillion-dollar company's *revealed preference* is that a horizontal voice-bot interview tool is a feature, not a business worth maintaining as a vertical. That is precisely the gap we occupy.

So the principle, stated sharply:

> **We are not in the "talk to an AI interviewer" business. We are in the business of producing a *calibrated, contestable, outcome-validated hiring signal* and being the *durable system-of-record* for a candidate's months-long readiness journey. The conversation is the sensor; the moat is what we do with the readings and the fact that we keep them.**

**Which bets get *stronger* when base models improve** (the litmus test for every feature):

A feature is *model-complementary* (survives, compounds) if a smarter base model makes **it more useful**; *model-substitutable* (dies) if a smarter base model makes **it unnecessary**.

- A better scorer makes our **calibrated rubric** *more accurate* against the same frozen anchor set → complementary. ✅
- A better model writes a *crisper narrative* around our retained **before/after disfluency evidence** — but cannot fabricate last month's word timings → complementary. ✅
- A better model makes "ask GPT to role-play an interviewer" *replace* a generic voice-bot → substitutable. ❌
- A better model emits turn-boundary telemetry natively, eroding "we measure latency-to-answer" *as a raw capability* → substitutable, **unless** fused to outcomes. ⚠️

The corollary that should reframe team anxiety: **every frontier model upgrade is a threat to a naive scorer and a gift to a calibrated one.** A new model silently re-grades and drifts; that destroys a competitor's "trust me" number. We turn the upgrade into a *trust-building event* — re-score the gold set, publish the drift report, prove "SDE_II means the same thing it did last quarter." Model churn *widens* our calibration advantage. We should want OpenAI to ship GPT-Realtime-3 next week.

---

## 2. What big tech WILL commoditize — stop investing here

These are dead as differentiators. We keep them as **table-stakes plumbing** but never pitch, market, or pour roadmap into them. (Drawn from the killed list and research.)

| Commoditized layer | Why it's dead | Our posture |
|---|---|---|
| **Voice pipeline / lifelike persona voices** | gpt-realtime, Gemini Live, Claude voice all do low-latency barge-in S2S; price falling. "Realistic AI voices" pitch is already dead. | Rent it. Never lead with it. |
| **Generic conversational mock interview + feedback** | Free in ChatGPT Advanced Voice + Gemini Live today; Google retired its own. | Assume this is the *free floor*. Price and position **above** it. |
| **Question bank *content*** | 16 React competencies / 16 LPs are freely scrapeable (GreatFrontEnd, Frontend Handbook). Zero defensibility as text. | Keep as cold-start seed + acquisition bait. The *content* is not the asset. |
| **Raw speech metrics (WPM, filler count, pauses)** | Yoodli, Huru, Big Interview, LinkedIn all ship this. A commodity feature. | Necessary input; not a moat by itself. |
| **Generic memory / "we remember you studied React"** | ChatGPT Study Mode already does memory-based learning profiles + progress tracking; OpenAI is training it into the base model. | Only defensible if *domain-specific + calibrated* (per-competency SDE_II trajectory), never generic. |
| **Resume/JD-aware question gen** | Canonical long-context demo; a "coach mode + file memory" replays it free. | Don't build as a standalone moat feature. |
| **BYOK passthrough as a "feature"** | Margin/COGS choice, not a barrier to entry. Brutal onboarding friction for a nervous candidate vs. a logged-in ChatGPT user. | Useful cost posture, **not** a defensible feature. Do not pitch it as one. |
| **Multi-model / provider-agnostic adapter as "moat"** | Software hygiene any competent dev writes in a weekend; lowers *everyone's* switching cost equally. | Build the adapter for ops hygiene; never call it the moat. |
| **Client-side proctoring / anti-cheat** | Defeated by a second device; false-positives on calm/non-native speakers are catastrophic; HackerRank/CodeSignal/Karat own employer-trusted proctoring. | Defer. Do not underwrite an employment-grade integrity claim we can't back. |

**The hard, opinionated cut:** kill all roadmap energy on "BYOK as differentiator," "multi-model adversarial panel as confidence signal" (correlated frontier models give redundant, not independent, reads — unvalidated), "provider-agnostic adapter as moat," "proctored mode," and "accent-fair layer pitched as a built moat today." These are either plumbing, unvalidated, or vaporware-dressed-as-defensibility. (See §6 for the one *real* seed buried in the accent work.)

---

## 3. The defensible feature roadmap

All features below use the **stronger reframes** from the verified analysis. The unifying move across every tier: **shift the unit of value from "the model's opinion" to "an outcome-validated, retained, contestable record only we hold."**

### TIER A — NOW (leverage what we've built)

These exploit assets already in the codebase (panel composition, coach-core fluency math, frozen rubric, DimensionScore/DrillAssignment schema, deterministic veto) and require minimal new capture. They start the clock on the data flywheel.

**A1. Real-Outcome Calibration Loop** *(durability 4 — the single highest-leverage asset)*
- **One-liner:** After a session, and again when the interview date passes, capture the *real* result (advanced / rejected / ghosted / offer@level) and bind it to the pre-interview PanelVerdict + DimensionScore profile on a *versioned* rubric.
- **Defensibility thesis:** A smarter model cannot manufacture *who actually passed a real FAANG loop*. That label only exists if a candidate-side product captures it against its own prior prediction. Labs are policy-allergic to consequential employment claims and run stateless assistants with no mechanism to retain this. This is interviewing.io's entire moat, consumer-side.
- **Moat type:** outcome-proof + credential-trust.
- **Builds on:** prediction side already persists; needs one outcome field/table. **Reframe:** make the unit of proof "did your *next round* match our predicted weakest dimension" (round-level, days not years, less gameable) rather than "did you get the offer." Version + pin the rubric so every prediction is a permanent labeled row, and a model upgrade becomes a *forcing function to revalidate*, not a threat. Gate the public "How calibrated is Aloud?" page behind minimum-N per cell with confidence intervals shown — honest "n=12, wide CI" builds more trust than a fabricated percentage.
- **Why NOW:** the clock hasn't started. Closed-loop defensibility needs ~50k–500k interactions and 12–24 months to compound. **Capturing one outcome label per session is the single most important instrumented event in the product. Build it before anything else.**

**A2. Longitudinal Readiness Trajectory & Verdict Timeline** *(durability ~3.7)*
- **One-liner:** Per-user, per-company dashboard plotting the *shape* of improvement — each of the 16 competencies as a sparkline over time, confidence slope, veto/inclination history — surfacing one calibrated verdict ("you read SDE_II on 11 of 16; 3 still read NEW_GRAD under adversarial difficulty") and a confidence-banded days-to-ready.
- **Defensibility thesis:** A stateless chat has no memory of your 16-competency scores across 8 sessions on a *frozen* rubric. Study Mode's generic "we remember you practiced React" cannot produce a calibrated SDE_II-vs-NEW_GRAD per-competency trajectory because it has no canonical schema and no comparable series. A smarter model makes each *score* more accurate (complementary); the accumulated comparable series is the switching cost it can't reconstruct.
- **Moat type:** data-flywheel → (fused with A1) outcome-proof.
- **Builds on:** pure read over existing indexed DimensionScore/ConfidenceMetric data; **no new capture.** **Reframe:** freeze and version the rubric as the headline ("scores comparable across model upgrades"); suppress days-to-ready until N≥6 sessions and show confidence bands, not false-precision points — otherwise it nukes trust on the anxious new-grad we're meant to serve.

**A3. Evidence-Anchored Audit Trail** *(durability 3, but a trust *substrate* for everything)*
- **One-liner:** Every verdict fully auditable and contestable — turn-level anchoring (which exact MockTurn.seq proved each signal), a "Why this verdict?" panel linking each strength/risk/veto to the verbatim quote + the seat + the deterministic rule that fired. Candidates flag mis-anchored findings → human-review queue.
- **Defensibility thesis:** A smarter model writes more *persuasive* prose, but persuasiveness is not *auditability*. The defensible thing is the deterministic, evidence-grounded, contestable structure that lets an employer trust the verdict was earned from real words, not hallucinated. Labs are RLHF-tuned toward agreeable, hedged prose and have policy incentive to avoid pointed, auditable employment verdicts.
- **Moat type:** outcome-proof (via the dispute corpus).
- **Builds on:** the literal-substring evidence filter already exists in `panel-composition.ts` (`fullTranscript.includes(lp.evidence)`); MockTurn.seq exists — turn anchoring is a cheap join. **Reframe:** the moat is *not* "we cite quotes" (a grounded model does that) — it's **versioned + reproducible + contestable + someone stands behind it.** Store rubricVersion + ruleHash on every PanelVerdict so any verdict is re-derivable months later. **Ship the flag→human-review queue now** — without it there is no flywheel; today it's a one-line filter and a roadmap comment.

**A4. Before/After Evidence Reel** *(durability 4)*
- **One-liner:** For any competency, show the exact early transcript moment the user read NEW_GRAD beside the later moment they read SDE_II, with the fluency delta on those specific answers ("on 4/12 you froze 6s and used 9 fillers on useMemo; on 5/30, 40s with 1 filler and the Bar Raiser stopped pushing").
- **Defensibility thesis:** Requires retained turn-level transcripts + word timings + per-turn fluency across *multiple* sessions anchored to a fixed rubric. The fluency deltas come from disfluencies (fillers, pauses, latency) that big-tech ASR is *engineered to delete* — the analytic goal runs against their product default. A better model writes a crisper narrative; it cannot fabricate your earlier session's word timings.
- **Moat type:** outcome-proof + data-flywheel.
- **Builds on:** coach-core speech-analysis + retained transcripts. **Reframe:** make it the *resolution of an open challenge* — when a competency reads NEW_GRAD, issue a named challenge (this half-exists as DrillAssignment with source/resultSessionId); the reel renders only when the user returns and re-answers. This manufactures the multi-session-same-competency data the reel needs (fixing cold-start) and turns a passive byproduct into the explicit reason to return. Extends the Signal-card PNG into a shareable, signed before/after credential.

### TIER B — NEXT (build the flywheel + distribution)

These convert the Tier-A data assets into compounding loops and acquisition. Sequenced *after* the panel is live-validated.

**B1. Adaptive Drill Curriculum with Efficacy-Ranked Routing** *(durability 3)*
- **One-liner:** Replace the single one-rep DrillAssignment with a standing, spaced-repetition curriculum where routing is *efficacy-ranked* — assign the drill with the highest measured historical score-lift for the user's gap-and-level cohort, computed from DimensionScore(source) vs. DimensionScore(resultSession).
- **Defensibility thesis:** A coaching relationship encoded in state + a closed loop (gap → drill → re-attempt → measured delta) that exists only because we own *both* the assignment and the re-scored outcome on the *same* rubric. A better model improves any single critique but has no record of which intervention moved which weakness across a population.
- **Moat type:** data-flywheel.
- **Builds on:** **WIRE THE DEAD LOOP FIRST** — `DrillAssignment.resultSessionId` is currently never populated; until a re-attempt is scored against its source, there is literally zero moat. Pin the rubric so "lift" is a real treatment effect, not judge drift. **Critical caveat:** start with a transparent expert prior (target the LP, escalate difficulty on regression); only let lift-ranked routing override once a cohort cell clears minimum-N — don't dress up `bank[0]` as "efficacy-ranked."

**B2. Calibrated Signal Reels & "Survived the Bar Raiser"** *(durability ~3.7 — the viral acquisition wedge)*
- **One-liner:** A 20-second shareable clip stitching the candidate's strongest answer + the Bar Raiser's toughest follow-up + a verdict overlay ("Held SENIOR on Reconciliation & Keys under 3 follow-ups — no veto"), with a "launch this exact panel" deep-link.
- **Defensibility thesis:** A chat assistant produces *ephemeral private* feedback, not a public, branded, re-runnable performance artifact. The "try this exact panel" link converts every share into a *deterministic, comparable session* — the distribution Aloud's weakest dimension currently lacks.
- **Moat type:** network-effect / acquisition loop that *feeds the calibration corpus*.
- **Builds on:** PanelVerdict + the **deterministic** `evaluateDrill` veto. **Reframe (important):** lead with the **binary, code-enforced, reproducible claim** ("Survived the Bar Raiser") — true and meaningful at N=1, no cross-user distribution needed. **Hold the "percentile vs cross-user distribution" leaderboard until cells are dense** (~hundreds of runs per scenario×level); a percentile on n=11 is statistical theater that violates our anti-anxiety thesis. Gate against re-roll farming: badge only first-attempt-per-week, bind to the immutable transcript+veto trace.

**B3. B2B2C Cohort Dashboard & Sprints (bootcamp/university channel)** *(durability ~3.3 — solves our worst gap: distribution)*
- **One-liner:** Admin surface for bootcamps/career centers: cohort readiness in aggregate (signal distribution, veto rates, weakest competencies, confidence slope), push required mocks as tasks, anonymized trajectories vs. cohort median.
- **Defensibility thesis:** This is the distribution + switching-cost moat the research flags as our biggest current gap (no SEO, no enterprise channel). Once an instructor's grading depends on it, the institution can't casually swap to "just use ChatGPT" — there's no cohort-level calibrated readiness rollup in a general assistant. Yoodli's escape *into* enterprise L&D confirms this is where defensible voice-coaching revenue lives.
- **Moat type:** workflow-lockin → (reframed) credential-trust + outcome-proof.
- **Builds on:** existing aggregations over PanelVerdict/DimensionScore. **Reframe:** don't sell a dashboard — sell a **placement-outcome instrument**. Tie confidence-slope/veto trajectory to the cohort's *real placement results* via the school's placement team ("students hitting Strong-Signal on 3+ React panels by week 3 placed at 2.4x"). Career centers live or die on reported placement rates — make Aloud the instrument that measures and improves *their existential KPI*, and "just use ChatGPT" becomes a non-starter for the *buyer*. **Anchor percentiles to the fixed Bar-Raiser rubric, not a phantom cross-user curve** (works cold; corpus tightens it later).

**B4. Prep-Cycle Memory & Application Tracker (interview system-of-record)** *(durability 3)*
- **One-liner:** Aloud becomes the durable home for the whole multi-month, multi-company search — a per-application ledger (company, level, JD, recruiter, stage applied→onsite→offer) where each stage links to the prep sessions/verdicts done for it and the eventual real outcome. Replaces the spreadsheet/Notion board.
- **Defensibility thesis:** "I'll lose months of accumulated prep context" is NFX's strong switching-cost test. The conversation inside each session can be GPT-7; the *ledger and its accumulated outcome links* are sticky. System-of-record beats data scale.
- **Moat type:** workflow-lockin → outcome-proof.
- **Builds on:** generalizes the single `User.interviewDate`/`targetCompanies` into a per-application model. **Reframe:** the ledger is the *capture funnel for outcome-proof*, not the moat — "Aloud is the only prep tool that knows whether its advice was right." **Kill manual entry** (ingest from Gmail/calendar via OAuth so stages auto-advance) — a tracker nobody maintains has zero switching cost, so the integration is *existential*, not nice-to-have. This is also the natural home for the A1 outcome label.

### TIER C — STRUCTURAL BETS (network, credential, B2B — the durability-5 attempts)

High-ceiling, slow-igniting. **Every one of these must be sequenced behind a *validated* verdict (A1 data), and seeded single-sided to beat cold-start.** A referral network on a product that still cuts the interviewer off mid-sentence is worth nothing.

**C1. Recruiter-Verifiable Readiness Card** *(durability 3.3 → the bridge from artifact to credential)*
- **One-liner:** Evolve the Signal-card PNG into an outcome-backed, provenance-bound credential the candidate attaches to applications — overallSignal, veto status, verified-attempt ID, judge version, "proctored" badge when earned — that dereferences to a public Verified Attempt page where a recruiter confirms authenticity and sees published calibration.
- **Defensibility thesis:** The value is not the image — it's that it dereferences to a *verifiable, calibrated, provenance-bound record* backed by accumulated outcome validation. A lab won't issue a pointed "this candidate reads SDE_II, no veto" credential (usage policy steers away from employment-impact claims). Stays candidate-side of the AEDT/LL-144 perimeter (candidate chooses to share; Aloud issues no hiring decision).
- **Moat type:** credential-trust + outcome-proof.
- **Reframe:** **until the A1 outcome corpus exists, ship it as "Verified Attempt" (provenance + evidence quotes — all real, model-independent) and WITHHOLD the pass-rate claim.** Selling a calibration you can't back destroys the trust the whole moat depends on. The headline becomes an *evidence packet a recruiter can interrogate* (transcript + evidence quotes + drill completed), with our signal demoted to one auditable, version-pinned opinion — which also widens the LL-144 moat ("here is auditable evidence, you decide" is defensibly *not* an automated employment decision).

**C2. Verified Ex-FAANG Panel Authoring (Calibration Council, not open marketplace)** *(durability 4)*
- **One-liner:** Recruit 5–10 verified ex-FAANG interviewers as paid design partners to author flagship company-calibrated panels; each candidate run feeds anonymized signal distributions back to the author, who re-tunes difficulty so the panel *converges toward the real loop's pass bar*.
- **Defensibility thesis:** A model can generate "act as a Stripe interviewer," but cannot manufacture the *verified-human supply side* or the *trust badge* that makes a candidate believe the panel reflects the real bar. This is interviewing.io's documented moat (proprietary interviewer corpus + relationships) applied to authoring — relationship/trust capital orthogonal to model quality.
- **Moat type:** credential-trust → data-flywheel.
- **Reframe:** invert sequencing — **hand-curated Calibration Council, not a public marketplace.** Make the defensible asset the *calibration data* ("candidates who scored SENIOR on our calibrated Stripe panel passed the real loop at X%"), not the badge. Defang legal risk: drop verbatim company-internal questions and trademarked loop names; brand "Frontend Staff loop, calibrated by ex-Stripe engineers" (competency-keyed, not company-keyed). The frozen central scorer (already built) lets us open authoring *without letting a contributor poison judgment* — "experts shape the questions, Aloud owns the bar."

**C3. Calibration Pinning & Drift Certificate + Continuous Eval Harness** *(durability ~3.3, but the anti-commoditization keystone)*
- **One-liner:** Keep the committee judge pinned; on every judge upgrade, re-score a frozen human-labeled gold set, compute the offset, re-anchor thresholds, and publish a drift report. The internal eval harness gates any model rotation like CI; the public certificate is the artifact.
- **Defensibility thesis:** Frontier upgrades are *the* threat to a naive scorer. We turn the upgrade into a trust-building event — the proprietary transcript+outcome corpus recalibrates any new model, which a competitor cannot do without the same labeled corpus. The faster models change, the more load-bearing the harness becomes.
- **Moat type:** credential-trust + outcome-proof.
- **Reframe:** **anchor the gold set to real OUTCOMES, not to the previous model** (otherwise "96% agreement with our prior judge" is circular). Recruit a small panel of real Bar Raisers to label N frozen transcripts *once* — credentialed human judgment frozen in amber. Then the certificate says "our SDE_II threshold still predicts real-world SDE_II outcomes at X% AUC after gpt-4o→gpt-X" — the version OpenAI structurally cannot ship. Add a `JudgeCalibration` table; FK every PanelVerdict to it, turning `judgeModel` from a log line into an auditable contract.

**C4. The two-sided employer surfaces (Verified-Readiness Pool / Recruiter-Authored Challenge Loops / Referral Loop)** *(durability ~3.7 — deferred, dependency-ordered)*
- **One-liner:** Candidates expose a signed readiness card to a recruiter-facing pool; recruiters post time-boxed challenges for open reqs; cleared candidates earn warm intros — and the real-interview *outcome flows back as the strongest calibration label*.
- **Defensibility thesis:** Warm-intro liquidity + the referrer/employer graph are pure network assets no model upgrade grants. The labs sell tokens, not warm intros, and are legally allergic to brokering employment.
- **Moat type:** network-effect (built on credential-trust + outcome-proof).
- **Reframe & hard sequencing rule:** **Do NOT lead with the pool/marketplace — that's a double cold-start you cannot bootstrap at zero users, with adverse-selection risk.** Lead with the *outcome-label acquisition engine*: sign ONE design-partner recruiter/bootcamp, get even 50–100 real outcome labels, publish a single validated number ("candidates who clear the Aloud React panel are Nx more likely to pass the real onsite"). Only *after* the verdict is statistically credible do you open the referrer pool — now the "why this candidate cleared our bar" card is backed by predictive validity, not vibes. **This entire tier is gated behind the un-passed live-test milestone.**

**C5. Human-Coach Marketplace on Gap Diagnosis** *(durability ~3.7 — deferred)*
- **One-liner:** When a candidate stalls on the same gap, route a warm handoff to a vetted coach matched to that gap, with full longitudinal context pre-loaded; the before/after panel delta ranks coaches.
- **Defensibility thesis:** The coach-effectiveness *ranking* (measured before/after deltas on our rubric) is closed-loop outcome data competitors can't scrape.
- **Moat type:** outcome-proof + network-effect.
- **Reframe:** **wire the loop with NO humans first** — route a vetoed candidate's re-attempt through the panel to populate `resultSessionId` and prove the diagnosis is even predictive. Seed supply from your own funnel (STRONG_HIRE users become first coaches). The moat is the *ranking* (computed on your panel, your rubric — un-scrapeable), not the booking. **Defer until the panel itself has PMF and real volume.**

---

## 4. The compounding flywheel

The chosen features are not a list — they are one loop, and each turn makes the next cheaper and the moat wider:

```
  Live adversarial panel (sensor)
            │  produces a verdict + per-turn disfluency + per-competency signal
            ▼
  Evidence-Anchored Audit Trail (A3)  ──►  verdict is contestable, reproducible, version-pinned
            │                                   → disputes feed a human-review label corpus
            ▼
  Outcome Capture (A1)  ──►  bind prediction to real round/offer result
            │                    → the ONLY label a lab can't manufacture
            ▼
  Calibration (C3)  ──►  gold set + drift cert re-anchor the score to OUTCOMES
            │                → "SDE_II means the same thing across model upgrades"
            ▼
  Trust  ──►  Readiness Card (C1) + published calibration become credible
            │      → recruiters/bootcamps start to rely on the verdict
            ▼
  Network (B3 cohorts, C4 employer pool, C5 coaches)
            │      → each employer makes the card more worth earning;
            │         each candidate makes the pool more worth sourcing
            ▼
  More real outcomes flow back  ──►  denser corpus, tighter calibration, sharper drill routing (B1)
            │
            └──────────────►  (loop tightens; gap becomes prohibitive to cross)
```

The narrative: **Data → Calibration → Trust → Network → Outcomes → more Data.** The audit trail makes the verdict *defensible*; outcome capture makes it *true*; calibration makes it *stable across model churn*; trust makes the credential *portable*; the network makes the credential *valuable and self-reinforcing*; and the network's real-interview results are the densest outcome labels, which re-enter at the top. Every loop turn is a proprietary training signal that is impossible to scrape and that a stateless general assistant has neither the mechanism nor the incentive to accumulate. This is the difference between a static data pile (erodes as it grows) and a living feedback loop (the only durable variant). **Crucially, a better base model is a tailwind at every node** — it sharpens scores (complementary), and it forces a re-calibration event that *demonstrates* our credential survived churn.

---

## 5. Sequencing recommendation (next 2–3 increments)

Constraints in force: small team, single t3.micro EC2, BYOK/transcript-only cost posture, **pivot to React/JS not yet live-tested**, zero users. The binding constraint is not features — it's that **the clock on the only real moat (the outcome corpus) hasn't started, and the core experience isn't validated yet.**

**Increment 0 — Earn the right (BLOCKING, do this first).**
Per the live-test pivot in memory: fix the handoff audio-cutoff, surface the buried PTT button, run the React/JS panel design pass, and **live-test it.** Nothing in Tiers B/C is worth a line of code until a candidate can complete a panel without the interviewer getting cut off. A marketplace on a broken panel is worth nothing.

**Increment 1 — Start the clock (Tier A, data + trust substrate).**
1. **A1 Outcome Capture** — one field/table; the single most important instrumented event. Make logging the real result the price of the next drill plan (B4 hook).
2. **A3 Audit Trail + dispute queue** — ship the flag→human-review queue (not just the existing substring filter); store rubricVersion + ruleHash on every verdict.
3. **A2 Trajectory view** — pure read over existing data; confidence-banded, gated at N≥6 sessions.
4. **A4 Before/After Reel** wired as the resolution of a DrillAssignment challenge.

This costs almost no new infra (fits the t3.micro / transcript-only posture — outcome labels and rubric versions are tiny rows), and it directly reconciles the research's flagged tension: *our data-moat thesis is in conflict with our transcript-only/stateless cost posture.* Resolve it by capturing the *cheap, high-value* rows (outcomes, versions, disputes), not by paying to store all audio.

**Increment 2 — Compound + distribute (Tier B).**
5. **B1** — wire the dead `resultSessionId` loop, expert-prior routing first.
6. **B2 Reels** — the viral wedge, on the *deterministic* veto-survival claim only (no percentile leaderboard yet).
7. **B3 Cohort dashboard** — pursue ONE bootcamp design partner; this is our distribution answer and our first dense source of *real placement outcomes*.

**Increment 3 — Structural (Tier C, gated on a validated verdict).**
8. **C3 Calibration/drift cert** once enough outcome labels exist to anchor the gold set to outcomes.
9. **C1 Readiness Card** — "Verified Attempt" first, pass-rate claim only after C3.
10. **C2 Calibration Council** — 5–10 ex-FAANG authors.

**Deliberately DEFER (and say so out loud):**
- **C4 employer pool / req marketplace / referral loop** — until a *validated* verdict exists (gated on A1 data + C3). Double cold-start; do not attempt at zero users.
- **C5 coach marketplace** — until the panel has PMF and volume.
- **Normative cross-user percentile bands** — until cells are dense; ship criterion-referenced ("Held SDE_II under 3 follow-ups") instead, which is honest at N=1.
- **Multi-scenario expansion (Amazon LP seats), BYOK provider switching, proctored mode, multi-model panel** — all explicitly deferred. Stay narrow on React/JS (the "focus" advantage); depth of calibration on *one* stack beats breadth.

---

## 6. Risks & open questions (the honest ones)

**1. Cold-start data problem — the existential one.** The entire moat is the outcome corpus, and at zero users it doesn't exist; the clock hasn't started. Self-reported outcomes are sparse, slow (per offer = years to densify a cell), and survivorship-biased. *Mitigations, in order of leverage:* (a) shift the unit of proof to *round-level* outcomes (days, not years); (b) the ONE bootcamp/recruiter design partner is the fastest path to dense, corroborated labels — treat closing it as a P0 GTM task, not a "later"; (c) any corroborating signal (forwarded offer/rejection email, recruiter scheduling, LinkedIn title change) fights self-report gaming. **Open question:** can we get to ~50–100 corroborated labels in a single React-SDE_II cell within two increments? If not, the whole Tier-C trust story slips.

**2. BYOK adoption / consumer funnel friction.** Asking a nervous candidate to create and paste a frontier API key is brutal onboarding vs. a logged-in ChatGPT user. BYOK is a B2B/dev pattern, not a consumer one. **Open question:** is BYOK actually right for the consumer funnel, or should we eat the inference cost for the consumer tier (subsidized, capped) and reserve BYOK for B2B2C cohorts where the institution pays? Lean: **eat the cost for individuals, BYOK/seat-billed for B2B2C.** Needs a unit-economics check against the spend ceilings.

**3. STT bias — liability AND moat.** Whisper has systematically higher WER for non-native/accented English; our fluency metrics derive from Whisper word timings, so they will *penalize accented candidates* unless corrected. This is both a fairness liability and — done right — a trust differentiator labs won't prioritize for a niche. **But:** the "accent-fair layer" as currently conceived is vaporware, and the *raw metric* (filler/pause math + a one-flag word-timestamp request) is commodity. The *real* seed is a per-accent baseline + transcript-repair-before-metrics + opt-in accent calibration, validated and published as a fairness credential. **Open question:** is this Increment-2 hardening (we *must* not ship accent-biased percentiles publicly), or a later credential play? Lean: **harden enough to avoid public harm in Increment 2; pursue the credential later.**

**4. Will employers ever trust a candidate-side credential?** Honest answer: **uncertain, and not for a while.** Recruiters don't trust a vendor-issued, self-selected, take-as-many-as-you-want mock score (selection bias destroys it the moment they ask "how many attempts?"). interviewing.io earned trust through *real human interviewers + employer fast-tracking*; Karat through an employer-side two-sided business — neither is a thing we can copy as a consumer tool. *Mitigations:* (a) bind freshness + multi-session-variance + un-retakeable adversarial drills into the signed card (a verdict that says "held SENIOR across 3 distinct unseen drills in 30 days" is far harder to game than best-of-N); (b) lead with *published calibration validity*, not authority; (c) keep the regulatory perimeter clean — candidate-owned evidence the candidate *chooses* to share, never an Aloud-pushed ranked gate (the moment we issue an employer-used screening decision, we become an AEDT under LL-144/Colorado and inherit bias-audit obligations). **Open question:** is the realistic ceiling here "a useful signal a recruiter weights" rather than "a trusted credential"? Plan for the former; the latter is a multi-year, relationship-heavy bet contingent on the corpus.

**5. The platform-distribution wildcard.** ChatGPT Apps SDK could be top-of-funnel — but partners report little traffic and surrendering the user relationship is risky. **Stance:** treat a ChatGPT app as *acquisition top-of-funnel only*; never host the scored experience or the longitudinal data asset inside it.

**6. Does the "labs won't build this" thesis hold?** Mostly, but with a caveat: labs *are* climbing into rich verticals (OpenAI/Claude for Healthcare, Jan 2026). SWE behavioral prep is a small-enough TAM that a *dedicated* lab product is unlikely — but they *will* ship generic "interview practice" inside the assistant. **So we cannot rely on the absence of a generic capability.** We win on calibration, outcomes, longitudinal depth, and the credential/network — the assembly work labs won't bother to do for one niche — not on the conversation existing.

---

**Bottom line:** Stop selling the conversation; we rent that from the people who will always do it better. Build the one thing they structurally won't — a calibrated, contestable, outcome-validated hiring signal and the durable system-of-record for a candidate's readiness — and instrument the outcome loop *now*, because the moat is a corpus that takes 12–24 months to compound and the clock hasn't started. Fix the panel, capture the outcome, prove the calibration, then let the network and the credential ride every model upgrade as a tailwind.

---

## Appendix — Killed features (commoditizable / thin wrapper)

These failed the adversarial filter (majority of 3 skeptic judges rated them high-replaceability, thin-wrapper, or low-durability):

1. Normative Cross-User Percentile Bands (version-normalized) — *honest only at scale; ship criterion-referenced instead*
2. Resilience-Under-Pressure Signal (recovery slope as a trainable competency) — *raw signal commoditizing; only survives fused to outcomes*
3. Outcome-Tuned Gap-Targeted Question Generation — *gen is commodity; the targeting needs the corpus that doesn't exist yet*
4. Company-and-Level Pattern Library (pre-session process intelligence) — *scrapeable; labs summarize it free*
5. Graduation Gate (honest go/no-go before the real loop) — *just the verdict re-skinned; no new moat*
6. Calendar-Synced Cram Sessions ("interview tomorrow at Stripe") — *canonical assistant+calendar demo*
7. Resume + JD-Aware Panel Configuration — *long-context demo; free*
8. Recruiter Update Inbox (Gmail-triggered prep) — *agent+inbox is a commoditizing pattern*
9. Verified Attempt (provenance-bound record) — *folded into C1 as the first shippable step*
10. Proctored Mode (anti-cheat live attempt) — *defeated by a second device; false-positive risk*
11. Accent-Fair Disfluency Fluency Layer (as a built moat today) — *vaporware as pitched; real seed noted in §6 risk 3*
12. BYOK Frontier-Model Passthrough for the Live Panel — *cost posture, not a barrier to entry*
13. Multi-Model Adversarial Panel (each seat a different lab) — *correlated models = redundant reads; unvalidated*
14. Provider-Agnostic Judgment Adapter Behind a Frozen Scoring Contract — *ops hygiene; lowers everyone's switching cost equally*

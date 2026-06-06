# MEMO: How Aloud Detects Confidence, Tone & Fluency from Voice

**To:** Founder / Eng
**From:** Head of Speech/ML
**Re:** The engineering + strategy path to a defensible "how confident did this candidate sound" signal in the END report
**Date:** 2026-06-06

> Produced by a research+verify+critique workflow (`aloud-confidence-detection-research`, 23 agents):
> code grounding → 6 parallel web-research lenses (the acoustic science, OSS tools, commercial
> APIs, fast architecture, validation+bias, the research frontier) → 13 adversarial fact-checks →
> a completeness/novelty critic that read the actual codebase. The critic overturned three
> research claims by checking the code — those corrections are baked into this memo.

---

## TL;DR (act on this)

1. **Do NOT buy an emotion/confidence API and do NOT build a Praat/openSMILE prosody sidecar for v1** — the category-leading prosody API (Hume Expression Measurement) shuts off June 14, 2026, every other off-the-shelf tool outputs *emotion or sentiment, never "confidence,"* and the acoustic-sidecar plan is blocked by a fact the research missed: **your per-answer upload is opus/webm, there is no ffmpeg, no Python, and no sidecar on the box.**
2. **You already shipped ~40% of the right answer:** `computeComposure()` in `packages/coach-core/src/panel-composition.ts` already scores *within-session variability* (filler-per-100w 45% + WPM coefficient-of-variation 35% + pause-control CV 20%), which is structurally accent-fairer than any absolute-pitch model.
3. **Phase 1 (ship in days):** add a mandatory **low-stakes warmup answer as a personal calm baseline**, report every adversarial answer as a **delta from that baseline** on metrics you *already compute from Whisper timings*, and insert **LLM transcript-repair** between Whisper and `analyzeSpeech()` — the single highest-ROI fairness fix (verified to cut the non-native WER penalty from 11.0pp to a non-significant 1.7pp).
4. **The genuinely novel, defensible core is not "detect confidence from voice"** (a commodity the frontier realtime models will absorb) — it is a **self-baselined, accent-robust-by-construction delivery delta that you calibrate against real round-level interview outcomes only you hold.** That data loop is the moat; the acoustic extractor is not.
5. **The existential risk** is shipping a numeric `confidence: 62%` that is simultaneously **uncalibrated** (you have zero outcome data today — no `Outcome` model exists) and **accent-biased** (your metrics derive from Whisper, which mis-transcribes ~44% of disfluencies for non-native speech) — attached to a shareable credential, that inverts your entire anti-anxiety thesis. Report within-speaker deltas, never cross-person rankings, and withhold any absolute confidence number until it's outcome-calibrated.

---

## 1. What confidence actually sounds like

### Plain words

An interviewer reads you as **confident** when you sound **steady, fluent, and decisive**: you start answering without a long stall, you don't pepper the answer with "um/uh," your pace is even (not racing, not crawling), your volume is stable, and your sentences *land* — they fall at the end instead of trailing up into a question. You read as **anxious/under-confident** when the opposite happens: long stalls before you start, frequent fillers and false starts, an erratic or sprinting pace, shaky/dropping volume, and uptalk (rising "...is that right?" intonation on statements).

### The critical distinction: perceived ≠ felt ≠ accurate

Three different things hide under "confidence," and conflating them is the #1 way to build the wrong product:

- **Perceived confidence** — how an interviewer *judges* you. **This is the only thing Aloud should optimize.** It's decodable, it's what gets you hired, and it's coachable.
- **Felt confidence** — your internal state. It leaks into prosody even with no audience (so the signal is real, not just performance), but it's not what you're selling.
- **Accuracy** — whether the answer is *correct*. Goupil & Aucouturier (2021, *Cognition*) — **verified** — showed accuracy is decodable from prosody alone at only ~60% (barely above chance). **Vocal confidence does NOT certify correctness. Never imply it does.**

### The measurable feature set, and effect directions

| Signal | Direction that reads as MORE confident | Reliability | Available in Aloud today? |
|---|---|---|---|
| **Filled pauses** (um/uh) | Fewer | **High** — most replicated | Yes (`fillerCount`) |
| **Silent pauses** | Fewer, shorter, more regular | **High**; silent-pause *ratio* is a stronger uncertainty cue than raw count | Partial (`pauseCount`, `avgPauseMs`, `longestPauseMs`) — ratio not surfaced |
| **Speech rate (WPM)** | Moderate, *steady* — **inverted-U, not "faster is better"** | High for steadiness; medium for absolute rate | Yes (`wpm`, and WPM-CV in composure) |
| **Loudness / intensity** | Stable, controlled (not maximal); erratic/low intensity = anxiety signature | **High** (intensity is among the most reliable acoustic cues) | **No** (needs audio DSP) |
| **Terminal intonation** | **Falling**, not rising/uptalk | Medium-High | **No** (needs pitch contour) |
| **Pitch variability** | Moderate & controlled; *monotone* reads flat/tense, *erratic* reads anxious | Medium | **No** |
| **Response latency** (first-word onset) | Shorter | High in theory — **but UNMEASURABLE in your current architecture** (see §7) | No |
| **Mean pitch (absolute F0)** | **DO NOT COACH THIS** | — | — |

### Resolving the ambiguities the research flagged

- **Mean pitch direction conflicts by gender and context. Do not hardcode a pitch target.** Jiang & Pell (2018, perception study, **verified**) found lower mean F0 read as more confident in connected speech, but the trustworthiness literature shows the direction flips by context and gender (lower-pitched *female* voices can read more authoritative; higher pitch can raise trust elsewhere). **Coach pitch *stability* and *falling sentence-final contour*, never "raise/lower your voice."** This is also a fairness win: Goupil 2021 (Nature Comms) found **mean pitch alone does NOT predict perceived certainty** while contour shape, onset intensity, rate, and *variability* do — so a confidence model built on dynamics-not-absolutes is accent/gender-robust *by construction*.

- **The duration contradiction is real and UNRESOLVED — do not ship a duration-direction coaching cue until you validate in-domain.** Goupil (isolated *words*) found confident = *longer*; Jiang & Pell (*connected speech*) found perceived-confident = *shorter/faster*. Interview answers are connected speech but contain legitimate *thinking* pauses. **Shipping the wrong sign actively misadvises candidates.** Treat duration/rate as steadiness-only (CV) until a small in-domain validation resolves the sign.

- **Voice-quality source features (jitter, shimmer, HNR) are inconsistent — deprioritize.** The 2025 PLOS ONE systematic review (**verified**) found "no consistent trends" for these. *Correction to the research:* the same review credits **F0 and intensity** as most reliable and calls *speech-rate/duration heterogeneous* — so "temporal markers are the most reliable" is an overstatement; the cleaner claim is **fillers + intensity + pause regularity are your best bets, absolute rate is noisier.** The social-anxiety ML model that hit 75.6% / 0.83 AUC is a **2022** paper (not 2025) and leaned heavily on **intensity** (low mean intensity, η²=.05) plus temporal cues.

---

## 2. Build-vs-buy landscape

**Bottom line: there is nothing to buy that outputs "confidence." Build it from features you control.**

### Commercial APIs

| Tool | Gives "confidence"? | Latency | Cost | Privacy | Bias | Verdict |
|---|---|---|---|---|---|---|
| **Hume Expression Measurement (prosody)** | No (48 emotions incl. doubt/anxiety; no "confidence") | Stream/batch | $0.064/min | Audio → 3rd party (violates BYOK) | SER bias | **DEAD — sunset June 14, 2026 (verified). Do not build on it.** |
| **audEERING devAIce** | No (V/A/D + categorical) | Real-time on-device | Enterprise, no public pricing | On-device (good) | Not fair across speakers (vendor admits) | **Skip** — procurement friction, no self-serve, no confidence axis |
| **Azure / Google / AWS / Deepgram / AssemblyAI / Speechmatics / Symbl** | No — **text sentiment only** (pos/neu/neg) | Real-time | Per-min | Audio → 3rd party | English-only sentiment | **No.** *Correction:* AWS Chime voice-tone does use acoustic features (not text-only), but still emits 3-bucket tone, not confidence. None is a confidence source. |

### Pretrained SER models (open)

| Model | License | Gives "confidence"? | Notes | Verdict |
|---|---|---|---|---|
| **emotion2vec+** (base ~90M / large ~300M) | **MIT** ✅ | No (9 emotions) | Best commercial-safe SER; strong with a linear head; **not packaged for transformers.js** (export issue open, verified) → server-side only | **Defer to Tier-2** |
| **SpeechBrain wav2vec2-IEMOCAP** | **Apache-2.0** ✅ | No (4 emotions) | 78.7% IEMOCAP, lab-acted → weak real-interview transfer; not browser-ported | Defer |
| **audEERING wav2vec2 V/A/D**, **autrainer big4** | **CC BY-NC-SA** ❌ | No | SOTA valence but **non-commercial — blocked for Aloud** (MSP-Podcast is academic) | **Blocked** |
| **Vox-Profile** | Code on GitHub (verify repo license) | **Yes — models "confidence/hesitancy/fluency" as distinct traits** | The one keystone to *fork* if you go neural; WavLM/emotion2vec backbones, server-side | **Tier-2 fork candidate** |

### OSS feature extractors (you compute features yourself)

| Tool | License | What it gives | Blocker | Verdict |
|---|---|---|---|---|
| **Whisper word timings (current) + coach-core** | Permissive | WPM, pauses, fillers, speaking ratio | None — **already shipped** | **Tier-1 foundation** |
| **librosa** | ISC ✅ | RMS/energy, spectral, tempo | Needs Python + decoded PCM | Tier-2 |
| **Parselmouth (Praat)** | GPL-3.0 (run as isolated process) | F0, jitter/shimmer/HNR, intensity, contour | **Needs Python sidecar + ffmpeg decode (opus→PCM) — neither exists on the box** | Tier-2, infra-gated |
| **openSMILE eGeMAPS** | Source-available, **commercial license needed** | 88 acoustic features | Same Python+ffmpeg blocker; commercial license | Tier-2, infra+license-gated |
| **CrisperWhisper** | **CC BY-NC ❌** (verified — non-commercial) | Verbatim ASR keeping fillers, F1 0.90 disfluency | **Cannot ship commercially** | **Blocked — keep your Whisper-timing heuristic as the commercial-safe baseline** |
| **Meyda** (browser) | MIT ✅ | RMS, ZCR, spectral in-browser | Browser-side only | Tier-2 cheap-add |

**Decisions:** Buy nothing for the core. Keep Whisper. Do **not** adopt CrisperWhisper (NC) or openSMILE (commercial license). Treat emotion2vec+/Vox-Profile/Parselmouth as a deferrable Tier-2 that must earn its keep *after* infra justifies it.

---

## 3. Recommended architecture (fast)

**The key insight: report-only kills real-time.** There is no live meter (per DEFENSIBILITY_PLAN). Analysis runs **once per push-to-talk answer** (~10–60s audio) and only needs to exist by the END report. That converts a 16.7ms/frame problem into a **multi-second-per-answer batch budget** — the single biggest latency win. **Do not build streaming infra.**

### Where each computation runs

**Tier 0 — Do nothing live.** No live confidence bar. Batch on "Done." This matches the existing upload trigger (`use-mock-panel.ts` ~line 664 → `api.uploadTurnAudio()`).

**Tier 1 (BUILD THIS NOW) — Server-side, transcript/timing-only, at the existing seam.**
- **Seam:** `src/app/api/mock/sessions/[id]/turns/audio/route.ts` line 88, right where `analyzeSpeech({ words, turnDurationSec })` already runs after `transcribeAudio()`.
- **Add, in order:**
  1. **LLM transcript-repair** (one `gpt-4o-mini` call on the raw Whisper transcript) *before* computing timing metrics — keep both raw + repaired; use repaired only for the metric denominators (filler/word counts).
  2. **Surface silent-pause ratio** in `speech-analysis.ts` (you already have the pause data — just compute `totalSilentMs / turnDurationSec`).
  3. **Extend filler detection** to multi-word ("you know", "sort of", "I mean") and false-start/repair patterns.
- **Latency:** all transcript/timing math is microseconds; the only added cost is the one LLM-repair call (~100–150 tokens, well inside the 30s route timeout, non-blocking/best-effort like the existing upload).
- **No new deps, no ffmpeg, no Python, no audio-format problem.** This is the whole point of starting transcript-only.

**Tier 2 (cheap, optional) — Browser AudioWorklet + Meyda (MIT).** During the PTT window, on a dedicated audio thread (zero main-thread jank, audio never leaves browser), compute **RMS-energy stability** and **pitch variance**, ship as a small JSON field alongside the turn (extend the upload payload, or piggyback the turn queue). This gets you the *intensity-stability* signal (one of the most reliable cues) **without ffmpeg/Python/opus-decode**, because the browser has the raw PCM live. Use as redundancy; server is source of truth.

**Tier 3 (DEFER until infra is justified) — Acoustic prosody sidecar.** *Only* if Tier 1+2 prove insufficient against outcome data. Honest cost the research understated: this needs **ffmpeg (opus/webm → PCM decode) + a Python runtime + a Parselmouth/openSMILE sidecar process + IPC + Dockerfile/container changes on a 1 GiB t3.micro.** RTF is ~1s/answer (verified) but that ignores decode + process-spawn overhead. Run Praat as an isolated subprocess (GPL hygiene). Skip in-browser neural SER entirely (verified: ~95–190MB download, WASM only seconds/answer, WebGPU only ~70–75% mobile / Safari iOS 26+, accuracy ~0.65 with accent bias).

**Storage:** write per-turn metrics to `MockTurn.metricsJson` (already there). Populate the existing-but-currently-NULL `ConfidenceMetric.resilience` / `selfEfficacy` fields rather than touching the **FROZEN** `computeComposure()` weights. Aggregate in `panel-orchestrator.ts` (~line 172/176) into `reportJson`. Extend `mockReportSchema` (`packages/shared-types/src/mock-schemas.ts` ~line 199) and render in `mock-report-view.tsx` (which already has a "How you held up" section).

---

## 4. The novel, defensible system

### What is NOT novel (be honest)

emotion2vec, Parselmouth, openSMILE, Vox-Profile, LLM-judges, transcript-repair, within-speaker normalization — **all exist in the literature.** Fusing them is *recombination, not invention.* "Detect confidence from voice" is a commodity, and frontier realtime models (GPT-4o-realtime, Gemini Live) already "hear" tone natively — they will absorb generic prosody scoring. Do not stake the company on the extractor.

### What IS genuinely not-done-before (and small enough to build)

**A within-speaker-baselined, accent-robust-by-construction delivery-confidence DELTA, calibrated to real round-level interview outcomes only Aloud holds.**

The four ingredients, each load-bearing:

1. **Self-as-control baseline.** Make the candidate give one **low-stakes warmup answer** at the start. Compute their *personal calm baseline* on the Tier-1 metrics. Score every adversarial answer as a **delta from their own warmup** — not against a population. *No shipped competitor (Yoodli, Poised, Orai) does this; Google Interview Warmup and Hume's API are both gone.* **~40% of this already exists** — `computeComposure()` already uses within-session CV (speaker-relative), so the delta is the *missing anchor*, not a from-scratch build.

2. **Accent/gender-robust feature set.** Score only on features deliberately chosen to *exclude absolute pitch* (Goupil 2021: mean pitch does NOT predict perceived certainty; contour/variability/onset-energy/rate do). Combined with the self-baseline, **each speaker is their own control**, which structurally neutralizes accent/gender bias — the fairest possible design.

3. **Multimodal fusion** (Tier-2): prosody deltas + the existing timing/disfluency metrics + **lexical hedging detection** from the transcript ("maybe," "I think," "I'm not sure," "sort of") — Murzaku et al. (Interspeech 2024) showed fusion beats audio-only or text-only for *certainty/commitment*, which is confidence proper.

4. **Outcome calibration — the actual moat.** An LLM-judge emits a perceived-confidence read + rationale; a tiny quantitative-judge (GLM/Bradley-Terry) calibrates it to Aloud's accumulating **(answer-features → next-round-result)** corpus. This is the DEFENSIBILITY_PLAN A1 thesis applied to prosody.

**The novelty lives in the data loop and the self-as-control framing, not in any acoustic extractor.** That is exactly why it's defensible: a competitor can rent the same models; they cannot rent your outcome-validated, self-baselined corpus.

**Honest caveat:** ingredient #4 is **structurally unavailable today** — there is **no `Outcome` model, no `nextRoundResult` field** in `prisma/schema.prisma` (confirmed). At launch the calibrator degenerates to an uncalibrated LLM opinion. It becomes trainable only after A1 outcome-capture ships and ~50–100 corroborated labels accrue. **Ship the self-baseline now; the calibration compounds later.**

---

## 5. Bias & fairness (non-negotiable)

**Magnitude of the risk (verified/documented):** Whisper WER is materially higher for non-native and tone-language accents; African-American English ~35% WER vs ~19% white American; only ~56% of disfluencies are correctly transcribed for L2 speech (so ~44% mis-handled). Because your filler/pause/WPM metrics derive from Whisper word timings, **accent-driven ASR errors inflate "filler" and "pause" penalties for non-native speakers even at equal delivery** — the exact failure mode in the live ACLU/EEOC HireVue-Intuit complaint. SER models add independent gender gaps (up to 29% F1 per emotion).

**Mandatory mitigations (in priority order):**
1. **Within-speaker baselining** (the warmup delta) — each speaker is their own control. Primary defense.
2. **LLM transcript-repair before any metric** — **verified** to cut the non-native WER penalty from β=11.0pp to a non-significant 1.7pp (p=0.057), npj Digital Medicine 2026. *Honest caveat: small clinical-speech pilot on scripted text; 1.7pp is a point estimate that didn't reach significance, not proven elimination. Still the highest-ROI single fix.*
3. **Detect non-native/high-disfluency speech → widen tolerance or suppress the filler/pause penalty.**
4. **Never rank candidates cross-person.** Report within-session deltas/trends only.
5. **Withhold any absolute confidence number** until calibrated against real outcomes, with a 4/5ths adverse-impact audit across accent/gender/age.

**What NOT to ship publicly:** Do **not** put an absolute acoustic "confidence" number on the shareable Verified Attempt credential (C1). Surfacing a voice-derived confidence score to a recruiter **re-imports the AEDT / NYC LL-144 risk the plan worked to avoid by staying candidate-side** — and voice is the exact modality under active litigation. Keep the confidence read **candidate-facing, framed as self-relative coaching**, off the credential.

**Framing (non-negotiable):** every metric is *"how an interviewer is likely to PERCEIVE your delivery, relative to your own calm baseline"* — never a competence or correctness verdict.

---

## 6. Phased roadmap

**Gating:** Per the project's own constraint, nothing ships until the React/JS panel handoff + PTT flow is live-validated (Increment 0).

### Phase 1 — Real confidence signal in the report, mostly from what exists (days, not weeks)
- **Files/seams:**
  - `src/app/api/mock/sessions/[id]/turns/audio/route.ts` line 88 — add **LLM transcript-repair** (gpt-4o-mini) before `analyzeSpeech()`.
  - `packages/coach-core/src/speech-analysis.ts` — surface **silent-pause ratio**; extend **multi-word filler / false-start** detection; add **lexical hedging** count.
  - **Add a mandatory warmup answer** in the panel flow (`use-mock-panel.ts`); compute personal baseline; score adversarial answers as **deltas**.
  - Populate `ConfidenceMetric.resilience` / `selfEfficacy` (`panel-orchestrator.ts` ~line 172/176) — **do not touch FROZEN `computeComposure()`**.
  - Extend `mockReportSchema` (`mock-schemas.ts` ~line 199); render delta-framed in `mock-report-view.tsx`.
- **Output:** "Relative to your own warmup, your fillers rose 40% and your pace got choppier under the Bar Raiser's follow-ups." Evidence-anchored per turn. No absolute score. No new infra.

### Phase 2 — Acoustic enrichment + fusion (weeks, infra-gated)
- **Cheap path first:** Tier-2 browser AudioWorklet + Meyda for **intensity stability + pitch variance** (no ffmpeg/Python).
- **If justified:** stand up the Python/ffmpeg/Parselmouth sidecar for falling-vs-rising terminal contour + intensity, OR fork **Vox-Profile** (server-side) for confidence/hesitancy traits.
- Fuse prosody deltas + timing + lexical hedging via an **LLM-judge** that emits score + rationale.
- **Run a small in-domain validation to resolve the duration-sign contradiction** before coaching any rate/duration cue.

### Phase 3 — The calibrated novel system (months, data-gated)
- **Prereq: A1 outcome capture must ship first** — add an `Outcome` model + `nextRoundResult` to `prisma/schema.prisma`.
- Train the **quantitative-judge (Bradley-Terry/GLM)** on accumulated (answer-features → outcome) labels (~50–100 corroborated labels minimum).
- Publish the predictive-validity number (benchmark bar ~0.30–0.51) + a 4/5ths adverse-impact audit. *This* is the moat.

---

## 7. Risks & open questions

1. **Existential: a score that's both uncalibrated AND accent-biased, attached to a credential.** Mitigation is the whole of §5 — within-speaker only, transcript-repair, no public absolute number, withhold until calibrated.
2. **Test-retest reliability is unmeasured (gap the research never addressed).** For a warmup→adversarial *delta* to mean anything, per-answer metric noise must be smaller than the anxiety signal. Whisper timing jitter on short opus clips, opus encoder padding corrupting onset timing, and the 0.4s pause threshold all inject variance. **Open question: what's the within-speaker measurement error, and the minimum answer count/length for a stable baseline?** Run a small repeatability study before trusting deltas.
3. **Response latency (first-word onset) is UNMEASURABLE as currently built.** PTT means the *candidate* controls when recording starts, so there's no clean "interviewer stopped → first word" interval in the uploaded clip. Measuring true latency requires timing from the realtime transcript's interviewer-turn-end to the PTT button press (client-side state), not the WAV. **Treat latency as a turn-boundary plumbing task, not a Whisper feature.**
4. **Substitution threat — the build-vs-buy option the research omitted:** GPT-4o-realtime / Gemini Live already have the audio (server-bypassed) and hear tone. **Open question worth a spike:** can you just *prompt the realtime model* for a structured per-answer perceived-confidence read with rationale, skipping Praat/emotion2vec entirely? It may be a faster, rationale-auditable v1 — but it's a *rented* signal, so it cannot be the moat; only the outcome-calibration layer is.
5. **Infra cost the acoustic plan understates:** ffmpeg + Python + sidecar + IPC + Dockerfile changes on 1 GiB t3.micro. Don't let "just add a Praat pass at line 88" hide this.

### Claims the verification corrected (fixed in this memo, not repeated)
- **"Temporal/fluency markers are the most reliable" — MIXED/overstated.** The 2025 PLOS ONE review credits **F0 and intensity** as most reliable and calls speech-rate/duration *heterogeneous*; the social-anxiety ML model is **2022, not 2025**, and leaned on **intensity**. Corrected to: fillers + intensity + pause regularity are best; absolute rate is noisier.
- **"audio bypasses server" privacy framing — MIXED.** True for the live WebRTC path, **false for the per-answer fluency upload path** you'd extend (that audio *does* transit your server and OpenAI/Whisper). Adding a transcript-repair call or prosody pass doesn't degrade the posture (audio still never persisted), but don't claim "live audio bypasses server" for the path you're modifying.
- **Self vs. perceived confidence ρ≈0.31 and dominance≠competence — MIXED.** Both real but narrower than headline: the ρ=0.31 figure is from a small (9-speaker) *visual-only* study; the dominance finding is from non-speech decision tasks. The directional warning (a confidence score risks measuring dominance/charisma) is a sound synthesis, not a directly tested speech result. **Reinforces: report self-relative deltas, not a trait score.**
- **"No commercial API outputs acoustic confidence" — MIXED.** Correct that none outputs "confidence"; minor correction that AWS Chime voice-tone uses acoustic (not text-only) features but still emits only a 3-bucket tone. Net: still nothing to buy.

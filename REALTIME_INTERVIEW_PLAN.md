# Real-Time Interview Mode — Research & Plan

Last updated: 2026-05-29. Companion to [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) and [DESIGN_PLAN.md](DESIGN_PLAN.md).

## The vision

A **live mock interview**: the candidate speaks naturally, an AI interviewer responds in **sub-second**, asks **follow-ups**, and the conversation flows like a real behavioral round. Running alongside it are **2–3 specialized "listeners"** — parallel agents each with a different job — so the user gets live signal, not just a chat.

This replaces nothing: today's turn-based "Practice" (VAD → Whisper → GPT → TTS) stays. This is a **new "Live Mock" mode**.

---

## 0. The differentiation thesis — why this beats ChatGPT/Claude/Gemini voice

A live voice chat with an interviewer persona is **commoditized** — every frontier model's voice mode does it. So the conversation is *not* the product. The moat is the set of things a raw, RLHF-to-please LLM voice **structurally will not do**. Research backs this hard:

**The universal complaint is that AI (and ChatGPT) is too agreeable.** *"ChatGPT is trained to be agreeable… you hear 'Great answer! 9/10,' which feels good but can be wrong enough to cost you offers."* Generic questions, feedback that tells you nothing new. ([Lodely](https://www.lodely.com/blog/ai-interview-prep-tools)) That is the gap.

**The real Amazon loop *is* the "2–3 listeners" idea — literally.** Each interviewer is **assigned 2–3 specific LPs and scores independently**; a **Bar Raiser** (not on the team, with **veto power**) spends 10–15 min drilling ONE story — *"who disagreed?" "what data did you NOT have?" "what would you do differently?"* — explicitly to **separate people who lived it from those reciting a polished narrative**; then the interviewers **debrief and aggregate** to a hire/no-hire. ([IGotAnOffer Bar Raiser](https://igotanoffer.com/blogs/tech/amazon-bar-raiser-interview)) So the differentiated product isn't "an AI interviewer" — it's a **simulated hiring loop**.

**The moat is calibration + data + curated content, not the LLM.** *"Transcript-against-a-signed-off-rubric scoring is the most defensible layer… defensibility comes from accumulating behavioral data, company-specific calibrations, and operational rigor — not the underlying LLM."* ([Business Engineer](https://businessengineer.ai/p/the-five-defensible-moats-in-ai), [Lodely](https://www.lodely.com/blog/ai-interview-prep-tools))

### The six things a raw voice model can't replicate (our actual advantage)

1. **A Bar Raiser that refuses to be impressed.** Frontier models are tuned to satisfy the user; we deliberately do the opposite — skeptical, defaults to "not convinced," pushes past prepared answers, surfaces the gap. **Positioning: "Every other tool says 'great answer.' We tell you you'd get rejected — and exactly why."**
2. **The full loop, not a chat** — multiple interviewers, each owning different LPs, scoring independently → a **hiring-committee debrief + Bar Raiser verdict** (hire / no-hire + the blocking reason). This is your "2–3 listeners," and it mirrors the real process.
3. **Calibrated, consistent, documentable scoring** against the company's rubric — the same answer graded the same way, mapped to a real level (New Grad / SDE II / Senior). A trusted *bar*, not a flattering chatbot.
4. **The hidden scorecard, live** — show the candidate what the interviewer is secretly grading in real time (*"you've said 'we' six times — trending New Grad on Ownership"*). No generic voice exposes its internal rubric.
5. **It knows you** — longitudinal signal across sessions, your weakest LP, your story bank, days-to-interview; drills your specific gaps; *retry-until-Senior*. ChatGPT voice is stateless. This is the data flywheel + switching cost.
6. **Curated fidelity** — real company questions, real probing patterns, level calibration — the slow-to-build content moat (Apex / Hello Interview's defensibility).

**Net:** the voice is just the delivery medium. The defensible product is a **calibrated, adversarial, multi-interviewer loop that ends in a real verdict and gets smarter about *you* every session** — none of which a stateless, agreeable, generic voice assistant can be.

---

## 1. Market research — who's already doing this

Real-time voice interviewers are now a **crowded, validated category** (so the bar is "table stakes," and our edge has to be the *scoring*, not the voice):

- **Conversational practice interviewers:** [Himalayas](https://himalayas.app/ai-interview) (natural real-time voice, adaptive follow-ups), [Bossed](https://bossed.ai/), [Tough Tongue AI](https://www.toughtongueai.com/) (hyper-realistic roleplay + instant feedback), [Final Round AI](https://www.finalroundai.com/) (adaptive questioning, lifelike pacing).
- **Ethically-gray "copilots"** (listen to your *real* interview and feed answers): [Interview Sidekick](https://interviewsidekick.com/), [LockedIn AI](https://www.lockedinai.com/). **We are explicitly NOT this** (per PRODUCT_STRATEGY §11) — we're practice, not cheating.

**The 2026 shift** the comparison pieces cite: candidates now expect *conversational* practice (rehearse real dialogue, build muscle memory), not Q&A flashcards. ([Interview Sidekick roundup](https://interviewsidekick.com/blog/ai-interview-prep-tools))

**Where Aloud still wins:** none of them grade against the **company's actual rubric** the way we do. Our differentiator in live mode is a **real-time Leadership-Principle "signal meter"** that moves as you talk — *"that answer just read New Grad on Ownership"* — mid-conversation. That's novel and on-brand.

---

## 2. Tech research — how real-time voice is built in 2026

Two architectural families, plus orchestration layers:

### A. Speech-to-speech (S2S) models — one model hears + thinks + speaks
Lowest latency, preserves tone/emotion, simplest to wire. The cost spread is **enormous**:

| Model | ~Cost/min | Notes |
|---|---|---|
| **Google Gemini Live** (2.0 Flash) | **~$0.0017/min** | Cheapest by far (~180× under OpenAI); natively multimodal. ([Speko benchmark](https://speko.ai/benchmark/openai-vs-gemini-live)) |
| Gemini 2.5 Flash Live | ~$0.011/min | 30 HD voices, affective dialogue |
| **OpenAI Realtime mini** | ~$0.084/min | Good quality, mid cost |
| OpenAI `gpt-realtime` | **~$0.25–0.35/min** all-in | Best ecosystem + voice quality, **expensive**. ([CallSphere math](https://callsphere.ai/blog/vw2c-openai-realtime-cost-per-minute-math-2026)) |
| Hume EVI 3/4 | ~$0.06/min | Emotion-native, <300ms; great for *coaching* tone |

Sub-1s end-to-end latency is **table stakes** across all of them now.

### B. Cascaded streaming pipeline — STT → LLM → TTS, streamed
More control + cheaper components (Deepgram/AssemblyAI STT + a cheap LLM + Cartesia/ElevenLabs TTS), but you own turn-taking, interruption, and latency budget.

### C. Orchestration (if we don't hand-roll)
- **Managed (Vapi/Retell):** fastest to launch, ~$0.05–0.33/min all-in, good <10k min/month. ([Softcery comparison](https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2026))
- **Build (LiveKit Agents / Pipecat):** ~500ms, ~80% cheaper at scale, full control + the **multi-agent** wiring we want — but real infra. ([Forasoft LiveKit guide](https://www.forasoft.com/blog/article/livekit-ai-agents-guide))

---

## 3. ⚠️ The cost reality (this decides the whole feature)

Real-time voice **burns money per minute** — the opposite of the EC2/S3 cost-cutting we just did. A single mock interview:

| Length | Gemini Live | OpenAI Realtime mini | OpenAI `gpt-realtime` |
|---|---|---|---|
| 15 min | **~$0.03** | ~$1.26 | ~$4.50 |
| 30 min | **~$0.05** | ~$2.52 | **~$9.00** |

A few dozen free users doing 30-min mocks on `gpt-realtime` = **hundreds of dollars** fast. So the cost guardrails below are **not optional**.

**Recommendation:** **Gemini Live for the default/free tier** (essentially free per session), with **OpenAI Realtime as a premium "best quality" option gated behind Pro**. Plus hard guardrails: **session length cap** (10–15 min), **monthly minute budget per user**, a visible **usage meter**, and Pro-gating of the longer/timed mocks.

---

## 4. The architecture — interviewer + 2–3 parallel listeners

The key design idea (your "2–3 listeners, each a different task"): **one agent is in the conversation; the others observe the transcript stream off the latency path** so evaluation never slows the dialogue.

```
 mic ──▶ ┌──────────────────────┐ ──▶ speaker
         │ 1. INTERVIEWER (S2S)  │   ← in-band, sub-second: asks, probes, follows up
         └──────────┬───────────┘
                    │ transcript deltas (events)
         ┌──────────┴───────────┐
         ▼                      ▼
 2. BAR-RAISER EVALUATOR   3. DELIVERY COACH        ← out-of-band observers (async,
   live LP/STAR signal       live pace/fillers/        cheaper models), update the UI
   → "signal meter"          clarity readout           live, never block the talk
```

- **Listener 1 — Interviewer (in-band):** the S2S model. System-prompted as a company-specific behavioral interviewer; drives questions + follow-ups; handles barge-in/interruptions.
- **Listener 2 — Bar-Raiser Evaluator (out-of-band):** consumes the rolling transcript, runs the existing **rubric/LP scoring** (`packages/coach-core` + the rubric prompt) on a cheap text model every few turns → drives a **live Signal meter** (reuse `SIGNAL_THEME`, the Signal card).
- **Listener 3 — Delivery Coach (out-of-band):** pace/filler/clarity from the user's audio+transcript → a live delivery readout (reuse `metrics-panel` concepts).

This reuses almost all of our existing scoring IP — we're adding a *real-time transport*, not re-inventing evaluation. The post-session screen reuses the **Signal reveal + shareable card** we already built.

### Leanest transport for our stack
Browser ↔ model over **WebRTC**, with a **Next.js API route minting ephemeral session tokens** (no media server). The client forwards transcript deltas to the backend; the observer agents run as server-side calls. This needs a **persistent-ish server** — which is exactly why the **EC2 box helps** (serverless/Vercel is poor for long-lived realtime connections). If multi-agent orchestration gets heavy, graduate to **LiveKit Agents / Pipecat** on the same box.

---

## 5. How it fits the current product

- **New mode**, parallel to Practice: a "Live Mock" entry. Today's turn-based pipeline is untouched.
- **Reuse:** company rubrics + LP scoring (`coach-core`), the Signal color system + card, delivery metrics, history persistence (store the live-mock transcript + final signal as a `PracticeSession`).
- **New:** an ephemeral-token API route, a realtime client (WebRTC) + audio UI (extend the `VoiceOrb` to a live duplex state), the observer fan-out, a live signal-meter component, session-length/budget guardrails.
- **Infra note:** realtime is a streaming connection, not a request — fine on the EC2 box; would *not* work on Vercel serverless (reinforces the EC2 choice).

---

## 6. Phasing

- **P0 — Spike (prove latency + cost):** one Gemini Live interviewer, no observers, 5-min cap, behind a feature flag. Validate sub-1s feel + real per-session cost.
- **P1 — The listeners:** add the out-of-band Evaluator (live LP signal meter) + Delivery coach. Post-session → existing Signal card.
- **P2 — Real mock:** timed multi-question flow (opening → 3–5 behavioral → close), company persona, full post-session report; Pro-gating + usage meter; optional OpenAI Realtime "premium voice" toggle.

---

## 7. Risks & open decisions

**Risks:** per-minute cost (mitigated by model choice + caps); latency/interruption UX; browser WebRTC + mic complexity; realtime needs a persistent server (EC2 ok); evaluator lag vs. conversation pace.

**Decisions to confirm:**
1. **Model for v1** — Gemini Live (cost-min, recommended) vs OpenAI Realtime mini (better ecosystem, ~25× pricier) vs a managed orchestrator (Vapi/Retell, fastest but per-min markup).
2. **Build vs orchestrate** — hand-rolled WebRTC + ephemeral token (leanest) vs LiveKit/Pipecat (more power, more infra).
3. **Free vs Pro** — is Live Mock a Pro-only feature, or free with a tight minute budget?
4. **Listener set** — confirm the 3: Interviewer + Bar-Raiser Evaluator + Delivery Coach (or a different third, e.g. a "follow-up strategist").

---

## Sources
- [OpenAI Realtime API](https://openai.com/index/introducing-gpt-realtime/) · [pricing math](https://callsphere.ai/blog/vw2c-openai-realtime-cost-per-minute-math-2026) · [OpenAI vs Gemini Live](https://speko.ai/benchmark/openai-vs-gemini-live) · [best S2S API](https://www.assemblyai.com/blog/best-speech-to-speech-voice-agent-api)
- [Voice agent platforms compared](https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2026) · [LiveKit guide](https://www.forasoft.com/blog/article/livekit-ai-agents-guide)
- Competitors: [Himalayas](https://himalayas.app/ai-interview) · [Bossed](https://bossed.ai/) · [Tough Tongue AI](https://www.toughtongueai.com/) · [Interview Sidekick roundup](https://interviewsidekick.com/blog/ai-interview-prep-tools)

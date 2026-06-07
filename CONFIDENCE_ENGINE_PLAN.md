> Produced by a multi-agent design workflow on 2026-05-29 (6 parallel design lenses → 3 adversarial critics: feasibility / security / product → synthesis). Every critical/high critic finding is reconciled with an explicit decision in §8.

# Aloud — Confidence Interview Engine (BYOK, Real-Time)

*Canonical build plan. Supersedes the six standalone design sections where they conflict. Every critical/high critic issue is reconciled with a stated decision in §8 (Risks & resolutions).*

---

## 1. Vision and moat

Aloud is a **confidence machine whose interface happens to be voice.** The product exists to move one curve: a candidate's measurable self-efficacy speaking under interview pressure. The north-star metric is **Confidence**, not a hire/no-hire score — a candidate who holds composure at Level-4 pressure is winning even if their content still scores SDE_II, and a candidate who scores SENIOR only in a warm warm-up is not. Everything — every interviewer line, every number, every between-session nudge — is instrumentation or intervention on that curve. The default failure mode of "harder than the real thing" is making anxious people more anxious; avoiding that is the whole game, and it is enforced mechanically (the difficulty governor, §4.4) rather than promised.

The raw voice conversation is **commoditized** — ChatGPT and Gemini voice already grill you on demand, free, with no key to paste. So Aloud does not compete on the conversation. It competes on a **calibrated, adversarial, multi-interviewer loop** modeled on a real Amazon Bar Raiser panel: 3–4 interviewer personas each owning 2–3 Leadership Principles and scoring *independently*, one Bar Raiser who drills a single story until it breaks or proves out and can *veto*, then a hiring-committee debrief that produces an inclination and a calibrated level. On top of that sits a **hidden scorecard** revealed only in the report, **longitudinal memory** that drills each user's specific recurring gaps, and a **structured failure report** that converts "here is exactly where you cracked" into a single repeatable drill. The moat is the calibration, the accumulated per-user gap data, and the pedagogy — *not* the prompt text (Amazon's LPs are public) and *not* the transport.

**BYOK is the cost posture, not the wedge.** Running a real multi-interviewer realtime panel is the single most expensive thing in the modern AI stack (~$2–4 of realtime audio per long panel). With zero users and a "minimize own cost" mandate, eating that bill is how Aloud dies. So the *expensive, commoditized* part (the live voice) runs on the **user's** key; the *cheap, proprietary* part (the calibrated judgment that IS the moat) runs on **Aloud's** pinned model so scoring stays comparable across sessions and users. But — per the product critic, decisively — **BYOK is the riskiest assumption in the product, not a settled input.** An anxious new-grad is the *least* likely person to own a billing-enabled API key. Therefore Aloud launches on **Aloud's own capped key with a hard per-session spend ceiling**, proves the panel beats ChatGPT voice on one Amazon scenario, and only builds the BYOK custody/mint stack once instrumentation shows users actually convert at the key wall. The architecture is designed so "whose key" is a per-row policy decision, not a re-platforming — so this sequencing costs nothing.

---

## 2. The canonical "whose key pays for what" contract

This table is the single source of truth and resolves the byok-§7 vs. data-stack-§5 contradiction. Every other section cites it.

| Plane | Workload | Latency | Cost | **Key (v1 / launch)** | **Key (post-BYOK)** |
|---|---|---|---|---|---|
| **Realtime / conversational** | Live panel voice: interviewer asks, candidate answers, barge-in, Bar Raiser drills. STT/LLM/TTS or speech-to-speech. | Sub-second | Dominant | **Aloud's capped key**, hard per-session ceiling | **User's key** (required) |
| **Judgment** | LP scoring, signal leveling, hidden scorecard, committee verdict, confidence computation, structured report prose | Seconds, async | Sub-cent | **Aloud's pinned model** | **Aloud's pinned model** (unchanged) |
| **Free demo** | One capped sample turn for un-keyed users | Sub-second | Tiny, abuse-exposed | **Aloud's key**, turn-based, hard caps | **Aloud's key**, unchanged |

**The judgment plane always runs on Aloud's pinned model, in both v1 and post-BYOK.** This is deliberate and non-negotiable: scoring on `gpt-4o-mini` today and a user's `gemini-flash` tomorrow would make the signal-trend and confidence charts measure *model variance*, not the candidate. The cost is real but sub-cent per session (15 turns × ~700 tokens + one report ≈ well under $0.01), and Aloud eats it on purpose. **data-stack §5's "no fallback to Aloud's key" is correct only for the realtime plane** (which must stay on the user's dime) and wrong for judgment.

---

## 3. BYOK architecture (built P1, designed for now)

### 3.1 Two planes, two interfaces

Aloud has two AI workloads with opposite profiles, and they get two interfaces, not one mega-`Provider`:

```ts
// packages/coach-core (pure, no I/O) — judgment plane, ALWAYS Aloud's pinned model
interface JudgmentProvider {
  scoreJson(opts: { system: string; user: string; maxTokens: number }):
    Promise<{ json: unknown; usage: TokenUsage }>;
}

// src/lib/llm (I/O) — realtime plane, user's key
interface RealtimeProvider {
  readonly id: "openai";              // v1: OpenAI ONLY. Not a tri-provider matrix.
  mintBrowserCredential(opts: {
    userKey: string; model: string; instructions: string; voice: string;
  }): Promise<EphemeralCredential>;   // short-TTL, config-locked at mint
}
```

`coach-core` stays pure (testable, repo convention); realtime/credential I/O lives in `src/lib/llm/`. The existing `openai.ts` functions are refactored to **take a key/credential as an argument** instead of reading `env.OPENAI_API_KEY` — and this refactor is gated behind the redaction work in §8-PR11 before any BYOK code lands.

### 3.2 Realtime is OpenAI-only in v1 (critic: "cross-provider realtime is not a degradable matrix")

Decisively dropped: the tri-provider `RealtimeCapabilities`/dual-transport abstraction. The reality is one mature provider (OpenAI: WebRTC + ephemeral `client_secrets`), one different-enough-to-be-a-rewrite provider (Gemini Live, WS-only, two-stage token), and a hard zero (Anthropic ships no realtime voice). Building a three-peer abstraction before a second provider is wired is exactly the speculative flexibility CLAUDE.md forbids.

- **v1 realtime: OpenAI key only.** UI copy is honest: *"Realtime adversarial panels require an OpenAI key. Anthropic/Gemini keys, when added later, power turn-based practice only."*
- **Gemini realtime: a deferred, separately-scoped project** (its own client + token lifecycle), built when there's demand — not a config flag.
- **Anthropic: judgment/turn-based only**, never marketed as supporting realtime.
- **Capabilities are discovered by probing**, never hard-coded from a model name or the design doc. Every provider constant (TTL, endpoint, model name) is runtime-discovered or config-driven (critic: forward-dated facts will be wrong by ship time). Panels survive *arbitrary* ephemeral TTLs via transparent re-mint regardless of the actual number.

### 3.3 Key custody (critic, both feasibility and security: the threat model is fiction on this box)

The deployment is a single small box with a flat `.env` shipped over SSH — there is no KMS, no IAM instance profile, no secrets manager today. Envelope encryption against a master key that sits in the *same* `.env` on the *same* box, next to the ciphertext, defends only a stolen offline DB dump and nothing else (box/SSH/CI compromise gets both). Therefore:

- **v1 default: client-only / use-once, never stored.** The long-lived key is held in browser memory (never IndexedDB) only long enough to mint an ephemeral, then discarded; or POSTed once over TLS, held in server memory for one mint call, never written to disk. This is the only posture the current infra can actually defend, and it's what ships first. **Option A with a long-lived key persisted in browser storage is removed entirely** — it's the "most dangerous thing" the design itself named.
- **Storing keys at rest is gated on real isolation, not the reverse.** Before any `ProviderKey`-at-rest feature ships: a real AWS **KMS CMK** (P0 the moment a third-party credential is stored — *not* P2), an **IAM instance profile** so the box calls KMS Decrypt via role creds instead of static AWS keys in `.env`, plaintext DEK/master key never touching disk, decrypt only at mint time, never cached. Envelope mechanics (AES-256-GCM, per-key DEK, store `{ciphertext, iv, authTag, encryptedDek, kmsKeyId, fingerprint}`, fingerprint = sha256 prefix for display/dedupe, never the key) are correct and reused — but the trust anchor must exist first.
- **TLS is mandatory before any key feature.** The box serves plain HTTP today; provision domain + Caddy auto-HTTPS and block key endpoints behind HTTPS-only. Add a strict **CSP + SRI** (the SPA is dependency-heavy: recharts, framer-motion, embla, vaul, shadcn, html-to-image) to shrink XSS exfiltration surface, since ephemerals live in the browser regardless. Make CSRF posture explicit: SameSite session cookie + origin checks on key-management and mint endpoints.
- **Stolen-key & validation hygiene:** bind every mint to a per-user `OpenAI-Safety-Identifier`; re-validate at mint (not only lazily); a 401 at mint is immediate hard-delete-and-reprompt; return only boolean affordances (`hasRealtime`) to the browser, never the raw model-entitlement list; delete ciphertext on invalidation/rotation.

### 3.4 Whose key for STT/TTS (critic: silent second-key requirement)

In v1 this is moot (OpenAI-only realtime on Aloud's key). Post-BYOK: an OpenAI realtime key covers STT/TTS natively. An Anthropic- or Gemini-only user running *turn-based* mode needs OpenAI (or Aloud's small key) for STT/TTS — disclosed at onboarding, never silent. Aloud's small key as the STT/TTS shim is kept minimal and opt-in.

---

## 4. Scenario engine

### 4.1 Hierarchy and schema

Three nested objects let one engine drive both a 4-minute drill and a 50-minute panel:

- **Scenario** — an interviewer *behavior contract* (a generalized `CoachConfig`): system prompt + turn policy + scoring lens.
- **Round** — one scenario bound to one question + target-LP set, run to a stop condition.
- **Session** — an ordered sequence of rounds the engine assembles for this user now.

Schema is **additive** (`PracticeRound`, `UserLPMastery`, `PracticeTurn.roundId`/`interviewerId`); existing `PracticeSession`/`PracticeTurn` and the turn-based delivery modes stay untouched (§8-PR16/coexistence). Longitudinal weakness tracking needs rounds and target-LPs as first-class rows you can `GROUP BY` — worth the cheap migration.

### 4.2 Taxonomy (built incrementally, not all at once)

Per the product critic, the 9-scenario taxonomy is **designed, parked, and built behind the proven wedge**. The full set, ordered by confidence difficulty:

| ID | Scenario | Diff | Primary pressure | Scoring lens | Build phase |
|----|----------|------|------------------|--------------|-------------|
| S0 | Warm-up | 1 | none (delivery only) | `SpeechMetrics` | P1 |
| S1 | Standard STAR | 2 | structure + specifics | LP rubric | **P0** |
| S2 | Bar-Raiser drill | 4 | depth under why-ladder | LP rubric + composure | **P0** (the moat) |
| S3 | Rapid-fire | 3 | recall + concision | LP rubric (breadth) | P1 |
| S4 | Curveball/stress/silence | 4 | composure off-script | composure + Have-Backbone | P1 |
| S5 | Conflict/failure | 4 | self-crit without blame | Earn Trust / Ownership | P1 |
| S6 | Tell-me-about-yourself | 2 | narrative arc | structure + relevance | P1 |
| S7 | System-design talk | 4 | verbal reasoning | design rubric variant | P2 |
| S8 | Full panel loop | 5 | everything + stamina | committee verdict | **P0 (capped scope)** |

S1 (prerequisite) + S2 (the moat) + a single capped S8 panel are P0. The rest is breadth on a proven kernel.

### 4.3 Difficulty knobs (deterministic, not "be harder")

Difficulty 1–5 **deterministically expands into concrete knob values** rendered as hard rules in the interviewer prompt — this is what makes leveling calibrated and reproducible instead of vibes. The LLM chooses the *content* of a follow-up, never *whether* to follow up.

```ts
interface DifficultyKnobs {
  followUpDepth: number;        // 0–4 "why" layers
  vaguenessTolerance: number;   // 0–1 prob. a vague answer passes
  interruptionEnabled: boolean;
  timeCapSec: number | null;
  silenceTactic: boolean;       // the 4–8s withheld-turn
  specificityDemand: "low"|"med"|"high";
  premiseChallenges: number;    // 0–2 false-premise pushbacks
  backchannelWarmth: number;    // 0–1
}
```

| Knob | D1 | D2 | D3 | D4 | D5 |
|------|----|----|----|----|----|
| followUpDepth | 0 | 1 | 2 | 3 | 4 |
| vaguenessTolerance | 0.9 | 0.6 | 0.4 | 0.15 | 0.0 |
| interruptionEnabled | no | no | yes | yes | yes |
| timeCapSec | none | none | 90 | 75 | 60 |
| silenceTactic | no | no | no | yes | yes |
| specificityDemand | low | med | med | high | high |
| premiseChallenges | 0 | 0 | 0 | 1 | 2 |
| backchannelWarmth | 1.0 | 0.7 | 0.5 | 0.3 | 0.1 |

**Level overlay:** a SENIOR target adds +1 `followUpDepth` and shifts `vaguenessTolerance` down one column — the single mechanism delivering "calibrated leveling consistently," using the junior/senior signal strings already in `rubric-definitions.ts`. `silenceTactic` is free (withhold the next turn; inspect whether VAD re-fired with fillers). `interruptionEnabled` is implemented as the interviewer speaking over a soft client signal at `timeCapSec` (not true duplex) — cheaper, good enough.

### 4.4 Adaptive selection + the difficulty governor (safety kernel)

After each round, update a per-user `UserLPMastery` row (signal history, `composureUnderDrill`, staleness) — the longitudinal memory. Next round's target LP is the top of:

```
priority(lp) = 0.45·(target − recentSignal) + 0.30·(1 − composureUnderDrill)
             + 0.15·staleness − 0.10·recentAttempts
```

Composure is weighted heavily on purpose: an LP the user *folds on under pressure* outranks one they're merely weak on calmly. Session arc is **win → stretch → near-win** (bank an early win on their strongest LP, work the top-priority gap ramping within tolerance, end on a near-win) — deliberately *un*-realistic at the session level to build momentum, while individual rounds stay harder-than-real.

**The difficulty governor is the safety + calibration kernel**, consulted before every round and every in-round escalation:
- **Per-round ceiling** = `f(recent confidence index, composure trend)`; a fragile user *cannot* be served an S4 stress round.
- **Mid-round circuit breaker:** if composure crosses a distress floor (fillers spike + signal collapses + long silences), escalation freezes and the interviewer shifts to recovery ("take a breath — walk me through it slowly"). Harder-than-real, but it *catches* a drowning user.
- **Unlock gates:** S8 and difficulty-5 are locked until the user clears S2 *and* S5 at target level — making the capstone earned.
- **Manual override** respected (a user with an imminent `interviewDate` can force a panel, with a warning).

**Critic-driven guardrail (the governor depends on an unvalidated signal):** until the composure signal is validated (§5), the governor must **not** ship as the sole difficulty driver. Difficulty defaults to **explicit user choice + pre-session self-rating**, and adversarial-by-default is replaced by **warm-default with adversarial as an explicit "boss mode"** until a dropout study (§8-PR9) proves adversarial-by-default doesn't increase dropout for the nervous target user. The "always attack the answer, never the person" rules, bounded silence (≤8s, ≤2×/round), and `followUpDepth ≤ 4` cap are hard prompt constraints from day one.

---

## 5. Confidence pedagogy and the metric

### 5.1 The science (each mechanism maps to one mechanic)

- **Mastery (Bandura)** — the spine: engineer one *earned, attributed* win per session. The panel manufactures *survivable* hard moments the user conquers.
- **Graduated, imperceptible exposure (JMIR 2024)** — escalation is a smooth gradient within a session (a second interviewer present but quiet, then mildly pointed), never a mid-session "DIFFICULTY: HARD" banner.
- **Arousal reappraisal (Brooks 2014)** — never "relax/calm down" (banned copy); reframe "I'm nervous" as "I'm activated — interviewers read that as engagement." Cheapest, highest-ROI mechanic.
- **Challenge-vs-threat** — the *objective function*: maximize demands subject to keeping resources ≥ demands. Every demand-raising lever pairs with a resource top-up (surface a past win, narrow the question).
- **Deliberate practice (Ericsson)** — the drill is a narrow, repeatable, edge-of-ability rep with immediate feedback, not a reading list.

### 5.2 The Confidence Index — ONE frozen formula (critic: three sections invented three)

There is exactly **one** CI definition, frozen across the whole product. It is a composite of three components, **stored as components (never just the composite)** so re-weighting never loses history, displayed as one 0–100 headline with sub-scores one tap away:

```
CI = round( 0.40·Composure + 0.35·Resilience + 0.25·SelfEfficacy )

Composure (0–100)    : filler rate, WPM variance, pause variance — WEIGHTED BY DIFFICULTY APPLIED
Resilience (0–100)   : recovery-after-hard-moment delta + completion-under-pressure
                       (only the adversarial loop can measure this — the differentiator)
SelfEfficacy (0–100) : pre/post-session self-rating slider (Bandura's construct is a belief — ask it)
```

**Critic-driven discipline (the metric is unvalidated):**
- **v1 ships Composure ONLY, from signals already computed** in `speech-analysis.ts` (`fillerCount`, WPM, pause stats). Transparent, boring, user-can-sanity-check.
- **Resilience and the prosody/recovery-latency signals are P2 research**, gated on a **calibration study**: collect N sessions, hand-label which *felt* confident, show the metric correlates before it's a headline. `recoveryUnderPressure` (post-interrupt / pre-interrupt delivery, normalized by difficulty) multiplies two noisy small-sample estimates — it does not ship as a headline until validated, and a **kill criterion** exists (if CI is noise vs. the labels, it does not become the north-star).
- CI is **never shown to the nervous target user as a single falling judgmental number** until validated — a wobbling CI line *induces* the threat state the product prevents.
- CI is **not** the Signal score. Signal answers "would they hire you?"; CI answers "can you deliver under pressure?" Both are shown; the gap is instructive.

### 5.3 The failure → rebuilt-confidence loop

Every report leads with the **earned win**, always, before any deficit. Fixed shape: **"What held" → "Where it wobbled" (exactly one or two, located in time + content) → "Your one rep"** (a single runnable drill, not advice). Tone adapts to the calibration gap: the *under-confident competent* gets evidence and verbal persuasion; the *over-confident shaky* gets the genuine win then gentle, concrete reality as a path. The Bar Raiser is tough *in session*, warm *in the debrief* — the persona steps out of character; the coaching is unconditionally on the user's side.

---

## 6. Realtime voice + multi-interviewer panel architecture

### 6.1 Topology decision (resolves the persistent-WS vs. browser-direct contradiction)

The two designs contradicted each other (persistent stateful WS session-actor vs. "audio never touches Aloud"). **Decision, owning the consequences: stateless REST + browser-direct WebRTC for v1.** The persistent WS session-actor is **over-engineered for the chosen topology and is not built.**

- **Audio path:** browser ↔ OpenAI Realtime **directly** over WebRTC, authed with a short-TTL ephemeral minted server-side. Aloud is **not in the audio path** — no bandwidth cost, no audio-PII liability, low latency.
- **Barge-in** is handled by the provider's **native interrupt**, triggered from the browser over the path the browser already owns. There is no server-side single-digit-ms cancel loop because there is nothing for the server to cancel — the critic was right that a server cancel loop is meaningless when audio is browser-direct.
- **Control plane** is a normal request/response BFF (the data-stack REST lifecycle is the correct one): mint ephemeral → run the session browser↔provider → checkpoint each completed turn's transcript/metrics/events to Postgres (idempotent via `@@unique([sessionId, seq])`) → on `complete`, run async judgment on Aloud's key.
- **Transcript source:** OpenAI Realtime's **native `input_audio_transcription` events** (with timestamps). The "always run a parallel STT tap on the user's key" idea is **dropped** — it double-bills the user for transcribing identical audio on the exact cost-sensitive path BYOK is meant to minimize. Cross-provider transcript-schema variance is normalized in code, not paid for twice.
- **Infra reality:** realtime panels need infra that does not exist yet — domain + TLS (Caddy auto-HTTPS), and the box right-sized for concurrent sessions. CLAUDE.md's "ECS Fargate behind an ALB" is stale (terraform is now a single EC2 + EIP) and is reconciled here: because v1 is stateless REST + browser-direct audio, **it runs on the existing stateless web tier with no session-affinity problem** — the box never holds a 45-minute socket. A persistent WS service is reserved for a *future* server-side-orchestrated mode only if one is ever needed, and would be a *separate* long-running service (not inside `next start` standalone), with its own box and budget.

### 6.2 Sequence diagram (v1, OpenAI realtime, browser-direct)

```
Browser            Aloud BFF (stateless)        OpenAI Realtime        Judgment (Aloud key, async)
  |                      |                            |                          |
  |-- POST /mock/sessions{scenarioId} -->|            |                          |
  |                      |-- mint ephemeral (Aloud key, config-locked persona) ->|
  |                      |<-------------- ephemeral client_secret --------------|
  |<-- {sessionId, ephemeral, panelSeats} |           |                          |
  |                      |                            |                          |
  |==== WebRTC connect (ephemeral) ============================>|                |
  |<~~~~ interviewer audio (seat 1) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|                |
  |~~~~ candidate audio ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~>|                |
  |   (VAD barge-in -> native response.cancel, browser-issued) |                |
  |<~~ input_audio_transcription events (timestamped) ~~~~~~~~~~|                |
  |                      |                            |                          |
  |-- POST /turn {seq, seatId, transcript, metrics, events} -->|   (idempotent)  |
  |                      |-- enqueue async LP score (Aloud key) --------------->|
  |                      |                            |          score seat's LPs|
  |   ... handoff: seat 2 = Bar Raiser, drills weakest story (S2) ...           |
  |-- POST /complete --->|                            |                          |
  |                      |-- committee debrief (Aloud key) ------------------->|
  |                      |-- compute CI, verdict, drills; write rows ---------->|
  |<-- {report: verdict + per-seat + findings + drills} -------|                |
```

### 6.3 The panel (the moat, concretely)

The panel is **not new scoring logic** — it's a *partition + orchestration* over the existing `getRubricForCompany()` scorer:

1. **Partition.** A `BAR_RAISER_PANEL` scenario has 3–4 `PanelSeat`s; the **16** Amazon LPs (corrected from the doc's 15/14 drift) are split so each seat owns 2–3. Each seat's prompt = base Amazon prompt with `principles` filtered to `ownedLPs`. The Bar Raiser seat owns the highest-bar LPs and **roams** to drill the candidate's apparently-strongest story.
2. **Independent scoring.** Each seat scores only its LPs via `scoreAgainstRubric` (Aloud's key), parsed by `rubricScoresSchema`, fanned to `DimensionScore` rows tagged with `seatId`. Seats do not see each other's scores until debrief — real bar-raiser independence, which a single-model voice chat cannot reproduce.
3. **Bar Raiser drill + veto.** The Bar Raiser runs the S2 why-ladder; if after `followUpDepth` turns the central claim can't be substantiated, `barRaiserVeto = true` overrides other seats — enforcing "harder than the real interview."
4. **Committee debrief.** One call over the `seatRollup` synthesizes a `PanelVerdict` (Strong Hire → Strong No-Hire + level + the decisive seam + the split), weighting toward a veto.

**IP-protection is corrected (critic):** config-lock-at-mint is kept for the **cost/abuse** reason (good), but **"protects the IP" is dropped from its rationale** — in a live voice session the candidate can jailbreak the interviewer into reciting its prompt, and realtime models are leaky. The real proprietary judgment (scorecard criteria, veto logic, weighting) lives **off-band on Aloud's key**, in calls the candidate's session can never reach. The in-band interviewer persona is deliberately thin and leakable (persona + LP focus only). This also strengthens the case for judgment on Aloud's key.

### 6.4 Latency (honestly ranged, not a single promise)

Aloud does **not** control the user's model tier, rate-limit bucket, or region, so a single "0.9–1.5s" budget is dishonest. At mint, measure the key's actual time-to-first-token once and **warn if slow** ("your key is laggy today; the panel may feel sluggish"). Barge-in is **RTT-bound to the provider**, browser-issued — no 150ms promise on a stranger's network. An Aloud-key "fast lane" is the natural paid upsell precisely where BYOK latency is weak.

---

## 7. Data model & stack integration

All models `userId`-scoped. Additions are **purely additive** (`npx prisma migrate deploy`, no backfill, no breaking change), reusing the existing `SignalLevel` enum and `PracticeTurnRole`. The Dockerfile's manual `src/generated/prisma` COPY stays valid as long as the output path doesn't move.

```prisma
enum LlmProvider { OPENAI ANTHROPIC GEMINI }
enum InterviewType { BEHAVIORAL SYSTEM_DESIGN CODING_VERBAL HIRING_MANAGER BAR_RAISER_PANEL }
enum ScenarioDifficulty { WARMUP CALIBRATED ADVERSARIAL }
enum MockStatus { PENDING LIVE DEBRIEF COMPLETED ABANDONED FAILED INTERRUPTED }
enum ScoreDimension { LP STAR_STRUCTURE TECHNICAL_DEPTH COMMUNICATION DELIVERY }
enum DrillStatus { ASSIGNED COMPLETED SKIPPED }

// P1 — only when KMS + IAM instance profile exist (see §3.3)
model UserApiKey {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider LlmProvider
  label String?
  ciphertext Bytes; iv Bytes; authTag Bytes; encryptedDek Bytes; kmsKeyId String
  fingerprint String        // sha256 prefix — display/dedupe, NOT the key
  capabilities Json          // probed, boolean affordances
  status String @default("active")  // active|invalid|quota_exhausted|rate_limited
  lastValidatedAt DateTime?
  createdAt DateTime @default(now())
  @@unique([userId, provider, fingerprint])
  @@index([userId])
}

model Scenario {
  id String @id @default(cuid())
  company String; type InterviewType; difficulty ScenarioDifficulty
  targetLevel SignalLevel; title String; promptText String
  lpFocus String[]; estMinutes Int @default(20); isActive Boolean @default(true)
  panelSeats PanelSeat[]; mockSessions MockSession[]
  @@index([company, type, targetLevel, difficulty])
}
model PanelSeat {
  id String @id @default(cuid())
  scenarioId String; scenario Scenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  personaName String; ownedLPs String[]; isBarRaiser Boolean @default(false); systemPrompt String
  @@index([scenarioId])
}
model MockSession {
  id String @id @default(cuid())
  userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  scenarioId String; scenario Scenario @relation(fields: [scenarioId], references: [id])
  apiKeyId String?   // null = Aloud key (v1 default + demo audit marker)
  provider LlmProvider; modelUsed String
  status MockStatus @default(PENDING); targetLevel SignalLevel
  startedAt DateTime?; endedAt DateTime?; durationSec Int?
  transcriptKey String?; audioKey String?      // audio OPT-IN (see §8-PR12)
  overallSignal SignalLevel?; confidence Int?; passed Boolean?  // denormalized for cheap reads
  turns MockTurn[]; dimensionScores DimensionScore[]; verdict PanelVerdict?
  drills DrillAssignment[]; confidencePoints ConfidenceMetric[]
  createdAt DateTime @default(now())
  @@index([userId, status]); @@index([userId, createdAt])
}
model MockTurn {
  id String @id @default(cuid())
  sessionId String; session MockSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  seatId String?; role PracticeTurnRole; seq Int
  transcript String?; metricsJson Json?       // SpeechMetrics — reuse analyzeSpeech()
  events Json?                                  // interruptions, latency-to-answer, barge-ins
  audioKey String?
  createdAt DateTime @default(now())
  @@unique([sessionId, seq]); @@index([sessionId])
}
model DimensionScore {
  id String @id @default(cuid())
  sessionId String; session MockSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  seatId String?; dimension ScoreDimension; key String
  score Int; signalLevel SignalLevel; evidence String; gap String
  createdAt DateTime @default(now())
  @@index([sessionId]); @@index([sessionId, dimension])
}
model PanelVerdict {
  id String @id @default(cuid())
  sessionId String @unique; session MockSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  overallSignal SignalLevel; inclination String; barRaiserVeto Boolean @default(false)
  summary String; seatRollup Json; topStrengths String[]; topRisks String[]
  createdAt DateTime @default(now())
}
model ConfidenceMetric {            // components stored, not just composite (§5.2)
  id String @id @default(cuid())
  userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionId String?; session MockSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  score Int; composure Int; resilience Int?; selfEfficacy Int?
  measuredAt DateTime @default(now())
  @@index([userId, measuredAt])
}
model DrillAssignment {
  id String @id @default(cuid())
  userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourceSessionId String?; sourceSession MockSession? @relation(fields: [sourceSessionId], references: [id], onDelete: SetNull)
  questionId String; targetLP String; reason String
  status DrillStatus @default(ASSIGNED); resultSessionId String?
  assignedAt DateTime @default(now()); completedAt DateTime?
  @@index([userId, status])
}
// User gains: targetLevel SignalLevel @default(NEW_GRAD); + relations. Reuse existing targetCompanies, interviewDate.
```

**Notes:** `reportJson` is denormalized on the session for cheap re-reads; relational tables exist only for cross-session trend/gap/drill queries a blob can't index. Per-finding audio clips are S3-signed byte-ranges of already-uploaded turn audio (no new infra), and **audio is opt-in, transcript-only by default** (§8). New `coach-core/panel-composition.ts` (`buildSeatRubric`, `synthesizeVerdict`) is pure and unit-tested via the existing Vitest aliases. `shared-types` gains `dimensionScoreSchema`, `panelVerdictSchema`, `confidenceMetricSchema`, mock-lifecycle request/response schemas — every LLM output validated like `rubricScoresSchema` already is.

---

## 8. Risks & resolutions

Every critical/high critic issue, with the decision taken.

**PR1 — BYOK adoption is the make-or-break assumption (CRITICAL, product).**
*Decision:* BYOK is **not built first.** Launch the panel on Aloud's capped key with a **hard, user-visible per-session spend ceiling** (abort at N minutes / $X) as a **P0 requirement**, not a P2 nicety. Ship the "try before you BYOK" demo as the default; instrument the conversion rate at the key wall. Build the `ProviderKey`/ephemeral-mint/multi-provider stack **only** once that number proves users actually paste keys. A single horror-story bill kills the word-of-mouth that is the growth engine.

**PR2 — Confidence metric is unvalidated, possibly unfalsifiable, defined 3 ways (CRITICAL, product).**
*Decision:* ONE frozen formula (§5.2). v1 ships **Composure only**, from already-computed signals. Resilience/prosody/recovery-latency are **P2 research gated on a calibration study** with a stated **kill criterion**. Store components, never composites. **Never show CI as a single falling number** to the nervous user until validated.

**PR3 — Realtime is OpenAI-only; not a degradable tri-provider matrix (CRITICAL, feasibility).**
*Decision:* v1 realtime = OpenAI only. Drop `RealtimeCapabilities`/dual-transport adapters. Gemini realtime = deferred separate project. Anthropic = judgment/turn-based only, never marketed as realtime. Capabilities discovered by probing; provider constants runtime-driven, never hard-coded.

**PR4 — Persistent-WS-actor vs. browser-direct contradiction (CRITICAL, feasibility + product).**
*Decision:* **Stateless REST + browser-direct WebRTC for v1.** No persistent session-actor, no transcript bus, no server-side cancel loop. Barge-in = provider-native, browser-issued. This runs on the existing stateless web tier with **no session-affinity problem** and reconciles the EC2/Fargate confusion. A persistent WS service is reserved for a hypothetical future server-orchestrated mode only, as a separate budgeted box.

**PR5 — Key custody threat model is fiction on this box (CRITICAL, security).**
*Decision:* **client-only / use-once, never stored** is the v1 default (the only posture this infra defends). Storing keys at rest is **gated on real KMS CMK + IAM instance profile + TLS first** (P0 the moment keys are stored, not P2). Long-lived-key-in-browser-storage (old Option A) is **removed**. CSP + SRI + explicit CSRF posture added.

**PR6 — BYOK proxy / mint financial abuse, no rate limiting exists (CRITICAL, security).**
*Decision:* per-user + per-IP rate limits on every mint/session-create endpoint **before launch**; cap concurrent live sessions per user (1–2); server-side max-duration and max-mint-count; idempotent mint (reuse the `@@unique` pattern); a **global daily spend ceiling + automatic kill-switch** on Aloud's demo key; estimated cost shown + explicit confirmation before a panel.

**PR7 — STT "tap" double-bills the user (HIGH, feasibility).**
*Decision:* dropped. Use OpenAI Realtime's native timestamped transcript events. Normalize cross-provider schema in code; never pay twice for the same audio.

**PR8 — Whose key runs judgment was contradictory (HIGH, product).**
*Decision:* the §2 table is canonical. Judgment **always on Aloud's pinned model** (both v1 and post-BYOK) for comparability; realtime always on the user's key (post-BYOK). data-stack §5's "no Aloud fallback" applies to realtime only.

**PR9 — Adversarial-builds-confidence is an unproven, double-edged bet (HIGH, product).**
*Decision:* **warm-default, adversarial = explicit "boss mode"** until a dropout study proves adversarial-by-default doesn't increase dropout for the nervous cohort. The circuit breaker does **not** ship as the sole difficulty driver until its composure signal is validated; until then difficulty is gated on explicit user choice + self-rating.

**PR10 — Prompt injection via candidate transcript (HIGH, security).**
*Decision:* all transcript text is hostile **data, never instructions** — delimited role-segregated blocks; persona/scorecard text server-side only; candidate text scored in a **separate call its words can't reach**; every LLM output Zod-validated; any Finding whose quote isn't a real-transcript substring is dropped (and the report falls back to turn-level anchoring rather than emptying — see PR13).

**PR11 — Key redaction in logs is systemic, not one function (HIGH, security + feasibility).**
*Decision:* a single redaction utility (strips `sk-`, `sk-ant-`, `AIza`, `Bearer …`) routes **all** logging; never log provider bodies or place keys in Error messages; log rotation/retention on the box; a test asserts no key prefix escapes the error layer. **This is build step #2, before any BYOK code.**

**PR12 — Audio/transcript privacy & cross-provider data flow (HIGH, security).**
*Decision:* **transcript-only default, audio opt-in** (committed, not an "open decision"). Onboarding discloses which providers receive audio vs. transcript **and that judgment runs on Aloud's OpenAI key regardless of the user's chosen provider.** Hard retention limits + self-serve purge for keys/transcripts/audio; a DPA/privacy section covering third-party model processing and voice-as-biometric-adjacent data (required for the B2B upsell).

**PR13 — Report cost/latency & timestamp-anchoring on weak models (MEDIUM→ resolved).**
*Decision:* report generation is **pinned to Aloud's controlled model** (same comparability argument as judgment) — a frontier-judge report is part of the value, not a commodity. Validate word-timestamp anchoring on real models; if unreliable, fall back to **turn-level** anchoring rather than dropping findings to empty.

**PR14 — Infra reality / TLS / CSP / concurrency budget (HIGH/MEDIUM, feasibility + security).**
*Decision:* domain + Caddy auto-HTTPS before any key feature; strict CSP + SRI; a stated per-concurrent-session RAM/CPU budget with concurrency caps that **queue/refuse** rather than OOM. Because v1 is stateless + browser-direct, the box is right-sized for control-plane JSON + async judgment only.

**PR15 — Realtime mid-session resume (MEDIUM).**
*Decision:* add `INTERRUPTED` status. True mid-utterance resume is impossible (provider owns session state); on resume, start a **fresh provider session seeded with a compact summary** of prior turns, told to the user honestly ("resuming — the interviewer has your prior answers as notes"). Resume only at turn/phase boundaries.

**PR16 — Question-bank coverage & LP miscount (LOW→ gating).**
*Decision:* fix LP count to **16** everywhere. Audit `question-bank.ts`: several LPs have one or zero questions; the adaptive selector would repeat. **Expanding the question bank is explicit P1 content work** gating the scenario engine, not an afterthought.

**Open items still requiring product calls (surfaced, not silently decided):** pricing reconciliation between PRODUCT_STRATEGY's $19/mo SaaS wedge and this "free-on-your-key" model (they are different funnels); cold-start calibration (the moat needs data it doesn't yet have — the first 100 sessions must be calibrated against *something*, and there is no ground truth yet); accessibility/STT bias against non-native English speakers (corrupts both rubric and CI signals for exactly the international FAANG-prep segment); and the "why leave free ChatGPT voice" positioning answer.

---

## 9. Phased roadmap

**P0 — Adversarial spike (smallest valuable slice). Prove the moat before any BYOK/realtime-transport investment.**
- Schema: `Scenario`, `PanelSeat`, `MockSession`, `MockTurn`, `DimensionScore`, `PanelVerdict` (skip `UserApiKey`, skip Resilience).
- Run on **Aloud's capped key** (OpenAI Realtime, ephemeral minted from the server key), with a **hard per-session spend ceiling**.
- ONE Amazon `BAR_RAISER_PANEL`: S1 + S2 + a single capped S8, 3 seats, one Bar Raiser. `coach-core/panel-composition.ts` (`buildSeatRubric`, `synthesizeVerdict`) + tests.
- CI = **Composure only**. Build step #2 = the redaction utility + test.
- Structured report screen (per-seat scores + verdict + the one-rep drill).
- **Verification:** one full panel end-to-end; assert 3 seat-attributed `DimensionScore` rows + a `PanelVerdict`; a deliberately weak "we did X" answer earns a Bar Raiser veto; a test user says "this is different from ChatGPT voice." **If not, stop — none of the rest matters.**
- Parallel: a **dropout/confidence study** (warm vs. adversarial default) and a **CI calibration study** (does Composure correlate with hand-labeled "felt confident").

**P1 — BYOK + the loop (gated on P0 conversion data + KMS/TLS).**
- TLS + domain + CSP/SRI; KMS CMK + IAM instance profile; *then* `UserApiKey` envelope encryption.
- Provider abstraction (`src/lib/llm/`: OpenAI realtime + judgment); move realtime minting onto the **user's** key (judgment stays on Aloud's). Rate limits + spend caps + kill-switch shipped here.
- `ConfidenceMetric` (Composure live; Resilience still research), `DrillAssignment`, the session→gap→drill loop, `confidence-trend-chart.tsx`.
- Scenarios S0, S3–S6; **question-bank expansion** (PR16); difficulty governor with validated composure signal; warm/boss-mode toggle.

**P2 — Calibration, fidelity & hardening.**
- Resilience/prosody signals (only if the study validated them); inter-rater calibration auditing `seatRollup` agreement; longitudinal personalized panels that pull prior `DimensionScore` gaps into seat prompts.
- Gemini realtime as a separate project; S7 system-design; multi-company rubrics; audio opt-in retention/purge; ABANDONED-session reaper; managed-key SaaS upsell + Aloud-key "fast lane."

---

## 10. BYOK business & cost model

**Launch model — free product on Aloud's capped key, then on your key.** Everything is free: the calibrated panel, hidden scorecard, structured reports, longitudinal memory, the Signal card. Marginal cost per user is **near-zero** *only because* of the §6.1 topology (audio is browser↔provider direct; Aloud pays for control-plane JSON + sub-cent judgment + a DB row + tiny transcript JSON in S3). The asset being accumulated for free is the **longitudinal data + cross-user calibration corpus** — the moat.

**The economics, concretely:** a 20-minute Bar Raiser panel costs the *user* ~$2–4 of realtime audio (post-BYOK) or hits Aloud's capped key (v1, ceiling-protected). The judgment Aloud runs on its own pinned model for that same panel — ~15 turns × ~700 tokens through a `gpt-4o-mini`-class model + one report — is **well under $0.01**. Aloud pays sub-cent for the part that is its IP; the user pays dollars for the part that is a commodity.

**Upsell model — thin SaaS / managed key (later, additive).** For users who won't manage a key, and for B2B (bootcamps, universities, career services buying seats), Aloud provisions a pooled key and marks up realtime as pass-through-plus-margin. Same `ProviderKey` + ephemeral-mint plumbing — the only difference is *whose* row is used at mint. Premium also bundles a stronger judge model, higher-fidelity panels, and the Aloud-key low-latency "fast lane" (the answer to BYOK's latency weakness). Pricing must be reconciled against the existing $19/mo positioning before this tier ships (flagged in §8). The strategic point: **BYOK decouples growth from cost** — launch free-on-a-capped-key to win distribution and accumulate the calibration data that *is* the moat, then monetize convenience and depth on identical plumbing.

# Realtime Panel Frontend — Implementation Plan

The browser real-time client + live-panel UI + report screen for Aloud's Amazon
Bar-Raiser panel. The P0 backend (6 `/api/mock` routes, durable judgment queue,
seed) is built and green; this plan covers the **frontend** + the small backend
tweaks it forces. Produced by the `realtime-panel-frontend-design` workflow
(4 parallel readers → design → 2 adversarial critics → revised plan).

> Audio path is **browser ↔ OpenAI directly**; Aloud is never in the audio
> stream. The server mints a config-locked, use-once ephemeral; the browser
> holds the WebRTC peer. (SYSTEM_DESIGN §3/§10.)

## Resolved decisions (the load-bearing ones)

1. **Voice is locked per-ephemeral, not per-session**, and OpenAI GA refuses to
   change a conversation's voice once assistant audio has emitted. The 3 seeded
   seats have distinct voices (Maya/alloy, Dev/verse, Priya/sage). ⟹ **one
   WebRTC connection = one seat**. The panel is **three consecutive Realtime
   sessions over one `MockSession`**: seat0 → seat1 → seat2, tearing down and
   re-minting+reconnecting at each handoff. This honors the config-locked-
   instructions security contract *and* gives each evaluator a real, distinct
   voice — the "real peer evaluators, not one LLM" differentiation.

2. **We are on GA, not Beta** (Beta `/v1/realtime?model=` SDP shape was
   deprecated 2026-05-12, dead now). Corrections baked in:
   - `OPENAI_REALTIME_URL` default → `https://api.openai.com/v1/realtime/calls`
     (GA SDP-exchange). Client POSTs the SDP offer there with
     `Content-Type: application/sdp`, `Authorization: Bearer <ephemeral.value>`,
     **no `?model=`** (model is bound to the ephemeral at mint).
   - COACH transcript events are GA names: `response.output_audio_transcript.delta`
     / `.done` (NOT Beta `response.audio_transcript.*`). USER transcript event
     `conversation.item.input_audio_transcription.completed` is unchanged.
   - Input transcription must be **enabled in the mint config** (`audio.input.
     transcription` + `audio.input.turn_detection` server VAD); otherwise no
     `input_audio_transcription.completed` events fire and the judge scores an
     empty interview. The client also sends a `session.update` on data-channel
     open as belt-and-suspenders and **waits for the `session.updated` ack
     before entering `live`**.

3. **Mint-route change** (the single load-bearing backend change): accept
   optional `seatIndex` (default 0) + add `seat_handoff` to the `reason` enum;
   fetch ALL seats ordered by `seatOrder`, select `seats[seatIndex]`, 404 if
   undefined, mint that seat's `systemPrompt`+`voice`. `seat_handoff` is
   renewable when `status===LIVE` (no flip, no recharge). The per-session
   ceiling guard runs on **every** mint and can return **410 SESSION_EXPIRED**
   mid-panel → the client routes to wrapping→complete (judge what exists).
   `POST /sessions` keeps minting seat0.

4. **COACH turns are SCORING INPUTS, not telemetry.** `barRaiserDrillDepth`
   counts `role==='COACH' && seatId===barRaiserSeatId`, and `evaluateDrill`
   vetoes only when depth ≥ 2 AND the story collapsed. A dropped/mis-attributed
   seat-2 COACH turn silently changes the veto. ⟹ COACH turns get the **same
   must-deliver / ordered / idempotent-retry** treatment as USER turns; finalize
   on `.done`, snapshot the payload, same seq queue. Spurious COACH turns
   (empty / sub-3-word, server-VAD reacting to noise) are NOT committed and do
   not consume seq.

5. **No fabricated word timings.** The Realtime `input_audio_transcription.
   completed` payload is text only — no per-word offsets. Evenly-spaced
   synthetic tokens would force `pauseCount=0`, `speakingRatio≈1.0` (fake-
   perfect delivery) every turn. ⟹ USER turns send `words:[]` → backend returns
   `metrics:null` honestly. Live composure leans on the real signals:
   `latencyToAnswerMs`, `bargeIns`, turn count. The report renders sparse/null
   `confidenceMetrics` gracefully (never a fabricated hero number).

6. **seq is one monotonic counter for the whole `MockSession`** (matches
   `@@unique(sessionId, seq)`). To avoid races between async USER/COACH events,
   seq is assigned by a **single-writer in-order commit queue at dequeue time**
   (not event time). `seatId` is snapshotted into the queued item **before**
   handoff advances `activeSeatIndex`, so a late `.done` from a torn-down peer
   keeps the correct (old) seat. Reconnect reconciles `nextSeq = maxSeq+1` from
   `GET /status`.

7. **The judge sees a USER-transcript-only, un-attributed, question-less
   `fullTranscript`** (verified in `panel-orchestrator.ts`). USER `seatId` is
   **UI-only**; it does not segment judging. Only COACH `seatId` (Bar Raiser
   drill depth) is judging-critical.

## Backend changes

| File | Change |
|---|---|
| `src/lib/env.ts` | `OPENAI_REALTIME_URL` default → `…/v1/realtime/calls` (GA). |
| `src/lib/coach/openai.ts` | `mintRealtimeEphemeral`: add `audio.input.transcription` (`gpt-4o-transcribe`) + `audio.input.turn_detection` (server VAD). |
| `src/app/api/mock/sessions/[id]/mint/route.ts` | `seatIndex` (default 0) + `seat_handoff` reason; fetch all seats, select `[seatIndex]`, 404 if undefined; `seat_handoff` renewable when LIVE; ceiling guard unchanged (410). |
| `prisma/seed.ts` | Append a machine-readable handoff sentinel to seat0/seat1 prompts ("say exactly: *Handing you to my colleague.*"); seat2 (last) has none. |
| `packages/shared-types/src/mock-schemas.ts` | `mockReportSchema` (verdict + dimensionScores + confidenceMetrics), `mintRequestSchema`, create/status/turn response types; re-export. |
| `src/app/api/mock/sessions/[id]/turns/route.ts` | **Verify only**: USER turn with `words:[]` returns 200 `metrics:null` (it does). No edit. |

## New files

**Logic / transport**
- `src/features/mock-panel/lib/realtime-connection.ts` — headless WebRTC transport around one ephemeral (one seat). No React.
- `src/features/mock-panel/lib/turn-queue.ts` — single-writer in-order commit queue; owns seq assignment + idempotent retry. Pure module (unit-tested without React/network).
- `src/features/mock-panel/lib/mock-api.ts` — typed bare-fetch wrappers for the 6 routes; status+body-discriminated unions (the two distinct create 409s, mint 410/409, complete 409, report FAILED-with/without-reason + 304, byte-for-byte ETag).
- `src/features/mock-panel/hooks/use-mock-panel.ts` — full client state machine + checkpoint loop + recovery paths (pure reducer factored out for tests).
- `src/features/mock-panel/lib/dev-harness.ts` — **Step-1 throwaway** dev harness confirming GA endpoint + event names + transcription enablement against the live API. Deleted after Step 1.

**UI**
- `src/features/mock-panel/views/mock-panel-view.tsx` — the live-panel screen.
- `src/features/mock-panel/views/mock-report-view.tsx` — the report screen (incl. DEBRIEF deliberating + two FAILED screens).
- `src/features/mock-panel/components/panel-seat-rail.tsx` — 3-interviewer presence strip (persona in Fraunces, signal-tint, who's-speaking, per-seat progress ring).
- `src/features/mock-panel/components/composure-meter.tsx` — calm live composure/timer HUD (steadiness language, not a score).
- `src/features/mock-panel/components/recovery-banner.tsx` — every recovery/error state with the right CTA.
- `src/features/mock-panel/components/seat-rollup-card.tsx` — report multi-rater consensus block.
- `src/features/mock-panel/components/inclination-seal.tsx` — hero verdict + Bar-Raiser veto callout.
- `src/app/(dashboard)/mock/page.tsx` — entry: scenario chooser; mic-permission-first then create.
- `src/app/(dashboard)/mock/[id]/page.tsx` — live panel + report route.

**Tests**
- `src/features/mock-panel/__tests__/turn-queue.test.ts`
- `src/features/mock-panel/__tests__/use-mock-panel.test.ts` (pure reducer)

## Files to modify
- `src/features/speaking-coach/components/voice-orb.tsx` — add optional `tint` / `label` / `hint` / `reactive` override props (coach defaults unchanged); a dim cue for the handoff beat.
- `src/app/(dashboard)/layout.tsx` — sidebar nav entry "Bar-Raiser panel" → `/mock`.
- `packages/shared-types/src/index.ts` — re-export the new mock client types.

## Client state machine

`idle → acquiring-mic → creating → connecting → awaiting-session-update → live →
handing-off → wrapping → debrief-polling → report`; plus recovery/terminal:
`reconnecting, reminting, interrupted, already-live, mic-denied, error(reason)`.
The salvage CTA ("End and score") is gated on a **`reachedLive`** flag (complete
returns 409 from PENDING).

Highlights:
- **Mic first**: `getUserMedia` before any mint, so a denial wastes no spend.
- **Two distinct create 409s**: `{error:'Duplicate request', sessionId}` → adopt + resume; `{error:'A session is already live'}` (no sessionId) → `already-live` recovery (never navigate to `/mock/undefined`).
- **Handoff** (`handing-off`): drain the queue for the closing seat → close peer (pause+detach `remoteAudio`, `pc.close()`, keep mic tracks) → `activeSeatIndex++` → `POST /mint {seatIndex, reason:'seat_handoff'}`. 410 → `wrapping`. A 400–600ms "panel conferring" beat (orb dims) — never dead silence.
- **TTL re-mint**: watchdog vs `ephemeral.expiresAt` (runtime-discovered); arm at `-20s` but **defer the swap to a turn boundary** (after `speech_stopped` + `response.done`, hard cap ~5s). On re-mint, **replay committed turns via `conversation.item.create` before re-enabling audio** (a fresh ephemeral = a brand-new server conversation with zero history).
- **SESSION_EXPIRED ceiling**: any mint 410 or turns `sessionExpired:true` → `wrapping`→complete with a calm "you hit the time ceiling" note (not a hard error).
- **Barge-in**: `speech_started` during in-flight COACH response → increment `bargeIns`; do NOT cancel/duck from the client (server VAD truncates). `bargeIns` and `interruptions` are distinct, each counted once.
- **Disconnect**: ICE `disconnected`/`failed` → `PATCH {event:'interrupt'}`, check returned status, only resume-mint if `INTERRUPTED`; 3 fails → `error('disconnected')` with salvage CTA.

## Checkpoint loop

Posts **metadata** turns (never audio) through the single-writer queue. USER
finalizes on `input_audio_transcription.completed`; COACH on
`response.output_audio_transcript.done` (text accumulated from `.delta`). seq at
dequeue; payload frozen at enqueue; retries replay byte-identical bodies. 409
SEQ_CONFLICT → re-reconcile `nextSeq` from `/status`, repair pending queue,
re-post. `drainBeforeComplete()` guarantees every committed turn (esp. seat-2
COACH) reaches the backend before `/complete`. `events` per USER turn matches
`turnEventsSchema` exactly. Spend/ceiling is **server-side wall-clock only**;
`realtimeMsConsumed` is analytics-only.

## UI

- **Live panel**: PageHeader + elapsed timer; PanelSeatRail (3 seat cards, persona in **Fraunces** — serif-for-people-only is the strongest "real evaluators" signal — signal-tint left border, who's-speaking opacity/ring/progress-ring, Bar Raiser badge + explainer); centered tinted VoiceOrb (breathes for coach, reactive to mic for candidate, dims on handoff beat); calm scrolling **hearing-transcript** (streaming COACH deltas with typing shimmer); muted ComposureMeter (steadiness language + "delivery read is approximate in live mode" caveat). Quiet, premium hearing room — not chat bubbles.
- **Report**: InclinationSeal hero (overallSignal in Fraunces + SIGNAL_THEME tint, inclination line, veto callout that **overrides** inclination); SeatRollupCard ("All 3 evaluators agree: …" or "Split read"); dimension scores weakest-first (evidence pull-quote + gap); composure/confidence stat blocks with **graceful sparse/null handling** (— not a fake 0); topStrengths/topRisks chips + "Drill this next" → `/practice?mode=interview`. DEBRIEF = "panel is deliberating…"; two FAILED screens (`judgment_timeout` = transcript saved; no-reason = "failed to start, nothing to score").

## Build order (each step names its gate)

1. **Dev harness FIRST** — confirm GA `/v1/realtime/calls`, GA event names, transcription enablement, VAD spans, barge-in against the live API. **MUST pass before any checkpoint/handoff code.** *(manual; needs a live key + mic)*
2. **env + mint config** — GA URL default + `audio.input.transcription`/`turn_detection`. Gate: vitest + tsc; manual: a fresh mint's `realtimeUrl` is GA and a harness connect gets USER transcripts with no client `session.update`.
3. **mint route** — `seatIndex` + `seat_handoff`. Gate: vitest + tsc.
4. **seed sentinels** — seat0/seat1 closing lines; re-seed. Gate: vitest + manual harness sentinel check.
5. **shared-types** — `mockReportSchema` + request/response types. Gate: vitest + tsc.
6. **mock-api.ts** — discriminated wrappers. Gate: tsc (+ small 409-discrimination unit test).
7. **turn-queue.ts** + test. Gate: vitest (turn-queue test) + tsc.
8. **realtime-connection.ts** — GA WebRTC transport. Gate: tsc + harness-backed manual connect.
9. **use-mock-panel.ts** + reducer test. Gate: vitest (use-mock-panel test) + tsc.
10. **VoiceOrb** extension. Gate: vitest (existing tests green) + tsc.
11. **Presentational components**. Gate: tsc.
12. **Views** (panel + report, incl. sparse-confidence + FAILED screens). Gate: tsc.
13. **Routes + sidebar nav**. Gate: `npm run build`.
14. **End-to-end manual gate** — full panel walkthrough; force TTL re-mint, disconnect/resume, second-tab already-live, never-LIVE start-over; delete dev-harness. Gate: manual + `npm run lint`.

> Steps 1, 8, and the manual portions of 2–4 + 14 need a **live OpenAI key +
> mic + browser** — those are operator-run. Everything else is gated by
> `tsc` / `vitest` / `build` / `lint`, which run here.

## Open risks
- GA event names/endpoint are pinned in this plan but **Step-1 harness is the hard gate** that confirms them against the live API.
- Same-seat re-mint needs `conversation.item.create` context replay; with `MAX_SESSION_SEC=2700` vs a short ephemeral TTL, re-mints are frequent — load-bearing, validate persona coherence manually.
- Re-mints (`:id/mint`) do **not** call `checkRateLimit` (only `POST /sessions` does); the per-session ceiling is the real cost control. Keep re-mints unlimited (mid-LIVE, ceiling-guarded).
- Handoff sentinel reliability — budget cap is the safety net if the model mangles the closing line.
- USER delivery metrics are honestly null in live mode → composure leans on latency + barge-ins; report caveats the delivery dimension.
- Mic `MediaStream` reused across 3 peers — teardown ordering is a gated manual check (echo / lingering OS mic indicator).
- PENDING sessions that never go LIVE hold a spend reservation; a server-side PENDING TTL sweeper is a likely follow-up (global cap + per-session ceiling bound the blast radius for P0).
- Spurious-COACH 3-word threshold is a heuristic; tune against real sessions.

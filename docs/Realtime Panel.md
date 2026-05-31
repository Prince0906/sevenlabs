---
title: Realtime Panel
tags: [architecture]
updated: 2026-06-01
---

# Realtime Panel

The browser-side data plane for the [[Bar-Raiser Panel]] — a headless WebRTC client talking **directly** to the [[OpenAI Realtime API]] (audio never touches Aloud). Lives in `src/features/mock-panel/lib/*`.

## Why three consecutive sessions
**Voice is locked per connection** — OpenAI GA refuses to change a conversation's voice once assistant audio has emitted. Each seat has a distinct voice ⟹ **one WebRTC connection = one seat**. So the panel is **three consecutive sessions over one `MockSession`** (seat 0 → 1 → 2), tearing down, re-minting, and reconnecting at each handoff. This also keeps each persona's instructions config-locked at mint ([[Security]]).

## GA transport details
Client POSTs the SDP offer to `…/v1/realtime/calls` with `Content-Type: application/sdp` + `Authorization: Bearer <ephemeral>`, **no `?model=`**. Event names: COACH transcript = `response.output_audio_transcript.delta/.done`; USER transcript = `conversation.item.input_audio_transcription.completed`. Transcription + server-VAD are baked into the mint config and re-asserted via `session.update`; the client gates `live` on the `session.updated` ack.

## Handoff sentinel
Seat 0/1 prompts end with *"say exactly: Handing you to my colleague."*; seat 2 has none. `panel-machine.ts` matches `HANDOFF_SENTINEL` **or** an exchange-count budget (`seatBudget`: 3 non-last, 4 last) — the budget is the safety net if the model mangles the line.

## The turn queue (`turn-queue.ts`)
A **single-writer, in-order commit queue**. One monotonic `seq` per `MockSession` (`@@unique(sessionId, seq)`), **assigned at dequeue** (not event time) so async USER/COACH events can't race a duplicate. Payload frozen at enqueue; retries replay byte-identical; `seatId` snapshotted *before* handoff advances the active seat. On `409 SEQ_CONFLICT` it reconciles `nextSeq = maxSeq+1` and re-posts. **COACH turns are scoring inputs, not telemetry** — a dropped seat-2 turn silently changes the veto, so they get the same must-deliver treatment.

## State machine (`panel-machine.ts`, pure reducer)
`idle → acquiring-mic → creating → connecting → awaiting-session-update → live → handing-off → reminting/reconnecting → wrapping → debrief-polling → report`. Mic is acquired **before** any mint (denial wastes no spend). TTL re-mint is armed at `-20s` but deferred to a turn boundary; on re-mint, committed turns are replayed via `conversation.item.create` (assistant items **must** use `output_text`, not `text`). No fabricated word timings → USER turns send `words:[]`.

## Related
[[Bar-Raiser Panel]] · [[OpenAI Realtime API]] · [[Judgment Pipeline]] · [[Architecture Overview]] · [[Data Model]] · [[Security]]

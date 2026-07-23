# ADR-0011: Push-to-talk, `turn_detection: null`, one shared input config

- Status: Accepted (2026-06; hardened through three live-test passes)

## Context
Server VAD (voice activity detection) turn-taking caused interviewer
self-interruption and audio cut-offs in live tests. Separately, the realtime
input session was configured in two places (server mint body, client
data-channel patch) — comment-locked duplication that silently broke
transcription when they diverged.

## Decision
Half-duplex **push-to-talk**: `turn_detection: null`; the candidate explicitly
holds/releases the floor. The full input-session config lives in **one**
exported const — `REALTIME_INPUT_CONFIG` in
`packages/shared-types/src/realtime-config.ts` — imported by **both** the
server mint and the client patch.

## Consequences
No barge-in; turn boundaries are deterministic, which the single-writer turn
queue and the judge depend on. Any input-session change happens in exactly one
file. An owning test pins `turn_detection: null` (`mint-route.test.ts`).

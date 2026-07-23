# ADR-0004: The server is never in the audio path

- Status: Accepted (2026-06-11)

## Context
Realtime voice can be relayed through the server (ws-gateway, AudioWorklet PCM
relay, streamed TTS) or connected browser↔provider directly. A relay
reintroduces per-minute COGS, puts a media path on a 1 GiB burstable box, and
adds a latency hop.

## Decision
Browser ↔ OpenAI **directly over WebRTC**, using a short-TTL ephemeral the
server mints (`/api/interview/sessions/[id]/mint`, BYOK-or-house). The Tier-2
streaming gateway was **cut from v1 entirely**. The server sees turn
transcripts and (best-effort) per-answer audio uploads for fluency analysis —
never the live stream.

## Consequences
Voice quality and cost scale with OpenAI, not the box. The BFF stays a thin
control plane (mint/turns/complete/report). Non-realtime providers cannot ride
this path — acceptable, per ADR-0003.

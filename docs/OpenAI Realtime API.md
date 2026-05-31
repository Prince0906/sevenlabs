---
title: OpenAI Realtime API
tags: [architecture, external, research]
updated: 2026-06-01
---

# OpenAI Realtime API

The voice transport behind the [[Realtime Panel]]. **GA, not beta** (announced 2025-08-28 with the first GA model `gpt-realtime`).

## Models
- **`gpt-realtime`** — original GA speech-to-speech model.
- **`gpt-realtime-2`** — current production model in 2026 docs/examples.
- `gpt-4o-realtime-preview-*` — the **older beta name**; superseded (pricing was cut ~20%). Aloud must set `OPENAI_REALTIME_MODEL` to a GA id, **not** a preview id.
- Specialized 2026: `gpt-realtime-translate`, `gpt-realtime-whisper`.

## WebRTC flow (GA)
Two endpoints:
- `POST /v1/realtime/client_secrets` — server mints an **ephemeral** client secret (authed with the real key); response `{ value: "ek_…" }`. See [[Security]].
- `POST /v1/realtime/calls` — establish the call by POSTing the **SDP offer** with `Content-Type: application/sdp` and `Authorization: Bearer <ephemeral>` — **no `?model=`** (model is bound at mint). Response is the SDP answer.
- Events flow over a data channel named **`oai-events`** (JSON, e.g. `conversation.item.create`).
- ⚠️ The old beta shape (`/v1/realtime?model=…` + `OpenAI-Beta` header) is **deprecated** and now fails `beta_api_shape_disabled`.

## Voices, transcription, VAD
- Voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse, **marin**, **cedar** (marin/cedar newest & recommended). Aloud uses `alloy`/`verse`/`sage` for the three seats; **voice is locked once assistant audio emits** — the reason the panel is 3 consecutive sessions ([[Realtime Panel]]).
- **Input transcription** + **server-VAD** turn detection are configured at mint (`audio.input.transcription` = `gpt-4o-transcribe`, `turn_detection: server_vad`). Transcripts are **text-only** (no word timings) — hence [[Confidence Metric|composure]] limits in live mode.

## Pricing (gpt-realtime, token-based)
Audio in **$32 / 1M**, cached in **$0.40 / 1M** (~98.75% off — big lever), audio out **$64 / 1M**. ≈ **$0.06/min in, $0.24/min out**; ~$2–4 per panel. See [[Pricing and BYOK]].

## Sources
- Introducing gpt-realtime — https://openai.com/index/introducing-gpt-realtime/
- Realtime API with WebRTC (docs) — https://developers.openai.com/api/docs/guides/realtime-webrtc
- API pricing — https://openai.com/api/pricing/

## Related
[[Realtime Panel]] · [[Security]] · [[Pricing and BYOK]] · [[Tech Stack]]

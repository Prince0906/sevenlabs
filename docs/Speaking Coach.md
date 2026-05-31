---
title: Speaking Coach
tags: [architecture]
updated: 2026-06-01
---

# Speaking Coach

The turn-based practice loop that exists **today** (the [[Bar-Raiser Panel]] is the real-time successor). Lives in `src/lib/coach/`; BFF routes under `src/app/api/coach/*` call `turn-orchestrator.ts` directly — no separate service.

## The pipeline (`processTurn`)
1. **S3 upload** the user's recorded audio.
2. **Whisper** (`transcribeAudio`, `whisper-1`, `verbose_json`) — word-level timestamps.
3. **Speech analysis** (`coach-core` `analyzeSpeech`, pure/no-I/O) — WPM, fillers, pauses from the word timings. This is what makes the turn-based [[Confidence Metric|composure]] richer than live mode (which has no word timings).
4. **GPT coach reply** (`generateCoachText`, `gpt-4o-mini`, 2-sentence delivery feedback, `max_tokens: 120`).
5. **Rubric scoring** — only in `interview` mode, only with a target company (default `["amazon"]`): `scoreAgainstRubric` (`gpt-4o-mini`, json, parsed by `rubricScoresSchema`).
6. **TTS** (`synthesizeCoachSpeech`, `tts-1`, voice `nova`) → S3.
7. Prisma row write.

All OpenAI calls are raw `fetch` against `api.openai.com/v1` (not the SDK).

## Front end
The browser uses **`@ricky0123/vad-web`** (Silero VAD) to detect speech start/end and hand a WAV blob to `usePracticeSession`. VAD WASM/ONNX assets must live in `public/vad/` (copied by the `copy:vad` postinstall). Turns are idempotent via `PracticeTurn @@unique([sessionId, clientTurnId])`.

## Modes
`interview` / `pitch` / `presentation` / `delivery` — see [[Coaching Modes]].

## Related
[[Coaching Modes]] · [[Architecture Overview]] · [[Data Model]] · [[Product Overview]] · [[Confidence Metric]]

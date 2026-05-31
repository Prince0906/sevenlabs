---
title: Architecture Overview
tags: [architecture]
updated: 2026-06-01
---

# Architecture Overview

A **Next.js 16 standalone single Node process** (no separate realtime/WS service, no broker, no Redis). The load-bearing decision is a **three-plane split**:

```
            ┌─────────── CONTROL PLANE (JSON over HTTPS) ───────────┐
 Candidate ─┤  src/app/api/mock/*  mint · checkpoint · complete · report
            └───────────────────────────────────────────────────────┘
 Candidate ═══ DATA PLANE: browser ⇄ OpenAI Realtime over WebRTC ═══ (audio never touches Aloud)
            ┌─────────── JUDGMENT PLANE (off-band, async) ──────────┐
            │  in-process workers on a PINNED gpt-4o-mini, reading  │
            │  transcripts from Postgres — a socket the voice       │
            │  session can never reach                              │
            └───────────────────────────────────────────────────────┘
```

> *"The line candidate→OpenAI carries audio; candidate→Aloud carries only JSON."*

## Why this shape
- **Cost & privacy:** audio bypasses Aloud entirely → ~$0 audio bandwidth, no voice-PII liability ([[Security]]).
- **Disposable box:** all durable state lives in **external Postgres + S3**; the EC2 box is replaceable ([[Deployment]]).
- **Separation of the moat:** the in-band personas are jailbreakable/leakable, so the *real* proprietary scorer (thresholds/veto/weighting) lives in the [[Judgment Pipeline]] where the voice session has no reach.

## The pieces
- **[[Realtime Panel]]** — the browser WebRTC client (3 consecutive seats), turn queue, and state machine.
- **[[Judgment Pipeline]]** — durable async scoring, deterministic veto, committee verdict, composure.
- **[[Speaking Coach]]** — the turn-based Whisper→GPT→TTS practice loop.
- **[[Data Model]]** · **[[Auth and Routing]]** · **[[Design System]]** · **[[Tech Stack]]** · **[[Deployment]]**.

`src/instrumentation.ts` boots the judgment sweeper once per process; `src/lib/log.ts` is the sole stdout writer (routed through `redact()`).

## Related
[[Realtime Panel]] · [[Judgment Pipeline]] · [[Speaking Coach]] · [[Data Model]] · [[Security]] · [[Tech Stack]] · [[Deployment]]

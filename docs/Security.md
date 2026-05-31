---
title: Security
tags: [architecture]
updated: 2026-06-01
---

# Security

The posture is shaped by one fact: the box has no KMS/IAM yet, and the realtime persona is jailbreakable. So secrets are **ephemeral**, the **real moat lives off-band**, and spend is metered on the **server clock**.

## Ephemeral credentials only
`mintRealtimeEphemeral` (`src/lib/coach/openai.ts`) is the **only** call that ever sees an `sk-` key; it returns a **config-locked** ephemeral (model/voice/instructions bound at mint — for cost/abuse control, not IP secrecy). TTL is runtime-discovered from `expiresAt`, never hardcoded. The proprietary scorer (thresholds/veto/weights) lives in the [[Judgment Pipeline]] where the voice session has no socket. `safety_identifier = sha256(userId + AUTH_SECRET)` is sent as the **`OpenAI-Safety-Identifier` header** (a body field returns 400).

## Redaction (build step #2, before any mint code)
A pure `redact()` masks `sk-`, `sk-ant-`, `AIza`, `ek_`, `Bearer …`. `ProviderError` carries status only (never the provider body). `src/lib/log.ts` is the sole stdout writer; ESLint `no-console` enforces the chokepoint; a Vitest asserts no key prefix escapes.

## Layered spend caps (`src/lib/mock/spend.ts`)
`L0 auth → L1 per-IP mint rate (RateBucket, 10/60s) → L2 per-user rate + single-LIVE-session cap (LIVE_CAP=1) → L3 per-session ceiling (SESSION_CEILING_USD=$4, MAX_SESSION_SEC=2700/45min) → L4 global daily kill-switch (DAILY_CAP_USD=$50, atomic add-if-under-cap → 503 CAPACITY)`. The meter is keyed on **server wall-clock**, never the client-reported time (a malicious client could report 0). One `SpendReservation` per session; re-mint never re-charges; `settleReservation` reconciles down at terminal status. See [[Pricing and BYOK]].

## Prompt injection & CSRF
Transcripts are hostile **data, never instructions** — delimited, scored in a separate off-band call its words can't reach; hallucinated evidence quotes are dropped/turn-anchored. Same-origin Origin/host check + SameSite cookies on every mint/create endpoint.

## BYOK at-rest is gated
Storing a third-party key is **P0 the moment it happens** (KMS CMK + IAM + TLS first), not P2. Launch-blockers: TLS+domain (Caddy is `:80` today — [[Deployment]]), strict CSP+nonce+SRI, and a CREATE-only Prisma migration review.

## Related
[[Architecture Overview]] · [[Realtime Panel]] · [[Judgment Pipeline]] · [[Pricing and BYOK]] · [[Deployment]]

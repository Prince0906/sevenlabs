---
title: Pricing and BYOK
tags: [product]
updated: 2026-06-01
---

# Pricing and BYOK

## The cost shape
The expensive, commoditized part is **live voice** (~$0.06/min input + ~$0.24/min output on `gpt-realtime` — see [[OpenAI Realtime API]]), roughly **$2–4 per panel**. The cheap, *proprietary* part is **judgment** (~sub-cent/session on a pinned `gpt-4o-mini`). See [[Judgment Pipeline]].

## BYOK = cost posture, not the wedge
- **Live voice runs on the USER's key** (post-BYOK), because it's the costly commoditized layer.
- **Judgment ALWAYS runs on Aloud's pinned model** — both v1 and post-BYOK — for *calibration comparability*. Scoring on a varying model would measure model variance, not the candidate.

BYOK is also **the riskiest assumption** ([[Open Questions]]): an anxious new-grad is the least likely person to own a billing-enabled key. So **v1 launches on Aloud's own capped key** with a hard per-session spend ceiling ([[Security]]), proves the [[Bar-Raiser Panel]] beats free ChatGPT voice, and *then* measures conversion at the key-wall before building the BYOK custody stack.

## Two pricing models to reconcile (OPEN)
- **PRODUCT_STRATEGY:** Free / Pro **$19/mo** / Annual **$149**, weaponizing *transparent billing, no annual tricks, 14-day refund* against Final Round AI (see [[Competitive Landscape]]).
- **Confidence-engine:** free-on-your-key BYOK + a thin managed-key SaaS later.
- **Proposed unified:** Free (capped key) → BYOK (your key, ~$0 to Aloud) → Pro ~$19/mo (managed key + fast lane) → B2B seats.

## Key custody status
BYOK key-at-rest is **gated on real isolation** (KMS CMK + IAM + TLS). v1 default = client-only / use-once, never stored. The envelope-encrypted `UserApiKey` model is **P1, not in the schema yet**. See [[Security]].

## Related
[[Roadmap]] · [[Open Questions]] · [[Competitive Landscape]] · [[Security]] · [[OpenAI Realtime API]] · [[Moat]]

---
title: Glossary
tags: [reference]
updated: 2026-06-01
---

# Glossary

- **Aloud** — the product: voice-first FAANG interview prep that tells the truth. See [[Product Overview]].
- **Signal** — the level a candidate reads as: **New Grad / SDE II / Senior** (amber/blue/emerald). See [[Signal Levels]]. `SIGNAL_TO_SCORE = {40, 70, 90}`.
- **[[Bar-Raiser Panel|Panel]]** — the three-interviewer real-time loop; Aloud's [[Moat|moat]].
- **Seat** — one interviewer in the panel (Maya / Dev / Priya), each with a distinct voice and owned [[Leadership Principles]]. Because voice is locked per connection, **one seat = one WebRTC session** ([[Realtime Panel]]).
- **Bar Raiser** — the independent senior interviewer with **veto** power; modeled on the real [[Amazon Bar Raiser]].
- **Handoff sentinel** — the exact line *"Handing you to my colleague"* that triggers the seat→seat transition (with an exchange-budget fallback). See [[Realtime Panel]].
- **Composure** — the v1 [[Confidence Metric]]: filler/WPM-steadiness/pause control × difficulty weight.
- **Veto** — a **deterministic** (code, not model) Bar-Raiser block at drill depth `>= 2` when its LPs collapse → forces NO_HIRE. See [[Judgment Pipeline]].
- **Inclination** — the 6-value committee outcome: `STRONG_HIRE | HIRE | LEAN_HIRE | LEAN_NO_HIRE | NO_HIRE | STRONG_NO_HIRE`.
- **Committee verdict** — the synthesized panel result (`panelVerdictSchema`) with seat rollup, strengths, risks.
- **Ephemeral key** — a short-TTL, config-locked OpenAI credential (`ek_…`); the only secret the browser sees. See [[Security]], [[OpenAI Realtime API]].
- **BYOK** — Bring Your Own Key; the cost posture (live voice on the user's key, judgment always on Aloud's). See [[Pricing and BYOK]].
- **seq** — the single monotonic per-session turn counter, assigned at dequeue by the [[Realtime Panel|turn queue]].
- **MockSession / MockTurn** — the panel's session + turn rows ([[Data Model]]).
- **JudgmentJob** — the durable work-ticket that guarantees a DEBRIEF gets scored even across redeploys ([[Judgment Pipeline]]).
- **Three planes** — control (JSON/HTTPS) · data (browser⇄OpenAI audio) · judgment (off-band). See [[Architecture Overview]].
- **STAR** — Situation/Task/Action/Result, Amazon's behavioral-answer structure ([[Amazon Bar Raiser]]).
- **oneRep / drill** — the single recommended next practice rep in the report ([[Judgment Pipeline]]).
- **Spend ceiling** — the per-session $4 / 45-min cap in the layered spend defense ([[Security]]).
- **Presence / `.panel-stage`** — the cinematic interviewer orbs + room atmosphere ([[Design System]]).

## Related
[[Home]] · [[Architecture Overview]] · [[Bar-Raiser Panel]] · [[Judgment Pipeline]]

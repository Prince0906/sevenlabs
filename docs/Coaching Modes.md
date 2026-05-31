---
title: Coaching Modes
tags: [product]
updated: 2026-06-01
---

# Coaching Modes

Two axes: the **practice mode** (what kind of session) and the **difficulty** (how hard the interviewer pushes).

## Practice modes ([[Speaking Coach]])
Each mode has its own hardcoded prompt bank + system prompt in `coach-core/coach-prompt.ts`:
- **`interview`** — behavioral Q&A; the only mode that runs **rubric scoring** (against a target company, default `["amazon"]`).
- **`pitch`** — pitch/elevator delivery.
- **`presentation`** — presenting/explaining.
- **`delivery`** — free practice, delivery feedback only.

## Difficulty (`ScenarioDifficulty`)
`WARMUP / CALIBRATED / ADVERSARIAL` → integer 2/3/4 → applied as a weight in the [[Confidence Metric]] (0.95 / 1.00 / 1.06). The product default is **warm**; adversarial is an opt-in "boss mode," guarded so "harder than real" never makes anxious users more anxious ([[Vision]]).

> The difficulty governor expands a 1–5 dial into concrete knob values (follow-up depth, vagueness tolerance, interruption, time cap, silence tactic…). The LLM chooses follow-up **content**, never **whether** to follow up — that's deterministic.

## Scenario taxonomy (designed, mostly parked)
P0 = S1 Standard STAR + **S2 Bar-Raiser drill** (the moat, see [[Bar-Raiser Panel]]) + one capped S8 full panel. P1 = rapid-fire / curveball / conflict / "tell me about yourself". P2 = system-design talk-through. See [[Roadmap]].

## Related
[[Speaking Coach]] · [[Bar-Raiser Panel]] · [[Confidence Metric]] · [[Vision]] · [[Roadmap]]

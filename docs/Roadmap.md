---
title: Roadmap
tags: [vision]
updated: 2026-06-01
---

# Roadmap

Brutal sequencing — build the smallest thing that proves the [[Moat]], and kill it fast if it doesn't.

## Shipped (on `main`, NOT yet live)
Rubric scoring + [[Signal Levels|Signal]] read, the practice cockpit, a shareable Signal card, the Aloud rebrand + [[Design System|cinematic redesign]], and a public landing page. The [[Bar-Raiser Panel]] P0 (backend + realtime client + judgment + report) is code-complete, unit-tested, and green — blocked only on a live-key walkthrough.

## Phase 0 — Go live (the single biggest blocker)
Deploy on the cheap single-EC2 stack (see [[Deployment]]). Nothing is learned until real users can reach it.

## Phase 1 — Prove ONE panel
Run **one Amazon Bar-Raiser panel live on Aloud's own capped key** with a hard per-session spend ceiling ([[Security]]) and the structured [[Judgment Pipeline|report]]. Acceptance test: *if a tester doesn't say "this is different," stop and rethink.*

## Phase 2 — BYOK + the loop
[[Pricing and BYOK|BYOK]] custody, full CI, the drill loop + longitudinal tracking, more scenarios ([[Coaching Modes|rapid-fire / curveball / conflict / TMAY]]), and warm/boss-mode difficulty.

## Phase 3 — Scale
Multi-company rubrics (Google/Meta), system-design talk-through, deeper calibration, and B2B (bootcamps/universities) + a managed-key SaaS "fast lane."

## Related
[[Vision]] · [[Bar-Raiser Panel]] · [[Pricing and BYOK]] · [[Deployment]] · [[Open Questions]]

---
title: Design System
tags: [architecture]
updated: 2026-06-01
---

# Design System

**Forced-dark, warm cinematic** — a single theme (next-themes `forcedTheme="dark"`, so all shadcn `dark:` variants activate; the light/dark toggle was removed). Tailwind v4 (CSS-first, `@theme inline`) + shadcn. Tokens in `src/app/globals.css`.

## Palette
Warm near-black room `oklch(0.205 0.013 52)`, warm cream ink, a glowing **clay** accent (`--clay` non-text / `--clay-strong` text). The body carries a faint fixed warm top light-source gradient so the whole app shares the "room" atmosphere.

## Signal colors = the soul
The one place saturated color appears, so color always means *level* ([[Signal Levels]]): **amber = New Grad, blue = SDE II, emerald = Senior** (`--signal-newgrad/sde2/senior`). Mapped in `src/lib/signal.ts`; seats tied to the climb in `seat-theme.ts`.

## Type
**Fraunces** (serif display — headlines, hero numbers, **persona names**) + **Hanken Grotesk** (body) + Geist Mono. *"Serif-for-people-only"* — Fraunces on interviewer names is the strongest "real evaluators, not one LLM" cue.

## The cinematic room (`.panel-stage`)
The [[Bar-Raiser Panel]] layers extra atmosphere over the global dark: a warm radial light from the top + a vignette pooling inward + a filmic `feTurbulence` grain (opacity 0.06, overlay blend). Three **presences** (interviewer orbs) recede / spotlight / lean-in; the speaking one breathes (`@keyframes panel-breathe`); the central voice orb glows and reacts to mic amplitude; the verdict "lights the room." Glow vocabulary is unified (colored glow ≈ `color-mix(…55%, transparent)`, blur scaled to element). Not chat bubbles — a quiet premium "hearing room."

## Related
[[Signal Levels]] · [[Bar-Raiser Panel]] · [[Product Overview]] · [[Architecture Overview]]

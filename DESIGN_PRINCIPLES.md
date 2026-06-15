# Design Principles

The few rules that keep Aloud's UI consistent. When in doubt, reuse what exists.

## Theme
- **One theme: cinematic warm‑dark.** `forcedTheme="dark"`. No light mode, no user toggle.
- The `.panel-stage` atmosphere (warm top light, vignette, film grain, a breathing orb) is the room; keep it for the live panel + verdict.

## Color = meaning (never decoration)
- **Signal scale** is reserved for *level/status only*: New Grad `--signal-newgrad` (amber) → SDE II `--signal-sde2` (blue) → Senior `--signal-senior` (emerald). Via `SIGNAL_THEME` / `SIGNAL_CSS_VAR` (`src/lib/signal.ts`).
- **`--destructive`** (red) for destructive/error actions — never an amber Signal color.
- **`--clay` / `--clay-strong`** is the one warm accent.
- Don't introduce new colors in components.

## Type
- **Fraunces** (`font-display`) for headlines — editorial serif, optical sizing, tight tracking.
- **Hanken Grotesk** for body, **Geist Mono** for numbers/code.
- Eyebrows: `text-[11px] uppercase tracking-[0.16em] text-muted-foreground`.

## Voice
- Calm, honest, second‑person, anxiety‑aware. ("Your turn." "Pauses are fine." "Read this verdict as directional.")
- Say "Bar Raiser", "panel", "committee verdict" — sell the live interview, not a coach.

## Motion
- Delightful by default, but **always respect `prefers-reduced-motion`** (`useReducedMotion` + the CSS media block in `globals.css`). Animations are additive, never required to understand the UI.

## Components
- **One primitive substrate: Base UI** (`@base-ui/react`). `Button` keeps the `asChild` API mapped to Base UI's `render`. Add sizes/variants to the shared primitives — don't fork them.
- Shared motion lives in `src/lib/motion.ts` (`staggerContainer` / `staggerItem` / `pageTransition`).

## Protect the signature surfaces
The **live room** (3‑seat presence, active‑speaker orb, streaming transcript, calm push‑to‑talk) and the **verdict** (inclination seal, per‑seat rollup, shareable signal card) are the product. Improve their edges; don't redesign them.

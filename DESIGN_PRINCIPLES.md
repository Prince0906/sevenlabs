# Design Principles

The few rules that keep Aloud's UI consistent. When in doubt, reuse what exists.

## Theme — Chalk & Cobalt

- **One theme: light. No exceptions.** `forcedTheme="light"`. The whole app lives in daylight — paper ground, ink text. No dark mode, no user toggle. Even the social-export card (`shareable-signal-card.tsx`) is a paper piece; it uses explicit hexes (html-to-image needs them), including deepened trio tones for display text on white.
- **Game-piece physicality is the identity.** Loud surfaces are *pieces*: `2px` ink border + hard offset shadow (`shadow-[4px_4px_0_0_var(--foreground)]`), pressing travels into the shadow. `Card` (default), `Dialog`, and the loud `Button` variants are pieces; quiet surfaces (dense lists, rows) use `Card size="sm"` / 1px `border-border` hairlines.
- **Flat fills only. No gradients, no blur glows, no film grain, ever.** Bands of color meet at hard stops.

## Color = meaning (never decoration)

| Token | Value | The rule |
|---|---|---|
| `--background` / `--card` | paper `#F7F8FB` / white | the ground |
| `--foreground` | ink `#15181E` | text, 2px edges, offset shadows |
| `--muted-foreground` | slate `#5C6673` | secondary text |
| `--border` | hairline `#D9DDE6` | quiet 1px lines |
| `--primary` / `--ring` | **cobalt `#2B50F0`** | THE brand accent: primary buttons, links, active nav, focus. Nothing else gets to be blue. |
| `--destructive` / `--live` | **red `#E5484D`** | live mic / on-air + destructive only. **If it's red, you're on air.** |
| `--signal-newgrad/sde2/senior` | orange `#ED7A1E` / sky `#3AA4EC` / green `#199D5C` | level/status meaning ONLY (via `SIGNAL_THEME`, `src/lib/signal.ts`) — never chrome. As text, only at display sizes; at body size use ink text + a trio mark (dot/band). |

- Don't introduce new colors in components. `--clay` is gone; don't bring it back.

## Type

- **Bricolage Grotesque** (`font-display`) for headlines — chunky grotesk, tight tracking.
- **Hanken Grotesk** for body.
- **Geist Mono for every number that matters** (`font-mono tabular-nums`) — ratings, countdowns, scores, streaks. Big numbers are the voice of the product; keep text minimal around them.
- Eyebrows: `text-[11px] uppercase tracking-[0.16em] text-muted-foreground`.

## Voice

- Calm, honest, second-person, anxiety-aware. ("Your turn." "Pauses are fine." "Read this verdict as directional.")
- Say "Bar Raiser", "panel", "committee verdict" — sell the live interview, not a coach.
- Show, don't tell: prefer a meter, a stamp, a chip over a paragraph.
- **No em dashes (—) in user-facing copy** — they read as AI-written. Use periods, commas, or colons; split the sentence. Hyphens in compound words and `·` separators are fine. (Docs/comments may keep dashes.)

## Motion

- Delightful by default, but **always respect `prefers-reduced-motion`** (`useReducedMotion` + the CSS media block in `globals.css`). Animations are additive, never required to understand the UI.
- Press feedback comes from the piece physics (translate into shadow), not from scale/opacity tricks.

## Components

- **One primitive substrate: Base UI** (`@base-ui/react`). `Button` keeps the `asChild` API mapped to Base UI's `render`. Add sizes/variants to the shared primitives — don't fork them.
- Shared motion lives in `src/lib/motion.ts` (`staggerContainer` / `staggerItem` / `pageTransition`).
- `.piece` / `.piece-press` utilities (globals.css) exist for feature surfaces that can't use `Card`/`Button`.

## Protect the interaction invariants

The **live room** mechanics are live-test-hardened — restyle freely, but never break: the two-tap push-to-talk (single button, disabled while the interviewer speaks), the presences rail pinned above the scroll area and the PTT bar pinned below it, the `role="log" aria-live` transcript (streaming line `aria-hidden`), the reduced-motion gates (orb RAF, celebration, CSS block), and the degraded-delivery banner on partial transcripts.

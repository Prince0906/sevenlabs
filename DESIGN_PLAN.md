# UI/UX Design Plan

Last updated: 2026-05-29

Companion to [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md). The strategy doc decides *what* we build and *why* (voice-first FAANG behavioral practice with company-rubric scoring). This doc decides *how it looks and feels* — and specifically how the design itself becomes an acquisition and retention lever, not just a skin.

---

## 0. The one-sentence diagnosis

The app is a **competent, untouched default shadcn build** — 100% grayscale, Inter, tiny uppercase labels — which means it is clean but has **no identity, no emotion, and renders its two most valuable moments (the live voice interaction and the leadership-signal reveal) as the most forgettable elements on screen.** It looks like a well-organized side project, not a $19/mo product a candidate trusts with the most stressful month of their year.

The fix is not "add gradients." It is to make the design *do the selling and the retaining* by aligning every screen with the candidate's actual psychology.

---

## 1. Who we are designing for (the emotional truth)

The user is **anxious**. They have an interview in 4–8 weeks, they're scared of behavioral rounds, and they're paying us instead of a $500/hr coach because they want to *feel ready*. Every design decision should be judged against one question:

> Does this make an anxious candidate feel more in control, more capable, and more certain they're improving?

This reframes the whole product. We are not selling "speech metrics." We are selling **the feeling of walking into the interview calm and prepared**, and **visible proof they are leveling up**. The current UI is emotionally flat — it neither calms nor excites. That is the core problem.

---

## 2. End-to-end audit (surface by surface)

| Surface | File | Current state | Verdict |
|---|---|---|---|
| Design tokens | `globals.css` | Default shadcn "neutral" — every color token is `oklch(… 0 0)` (zero chroma = pure gray). Dark-mode tokens defined but **no `ThemeProvider` mounted** → dead code. | ❌ No brand. No color = no meaning, no memory, no emotion. |
| Type / brand | `layout.tsx` | Inter + Geist Mono. Title "Seven Labs", description "Voice cloning, TTS, and speaking coach". | ❌ Off-brand name + description (leftover from a different product). No display face. |
| Sidebar shell | `dashboard-sidebar.tsx` | Clean icon-collapsible sidebar. Logo "Seven Labs". Help links to a **personal Gmail** (`cristiahydra@gmail.com`). | ⚠️ Structurally fine; branding + support links unshippable. |
| Cockpit / dashboard | `dashboard-view.tsx` + cards | Greeting, countdown, 3 stat cards (Streak/Signal/Stories), Today's Drill, WeekStats, 2 link tiles. Good IA. | ⚠️ Right *content*, zero *hierarchy of emotion* — the countdown (the engine) is one gray block among equals. `recharts` is installed but no trend chart is rendered. |
| **Live voice (practice)** | `practice-view.tsx`, `practice-vad.tsx` | **`PracticeVad` returns `null`.** The only "live" feedback while recording is a 2px pinging dot. | 🔴 **Single biggest miss.** A voice product where your voice is invisible. Users can't tell it's listening; the magic moment feels broken. |
| **Signal reveal** | `session-results.tsx`, `signal-pointer.tsx` | Big "Signal" number (good instinct), a 1px slider line, LP grid, level-up text, delivery stats. | 🔴 The peak moment of the product, rendered in grayscale. New Grad and Senior look *identical*. No celebration, no share. |
| **Leadership signal block** | `rubric-score-block.tsx` | A gray uppercase label + `border-l-2` text list. | 🔴 This is the feature the strategy calls "screenshot-shareable, the thing no incumbent can copy." It is currently the **least** distinctive element in the app. Not shareable. No visual punch. |
| Metrics | `metrics-panel.tsx` | 6 numbers in a grid. | ⚠️ No visualization, no "good/bad" context (is 140 wpm good?). Just digits. |
| History list | `session-history-view.tsx` | Clean list, signal as gray text. | ⚠️ Fine; signal needs color; no sense of trajectory. |
| Session detail | `practice/history/[id]/page.tsx` | Same card stack. Raw native `<audio controls>`. Only coach audio — **no playback of the user's own answer.** | ⚠️ Native player breaks the design; self-review (hear yourself) is missing. |
| Auth | `auth-shell.tsx`, `sign-in-form.tsx` | Split-screen, genuinely good copy ("hear exactly where you lost the interviewer"). But gray text wall, no proof, "Seven Labs" branding. | ⚠️ Best-written surface; visually unproven and off-brand. |
| **Public landing page** | — | **Does not exist.** Unauthenticated users hit `/sign-in`. | 🔴 No top-of-funnel. Nothing to share, link, or convert a cold visitor. The auth left-panel is the only "marketing." |

**Pattern across everything:** the information architecture is largely *right* (the strategy was implemented faithfully), but the **visual and emotional layer is missing entirely**. We're shipping the skeleton of a great product with none of the skin that makes people feel something and tell their friends.

---

## 3. The eight psychology levers (and the design move each one demands)

These are the principles the redesign is built on. Each maps to a concrete move.

1. **Loss aversion + the deadline effect.** A countdown to a fixed date is one of the most powerful motivators in behavioral design. → Make the **interview-date countdown the undisputed hero** of the dashboard, with weight and a hint of urgency as it shrinks. The empty state ("set your interview date") becomes the #1 onboarding CTA.

2. **Goal-gradient + endowed progress.** People accelerate toward a goal they can *see* themselves approaching, especially if progress is already started for them. → A visible **"Path to Senior"** track (New Grad → SDE II → Senior) that fills as they improve; story bank as "3/7 complete"; never start them at a cold 0.

3. **Peak-end rule.** People judge an experience by its emotional peak and its end. → The **Signal reveal at the end of a session must be the peak** — an animated, color-saturated, celebratory moment, not a gray number. This is the single highest-leverage emotional investment in the app.

4. **Variable reward / leveling up.** The dopamine of "I leveled up" drives return visits. → Treat **New Grad → SDE II → Senior as game levels** with a distinct color each and a level-up animation + micro-celebration when the signal rises. This is the retention engine.

5. **Social proof.** Anxious buyers de-risk by copying others. → **Target-company logos** ("practice for the Amazon bar"), a testimonial, "N engineers practiced this week," and the shareable signal card seeding word-of-mouth.

6. **Commitment & consistency (streaks).** The streak already exists in data; it's invisible emotionally. → Make the streak **visible and loss-averse** ("Don't break your 6-day streak") — a small flame/ring that the user doesn't want to reset.

7. **Zeigarnik effect (open loops pull you back).** → "Today's drill" framed as an unfinished daily ritual; the story bank's empty slots ("4 stories left to polish") act as open loops that nag in a good way.

8. **Trust as a feature.** The strategy explicitly weaponizes Final Round AI's billing complaints. Trust is communicated *visually* — premium, consistent, transparent design signals "this is a real, safe company." → A coherent brand, a transparent pricing surface, real support, no native browser chrome. Cheap-looking = untrustworthy; the current grayscale reads "unfinished."

---

## 4. The design plan

### 4.1 Foundation — the highest-leverage change (do this first)

Everything else compounds on this. A real, restrained, *meaningful* design system.

**Color philosophy: neutral base, color as meaning.** Keep a calm near-neutral canvas (off-white / ink — the anxiety-reducing base) and reserve saturated color for **signal and status**, so color always *means something*. This is what separates "industry-standard premium" (Linear, Stripe, Vercel) from "rainbow side-project."

- **Brand primary:** a deep, trustworthy indigo/violet (competence + calm + "tech premium"). Used sparingly for primary actions and brand marks.
- **The Signal progression scale — the soul of the product:**
  - **New Grad → amber/clay** (warm, "emerging")
  - **SDE II → blue** (solid, "competent")
  - **Senior → emerald** (strong, "arrived")
  
  The candidate literally *watches themselves move from warm to cool-green as they level up.* This single system makes the dashboard, signal reveal, history, and scorecard instantly legible and emotionally charged. Today all three look identical gray.
- **Semantic:** keep destructive red; add a success/positive token (currently none).

**Typography: add a display face.** Pair Inter (body, keep) with a characterful **editorial serif display face for hero numbers and headlines** — the countdown, the signal level, section titles (e.g. Fraunces / Newsreader vibe) for a *premium, confident, "this is serious prep"* feel that almost no competitor uses — instant differentiation. (Locked: editorial premium, per D3.)

**Also:** define an elevation scale (we're flat — everything is `border bg-card`), a consistent motion language (we have `framer-motion` + `lib/motion.ts` already — extend it), and mount the `ThemeProvider` so the dark tokens that already exist come alive (dark mode reads as "premium tool" to engineers; high ROI since the tokens are written).

> Effort: ~1–2 days. This is mostly editing `globals.css` tokens, adding fonts, and a small `signal-color` util. Because everything uses semantic tokens (`bg-card`, `text-muted-foreground`), the base recolor propagates app-wide for free.

### 4.2 Signature moment #1 — make the voice *visible* (practice view)

This is the broken core. While `phase` is `your-turn` / `listening`, render a **live, responsive voice visualization** driven by mic amplitude — an animated orb or radial waveform that breathes and reacts as the user speaks. States:

- **Your turn (idle mic):** a calm, softly pulsing ring — "I'm ready, go ahead."
- **Listening (speaking):** the ring/orb reacts in real time to volume — unmistakable "I hear you."
- **Analyzing:** a determinate-feeling progress shimmer — "I'm thinking about your answer."
- **Coach speaking:** audio-reactive on playback.

`PracticeVad` already has the mic stream; we surface an amplitude value and feed a canvas/SVG visual. This is *the* signature interaction — the thing that makes the product feel alive and trustworthy and screen-recordable. Pair it with the question shown large and calm above it (reduce anxiety: one thing at a time).

> Effort: ~2 days (the visualization is the bulk). Highest experiential ROI in the app.

### 4.3 Signature moment #2 — the Signal reveal (peak-end + shareable)

Redesign `SessionResults` so the end of every session is a *moment*:

- The signal level reveals with an **animated count-up / level-into-color** transition, rendered in its progression color (amber/blue/emerald), large and proud.
- If the signal improved, a **level-up micro-celebration** ("↑ You moved from SDE II to Senior") — the variable-reward hit.
- The **"Path to Senior" track** animates the pointer to the new position (upgrade `signal-pointer.tsx` from a 1px gray line to a colored, milestone-marked track).
- A **shareable Signal Card**: a self-contained, beautifully composed card (signal level, top LP, one evidence quote, branded footer) with a **"Share / Download" button** that exports a PNG. This is the strategy's "screenshot for Twitter/LinkedIn" made real — every share is free acquisition.

> Effort: ~2 days incl. the PNG export.

### 4.4 The Leadership scorecard (the differentiator, redesigned)

Rebuild `RubricScoreBlock` from a gray text list into a **visual scorecard**:

- Each matched LP as a **chip/row with its signal-level badge in the progression color** and a small level indicator.
- The evidence rendered as a **styled pull-quote** ("you said: …") so the user sees their own words graded — visceral and specific.
- "Level up next" as a distinct, action-colored callout (it's the most valuable sentence in the product — the thing humans pay $225/session for).

This is the screen that proves "we grade *content*, not just delivery" — it must look as smart as it is.

### 4.5 Cockpit / dashboard (emotional hierarchy + a real chart)

- **Countdown becomes the hero** — large display type, top of page, with a subtle urgency treatment as the number drops. No interview date set? That's the primary onboarding CTA, framed around the deadline.
- **Streak** as a loss-averse visual (flame/ring), not a stat tile.
- **Signal trend chart** — use the already-installed `recharts` to draw the signal/filler trajectory over recent sessions (goal-gradient made visible). This is the "am I improving?" answer the anxious user opens the app for.
- **Today's drill** styled as a daily ritual / open loop.
- Stat tiles get the signal color system so "Signal: Senior" is emerald, not gray.

### 4.6 The acquisition surface — a public landing page (currently zero)

Build a public `/` (or `/welcome`) marketing page — the top of the funnel that doesn't exist:

- **Hero:** the positioning line ("Practice your FAANG answers out loud. Get scored against the company's actual rubric.") + a live demo of the **shareable Signal Card**.
- **The "great answer!" wedge:** a side-by-side — *Them: "Great answer! 👍"* vs *Us: "New Grad signal on Ownership — a Senior would have named the decision."* This is the strategy's core differentiator, dramatized.
- **Company logos** (Amazon now; Google/Meta "coming").
- **Transparent pricing** with "No annual tricks. Cancel anytime. 14-day refund." stated on the page — the trust weapon, at zero eng cost.
- Social proof slot + a single clear CTA to sign up.

> Effort: ~2–3 days. This is the difference between "an app you can log into" and "a product you can launch and share."

### 4.7 Auth conversion surface

Keep the strong copy. Add the missing *proof* to the left panel: a real product visual (the Signal Card / live orb), company logos, and one testimonial. Rebrand. Conversion surfaces convert on proof, not prose.

### 4.8 Trust & polish (small, unshippable-without)

- Real **brand name + logo + favicon + OG image** (rename confirmed — D1; via a single brand token + flagged usage inventory). Fix `metadata` (title/description still say "Voice cloning, TTS").
- Replace the personal Gmail support links with a real support address / route.
- Replace native `<audio controls>` with a styled player; add **playback of the user's own answer** (self-review).
- Mount `ThemeProvider`; ship dark mode.
- Accessibility pass: the all-gray text leans heavily on `text-muted-foreground` — verify contrast ratios once color lands.

---

## 5. Phased rollout

**P0 — Brand foundation — ✅ DONE (2026-05-29).** Editorial-premium token system (warm paper/ink base + Signal color scale amber→blue→emerald) in `globals.css`; Fraunces (display) + Hanken Grotesk (body) fonts; `ThemeProvider` + dark mode + `ThemeToggle`; "Aloud" brand via `lib/brand.ts` + `components/logo.tsx`; metadata/OG/support cleanup; Signal colors + display face wired into the signal-bearing components (signal card, pointer, rubric block, session results, history, week stats, countdown). Verified: tsc + 48 tests + lint + prod build all green. *Everything downstream depends on this; it also instantly lifts every existing screen via semantic tokens.*

**P1 — The two signature moments — ✅ DONE (2026-05-29).** Live voice visualization (`voice-orb.tsx`) reactive to real mic amplitude via the VAD's `onFrameProcessed` frames, with phase-tinted ambient glow — replaces the old 2px pinging dot. Shareable Signal reveal: `shareable-signal-card.tsx` (dark, branded, full amber→blue→emerald progression) rendered as the results hero, with a one-click PNG export (`html-to-image`) and a level-up celebration. The Leadership scorecard (4.4) got its color treatment in P0. Verified: tsc + lint + 48 tests + build green. *Manual mic test still recommended to confirm orb reactivity (can't be verified headlessly).*

**P2 — Acquisition + retention surfaces — ✅ MOSTLY DONE (2026-05-29).** Public **landing page** at `/` (`features/marketing/landing-view.tsx`): hero with the live Signal product card, the "Great answer! 👍 vs. New-Grad-on-Ownership" wedge, how-it-works (signal-colored), company chips, transparent pricing ("No annual tricks…"), staggered-reveal motion. **Routing rewired**: `/` is the public marketing page (authed users redirect to `/dashboard`); the dashboard moved from `/` to `/dashboard`; `auth.config.ts` opens `/` (exact match); sidebar nav + sign-in/up callbackUrls point to `/dashboard`. **Dashboard signal-trend chart** (`signal-trend-chart.tsx`, recharts) plots `signal.history` (New Grad→Senior climb). Auth proof (4.7) shipped with the colorful auth panel earlier. Verified: build + tsc + lint + 48 tests green. **Still pending (4.8):** styled audio player + user self-playback; real logo favicon/OG image; formal trademark + domain for "Aloud".

Roughly **8–10 focused days** for the full arc; P0+P1 alone (≈1 week) transforms the in-app experience.

---

## 6. Decision points — RESOLVED (2026-05-29)

- **D1 — Brand name → "ALOUD".** Renamed from "Seven Labs". Centralized in `src/lib/brand.ts` (`BRAND`) + an editorial serif wordmark in `src/components/logo.tsx`; all usages (metadata/OG, sidebar, auth, support email) route through it. **Caveat:** `aloud.com` (Bauer Media) and Google's "Aloud" dubbing tool exist in the broader audio space — the name is clear *within interview prep* but the bare `.com` is gone. Pick a modified domain handle (`aloud.ai` / `tryaloud.com` / `aloud.app`) and run a trademark check in the edtech/software class before launch spend. `BRAND.supportEmail` is a placeholder pending the domain.
- **D2 — Public landing page → IN SCOPE.** The top-of-funnel marketing page (4.6) is part of this launch's P2.
- **D3 — Visual direction → EDITORIAL PREMIUM.** Restrained neutral/ink base + the Signal color progression (amber→blue→emerald) + an editorial serif display face for hero numbers/headlines. Premium, distinctive, trust-forward. This sets the tone of all P0 work.

---

## 7. How we'll know it worked (metrics)

Design changes should be measurable, not just prettier:
- **Activation:** % of new users who complete a first scored interview turn (the live-voice fix should lift this).
- **Share rate:** signal cards shared/downloaded per session (acquisition loop).
- **D7 retention / streak length** (goal-gradient + loss aversion).
- **Free→Pro conversion** (trust + landing + the differentiator made visible).
- **Sessions per user per week** vs the 3/week target already in `WeekStats`.

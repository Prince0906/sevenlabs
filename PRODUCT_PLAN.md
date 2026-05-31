# Aloud — Product Plan

Last updated: 2026-05-29. **Top-level, product-only plan for the whole of Aloud.** Architecture/system design is intentionally excluded (separate work). This doc is the index; deeper detail lives in [PRODUCT_STRATEGY.md](PRODUCT_STRATEGY.md) (market + competitors + pricing research), [DESIGN_PLAN.md](DESIGN_PLAN.md) (UX/brand), [CONFIDENCE_ENGINE_PLAN.md](CONFIDENCE_ENGINE_PLAN.md) (the live engine, incl. its architecture), and [DEPLOY.md](DEPLOY.md) (hosting).

---

## 1. What Aloud is

**Aloud is voice-first interview prep that tells SWE candidates the truth.** You practice your FAANG behavioral answers *out loud*, and every answer is scored against the company's actual rubric — so you learn whether you read as **New Grad, SDE II, or Senior**, not just whether you said "um." The deeper purpose: **build the candidate's confidence speaking under pressure** so they walk into the real room calm and ready.

The product is on a deliberate arc, each step raising the ambition:

> generic delivery coach → **interview-prep with company-rubric scoring** (today) → **a real-time, adversarial "confidence engine"** (next chapter).

---

## 2. The problem & who it's for

**Target user:** a software engineer with a FAANG-tier interview in **4–8 weeks** who is anxious about behavioral rounds (STAR, Amazon LP alignment, "tell me about a time"), has *typed* answers into ChatGPT but **never said them out loud and been honestly judged**, and wants something cheaper than a $500/hr coach and more useful than a free voice memo.

**Why they're unserved today:** the whole AI category suffers from **"Great answer! 👍" theater** — tools (and ChatGPT) are tuned to be agreeable and grade delivery or surface structure, but **none grade the strategic *content* the way a human coach does** ("you sounded New Grad on Ownership; a Senior would have named the decision they made under ambiguity"). Apex ($100/mo) prices out students; Final Round AI is an ethically-gray live-interview copilot; Pramp peers can't evaluate STAR; Interviewing.io is $225/session. **No one offers voice-first behavioral practice with company-specific rubric scoring at a sub-$25 price.**

---

## 3. Positioning & the moat

**Positioning line:** *"Every other tool says 'great answer.' Aloud tells you you'd get rejected — and exactly how to fix it. Practice harder than the real interview, walk in confident."*

**The moat is not the conversation** (ChatGPT/Gemini voice already roleplay an interviewer for free). It's four things a raw, agreeable, stateless LLM voice structurally can't be:
1. **Calibration** — scored to the company's real rubric → a trusted *level*, consistent across sessions.
2. **The adversarial loop** — a multi-interviewer Bar Raiser panel that pushes past prepared answers and can *veto*, ending in a committee verdict — not one flattering chat.
3. **Memory** — it tracks your weakest Leadership Principles and drills *your* specific gaps over time.
4. **The honest report** — "here's the exact moment you cracked → your one rep to fix it."

The compounding asset is the **accumulated per-user gap data + cross-user calibration corpus** — slow to build, hard to copy.

---

## 4. North-star & success metrics

**North-star: measurable speaking confidence under pressure** — not a hire/no-hire vanity score. A candidate who holds composure at high pressure is winning even if their content still scores SDE II.

| Metric | What it tells us |
|---|---|
| **Activation** — % of new users who complete a first *scored* session | Does the core loop land? |
| **Confidence delta** — composure/self-efficacy improvement across sessions | Are we doing our actual job? |
| **D7 / streak retention** | Is it a habit, not a one-off? |
| **Free→paid / key-wall conversion** | Will they pay / paste a key? (the riskiest assumption) |
| **Share rate** of the Signal card | The acquisition loop |
| Sessions/user/week vs. the 3/week target | Engagement depth |

*Caveat (from the design review): the confidence metric must be validated against something real before it's a headline number — a wobbling confidence score induces the very anxiety the product cures.*

---

## 5. The product **today** (built, on `main`, not yet live)

What already exists in the codebase:
- **Voice practice** — browser VAD → Whisper → speech metrics (pace, fillers, pauses) → GPT coach feedback → TTS, across modes (interview / pitch / presentation / free practice).
- **Amazon LP rubric scoring** — a second LLM call scores interview answers against the **16 Amazon Leadership Principles**, returning matched LPs + a **Signal** level (New Grad / SDE II / Senior) + the single highest-leverage thing to fix.
- **Cockpit dashboard** — days-to-interview countdown, streak, latest Signal, "today's drill" (your weakest LP), this-week stats, and a **Signal trend chart**.
- **Shareable Signal card** — a branded, downloadable result image (the acquisition loop).
- **The Aloud brand + redesign** — editorial design system, the amber→blue→emerald Signal color language, a voice orb, dark mode, and a **public landing page** dramatizing the "great answer!" wedge.
- **Auth, history, question bank** (Amazon-tagged), userId-scoped data.

**Status:** all shipped to `main` and pushed, but **not live** — it needs the cheap-EC2 deploy (`DEPLOY.md`: AWS account → `terraform apply` → domain/TLS → secrets). Getting it live is the current gate on all learning.

---

## 6. The next chapter — the **live confidence engine**

A real-time mock interview that's *honestly harder than the real thing*. (Full detail incl. architecture in [CONFIDENCE_ENGINE_PLAN.md](CONFIDENCE_ENGINE_PLAN.md).)

- **The experience:** pick company/level → live voice panel where **3–4 interviewers each own different LPs**, follow up, interrupt, and a **Bar Raiser drills your weakest story** and can veto → a **hidden scorecard** + **committee verdict** (hire/no-hire + level + the decisive weakness) + your **confidence read** → **"your one rep"** (a single targeted drill).
- **Confidence, made visible:** a frozen Confidence Index (composure first, validated before resilience/prosody) trends across sessions alongside the Signal.
- **BYOK as the cost posture:** the expensive live voice runs on the *user's own API key* (so Aloud stays ~free to operate); the cheap, proprietary *judgment* always runs on Aloud's pinned model for calibration comparability.
- **Tone discipline:** adversarial is an opt-in "boss mode," warm by default — grilling an anxious novice can cause dropout, not mastery; a safety governor de-escalates if someone's drowning.

---

## 7. The unified user journey

1. **Onboard** — target role, companies, interview date (drives the countdown + scenario selection).
2. **Warm up & drill** — turn-based practice + the daily drill on your weakest LP (today's product).
3. **Face the panel** — the live adversarial mock (the next chapter).
4. **Get the truth** — scorecard + verdict + confidence read + one rep.
5. **Track the climb** — confidence trend, weakest-LP heatmap, days-to-interview.
6. **Walk in ready.**

---

## 8. Roadmap (unified, product slices)

| Phase | What | Status |
|---|---|---|
| **Shipped** | Rubric scoring, Signal, cockpit, shareable card, Aloud redesign, landing page | ✅ on `main` |
| **Phase 0 — Go live** | Deploy the current product on cheap EC2 (`DEPLOY.md`) so real users can touch it | ⚙️ gated on your AWS steps |
| **Phase 1 — Prove the panel** | ONE Amazon Bar Raiser panel, live voice, on Aloud's capped key + spend ceiling; the structured report. *If a tester doesn't say "this is different," stop.* | 📋 next build |
| **Phase 2 — BYOK + the loop** | User keys, full confidence index, drill loop + longitudinal tracking, more scenarios (rapid-fire, curveball, conflict, TMAY), warm/boss-mode | 📋 gated on Phase 1 + conversion data |
| **Phase 3 — Depth & monetize** | Multi-company rubrics (Google/Meta), system-design talk-through, calibration, B2B (bootcamps/universities), managed-key + "fast-lane" | 📋 |

---

## 9. Pricing & business model

Two pricing ideas exist and **must be reconciled** (flagged open):
- `PRODUCT_STRATEGY.md`: Free / **Pro $19/mo** / Annual $149, "transparent billing" as a marketing weapon vs. Final Round AI.
- `CONFIDENCE_ENGINE_PLAN.md`: **free on your own key (BYOK)** + a later thin managed-key SaaS.

**Proposed unified model:**
- **Free** — turn-based practice + rubric scoring + limited live panels on Aloud's capped key. Wins distribution and accumulates the calibration data (the moat).
- **BYOK** — unlimited live panels on your own key; Aloud's operating cost stays ~$0.
- **Pro (~$19/mo)** — managed key (no key to paste), unlimited, the low-latency "fast lane," full history/analytics. The answer for users who won't manage a key.
- **B2B** — seats for bootcamps / university career centers (needs a DPA/privacy story).

---

## 10. Risks & open product questions

**Make-or-break (decide deliberately):**
1. **BYOK adoption** — anxious new-grads are the *least* likely to own/fund an API key. → Launch free on Aloud's capped key; *measure* conversion at the key wall before betting on BYOK.
2. **"Why leave free ChatGPT voice?"** — it can be prompted to "act as a Bar Raiser." The calibration + memory + verdict must be *felt* in the demo, not just claimed.
3. **Confidence metric validity** — if it's noise, it's just "great answer!" theater with decimals. Validate before it's a headline.
4. **Cold-start** — the data moat needs users it doesn't have yet; how do the first 100 sessions get calibrated?

**Also open:** pricing reconciliation (§9); accessibility / STT bias against non-native English speakers (corrupts scoring + confidence signals for the international segment that most wants FAANG prep); and the fact that **nothing is live yet** — the single biggest blocker on learning anything.

---

## 11. Decided vs. open (quick reference)

**Decided:** the target user; the "honest, calibrated, harder-than-real" positioning; the moat (calibration + data + adversarial loop); confidence as north-star; Amazon-first; BYOK as cost posture; warm-default/boss-mode; ship the panel on Aloud's key first; get the current product live before building more.

**Open (need a call):** final pricing/packaging; the "why not ChatGPT" demo proof; cold-start calibration source; how aggressively to message "senior vs junior signal"; second company (Google vs Meta); B2B timing.

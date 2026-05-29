# Product Strategy

Last updated: 2026-05-28

This document captures the market research, competitive analysis, and strategic decisions that shape what we build next. It is the canonical reference for *why* the roadmap looks the way it does. The concrete implementation plan for the first chosen slice lives at [.claude/plans/fluttering-sleeping-aurora.md](.claude/plans/fluttering-sleeping-aurora.md).

---

## Executive summary

The product was founded to help users prepare for **SWE / SDE / software-engineering interviews**. As of today the shipped build is a generic **speech-delivery coach** (WPM, fillers, pauses) with mode labels — it is not yet differentiated for interview prep, and would not pull a user away from any incumbent in the interview-prep market.

After auditing the codebase and surveying ten competitor products in the AI interview-prep and AI speech-coaching space, we identified one universal weakness shared by every existing AI tool: **none grade the strategic content of an answer the way a human coach does** — they all say "great answer!" while real coaches tell candidates "you sounded like a New Grad on Ownership; a Senior would have added the specific decision you made under ambiguity."

Our chosen first build is **Amazon Leadership-Principle rubric scoring**: a second LLM call that runs after the existing delivery feedback, returns a structured "leadership signal" readout for the user's answer, and renders it as a new block in the practice UI. This is the highest-leverage gap to close because:

- it solves a complaint cited in every competitor analysis we found,
- it produces feedback that is screenshot-shareable in a way delivery charts are not,
- it builds on existing infrastructure (one new LLM call, no new pipelines),
- it is the foundation every later feature (story bank, dashboard trends, mock-interview persona) will consume.

Scope is intentionally narrow for v1: Amazon LPs only, only in `interview` mode, no onboarding UI yet. Onboarding ships when the second company rubric (Google or Meta) is ready and the choice becomes meaningful.

---

## 1. The problem we are solving

### Target user
A software engineer preparing for upcoming interviews. Specifically, the candidate who:
- has an interview scheduled within 4–8 weeks,
- is targeting FAANG-tier or similar product companies,
- is anxious about behavioral rounds (specifically: STAR structure, Amazon LP alignment, "tell me about a time" questions),
- has practiced answers by *typing* them in ChatGPT but never out loud,
- wants something cheaper than a $500/hr human coach and more useful than a free voice memo.

### Why this user is unserved today
The candidate either pays $100/mo for [Apex Interviewer](https://www.apexinterviewer.com/) (keyboard-first, coding-heavy), pays $25/mo for [Final Round AI](https://www.finalroundai.com/) (real-time copilot, ethically gray, billing complaints), pays $225/session for [Interviewing.io](https://interviewing.io/) (excellent but unaffordable at volume), or uses free tools like [Pramp](https://www.pramp.com/) (peers who cannot evaluate STAR) and ChatGPT (no voice, no persistence, no rubric).

No product currently offers **voice-first behavioral practice with company-specific rubric scoring at a sub-$25 price point**.

---

## 2. Where we are today

### What is built
- Full voice pipeline: browser VAD ([@ricky0123/vad-web](https://github.com/ricky0123/vad)) → Whisper transcription → speech-analysis metrics (WPM, pauses, fillers, speaking ratio) → GPT coach text → TTS → S3 → Prisma persistence.
- Four modes (`interview`, `pitch`, `presentation`, `delivery`) each with a small hard-coded prompt bank and tailored system prompt — see [packages/coach-core/src/coach-prompt.ts](packages/coach-core/src/coach-prompt.ts).
- Dashboard, practice UI, session history list, session detail page.
- Auth.js v5 with Google OAuth + credentials, userId-scoped data.
- Production deployment on AWS ECS Fargate.

### What is missing for the SWE-interview target
- **No content-level scoring.** Feedback is delivery-only. STAR, ownership, depth, level-of-seniority signal — all uncovered.
- **No question bank.** Six hardcoded prompts shared across all `interview` sessions.
- **No personalization.** Zero onboarding, no `targetRole`, no `targetCompanies`, no `interviewDate` on the User model.
- **No progress tracking.** Session history is a flat list — no trends, no weak-area heatmap, no days-to-interview countdown.
- **No story bank.** Every session is a cold start; the user's prior polished STAR stories live in their own notes or ChatGPT history.
- **No company-cultural framing.** A practice session for "an Amazon interview" looks identical to one for "a Google interview."

In short: the speaking pipeline is solid; the interview-prep product on top of it does not yet exist.

---

## 3. Market landscape

The category splits into four camps with very different go-to-market motions and price ceilings.

| Camp | Examples | What they sell | Price |
|---|---|---|---|
| Delivery coaches | [Yoodli](https://yoodli.ai), [Speakio](https://www.speakio.ai), our current build | WPM, fillers, pacing — generic speech | $8–20/mo |
| Real-time copilots | [Final Round AI](https://www.finalroundai.com/), [LockedIn AI](https://www.lockedinai.com/), [Parakeet AI](https://parakeet-ai.com/), [Interview Sidekick](https://interviewsidekick.com/) | Listens during the actual live interview, feeds answers invisibly | $25–75/mo |
| Mock-interview platforms | [Apex Interviewer](https://www.apexinterviewer.com/), [Hello Interview](https://www.hellointerview.com/), [Big Interview](https://biginterview.com/) | Curated questions tagged by company/level, rubric-scored mock practice | $9–100/mo |
| Peer matching | [Pramp](https://www.pramp.com/), [Interviewing.io](https://interviewing.io/) | Humans interviewing humans | Free → $225/session |

### Where we sit today
Camp 1 — most crowded, lowest moat, lowest price ceiling. [Final Round AI](https://www.finalroundai.com/) alone claims 10M+ users in camp 2. Camp 3 is the **most defensible** because the content (rubrics + question bank) is the moat, and that content is slow to build.

### Where we should sit
A new slot at the **voice-first edge of camp 3**: behavioral and system-design talk-through practice, with company-specific rubric scoring. No competitor occupies this slot.

---

## 4. Competitor deep dives

Each entry covers what the competitor does well (strengths we should respect or copy) and where they leak users (weaknesses we should exploit).

### Yoodli
*AI speech coach with interview mode. Closest DNA to our current product.*

Strengths:
- Polished voice pipeline with real-time analytics during live calls (Zoom/Meet/Teams).
- AI roleplay simulations with personas.
- Big enterprise wins (Google Cloud rolled to 15,000+ employees, reported 92% CSAT).
- Free tier accessible (5 roleplays).

Weaknesses:
- Explicit user complaint: *"doesn't always evaluate the quality or strategy of what you're saying — you can deliver a terrible pitch with perfect pacing and get a passing score."* This is the single biggest opening in the entire market.
- Generic — interview prep is one of several use cases, not the focus.
- Robotic-sounding feedback ("corrections sound very automated").
- 5 free sessions then paywall + no-refund policy = purchase anxiety.

### Final Round AI
*Real-time interview copilot. Market leader by user count.*

Strengths:
- Genuinely impressive real-time copilot tech (works across Zoom, Meet, LeetCode, HackerRank).
- Resume-customized responses.
- 26+ language transcription.
- Mock interview mode plus full post-interview scorecard.

Weaknesses:
- Trust collapse. Trustpilot data (March 2026): 17% of reviews are 1-star, heavily billing-driven.
- Deceptive pricing: advertised $25/mo monthly rate forces $500/yr annual commitment at checkout.
- Refund denials are routine — multiple user reports.
- "Stealth mode" feature is visible during Zoom screenshare — the opposite of advertised.
- Ethically gray: the core product is "feed me answers during my real interview" and hiring teams increasingly screen for this.

### Apex Interviewer
*SWE-specific, FAANG-targeted. Closest direct competitor.*

Strengths:
- Question bank tagged by 13 companies (Google, Meta, Amazon, Apple, Microsoft, Netflix, TikTok, Uber, OpenAI, Anthropic, Perplexity, xAI, Oracle).
- Explicit company-specific rubrics — "Google's bar is different from Meta's."
- 9 evaluation dimensions across coding, behavioral, system design.
- Level calibration from intern → staff engineer.
- Transcript-grounded feedback with timestamps ("at 0:34 you started a new thought without finishing the last one").
- Pattern-based progress dashboard (50+ patterns: arrays, trees, DP, system design).
- Realistic follow-up questions that probe.

Weaknesses:
- $100/mo locks out students and new grads — large unserved segment.
- Keyboard-first / transcript-first; voice is not central.
- No mobile.
- Their own marketing concedes coverage is *"80% of what a human coach does"* — leaving 20% explicit gap (career strategy, emotional prep, negotiation).

### Hello Interview
*Premium SWE-prep content brand.*

Strengths:
- 11,000+ questions organized by company and role level (Meta, Amazon, Google, OpenAI).
- Structured courses across System Design, LLD, DSA, Behavioral, ML System Design, AI-Enabled Coding, Concurrency.
- "Staff bar" expertise — sought by senior candidates.
- AI tutor Q&A during prep.

Weaknesses:
- FAQ explicitly states: *"recommended for engineers with some interview experience."* New grads and interns are unserved.
- Does not support TPM interviews.
- Content product more than practice product — the user reads/watches more than they speak.

### Pramp
*Peer-to-peer mock interviews. Largest free option.*

Strengths:
- Free.
- Realistic human conversational dynamics.
- Lets candidates be both interviewer and interviewee — builds empathy.

Weaknesses:
- *"Peers rarely know how to evaluate the STAR method or identify red flags in your stories."*
- *"Your peer partner might give you a thumbs up and say 'that was great' when your solution had three edge-case bugs and your communication was unclear."*
- Hit-or-miss matches; questions sometimes irrelevant to the candidate's target role.

### Interviewing.io
*Live human EM-conducted interviews. Premium tier of the market.*

Strengths:
- Real EMs evaluate. They can distinguish "Senior leader" vs "Junior complainer" signal and help reframe narratives to hit Amazon LPs.
- The expert calibration nobody else has.

Weaknesses:
- $225 per session — completely out of reach for most candidates at the volume needed for prep (20–40 sessions before a real interview).
- Schedule-bound, not 24/7.

### Exponent
*Established interview-prep brand with content + peer matching.*

Strengths:
- Large content library.
- Multi-discipline (PM, SWE, DS).
- Brand recognition.

Weaknesses:
- Questions often hit-or-miss for the candidate's target role.
- 5-day refund window only; coaching session refunds only for unused sessions.
- No proprietary AI scoring innovation.

---

## 5. Universal weaknesses across the AI category

Three failure modes recurred in every comparison piece, hiring-director review, and user-complaint thread we surveyed. These define the category-level opportunity.

**1. "Great answer!" theater.**
Every existing AI tool, when handed a behavioral answer, returns supportive but vague encouragement. No tool decodes *why* the interviewer is asking the question. Amazon LP-trained human coaches do this constantly; AI tools do not.

**2. No strategy/content grading — only delivery or surface structure.**
STAR completeness is sometimes checked (situation present? task present?). But *"does this story make you sound senior or junior?"* — the actual question hiring managers answer — is uncovered by every AI product we tested.

**3. No understanding of organizational or cultural context.**
What a Bar Raiser at Amazon actually wants vs what a Google interviewer wants vs what a Meta interviewer wants. The first two of these are 60–80% codifiable with the right rubric and prompt. The third is partially codifiable (Amazon LPs are publicly written down).

Build a product that addresses #1 and #2 well, with company-specific framing for #3, and you have a positioning statement no incumbent can credibly counter in the short term.

---

## 6. Ten unfilled gaps, ranked by user-attraction impact

| # | Gap | Why nobody has it | Effort |
|---|---|---|---|
| 1 | Content/strategy scoring ("senior vs junior signal") | Hard prompt engineering, needs company-specific rubric | Medium |
| 2 | Story bank / narrative workbench (5–7 polished STARs reused across question variants, with AI matching) | Requires schema for stories + question→story linking | Medium |
| 3 | "Why is this question being asked?" decoder, one line per question | Requires curated company-context layer | Low (content work) |
| 4 | Beginner on-ramp for SWE behavioral (Hello Interview/Apex both assume experience) | Senior $$ market is more attractive | Low |
| 5 | Voice-first interview practice (most candidates type their prep then fail at speaking) | Apex is keyboard-first; Yoodli is voice but generic | 70% already built |
| 6 | Transparent billing + generous free tier (Final Round AI's #1 complaint) | Competitors optimize for ARR lock-in | Trivial (policy) |
| 7 | Mobile / audio-only commute practice | Web-first heritage across the field | Medium (PWA) |
| 8 | Timestamped audio replay with moment-by-moment scoring overlay | Apex does this for transcripts; nobody for audio | Low |
| 9 | Interview-day staging (calm-mode the night before, breath pacing, "victory replay") | All tools optimize skill-building, not emotional prep | Low |
| 10 | Hybrid Pramp + AI-coach overlay (peers practice, AI silently scores both) | Pramp's peer-feedback problem unsolved | High |

---

## 7. Our positioning

> **Practice your FAANG behavioral and system-design answers *out loud*. Get scored against the actual rubric the company uses — STAR completeness, Ownership / Leadership-Principle fit, depth, clarity — with real-time delivery coaching built in.**

This is defensible because it combines two things competitors keep separate:

- **Voice-first practice** (Yoodli's DNA — already shipped in our pipeline).
- **Company-specific rubric scoring** (Apex's DNA — building it now, narrow first slice).

What we explicitly are NOT:
- A real-time copilot during the candidate's actual live interview (Final Round AI's category — ethically gray, increasingly penalized).
- A coding execution environment (Apex / Parakeet / HackerRank's territory — months of work, unrelated to our voice DNA).
- A generic public-speaking coach (Yoodli's broader market — commoditized, low price ceiling).
- A content brand selling courses and videos (Hello Interview / Exponent — different business model).

---

## 8. The decision: what we build first

**Amazon Leadership-Principle rubric scoring.** A second LLM call after the existing delivery feedback that returns a structured `{ matchedLPs, overallSignal, weakestArea }` for every interview-mode turn, persists it on the USER turn row, and renders a new "Leadership signal" block in the practice UI.

### Why this slice over the other six candidates

Six candidates were on the table:

1. Onboarding + minimal schema
2. **Senior/Junior signal scoring with company rubrics** ← chosen
3. Story bank
4. Voice-first + audio replay timeline
5. Question bank (Amazon-tagged ~40 Qs)
6. Dashboard + progress UI
7. Mock interview mode

This one was chosen because:

- **It addresses the universal AI gap** (#1 from Section 5). Every competitor analysis surfaced "AI says 'great answer!'" as the single biggest complaint. Closing this gap gives us a positioning line no incumbent can credibly copy in a week.
- **One screenshot demo.** *"Your answer scored: New Grad signal on Ownership. A Senior would have added the specific decision you made under ambiguity."* Shareable on Twitter and LinkedIn the way Yoodli's filler-word chart was.
- **Builds on what we already have.** Transcript + delivery metrics are already produced by [src/lib/coach/turn-orchestrator.ts](src/lib/coach/turn-orchestrator.ts). The change is one more LLM call with a careful prompt, plus rubric JSON content, plus a UI block. No new schema beyond a `rubricScoresJson` field on `PracticeTurn`.
- **Foundation for everything else.** Once we score on dimensions like Ownership / Bias for Action, the story bank scoring, the dashboard trends, the per-question feedback, and the mock-interview persona all just consume this scoring output.
- **Bounded content scope.** Amazon's 14 Leadership Principles are publicly documented and famous. Start with the company where the rubric exists and is famous. Google's "Googleyness" is fuzzier and Meta's principles are less standardized — those come later.

### Why each alternative was deprioritized
- **Onboarding alone (#1):** necessary but invisible. We bake the minimum slice (default `targetCompanies = ["amazon"]`) into the scoring change.
- **Story bank (#3):** amazing retention, but value compounds only after 5+ sessions. Does not pull a first-time visitor.
- **Voice-first + replay (#4):** high demo value but doesn't solve the *content* gap that is the actual universal complaint.
- **Question bank alone (#5):** content work without a scoring innovation = Apex-lite at small scale.
- **Dashboard (#6):** needs trend data to be meaningful — requires #2 first.
- **Mock mode (#7):** too large; everything below it needs to exist first.

### v1 scope
- Only Amazon LPs. Only when `mode === "interview"`. No onboarding UI yet.
- Default `User.targetCompanies = ["amazon"]` via Prisma default.
- One new LLM call (`gpt-4o-mini`, `response_format: { type: "json_object" }`, temperature 0.3) after the existing coach-text call.
- New `PracticeTurn.rubricScoresJson` field, populated only on USER turn rows where scoring ran.
- One new presentational component `RubricScoreBlock` rendered below the existing coach-feedback box.
- Concrete implementation plan: [.claude/plans/fluttering-sleeping-aurora.md](.claude/plans/fluttering-sleeping-aurora.md).

Estimated effort: 2–3 focused days. Largest single chunk is prompt-tuning the rubric LLM call to feel like a Bar Raiser rather than ChatGPT.

---

## 9. Roadmap after v1

This is the order we build things in, predicated on v1 LP scoring shipping first and being the substrate everything else consumes.

### P1 — next two weeks
- **Onboarding UI.** Activate the screen once the second company rubric (Google or Meta) is ready. Single-page flow asking `targetRole`, `targetCompanies`, `interviewDate`.
- **Google rubric** (Googleyness + Leadership signal) — second company.
- **Story bank schema + UI.** `Story { id, userId, title, situation, task, action, result, tags[], strengthScore }`. Record raw stories, AI polishes each, scores them against active company rubric, suggests which story to reuse when a new question loads.
- **Question library** browsable by company × category × level. Start with ~40 hand-curated questions across Amazon + Google.

### P2 — next six weeks
- **Personalized dashboard.** Replace the current home hero. Show:
  - "Days to interview" countdown.
  - LP score trend lines (improvement per LP over sessions).
  - "Your stories: 4/7 polished" progress bar.
  - Filler/min trend over last 7 sessions.
  - Recommended drill of the day based on weakest LP.
- **Mock interview mode.** Timed multi-question session with persona, 30–45 minute flow, opening + 3–5 behavioral + closing.
- **Reference "strong answer" examples** rendered after the user's attempt.
- **Resume upload → story extraction** (P1 candidate, may slip to P2 depending on parsing complexity).

### P3 — beyond
- **Mobile / PWA** for commute practice (audio-only mode).
- **Audio replay timeline** with colored bands and click-to-jump annotations.
- **Hybrid Pramp + AI scorer** (peer practice with AI silently scoring both).
- **Interview-day staging** (calm-mode, breath pacing, victory replay).

---

## 10. Pricing slot

| Tier | Price | What's included |
|---|---|---|
| Free | $0 | 10 sessions/month, delivery metrics only, no rubric scoring, 3 stories in story bank |
| Pro | $19/month | Unlimited sessions, full rubric scoring across all supported companies, full story bank, progress dashboard |
| Pro Annual | $149/year | Same as Pro, billed yearly |

Positioning:
- Above Yoodli Pro ($8) and Yoodli Advanced ($20) on capability.
- Below Apex ($100) on price — explicit undercut for the student / new-grad segment Apex prices out.
- **Transparent billing as a marketing feature.** "No annual tricks. Cancel anytime. 14-day refund." Stated on the pricing page itself. This weaponizes [Final Round AI's #1 complaint category](https://www.trustpilot.com/review/finalroundai.com) at zero engineering cost.

---

## 11. What we explicitly do not build

| Out of scope | Reason |
|---|---|
| Real-time copilot during live interviews | Ethically gray, hiring teams penalize candidates, Final Round AI's reputational debt is instructive |
| Coding execution environment (sandbox, judge, multi-language starter code) | Months of work; orthogonal to our voice DNA; Apex / HackerRank own the slot |
| Body-language / video analysis | Cameras are off in voice-first practice; orthogonal to the strategy gap |
| Generic public-speaking coaching (TED-style, wedding toasts, sales pitches) | Yoodli's market; commoditized; low price ceiling |
| Course / video content brand | Hello Interview / Exponent own this; different business model |
| Calendar scheduling for peer matching | Pramp / Interviewing.io's territory; product complexity explosion |

---

## 12. Open strategic questions (not yet decided)

- **Second company after Amazon:** Google or Meta? Google's "Googleyness" rubric is fuzzier but the company is more aspirational for the new-grad segment. Meta's "Move Fast / Impact" is more codifiable but the hiring brand is more volatile.
- **Annual discount depth:** $149/yr is ~35% off vs monthly. Is 35% the right number for our segment, or should we sit at ~25% to protect monthly conversion?
- **How aggressively to message "senior vs junior signal":** the framing is bold and screenshot-shareable but risks alienating actual new grads. Likely need careful copy — "level fit readout" rather than a value judgment.
- **Mobile timing:** voice + commute is natural fit for mobile, but PWA build adds ~2 weeks. Postpone until web product has clear retention?

These are revisited after v1 ships and we have real usage data.

---

## Sources

Competitor websites and product pages:
- [Yoodli](https://yoodli.ai/) — pricing, features
- [Final Round AI](https://www.finalroundai.com/) — product page
- [Apex Interviewer](https://www.apexinterviewer.com/) — features, pricing, [vs human coaches](https://www.apexinterviewer.com/resources/apex-vs-human-coaches)
- [Hello Interview](https://www.hellointerview.com/) — product, [FAQ](https://www.hellointerview.com/faq)
- [Pramp](https://www.pramp.com/) — peer matching model
- [Interviewing.io](https://interviewing.io/) — EM-conducted interviews

Comparison and review pieces:
- [Final Round AI — best AI interview prep tools 2026](https://www.finalroundai.com/blog/best-ai-interview-prep-tools)
- [Interview Sidekick — best AI interview software 2026](https://interviewsidekick.com/blog/best-ai-interview-software)
- [Interview Sidekick — best AI virtual interview software](https://interviewsidekick.com/blog/best-ai-virtual-interview-software)
- [ApplyArc — 8 AI interview prep tools tested](https://applyarc.com/blog/best-ai-interview-prep-tools-2026)
- [Revarta — 7 AI interview coaches tested by a former hiring director](https://www.revarta.com/blog/best-ai-interview-coach-2026)
- [Lenny's Newsletter — how to use AI in your next job interview](https://www.lennysnewsletter.com/p/how-to-use-ai-in-your-next-job-interview)
- [LeetCopilot — Pramp vs Interviewing.io review 2025](https://leetcopilot.dev/blog/pramp-vs-interviewing-io-review-2025)
- [Day One Careers — Amazon AI story coach](https://www.dayone.careers/amazon-interview-ai-coach-story-review) — narrative-review angle for LPs

User-review sources for weakness signals:
- [Final Round AI on Trustpilot](https://www.trustpilot.com/review/finalroundai.com) — billing complaints
- [Resume Judge — Final Round AI 14-day trial review](https://resumejudge.com/blog/finalroundai-review/) — stealth-mode visible during screenshare
- [Yoodli on G2](https://www.g2.com/products/yoodli-inc-yoodli/reviews) — pros / cons

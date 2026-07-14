/**
 * Version stamp for the rubric CONTENT in this file (principles, signal guides,
 * competencies). Stamped onto every PanelVerdict and snapshotted into Outcome so
 * the (prediction → real outcome) calibration pairs can be partitioned by the
 * exact rubric that produced them. **BUMP THIS on any change to the rubric
 * content or scoring guidance** — a new version opens a fresh calibration cohort.
 * Code is the source of truth; the matching DB column default is only a one-time
 * backfill for rows written before provenance existed.
 */
export const RUBRIC_VERSION = "2026.06.0";

export interface LeadershipPrinciple {
  name: string;
  oneLiner: string;
  juniorSignal: string;
  seniorSignal: string;
}

export interface CompanyRubric {
  systemPrompt: string;
  principles: LeadershipPrinciple[];
  signalGuide: string;
  outputSpec: string;
}

export const AMAZON_LEADERSHIP_PRINCIPLES: LeadershipPrinciple[] = [
  {
    name: "Customer Obsession",
    oneLiner:
      "Start with the customer and work backwards. Earn and keep customer trust.",
    juniorSignal:
      "Mentions customers generically, focuses on team or technical metrics, no concrete customer signal or feedback loop.",
    seniorSignal:
      "Cites specific customer pain or data, ties the decision to a measurable customer outcome, names the feedback signal they used.",
  },
  {
    name: "Ownership",
    oneLiner:
      "Act on behalf of the entire company. Never say 'that's not my job.' Think long term.",
    juniorSignal:
      "Describes what 'we' or 'the team' did, deflects to others' decisions, no personal accountability for the outcome.",
    seniorSignal:
      "Takes personal accountability for the outcome including the parts outside their formal role, addresses long-term consequences, owns the failure mode.",
  },
  {
    name: "Invent and Simplify",
    oneLiner:
      "Find new ways to simplify. Be externally aware and willing to be misunderstood.",
    juniorSignal:
      "Reuses an obvious pattern, no mention of alternatives considered, no simplification step.",
    seniorSignal:
      "Names the simpler approach chosen over the more complex one, explains why simplicity won, references prior art they avoided.",
  },
  {
    name: "Are Right, A Lot",
    oneLiner:
      "Strong judgment and good instincts. Seek diverse perspectives. Disconfirm beliefs.",
    juniorSignal:
      "Asserts a position without evidence or counter-perspectives, no mention of changed mind.",
    seniorSignal:
      "Cites the data or perspective that shifted the decision, names a moment they updated their belief, distinguishes opinion from evidence.",
  },
  {
    name: "Learn and Be Curious",
    oneLiner:
      "Always learning. Curious about new possibilities.",
    juniorSignal:
      "Mentions general curiosity without a specific thing learned, no application of new knowledge.",
    seniorSignal:
      "Names the specific concept, paper, or framework learned and how it changed the solution.",
  },
  {
    name: "Hire and Develop the Best",
    oneLiner:
      "Raise the performance bar. Recognize and grow talent. Move them through the organization.",
    juniorSignal:
      "No mention of mentoring or hiring; not expected at junior levels.",
    seniorSignal:
      "Names a person they coached or hired, the gap they closed, the outcome that person delivered.",
  },
  {
    name: "Insist on the Highest Standards",
    oneLiner:
      "Have relentlessly high standards. Continually raise the bar. Defects do not get sent down the line.",
    juniorSignal:
      "Accepts 'good enough,' no explicit quality bar named, no investment in long-term reliability.",
    seniorSignal:
      "Names the standard they refused to ship below, the specific defect class they prevented, the tradeoff against velocity.",
  },
  {
    name: "Think Big",
    oneLiner:
      "Think differently and look around corners. Communicate a bold direction that inspires.",
    juniorSignal:
      "Solves the immediate problem only, no consideration of scale or adjacent users.",
    seniorSignal:
      "Names the 10x version of the problem, articulates how the chosen solution unlocks a larger outcome.",
  },
  {
    name: "Bias for Action",
    oneLiner:
      "Speed matters. Many decisions are reversible and do not require extensive study.",
    juniorSignal:
      "Waits for permission, describes long deliberation with no decision, or rushes without judging reversibility.",
    seniorSignal:
      "Explicitly judges the decision as one-way or two-way door, moves fast on reversible ones, gathers data for irreversible ones.",
  },
  {
    name: "Frugality",
    oneLiner:
      "Accomplish more with less. Constraints breed resourcefulness, self-sufficiency, and invention.",
    juniorSignal:
      "Asks for more resources without exploring what is possible with current ones.",
    seniorSignal:
      "Names the constraint, names the creative workaround, ties frugality to a better outcome rather than just cost savings.",
  },
  {
    name: "Earn Trust",
    oneLiner:
      "Listen attentively. Speak candidly. Treat others respectfully. Vocally self-critical.",
    juniorSignal:
      "Blames others, avoids self-critique, no mention of repairing a broken relationship.",
    seniorSignal:
      "Names a moment they were vocally self-critical, names how they repaired or built trust with a specific stakeholder.",
  },
  {
    name: "Dive Deep",
    oneLiner:
      "Operate at all levels, stay connected to details, audit frequently. Be skeptical when metrics differ from anecdotes.",
    juniorSignal:
      "Stays at high level, accepts dashboard numbers without verification.",
    seniorSignal:
      "Names the specific query, log, or metric they personally investigated, names the surprise the investigation revealed.",
  },
  {
    name: "Have Backbone; Disagree and Commit",
    oneLiner:
      "Challenge decisions respectfully when you disagree, even when uncomfortable. Once decided, commit fully.",
    juniorSignal:
      "Either capitulates immediately or refuses to commit after losing the argument.",
    seniorSignal:
      "Names the specific disagreement, how they raised it, how they then fully committed once the decision was made and made it succeed.",
  },
  {
    name: "Deliver Results",
    oneLiner:
      "Focus on the key inputs and deliver them with the right quality and timely fashion. Despite setbacks, rise to the occasion.",
    juniorSignal:
      "Describes activity without outcome, no quantified result, no mention of overcoming setback.",
    seniorSignal:
      "Names the quantified outcome (number, percentage, business impact), names the specific setback overcome.",
  },
  {
    name: "Strive to be Earth's Best Employer",
    oneLiner:
      "Work to create a safer, more productive, more diverse, and more just work environment.",
    juniorSignal:
      "Not commonly demonstrated in SDE interviews at junior levels.",
    seniorSignal:
      "Names a specific action improving the team's environment, inclusion, or wellbeing.",
  },
  {
    name: "Success and Scale Bring Broad Responsibility",
    oneLiner:
      "Decisions and actions impact customers, employees, partners, and the broader world. Be thoughtful about the consequences.",
    juniorSignal:
      "Not commonly demonstrated in SDE interviews at junior levels.",
    seniorSignal:
      "Names a second-order consequence they anticipated and addressed (privacy, security, accessibility, ethics).",
  },
];

export const AMAZON_SIGNAL_GUIDE = `Signal-level calibration for SDE candidates:
- NEW_GRAD: describes team activity ("we did X"), vague timelines, no specific personal decision under ambiguity, no quantified outcome.
- SDE_II: takes ownership of their part with specifics, mentions tradeoffs considered, some quantified outcome.
- SENIOR: drives outcomes under ambiguity, makes scoped decisions independently, quantifies impact, articulates tradeoffs explicitly, considers cross-team or long-term implications.`;

export const AMAZON_OUTPUT_SPEC = `Output a single JSON object with this exact shape:
{
  "matchedLPs": [
    { "name": "<one of the Amazon LPs above>", "signalLevel": "NEW_GRAD" | "SDE_II" | "SENIOR", "evidence": "<short quote or paraphrase from the transcript>" }
  ],
  "overallSignal": "NEW_GRAD" | "SDE_II" | "SENIOR",
  "weakestArea": "<one sentence describing the single highest-leverage thing the candidate should add to level up their next attempt>"
}

Rules:
- Include AT MOST 3 matchedLPs — only the LPs that are clearly demonstrated in the transcript. Do NOT hallucinate signals that are not in the transcript.
- If the transcript is too short or generic to score any LP, return matchedLPs: [], overallSignal based on what you observe, and a weakestArea pointing the candidate at a concrete next step.
- overallSignal reflects the candidate's overall behavior in the transcript, not the highest individual LP.
- weakestArea must be specific and actionable, not generic ("speak with more confidence" is bad; "Name the specific decision you made and the alternative you rejected" is good).
- Output ONLY the JSON object. No prose, no markdown, no preamble.`;

// --- React / JavaScript competency rubric (the /interview confidence-engine panel) ---
// Same shape as a LeadershipPrinciple, but each entry is a technical competency.
// `juniorSignal` = NEW_GRAD-level depth, `seniorSignal` = SENIOR-level depth; the
// scorer interpolates SDE_II between them. Seat ownership (prisma/seed.ts) must use
// these exact `name` strings.
export const REACT_JS_COMPETENCIES: LeadershipPrinciple[] = [
  // Seat 1 — JavaScript fundamentals
  {
    name: "Closures & Scope",
    oneLiner:
      "Functions capturing their lexical scope; how variables are resolved and retained.",
    juniorSignal:
      "Defines a closure as 'a function inside a function' but can't say what is captured or when it matters.",
    seniorSignal:
      "Explains lexical capture by reference, names a concrete use (memoization, private state, event handlers) and the classic gotcha (loop-variable capture / stale closures in hooks).",
  },
  {
    name: "Asynchronous JS & the Event Loop",
    oneLiner:
      "Call stack, microtask vs macrotask queues, how promises and async/await schedule work.",
    juniorSignal:
      "Knows async code 'runs later' but can't order a setTimeout vs a Promise and conflates concurrency with parallelism.",
    seniorSignal:
      "Walks the call stack → microtask → macrotask ordering precisely, explains why a Promise callback runs before setTimeout(0), and names ordering/starvation pitfalls.",
  },
  {
    name: "Prototypes & Inheritance",
    oneLiner:
      "The prototype chain, how property lookup works, class syntax vs prototype delegation.",
    juniorSignal:
      "Uses class syntax but can't explain the prototype chain or what `new` actually does.",
    seniorSignal:
      "Traces property resolution up the chain, distinguishes `__proto__` from `prototype`, explains what `new` wires up, and when delegation beats class syntax.",
  },
  {
    name: "`this` & Execution Context",
    oneLiner:
      "How `this` is bound: call-site rules, arrow functions, bind/call/apply.",
    juniorSignal:
      "Knows `this` is 'the object' but is surprised by lost `this` in a detached callback.",
    seniorSignal:
      "Determines `this` from the call site, explains arrow-function lexical `this`, and correctly fixes a detached-method bug with bind or an arrow.",
  },
  {
    name: "Types, Coercion & Equality",
    oneLiner:
      "Primitive vs reference types, == vs ===, coercion, value vs reference semantics.",
    juniorSignal:
      "Avoids == without knowing why and is surprised that two equal-looking objects/arrays aren't ===.",
    seniorSignal:
      "Predicts coercion outcomes, explains reference vs value semantics, and ties it to React state updates and memo comparison correctness.",
  },
  // Seat 2 — React internals
  {
    name: "Hooks & the Rules of Hooks",
    oneLiner:
      "Why hooks must run unconditionally; how React tracks hook state by call order.",
    juniorSignal:
      "Follows the rules by rote but can't say why a conditional or looped hook breaks.",
    seniorSignal:
      "Explains the call-order index model, why it forbids conditional/looped hooks, and diagnoses a 'rendered fewer hooks than expected' error.",
  },
  {
    name: "State & the Re-render Model",
    oneLiner:
      "What triggers a re-render, batching, and state as a per-render snapshot.",
    juniorSignal:
      "Thinks setState updates synchronously and is confused why a value 'didn't change' right after setting it.",
    seniorSignal:
      "Explains state-as-snapshot, batching, and functional updates, and why reading state immediately after setState shows the previous value.",
  },
  {
    name: "Effects & Synchronization",
    oneLiner:
      "useEffect as synchronization with external systems: dependencies, cleanup, timing.",
    juniorSignal:
      "Treats useEffect as a lifecycle hook, omits or guesses dependencies, and causes render loops.",
    seniorSignal:
      "Frames effects as synchronizing with an external system, derives correct deps, uses cleanup to avoid races/leaks, and knows when NOT to use an effect at all.",
  },
  {
    name: "Reconciliation & Keys",
    oneLiner:
      "How React diffs the tree, why keys matter, and mount vs update behavior.",
    juniorSignal:
      "Adds keys only to silence the warning and uses array index without understanding the consequence.",
    seniorSignal:
      "Explains the diffing heuristics, how a bad key remounts a component and loses its state, and when identity-stable keys are correctness-critical.",
  },
  {
    name: "Context & Composition",
    oneLiner:
      "Context for shared state, its re-render implications, and composition over prop drilling.",
    juniorSignal:
      "Reaches for context everywhere, unaware that every consumer re-renders when the value changes.",
    seniorSignal:
      "Weighs context vs composition vs a state library, splits contexts to bound re-renders, and avoids the referential-stability trap on the provider value.",
  },
  // Seat 2 (cont.) — Next.js (Dev owns React internals AND the Next.js framework layer)
  {
    name: "Next.js App Router & Routing",
    oneLiner:
      "File-based routing in the App Router: layouts, nested routes, dynamic segments, and route groups.",
    juniorSignal:
      "Can add a page and a link but can't explain layouts vs pages, nested routing, or what a dynamic segment maps to.",
    seniorSignal:
      "Explains the App Router file conventions (layout/page/loading/error), how nested layouts compose and persist across navigation, dynamic and catch-all segments, and when to reach for route groups or parallel routes.",
  },
  {
    name: "Server vs Client Components",
    oneLiner:
      "The React Server Components model: what runs on the server, the `use client` boundary, and serialization rules.",
    juniorSignal:
      "Adds `use client` by trial and error to make hooks or handlers work, with no model of what runs where.",
    seniorSignal:
      "Explains that Server Components run only on the server and ship no JS, where the `use client` boundary belongs and why, what may cross it (serializable props, not functions), and how to keep client bundles small by pushing state to the leaves.",
  },
  {
    name: "Data Fetching & Caching",
    oneLiner:
      "Server-side data fetching, the fetch cache, request memoization, and revalidation (ISR / on-demand).",
    juniorSignal:
      "Fetches data in a client-side useEffect and is unaware of server fetching or any caching layer.",
    seniorSignal:
      "Fetches on the server, reasons about the fetch cache and request-level memoization, chooses time-based vs on-demand revalidation, and knows how to opt out of caching for genuinely dynamic data.",
  },
  {
    name: "Rendering Strategies (SSR/SSG/ISR/Streaming)",
    oneLiner:
      "Static vs dynamic rendering, incremental regeneration, and streaming with Suspense; chosen per route.",
    juniorSignal:
      "Knows 'Next.js does SSR' but can't distinguish static from dynamic rendering or say what makes a route one or the other.",
    seniorSignal:
      "Distinguishes static and dynamic rendering and what forces each, applies ISR for fast-but-fresh pages, and uses Suspense streaming to send the shell early while slow data loads — reasoning about TTFB vs full-page latency.",
  },
  // Seat 3 — Rendering & performance (Bar Raiser)
  {
    name: "Render Performance & Memoization",
    oneLiner:
      "memo/useMemo/useCallback: what they actually prevent, their contract, and their cost.",
    juniorSignal:
      "Sprinkles useMemo/useCallback as a habit without measuring or understanding referential equality.",
    seniorSignal:
      "Explains what each memoizes, the referential-equality contract they depend on, when memoization is wasted, and the cost of memoizing itself.",
  },
  {
    name: "Avoiding Unnecessary Re-renders",
    oneLiner:
      "Why components re-render and how to cut wasted renders without changing behavior.",
    juniorSignal:
      "Can't name why a component re-rendered and treats every re-render as a bug.",
    seniorSignal:
      "Traces a render to its trigger (state/props/context/parent), separates harmful from harmless renders, and applies the right fix (lift, split, or memoize).",
  },
  {
    name: "Profiling & Measurement",
    oneLiner:
      "Measuring before optimizing: the React Profiler, DevTools, and real metrics.",
    juniorSignal:
      "Optimizes by intuition with no measurement of where time is actually spent.",
    seniorSignal:
      "Uses the Profiler/Performance panel to locate the real bottleneck, reasons about render vs commit phases, and validates the fix with numbers.",
  },
  {
    name: "Loading & Bundle Performance",
    oneLiner:
      "Code-splitting, lazy loading, hydration cost, and perceived performance.",
    juniorSignal:
      "Unaware of bundle size or splitting and ships the whole app eagerly.",
    seniorSignal:
      "Applies route/component code-splitting, reasons about TTI and hydration cost, and trades off prefetch vs lazy for perceived speed.",
  },
];

export const REACT_JS_SIGNAL_GUIDE = `Signal-level calibration for a React/JavaScript engineer (depth of understanding, not years on a résumé):
- NEW_GRAD: recites a definition or a memorized rule, cannot explain the underlying mechanism or why it holds, offers no edge cases or tradeoffs.
- SDE_II: explains the mechanism correctly and applies it in practice, names common pitfalls, gives some tradeoffs.
- SENIOR: reasons from a precise mental model / first principles, articulates tradeoffs and edge cases, connects the concept to correctness and performance implications, and knows when the usual rule breaks.`;

export const REACT_JS_OUTPUT_SPEC = `Output a single JSON object with this exact shape:
{
  "matchedLPs": [
    { "name": "<one of the competencies above>", "signalLevel": "NEW_GRAD" | "SDE_II" | "SENIOR", "evidence": "<short quote or paraphrase from the transcript>" }
  ],
  "overallSignal": "NEW_GRAD" | "SDE_II" | "SENIOR",
  "weakestArea": "<one sentence describing the single highest-leverage thing the candidate should deepen to level up their next attempt>"
}

Rules:
- Include AT MOST 3 matchedLPs — only competencies clearly demonstrated in the transcript. Do NOT hallucinate signals that are not in the transcript.
- If the transcript is too short or generic to score any competency, return matchedLPs: [], overallSignal based on what you observe, and a weakestArea pointing the candidate at a concrete next step.
- overallSignal reflects the candidate's overall technical depth in the transcript, not the highest individual competency.
- weakestArea must be specific and actionable ("Explain WHY conditional hooks break, not just the rule" is good; "study React more" is bad).
- Output ONLY the JSON object. No prose, no markdown, no preamble.`;

function buildReactJsSystemPrompt(): string {
  const lines = REACT_JS_COMPETENCIES.map(
    (p) =>
      `- ${p.name}: ${p.oneLiner}\n  Junior signal: ${p.juniorSignal}\n  Senior signal: ${p.seniorSignal}`
  ).join("\n");

  return `You are an experienced React/JavaScript interviewer evaluating a candidate's spoken technical answer. You score the candidate's transcript against the competency areas below.

React/JavaScript competencies:
${lines}

${REACT_JS_SIGNAL_GUIDE}

${REACT_JS_OUTPUT_SPEC}`;
}

function buildAmazonSystemPrompt(): string {
  const lpLines = AMAZON_LEADERSHIP_PRINCIPLES.map(
    (p) =>
      `- ${p.name}: ${p.oneLiner}\n  Junior signal: ${p.juniorSignal}\n  Senior signal: ${p.seniorSignal}`
  ).join("\n");

  return `You are an Amazon Bar Raiser evaluating a candidate's behavioral answer for an SDE interview. You score the candidate's transcript against Amazon's Leadership Principles.

Amazon Leadership Principles:
${lpLines}

${AMAZON_SIGNAL_GUIDE}

${AMAZON_OUTPUT_SPEC}`;
}

const COMPANY_RUBRICS: Record<string, CompanyRubric> = {
  amazon: {
    systemPrompt: buildAmazonSystemPrompt(),
    principles: AMAZON_LEADERSHIP_PRINCIPLES,
    signalGuide: AMAZON_SIGNAL_GUIDE,
    outputSpec: AMAZON_OUTPUT_SPEC,
  },
  react: {
    systemPrompt: buildReactJsSystemPrompt(),
    principles: REACT_JS_COMPETENCIES,
    signalGuide: REACT_JS_SIGNAL_GUIDE,
    outputSpec: REACT_JS_OUTPUT_SPEC,
  },
};

export function getRubricForCompany(company: string): CompanyRubric | null {
  return COMPANY_RUBRICS[company.toLowerCase()] ?? null;
}

export function buildRubricUserMessage(transcript: string): string {
  // Collapse any triple-quote runs so a hostile transcript can't close the
  // delimited block and inject instructions into the off-band scorer (PR10).
  const safe = transcript.replace(/"{3,}/g, '"');
  return `Candidate's interview-answer transcript:
"""
${safe}
"""

Score this answer per the rules above and return the JSON object.`;
}

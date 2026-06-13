export interface DrillQuestion {
  id: string;
  text: string;
  lp: string;
  estMinutes: number;
}

const AMAZON_QUESTIONS: DrillQuestion[] = [
  {
    id: "amz-ownership-1",
    text: "Tell me about a time you owned an outcome end-to-end when no one explicitly asked you to.",
    lp: "Ownership",
    estMinutes: 5,
  },
  {
    id: "amz-ownership-2",
    text: "Describe a time you fixed something outside your formal responsibilities because it was the right thing for the customer.",
    lp: "Ownership",
    estMinutes: 5,
  },
  {
    id: "amz-customer-obsession-1",
    text: "Walk me through a project where a customer signal changed the direction of your work.",
    lp: "Customer Obsession",
    estMinutes: 5,
  },
  {
    id: "amz-customer-obsession-2",
    text: "Tell me about a time you pushed back on a stakeholder to advocate for the customer.",
    lp: "Customer Obsession",
    estMinutes: 5,
  },
  {
    id: "amz-bias-for-action-1",
    text: "Describe a decision you made quickly with limited information. What was the tradeoff?",
    lp: "Bias for Action",
    estMinutes: 4,
  },
  {
    id: "amz-bias-for-action-2",
    text: "Tell me about a time you shipped something imperfect on purpose. Walk me through your reasoning.",
    lp: "Bias for Action",
    estMinutes: 4,
  },
  {
    id: "amz-deliver-results-1",
    text: "Walk me through your most impactful delivery in the last year — what was the result, and what got in the way?",
    lp: "Deliver Results",
    estMinutes: 5,
  },
  {
    id: "amz-deliver-results-2",
    text: "Describe a project that slipped. What did you do, and what was the outcome?",
    lp: "Deliver Results",
    estMinutes: 5,
  },
  {
    id: "amz-dive-deep-1",
    text: "Tell me about a time the dashboard said one thing but the reality was different. How did you find out?",
    lp: "Dive Deep",
    estMinutes: 5,
  },
  {
    id: "amz-have-backbone-1",
    text: "Describe a time you disagreed with a decision but committed to it. What happened?",
    lp: "Have Backbone; Disagree and Commit",
    estMinutes: 5,
  },
  {
    id: "amz-have-backbone-2",
    text: "Tell me about a time you pushed back on a senior engineer. How did you raise it?",
    lp: "Have Backbone; Disagree and Commit",
    estMinutes: 5,
  },
  {
    id: "amz-invent-simplify-1",
    text: "Walk me through a complex problem you simplified. What did you choose not to build?",
    lp: "Invent and Simplify",
    estMinutes: 5,
  },
  {
    id: "amz-highest-standards-1",
    text: "Tell me about a time you refused to ship something. What was the standard you held the line on?",
    lp: "Insist on the Highest Standards",
    estMinutes: 5,
  },
  {
    id: "amz-earn-trust-1",
    text: "Describe a time you broke or repaired trust with a teammate. What did you do specifically?",
    lp: "Earn Trust",
    estMinutes: 5,
  },
  {
    id: "amz-are-right-1",
    text: "Tell me about a time you changed your mind on a technical decision based on new data.",
    lp: "Are Right, A Lot",
    estMinutes: 4,
  },
  {
    id: "amz-learn-curious-1",
    text: "Describe a concept you taught yourself recently and how it changed your approach to a problem.",
    lp: "Learn and Be Curious",
    estMinutes: 4,
  },
  {
    id: "amz-think-big-1",
    text: "Walk me through a project where you proposed a 10x bigger version of what was asked.",
    lp: "Think Big",
    estMinutes: 5,
  },
  {
    id: "amz-frugality-1",
    text: "Tell me about a time you got a meaningful outcome with significantly less than you were given.",
    lp: "Frugality",
    estMinutes: 4,
  },
  {
    id: "amz-hire-develop-1",
    text: "Describe how you helped a teammate level up. What gap did you close?",
    lp: "Hire and Develop the Best",
    estMinutes: 5,
  },
  {
    id: "amz-success-scale-1",
    text: "Tell me about a second-order consequence you anticipated and addressed in a system you built.",
    lp: "Success and Scale Bring Broad Responsibility",
    estMinutes: 5,
  },
];

// React/JavaScript drill questions. `lp` MUST exactly match a REACT_JS_COMPETENCIES
// name (rubric-definitions.ts) so the report can target the candidate's weakest area.
const REACT_QUESTIONS: DrillQuestion[] = [
  {
    id: "react-closures-1",
    text: "Explain what a closure captures and walk me through a stale-closure bug you've hit with a React hook or an event handler.",
    lp: "Closures & Scope",
    estMinutes: 4,
  },
  {
    id: "react-event-loop-1",
    text: "Order the output of a snippet mixing setTimeout(0), a Promise.then, and synchronous logs — and explain why, in terms of the call stack and the microtask vs macrotask queue.",
    lp: "Asynchronous JS & the Event Loop",
    estMinutes: 5,
  },
  {
    id: "react-prototypes-1",
    text: "Walk me through property lookup on the prototype chain and what `new` actually wires up. When would you reach for prototype delegation over class syntax?",
    lp: "Prototypes & Inheritance",
    estMinutes: 4,
  },
  {
    id: "react-this-1",
    text: "How do you determine what `this` is at a call site? Show me how you'd fix a method that loses its `this` when passed as a callback.",
    lp: "`this` & Execution Context",
    estMinutes: 4,
  },
  {
    id: "react-equality-1",
    text: "Explain reference vs value equality in JS and how it bites you in React — for example with a useEffect dependency or a memo comparison.",
    lp: "Types, Coercion & Equality",
    estMinutes: 4,
  },
  {
    id: "react-hooks-rules-1",
    text: "Why must hooks be called unconditionally and in the same order every render? Explain the model that makes a conditional hook break.",
    lp: "Hooks & the Rules of Hooks",
    estMinutes: 4,
  },
  {
    id: "react-state-model-1",
    text: "Walk me through why reading state right after calling setState gives the old value. Explain state-as-a-snapshot and when you'd use a functional update.",
    lp: "State & the Re-render Model",
    estMinutes: 5,
  },
  {
    id: "react-effects-1",
    text: "Frame useEffect as synchronization rather than a lifecycle hook. Pick a fetch-on-mount example and walk me through the dependencies and the cleanup that avoids a race.",
    lp: "Effects & Synchronization",
    estMinutes: 5,
  },
  {
    id: "react-reconciliation-1",
    text: "Explain how React decides whether to reuse or remount a component, and show me a concrete bug caused by using an array index as a key.",
    lp: "Reconciliation & Keys",
    estMinutes: 5,
  },
  {
    id: "react-context-1",
    text: "When does Context cause unnecessary re-renders, and how do you bound that? Compare context vs composition vs a state library for a shared piece of state.",
    lp: "Context & Composition",
    estMinutes: 5,
  },
  {
    id: "nextjs-routing-1",
    text: "Walk me through the App Router file conventions — layout, page, loading, error — and how nested layouts compose. When would you reach for a route group or a dynamic segment?",
    lp: "Next.js App Router & Routing",
    estMinutes: 5,
  },
  {
    id: "nextjs-server-client-1",
    text: "Explain what runs on the server vs the client in the RSC model. Where do you put the `use client` boundary, what can cross it, and how does that keep your client bundle small?",
    lp: "Server vs Client Components",
    estMinutes: 5,
  },
  {
    id: "nextjs-data-fetching-1",
    text: "How do you fetch data on the server in the App Router, and what does the fetch cache do? Walk me through choosing time-based vs on-demand revalidation, and opting out for dynamic data.",
    lp: "Data Fetching & Caching",
    estMinutes: 5,
  },
  {
    id: "nextjs-rendering-1",
    text: "Distinguish static from dynamic rendering in Next.js and what forces each. When would you use ISR, and how does Suspense streaming change what the user sees first?",
    lp: "Rendering Strategies (SSR/SSG/ISR/Streaming)",
    estMinutes: 5,
  },
  {
    id: "react-memoization-1",
    text: "Explain exactly what useMemo, useCallback, and React.memo prevent, the referential-equality contract they rely on, and a case where adding them made things worse.",
    lp: "Render Performance & Memoization",
    estMinutes: 5,
  },
  {
    id: "react-rerenders-1",
    text: "A component is re-rendering too often. Walk me through how you'd find the trigger and decide between lifting state, splitting the component, or memoizing.",
    lp: "Avoiding Unnecessary Re-renders",
    estMinutes: 5,
  },
  {
    id: "react-profiling-1",
    text: "Walk me through how you'd profile a slow React screen — what tool, what you look at in render vs commit, and how you confirm the fix actually helped.",
    lp: "Profiling & Measurement",
    estMinutes: 5,
  },
  {
    id: "react-loading-1",
    text: "How would you cut the initial load time of a large React app? Talk through code-splitting, lazy loading, and the tradeoffs with hydration and prefetching.",
    lp: "Loading & Bundle Performance",
    estMinutes: 5,
  },
];

const COMPANY_QUESTIONS: Record<string, DrillQuestion[]> = {
  amazon: AMAZON_QUESTIONS,
  react: REACT_QUESTIONS,
};

export function getDrillQuestion(
  company: string,
  lp: string
): DrillQuestion | null {
  const bank = COMPANY_QUESTIONS[company.toLowerCase()];
  if (!bank) return null;
  const matches = bank.filter(
    (q) => q.lp.toLowerCase() === lp.toLowerCase()
  );
  if (matches.length === 0) {
    return bank[0] ?? null;
  }
  return matches[Math.floor(Math.random() * matches.length)]!;
}

/**
 * Strict variant: returns null (NOT bank[0]) when the LP has no question, so a
 * gap LP with zero coverage never silently mis-targets the user to Ownership.
 * The coach still uses getDrillQuestion (unchanged); the panel report uses this.
 */
export function getDrillQuestionStrict(
  company: string,
  lp: string
): DrillQuestion | null {
  const bank = COMPANY_QUESTIONS[company.toLowerCase()];
  if (!bank) return null;
  const matches = bank.filter((q) => q.lp.toLowerCase() === lp.toLowerCase());
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)]!;
}

export function getFallbackDrillQuestion(company: string): DrillQuestion | null {
  const bank = COMPANY_QUESTIONS[company.toLowerCase()];
  return bank?.[0] ?? null;
}

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

const COMPANY_QUESTIONS: Record<string, DrillQuestion[]> = {
  amazon: AMAZON_QUESTIONS,
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

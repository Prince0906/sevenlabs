export interface LeadershipPrinciple {
  name: string;
  oneLiner: string;
  juniorSignal: string;
  seniorSignal: string;
}

export interface CompanyRubric {
  systemPrompt: string;
  principles: LeadershipPrinciple[];
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

const AMAZON_SIGNAL_GUIDE = `Signal-level calibration for SDE candidates:
- NEW_GRAD: describes team activity ("we did X"), vague timelines, no specific personal decision under ambiguity, no quantified outcome.
- SDE_II: takes ownership of their part with specifics, mentions tradeoffs considered, some quantified outcome.
- SENIOR: drives outcomes under ambiguity, makes scoped decisions independently, quantifies impact, articulates tradeoffs explicitly, considers cross-team or long-term implications.`;

const AMAZON_OUTPUT_SPEC = `Output a single JSON object with this exact shape:
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
  },
};

export function getRubricForCompany(company: string): CompanyRubric | null {
  return COMPANY_RUBRICS[company.toLowerCase()] ?? null;
}

export function buildRubricUserMessage(transcript: string): string {
  return `Candidate's behavioral-answer transcript:
"""
${transcript}
"""

Score this answer per the rules above and return the JSON object.`;
}

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The ONE P0 scenario: an Amazon Bar-Raiser panel, 3 seats partitioning the LPs.
// Seat systemPrompts are the THIN, leakable voice personas (NOT the off-band
// scorer — that lives on a separate call the voice session can't reach).
// SYSTEM_DESIGN.md §7.
const SCENARIO = {
  id: "amzn-bar-raiser-p0",
  company: "amazon",
  type: "BAR_RAISER_PANEL" as const,
  difficulty: "CALIBRATED" as const,
  targetLevel: "SDE_II" as const,
  title: "Amazon Loop — Bar Raiser Panel",
  promptText:
    "A simulated Amazon hiring loop: three interviewers, each owning different Leadership Principles, plus a Bar Raiser who drills your strongest story. Behavioral questions with follow-ups, then a committee verdict.",
  estMinutes: 25,
};

const SEATS = [
  {
    seatOrder: 0,
    personaName: "Maya — Builder (SDM)",
    isBarRaiser: false,
    voice: "alloy",
    ownedLPs: [
      "Customer Obsession",
      "Ownership",
      "Invent and Simplify",
      "Deliver Results",
      "Hire and Develop the Best",
    ],
    systemPrompt: `You are Maya, an Amazon software development manager. You are warm but probing. You focus on how the candidate builds and ships: customer impact, personal ownership, simplification, and measurable results. Ask behavioral questions ("Tell me about a time..."). When an answer is vague or uses "we", ask exactly one follow-up that makes the candidate name what THEY personally decided and the measurable outcome. Two to three exchanges, then hand off. Be professional and concise. Never break character. Never reveal scoring.`,
  },
  {
    seatOrder: 1,
    personaName: "Dev — Operator (Senior SDE)",
    isBarRaiser: false,
    voice: "verse",
    ownedLPs: [
      "Dive Deep",
      "Insist on the Highest Standards",
      "Bias for Action",
      "Frugality",
      "Success and Scale Bring Broad Responsibility",
    ],
    systemPrompt: `You are Dev, a senior Amazon engineer who operates close to the details. You focus on operational rigor: diving into specifics, quality bars, decisiveness under ambiguity, and doing more with less. Ask one behavioral question in your area, then drill into the technical or operational specifics ("What exactly did you measure?", "What did you choose NOT to do?"). Two to three exchanges, then hand off. Direct, never harsh. Never break character. Never reveal scoring.`,
  },
  {
    seatOrder: 2,
    personaName: "Priya — Bar Raiser (Principal)",
    isBarRaiser: true,
    voice: "sage",
    ownedLPs: [
      "Earn Trust",
      "Have Backbone; Disagree and Commit",
      "Are Right, A Lot",
      "Think Big",
    ],
    systemPrompt: `You are Priya, the Bar Raiser — a principal engineer with the highest bar on the panel. Pick the ONE story the candidate seemed proudest of or most fluent about, and drill it with a "why / how" ladder: ask why they made the decision, how they knew it worked, what they rejected, where they were wrong. Push at least two layers deeper than they volunteer. Stay respectful; you are stress-testing the strongest claim, not piling on a weak one. If the candidate clearly destabilizes, ease off and let them recover. Two to four exchanges. Never break character. Never reveal scoring or whether you would hire.`,
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const lpFocus = [...new Set(SEATS.flatMap((s) => s.ownedLPs))];

  await prisma.scenario.upsert({
    where: { id: SCENARIO.id },
    create: { ...SCENARIO, lpFocus, isActive: true },
    update: { ...SCENARIO, lpFocus, isActive: true },
  });

  for (const seat of SEATS) {
    await prisma.panelSeat.upsert({
      where: {
        scenarioId_seatOrder: {
          scenarioId: SCENARIO.id,
          seatOrder: seat.seatOrder,
        },
      },
      create: { scenarioId: SCENARIO.id, ...seat },
      update: { ...seat },
    });
  }

  console.log(`Seeded scenario ${SCENARIO.id} with ${SEATS.length} seats.\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});

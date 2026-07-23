import { describe, it, expect, vi, beforeEach } from "vitest";
import { interviewReportSchema } from "@sevenlabs/shared-types";

// runJudgment is the off-band judge: score each seat, run the committee, assemble
// the report, persist it. The I/O boundary (prisma + the OpenAI calls + spend) is
// mocked; the pure panel-core composition runs for real, so this locks in the
// invariants that flow THROUGH the orchestrator: idempotent skip, the REQUIRED Bar
// Raiser veto, the D4 provenance stamp, the D15 report-schema gate, the B2
// resilience population.

const mockPrisma = vi.hoisted(() => ({
  interviewSession: { findUnique: vi.fn(), update: vi.fn() },
  dimensionScore: { createMany: vi.fn() },
  panelVerdict: { create: vi.fn() },
  confidenceMetric: { create: vi.fn() },
  drillAssignment: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const mockOpenai = vi.hoisted(() => ({
  scoreAgainstRubric: vi.fn(),
  judgeCommittee: vi.fn(),
  JUDGE_MODEL: "gpt-4o-mini",
}));
const mockSpend = vi.hoisted(() => ({ settleReservation: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/providers/openai", () => mockOpenai);
vi.mock("@/lib/interview/spend", () => mockSpend);
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
// panel-core (pure composition) + shared-types (schemas) stay real.

import { runJudgment } from "@/lib/interview/panel-orchestrator";

const EVIDENCE = "owned the outage end to end";

function userTurn(seq: number) {
  return {
    seq,
    role: "USER" as const,
    seatId: null,
    transcript: `On the incident I ${EVIDENCE} and drove the fix.`,
    metricsJson: {
      wpm: 140,
      pauseCount: 1,
      avgPauseMs: 400,
      longestPauseMs: 500,
      fillerCount: 0,
      speakingRatio: 0.9,
      turnDurationSec: 30,
    },
    disfluencyJson: null,
  };
}

function seat(over: Record<string, unknown>) {
  return {
    id: "seat0",
    personaName: "Maya",
    ownedLPs: ["Ownership"],
    isBarRaiser: false,
    voice: "alloy",
    systemPrompt: "You are Maya.",
    seatOrder: 0,
    ...over,
  };
}

/** A DEBRIEF session with two seats (one Bar Raiser) and 6 scored USER turns. */
function debriefSession(over: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    status: "DEBRIEF",
    targetLevel: "SDE_II",
    spendCents: 60,
    degradedDelivery: false,
    scenario: {
      company: "amazon",
      difficulty: "CALIBRATED",
      panelSeats: [
        seat({ id: "seat0", isBarRaiser: false, seatOrder: 0 }),
        seat({ id: "seat1", personaName: "Priya", ownedLPs: ["Dive Deep"], isBarRaiser: true, seatOrder: 1 }),
      ],
    },
    turns: [0, 1, 2, 3, 4, 5].map(userTurn),
    ...over,
  };
}

const validRubric = {
  matchedLPs: [
    {
      name: "Ownership",
      signalLevel: "SDE_II",
      evidence: EVIDENCE,
      gap: "Name the alternative you rejected and why.",
    },
  ],
  overallSignal: "SDE_II",
  weakestArea: "Dive Deep",
};
const validCommittee = {
  overallSignal: "SDE_II",
  inclination: "LEAN_HIRE",
  barRaiserVeto: false,
  summary: "Solid ownership signal, depth a touch shallow.",
  seatRollup: [],
  topStrengths: ["clear ownership"],
  topRisks: ["shallow technical depth"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockResolvedValue([]);
  mockPrisma.interviewSession.update.mockReturnValue({ _op: "session.update" });
  mockPrisma.panelVerdict.create.mockReturnValue({ _op: "verdict.create" });
  mockPrisma.confidenceMetric.create.mockReturnValue({ _op: "cm.create" });
  mockPrisma.dimensionScore.createMany.mockReturnValue({ _op: "dim.createMany" });
  mockPrisma.drillAssignment.create.mockReturnValue({ _op: "drill.create" });
  mockOpenai.scoreAgainstRubric.mockResolvedValue(validRubric);
  mockOpenai.judgeCommittee.mockResolvedValue(validCommittee);
  mockSpend.settleReservation.mockResolvedValue(undefined);
});

describe("runJudgment — guards", () => {
  it("is idempotent: a non-DEBRIEF session does no scoring and no writes", async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue(debriefSession({ status: "COMPLETED" }));
    await runJudgment("s1");
    expect(mockOpenai.scoreAgainstRubric).not.toHaveBeenCalled();
    expect(mockOpenai.judgeCommittee).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws when the scenario has no Bar Raiser seat (the veto can never be skipped)", async () => {
    const s = debriefSession();
    s.scenario.panelSeats = [seat({ id: "seat0", isBarRaiser: false })];
    mockPrisma.interviewSession.findUnique.mockResolvedValue(s);
    await expect(runJudgment("s1")).rejects.toThrow(/Bar Raiser/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws when Bar Raiser scoring fails (verdict must never miss the veto)", async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue(debriefSession());
    mockOpenai.scoreAgainstRubric.mockResolvedValue({ bad: "shape" }); // fails rubric parse
    await expect(runJudgment("s1")).rejects.toThrow();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("runJudgment — per-seat scoring (1c)", () => {
  it("scores only seats that received answers; the silent Bar Raiser is skipped without a throw", async () => {
    const s = debriefSession({
      turns: [
        { ...userTurn(0), seatId: "seat0", transcript: "Answer for Maya about ownership." },
        { ...userTurn(1), seatId: "seat0", transcript: "More detail for Maya." },
      ],
    });
    mockPrisma.interviewSession.findUnique.mockResolvedValue(s);
    await runJudgment("s1"); // seat1 (Bar Raiser) never spoke — must NOT throw
    expect(mockOpenai.scoreAgainstRubric).toHaveBeenCalledTimes(1);
    const verdictArg = mockPrisma.panelVerdict.create.mock.calls[0]![0];
    expect(verdictArg.data.seatRollup).toHaveLength(1);
    expect(verdictArg.data.seatRollup[0].seatId).toBe("seat0");
    expect(verdictArg.data.barRaiserVeto).toBe(false); // unreached round can't veto
  });

  it("gives each spoken seat its OWN transcript slice, not the whole session", async () => {
    const s = debriefSession({
      turns: [
        { ...userTurn(0), seatId: "seat0", transcript: "Maya answer one." },
        { ...userTurn(1), seatId: "seat1", transcript: "Priya answer two." },
      ],
    });
    mockPrisma.interviewSession.findUnique.mockResolvedValue(s);
    await runJudgment("s1");
    expect(mockOpenai.scoreAgainstRubric).toHaveBeenCalledTimes(2);
    const msg0 = mockOpenai.scoreAgainstRubric.mock.calls[0]![1] as string;
    const msg1 = mockOpenai.scoreAgainstRubric.mock.calls[1]![1] as string;
    expect(msg0).toContain("Maya answer one.");
    expect(msg0).not.toContain("Priya answer two.");
    expect(msg1).toContain("Priya answer two.");
    expect(msg1).not.toContain("Maya answer one.");
  });

  it("appends unattributed (null-seatId) turns to every scored seat's slice", async () => {
    const s = debriefSession({
      turns: [
        { ...userTurn(0), seatId: "seat0", transcript: "Maya answer one." },
        { ...userTurn(1), seatId: null, transcript: "Untagged closing remark." },
      ],
    });
    mockPrisma.interviewSession.findUnique.mockResolvedValue(s);
    await runJudgment("s1");
    expect(mockOpenai.scoreAgainstRubric).toHaveBeenCalledTimes(1); // seat0 only
    const msg0 = mockOpenai.scoreAgainstRubric.mock.calls[0]![1] as string;
    expect(msg0).toContain("Untagged closing remark.");
  });

  it("throws on a session with zero answered turns (nothing to judge)", async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue(
      debriefSession({ turns: [] })
    );
    await expect(runJudgment("s1")).rejects.toThrow(/no user answers/);
    expect(mockOpenai.scoreAgainstRubric).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("runJudgment — persisted artifacts", () => {
  beforeEach(() => {
    mockPrisma.interviewSession.findUnique.mockResolvedValue(debriefSession());
  });

  it("stamps rubricVersion + judgeModel on the verdict (D4)", async () => {
    await runJudgment("s1");
    const verdictArg = mockPrisma.panelVerdict.create.mock.calls[0]![0];
    // Deliberately hardcoded (not RUBRIC_VERSION): an accidental bump — or a
    // judge-contract change WITHOUT a bump — must fail this test consciously.
    expect(verdictArg.data.rubricVersion).toBe("2026.07.0");
    expect(verdictArg.data.judgeModel).toBe("gpt-4o-mini");
  });

  it("persists a reportJson that satisfies interviewReportSchema (D15)", async () => {
    await runJudgment("s1");
    const sessionArg = mockPrisma.interviewSession.update.mock.calls[0]![0];
    expect(sessionArg.data.status).toBe("COMPLETED");
    // The stored value is the schema-validated report; re-parsing must succeed.
    expect(() => interviewReportSchema.parse(sessionArg.data.reportJson)).not.toThrow();
  });

  it("populates the within-speaker resilience delta (B2)", async () => {
    await runJudgment("s1");
    const cmArg = mockPrisma.confidenceMetric.create.mock.calls[0]![0];
    expect(typeof cmArg.data.resilience).toBe("number"); // 6 usable turns → non-null
    expect(cmArg.data.selfEfficacy).toBeNull();
    const sessionArg = mockPrisma.interviewSession.update.mock.calls[0]![0];
    expect(typeof sessionArg.data.reportJson.resilience).toBe("number");
  });

  it("settles the spend reservation on the server clock", async () => {
    await runJudgment("s1");
    expect(mockSpend.settleReservation).toHaveBeenCalledWith("s1", 0.6); // 60 cents
  });
});

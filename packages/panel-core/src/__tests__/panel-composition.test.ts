import { describe, it, expect } from "vitest";
import type { SpeechMetrics, PanelVerdictData } from "@sevenlabs/shared-types";
import {
  buildSeatRubric,
  seatScoresToDimensionRows,
  barRaiserDrillDepth,
  evaluateDrill,
  finalizeVerdict,
  computeComposure,
  computeResilience,
  selectOneRep,
  buildCommitteeMessage,
  COMMITTEE_DEBRIEF_PROMPT,
  type SeatRubricOutput,
} from "../panel-composition";
import { getDrillQuestionStrict } from "../question-bank";

function metric(p: Partial<SpeechMetrics>): SpeechMetrics {
  return {
    wpm: 140,
    pauseCount: 1,
    avgPauseMs: 400,
    longestPauseMs: 500,
    fillerCount: 0,
    speakingRatio: 0.9,
    turnDurationSec: 30,
    ...p,
  };
}

describe("buildSeatRubric", () => {
  it("filters to the seat's owned LPs and embeds them + target + output spec", () => {
    const { systemPrompt, ownedLPs } = buildSeatRubric({
      company: "amazon",
      ownedLPs: ["Ownership", "Bias for Action"],
      isBarRaiser: false,
      targetLevel: "SENIOR",
    });
    expect(ownedLPs).toEqual(["Ownership", "Bias for Action"]);
    expect(systemPrompt).toContain("Ownership");
    expect(systemPrompt).toContain("Bias for Action");
    expect(systemPrompt).toContain("SENIOR");
    expect(systemPrompt).toContain("matchedLPs"); // identical output contract
    expect(systemPrompt).not.toContain("Frugality"); // a non-owned LP is excluded
  });

  it("resolves the React/JS rubric and embeds the seat's owned competencies", () => {
    const { systemPrompt } = buildSeatRubric({
      company: "react",
      ownedLPs: ["Closures & Scope", "State & the Re-render Model"],
      isBarRaiser: false,
      targetLevel: "SDE_II",
    });
    expect(systemPrompt).toContain("Closures & Scope");
    expect(systemPrompt).toContain("State & the Re-render Model");
    expect(systemPrompt).toContain("matchedLPs"); // identical output contract
  });

  it("throws on a competency name not in the company rubric", () => {
    expect(() =>
      buildSeatRubric({ company: "amazon", ownedLPs: ["Not An LP"], isBarRaiser: false, targetLevel: "SDE_II" })
    ).toThrow(/mismatch/);
  });

  it("throws on an unknown rubric company", () => {
    expect(() =>
      buildSeatRubric({ company: "nope", ownedLPs: [], isBarRaiser: false, targetLevel: "SDE_II" })
    ).toThrow(/unknown rubric company/);
  });
});

describe("seatScoresToDimensionRows", () => {
  const OWNED = ["Ownership", "Deliver Results"];
  const TRANSCRIPT = "So I owned the migration end-to-end and cut p99 by 40%.";

  it("maps signal→score (40/70/90) and keeps a verbatim quote intact", () => {
    const parsed: SeatRubricOutput = {
      matchedLPs: [
        {
          name: "Ownership",
          signalLevel: "SENIOR",
          evidence: "I owned the migration",
          gap: "Quantify the latency win in customer terms.",
        },
      ],
      overallSignal: "SDE_II",
      weakestArea: "Name the specific tradeoff you rejected.",
    };
    const { rows, unknownKeys, blankedEvidence } = seatScoresToDimensionRows(
      "seat1", "user1", "sess1", parsed, TRANSCRIPT, OWNED
    );
    expect(unknownKeys).toEqual([]);
    expect(blankedEvidence).toBe(0);
    expect(rows[0]).toMatchObject({
      key: "Ownership",
      signalLevel: "SENIOR",
      score: 90,
      evidence: "I owned the migration",
      // The gap is THIS LP's coaching step — not the seat-wide weakestArea (1b).
      gap: "Quantify the latency win in customer terms.",
      seatId: "seat1",
    });
    expect(rows[0].gap).not.toBe(parsed.weakestArea);
  });

  it("KEEPS a paraphrased-evidence row (scoring survives) but blanks the quote", () => {
    const parsed: SeatRubricOutput = {
      matchedLPs: [
        { name: "Deliver Results", signalLevel: "NEW_GRAD", evidence: "QUOTE NOT IN TRANSCRIPT", gap: "g" },
      ],
      overallSignal: "NEW_GRAD",
      weakestArea: "w",
    };
    const { rows, blankedEvidence } = seatScoresToDimensionRows(
      "seat1", "user1", "sess1", parsed, TRANSCRIPT, OWNED
    );
    expect(rows).toHaveLength(1); // the defect: this row used to be silently dropped
    expect(rows[0].evidence).toBe(""); // anti-fabrication still holds for display
    expect(rows[0].score).toBe(40);
    expect(blankedEvidence).toBe(1);
  });

  it("verifies a quote that differs only in casing/punctuation/curly quotes as verbatim", () => {
    const parsed: SeatRubricOutput = {
      matchedLPs: [
        // ASR wrote "cut p99 by 40%."; the judge normalizes punctuation + case.
        { name: "Ownership", signalLevel: "SDE_II", evidence: "Cut P99 by 40%", gap: "g" },
      ],
      overallSignal: "SDE_II",
      weakestArea: "w",
    };
    const { rows, blankedEvidence } = seatScoresToDimensionRows(
      "seat1", "user1", "sess1", parsed, TRANSCRIPT, OWNED
    );
    expect(blankedEvidence).toBe(0);
    expect(rows[0].evidence).toBe("Cut P99 by 40%");
  });

  it("drops a row scoring a competency the seat does not own and reports the key", () => {
    const parsed: SeatRubricOutput = {
      matchedLPs: [
        { name: "Ownership", signalLevel: "SENIOR", evidence: "I owned the migration", gap: "g" },
        { name: "Invented Competency", signalLevel: "SENIOR", evidence: "I owned the migration", gap: "g" },
      ],
      overallSignal: "SDE_II",
      weakestArea: "w",
    };
    const { rows, unknownKeys } = seatScoresToDimensionRows(
      "seat1", "user1", "sess1", parsed, TRANSCRIPT, OWNED
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("Ownership");
    expect(unknownKeys).toEqual(["Invented Competency"]);
  });
});

describe("barRaiserDrillDepth", () => {
  it("counts only the Bar Raiser seat's interviewer turns", () => {
    const turns = [
      { role: "INTERVIEWER" as const, seatId: "br" },
      { role: "USER" as const, seatId: null },
      { role: "INTERVIEWER" as const, seatId: "br" },
      { role: "INTERVIEWER" as const, seatId: "other" },
    ];
    expect(barRaiserDrillDepth(turns, "br")).toBe(2);
  });
});

describe("evaluateDrill (the deterministic veto)", () => {
  const collapsed: SeatRubricOutput = {
    matchedLPs: [{ name: "Ownership", signalLevel: "NEW_GRAD", evidence: "x", gap: "g" }],
    overallSignal: "NEW_GRAD",
    weakestArea: "y",
  };
  it("vetoes when the story collapsed AND drilled ≥2 layers", () => {
    expect(evaluateDrill({ barRaiserScores: collapsed, followUpDepthApplied: 3 }).barRaiserVeto).toBe(true);
  });
  it("vetoes when no LP surfaced at all after ≥2 drills", () => {
    expect(
      evaluateDrill({
        barRaiserScores: { matchedLPs: [], overallSignal: "NEW_GRAD", weakestArea: "y" },
        followUpDepthApplied: 2,
      }).barRaiserVeto
    ).toBe(true);
  });
  it("does NOT veto on the first vague answer (depth < 2)", () => {
    expect(evaluateDrill({ barRaiserScores: collapsed, followUpDepthApplied: 1 }).barRaiserVeto).toBe(false);
  });
  it("does NOT veto when a non-NEW_GRAD signal surfaced", () => {
    const ok: SeatRubricOutput = {
      matchedLPs: [{ name: "Ownership", signalLevel: "SDE_II", evidence: "x", gap: "g" }],
      overallSignal: "SDE_II",
      weakestArea: "y",
    };
    expect(evaluateDrill({ barRaiserScores: ok, followUpDepthApplied: 3 }).barRaiserVeto).toBe(false);
  });
});

describe("finalizeVerdict", () => {
  const base: PanelVerdictData = {
    overallSignal: "SENIOR",
    inclination: "HIRE",
    barRaiserVeto: false,
    summary: "Strong across the board.",
    seatRollup: [],
    topStrengths: [],
    topRisks: [],
  };
  it("passes the model verdict through when there is no veto", () => {
    expect(finalizeVerdict(base, { barRaiserVeto: false, reason: "" })).toEqual(base);
  });
  it("overrides to NO_HIRE, clamps SENIOR→SDE_II, prefixes the reason on veto", () => {
    const out = finalizeVerdict(base, { barRaiserVeto: true, reason: "story did not hold." });
    expect(out.inclination).toBe("NO_HIRE");
    expect(out.barRaiserVeto).toBe(true);
    expect(out.overallSignal).toBe("SDE_II");
    expect(out.summary.startsWith("Bar Raiser veto: story did not hold.")).toBe(true);
  });
});

describe("computeComposure (frozen v1 Confidence Index)", () => {
  it("returns 0 for a session with no usable turns", () => {
    expect(computeComposure([], 3)).toEqual({ score: 0, composure: 0 });
  });
  it("scores a fluent, steady session high", () => {
    const clean = [metric({}), metric({})];
    expect(computeComposure(clean, 3).composure).toBeGreaterThanOrEqual(90);
  });
  it("scores a filler-heavy, erratic session much lower", () => {
    const noisy = [
      metric({ wpm: 100, fillerCount: 8, longestPauseMs: 200 }),
      metric({ wpm: 200, fillerCount: 10, longestPauseMs: 3000 }),
    ];
    const cleanScore = computeComposure([metric({}), metric({})], 3).composure;
    const noisyScore = computeComposure(noisy, 3).composure;
    expect(noisyScore).toBeLessThan(cleanScore);
    expect(noisyScore).toBeLessThan(40);
  });
  it("applies the difficulty upward correction (ADVERSARIAL > CALIBRATED)", () => {
    const turns = [metric({ wpm: 120, fillerCount: 2 }), metric({ wpm: 150, fillerCount: 3 })];
    expect(computeComposure(turns, 4).composure).toBeGreaterThanOrEqual(
      computeComposure(turns, 3).composure
    );
  });
});

describe("computeResilience (within-speaker warmup delta)", () => {
  const clean = () => metric({});
  const noisy = () => metric({ wpm: 105, fillerCount: 9, longestPauseMs: 2600 });
  const erratic = () => metric({ wpm: 210, fillerCount: 11, longestPauseMs: 300 });

  it("returns null below 4 usable turns (too short for a trustworthy delta)", () => {
    expect(computeResilience([clean(), clean(), clean()], 3)).toBeNull();
    // turns with no word timings don't count toward the 4-turn floor
    expect(
      computeResilience([clean(), clean(), clean(), metric({ wpm: 0, turnDurationSec: 0 })], 3)
    ).toBeNull();
  });

  it("centers at 50 when composure holds steady across the session", () => {
    const r = computeResilience([clean(), clean(), clean(), clean()], 3);
    expect(r).not.toBeNull();
    expect(r!.resilience).toBe(50);
  });

  it("scores below 50 when delivery degrades from the early baseline", () => {
    const r = computeResilience([clean(), clean(), noisy(), erratic()], 3);
    expect(r).not.toBeNull();
    expect(r!.resilience).toBeLessThan(50);
    expect(r!.pressureComposure).toBeLessThan(r!.baselineComposure);
  });

  it("scores above 50 when delivery sharpens under pressure", () => {
    const r = computeResilience([noisy(), erratic(), clean(), clean()], 3);
    expect(r).not.toBeNull();
    expect(r!.resilience).toBeGreaterThan(50);
    expect(r!.pressureComposure).toBeGreaterThan(r!.baselineComposure);
  });
});

describe("selectOneRep (drill fallback)", () => {
  it("skips an LP with zero questions and picks the next covered one", () => {
    // "Strive to be Earth's Best Employer" has no question in the bank
    expect(getDrillQuestionStrict("amazon", "Strive to be Earth's Best Employer")).toBeNull();
    const rep = selectOneRep("amazon", [
      "Strive to be Earth's Best Employer",
      "Ownership",
    ]);
    expect(rep).not.toBeNull();
    expect(rep!.lp).toBe("Ownership");
  });
});

describe("committee debrief", () => {
  it("the prompt pins the verdict JSON shape", () => {
    expect(COMMITTEE_DEBRIEF_PROMPT).toContain("seatRollup");
    expect(COMMITTEE_DEBRIEF_PROMPT).toContain("inclination");
  });
  it("the message embeds each seat read + the Bar Raiser outcome", () => {
    const msg = buildCommitteeMessage({
      targetLevel: "SENIOR",
      seats: [
        {
          seatId: "s1",
          personaName: "Priya",
          ownedLPs: ["Ownership"],
          seatSignal: "SDE_II",
          weakestArea: "name the decision you made",
        },
      ],
      drill: { barRaiserVeto: true, reason: "did not hold" },
    });
    expect(msg).toContain("Priya");
    expect(msg).toContain("SENIOR");
    expect(msg).toContain("VETO");
  });
});

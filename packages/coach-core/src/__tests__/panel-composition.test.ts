import { describe, it, expect } from "vitest";
import type { SpeechMetrics, PanelVerdictData } from "@sevenlabs/shared-types";
import {
  buildSeatRubric,
  seatScoresToDimensionRows,
  barRaiserDrillDepth,
  evaluateDrill,
  finalizeVerdict,
  computeComposure,
  selectOneRep,
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

  it("throws on an LP name that is not a real Amazon LP", () => {
    expect(() =>
      buildSeatRubric({ ownedLPs: ["Not An LP"], isBarRaiser: false, targetLevel: "SDE_II" })
    ).toThrow(/mismatch/);
  });
});

describe("seatScoresToDimensionRows", () => {
  it("maps signal→score (40/70/90), shares weakestArea as gap, drops hallucinated quotes", () => {
    const parsed: SeatRubricOutput = {
      matchedLPs: [
        { name: "Ownership", signalLevel: "SENIOR", evidence: "I owned the migration" },
        { name: "Deliver Results", signalLevel: "NEW_GRAD", evidence: "QUOTE NOT IN TRANSCRIPT" },
      ],
      overallSignal: "SDE_II",
      weakestArea: "Name the specific tradeoff you rejected.",
    };
    const rows = seatScoresToDimensionRows(
      "seat1",
      "user1",
      "sess1",
      parsed,
      "So I owned the migration end-to-end and cut p99 by 40%."
    );
    expect(rows).toHaveLength(1); // the non-substring quote was dropped
    expect(rows[0]).toMatchObject({
      key: "Ownership",
      signalLevel: "SENIOR",
      score: 90,
      gap: "Name the specific tradeoff you rejected.",
      seatId: "seat1",
    });
  });
});

describe("barRaiserDrillDepth", () => {
  it("counts only the Bar Raiser seat's interviewer turns", () => {
    const turns = [
      { role: "COACH" as const, seatId: "br" },
      { role: "USER" as const, seatId: null },
      { role: "COACH" as const, seatId: "br" },
      { role: "COACH" as const, seatId: "other" },
    ];
    expect(barRaiserDrillDepth(turns, "br")).toBe(2);
  });
});

describe("evaluateDrill (the deterministic veto)", () => {
  const collapsed: SeatRubricOutput = {
    matchedLPs: [{ name: "Ownership", signalLevel: "NEW_GRAD", evidence: "x" }],
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
      matchedLPs: [{ name: "Ownership", signalLevel: "SDE_II", evidence: "x" }],
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

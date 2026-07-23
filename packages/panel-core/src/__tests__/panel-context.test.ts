import { describe, it, expect } from "vitest";
import { buildPanelContextDigest, type PanelTurnLite } from "../panel-context";

const turn = (role: "USER" | "INTERVIEWER", text: string | null): PanelTurnLite => ({ role, text });

describe("buildPanelContextDigest", () => {
  it("returns '' for no usable turns (seat 1 / empty handoff)", () => {
    expect(buildPanelContextDigest([])).toBe("");
    expect(buildPanelContextDigest([turn("USER", ""), turn("INTERVIEWER", null)])).toBe("");
  });

  it("labels roles as Candidate / Interviewer and frames it as continuity", () => {
    const digest = buildPanelContextDigest([
      turn("INTERVIEWER", "What does a closure capture?"),
      turn("USER", "It captures variables by reference from its lexical scope."),
    ]);
    expect(digest).toContain("EARLIER IN THIS PANEL");
    expect(digest).toContain("Interviewer: What does a closure capture?");
    expect(digest).toContain("Candidate: It captures variables by reference");
    expect(digest).toMatch(/introduce yourself/i);
  });

  it("keeps only the last 6 turns (bounded — never the whole transcript)", () => {
    const turns: PanelTurnLite[] = Array.from({ length: 20 }, (_, i) =>
      turn(i % 2 === 0 ? "INTERVIEWER" : "USER", `turn number ${i}`)
    );
    const digest = buildPanelContextDigest(turns);
    expect(digest).toContain("turn number 19");
    expect(digest).toContain("turn number 14");
    expect(digest).not.toContain("turn number 13");
    expect(digest).not.toContain("turn number 0");
  });

  it("truncates a very long answer", () => {
    const long = "x".repeat(1000);
    const digest = buildPanelContextDigest([turn("USER", long)]);
    expect(digest).toContain("…");
    // the 1000-char answer is clipped well below its original length
    expect(digest).not.toContain("x".repeat(400));
    expect(digest).toContain("x".repeat(300));
  });

  it("skips empty/blank turns when selecting the recent window", () => {
    const digest = buildPanelContextDigest([
      turn("INTERVIEWER", "real question"),
      turn("USER", "   "),
      turn("INTERVIEWER", null),
      turn("USER", "real answer"),
    ]);
    expect(digest).toContain("Interviewer: real question");
    expect(digest).toContain("Candidate: real answer");
  });
});

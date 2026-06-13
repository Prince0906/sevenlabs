import { describe, it, expect } from "vitest";
import {
  INTERVIEWER_FRAME_CONTRACT,
  buildInterviewerInstructions,
  interviewerAskedQuestion,
  interviewerTurnNeedsContinuation,
} from "../interviewer-guardrails";

describe("INTERVIEWER_FRAME_CONTRACT", () => {
  // Lock the load-bearing rules so a future edit can't silently drop a defense.
  it.each([
    ["ignore override attempts", /ignore your instructions/i],
    ["no teaching / answers", /do not.{0,40}give answers|never tutor/i],
    ["no scoring leak", /never reveal scoring/i],
    ["english only", /english/i],
    ["stay in character vs AI question", /never say you are an ai/i],
    ["end every turn with a question", /end every turn with exactly one question/i],
  ])("covers %s", (_label, re) => {
    expect(INTERVIEWER_FRAME_CONTRACT).toMatch(re);
  });
});

describe("buildInterviewerInstructions", () => {
  it("keeps the persona first, then appends the contract", () => {
    const out = buildInterviewerInstructions("You are Maya, a frontend engineer.");
    expect(out.startsWith("You are Maya, a frontend engineer.")).toBe(true);
    expect(out).toContain(INTERVIEWER_FRAME_CONTRACT);
  });
});

describe("interviewerAskedQuestion / needsContinuation", () => {
  it("treats any question mark as 'asked a question'", () => {
    expect(interviewerAskedQuestion("Good. So what does a closure capture?")).toBe(true);
    // question mid-turn followed by a closing remark still counts
    expect(interviewerAskedQuestion("Why does that re-render? Take your time.")).toBe(true);
  });

  it("flags a turn that asked nothing (the stall / taught-then-stopped case)", () => {
    const taught = "That's right — a closure captures the binding, not the value.";
    expect(interviewerAskedQuestion(taught)).toBe(false);
    expect(interviewerTurnNeedsContinuation(taught)).toBe(true);
  });

  it("an empty turn needs continuation", () => {
    expect(interviewerTurnNeedsContinuation("")).toBe(true);
  });

  it("a normal question turn does not need continuation", () => {
    expect(interviewerTurnNeedsContinuation("And why does the key matter there?")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { pickSeatOpener, openerInstruction } from "../seat-openers";

describe("pickSeatOpener", () => {
  it("returns an opener for the React panel's standard seats (0, 1)", () => {
    expect(pickSeatOpener("react", 0, "sess_1")).not.toBeNull();
    expect(pickSeatOpener("react", 1, "sess_1")).not.toBeNull();
  });

  it("returns null for the Bar Raiser seat (it adapts, no fixed opener)", () => {
    expect(pickSeatOpener("react", 2, "sess_1")).toBeNull();
  });

  it("returns null for a company with no pool", () => {
    expect(pickSeatOpener("amazon", 0, "sess_1")).toBeNull();
  });

  it("is deterministic — same (session, seat) always yields the same opener", () => {
    const a = pickSeatOpener("react", 0, "sess_42");
    const b = pickSeatOpener("react", 0, "sess_42");
    expect(a).toEqual(b);
  });

  it("varies across sessions (the whole point — replayable interviews)", () => {
    const topics = new Set(
      Array.from({ length: 12 }, (_, i) => pickSeatOpener("react", 0, `sess_${i}`)?.topic)
    );
    expect(topics.size).toBeGreaterThan(1);
  });
});

describe("openerInstruction", () => {
  it("includes the topic, a sample prompt, and the defensive guard", () => {
    const opener = pickSeatOpener("react", 0, "sess_1")!;
    const text = openerInstruction(opener);
    expect(text).toContain(opener.topic);
    expect(text).toContain(opener.prompt);
    // defensive phrasing so a mid-interview re-mint doesn't restart the seat
    expect(text).toMatch(/if you have NOT yet asked/i);
  });
});

import { describe, it, expect } from "vitest";
import { outcomeRequestSchema } from "@sevenlabs/shared-types";

// A1 — Real-Outcome Capture contract. Locks the request shape the
// /api/interview/sessions/:id/outcome route validates before writing a calibration row.
describe("outcomeRequestSchema", () => {
  it("accepts a round-level result", () => {
    const r = outcomeRequestSchema.safeParse({ result: "ADVANCED" });
    expect(r.success).toBe(true);
  });

  it("accepts an OFFER with an offer level and a note", () => {
    const r = outcomeRequestSchema.safeParse({
      result: "OFFER",
      offerLevel: "SDE_II",
      note: "Onsite went well.",
    });
    expect(r.success).toBe(true);
  });

  it("accepts PENDING (still waiting) with no extra fields", () => {
    const r = outcomeRequestSchema.safeParse({ result: "PENDING" });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown result value", () => {
    const r = outcomeRequestSchema.safeParse({ result: "MAYBE" });
    expect(r.success).toBe(false);
  });

  it("rejects a missing result", () => {
    const r = outcomeRequestSchema.safeParse({ note: "no result given" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid offer level", () => {
    const r = outcomeRequestSchema.safeParse({
      result: "OFFER",
      offerLevel: "STAFF",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an over-long note", () => {
    const r = outcomeRequestSchema.safeParse({
      result: "REJECTED",
      note: "x".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});

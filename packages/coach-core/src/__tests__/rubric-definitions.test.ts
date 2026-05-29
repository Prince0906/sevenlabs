import { describe, it, expect } from "vitest";
import { rubricScoresSchema } from "@sevenlabs/shared-types";
import {
  AMAZON_LEADERSHIP_PRINCIPLES,
  buildRubricUserMessage,
  getRubricForCompany,
} from "../rubric-definitions";

describe("AMAZON_LEADERSHIP_PRINCIPLES", () => {
  it("contains the 16 current Amazon leadership principles", () => {
    expect(AMAZON_LEADERSHIP_PRINCIPLES.length).toBe(16);
  });

  it("includes the most-tested LPs by name", () => {
    const names = AMAZON_LEADERSHIP_PRINCIPLES.map((p) => p.name);
    expect(names).toContain("Customer Obsession");
    expect(names).toContain("Ownership");
    expect(names).toContain("Bias for Action");
    expect(names).toContain("Deliver Results");
    expect(names).toContain("Have Backbone; Disagree and Commit");
  });

  it("every principle has both junior and senior signal copy", () => {
    for (const lp of AMAZON_LEADERSHIP_PRINCIPLES) {
      expect(lp.juniorSignal.length).toBeGreaterThan(10);
      expect(lp.seniorSignal.length).toBeGreaterThan(10);
    }
  });
});

describe("getRubricForCompany", () => {
  it("returns a populated rubric for 'amazon'", () => {
    const rubric = getRubricForCompany("amazon");
    expect(rubric).not.toBeNull();
    expect(rubric!.principles.length).toBe(16);
    expect(rubric!.systemPrompt.length).toBeGreaterThan(500);
  });

  it("is case-insensitive", () => {
    expect(getRubricForCompany("Amazon")).not.toBeNull();
    expect(getRubricForCompany("AMAZON")).not.toBeNull();
  });

  it("returns null for unsupported companies", () => {
    expect(getRubricForCompany("google")).toBeNull();
    expect(getRubricForCompany("meta")).toBeNull();
    expect(getRubricForCompany("")).toBeNull();
  });

  it("system prompt includes every LP name so the model can match against them", () => {
    const rubric = getRubricForCompany("amazon")!;
    for (const lp of AMAZON_LEADERSHIP_PRINCIPLES) {
      expect(rubric.systemPrompt).toContain(lp.name);
    }
  });

  it("system prompt instructs JSON-only output", () => {
    const prompt = getRubricForCompany("amazon")!.systemPrompt;
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("matchedLPs");
    expect(prompt).toContain("overallSignal");
    expect(prompt).toContain("weakestArea");
  });
});

describe("buildRubricUserMessage", () => {
  it("includes the transcript verbatim", () => {
    const msg = buildRubricUserMessage(
      "I led the migration from REST to gRPC and reduced p99 latency by 40%."
    );
    expect(msg).toContain("reduced p99 latency by 40%");
  });
});

describe("rubricScoresSchema (output validation)", () => {
  it("parses a well-formed scoring response", () => {
    const sample = {
      matchedLPs: [
        {
          name: "Ownership",
          signalLevel: "SDE_II",
          evidence: "I took the on-call rotation when the team was short-staffed.",
        },
        {
          name: "Deliver Results",
          signalLevel: "SENIOR",
          evidence: "Reduced p99 latency by 40% within one quarter.",
        },
      ],
      overallSignal: "SDE_II",
      weakestArea:
        "Name the specific tradeoff you rejected in choosing gRPC over REST.",
    };
    expect(() => rubricScoresSchema.parse(sample)).not.toThrow();
  });

  it("accepts an empty matchedLPs array for sparse transcripts", () => {
    const sample = {
      matchedLPs: [],
      overallSignal: "NEW_GRAD",
      weakestArea: "Provide a specific situation, action, and quantified result.",
    };
    expect(() => rubricScoresSchema.parse(sample)).not.toThrow();
  });

  it("rejects an invalid signal level", () => {
    const sample = {
      matchedLPs: [],
      overallSignal: "STAFF",
      weakestArea: "...",
    };
    expect(() => rubricScoresSchema.parse(sample)).toThrow();
  });

  it("rejects more than 3 matched LPs", () => {
    const sample = {
      matchedLPs: Array.from({ length: 4 }, () => ({
        name: "Ownership",
        signalLevel: "SDE_II" as const,
        evidence: "...",
      })),
      overallSignal: "SDE_II",
      weakestArea: "...",
    };
    expect(() => rubricScoresSchema.parse(sample)).toThrow();
  });

  it("rejects missing weakestArea", () => {
    const sample = {
      matchedLPs: [],
      overallSignal: "NEW_GRAD",
    };
    expect(() => rubricScoresSchema.parse(sample)).toThrow();
  });
});

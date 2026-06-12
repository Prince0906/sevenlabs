import { describe, it, expect } from "vitest";
import {
  validateResumeFacts,
  buildResumeDigest,
  type ResumeFacts,
} from "../resume";

const RESUME = `Jane Doe — Frontend Engineer
Led the migration of the checkout flow to the Next.js App Router, cutting TTI by 40%.
Built a reusable React component library adopted by three product teams.
Skills: JavaScript, TypeScript, React, Next.js, GraphQL.`;

describe("validateResumeFacts — anti-hallucination", () => {
  it("keeps facts whose quote is verbatim resume text", () => {
    const facts: ResumeFacts = {
      headline: "Frontend engineer, React/Next.js",
      facts: [
        {
          category: "project",
          text: "Migrated checkout to the Next.js App Router",
          quote: "migration of the checkout flow to the Next.js App Router",
        },
      ],
    };
    const out = validateResumeFacts(facts, RESUME);
    expect(out.facts).toHaveLength(1);
    expect(out.facts[0]!.text).toBe("Migrated checkout to the Next.js App Router");
  });

  it("DROPS a fact whose quote is not in the resume (hallucinated)", () => {
    const facts: ResumeFacts = {
      facts: [
        {
          category: "project",
          text: "Built a Kubernetes operator",
          quote: "designed and shipped a Kubernetes operator in Go",
        },
      ],
    };
    const out = validateResumeFacts(facts, RESUME);
    expect(out.facts).toHaveLength(0);
  });

  it("matches despite whitespace/case differences (PDF reflow)", () => {
    const facts: ResumeFacts = {
      facts: [
        {
          category: "project",
          text: "Built a component library",
          // different spacing + casing than the source
          quote: "Built  a reusable REACT component   library",
        },
      ],
    };
    const out = validateResumeFacts(facts, RESUME);
    expect(out.facts).toHaveLength(1);
  });

  it("drops trivially-short quotes that would match anything", () => {
    const facts: ResumeFacts = {
      facts: [{ category: "skill", text: "Knows React", quote: "React" }],
    };
    expect(validateResumeFacts(facts, RESUME).facts).toHaveLength(0);
  });

  it("de-dupes facts with the same paraphrase", () => {
    const facts: ResumeFacts = {
      facts: [
        { category: "skill", text: "Uses TypeScript", quote: "JavaScript, TypeScript, React" },
        { category: "skill", text: "uses typescript", quote: "TypeScript, React, Next.js" },
      ],
    };
    expect(validateResumeFacts(facts, RESUME).facts).toHaveLength(1);
  });

  it("caps the number of kept facts", () => {
    const facts: ResumeFacts = {
      facts: Array.from({ length: 30 }, (_, i) => ({
        category: "skill" as const,
        text: `Skill number ${i}`,
        quote: "JavaScript, TypeScript, React, Next.js, GraphQL",
      })),
    };
    expect(validateResumeFacts(facts, RESUME).facts.length).toBeLessThanOrEqual(10);
  });

  it("normalizes an unknown category to 'claim' and is null-safe", () => {
    const facts = {
      facts: [
        { category: "wild", text: "Did a thing", quote: "Led the migration of the checkout flow" },
      ],
    } as unknown as ResumeFacts;
    const out = validateResumeFacts(facts, RESUME);
    expect(out.facts[0]!.category).toBe("claim");
    expect(validateResumeFacts(null, RESUME).facts).toHaveLength(0);
    expect(validateResumeFacts(undefined, RESUME).facts).toHaveLength(0);
  });
});

describe("buildResumeDigest", () => {
  it("returns empty string when there is nothing grounded", () => {
    expect(buildResumeDigest({ facts: [] })).toBe("");
    expect(buildResumeDigest(null)).toBe("");
  });

  it("renders headline, bullets, and the do-not-read-aloud guard", () => {
    const facts: ResumeFacts = {
      headline: "Frontend engineer",
      facts: [
        { category: "project", text: "Migrated checkout to Next.js App Router", quote: "x" },
        { category: "skill", text: "React, TypeScript, GraphQL", quote: "y" },
      ],
    };
    const digest = buildResumeDigest(facts);
    expect(digest).toContain("CANDIDATE BACKGROUND");
    expect(digest).toContain("Frontend engineer");
    expect(digest).toContain("- Migrated checkout to Next.js App Router");
    expect(digest).toContain("- React, TypeScript, GraphQL");
    expect(digest).toMatch(/do not read this list aloud/i);
  });

  it("only the validated facts reach the digest (end-to-end)", () => {
    const raw: ResumeFacts = {
      facts: [
        { category: "project", text: "Real: checkout migration", quote: "Led the migration of the checkout flow" },
        { category: "project", text: "Fake: rewrote the kernel", quote: "rewrote the Linux kernel from scratch" },
      ],
    };
    const digest = buildResumeDigest(validateResumeFacts(raw, RESUME));
    expect(digest).toContain("Real: checkout migration");
    expect(digest).not.toContain("Fake: rewrote the kernel");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  resumeProfile: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
// coach-core stays REAL so the real buildResumeDigest runs.

import { getResumeDigest } from "@/lib/mock/resume-digest";

describe("getResumeDigest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns '' when the user has no resume (callers concatenate unconditionally)", async () => {
    mockPrisma.resumeProfile.findUnique.mockResolvedValue(null);
    expect(await getResumeDigest("u1")).toBe("");
  });

  it("renders the stored validated facts into the seat digest", async () => {
    mockPrisma.resumeProfile.findUnique.mockResolvedValue({
      factsJson: {
        headline: "Frontend engineer, React/Next.js",
        facts: [{ category: "project", text: "Migrated checkout to Next.js App Router", quote: "x" }],
      },
    });
    const digest = await getResumeDigest("u1");
    expect(digest).toContain("CANDIDATE BACKGROUND");
    expect(digest).toContain("Migrated checkout to Next.js App Router");
  });
});

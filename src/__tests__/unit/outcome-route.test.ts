import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  interviewSession: { findFirst: vi.fn() },
  outcome: { upsert: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { auth } from "@/lib/auth";
import { POST, GET } from "@/app/api/interview/sessions/[id]/outcome/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new Request("http://localhost/api/interview/sessions/s1/outcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
});

describe("POST /api/interview/sessions/:id/outcome (A1 capture)", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const res = await POST(post({ result: "ADVANCED" }), params("s1"));
    expect(res.status).toBe(401);
  });

  it("400 on an invalid result", async () => {
    const res = await POST(post({ result: "MAYBE" }), params("s1"));
    expect(res.status).toBe(400);
  });

  it("404 when the session is not owned by the user", async () => {
    mockPrisma.interviewSession.findFirst.mockResolvedValueOnce(null);
    const res = await POST(post({ result: "REJECTED" }), params("s1"));
    expect(res.status).toBe(404);
    // ownership filter must be applied
    expect(mockPrisma.interviewSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1", userId: "u1" } })
    );
  });

  it("snapshots the prediction (verdict signal + weakest dimension) on CREATE only", async () => {
    mockPrisma.interviewSession.findFirst.mockResolvedValueOnce({
      id: "s1",
      verdict: { overallSignal: "SDE_II", rubricVersion: "2026.06.0" },
      dimensionScores: [{ key: "useMemo" }], // weakest (lowest score), take:1
    });
    const capturedAt = new Date("2026-06-07T00:00:00.000Z");
    mockPrisma.outcome.upsert.mockResolvedValueOnce({
      sessionId: "s1",
      result: "ADVANCED",
      predictedSignal: "SDE_II",
      predictedWeakest: "useMemo",
      capturedAt,
    });

    const res = await POST(post({ result: "ADVANCED" }), params("s1"));
    expect(res.status).toBe(200);

    const arg = mockPrisma.outcome.upsert.mock.calls[0][0];
    // CREATE carries the prediction snapshot — incl. the rubric that produced it (D4)...
    expect(arg.create.predictedSignal).toBe("SDE_II");
    expect(arg.create.predictedWeakest).toBe("useMemo");
    expect(arg.create.rubricVersion).toBe("2026.06.0");
    expect(arg.where).toEqual({ sessionId: "s1" });
    // ...but UPDATE must NOT (re-capturing can never re-snapshot the prediction,
    // else every later correction silently corrupts the calibration label).
    expect(arg.update).not.toHaveProperty("predictedSignal");
    expect(arg.update).not.toHaveProperty("predictedWeakest");
    expect(arg.update).not.toHaveProperty("rubricVersion");
    expect(arg.update.result).toBe("ADVANCED");

    const body = await res.json();
    expect(body).toMatchObject({
      sessionId: "s1",
      result: "ADVANCED",
      predictedSignal: "SDE_II",
      predictedWeakest: "useMemo",
      capturedAt: capturedAt.toISOString(),
    });
  });

  it("tolerates a session with no verdict/dimensions (predicted* null)", async () => {
    mockPrisma.interviewSession.findFirst.mockResolvedValueOnce({
      id: "s1",
      verdict: null,
      dimensionScores: [],
    });
    mockPrisma.outcome.upsert.mockResolvedValueOnce({
      sessionId: "s1",
      result: "PENDING",
      predictedSignal: null,
      predictedWeakest: null,
      capturedAt: new Date(),
    });
    const res = await POST(post({ result: "PENDING" }), params("s1"));
    expect(res.status).toBe(200);
    const arg = mockPrisma.outcome.upsert.mock.calls[0][0];
    expect(arg.create.predictedSignal).toBeNull();
    expect(arg.create.predictedWeakest).toBeNull();
    expect(arg.create.rubricVersion).toBeNull();
  });
});

describe("GET /api/interview/sessions/:id/outcome", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const res = await GET(new Request("http://localhost/x"), params("s1"));
    expect(res.status).toBe(401);
  });

  it("returns { outcome: null, company } when none captured", async () => {
    mockPrisma.interviewSession.findFirst.mockResolvedValueOnce({ scenario: { company: "amazon" } });
    mockPrisma.outcome.findFirst.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/x"), params("s1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: null, company: "amazon" });
    // user-scoped read
    expect(mockPrisma.outcome.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "s1", userId: "u1" } })
    );
  });

  it("404 when the session isn't owned by the user", async () => {
    mockPrisma.interviewSession.findFirst.mockResolvedValueOnce(null);
    mockPrisma.outcome.findFirst.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/x"), params("s1"));
    expect(res.status).toBe(404);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { auth } from "@/lib/auth";
import { GET } from "@/app/api/interview/sessions/[id]/report/route";

const ctx = { params: Promise.resolve({ id: "m1" }) };
function req(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/interview/sessions/m1/report", { headers });
}
const call = (headers?: Record<string, string>) => GET(req(headers), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
});

describe("GET /api/interview/sessions/:id/report — guards", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await call()).status).toBe(401);
  });

  it("404 when not found (userId-scoped)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mockPrisma.mockSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", userId: "u1" } })
    );
  });
});

describe("GET /api/interview/sessions/:id/report — COMPLETED (ETag)", () => {
  beforeEach(() => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({
      id: "m1",
      status: "COMPLETED",
      endedAt: new Date(),
      reportJson: { verdict: { inclination: "HIRE" } },
    });
  });

  it("200 with the report + an ETag", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"m1-COMPLETED"');
    expect(await res.json()).toEqual({
      status: "COMPLETED",
      report: { verdict: { inclination: "HIRE" } },
    });
  });

  it("304 when If-None-Match echoes the ETag", async () => {
    const res = await call({ "if-none-match": '"m1-COMPLETED"' });
    expect(res.status).toBe(304);
  });
});

describe("GET /api/interview/sessions/:id/report — DEBRIEF bound (A5)", () => {
  it("202 while judging within the deadline", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({
      id: "m1",
      status: "DEBRIEF",
      endedAt: new Date(Date.now() - 10_000), // 10s ago
      reportJson: null,
    });
    const res = await call();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "DEBRIEF", pollAfterMs: 2000 });
  });

  it("FAILED past the wall-clock deadline even if the job never failed (stuck worker)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({
      id: "m1",
      status: "DEBRIEF",
      endedAt: new Date(Date.now() - 200_000), // 200s ago > 180s deadline
      reportJson: null,
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "FAILED", reason: "judgment_timeout" });
  });

  it("surfaces a queue-failed session (status already FAILED) as FAILED", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({
      id: "m1",
      status: "FAILED",
      endedAt: new Date(),
      reportJson: null,
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "FAILED" });
  });
});

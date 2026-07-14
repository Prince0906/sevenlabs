import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn(), updateMany: vi.fn() },
  judgmentJob: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));
const mockQueue = vi.hoisted(() => ({ drainJudgmentQueue: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/interview/judgment-queue", () => mockQueue);
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  // Run the after() callback inline so the queue-kick is observable in the test.
  return { ...actual, after: vi.fn((fn: () => void) => fn()) };
});

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/mock/sessions/[id]/complete/route";

const ctx = { params: Promise.resolve({ id: "m1" }) };
function req(body?: unknown): Request {
  return new Request("http://localhost/api/mock/sessions/m1/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const call = (body?: unknown) => POST(req(body), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  mockPrisma.mockSession.findFirst.mockResolvedValue({
    status: "LIVE",
    startedAt: new Date(Date.now() - 60_000),
  });
  // $transaction([updateMany, upsert]) → [updated]; updated.count drives the kick.
  mockPrisma.$transaction.mockResolvedValue([{ count: 1 }, {}]);
});

describe("POST /api/mock/sessions/:id/complete — guards", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await call()).status).toBe(401);
  });

  it("404 when the session isn't found (userId-scoped)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mockPrisma.mockSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", userId: "u1" } })
    );
  });

  it("202 (no re-transition) when already DEBRIEF", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "DEBRIEF", startedAt: new Date() });
    const res = await call();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "DEBRIEF", pollAfterMs: 2000 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("409 when the session can't be completed (PENDING)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "PENDING", startedAt: null });
    expect((await call()).status).toBe(409);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/mock/sessions/:id/complete — transition + D6 persistence", () => {
  it("CAS LIVE→DEBRIEF, enqueues the job, and kicks the queue", async () => {
    const res = await call();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "DEBRIEF", pollAfterMs: 2000 });

    expect(mockPrisma.mockSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1", status: { in: ["LIVE", "INTERRUPTED"] } },
        data: expect.objectContaining({ status: "DEBRIEF" }),
      })
    );
    expect(mockPrisma.judgmentJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "m1" } })
    );
    expect(mockQueue.drainJudgmentQueue).toHaveBeenCalled();
  });

  it("persists degradedDelivery:true when the client reports a dropped turn (D6)", async () => {
    await call({ degradedDelivery: true });
    const arg = mockPrisma.mockSession.updateMany.mock.calls[0]![0] as {
      data: { degradedDelivery: boolean };
    };
    expect(arg.data.degradedDelivery).toBe(true);
  });

  it("defaults degradedDelivery to false when the body omits it", async () => {
    await call({ reason: "ceiling" });
    const arg = mockPrisma.mockSession.updateMany.mock.calls[0]![0] as {
      data: { degradedDelivery: boolean };
    };
    expect(arg.data.degradedDelivery).toBe(false);
  });

  it("does NOT kick the queue when the CAS lost the race (count 0)", async () => {
    mockPrisma.$transaction.mockResolvedValue([{ count: 0 }, {}]);
    const res = await call();
    expect(res.status).toBe(202); // still tells the client to poll
    expect(mockQueue.drainJudgmentQueue).not.toHaveBeenCalled();
  });
});

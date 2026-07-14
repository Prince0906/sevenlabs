import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn(), update: vi.fn() },
  mockTurn: { findUnique: vi.fn(), create: vi.fn() },
}));
const mockSpend = vi.hoisted(() => ({
  spendCentsForElapsed: vi.fn(() => 100),
  isSessionOver: vi.fn(() => false),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/mock/spend", () => mockSpend);
// @sevenlabs/panel-core (analyzeSpeech) + shared-types schemas stay real.

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/mock/sessions/[id]/turns/route";

function liveSession(over: Record<string, unknown> = {}) {
  return { status: "LIVE", startedAt: new Date(Date.now() - 10_000), keySource: "ALOUD", ...over };
}
function req(body: unknown): Request {
  return new Request("http://localhost/api/mock/sessions/m1/turns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "m1" }) };
const call = (body: unknown) => POST(req(body), ctx);
const COACH_TURN = { seq: 0, role: "COACH", transcript: "Tell me about a time." };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession());
  mockPrisma.mockSession.update.mockResolvedValue({});
  mockPrisma.mockTurn.findUnique.mockResolvedValue(null);
  mockPrisma.mockTurn.create.mockResolvedValue({ id: "t1" });
  mockSpend.spendCentsForElapsed.mockReturnValue(100);
  mockSpend.isSessionOver.mockReturnValue(false);
});

describe("POST /api/mock/sessions/:id/turns — auth & guards", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await call(COACH_TURN)).status).toBe(401);
  });
  it("400 on an invalid body (missing seq)", async () => {
    expect((await call({ role: "COACH" })).status).toBe(400);
  });
  it("404 when the session isn't found (userId-scoped)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(null);
    expect((await call(COACH_TURN)).status).toBe(404);
    expect(mockPrisma.mockSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", userId: "u1" } })
    );
  });
  it("409 when the session isn't LIVE", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession({ status: "DEBRIEF" }));
    expect((await call(COACH_TURN)).status).toBe(409);
  });
});

describe("POST .../turns — single-writer idempotency on (sessionId, seq)", () => {
  it("commits a new COACH turn", async () => {
    const res = await call(COACH_TURN);
    expect(res.status).toBe(200);
    expect(mockPrisma.mockTurn.create).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ seq: 0, duplicate: false, turnId: "t1" });
  });
  it("returns duplicate:true on an identical replay (same seq + transcript)", async () => {
    mockPrisma.mockTurn.findUnique.mockResolvedValue({
      id: "t1",
      transcript: "Tell me about a time.",
      metricsJson: null,
    });
    const res = await call(COACH_TURN);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(mockPrisma.mockTurn.create).not.toHaveBeenCalled();
  });
  it("409 SEQ_CONFLICT when the same seq carries a different transcript", async () => {
    mockPrisma.mockTurn.findUnique.mockResolvedValue({ id: "t1", transcript: "a different answer" });
    const res = await call(COACH_TURN);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "SEQ_CONFLICT" });
  });
});

describe("POST .../turns — spend ceiling delegates to isSessionOver (D7)", () => {
  it("passes the session's keySource (USER) — BYOK is no longer force-stopped by the house $ ceiling", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession({ keySource: "USER" }));
    await call(COACH_TURN);
    expect(mockSpend.isSessionOver).toHaveBeenCalledWith("USER", expect.any(Number), expect.any(Number));
  });
  it("sessionExpired reflects isSessionOver = true", async () => {
    mockSpend.isSessionOver.mockReturnValue(true);
    expect(await (await call(COACH_TURN)).json()).toMatchObject({ sessionExpired: true });
  });
  it("sessionExpired is false under the ceiling", async () => {
    mockSpend.isSessionOver.mockReturnValue(false);
    expect(await (await call(COACH_TURN)).json()).toMatchObject({ sessionExpired: false });
  });
});

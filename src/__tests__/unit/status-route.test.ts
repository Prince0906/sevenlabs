import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn(), updateMany: vi.fn() },
  mockTurn: { aggregate: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/env", () => ({ env: { MAX_SESSION_SEC: 3600 } }));

import { auth } from "@/lib/auth";
import { GET, PATCH } from "@/app/api/interview/sessions/[id]/route";

const ctx = { params: Promise.resolve({ id: "m1" }) };

function panelSeats() {
  return [
    { id: "s0", personaName: "Maya", ownedLPs: ["A"], isBarRaiser: false, voice: "alloy" },
    { id: "s1", personaName: "Dev", ownedLPs: [], isBarRaiser: false, voice: "verse" },
    { id: "s2", personaName: "Priya", ownedLPs: ["B"], isBarRaiser: true, voice: "sage" },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
});

// ── GET (D5 rehydrate snapshot) ──────────────────────────────────────────────
describe("GET /api/interview/sessions/:id — rehydrate snapshot (D5)", () => {
  function getReq() {
    return new Request("http://localhost/api/interview/sessions/m1");
  }
  const get = () => GET(getReq(), ctx);

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await get()).status).toBe(401);
  });

  it("404 when not found (userId-scoped)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
    expect(mockPrisma.mockSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", userId: "u1" } })
    );
  });

  it("returns the seat cursor + public roster + maxSeq for resume", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({
      status: "LIVE",
      scenarioId: "sc1",
      keySource: "USER",
      activeSeatIndex: 2,
      scenario: { panelSeats: panelSeats() },
    });
    mockPrisma.mockTurn.aggregate.mockResolvedValue({ _max: { seq: 7 } });

    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "LIVE",
      scenarioId: "sc1",
      maxSeq: 7,
      activeSeatIndex: 2,
      keySource: "USER",
      maxDurationSec: 3600,
      seats: panelSeats(),
    });
  });

  it("maxSeq is -1 when no turns exist yet", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({
      status: "LIVE",
      scenarioId: "sc1",
      keySource: "ALOUD",
      activeSeatIndex: 0,
      scenario: { panelSeats: panelSeats() },
    });
    mockPrisma.mockTurn.aggregate.mockResolvedValue({ _max: { seq: null } });
    const body = await (await get()).json();
    expect(body.maxSeq).toBe(-1);
  });
});

// ── PATCH (live / interrupt) ─────────────────────────────────────────────────
describe("PATCH /api/interview/sessions/:id — transitions", () => {
  function patchReq(body: unknown) {
    return new Request("http://localhost/api/interview/sessions/m1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  const patch = (body: unknown) => PATCH(patchReq(body), ctx);

  it("400 on an invalid event", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "PENDING" });
    expect((await patch({ event: "nope" })).status).toBe(400);
  });

  it("404 when not found", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(null);
    expect((await patch({ event: "live" })).status).toBe(404);
  });

  it("live flips PENDING→LIVE when the CAS wins", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "PENDING" });
    mockPrisma.mockSession.updateMany.mockResolvedValue({ count: 1 });
    expect(await (await patch({ event: "live" })).json()).toEqual({ status: "LIVE" });
    expect(mockPrisma.mockSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1", userId: "u1", status: "PENDING" },
      })
    );
  });

  it("live is a no-op (returns the current status) when the CAS loses", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "LIVE" });
    mockPrisma.mockSession.updateMany.mockResolvedValue({ count: 0 });
    expect(await (await patch({ event: "live" })).json()).toEqual({ status: "LIVE" });
  });

  it("interrupt flips LIVE→INTERRUPTED when the CAS wins", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue({ status: "LIVE" });
    mockPrisma.mockSession.updateMany.mockResolvedValue({ count: 1 });
    expect(await (await patch({ event: "interrupt" })).json()).toEqual({
      status: "INTERRUPTED",
    });
  });
});

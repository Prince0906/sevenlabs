import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for the mint route's I/O collaborators. coach-core stays real (pure
// instruction-building); env is mocked to pin MAX_SESSION_SEC for the ceiling tests.
const mockPrisma = vi.hoisted(() => ({
  mockSession: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  mockTurn: { findMany: vi.fn() },
}));
const mockOpenai = vi.hoisted(() => ({
  mintRealtimeEphemeral: vi.fn(),
  ProviderError: class ProviderError extends Error {
    status: number;
    constructor(code = "x", status = 500) {
      super(code);
      this.status = status;
    }
  },
}));
const mockSpend = vi.hoisted(() => ({
  spendCentsForElapsed: vi.fn(() => 100),
  isSessionOver: vi.fn(() => false),
}));
const mockByok = vi.hoisted(() => ({ resolveSessionKey: vi.fn() }));
const mockResume = vi.hoisted(() => ({ getResumeDigest: vi.fn(async () => "") }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-secret", MAX_SESSION_SEC: 3600 } }));
vi.mock("@/lib/coach/openai", () => mockOpenai);
vi.mock("@/lib/mock/spend", () => mockSpend);
vi.mock("@/lib/byok", () => mockByok);
vi.mock("@/lib/mock/resume-digest", () => mockResume);
// @sevenlabs/coach-core stays real — pure instruction/opener/digest builders.

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/mock/sessions/[id]/mint/route";

const EPHEMERAL = { value: "eph_secret", expiresAt: 1_000, model: "gpt-realtime", realtimeUrl: "https://x/calls" };

function liveSession(over: Record<string, unknown> = {}) {
  return {
    status: "LIVE",
    startedAt: new Date(Date.now() - 10_000), // 10s ago — well under MAX_SESSION_SEC
    keySource: "ALOUD",
    scenario: {
      company: "Amazon",
      panelSeats: [{ seatOrder: 0, systemPrompt: "You are Maya.", voice: "alloy" }],
    },
    ...over,
  };
}

function req(opts: { body?: unknown; headers?: Record<string, string> } = {}): Request {
  return new Request("http://localhost/api/mock/sessions/m1/mint", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(opts.body ?? {}),
  });
}
const ctx = { params: Promise.resolve({ id: "m1" }) };
const call = (opts?: { body?: unknown; headers?: Record<string, string> }) => POST(req(opts), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession());
  mockPrisma.mockSession.update.mockResolvedValue({});
  mockPrisma.mockSession.updateMany.mockResolvedValue({});
  mockPrisma.mockTurn.findMany.mockResolvedValue([]);
  mockOpenai.mintRealtimeEphemeral.mockResolvedValue(EPHEMERAL);
  mockSpend.spendCentsForElapsed.mockReturnValue(100);
  mockSpend.isSessionOver.mockReturnValue(false);
  mockByok.resolveSessionKey.mockResolvedValue({ keySource: "USER", apiKey: "sk-user-key" });
  mockResume.getResumeDigest.mockResolvedValue("");
});

describe("POST /api/mock/sessions/:id/mint — auth & guards", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await call()).status).toBe(401);
  });

  it("403 on a cross-origin request", async () => {
    expect((await call({ headers: { origin: "http://evil.com", host: "localhost" } })).status).toBe(403);
  });

  it("404 when the session isn't found (and is userId-scoped)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mockPrisma.mockSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", userId: "u1" } })
    );
  });
});

describe("POST .../mint — renewability", () => {
  it("409 when a ttl re-mint targets a non-LIVE session", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession({ status: "PENDING" }));
    const res = await call({ body: { reason: "ttl_expiry" } });
    expect(res.status).toBe(409);
  });

  it("409 when resume_interrupted targets a LIVE (not INTERRUPTED) session", async () => {
    const res = await call({ body: { reason: "resume_interrupted" } }); // default is LIVE
    expect(res.status).toBe(409);
  });

  it("resume_interrupted flips INTERRUPTED -> LIVE and mints", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(
      liveSession({ status: "INTERRUPTED", keySource: "ALOUD" })
    );
    const res = await call({ body: { reason: "resume_interrupted" } });
    expect(res.status).toBe(200);
    expect(mockPrisma.mockSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", status: "INTERRUPTED" }, data: { status: "LIVE" } })
    );
  });
});

describe("POST .../mint — BYOK custody (key removal)", () => {
  it("410 SESSION_EXPIRED when a USER-keyed session lost its key mid-session", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession({ keySource: "USER" }));
    mockByok.resolveSessionKey.mockResolvedValue({ keySource: "ALOUD" }); // key gone -> falls back to house
    const res = await call();
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ error: "SESSION_EXPIRED" });
    expect(mockOpenai.mintRealtimeEphemeral).not.toHaveBeenCalled();
  });

  it("mints on the USER key (passes the resolved apiKey through)", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession({ keySource: "USER" }));
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockOpenai.mintRealtimeEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-user-key" })
    );
  });

  it("never resolves a key for a house (ALOUD) session; mints on the house key", async () => {
    const res = await call(); // default keySource ALOUD
    expect(res.status).toBe(200);
    expect(mockByok.resolveSessionKey).not.toHaveBeenCalled();
    expect(mockOpenai.mintRealtimeEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: undefined })
    );
  });
});

describe("POST .../mint — spend ceiling (delegates to the one isSessionOver predicate)", () => {
  // The BYOK-vs-house branch itself is unit-tested in spend.test.ts; here we only
  // verify the route delegates to it and force-stops on its result (D7).
  it("410 SESSION_EXPIRED when isSessionOver returns true", async () => {
    mockSpend.isSessionOver.mockReturnValue(true);
    const res = await call();
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ error: "SESSION_EXPIRED" });
    expect(mockOpenai.mintRealtimeEphemeral).not.toHaveBeenCalled();
  });

  it("mints when isSessionOver returns false", async () => {
    mockSpend.isSessionOver.mockReturnValue(false);
    expect((await call()).status).toBe(200);
  });

  it("passes the session's keySource (USER) to isSessionOver", async () => {
    mockPrisma.mockSession.findFirst.mockResolvedValue(liveSession({ keySource: "USER" }));
    await call();
    expect(mockSpend.isSessionOver).toHaveBeenCalledWith("USER", expect.any(Number), expect.any(Number));
  });

  it("passes ALOUD for a house session", async () => {
    await call();
    expect(mockSpend.isSessionOver).toHaveBeenCalledWith("ALOUD", expect.any(Number), expect.any(Number));
  });
});

describe("POST .../mint — seat selection & provider failure", () => {
  it("404 when the requested seatIndex doesn't exist", async () => {
    const res = await call({ body: { seatIndex: 5 } });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "Scenario unavailable" });
  });

  it("502 when the provider mint fails", async () => {
    mockOpenai.mintRealtimeEphemeral.mockRejectedValue(new mockOpenai.ProviderError("realtime_mint_failed", 503));
    const res = await call();
    expect(res.status).toBe(502);
  });

  it("seat_handoff injects a bounded context digest from recent turns", async () => {
    mockPrisma.mockTurn.findMany.mockResolvedValue([
      { role: "USER", transcript: "I led a migration." },
      { role: "COACH", transcript: "Tell me about the rollback plan." },
    ]);
    const res = await call({ body: { reason: "seat_handoff" } });
    expect(res.status).toBe(200);
    expect(mockPrisma.mockTurn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "m1" } })
    );
  });

  it("happy path returns the ephemeral", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ephemeral: EPHEMERAL });
  });
});

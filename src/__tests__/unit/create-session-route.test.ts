import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  interviewSession: {
    findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
  },
  scenario: { findUnique: vi.fn() },
}));
const spend = vi.hoisted(() => ({
  checkRateLimit: vi.fn(), reserveGlobalSpend: vi.fn(),
  createReservation: vi.fn(), estimateSessionUsd: vi.fn(() => 4),
  settleReservation: vi.fn(),
}));
const keys = vi.hoisted(() => ({ resolveSessionKey: vi.fn(), markKeyFromMintError: vi.fn() }));
const provider = vi.hoisted(() => ({
  mintRealtimeEphemeral: vi.fn(),
  ProviderError: class extends Error {
    constructor(public status: number) { super("provider failure"); }
  },
}));
vi.mock("@sevenlabs/backend/infrastructure/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@sevenlabs/backend/usage/spend", () => spend);
vi.mock("@sevenlabs/backend/identity/keys", () => keys);
vi.mock("@sevenlabs/backend/infrastructure/providers/openai", () => provider);
vi.mock("@sevenlabs/backend/profiles/resume-digest", () => ({ getResumeDigest: vi.fn(async () => "resume evidence") }));
vi.mock("@sevenlabs/backend/infrastructure/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@sevenlabs/backend/infrastructure/env", () => ({ env: {
  AUTH_SECRET: "test", OPENAI_REALTIME_MODEL: "gpt-realtime",
  MAX_SESSION_SEC: 3600, SESSION_CEILING_USD: 4,
} }));

import { auth } from "@/lib/auth";
import { POST } from "@/app/api/interview/sessions/route";

const ephemeral = { value: "ephemeral", expiresAt: 1000, model: "gpt-realtime" };
function request(body: unknown = { scenarioId: "scenario-1", clientRequestId: "request-1" }, origin = "http://localhost") {
  return new Request("http://localhost/api/interview/sessions", {
    method: "POST", headers: { "content-type": "application/json", host: "localhost", origin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
  db.interviewSession.findUnique.mockResolvedValue(null);
  db.interviewSession.findMany.mockResolvedValue([]);
  db.interviewSession.count.mockResolvedValue(0);
  db.interviewSession.create.mockResolvedValue({ id: "session-1" });
  db.scenario.findUnique.mockResolvedValue({
    isActive: true, targetLevel: "SDE_II", panelSeats: [{
      id: "seat-1", personaName: "Maya", ownedLPs: [], isBarRaiser: false,
      voice: "alloy", systemPrompt: "Interview instructions",
    }],
  });
  spend.checkRateLimit.mockResolvedValue(true);
  spend.reserveGlobalSpend.mockResolvedValue(true);
  spend.estimateSessionUsd.mockReturnValue(4);
  keys.resolveSessionKey.mockResolvedValue({ keySource: "ALOUD", apiKeyId: null });
  provider.mintRealtimeEphemeral.mockResolvedValue(ephemeral);
});

describe("session creation regression contract", () => {
  it("rejects unauthenticated requests before DB or provider access", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await POST(request())).status).toBe(401);
    expect(db.interviewSession.create).not.toHaveBeenCalled();
    expect(provider.mintRealtimeEphemeral).not.toHaveBeenCalled();
  });
  it("rejects cross-origin minting", async () => {
    expect((await POST(request(undefined, "http://evil.example"))).status).toBe(403);
    expect(provider.mintRealtimeEphemeral).not.toHaveBeenCalled();
  });
  it("rejects malformed input", async () => {
    expect((await POST(request({}))).status).toBe(400);
  });
  it("returns the same user's duplicate session without another paid operation", async () => {
    db.interviewSession.findUnique.mockResolvedValue({ id: "existing" });
    const result = await POST(request());
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: "Duplicate request", sessionId: "existing" });
    expect(db.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { userId_clientRequestId: { userId: "user-1", clientRequestId: "request-1" } },
    });
    expect(spend.reserveGlobalSpend).not.toHaveBeenCalled();
    expect(provider.mintRealtimeEphemeral).not.toHaveBeenCalled();
  });
  it("rejects rate-limited creation before reservation", async () => {
    spend.checkRateLimit.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(429);
    expect(spend.reserveGlobalSpend).not.toHaveBeenCalled();
  });
  it("scopes the active-session check to the authenticated user", async () => {
    db.interviewSession.count.mockResolvedValue(1);
    expect((await POST(request())).status).toBe(409);
    expect(db.interviewSession.count).toHaveBeenCalledWith({ where: { userId: "user-1", status: "LIVE" } });
    expect(provider.mintRealtimeEphemeral).not.toHaveBeenCalled();
  });
  it("does not reserve for an unavailable scenario", async () => {
    db.scenario.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(spend.reserveGlobalSpend).not.toHaveBeenCalled();
  });
  it("blocks house admission when the daily cap is reached", async () => {
    spend.reserveGlobalSpend.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(503);
    expect(db.interviewSession.create).not.toHaveBeenCalled();
  });
  it("creates a house reservation and returns the existing client contract", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ sessionId: "session-1", keySource: "ALOUD", ephemeral });
    expect(db.interviewSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "user-1", scenarioId: "scenario-1", clientRequestId: "request-1",
      status: "PENDING", keySource: "ALOUD",
    }) });
    expect(spend.createReservation).toHaveBeenCalledWith("session-1", 4);
    expect(provider.mintRealtimeEphemeral).toHaveBeenCalledWith(expect.objectContaining({
      instructions: "Interview instructions\n\nresume evidence", voice: "alloy",
    }));
  });
  it("uses BYOK for live mint without exposing the raw key in the response", async () => {
    keys.resolveSessionKey.mockResolvedValue({ keySource: "USER", apiKeyId: "key-1", apiKey: "sk-test-user" });
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.text()).not.toContain("sk-test-user");
    expect(spend.reserveGlobalSpend).not.toHaveBeenCalled();
    expect(spend.createReservation).not.toHaveBeenCalled();
    expect(provider.mintRealtimeEphemeral).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test-user" }));
  });
  it("marks failed mint and releases its reservation", async () => {
    provider.mintRealtimeEphemeral.mockRejectedValue(new provider.ProviderError(503));
    expect((await POST(request())).status).toBe(502);
    expect(db.interviewSession.update).toHaveBeenCalledWith({ where: { id: "session-1" }, data: { status: "FAILED" } });
    expect(spend.settleReservation).toHaveBeenCalledWith("session-1", 0);
  });
  it("returns key rejection distinctly for a failed BYOK mint", async () => {
    keys.resolveSessionKey.mockResolvedValue({ keySource: "USER", apiKeyId: "key-1", apiKey: "sk-test-user" });
    provider.mintRealtimeEphemeral.mockRejectedValue(new provider.ProviderError(401));
    const result = await POST(request());
    expect(result.status).toBe(402);
    expect(await result.json()).toEqual({ error: "KEY_REJECTED" });
    expect(keys.markKeyFromMintError).toHaveBeenCalledWith("user-1", 401);
  });
});

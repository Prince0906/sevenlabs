import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  providerKey: { upsert: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
}));
const mockCrypto = vi.hoisted(() => ({
  isByokConfigured: vi.fn(() => true),
  encryptSecret: vi.fn(() => ({ ciphertextB64: "ct", ivB64: "iv", tagB64: "tag" })),
  fingerprintSecret: vi.fn(() => "fp0123456789abcd"),
  last4: vi.fn((k: string) => k.slice(-4)),
}));
const mockByok = vi.hoisted(() => ({ validateKeyViaMint: vi.fn() }));
const mockOpenai = vi.hoisted(() => ({
  ProviderError: class ProviderError extends Error {
    status: number;
    constructor(code = "x", status = 500) {
      super(code);
      this.status = status;
    }
  },
}));
const mockSpend = vi.hoisted(() => ({ checkRateLimit: vi.fn(async () => true) }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/crypto", () => mockCrypto);
vi.mock("@/lib/byok", () => mockByok);
vi.mock("@/lib/coach/openai", () => mockOpenai);
vi.mock("@/lib/mock/spend", () => mockSpend);
// coach-core (redactUnknown) stays real.

import { auth } from "@/lib/auth";
import { POST, GET, DELETE } from "@/app/api/keys/route";

const KEY = "sk-proj-abcdef1234567890ABCDEF";
const CAPS = { realtime: true, ttlSec: 60, checkedAt: "2026-06-12T00:00:00.000Z" };

function postReq(opts: { body?: unknown; url?: string; headers?: Record<string, string> } = {}): Request {
  return new Request(opts.url ?? "http://localhost/api/keys", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(opts.body ?? { key: KEY }),
  });
}

describe("POST /api/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    mockCrypto.isByokConfigured.mockReturnValue(true);
    mockSpend.checkRateLimit.mockResolvedValue(true);
    mockByok.validateKeyViaMint.mockResolvedValue(CAPS);
    mockPrisma.providerKey.upsert.mockResolvedValue({});
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await POST(postReq())).status).toBe(401);
  });

  it("503 when BYOK (the KEK) is not configured", async () => {
    mockCrypto.isByokConfigured.mockReturnValue(false);
    expect((await POST(postReq())).status).toBe(503);
  });

  it("403 on a cross-origin request", async () => {
    const req = postReq({ headers: { origin: "http://evil.com", host: "localhost" } });
    expect((await POST(req)).status).toBe(403);
  });

  it("403 over insecure transport on a non-localhost host", async () => {
    const req = postReq({ url: "http://aloud.example.com/api/keys" });
    expect((await POST(req)).status).toBe(403);
  });

  it("allows HTTPS on a non-localhost host (x-forwarded-proto)", async () => {
    const req = postReq({
      url: "http://aloud.example.com/api/keys",
      headers: { "x-forwarded-proto": "https" },
    });
    expect((await POST(req)).status).toBe(200);
  });

  it("429 when rate limited", async () => {
    mockSpend.checkRateLimit.mockResolvedValue(false);
    expect((await POST(postReq())).status).toBe(429);
  });

  it("400 on a key that isn't an sk- key", async () => {
    const res = await POST(postReq({ body: { key: "not-a-real-key-000000" } }));
    expect(res.status).toBe(400);
    expect(mockByok.validateKeyViaMint).not.toHaveBeenCalled();
  });

  it("400 when OpenAI rejects the key (401)", async () => {
    mockByok.validateKeyViaMint.mockRejectedValue(new mockOpenai.ProviderError("x", 401));
    const res = await POST(postReq());
    expect(res.status).toBe(400);
    expect(mockPrisma.providerKey.upsert).not.toHaveBeenCalled();
  });

  it("400 when the key has no quota (429)", async () => {
    mockByok.validateKeyViaMint.mockRejectedValue(new mockOpenai.ProviderError("x", 429));
    expect((await POST(postReq())).status).toBe(400);
  });

  it("502 when validation fails for another reason", async () => {
    mockByok.validateKeyViaMint.mockRejectedValue(new mockOpenai.ProviderError("x", 500));
    expect((await POST(postReq())).status).toBe(502);
  });

  it("stores the encrypted key and NEVER echoes the raw key (happy path)", async () => {
    const res = await POST(postReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, provider: "OPENAI", last4: KEY.slice(-4) });
    // the raw key never appears in the response
    expect(JSON.stringify(body)).not.toContain(KEY);
    // stored as ciphertext, not plaintext
    expect(mockPrisma.providerKey.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.providerKey.upsert.mock.calls[0]![0];
    expect(arg.create.ciphertextB64).toBe("ct");
    expect(JSON.stringify(arg)).not.toContain(KEY);
  });
});

describe("GET /api/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    mockCrypto.isByokConfigured.mockReturnValue(true);
  });

  it("exists:false when no key", async () => {
    mockPrisma.providerKey.findUnique.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ exists: false, byokEnabled: true });
  });

  it("returns status + last4 but never the key", async () => {
    mockPrisma.providerKey.findUnique.mockResolvedValue({
      last4: "CDEF",
      status: "ACTIVE",
      lastValidatedAt: new Date("2026-06-12T00:00:00Z"),
      capabilities: CAPS,
    });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ exists: true, last4: "CDEF", status: "ACTIVE" });
    expect(JSON.stringify(body)).not.toContain("ciphertext");
  });

  it("byokEnabled:false when the KEK is unset", async () => {
    mockCrypto.isByokConfigured.mockReturnValue(false);
    expect(await (await GET()).json()).toEqual({ exists: false, byokEnabled: false });
  });
});

describe("DELETE /api/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    mockCrypto.isByokConfigured.mockReturnValue(true);
    mockPrisma.providerKey.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("hard-deletes the user's OpenAI key", async () => {
    const res = await DELETE(new Request("http://localhost/api/keys", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.providerKey.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", provider: "OPENAI" },
    });
  });
});

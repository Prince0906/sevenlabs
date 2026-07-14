import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  providerKey: { findUnique: vi.fn(), updateMany: vi.fn() },
}));
const mockCrypto = vi.hoisted(() => ({
  isByokConfigured: vi.fn(() => true),
  decryptSecret: vi.fn(() => "sk-decrypted-key"),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crypto", () => mockCrypto);
vi.mock("@/lib/providers/openai", () => ({ mintRealtimeEphemeral: vi.fn() }));

import { resolveSessionKey, markKeyFromMintError } from "@/lib/byok";

const ENC = { ciphertextB64: "ct", ivB64: "iv", tagB64: "tag" };

describe("resolveSessionKey — fail-closed cost invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrypto.isByokConfigured.mockReturnValue(true);
  });

  it("HOUSE (no query) when the KEK is unconfigured", async () => {
    mockCrypto.isByokConfigured.mockReturnValue(false);
    expect(await resolveSessionKey("u1")).toEqual({ keySource: "ALOUD", apiKey: undefined, apiKeyId: null });
    expect(mockPrisma.providerKey.findUnique).not.toHaveBeenCalled();
  });

  it("HOUSE when the user has no key", async () => {
    mockPrisma.providerKey.findUnique.mockResolvedValue(null);
    expect((await resolveSessionKey("u1")).keySource).toBe("ALOUD");
  });

  it.each(["INVALID", "EXHAUSTED", "REVOKED"])(
    "HOUSE when the key is %s (never spend a dead user key as house)",
    async (status) => {
      mockPrisma.providerKey.findUnique.mockResolvedValue({ id: "k1", status, ...ENC });
      const r = await resolveSessionKey("u1");
      expect(r.keySource).toBe("ALOUD");
      expect(r.apiKey).toBeUndefined();
      expect(mockCrypto.decryptSecret).not.toHaveBeenCalled();
    }
  );

  it("USER with the decrypted key when ACTIVE", async () => {
    mockPrisma.providerKey.findUnique.mockResolvedValue({ id: "k1", status: "ACTIVE", ...ENC });
    const r = await resolveSessionKey("u1");
    expect(r).toEqual({ keySource: "USER", apiKey: "sk-decrypted-key", apiKeyId: "k1" });
  });
});

describe("markKeyFromMintError", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [401, "INVALID"],
    [403, "INVALID"],
    [429, "EXHAUSTED"],
  ])("flips an ACTIVE key on %s → %s", async (httpStatus, expected) => {
    await markKeyFromMintError("u1", httpStatus);
    expect(mockPrisma.providerKey.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", provider: "OPENAI", status: "ACTIVE" },
      data: { status: expected },
    });
  });

  it.each([0, 500, 502, 408])("does NOT condemn the key on transient %s", async (httpStatus) => {
    await markKeyFromMintError("u1", httpStatus);
    expect(mockPrisma.providerKey.updateMany).not.toHaveBeenCalled();
  });
});

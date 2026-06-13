import { describe, it, expect, vi } from "vitest";

// A fixed 32+ char test KEK. The crypto module reads env.KEY_ENCRYPTION_SECRET.
const mockEnv = vi.hoisted(() => ({
  env: { KEY_ENCRYPTION_SECRET: "test-kek-please-ignore-0123456789abcdef" as string | undefined },
}));
vi.mock("@/lib/env", () => mockEnv);

import {
  encryptSecret,
  decryptSecret,
  fingerprintSecret,
  last4,
  isByokConfigured,
} from "@/lib/crypto";

const KEY = "sk-proj-abcDEF1234567890supersecretkeyvalue";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret", () => {
    const enc = encryptSecret(KEY);
    expect(decryptSecret(enc)).toBe(KEY);
  });

  it("never stores the plaintext in the ciphertext fields", () => {
    const enc = encryptSecret(KEY);
    expect(enc.ciphertextB64).not.toContain("sk-proj");
    expect(`${enc.ciphertextB64}${enc.ivB64}${enc.tagB64}`).not.toContain(KEY);
  });

  it("uses a fresh IV each call (same plaintext → different ciphertext)", () => {
    const a = encryptSecret(KEY);
    const b = encryptSecret(KEY);
    expect(a.ivB64).not.toBe(b.ivB64);
    expect(a.ciphertextB64).not.toBe(b.ciphertextB64);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("rejects a tampered ciphertext (GCM auth)", () => {
    const enc = encryptSecret(KEY);
    const flipped = Buffer.from(enc.ciphertextB64, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    expect(() =>
      decryptSecret({ ...enc, ciphertextB64: flipped.toString("base64") })
    ).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    const enc = encryptSecret(KEY);
    const tag = Buffer.from(enc.tagB64, "base64");
    tag[0] = tag[0]! ^ 0xff;
    expect(() => decryptSecret({ ...enc, tagB64: tag.toString("base64") })).toThrow();
  });

  it("throws (no silent insecure path) when the KEK is unset", () => {
    mockEnv.env.KEY_ENCRYPTION_SECRET = undefined;
    expect(isByokConfigured()).toBe(false);
    expect(() => encryptSecret(KEY)).toThrow(/KEY_ENCRYPTION_SECRET/);
    mockEnv.env.KEY_ENCRYPTION_SECRET = "test-kek-please-ignore-0123456789abcdef";
  });
});

describe("fingerprintSecret / last4", () => {
  it("fingerprint is stable, non-reversible, and not the key", () => {
    const fp = fingerprintSecret(KEY);
    expect(fp).toBe(fingerprintSecret(KEY));
    expect(fp).toHaveLength(16);
    expect(KEY).not.toContain(fp);
    expect(fp).not.toContain("sk-");
  });

  it("different keys → different fingerprints", () => {
    expect(fingerprintSecret(KEY)).not.toBe(fingerprintSecret(`${KEY}x`));
  });

  it("last4 returns the display suffix only", () => {
    expect(last4(KEY)).toBe(KEY.slice(-4));
    expect(last4(KEY)).toHaveLength(4);
  });
});

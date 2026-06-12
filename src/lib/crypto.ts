import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { env } from "@/lib/env";

/**
 * Authenticated encryption for BYOK provider keys (INTERVIEW_ENGINE_PLAN D1).
 *
 * AES-256-GCM under a key derived from the env KEK (KEY_ENCRYPTION_SECRET). The
 * raw provider key is encrypted on receipt at POST /api/keys and only ever
 * decrypted inside the mint call frame — never logged, never put in an Error,
 * never returned by any endpoint. GCM gives us tamper-detection (a flipped
 * ciphertext byte fails `final()`), so a corrupted/forged row can't silently
 * decrypt to garbage that gets sent as a Bearer token.
 *
 * The 32-byte content-encryption key is sha256(secret), so any sufficiently
 * high-entropy secret works without forcing an exact byte length. dekVersion=1
 * marks the env-KEK scheme; a future KMS envelope is dekVersion>=2 (P2).
 */

export interface EncryptedSecret {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
}

/** True when BYOK storage is configured. The route 503s when this is false. */
export function isByokConfigured(): boolean {
  return !!env.KEY_ENCRYPTION_SECRET;
}

function kek(): Buffer {
  const secret = env.KEY_ENCRYPTION_SECRET;
  if (!secret) {
    // Never proceed without a KEK — better a clean 503 than encrypting a
    // billing-enabled key under an empty/derived-from-undefined key.
    throw new Error("KEY_ENCRYPTION_SECRET not configured");
  }
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = createCipheriv("aes-256-gcm", kek(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertextB64: ct.toString("base64"),
    ivB64: iv.toString("base64"),
    tagB64: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(enc: EncryptedSecret): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    kek(),
    Buffer.from(enc.ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(enc.tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertextB64, "base64")),
    decipher.final(), // throws if the auth tag doesn't verify
  ]);
  return pt.toString("utf8");
}

/** Non-reversible fingerprint for dedupe/audit. Never store or log the key. */
export function fingerprintSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

/** Last 4 chars for display only ("…a1b2"). */
export function last4(secret: string): string {
  return secret.slice(-4);
}

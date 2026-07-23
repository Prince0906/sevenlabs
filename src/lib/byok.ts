import { prisma } from "@/lib/db";
import { decryptSecret, isByokConfigured } from "@/lib/crypto";
import { mintRealtimeEphemeral } from "@/lib/providers/openai";

/**
 * BYOK policy + validation (INTERVIEW_ENGINE_PLAN D1/D3, §3.4/§3.6).
 *
 * resolveSessionKey answers the one question BYOK introduces: whose key signs
 * this user's session ephemerals. validateKeyViaMint is the authoritative probe
 * — mint a real ephemeral and throw it away. Decryption happens only inside
 * these call frames; the plaintext key is never returned to a client, logged, or
 * placed in an Error (the ProviderError no-body contract guards the mint calls).
 */

export interface ResolvedKey {
  keySource: "USER" | "ALOUD";
  /** undefined → the mint transport falls back to the house key. */
  apiKey: string | undefined;
  apiKeyId: string | null;
}

const HOUSE: ResolvedKey = { keySource: "ALOUD", apiKey: undefined, apiKeyId: null };

/**
 * Decide whose key pays for this user's realtime minutes. An ACTIVE OpenAI
 * ProviderKey → BYOK (decrypt here, in the mint route's frame); otherwise the
 * house key (trial). When the KEK isn't configured, BYOK is fully off.
 */
export async function resolveSessionKey(userId: string): Promise<ResolvedKey> {
  if (!isByokConfigured()) return HOUSE;
  const key = await prisma.providerKey.findUnique({
    where: { userId_provider: { userId, provider: "OPENAI" } },
    select: { id: true, status: true, ciphertextB64: true, ivB64: true, tagB64: true },
  });
  if (!key || key.status !== "ACTIVE") return HOUSE;
  const apiKey = decryptSecret({
    ciphertextB64: key.ciphertextB64,
    ivB64: key.ivB64,
    tagB64: key.tagB64,
  });
  return { keySource: "USER", apiKey, apiKeyId: key.id };
}

/**
 * Failure taxonomy (§3.5): when a mint fails on the USER key, condemn the key so
 * the next session falls to the house key (resolveSessionKey is fail-closed on
 * non-ACTIVE) and the green-room/settings surface it — never silently retry a
 * dead key. 401/403 → INVALID, 429 → EXHAUSTED. A transient/5xx is NOT the key's
 * fault, so it's left ACTIVE (the resume/retry path handles it).
 */
export async function markKeyFromMintError(
  userId: string,
  httpStatus: number
): Promise<void> {
  const status =
    httpStatus === 401 || httpStatus === 403
      ? "INVALID"
      : httpStatus === 429
        ? "EXHAUSTED"
        : null;
  if (!status) return;
  await prisma.providerKey.updateMany({
    where: { userId, provider: "OPENAI", status: "ACTIVE" },
    data: { status },
  });
}

export interface KeyCapabilities {
  realtime: boolean;
  ttlSec: number | null;
  checkedAt: string;
}

/**
 * The sole authoritative key probe: mint a real, minimal, config-locked ephemeral
 * with the user's key and discard it. Success means the key can do realtime and
 * lets us runtime-discover the TTL. No charged completion is ever made. Throws
 * ProviderError (status only, no body) on 401/403/429 — the caller maps it to a
 * KeyStatus.
 */
export async function validateKeyViaMint(
  apiKey: string,
  nowMs: number
): Promise<KeyCapabilities> {
  const eph = await mintRealtimeEphemeral({
    instructions: "Key validation probe. This session is discarded.",
    voice: "alloy",
    safetyIdentifier: "key-validation",
    apiKey,
  });
  const ttlSec =
    eph.expiresAt > 0 ? Math.max(0, Math.round((eph.expiresAt - nowMs) / 1000)) : null;
  return { realtime: true, ttlSec, checkedAt: new Date(nowMs).toISOString() };
}

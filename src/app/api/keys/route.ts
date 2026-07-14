import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { redactUnknown } from "@sevenlabs/panel-core";
import { ProviderError } from "@/lib/providers/openai";
import {
  isByokConfigured,
  encryptSecret,
  fingerprintSecret,
  last4,
} from "@/lib/crypto";
import { validateKeyViaMint } from "@/lib/byok";
import { checkRateLimit } from "@/lib/mock/spend";

// v1 BYOK is OpenAI-only (D3): only OpenAI offers GA realtime with browser-safe
// ephemerals. Other providers are rejected until the turn-based path exists.
const bodySchema = z.object({
  provider: z.literal("OPENAI").default("OPENAI"),
  key: z.string().min(20).max(400),
});

const KEYS_RATE_LIMIT = 5;
const KEYS_WINDOW_SEC = 3600;

function badOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  return !!(origin && host && new URL(origin).host !== host);
}

/** Key endpoints must run over TLS in prod (we're storing billing-enabled keys).
 * localhost dev is exempt; behind Caddy the proto arrives in x-forwarded-proto. */
function insecureTransport(request: Request): boolean {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = url.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return proto !== "https" && !isLocal;
}

/** Shared guard rail for the mutating endpoints. */
async function guard(
  request: Request
): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isByokConfigured()) {
    return NextResponse.json({ error: "BYOK is not configured on this server" }, { status: 503 });
  }
  if (badOrigin(request)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  if (insecureTransport(request)) {
    return NextResponse.json({ error: "HTTPS required" }, { status: 403 });
  }
  return { userId };
}

/** Store + validate the user's provider key. The raw key transits the server
 * exactly here, is validated via a discarded mint, encrypted, and never echoed. */
export async function POST(request: Request) {
  try {
    const g = await guard(request);
    if (g instanceof NextResponse) return g;
    const { userId } = g;

    if (!(await checkRateLimit(`keys:user:${userId}`, KEYS_RATE_LIMIT, KEYS_WINDOW_SEC))) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const key = parsed.data.key.trim();
    if (!key.startsWith("sk-")) {
      return NextResponse.json(
        { error: "That doesn't look like an OpenAI API key (expected sk-…)" },
        { status: 400 }
      );
    }

    // Authoritative probe: mint a real ephemeral and discard it (never charged).
    let capabilities;
    try {
      capabilities = await validateKeyViaMint(key, Date.now());
    } catch (e) {
      const status = e instanceof ProviderError ? e.status : 0;
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: "OpenAI rejected that key. Check it's valid and has Realtime access." },
          { status: 400 }
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: "That key has no available quota right now." },
          { status: 400 }
        );
      }
      log.error("[POST /api/keys] validation probe failed", { status });
      return NextResponse.json({ error: "Could not validate the key, try again" }, { status: 502 });
    }

    const enc = encryptSecret(key);
    await prisma.providerKey.upsert({
      where: { userId_provider: { userId, provider: "OPENAI" } },
      create: {
        userId,
        provider: "OPENAI",
        ciphertextB64: enc.ciphertextB64,
        ivB64: enc.ivB64,
        tagB64: enc.tagB64,
        last4: last4(key),
        fingerprint: fingerprintSecret(key),
        status: "ACTIVE",
        capabilities: capabilities as unknown as Prisma.InputJsonValue,
        lastValidatedAt: new Date(),
      },
      update: {
        ciphertextB64: enc.ciphertextB64,
        ivB64: enc.ivB64,
        tagB64: enc.tagB64,
        last4: last4(key),
        fingerprint: fingerprintSecret(key),
        status: "ACTIVE",
        capabilities: capabilities as unknown as Prisma.InputJsonValue,
        lastValidatedAt: new Date(),
        dekVersion: 1,
      },
    });

    return NextResponse.json({
      ok: true,
      provider: "OPENAI",
      last4: last4(key),
      capabilities,
    });
  } catch (err) {
    log.error("[POST /api/keys]", redactUnknown(err));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Current key status for settings/green-room. Never returns the key. */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isByokConfigured()) return NextResponse.json({ exists: false, byokEnabled: false });

    const key = await prisma.providerKey.findUnique({
      where: { userId_provider: { userId, provider: "OPENAI" } },
      select: { last4: true, status: true, lastValidatedAt: true, capabilities: true },
    });
    if (!key) return NextResponse.json({ exists: false, byokEnabled: true });
    return NextResponse.json({
      exists: true,
      byokEnabled: true,
      provider: "OPENAI",
      last4: key.last4,
      status: key.status,
      lastValidatedAt: key.lastValidatedAt,
      capabilities: key.capabilities,
    });
  } catch (err) {
    log.error("[GET /api/keys]", redactUnknown(err));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Revoke = hard delete. There is no read-back; removal is immediate. */
export async function DELETE(request: Request) {
  try {
    const g = await guard(request);
    if (g instanceof NextResponse) return g;

    // Revoke is a mutation on a security-sensitive resource — rate-limit it too,
    // not just POST (C3).
    if (!(await checkRateLimit(`keys:delete:${g.userId}`, KEYS_RATE_LIMIT, KEYS_WINDOW_SEC))) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    await prisma.providerKey.deleteMany({
      where: { userId: g.userId, provider: "OPENAI" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("[DELETE /api/keys]", redactUnknown(err));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

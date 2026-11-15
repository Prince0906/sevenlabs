import Fastify from "fastify";
import { isIP } from "node:net";
import { prisma } from "@sevenlabs/backend/infrastructure/db";
import { isByokConfigured } from "@sevenlabs/backend/infrastructure/crypto";
import { log } from "@sevenlabs/backend/infrastructure/log";
import type { IdentityAuth } from "@sevenlabs/backend/identity/auth";
import { registerIdentityRoutes } from "./auth-routes";

/** Construct without listening: request injection exercises the real HTTP stack. */
export function buildServer(options: { identity?: IdentityAuth; trustedProxyIp?: string } = {}) {
  if (options.trustedProxyIp !== undefined && !isIP(options.trustedProxyIp)) {
    throw new Error("API_TRUSTED_PROXY_IP must be one explicit proxy IP address");
  }
  const server = Fastify({
    logger: false, // use the shared redacting logger, never log cookies/bodies
    // Trust only the immediate configured Caddy peer, not arbitrary networks,
    // hop counts, or a forwarded client that happens to match the proxy address.
    trustProxy: options.trustedProxyIp
      ? (address, hop) => hop === 0 && address === options.trustedProxyIp
      : false,
    bodyLimit: 1024 * 1024,
    requestTimeout: 30_000,
  });

  // Staged identity integration. Production bootstrap is not switched until
  // configured email delivery and browser/OAuth parity gates are verified.
  if (options.identity) registerIdentityRoutes(server, options.identity);

  server.get("/health/live", async () => ({ status: "alive" }));
  server.get("/api/health", async (_request, reply) => {
    let db = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch (error) {
      log.error("API readiness: database unreachable", error);
    }
    reply.header("Cache-Control", "no-store");
    return reply.code(db ? 200 : 503).send({
      status: db ? "healthy" : "unavailable",
      db,
      byok: isByokConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  server.setErrorHandler((error, request, reply) => {
    const status = typeof error === "object" && error !== null && "statusCode" in error
      && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode : 500;
    // Parser/provider errors may contain request fragments or token URLs.
    log.error("API request failed", { requestId: request.id, status });
    return reply.code(status).send({ error: status === 500 ? "Internal server error" : "Invalid request" });
  });
  return server;
}

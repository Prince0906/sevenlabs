import { buildServer } from "./server";
import { prisma } from "@sevenlabs/backend/infrastructure/db";
import { log } from "@sevenlabs/backend/infrastructure/log";
import { createApiIdentity } from "./identity";
import { registerEmailWebhook } from "./email-webhook";

const { identity, email, webhookSecret } = createApiIdentity();
const server = buildServer({ identity, trustedProxyIp: process.env.API_TRUSTED_PROXY_IP });
registerEmailWebhook(server, email, webhookSecret);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 30_000).unref();
  try {
    await server.close();
    await prisma.$disconnect();
  } catch (error) {
    log.error("API shutdown failed", error);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());

const port = Number(process.env.API_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid API_PORT");
try {
  // Private by default until Caddy/Compose cutover. No product routes yet.
  await server.listen({ port, host: process.env.API_HOST ?? "127.0.0.1" });
  log.info("API listening", { port });
} catch (error) {
  log.error("API startup failed", error);
  await stop();
  process.exitCode = 1;
}

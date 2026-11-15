// Local-only browser fixture. No real emails, OAuth exchange, provider keys or
// production data. Start Next separately using the documented synthetic DB URL.
import { createServer, request as proxyRequest } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";

async function main() {
  if (process.env.TEST_DATABASE_URL !== "postgresql://aloud_test:local_test_only@127.0.0.1:55439/aloud_auth_test") {
    throw new Error("Browser fixture requires the exact disposable local auth-test database");
  }
  const database = "aloud_auth_browser_test_20260907";
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  await admin.query(`CREATE DATABASE "${database}"`); // Fail rather than overwrite.
  process.env.DATABASE_URL = `postgresql://aloud_test:local_test_only@127.0.0.1:55439/${database}`;
  process.env.SKIP_ENV_VALIDATION = "true";
  const sql = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  for (const directory of readdirSync("prisma/migrations", { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name).sort()) {
    await sql.query(readFileSync(`prisma/migrations/${directory}/migration.sql`, "utf8"));
  }
  const messages: { textContent: string }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    if (String(input) !== "https://api.brevo.com/v3/smtp/email") throw new Error("External fetch forbidden in browser fixture");
    messages.push(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify({ messageId: `<test-${messages.length}>` }), { status: 201 });
  };
  const { createApiIdentity } = await import("../apps/api/src/identity");
  const { buildServer } = await import("../apps/api/src/server");
  const { prisma } = await import("../packages/backend/src/infrastructure/db");
  const { identity } = createApiIdentity({
    AUTH_PUBLIC_ORIGIN: "http://127.0.0.1:3002", AUTH_SECRET: "synthetic-browser-auth-secret-32-characters",
    GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", EMAIL_FROM: "accounts@aloud.example",
    BREVO_API_KEY: "test-only", BREVO_WEBHOOK_SECRET: "synthetic-webhook-secret-at-least-32",
    EMAIL_RECIPIENT_SECRET: "synthetic-recipient-secret-at-least-32",
  });
  const api = buildServer({ identity });
  await api.listen({ port: 3001, host: "127.0.0.1" });
  const gateway = createServer((request, response) => {
    if (request.url === "/__test__/email") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(messages.at(-1) ?? null)); return;
    }
    const port = request.url?.startsWith("/api/auth/") || request.url?.startsWith("/api/user/session") ? 3001 : 3000;
    const upstream = proxyRequest({ hostname: "127.0.0.1", port, path: request.url, method: request.method, headers: request.headers }, (result) => {
      response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end("Fixture upstream unavailable"); });
    request.pipe(upstream);
  });
  await new Promise<void>((resolve) => gateway.listen(3002, "127.0.0.1", resolve));
  process.stdout.write("Synthetic auth browser fixture ready at http://127.0.0.1:3002\n");
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    gateway.closeAllConnections();
    await new Promise<void>((resolve) => gateway.close(() => resolve()));
    await api.close(); await prisma.$disconnect(); await sql.end();
    // Stop the separately launched Next process first so it releases this DB.
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end(); globalThis.fetch = originalFetch;
  };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
}
void main();

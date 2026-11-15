import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { IdentityConfig, IdentityAuth } from "../../../packages/backend/src/modules/identity/auth";
import type { PrismaClient } from "../../../packages/backend/src/generated/prisma/client";

// Explicit opt-in only. Never infer a test DB from .env or DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/aloud_auth_test") {
    throw new Error("Auth tests require explicit loopback TEST_DATABASE_URL ending /aloud_auth_test");
  }
}

describe.skipIf(!testUrl).sequential("Better Auth with migrated disposable PostgreSQL", () => {
  const database = `aloud_auth_${randomBytes(8).toString("hex")}`;
  const origin = "https://aloud.example";
  let admin: Pool;
  let sql: Pool;
  let prisma: PrismaClient;
  let server: FastifyInstance;
  let auth: IdentityAuth;
  let created = false;
  let legacyHash: string;
  let disableAccount: (userId: string) => Promise<void>;
  const emails: Parameters<IdentityConfig["sendEmail"]>[0][] = [];

  function request(path: string, body?: object, cookie?: string) {
    return server.inject({
      method: body === undefined ? "GET" : "POST", url: path,
      headers: { origin, ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      ...(body ? { payload: body } : {}),
    });
  }
  function sessionCookie(response: Awaited<ReturnType<typeof request>>) {
    return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }
  async function verifiedUser() {
    const id = `test_${randomBytes(6).toString("hex")}`;
    await prisma.user.create({ data: { id, email: `${id}@example.com`, name: "Test", authEmailVerified: true } });
    await prisma.account.create({ data: { userId: id, type: "credential", provider: "credential", providerAccountId: id, password: legacyHash } });
    return { id, email: `${id}@example.com`, password: "legacy-user-password" };
  }
  async function login(user: { email: string; password: string }) {
    const response = await request("/api/auth/sign-in/email", user);
    expect(response.statusCode).toBe(200);
    return sessionCookie(response);
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1, connectionTimeoutMillis: 5000 });
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const url = new URL(testUrl!);
    url.pathname = `/${database}`;
    sql = new Pool({ connectionString: url.toString(), max: 1 });
    await sql.query(readFileSync("prisma/migrations/20260715150207_init/migration.sql", "utf8"));
    legacyHash = await bcrypt.hash("legacy-user-password", 10);
    await sql.query(`INSERT INTO "User" (id,email,name,"passwordHash","emailVerified","updatedAt") VALUES
      ('legacy-verified','legacy@example.com','Legacy',$1,now(),now()),
      ('legacy-unverified','unverified@example.com',NULL,$1,NULL,now())`, [legacyHash]);
    await sql.query(`INSERT INTO "Account" (id,"userId",type,provider,"providerAccountId",expires_at)
      VALUES ('legacy-google','legacy-verified','oauth','google','google-subject-123',1900000000)`);
    await sql.query(readFileSync("prisma/migrations/20260906173000_backend_auth/migration.sql", "utf8"));
    await sql.query(readFileSync("prisma/migrations/20260907150000_transactional_email/migration.sql", "utf8"));
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("DATABASE_URL", url.toString());
    ({ prisma } = await import("../../../packages/backend/src/infrastructure/db"));
    const { createIdentityAuth } = await import("../../../packages/backend/src/modules/identity/auth");
    ({ disableAccount } = await import("../../../packages/backend/src/modules/identity/disable-account"));
    auth = createIdentityAuth({
      publicOrigin: origin, secret: "synthetic-test-secret-not-for-production-12345",
      google: { clientId: "test-client", clientSecret: "test-secret" },
      sendEmail: async (email) => { emails.push(email); },
    });
    const { buildServer } = await import("../../../apps/api/src/server");
    server = buildServer({ identity: auth });
    await server.ready();
  }, 30_000);

  beforeEach(async () => {
    emails.length = 0;
    await prisma.authRateLimit.deleteMany();
  });

  it("persists email cooldowns atomically and suppresses bounces despite late delivery events", async () => {
    const { createEmailService } = await import("../../../packages/backend/src/infrastructure/email/service");
    const email = createEmailService({ apiKey: "test-only-key", from: "accounts@aloud.example", recipientSecret: "test-only-recipient-secret-at-least-32-chars" });
    const recipient = `${randomBytes(8).toString("hex")}@example.com`;
    let deliveryId = "";
    const fetcher = vi.fn(async (_url: unknown, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      deliveryId = body.headers["X-Mailin-custom"];
      // The provider may call back before its send response reaches the API.
      await email.recordEvent({ id: deliveryId, email: recipient, messageId: "id", status: "hard_bounce", rank: 5, suppress: true, occurredAt: new Date(1_700_000_000_000) });
      return new Response(JSON.stringify({ messageId: "<id>" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetcher);
    try {
      const message = { to: recipient, subject: "Test", text: "private-token", html: "private-token" };
      await Promise.all([email.send(message), email.send(message)]);
      expect(fetcher).toHaveBeenCalledOnce();
      await email.recordEvent({ id: deliveryId, email: recipient, messageId: "id", status: "delivered", rank: 3, suppress: false, occurredAt: new Date(1_700_000_100_000) });
      await email.recordEvent({ id: deliveryId, email: recipient, messageId: "id", status: "hard_bounce", rank: 5, suppress: true, occurredAt: new Date(1_700_000_000_000) });
      const delivery = await prisma.emailDelivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { recipient: true } });
      expect(delivery.status).toBe("hard_bounce");
      expect(delivery.recipient.suppressedAt).toEqual(new Date(1_700_000_000_000));
      expect(JSON.stringify(delivery)).not.toContain("private-token");
      expect(JSON.stringify(delivery)).not.toContain(recipient);
      await email.send(message, true); // Security notices still honor suppression.
      expect(fetcher).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });

  it.each(["/request-password-reset", "/send-verification-email"])("rate-limits %s requests", async (path) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await request(`/api/auth${path}`, { email: "unverified@example.com" })).statusCode).toBe(200);
    }
    expect((await request(`/api/auth${path}`, { email: "unverified@example.com" })).statusCode).toBe(429);
  });

  afterAll(async () => {
    await server?.close();
    await prisma?.$disconnect();
    await sql?.end();
    // Only the exact random database created by this suite is removed.
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin?.end();
    vi.unstubAllEnvs();
  });

  it("preserves legacy IDs, password hashes, verification state and Google subject", async () => {
    const verified = await prisma.user.findUniqueOrThrow({ where: { id: "legacy-verified" } });
    const unverified = await prisma.user.findUniqueOrThrow({ where: { id: "legacy-unverified" } });
    expect(verified.authEmailVerified).toBe(true);
    expect(unverified.authEmailVerified).toBe(false);
    expect(unverified.name).toBeNull();
    const credential = await prisma.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: "credential", providerAccountId: verified.id } } });
    expect(credential.password).toBe(legacyHash);
    expect(verified.passwordHash).toBe(legacyHash);
    const google = await prisma.account.findUniqueOrThrow({ where: { id: "legacy-google" } });
    expect(google.providerAccountId).toBe("google-subject-123");
    expect(google.userId).toBe(verified.id);
    expect(google.accessTokenExpiresAt?.getTime()).toBe(1900000000 * 1000);
    const cookie = await login({ email: verified.email, password: "legacy-user-password" });
    expect((await request("/api/user/session", undefined, cookie)).json().user.id).toBe(verified.id);
  });

  it("requires verification before issuing a password session", async () => {
    const response = await request("/api/auth/sign-in/email", { email: "unverified@example.com", password: "legacy-user-password" });
    expect(response.statusCode).toBe(403);
    expect(emails[0]?.kind).toBe("verification");
    expect(await prisma.session.count({ where: { userId: "legacy-unverified" } })).toBe(0);
  });

  it("registers, sends verification, verifies and logs in without returning password fields", async () => {
    const user = { email: "new@example.com", password: "new-user-password", name: "New" };
    const response = await request("/api/auth/sign-up/email", user);
    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBeNull();
    expect(response.body).not.toContain("passwordHash");
    expect(emails).toHaveLength(1);
    if (!("url" in emails[0])) throw new Error("Expected verification link");
    const url = new URL(emails[0].url);
    const verification = await request(url.pathname + url.search);
    expect([200, 302]).toContain(verification.statusCode);
    expect((await request("/api/user/session", undefined, await login(user))).json().user.email).toBe(user.email);
  });

  it("uses secure cookies, supports SSR lookup, rejects forged identity and logs out", async () => {
    const user = await verifiedUser();
    const response = await request("/api/auth/sign-in/email", { ...user, rememberMe: false });
    expect(response.statusCode).toBe(200);
    expect(response.cookies.length).toBeGreaterThanOrEqual(2);
    const cookie = sessionCookie(response);
    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    const session = await request("/api/user/session", undefined, cookie);
    expect(session.json()).toEqual({ user: { id: user.id, email: user.email, name: "Test" } });
    expect(session.headers["cache-control"]).toBe("no-store");
    expect((await server.inject({ url: "/api/user/session", headers: { "x-user-id": user.id } })).statusCode).toBe(401);
    expect((await request("/api/auth/sign-out", {}, cookie)).statusCode).toBe(200);
    expect((await request("/api/user/session", undefined, cookie)).statusCode).toBe(401);
  });

  it("revokes a session immediately without cookie caching", async () => {
    const user = await verifiedUser();
    const cookie = await login(user);
    const session = await request("/api/auth/get-session", undefined, cookie);
    expect((await request("/api/auth/revoke-session", { token: session.json().session.token }, cookie)).statusCode).toBe(200);
    expect((await request("/api/user/session", undefined, cookie)).statusCode).toBe(401);
  });

  it("resets a password once and revokes existing sessions", async () => {
    const user = await verifiedUser();
    const cookie = await login(user);
    expect((await request("/api/auth/request-password-reset", { email: user.email, redirectTo: `${origin}/sign-in` })).statusCode).toBe(200);
    expect(emails[0].kind).toBe("password-reset");
    if (!("url" in emails[0])) throw new Error("Expected reset link");
    const resetLink = new URL(emails[0].url);
    const redirect = await request(resetLink.pathname + resetLink.search);
    const token = new URL(String(redirect.headers.location)).searchParams.get("token");
    expect(token).toBeTruthy();
    expect((await request("/api/auth/reset-password", { token, newPassword: "replacement-password" })).statusCode).toBe(200);
    expect((await request("/api/user/session", undefined, cookie)).statusCode).toBe(401);
    expect((await request("/api/auth/sign-in/email", user)).statusCode).toBe(401);
    await login({ email: user.email, password: "replacement-password" });
    expect((await request("/api/auth/reset-password", { token, newPassword: "another-password" })).statusCode).toBe(400);
  });

  it("does not let one user revoke another user's session", async () => {
    const first = await verifiedUser();
    const second = await verifiedUser();
    const firstCookie = await login(first);
    const secondCookie = await login(second);
    const secondSession = (await request("/api/auth/get-session", undefined, secondCookie)).json().session;
    await request("/api/auth/revoke-session", { token: secondSession.token }, firstCookie);
    expect((await request("/api/user/session", undefined, secondCookie)).statusCode).toBe(200);
  });

  it("throttles repeated password attempts using database-backed limits", async () => {
    const user = await verifiedUser();
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await request("/api/auth/sign-in/email", { email: user.email, password: "incorrect" })).statusCode).toBe(401);
    }
    expect((await request("/api/auth/sign-in/email", user)).statusCode).toBe(429);
  });

  it("disables an account, revokes its sessions and denies new login", async () => {
    const user = await verifiedUser();
    const cookie = await login(user);
    await disableAccount(user.id);
    expect((await request("/api/user/session", undefined, cookie)).statusCode).toBe(401);
    expect((await request("/api/auth/sign-in/email", user)).statusCode).toBe(403);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("separates client rate limits behind Caddy without trusting forged client IP headers", async () => {
    const { buildServer } = await import("../../../apps/api/src/server");
    const proxied = buildServer({ identity: auth, trustedProxyIp: "192.0.2.10" });
    const user = await verifiedUser();
    const signIn = (ip: string, password: string) => proxied.inject({
      method: "POST", url: "/api/auth/sign-in/email", remoteAddress: "192.0.2.10",
      headers: { origin, "x-forwarded-for": ip, "x-aloud-client-ip": "203.0.113.99" },
      payload: { email: user.email, password },
    });
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        expect((await signIn("198.51.100.1", "incorrect")).statusCode).toBe(401);
      }
      expect((await signIn("203.0.113.98, 198.51.100.1", user.password)).statusCode).toBe(429);
      expect((await signIn("198.51.100.2", user.password)).statusCode).toBe(200);
    } finally { await proxied.close(); }
  });

  it("rejects foreign origins, enforces payload limits and uses the fixed Google callback origin", async () => {
    expect((await server.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email: "legacy@example.com", password: "legacy-user-password" } })).statusCode).toBe(403);
    expect((await server.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { origin: "https://evil.example" }, payload: { email: "legacy@example.com", password: "legacy-user-password" } })).statusCode).toBe(403);
    expect((await request("/api/auth/sign-up/email", { name: "x".repeat(17 * 1024) })).statusCode).toBe(413);
    const google = await server.inject({ method: "POST", url: "/api/auth/sign-in/social", headers: { origin, host: "evil.example", "x-forwarded-host": "evil.example" }, payload: { provider: "google", callbackURL: `${origin}/dashboard` } });
    expect(google.statusCode).toBe(200);
    const location = new URL(google.json().url);
    expect(location.hostname).toBe("accounts.google.com");
    expect(location.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
    expect(auth.options.account?.accountLinking?.disableImplicitLinking).toBe(true);
    // No real Google login/token exchange is claimed by this initiation test.
  });
});

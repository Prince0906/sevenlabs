import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "../../infrastructure/db";
import { log } from "../../infrastructure/log";
import { hashIdentityPassword, verifyIdentityPassword } from "./password";
import type { IdentityEmail } from "./email";

export interface IdentityConfig {
  publicOrigin: string;
  secret: string;
  google: { clientId: string; clientSecret: string };
  // Required transport, never a console/token-printing fallback. Production
  // bootstrap must supply the owner's configured transactional email service.
  sendEmail: (message: IdentityEmail) => Promise<void>;
}

export function createIdentityAuth(config: IdentityConfig) {
  const origin = new URL(config.publicOrigin);
  if (origin.origin !== config.publicOrigin || origin.username || origin.password
    || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new Error("Identity requires a fixed HTTPS public origin (HTTP allowed only on local loopback)");
  }
  if (config.secret.length < 32) throw new Error("Identity secret must be at least 32 characters");

  return betterAuth({
    appName: "Aloud",
    baseURL: config.publicOrigin,
    basePath: "/api/auth",
    secret: config.secret,
    trustedOrigins: [config.publicOrigin],
    database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
    user: { fields: { emailVerified: "authEmailVerified" } },
    account: {
      fields: {
        accountId: "providerAccountId", providerId: "provider",
        accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token",
      },
      accountLinking: { enabled: true, disableImplicitLinking: true },
    },
    session: {
      fields: { token: "sessionToken", expiresAt: "expires" },
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
      deferSessionRefresh: true,
    },
    verification: { modelName: "authVerification" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 200,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashIdentityPassword, verify: verifyIdentityPassword },
      sendResetPassword: async ({ user, url }) => config.sendEmail({ kind: "password-reset", to: user.email, url }),
      onPasswordReset: async ({ user }) => {
        // A notification failure must never prevent revocation after a reset.
        try { await config.sendEmail({ kind: "password-changed", to: user.email }); }
        catch { log.error("identity_security_email_failed", { category: "password_changed" }); }
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => config.sendEmail({ kind: "verification", to: user.email, url }),
    },
    socialProviders: { google: config.google },
    rateLimit: {
      enabled: true, storage: "database", modelName: "authRateLimit", window: 60, max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "aloud",
      useSecureCookies: origin.protocol === "https:",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-aloud-client-ip"] },
    },
    databaseHooks: {
      session: { create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { disabledAt: true } });
          // A newly provisioned OAuth user may still be inside the library's
          // transaction and invisible on this connection; the FK guards absence.
          if (user?.disabledAt) throw new APIError("FORBIDDEN", { message: "Account unavailable" });
        },
        after: async (session) => {
          // Covers disablement racing session creation after the before check.
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { disabledAt: true } });
          if (user?.disabledAt) {
            await prisma.session.deleteMany({ where: { id: session.id } });
            throw new APIError("FORBIDDEN", { message: "Account unavailable" });
          }
        },
      } },
    },
    // Library free-text/errors can contain callback URLs or email tokens. Do
    // not forward them; HTTP status/correlation belongs to the API logger.
    logger: { log: (level) => log[level]("identity library event") },
  });
}

export type IdentityAuth = ReturnType<typeof createIdentityAuth>;

/** Backend authorization entry: a valid cookie is not proof of resource ownership. */
export async function readIdentity(auth: IdentityAuth, headers: Headers) {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;
  const user = await prisma.user.findUnique({
    where: { id: result.user.id }, select: { id: true, email: true, name: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return null;
  return { id: user.id, email: user.email, name: user.name };
}

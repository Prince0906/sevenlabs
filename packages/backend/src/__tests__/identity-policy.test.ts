import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  session: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("../infrastructure/db", () => ({ prisma: db }));
vi.mock("../infrastructure/log", () => ({ log: logger }));

import { createIdentityAuth, readIdentity, type IdentityAuth } from "../modules/identity/auth";
import { disableAccount } from "../modules/identity/disable-account";

const config = {
  publicOrigin: "https://aloud.example",
  secret: "test-only-secret-not-for-production-12345",
  google: { clientId: "test", clientSecret: "test" },
  sendEmail: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => vi.clearAllMocks());

describe("backend identity policy", () => {
  it.each(["http://aloud.example", "https://aloud.example/path", "https://user:pass@aloud.example", "https://aloud.example/"])("rejects unsafe public origin %s", (publicOrigin) => {
    expect(() => createIdentityAuth({ ...config, publicOrigin })).toThrow("fixed HTTPS public origin");
  });

  it("rejects a short session secret", () => {
    expect(() => createIdentityAuth({ ...config, secret: "short" })).toThrow("at least 32");
  });

  it("configures one revocable database-session authority and explicit linking", () => {
    const auth = createIdentityAuth(config);
    expect(auth.options.session?.cookieCache?.enabled).toBe(false);
    expect(auth.options.session?.deferSessionRefresh).toBe(true);
    expect(auth.options.account?.accountLinking?.disableImplicitLinking).toBe(true);
    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
    expect(auth.options.rateLimit?.storage).toBe("database");
    expect(auth.options.advanced?.useSecureCookies).toBe(true);
    expect(createIdentityAuth({ ...config, publicOrigin: "http://127.0.0.1:3001" }).options.advanced?.useSecureCookies).toBe(false);
  });

  it("passes email only to the configured transport and never logs library secrets", async () => {
    const auth = createIdentityAuth(config);
    const data = { user: { email: "recipient@example.com" }, url: "https://aloud.example/token=private" } as never;
    await auth.options.emailVerification!.sendVerificationEmail!(data);
    await auth.options.emailAndPassword!.sendResetPassword!(data);
    expect(config.sendEmail).toHaveBeenCalledWith({ kind: "verification", to: "recipient@example.com", url: "https://aloud.example/token=private" });
    expect(config.sendEmail).toHaveBeenCalledWith({ kind: "password-reset", to: "recipient@example.com", url: "https://aloud.example/token=private" });
    Reflect.apply(auth.options.logger!.log!, null, ["error", "private-token", { secret: "private-secret" }]);
    expect(logger.error).toHaveBeenCalledWith("identity library event");
  });

  it("blocks disabled accounts before creation and cleans up a racing session", async () => {
    const hooks = createIdentityAuth(config).options.databaseHooks!.session!.create!;
    const session = { id: "session-1", userId: "user-1" } as never;
    db.user.findUnique.mockResolvedValue({ disabledAt: new Date() });
    await expect(hooks.before!(session)).rejects.toThrow("Account unavailable");
    await expect(hooks.after!(session)).rejects.toThrow("Account unavailable");
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { id: "session-1" } });
    db.user.findUnique.mockResolvedValue({ disabledAt: null });
    await expect(hooks.before!(session)).resolves.toBeUndefined();
    await expect(hooks.after!(session)).resolves.toBeUndefined();
    db.user.findUnique.mockResolvedValue(null); // provisioning in another transaction
    await expect(hooks.before!(session)).resolves.toBeUndefined();
  });

  it("does not interrupt password reset revocation when the security notification fails", async () => {
    const auth = createIdentityAuth({ ...config, sendEmail: vi.fn().mockRejectedValue(new Error("private token")) });
    await expect(auth.options.emailAndPassword!.onPasswordReset!({ user: { email: "user@example.com" } } as never)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("identity_security_email_failed", { category: "password_changed" });
  });

  it("returns only an enabled, database-backed principal", async () => {
    const getSession = vi.fn().mockResolvedValue(null);
    const auth = { api: { getSession } } as unknown as IdentityAuth;
    expect(await readIdentity(auth, new Headers())).toBeNull();
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    db.user.findUnique.mockResolvedValue(null);
    expect(await readIdentity(auth, new Headers())).toBeNull();
    db.user.findUnique.mockResolvedValue({ disabledAt: new Date() });
    expect(await readIdentity(auth, new Headers())).toBeNull();
    db.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com", name: "User", disabledAt: null });
    expect(await readIdentity(auth, new Headers())).toEqual({ id: "user-1", email: "user@example.com", name: "User" });
  });

  it("disables the user and deletes sessions in one transaction", async () => {
    await disableAccount("user-1");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { disabledAt: expect.any(Date) } });
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(db.$transaction).toHaveBeenCalledOnce();
  });
});

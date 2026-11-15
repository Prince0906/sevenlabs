import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const db = vi.hoisted(() => ({
  emailRecipient: { upsert: vi.fn(), updateMany: vi.fn() },
  emailDelivery: { create: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("../infrastructure/db", () => ({ prisma: db }));
vi.mock("../infrastructure/log", () => ({ log: logger }));
import { createBrevoSender } from "../infrastructure/email/brevo";
import { createEmailService } from "../infrastructure/email/service";
import { createIdentityEmail } from "../modules/identity/email";

const fetcher = vi.fn();
const config = { apiKey: "private-brevo-key", from: "accounts@aloud.example", recipientSecret: "private-recipient-secret-at-least-32-chars" };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", fetcher);
  db.emailRecipient.updateMany.mockResolvedValue({ count: 1 });
  db.emailDelivery.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllGlobals());

describe("transactional identity mail", () => {
  it.each([
    "https://evil.example/api/auth/verify-email?token=private",
    "https://aloud.example@evil.example/api/auth/verify-email?token=private",
    "https://aloud.example/api/auth/verify-email?callbackURL=https%3A%2F%2Fevil.example",
    "https://aloud.example/api/auth/verify-email?callbackURL=%2F%2Fevil.example",
    "https://aloud.example/untrusted?token=private", "not-a-url",
  ])("rejects untrusted link %s before sending", async (url) => {
    const send = vi.fn();
    await expect(createIdentityEmail("https://aloud.example", send)({ kind: "verification", to: "user@example.com", url })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it("uses simple escaped templates and the fixed Brevo endpoint without marketing calls", async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ messageId: "<provider-id>" }), { status: 201 }));
    const email = createEmailService(config);
    await createIdentityEmail("https://aloud.example", email.send)({ kind: "verification", to: "user@example.com", url: "https://aloud.example/api/auth/verify-email?token=private&callbackURL=/sign-in" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe(config.apiKey);
    expect(init.redirect).toBe("error");
    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ name: "Aloud", email: config.from });
    expect(body.to).toEqual([{ email: "user@example.com" }]);
    expect(body.htmlContent).toContain("&amp;callbackURL=");
    expect(body.headers["X-Mailin-custom"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(db.emailDelivery.create.mock.calls[0][0].data).not.toHaveProperty("to");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("private");
  });

  it.each([[400, "rejected"], [401, "rejected"], [429, "rate_limited"], [503, "unknown"]])("classifies HTTP %i without retrying or logging response contents", async (status, category) => {
    fetcher.mockResolvedValue(new Response("private token=user-token user@example.com", { status }));
    await expect(createEmailService(config).send({ to: "user@example.com", subject: "Private", text: "user-token", html: "user-token" })).rejects.toThrow("Email delivery unavailable");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith("email_send_failed", { deliveryId: expect.any(String), category, status });
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/user-token|user@example|private-brevo/);
  });

  it("does not blindly retry an ambiguous network failure", async () => {
    fetcher.mockRejectedValue(new Error("private network details"));
    await expect(createBrevoSender(config.apiKey, config.from)({ id: "id", to: "user@example.com", subject: "subject", text: "text", html: "html" })).rejects.toMatchObject({ category: "unknown", message: "Email delivery unavailable" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not send to suppressed or throttled recipients", async () => {
    db.emailRecipient.updateMany.mockResolvedValue({ count: 0 });
    await createEmailService(config).send({ to: "user@example.com", subject: "subject", text: "text", html: "html" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.emailDelivery.create).not.toHaveBeenCalled();
  });

  it("rejects invalid configuration and malformed provider success", async () => {
    expect(() => createEmailService({ ...config, recipientSecret: "short" })).toThrow();
    expect(() => createBrevoSender("", config.from)).toThrow();
    fetcher.mockResolvedValue(new Response("{}", { status: 201 }));
    await expect(createBrevoSender(config.apiKey, config.from)({ id: "id", to: "user@example.com", subject: "subject", text: "text", html: "html" })).rejects.toMatchObject({ category: "unknown" });
  });
});

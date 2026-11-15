import Fastify from "fastify";
import { afterAll, describe, expect, it, vi } from "vitest";
import { registerEmailWebhook } from "../../../apps/api/src/email-webhook";

const recordEvent = vi.fn();
const server = Fastify();
const secret = "test-webhook-secret-at-least-32-characters";
registerEmailWebhook(server, { send: vi.fn(), recordEvent }, secret);
afterAll(() => server.close());
const event = { event: "hard_bounce", email: "user@example.com", "message-id": "<provider-id>", "X-Mailin-custom": "cc551311-7d10-4350-a722-d5d588fc3e26", ts_event: 1_700_000_000, reason: "private bounce details", subject: "private subject" };

describe("email provider webhook", () => {
  it("rejects forged callbacks before processing the body", async () => {
    expect((await server.inject({ method: "POST", url: "/api/webhooks/email/brevo", payload: event })).statusCode).toBe(401);
    expect(recordEvent).not.toHaveBeenCalled();
  });
  it("maps authenticated callbacks to token-free generic delivery events", async () => {
    const response = await server.inject({ method: "POST", url: "/api/webhooks/email/brevo", headers: { authorization: `Bearer ${secret}` }, payload: event });
    expect(response.statusCode).toBe(204);
    expect(recordEvent).toHaveBeenCalledWith({ id: event["X-Mailin-custom"], email: event.email, messageId: "provider-id", status: "hard_bounce", rank: 5, suppress: true, occurredAt: new Date(1_700_000_000_000) });
  });
  it("rejects malformed events", async () => {
    expect((await server.inject({ method: "POST", url: "/api/webhooks/email/brevo", headers: { authorization: `Bearer ${secret}` }, payload: {} })).statusCode).toBe(400);
  });
});

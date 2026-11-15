import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { EmailService } from "@sevenlabs/backend/infrastructure/email";

const events: Record<string, { rank: number; suppress: boolean }> = {
  request: { rank: 1, suppress: false }, deferred: { rank: 2, suppress: false },
  soft_bounce: { rank: 2, suppress: false }, delivered: { rank: 3, suppress: false },
  error: { rank: 4, suppress: false }, blocked: { rank: 4, suppress: false },
  hard_bounce: { rank: 5, suppress: true }, invalid_email: { rank: 5, suppress: true },
  spam: { rank: 5, suppress: true }, unsubscribed: { rank: 5, suppress: true },
};
const payload = z.object({
  event: z.string(), email: z.email(), "X-Mailin-custom": z.uuid(),
  "message-id": z.string().min(1).max(512), ts_event: z.number().int().nonnegative().max(8_640_000_000_000),
});

export function registerEmailWebhook(server: FastifyInstance, email: EmailService, secret: string) {
  if (secret.length < 32) throw new Error("Invalid email webhook secret");
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  server.post("/api/webhooks/email/brevo", {
    bodyLimit: 16 * 1024,
    onRequest: async (request, reply) => {
      const actual = createHash("sha256").update(request.headers.authorization ?? "").digest();
      if (!timingSafeEqual(actual, expected)) return reply.code(401).send({ error: "Unauthorized" });
    },
  }, async (request, reply) => {
    const parsed = payload.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid event" });
    const event = parsed.data;
    const policy = Object.hasOwn(events, event.event) ? events[event.event] : undefined;
    if (policy) await email.recordEvent({
      id: event["X-Mailin-custom"], email: event.email, messageId: event["message-id"].replace(/^<|>$/g, ""),
      status: event.event, occurredAt: new Date(event.ts_event * 1000), ...policy,
    });
    return reply.code(204).send();
  });
}

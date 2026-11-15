import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { log } from "../log";
import { createBrevoSender, EmailSendError } from "./brevo";
import type { TransactionalMessage } from "./types";

export function createEmailService(config: { apiKey: string; from: string; recipientSecret: string }) {
  if (config.recipientSecret.length < 32) throw new Error("EMAIL_RECIPIENT_SECRET must be at least 32 characters");
  const send = createBrevoSender(config.apiKey, config.from);
  const recipientHash = (email: string) => createHmac("sha256", config.recipientSecret).update(email.trim().toLowerCase()).digest("hex");
  return {
    async send(message: Omit<TransactionalMessage, "id">, securityNotice = false) {
      if (!z.email().safeParse(message.to).success) throw new Error("Invalid email recipient");
      const hash = recipientHash(message.to);
      const now = new Date();
      await prisma.emailRecipient.upsert({ where: { hash }, create: { hash }, update: {} });
      // Atomic per-recipient cooldown complements the auth endpoint IP limits.
      // Suppression/throttle outcomes are opaque to callers to avoid enumeration.
      const claim = await prisma.emailRecipient.updateMany({
        where: { hash, suppressedAt: null, ...(!securityNotice ? { lastRequestedAt: { lte: new Date(now.getTime() - 60_000) } } : {}) },
        data: { lastRequestedAt: now },
      });
      if (!claim.count) { log.info("email_send_skipped", { category: "suppressed_or_throttled" }); return; }
      const id = randomUUID();
      await prisma.emailDelivery.create({ data: { id, recipientHash: hash } });
      try {
        const providerMessageId = await send({ ...message, id });
        await prisma.emailDelivery.updateMany({ where: { id, eventRank: 0 }, data: { providerMessageId, status: "accepted", eventRank: 1 } });
        log.info("email_accepted", { deliveryId: id });
      } catch (error) {
        const category = error instanceof EmailSendError ? error.category : "unknown";
        log.error("email_send_failed", { deliveryId: id, category, ...(error instanceof EmailSendError ? { status: error.status } : {}) });
        try { await prisma.emailDelivery.updateMany({ where: { id, eventRank: 0 }, data: { status: category } }); }
        catch { log.error("email_status_persistence_failed", { deliveryId: id }); }
        // No automatic retry: a timeout/5xx may occur after provider acceptance.
        throw new Error("Email delivery unavailable");
      }
    },
    async recordEvent(event: { id: string; email: string; messageId: string; status: string; rank: number; occurredAt: Date; suppress: boolean }) {
      const hash = recipientHash(event.email);
      const delivery = await prisma.emailDelivery.findUnique({ where: { id: event.id }, select: { recipientHash: true } });
      if (!delivery || delivery.recipientHash !== hash) return;
      await prisma.$transaction(async (tx) => {
        await tx.emailDelivery.updateMany({
          where: { id: event.id, OR: [{ eventRank: { lt: event.rank } }, { eventRank: event.rank, OR: [{ eventAt: null }, { eventAt: { lt: event.occurredAt } }] }] },
          data: { status: event.status, eventRank: event.rank, eventAt: event.occurredAt, providerMessageId: event.messageId },
        });
        if (event.suppress) await tx.emailRecipient.updateMany({ where: { hash, suppressedAt: null }, data: { suppressedAt: event.occurredAt, suppressionReason: event.status } });
      });
      if (event.rank >= 4) log.warn("email_delivery_failed", { deliveryId: event.id, category: event.status });
    },
  };
}

export type EmailService = ReturnType<typeof createEmailService>;

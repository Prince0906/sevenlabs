import { z } from "zod";
import type { TransactionalMessage } from "./types";

export class EmailSendError extends Error {
  constructor(readonly category: "rejected" | "rate_limited" | "unknown", readonly status?: number) {
    super("Email delivery unavailable");
  }
}

export function createBrevoSender(apiKey: string, from: string) {
  if (!apiKey.trim() || !z.email().safeParse(from).success) throw new Error("Invalid email provider configuration");
  return async (message: TransactionalMessage): Promise<string> => {
    let response: Response;
    try {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: from, name: "Aloud" }, to: [{ email: message.to }],
          subject: message.subject, htmlContent: message.html, textContent: message.text,
          headers: { "X-Mailin-custom": message.id },
        }),
      });
    } catch { throw new EmailSendError("unknown"); }
    if (!response.ok) {
      // Never read or log provider error bodies: they may echo email contents.
      await response.body?.cancel();
      throw new EmailSendError(response.status === 429 ? "rate_limited" : response.status < 500 ? "rejected" : "unknown", response.status);
    }
    try {
      const result = z.object({ messageId: z.string().min(1).max(512) }).parse(await response.json());
      return result.messageId.replace(/^<|>$/g, "");
    } catch { throw new EmailSendError("unknown"); }
  };
}

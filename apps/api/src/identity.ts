import { createIdentityAuth } from "@sevenlabs/backend/identity/auth";
import { createIdentityEmail } from "@sevenlabs/backend/identity/email";
import { createEmailService } from "@sevenlabs/backend/infrastructure/email";

/** Runtime composition only; credentials never enter Next or browser config. */
export function createApiIdentity(environment: Record<string, string | undefined> = process.env) {
  const required = (name: string) => {
    const value = environment[name];
    if (!value?.trim()) throw new Error(`Missing API configuration: ${name}`);
    return value;
  };
  const publicOrigin = required("AUTH_PUBLIC_ORIGIN");
  const webhookSecret = required("BREVO_WEBHOOK_SECRET");
  if (webhookSecret.length < 32) throw new Error("BREVO_WEBHOOK_SECRET must be at least 32 characters");
  const email = createEmailService({ apiKey: required("BREVO_API_KEY"), from: required("EMAIL_FROM"), recipientSecret: required("EMAIL_RECIPIENT_SECRET") });
  const identity = createIdentityAuth({
    publicOrigin, secret: required("AUTH_SECRET"),
    google: { clientId: required("GOOGLE_CLIENT_ID"), clientSecret: required("GOOGLE_CLIENT_SECRET") },
    sendEmail: createIdentityEmail(publicOrigin, email.send),
  });
  return { identity, email, webhookSecret };
}

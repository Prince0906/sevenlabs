import type { TransactionalMessage } from "../../infrastructure/email/types";

export type IdentityEmail =
  | { kind: "verification" | "password-reset"; to: string; url: string }
  | { kind: "password-changed"; to: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** Domain templates contain no vendor configuration or provider calls. */
export function createIdentityEmail(publicOrigin: string, send: (message: Omit<TransactionalMessage, "id">, securityNotice: boolean) => Promise<void>) {
  return async (message: IdentityEmail) => {
    const subject = message.kind === "verification" ? "Verify your Aloud email"
      : message.kind === "password-reset" ? "Reset your Aloud password" : "Your Aloud password was changed";
    let text: string;
    if (message.kind === "password-changed") {
      text = "Your Aloud password was changed. If this was not you, reset your password from the Aloud sign-in page immediately.";
    } else {
      let url: URL;
      try { url = new URL(message.url); } catch { throw new Error("Invalid identity email link"); }
      const pathAllowed = message.kind === "verification" ? url.pathname === "/api/auth/verify-email"
        : /^\/api\/auth\/reset-password\/[^/]+$/.test(url.pathname);
      if (url.origin !== publicOrigin || url.username || url.password || url.hash || !pathAllowed) {
        throw new Error("Untrusted identity email link");
      }
      for (const name of ["callbackURL", "redirectTo"]) {
        const callback = url.searchParams.get(name);
        if (callback && new URL(callback, publicOrigin).origin !== publicOrigin) throw new Error("Untrusted identity email callback");
      }
      text = `${subject}:\n\n${url.href}\n\nIf you did not request this, you can ignore this email. Never share this link.`;
    }
    await send({ to: message.to, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>` }, message.kind === "password-changed");
  };
}

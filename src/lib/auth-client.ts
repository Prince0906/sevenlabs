"use client";

import { createAuthClient } from "better-auth/react";
import { signIn as legacySignIn, signOut as legacySignOut, useSession as useLegacySession } from "next-auth/react";
import { backendAuthEnabled, safeAuthRedirect } from "./auth-mode";

export const authClient = createAuthClient(); // Same-origin /api/auth via Caddy.

function useBackendSession() {
  const { data, isPending, error } = authClient.useSession();
  return { data: data ? { user: data.user } : null, status: isPending ? "loading" : error || !data ? "unauthenticated" : "authenticated" };
}
export const useSession = backendAuthEnabled ? useBackendSession : useLegacySession;

export async function signIn(provider: "credentials" | "google", options: { email?: string; password?: string; callbackUrl?: string; redirect?: boolean }) {
  if (!backendAuthEnabled) return options.redirect === false
    ? legacySignIn(provider, { ...options, callbackUrl: safeAuthRedirect(options.callbackUrl), redirect: false })
    : legacySignIn(provider, { ...options, callbackUrl: safeAuthRedirect(options.callbackUrl), redirect: true });
  const callbackURL = safeAuthRedirect(options.callbackUrl);
  if (provider === "google") {
    const result = await authClient.signIn.social({ provider: "google", callbackURL });
    if (result.error) throw new Error("Google sign-in failed");
    return { ok: true, error: undefined };
  }
  const result = await authClient.signIn.email({ email: options.email ?? "", password: options.password ?? "" });
  return { ok: !result.error, error: result.error?.code };
}

export async function signOut(options: { callbackUrl: string }) {
  if (!backendAuthEnabled) return legacySignOut(options);
  const result = await authClient.signOut();
  if (result.error) throw new Error("Sign-out failed");
  window.location.assign(safeAuthRedirect(options.callbackUrl));
}

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { backendAuthEnabled } from "@/lib/auth-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "../components/auth-shell";

export function RecoveryForm({ mode, searchParams }: { mode: "reset" | "request" | "verify"; searchParams: Promise<{ token?: string; error?: string }> }) {
  const params = use(searchParams);
  const [token] = useState(params.token);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (mode === "reset" && token) window.history.replaceState(null, "", "/reset-password");
  }, [mode, token]);
  const title = mode === "reset" ? "Set a new password" : mode === "verify" ? "Resend verification" : "Reset your password";
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    try {
      const result = mode === "reset" ? await authClient.resetPassword({ token, newPassword: password })
        : mode === "verify" ? await authClient.sendVerificationEmail({ email, callbackURL: "/sign-in" })
          : await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (result.error) { setError("Unable to complete this request. Wait a minute and try again; expired links need to be requested again."); return; }
      setMessage(mode === "reset" ? "Your password has been reset. Sign in with your new password."
        : "If your account is eligible, you will receive an email. Check your inbox and spam folder; wait a minute before requesting another.");
      setDone(true);
    } catch { setError("The service is unavailable. Please try again later."); }
    finally { setPending(false); }
  }
  const valid = backendAuthEnabled && (mode !== "reset" || !!token && !params.error);
  return <AuthShell><Card><CardContent className="space-y-5">
    <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
    {!valid ? <p>This link is unavailable or expired. Request a new link after authentication is enabled.</p> :
      !done && <form onSubmit={submit} className="space-y-4">
        <Label htmlFor="recovery-input">{mode === "reset" ? "New password" : "Email"}</Label>
        <Input id="recovery-input" required type={mode === "reset" ? "password" : "email"}
          minLength={mode === "reset" ? 8 : undefined} maxLength={mode === "reset" ? 200 : undefined}
          autoComplete={mode === "reset" ? "new-password" : "email"} disabled={pending}
          value={mode === "reset" ? password : email} onChange={(event) => mode === "reset" ? setPassword(event.target.value) : setEmail(event.target.value)} />
        <Button type="submit" disabled={pending}>{pending ? "Please wait…" : mode === "reset" ? "Save password" : "Send email"}</Button>
      </form>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Link href="/sign-in" className="text-sm underline">Back to sign in</Link>
  </CardContent></Card></AuthShell>;
}

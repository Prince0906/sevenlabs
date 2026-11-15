"use client";

import { authClient, signIn } from "@/lib/auth-client";
import { backendAuthEnabled, safeAuthRedirect } from "@/lib/auth-mode";
import { use, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "../components/auth-shell";

interface Props {
  searchParamsPromise: Promise<{ callbackUrl?: string }>;
}

export function SignUpForm({ searchParamsPromise }: Props) {
  const { callbackUrl = "/interview" } = use(searchParamsPromise);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (backendAuthEnabled) {
        const result = await authClient.signUp.email({ name: name.trim() || "Aloud user", email, password, callbackURL: "/sign-in" });
        if (result.error) setError("Unable to create your account. Try again or request a verification email.");
        else setVerificationSent(true);
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body?.error ?? "Sign-up failed");
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.ok) {
        window.location.href = safeAuthRedirect(callbackUrl);
      } else {
        setError("Account created, but sign-in failed. Try signing in manually.");
      }
    } catch {
      setError("Sign-up failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Start practicing in under a minute.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={async () => {
              try {
                await signIn("google", { callbackUrl });
              } catch {
                setError("Google sign-up failed. Please try again.");
              }
            }}
          >
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {verificationSent ? <p role="status">Check your inbox for a verification link before signing in. If it does not arrive, <Link href="/verify-email" className="underline">request another email</Link>.</p> : <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              {pending ? "Creating account" : "Create account"}
            </Button>
          </form>}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

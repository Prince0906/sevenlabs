"use client";

import { signIn } from "next-auth/react";
import { use, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "./auth-shell";

interface Props {
  searchParamsPromise: Promise<{ callbackUrl?: string; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  OAuthAccountNotLinked:
    "This email is already in use with a different sign-in method.",
  Default: "Sign-in failed. Please try again.",
};

export function SignInForm({ searchParamsPromise }: Props) {
  const { callbackUrl = "/dashboard", error: queryError } =
    use(searchParamsPromise);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    queryError ? (ERROR_MESSAGES[queryError] ?? ERROR_MESSAGES.Default) : null
  );

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(ERROR_MESSAGES.CredentialsSignin);
        return;
      }
      if (res?.ok) {
        window.location.href = callbackUrl;
      }
    } catch {
      setError(ERROR_MESSAGES.Default);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell>
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Pick up where you left off.
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
                setError(ERROR_MESSAGES.Default);
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

          <form onSubmit={handleCredentials} className="space-y-4">
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              {pending ? "Signing in" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

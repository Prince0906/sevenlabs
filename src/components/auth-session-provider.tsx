"use client";

import { SessionProvider } from "next-auth/react";
import { backendAuthEnabled } from "@/lib/auth-mode";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return backendAuthEnabled ? children : <SessionProvider>{children}</SessionProvider>;
}

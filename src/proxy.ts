import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse, type NextRequest } from "next/server";
import { backendAuthEnabled } from "@/lib/auth-mode";
import { readBackendSession } from "@/lib/backend-session";

const { auth } = NextAuth(authConfig);

async function backendProxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/api/health"].includes(path)
    || path.startsWith("/api/auth/")) return NextResponse.next();
  try {
    if (await readBackendSession(request.headers.get("cookie") ?? "")) return NextResponse.next();
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = new URL("/sign-in", request.url);
    login.searchParams.set("callbackUrl", path + request.nextUrl.search);
    return NextResponse.redirect(login);
  } catch { return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 }); }
}

export const proxy = backendAuthEnabled ? backendProxy : auth;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

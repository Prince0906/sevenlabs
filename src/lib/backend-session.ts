import { z } from "zod";

const sessionSchema = z.object({ user: z.object({ id: z.string(), email: z.string(), name: z.string().nullable() }) });

/** Server-only request helper: private fixed API origin, cookies only, no cache. */
export async function readBackendSession(cookie: string) {
  const origin = new URL(process.env.AUTH_API_INTERNAL_URL ?? "http://127.0.0.1:3001");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash
    || !["http:", "https:"].includes(origin.protocol)) throw new Error("Invalid internal auth origin");
  const response = await fetch(new URL("/api/user/session", origin), {
    headers: { cookie }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Authentication service unavailable");
  return sessionSchema.parse(await response.json());
}

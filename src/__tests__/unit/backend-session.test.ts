import { afterEach, describe, expect, it, vi } from "vitest";
import { readBackendSession } from "@/lib/backend-session";
import { safeAuthRedirect } from "@/lib/auth-mode";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("web backend session boundary", () => {
  it("forwards only the cookie to the configured private API without caching", async () => {
    vi.stubEnv("AUTH_API_INTERNAL_URL", "http://127.0.0.1:3001");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: "u1", email: "u@example.com", name: null, secret: "not-for-web" }, token: "not-for-web" })));
    vi.stubGlobal("fetch", fetcher);
    expect(await readBackendSession("aloud.session_token=test")).toEqual({ user: { id: "u1", email: "u@example.com", name: null } });
    expect(String(fetcher.mock.calls[0][0])).toBe("http://127.0.0.1:3001/api/user/session");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { cookie: "aloud.session_token=test" }, cache: "no-store", redirect: "error" });
  });
  it("distinguishes anonymous users from backend failure", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await readBackendSession("")).toBeNull();
    await expect(readBackendSession("")).rejects.toThrow("Authentication service unavailable");
  });
  it("rejects credential-bearing internal URLs", async () => {
    vi.stubEnv("AUTH_API_INTERNAL_URL", "http://user:secret@localhost:3001");
    await expect(readBackendSession("")).rejects.toThrow("Invalid internal auth origin");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/\nevil"])("rejects external redirect %s", (url) => {
    expect(safeAuthRedirect(url)).toBe("/dashboard");
  });
  it("retains a local return path", () => { expect(safeAuthRedirect("/interview?id=1")).toBe("/interview?id=1"); });
});

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@sevenlabs/backend/infrastructure/db", () => ({ prisma: db }));
vi.mock("@sevenlabs/backend/infrastructure/crypto", () => ({ isByokConfigured: () => false }));
vi.mock("@sevenlabs/backend/infrastructure/log", () => ({ log: { error: vi.fn() } }));
import { buildServer } from "../../../apps/api/src/server";

const server = buildServer();
afterAll(() => server.close());
afterEach(() => vi.clearAllMocks());

describe("dedicated API health boundary", () => {
  it.each(["true", "1", "0.0.0.0/0", "loopback", ""])("rejects unsafe proxy configuration %s", (trustedProxyIp) => {
    expect(() => buildServer({ trustedProxyIp })).toThrow("one explicit proxy IP");
  });

  it("trusts only the immediate configured proxy and ignores forged forwarding chains", async () => {
    const proxied = buildServer({ trustedProxyIp: "192.0.2.10" });
    proxied.get("/test-peer", (request) => ({ ip: request.ip }));
    try {
      const trusted = await proxied.inject({ url: "/test-peer", remoteAddress: "192.0.2.10", headers: { "x-forwarded-for": "203.0.113.99, 198.51.100.1" } });
      expect(trusted.json()).toEqual({ ip: "198.51.100.1" });
      const untrusted = await proxied.inject({ url: "/test-peer", remoteAddress: "198.51.100.2", headers: { "x-forwarded-for": "203.0.113.99" } });
      expect(untrusted.json()).toEqual({ ip: "198.51.100.2" });
    } finally { await proxied.close(); }
  });

  it("provides cheap liveness without accessing the database", async () => {
    const response = await server.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "alive" });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it("matches the existing readiness response when the database is available", async () => {
    db.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const response = await server.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({ status: "healthy", db: true, byok: false });
  });
  it("returns unavailable without leaking database errors", async () => {
    db.$queryRaw.mockRejectedValue(new Error("private database details"));
    const response = await server.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "unavailable", db: false });
    expect(response.body).not.toContain("private database details");
  });
  it("does not silently serve product routes before their migration", async () => {
    expect((await server.inject({ method: "POST", url: "/api/interview/sessions", payload: {} })).statusCode).toBe(404);
  });
});

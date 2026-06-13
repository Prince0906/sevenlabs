import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({ user: { delete: vi.fn() } }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { auth } from "@/lib/auth";
import { DELETE } from "@/app/api/user/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  mockPrisma.user.delete.mockResolvedValue({ id: "u1" });
});

describe("DELETE /api/user (account + data deletion)", () => {
  it("401 when unauthenticated (no delete)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes ONLY the authenticated user (cascades the rest)", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("500 (not a leak) when the delete throws", async () => {
    mockPrisma.user.delete.mockRejectedValue(new Error("fk"));
    const res = await DELETE();
    expect(res.status).toBe(500);
  });
});

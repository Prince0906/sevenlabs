import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/generations/route";

const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    generation: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { auth } from "@clerk/nextjs/server";
const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/generations", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ orgId: null } as never);

    const req = new Request("http://localhost/api/generations");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns paginated generations", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const generations = [
      {
        id: "g1",
        text: "Hello",
        voiceName: "Rachel",
        r2ObjectKey: "gen_1.wav",
        createdAt: new Date(),
      },
      {
        id: "g2",
        text: "World",
        voiceName: "Adam",
        r2ObjectKey: "gen_2.wav",
        createdAt: new Date(),
      },
    ];
    mockFindMany.mockResolvedValue(generations);
    mockCount.mockResolvedValue(2);

    const req = new Request("http://localhost/api/generations?page=1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.generations).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.totalPages).toBe(1);
  });

  it("maps r2ObjectKey to audioUrl", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    mockFindMany.mockResolvedValue([{ id: "g1", r2ObjectKey: "gen_test.wav" }]);
    mockCount.mockResolvedValue(1);

    const req = new Request("http://localhost/api/generations?page=1");
    const res = await GET(req);
    const body = await res.json();

    expect(body.generations[0].audioUrl).toBe("/audio/gen_test.wav");
  });

  it("returns null audioUrl when r2ObjectKey is missing", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    mockFindMany.mockResolvedValue([{ id: "g1", r2ObjectKey: null }]);
    mockCount.mockResolvedValue(1);

    const req = new Request("http://localhost/api/generations?page=1");
    const res = await GET(req);
    const body = await res.json();

    expect(body.generations[0].audioUrl).toBeNull();
  });

  it("calculates totalPages correctly", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(45);

    const req = new Request("http://localhost/api/generations?page=1");
    const res = await GET(req);
    const body = await res.json();

    expect(body.totalPages).toBe(3); // 45 / 20 = 2.25 -> ceil = 3
  });

  it("defaults to page 1 when no page param", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = new Request("http://localhost/api/generations");
    const res = await GET(req);
    const body = await res.json();

    expect(body.page).toBe(1);
  });

  it("scopes queries by orgId", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_456" } as never);

    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = new Request("http://localhost/api/generations");
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org_456" },
      })
    );
    expect(mockCount).toHaveBeenCalledWith({ where: { orgId: "org_456" } });
  });
});

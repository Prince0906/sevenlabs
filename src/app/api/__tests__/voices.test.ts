import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/voices/route";

const mockFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    voice: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import { auth } from "@clerk/nextjs/server";
const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/voices", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ orgId: null } as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns voices for authenticated org", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const voices = [
      { id: "v1", name: "Rachel", variant: "SYSTEM" },
      { id: "v2", name: "Custom", variant: "CUSTOM", orgId: "org_123" },
    ];
    mockFindMany.mockResolvedValue(voices);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(voices);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { OR: [{ variant: "SYSTEM" }, { orgId: "org_123" }] },
      orderBy: [{ variant: "asc" }, { name: "asc" }],
    });
  });
});

describe("POST /api/voices", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ orgId: null } as never);

    const req = new Request("http://localhost/api/voices", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const req = new Request("http://localhost/api/voices", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Name is required");
  });

  it("creates a custom voice with defaults", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const created = {
      id: "v3",
      name: "My Voice",
      orgId: "org_123",
      variant: "CUSTOM",
      category: "GENERAL",
      language: "en-US",
    };
    mockCreate.mockResolvedValue(created);

    const req = new Request("http://localhost/api/voices", {
      method: "POST",
      body: JSON.stringify({ name: "My Voice" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("My Voice");
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        orgId: "org_123",
        name: "My Voice",
        description: null,
        category: "GENERAL",
        language: "en-US",
        variant: "CUSTOM",
      },
    });
  });

  it("creates a voice with custom category and language", async () => {
    mockAuth.mockResolvedValue({ orgId: "org_123" } as never);

    const created = {
      id: "v4",
      name: "Podcast Voice",
      orgId: "org_123",
      variant: "CUSTOM",
      category: "PODCAST",
      language: "en-GB",
    };
    mockCreate.mockResolvedValue(created);

    const req = new Request("http://localhost/api/voices", {
      method: "POST",
      body: JSON.stringify({
        name: "Podcast Voice",
        category: "PODCAST",
        language: "en-GB",
        description: "A podcast voice",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.category).toBe("PODCAST");
  });
});

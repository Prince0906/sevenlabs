import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
const mockCrypto = vi.hoisted(() => ({ isByokConfigured: vi.fn(() => true) }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crypto", () => mockCrypto);
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockCrypto.isByokConfigured.mockReturnValue(true);
});

describe("GET /api/health (readiness)", () => {
  it("200 healthy when the DB answers SELECT 1", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "healthy", db: true, byok: true });
  });

  it("503 when the DB is unreachable (a DB-less box is not healthy)", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "unavailable", db: false });
  });

  it("reports byok:false when key custody isn't configured (still 200)", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockCrypto.isByokConfigured.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ db: true, byok: false });
  });
});

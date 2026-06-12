import { describe, it, expect, vi, beforeEach } from "vitest";

// The daily kill-switch + its observability (C1). reserveGlobalSpend does an
// atomic add-if-under-cap; the trip was a silent 503 before — now it logs, and an
// 80% approach warns. DB + log are mocked (this is the I/O boundary, not pure math).

const mockPrisma = vi.hoisted(() => ({
  globalSpend: { upsert: vi.fn() },
  $queryRaw: vi.fn(),
}));
const mockLog = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/log", () => ({ log: mockLog }));
vi.mock("@/lib/env", () => ({ env: { DAILY_CAP_USD: 50 } }));

import { reserveGlobalSpend } from "@/lib/mock/spend";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.globalSpend.upsert.mockResolvedValue({});
});

describe("reserveGlobalSpend (daily kill-switch + observability)", () => {
  it("admits and stays quiet when well under the cap", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ estUsd: "10" }]); // 10/50 = 20%
    expect(await reserveGlobalSpend(2)).toBe(true);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("admits but WARNS once the day crosses 80% of the cap", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ estUsd: "42" }]); // 42/50 = 84%
    expect(await reserveGlobalSpend(2)).toBe(true);
    expect(mockLog.warn).toHaveBeenCalledWith(
      "daily spend cap 80% reached",
      expect.objectContaining({ estUsd: 42, capUsd: 50 })
    );
  });

  it("blocks AND logs the trip when the add would exceed the cap (no longer silent)", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]); // WHERE didn't match → no row
    expect(await reserveGlobalSpend(20)).toBe(false);
    expect(mockLog.warn).toHaveBeenCalledWith(
      "daily spend cap reached — admission blocked",
      expect.objectContaining({ holdUsd: 20, capUsd: 50 })
    );
  });
});

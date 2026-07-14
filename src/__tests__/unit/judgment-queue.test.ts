import { describe, it, expect, vi, beforeEach } from "vitest";

// The durable judgment queue: lease-claim a due job, run it, and on failure either
// retry (status→PENDING) or, once retries are exhausted, FAIL both the job and the
// session in one txn. The ONLY genuine stuck-RUNNING path is an uncaught crash /
// process death mid-runJudgment, recovered by the lease-expiry re-claim in
// claimNext (`RUNNING AND leaseUntil < now()`) — so the tests exercise re-claim +
// retry + exhaustion, not a release-on-throw mechanism the code doesn't have (D15).

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  judgmentJob: { update: vi.fn() },
  mockSession: { update: vi.fn() },
}));
const mockOrch = vi.hoisted(() => ({ runJudgment: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/mock/panel-orchestrator", () => mockOrch);
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@sevenlabs/panel-core", () => ({ redact: (s: string) => s }));

import { drainJudgmentQueue } from "@/lib/mock/judgment-queue";

/** claimNext returns these rows in order; an empty array ends the drain loop. */
function claimSequence(...rounds: Array<Array<{ sessionId: string; attempts: number }>>) {
  mockPrisma.$queryRaw.mockReset();
  for (const r of rounds) mockPrisma.$queryRaw.mockResolvedValueOnce(r);
  mockPrisma.$queryRaw.mockResolvedValue([]); // nothing else due
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockResolvedValue([]);
  mockPrisma.judgmentJob.update.mockResolvedValue({});
  mockPrisma.mockSession.update.mockResolvedValue({});
  mockOrch.runJudgment.mockResolvedValue(undefined);
});

describe("drainJudgmentQueue", () => {
  it("claims a due job, runs it, and marks it DONE on success", async () => {
    claimSequence([{ sessionId: "s1", attempts: 1 }]);
    await drainJudgmentQueue();
    expect(mockOrch.runJudgment).toHaveBeenCalledWith("s1");
    expect(mockPrisma.judgmentJob.update).toHaveBeenCalledWith({
      where: { sessionId: "s1" },
      data: { status: "DONE" },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled(); // no failure path
  });

  it("does nothing when no job is due", async () => {
    claimSequence([]);
    await drainJudgmentQueue();
    expect(mockOrch.runJudgment).not.toHaveBeenCalled();
    expect(mockPrisma.judgmentJob.update).not.toHaveBeenCalled();
  });

  it("retries (status→PENDING) when runJudgment throws below the attempt cap", async () => {
    claimSequence([{ sessionId: "s1", attempts: 1 }]);
    mockOrch.runJudgment.mockRejectedValueOnce(new Error("transient judge failure"));
    await drainJudgmentQueue();
    expect(mockPrisma.judgmentJob.update).toHaveBeenCalledWith({
      where: { sessionId: "s1" },
      data: { status: "PENDING", lastError: "transient judge failure" },
    });
    // a retry must NOT fail the session — the report isn't lost yet
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.mockSession.update).not.toHaveBeenCalled();
  });

  it("FAILs the job AND the session in one txn once retries are exhausted", async () => {
    claimSequence([{ sessionId: "s1", attempts: 3 }]); // 3rd attempt = at the cap
    mockOrch.runJudgment.mockRejectedValueOnce(new Error("judge down"));
    await drainJudgmentQueue();
    expect(mockPrisma.judgmentJob.update).toHaveBeenCalledWith({
      where: { sessionId: "s1" },
      data: { status: "FAILED", lastError: "judge down" },
    });
    expect(mockPrisma.mockSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "FAILED" },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1); // atomic
  });

  it("reprocesses a re-claimed expired-lease job (crash recovery, D15)", async () => {
    // A worker died mid-judgment; the job sat RUNNING until its lease expired, and
    // claimNext re-claimed it with attempts already bumped from the dead run. It must
    // run again and complete normally. (The `leaseUntil < now()` SQL predicate that
    // surfaces the row is exercised against the live DB, not unit-mocked here.)
    claimSequence([{ sessionId: "s1", attempts: 2 }]);
    await drainJudgmentQueue();
    expect(mockOrch.runJudgment).toHaveBeenCalledWith("s1");
    expect(mockPrisma.judgmentJob.update).toHaveBeenCalledWith({
      where: { sessionId: "s1" },
      data: { status: "DONE" },
    });
  });

  it("drains every due job in one pass until the queue is empty", async () => {
    claimSequence([{ sessionId: "s1", attempts: 1 }], [{ sessionId: "s2", attempts: 1 }]);
    await drainJudgmentQueue();
    expect(mockOrch.runJudgment).toHaveBeenCalledTimes(2);
    expect(mockOrch.runJudgment).toHaveBeenNthCalledWith(1, "s1");
    expect(mockOrch.runJudgment).toHaveBeenNthCalledWith(2, "s2");
  });
});

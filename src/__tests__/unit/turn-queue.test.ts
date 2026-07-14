import { describe, it, expect, vi } from "vitest";
import { createTurnQueue, type FinalizedTurn } from "@/features/interview/lib/turn-queue";
import type { TurnResult, TurnPostBody } from "@/features/interview/lib/api-client";
import type { TurnResponse } from "@sevenlabs/shared-types";

function turn(over: Partial<FinalizedTurn> = {}): FinalizedTurn {
  return { role: "USER", transcript: "x", seatId: null, words: [], ...over };
}
function ok(over: Partial<TurnResponse> = {}): TurnResult {
  return {
    kind: "ok",
    data: { turnId: "t", seq: 0, duplicate: false, metrics: null, ...over },
  };
}
function makePost(script: TurnResult[]) {
  const bodies: TurnPostBody[] = [];
  let i = 0;
  const post = vi.fn(async (body: TurnPostBody): Promise<TurnResult> => {
    bodies.push(body);
    return i < script.length ? script[i++]! : ok();
  });
  return { post, bodies };
}

describe("createTurnQueue", () => {
  it("assigns seq at dequeue: monotonic + gap-free across interleaved enqueues", async () => {
    const { post, bodies } = makePost([]);
    const q = createTurnQueue({ post, fetchMaxSeq: async () => -1, retryDelayMs: 0 });
    q.enqueue(turn({ role: "USER", transcript: "a" }));
    q.enqueue(turn({ role: "COACH", transcript: "b", seatId: "s1" }));
    q.enqueue(turn({ role: "USER", transcript: "c" }));
    await q.drainBeforeComplete();
    expect(bodies.map((b) => b.seq)).toEqual([0, 1, 2]);
    expect(bodies.map((b) => b.transcript)).toEqual(["a", "b", "c"]);
  });

  it("treats duplicate:true as a no-op commit (no double count) but still consumes seq", async () => {
    const committed: number[] = [];
    const { post, bodies } = makePost([ok({ duplicate: true }), ok()]);
    const q = createTurnQueue({
      post,
      fetchMaxSeq: async () => -1,
      retryDelayMs: 0,
      onCommitted: (t) => committed.push(t.seq),
    });
    q.enqueue(turn({ transcript: "a" }));
    q.enqueue(turn({ transcript: "b" }));
    await q.drainBeforeComplete();
    expect(bodies.map((b) => b.seq)).toEqual([0, 1]); // seq advanced past the duplicate
    expect(committed).toEqual([1]); // only the non-duplicate emitted onCommitted
  });

  it("retries a byte-identical frozen body on a transient error (same seq)", async () => {
    const { post, bodies } = makePost([{ kind: "error", status: 0, message: "net" }]);
    const q = createTurnQueue({ post, fetchMaxSeq: async () => -1, retryDelayMs: 0 });
    q.enqueue(turn({ transcript: "hello", seatId: "s1" }));
    await q.drainBeforeComplete();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toEqual(bodies[1]); // identical retry
    expect(bodies[0]!.seq).toBe(0);
  });

  it("on SEQ_CONFLICT re-reconciles nextSeq from /status and re-posts under a fresh seq", async () => {
    const { post, bodies } = makePost([{ kind: "seq-conflict" }]);
    const q = createTurnQueue({ post, fetchMaxSeq: async () => 4, retryDelayMs: 0 });
    q.enqueue(turn({ transcript: "x" }));
    await q.drainBeforeComplete();
    expect(bodies.map((b) => b.seq)).toEqual([0, 5]); // conflict at 0 → maxSeq 4 → seq 5
  });

  it("signals sessionExpired when a 200 carries sessionExpired:true", async () => {
    const onSessionExpired = vi.fn();
    const { post } = makePost([ok({ sessionExpired: true })]);
    const q = createTurnQueue({
      post,
      fetchMaxSeq: async () => -1,
      retryDelayMs: 0,
      onSessionExpired,
    });
    q.enqueue(turn({}));
    await q.drainBeforeComplete();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("posts the seatId snapshotted at enqueue, even if the active seat later advances", async () => {
    const { post, bodies } = makePost([]);
    const q = createTurnQueue({ post, fetchMaxSeq: async () => -1, retryDelayMs: 0 });
    q.enqueue(turn({ role: "COACH", transcript: "drill", seatId: "bar-raiser" }));
    await q.drainBeforeComplete();
    expect(bodies[0]!.seatId).toBe("bar-raiser");
    expect(bodies[0]!.role).toBe("COACH");
  });

  it("reconcileSeq advances the starting seq on resume (maxSeq+1)", async () => {
    const { post, bodies } = makePost([]);
    const q = createTurnQueue({ post, fetchMaxSeq: async () => -1, retryDelayMs: 0 });
    q.reconcileSeq(7); // server already holds up to seq 7
    q.enqueue(turn({ transcript: "after-resume" }));
    await q.drainBeforeComplete();
    expect(bodies[0]!.seq).toBe(8);
  });

  it("delivers every enqueued seat-2 COACH turn before complete (drill-depth invariant)", async () => {
    const { post, bodies } = makePost([]);
    const q = createTurnQueue({ post, fetchMaxSeq: async () => -1, retryDelayMs: 0 });
    for (let n = 0; n < 4; n++) {
      q.enqueue(turn({ role: "COACH", seatId: "br", transcript: `q${n}` }));
    }
    await q.drainBeforeComplete();
    const coach = bodies.filter((b) => b.role === "COACH" && b.seatId === "br");
    expect(coach).toHaveLength(4);
  });
});

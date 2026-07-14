import type { WordTimestamp, TurnEvents } from "@sevenlabs/shared-types";
import type { TurnResult, TurnPostBody } from "./api-client";

/**
 * The single-writer, in-order async commit queue that owns seq assignment and
 * idempotent retry for /turns. COACH turns are SCORING INPUTS (Bar Raiser drill
 * depth), so they are must-deliver/ordered exactly like USER turns.
 *
 * seq is assigned at DEQUEUE (not at event time): exactly one writer mutates
 * nextSeq, so two asynchronously-finalized turns can never read the same seq and
 * race a duplicate. The payload is frozen by the caller at enqueue; retries
 * replay the byte-identical body. seatId is snapshotted by the caller BEFORE a
 * handoff advances the active seat, so a late COACH .done from a torn-down peer
 * keeps the correct (old) seat.
 */
export interface FinalizedTurn {
  role: "USER" | "COACH";
  transcript: string;
  seatId: string | null;
  words: WordTimestamp[];
  events?: TurnEvents;
  /** USER turns only: the join key the fluency-audio upload uses to attach metrics. */
  clientTurnId?: string;
}

export interface TurnQueueOptions {
  /** Post one frozen turn body; returns the discriminated /turns result. */
  post: (body: TurnPostBody) => Promise<TurnResult>;
  /** Fetch the server's current maxSeq (GET /status) for seq reconciliation. */
  fetchMaxSeq: () => Promise<number>;
  /** Fired when a 200 carries sessionExpired:true (ceiling crossed). */
  onSessionExpired?: () => void;
  /** Fired once per genuinely-new committed turn (not duplicates). */
  onCommitted?: (turn: FinalizedTurn & { seq: number }) => void;
  /** Fired if an item is dropped after exhausting retries (degraded delivery). */
  onDeliveryError?: (turn: FinalizedTurn, lastResult: TurnResult) => void;
  retryDelayMs?: number;
  maxAttempts?: number;
}

export interface TurnQueue {
  enqueue: (turn: FinalizedTurn) => void;
  drainBeforeComplete: () => Promise<void>;
  reconcileSeq: (maxSeq: number) => void;
  pending: () => number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createTurnQueue(opts: TurnQueueOptions): TurnQueue {
  const retryDelayMs = opts.retryDelayMs ?? 400;
  const maxAttempts = opts.maxAttempts ?? 8;
  const queue: FinalizedTurn[] = [];
  let nextSeq = 0;
  let draining = false;
  let waiters: Array<() => void> = [];
  let headRef: FinalizedTurn | null = null;
  let headAttempts = 0;

  function fail(item: FinalizedTurn, result: TurnResult) {
    // Last resort after exhausting retries: drop so the queue can't hang, but
    // surface it — a lost COACH turn would corrupt the verdict.
    queue.shift();
    headRef = null;
    opts.onDeliveryError?.(item, result);
  }

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const item = queue[0]!;
        if (item !== headRef) {
          headRef = item;
          headAttempts = 0;
        }
        const seq = nextSeq;
        const body: TurnPostBody = {
          seq,
          role: item.role,
          seatId: item.seatId,
          transcript: item.transcript,
          words: item.words,
          events: item.events,
          clientTurnId: item.clientTurnId,
        };

        let result: TurnResult;
        try {
          result = await opts.post(body);
        } catch {
          result = { kind: "error", status: 0, message: "network" };
        }

        if (result.kind === "ok") {
          if (result.data.sessionExpired) opts.onSessionExpired?.();
          queue.shift();
          headRef = null;
          nextSeq = seq + 1; // seq consumed (duplicate:true means it already held identical content)
          if (!result.data.duplicate) opts.onCommitted?.({ ...item, seq });
          continue;
        }

        if (result.kind === "seq-conflict") {
          // Our seq collided with a DIFFERENT transcript: re-reconcile from the
          // server and re-post the SAME frozen item under a fresh seq. Items
          // behind it stamp at their own dequeue, so the queue self-repairs.
          let maxSeq = -1;
          try {
            maxSeq = await opts.fetchMaxSeq();
          } catch {
            /* keep current nextSeq, force progress below */
          }
          nextSeq = Math.max(nextSeq, maxSeq + 1);
          if (nextSeq <= seq) nextSeq = seq + 1;
          headAttempts += 1;
          if (headAttempts >= maxAttempts) fail(item, result);
          continue;
        }

        // not-live or transient error: retry the byte-identical body (same seq —
        // the post never landed). Bounded so drainBeforeComplete can't hang.
        headAttempts += 1;
        if (headAttempts >= maxAttempts) {
          fail(item, result);
          continue;
        }
        await sleep(retryDelayMs);
      }
    } finally {
      draining = false;
      if (queue.length === 0) {
        const w = waiters;
        waiters = [];
        w.forEach((fn) => fn());
      }
    }
  }

  return {
    enqueue(turn) {
      queue.push(turn);
      void drain();
    },
    reconcileSeq(maxSeq) {
      nextSeq = Math.max(nextSeq, maxSeq + 1);
    },
    pending() {
      return queue.length;
    },
    async drainBeforeComplete() {
      void drain();
      if (queue.length === 0 && !draining) return;
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
  };
}

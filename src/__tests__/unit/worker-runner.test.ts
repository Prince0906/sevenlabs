import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startWorkerLoop } from "../../../apps/worker/src/runner";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("standalone worker lifecycle", () => {
  it("runs at boot and waits until work finishes before scheduling another tick", async () => {
    let release!: () => void;
    const tick = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const loop = startWorkerLoop(tick, vi.fn(), 1000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    release();
    await loop.stop();
  });
  it("stops future claims and waits for the current tick before closing", async () => {
    let release!: () => void;
    const tick = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const loop = startWorkerLoop(tick, vi.fn(), 1000);
    const stopping = loop.stop();
    expect(tick.mock.calls[0]).toBeDefined();
    release();
    await stopping;
    await vi.advanceTimersByTimeAsync(5000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("survives an unavailable dependency and retries on the next tick", async () => {
    const tick = vi.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue(undefined);
    const onError = vi.fn();
    const loop = startWorkerLoop(tick, onError, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledTimes(2);
    await loop.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

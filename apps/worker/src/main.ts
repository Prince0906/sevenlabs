import { drainJudgmentQueue } from "@sevenlabs/backend/interviews/jobs";
import { reapRateBuckets } from "@sevenlabs/backend/usage/spend";
import { prisma } from "@sevenlabs/backend/infrastructure/db";
import { log } from "@sevenlabs/backend/infrastructure/log";
import { startWorkerLoop } from "./runner";

// Migration gate: do not accidentally compete with Next's embedded execution.
if (process.env.JUDGMENT_EXECUTION !== "worker") {
  throw new Error("Set JUDGMENT_EXECUTION=worker in BOTH web and worker before starting the standalone worker");
}

let lastReap = 0;
const loop = startWorkerLoop(async (signal) => {
  await drainJudgmentQueue(signal);
  if (!signal.aborted && Date.now() - lastReap >= 300_000) {
    await reapRateBuckets();
    lastReap = Date.now();
  }
}, (error) => log.error("worker tick failed", error));
log.info("judgment worker started");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  // Finish the current job when possible; on forced exit its DB lease expires.
  const deadline = setTimeout(() => process.exit(1), 110_000).unref();
  try {
    await loop.stop();
    await prisma.$disconnect();
  } catch (error) {
    log.error("worker shutdown failed", error);
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());

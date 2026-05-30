/**
 * Next runs register() once per server process at boot. We start the durable
 * judgment sweeper here (Node runtime only) so a redeploy that strands a
 * DEBRIEF session — its `after()` drain died with the old process — gets
 * re-claimed by the boot sweep + interval. SYSTEM_DESIGN §14.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startJudgmentSweeper } = await import("@/lib/mock/judgment-queue");
  startJudgmentSweeper();
}

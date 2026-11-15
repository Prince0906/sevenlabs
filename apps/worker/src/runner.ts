/** One loop per worker; never overlap a slow tick with the next scheduled tick. */
export function startWorkerLoop(
  tick: (signal: AbortSignal) => Promise<void>,
  onError: (error: unknown) => void,
  intervalMs = 5000,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void>;

  async function run() {
    try {
      await tick(controller.signal);
    } catch (error) {
      onError(error);
    } finally {
      if (!controller.signal.aborted) {
        timer = setTimeout(() => { active = run(); }, intervalMs);
      }
    }
  }
  active = run();
  return {
    async stop() {
      controller.abort();
      clearTimeout(timer);
      await active;
    },
  };
}

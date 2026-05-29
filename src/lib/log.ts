import { redact, redactUnknown } from "@sevenlabs/coach-core";

/**
 * The single chokepoint for writing to stdout. Every line is structured JSON
 * and routed through `redact()` so a provider key can never leak into logs
 * (the BYOK/realtime hot path handles users' and Aloud's keys). Prefer this
 * over `console.*` in app code; a `no-console` lint rule will enforce it once
 * the existing call sites are migrated.
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: unknown): void {
  const entry: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    msg: redact(msg),
  };
  if (meta !== undefined) entry.meta = redactUnknown(meta);
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};

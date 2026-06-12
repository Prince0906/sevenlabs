/**
 * Redact provider secrets from any string before it is logged or surfaced in an
 * error. Pure (no I/O) so it lives in coach-core and can be unit-tested in
 * isolation. Masks each secret to a non-reversible fingerprint that keeps only
 * the prefix + last 4 chars, e.g. `sk-…a1b2`.
 *
 * Covers: OpenAI (`sk-…`), Anthropic (`sk-ant-…`), Google (`AIza…`), OpenAI
 * Realtime ephemerals (`ek_…`), and `Authorization: Bearer <token>`.
 *
 * Bearer is matched first so a `Bearer sk-…` header collapses as one token;
 * `sk-ant-` is matched before `sk-` so it keeps its specific label.
 */
const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /Bearer\s+[A-Za-z0-9._-]{8,}/g, label: "Bearer " },
  { re: /sk-ant-[A-Za-z0-9_-]{8,}/g, label: "sk-ant-" },
  { re: /sk-[A-Za-z0-9_-]{12,}/g, label: "sk-" },
  { re: /ek_[A-Za-z0-9_-]{8,}/g, label: "ek_" },
  { re: /AIza[A-Za-z0-9_-]{10,}/g, label: "AIza" },
];

export function redact(input: string): string {
  let out = input;
  for (const { re, label } of PATTERNS) {
    out = out.replace(re, (match) => `${label}…${match.slice(-4)}`);
  }
  return out;
}

/** Redact any value (Error, object, primitive) into a safe string for logging. */
export function redactUnknown(value: unknown): string {
  if (value instanceof Error) {
    // The stack's first line IS "name: message", and the frames below can carry a
    // secret too (a thrown URL/header), so redact the whole stack — not just the
    // message — and keep it for debuggability. Fall back when there's no stack. (C4)
    return redact(value.stack ?? `${value.name}: ${value.message}`);
  }
  if (typeof value === "string") return redact(value);
  try {
    return redact(JSON.stringify(value));
  } catch {
    return "[unserializable]";
  }
}

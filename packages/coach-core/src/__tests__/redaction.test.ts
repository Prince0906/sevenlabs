import { describe, it, expect } from "vitest";
import { redact, redactUnknown } from "../redaction";

const SECRETS = {
  openai: "sk-proj-ABCDEFGHIJ1234567890abcdef",
  anthropic: "sk-ant-api03-ZYXWVUTSRQ0987654321zyxw",
  google: "AIzaSyD-EXAMPLEKEY1234567890abcdEF",
  ephemeral: "ek_EPHEMERALabc123def456",
};

describe("redact", () => {
  it("masks every provider secret to prefix + last4, dropping the body", () => {
    for (const secret of Object.values(SECRETS)) {
      const out = redact(`token=${secret} end`);
      // the secret's body must not survive
      expect(out).not.toContain(secret);
      // only the last 4 chars are kept
      expect(out).toContain(secret.slice(-4));
      expect(out).toContain("…");
    }
  });

  it("collapses an Authorization: Bearer header", () => {
    const out = redact(`Authorization: Bearer ${SECRETS.openai}`);
    expect(out).not.toContain(SECRETS.openai);
    expect(out).toContain("Bearer …");
  });

  it("keeps the sk-ant- label distinct from sk-", () => {
    expect(redact(SECRETS.anthropic)).toContain("sk-ant-…");
  });

  it("no live-looking key prefix survives in the output", () => {
    const text = Object.values(SECRETS).join(" ") + " Bearer " + SECRETS.openai;
    const out = redact(text);
    expect(/sk-[A-Za-z0-9_-]{12,}/.test(out)).toBe(false);
    expect(/AIza[A-Za-z0-9_-]{10,}/.test(out)).toBe(false);
    expect(/ek_[A-Za-z0-9_-]{8,}/.test(out)).toBe(false);
  });

  it("leaves non-secret text untouched", () => {
    expect(redact("the task-force shipped on time")).toBe(
      "the task-force shipped on time"
    );
  });
});

describe("redactUnknown", () => {
  it("redacts an Error message carrying a key", () => {
    const out = redactUnknown(new Error(`401 from provider: ${SECRETS.openai}`));
    expect(out).not.toContain(SECRETS.openai);
  });

  it("redacts a secret in the STACK frames, not only the message, and keeps the trace", () => {
    const err = new Error("request failed");
    err.stack = `Error: request failed\n    at fetch (https://api?key=${SECRETS.openai})`;
    const out = redactUnknown(err);
    expect(out).not.toContain(SECRETS.openai);
    expect(out).toContain("at fetch"); // the trace is preserved (redacted) for debugging
  });

  it("redacts a nested object", () => {
    const out = redactUnknown({ headers: { authorization: `Bearer ${SECRETS.openai}` } });
    expect(out).not.toContain(SECRETS.openai);
  });

  it("never throws on unserializable input", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => redactUnknown(circular)).not.toThrow();
  });
});

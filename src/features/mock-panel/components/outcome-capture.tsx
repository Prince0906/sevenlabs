"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import * as api from "../lib/mock-api";
import type { OutcomeResult } from "../lib/mock-api";

const OPTIONS: { result: OutcomeResult; label: string; tone: "good" | "bad" | "neutral" }[] = [
  { result: "OFFER", label: "Got the offer", tone: "good" },
  { result: "ADVANCED", label: "Moved forward", tone: "good" },
  { result: "REJECTED", label: "Rejected", tone: "bad" },
  { result: "GHOSTED", label: "No response", tone: "neutral" },
  { result: "PENDING", label: "Still waiting", tone: "neutral" },
];

const RESULT_LABEL: Record<OutcomeResult, string> = {
  OFFER: "Got the offer",
  ADVANCED: "Moved forward",
  REJECTED: "Rejected",
  GHOSTED: "No response",
  PENDING: "Still waiting",
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Outcome capture (D13) — the real hire/no-hire label, the one signal a foundation
 * model can't manufacture. Rendered on the RETURNING-visit report (not right after
 * the mock, when the real interview hasn't happened yet). Candidate-side, kept off
 * the credential, framed low-pressure as "check the panel's call against what really
 * happened." Offers the unresolved states (No response / Still waiting) so the moat
 * data isn't biased to only the resolved wins and losses.
 */
export function OutcomeCapture({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "prompt"; company: string | null }
    | { kind: "saving"; company: string | null }
    | { kind: "captured"; result: OutcomeResult }
  >({ kind: "loading" });

  useEffect(() => {
    let stopped = false;
    void api.getOutcome(sessionId).then((r) => {
      if (stopped) return;
      setState(
        r.outcome
          ? { kind: "captured", result: r.outcome.result }
          : { kind: "prompt", company: r.company }
      );
    });
    return () => {
      stopped = true;
    };
  }, [sessionId]);

  if (state.kind === "loading") return null;

  if (state.kind === "captured") {
    return (
      <div className="rounded-lg border border-border/70 bg-card px-4 py-3 text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground/85">Outcome logged:</span>{" "}
        {RESULT_LABEL[state.result]}.
        <button
          type="button"
          className="ml-2 underline underline-offset-2 hover:text-foreground"
          onClick={() => setState({ kind: "prompt", company: null })}
        >
          change
        </button>
      </div>
    );
  }

  const company = state.company;
  const saving = state.kind === "saving";
  const submit = async (result: OutcomeResult) => {
    setState({ kind: "saving", company });
    const ok = await api.submitOutcome(sessionId, result);
    setState(ok ? { kind: "captured", result } : { kind: "prompt", company });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-l-2 border-l-primary px-5 py-5"
      style={{ backgroundColor: "color-mix(in oklch, var(--primary) 8%, var(--card))" }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-primary">Close the loop</p>
      <h3 className="mt-1.5 font-display text-lg font-semibold tracking-tight">
        {company ? `Did you hear back from ${titleCase(company)}?` : "Did you hear back?"}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        This is the one thing the panel can&apos;t see: how its call held up against what
        actually happened. It stays private to you, and it&apos;s how the next prediction gets sharper.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" aria-busy={saving}>
        {OPTIONS.map((o) => (
          <button
            key={o.result}
            type="button"
            disabled={saving}
            onClick={() => submit(o.result)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50",
              o.tone === "good" && "border-signal-senior/40 text-signal-senior hover:bg-signal-senior/10",
              o.tone === "bad" && "border-signal-newgrad/40 text-signal-newgrad hover:bg-signal-newgrad/10",
              o.tone === "neutral" && "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </motion.section>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export interface PendingOutcome {
  id: string;
  company: string;
  endedAtIso: string | null;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Dashboard nudge for the D13 capture funnel: surfaces COMPLETED panels that have
 * no real-outcome label yet, and links each to its report (where the capture card
 * lives). This is the DISCOVERY half — without it the candidate would have to think
 * to revisit an old report to close the loop. Low-pressure; the report itself offers
 * the "Still waiting" / "No response" states so an unresolved interview isn't a
 * dead end.
 */
export function PendingOutcomesCard({ sessions }: { sessions: PendingOutcome[] }) {
  if (sessions.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-l-2 border-l-primary px-5 py-5"
      style={{ backgroundColor: "color-mix(in oklch, var(--primary) 8%, var(--card))" }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-primary">Close the loop</p>
      <h2 className="mt-1.5 font-display text-lg font-semibold tracking-tight">
        How did your real interviews go?
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        The real result is the one thing your panel can&apos;t see — and the one thing that makes its
        next call sharper. It stays private to you.
      </p>
      <ul className="mt-4 space-y-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/mock/${s.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
            >
              Report your result for {titleCase(s.company)}
              <span aria-hidden>&rarr;</span>
            </Link>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

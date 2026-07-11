"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { pageTransition } from "@/lib/motion";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * First-impression / conversion surface. The brand panel (left) is the same
 * daylight world as the app — paper, ink edges, the signal trio only where it
 * means level. The form panel (right) stays calm for the action itself.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden border-r border-border bg-secondary/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="relative z-10 flex items-center gap-2">
          <Logo />
        </Link>

        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="relative z-10 max-w-md space-y-8"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Interview prep, out loud
          </p>
          <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight xl:text-4xl">
            Get judged before it counts.
          </h2>

          <SignalShowcase />

          <p className="text-sm leading-relaxed text-muted-foreground">
            Three interviewers, live, by voice. A committee verdict tells you
            whether you read as New Grad, SDE II, or Senior — and the one gap
            to close next.
          </p>
        </motion.div>

        <p className="relative z-10 text-xs text-muted-foreground">
          Get to Senior signal before your interview day.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="w-full max-w-sm space-y-6"
        >
          <Link
            href="/"
            className="flex items-center justify-center gap-2 lg:hidden"
          >
            <Logo />
          </Link>

          {children}
        </motion.div>
      </div>
    </div>
  );
}

const TRIO = [
  "var(--signal-newgrad)",
  "var(--signal-sde2)",
  "var(--signal-senior)",
];

/**
 * Product proof: the leadership-signal readout, as a game piece. The level
 * meter is three hard-stop bands with a pin — never a blended gradient.
 */
function SignalShowcase() {
  return (
    <div className="piece p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Leadership signal
        </span>
        <span className="rounded-full bg-signal-senior/15 px-2.5 py-0.5 text-xs font-semibold text-signal-senior">
          Senior
        </span>
      </div>

      <div className="relative mt-4 flex h-2 gap-1">
        {TRIO.map((c, i) => (
          <span
            key={c}
            className="h-full flex-1 rounded-full"
            style={{ backgroundColor: c, opacity: i === 2 ? 1 : 0.25 }}
          />
        ))}
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground"
          style={{ left: `${(5 * 100) / 6}%`, backgroundColor: TRIO[2] }}
        />
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span>New Grad</span>
        <span>SDE II</span>
        <span className="font-semibold text-foreground">Senior</span>
      </div>

      <div className="mt-4 border-l-2 border-signal-senior pl-3">
        <p className="text-sm font-medium">Ownership</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          &ldquo;I owned the migration end-to-end and cut p99 latency by
          40%.&rdquo;
        </p>
      </div>
    </div>
  );
}

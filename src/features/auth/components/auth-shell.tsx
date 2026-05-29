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
 * Immersive brand panel for the first-impression / conversion surface. The
 * Signal palette (amber → blue → emerald) appears here as atmosphere + a
 * product visual — color where it sells. The form panel (right) stays calm
 * and high-contrast for the action itself.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ backgroundColor: "oklch(0.19 0.012 60)" }}
      >
        {/* Colored atmosphere — the brand's signal palette as soft glows */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-80 rounded-full bg-signal-senior/30 blur-[110px]" />
          <div className="absolute -right-16 top-1/3 size-80 rounded-full bg-signal-sde2/25 blur-[120px]" />
          <div className="absolute -bottom-28 left-1/3 size-80 rounded-full bg-signal-newgrad/25 blur-[110px]" />
        </div>

        <Link href="/" className="relative z-10 flex items-center gap-2">
          <Logo className="text-white" />
        </Link>

        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="relative z-10 max-w-md space-y-8"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">
            Interview prep, out loud
          </p>
          <h2 className="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-white xl:text-4xl">
            Practice your FAANG behavioral answers and hear exactly where you
            lost the interviewer.
          </h2>

          <SignalShowcase />

          <p className="text-sm leading-relaxed text-white/65">
            Every answer is scored against the company&rsquo;s actual rubric.
            You see whether you read as New Grad, SDE II, or Senior — not just
            whether you said &ldquo;um.&rdquo;
          </p>
        </motion.div>

        <p className="relative z-10 text-xs text-white/45">
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

/**
 * Product proof: the leadership-signal readout that no competitor offers,
 * rendered with the full amber → blue → emerald progression so the brand's
 * color language is the first thing a visitor sees.
 */
function SignalShowcase() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
          Leadership signal
        </span>
        <span className="rounded-full bg-signal-senior/15 px-2.5 py-0.5 text-xs font-semibold text-signal-senior">
          Senior
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 text-center text-[11px]">
        <span className="text-signal-newgrad">New Grad</span>
        <span className="text-signal-sde2">SDE II</span>
        <span className="font-semibold text-signal-senior">Senior</span>
      </div>
      <div
        className="mt-2 h-1 rounded-full"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--signal-newgrad), var(--signal-sde2), var(--signal-senior))",
        }}
      />

      <div className="mt-4 border-l-2 border-signal-senior/50 pl-3">
        <p className="text-sm font-medium text-white">Ownership</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/55">
          &ldquo;I owned the migration end-to-end and cut p99 latency by
          40%.&rdquo;
        </p>
      </div>
    </div>
  );
}

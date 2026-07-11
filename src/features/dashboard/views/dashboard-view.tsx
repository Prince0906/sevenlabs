"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { SignalLevel } from "@sevenlabs/shared-types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { pageTransition } from "@/lib/motion";
import { SIGNAL_LABEL } from "@/lib/signal";
import { CockpitGreeting } from "@/features/dashboard/components/cockpit-greeting";
import {
  PendingOutcomesCard,
  type PendingOutcome,
} from "@/features/dashboard/components/pending-outcomes-card";

export interface RecentPanel {
  id: string;
  company: string;
  title: string;
  endedAtIso: string | null;
  overallSignal: SignalLevel | null;
  passed: boolean | null;
}

interface DashboardViewProps {
  targetCompany: string;
  daysToInterview: number | null;
  interviewDateIso: string | null;
  hasPanels: boolean;
  pendingOutcomes: PendingOutcome[];
  recentPanels: RecentPanel[];
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function DashboardView({
  targetCompany,
  daysToInterview,
  interviewDateIso,
  hasPanels,
  pendingOutcomes,
  recentPanels,
}: DashboardViewProps) {
  // First-run: a brand-new user (no panels yet) gets one confident invitation
  // into the live room, not an empty cockpit.
  if (!hasPanels) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Dashboard" className="lg:hidden" />
        <div className="flex-1 overflow-y-auto">
          <motion.div
            variants={pageTransition}
            initial="initial"
            animate="animate"
            className="mx-auto max-w-5xl space-y-10 p-6 lg:p-12"
          >
            <CockpitGreeting
              targetCompany={targetCompany}
              daysToInterview={daysToInterview}
              interviewDateIso={interviewDateIso}
            />
            <div className="rounded-xl border bg-card p-8 text-center sm:p-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Your first interview
              </p>
              <h2 className="mx-auto mt-3 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Step into the room when you&apos;re ready.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                A live, three-interviewer panel scores you against the real bar, and
                shows you exactly where you stand. About 15 minutes.
              </p>
              <Button size="xl" asChild className="mt-7">
                <Link href="/mock">Start my first panel</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Dashboard" className="lg:hidden" />

      <div className="flex-1 overflow-y-auto">
        <motion.div
          variants={pageTransition}
          initial="initial"
          animate="animate"
          className="mx-auto max-w-5xl space-y-10 p-6 lg:p-12"
        >
          <CockpitGreeting
            targetCompany={targetCompany}
            daysToInterview={daysToInterview}
            interviewDateIso={interviewDateIso}
          />

          <PendingOutcomesCard sessions={pendingOutcomes} />

          <div className="flex flex-col items-start gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Next session
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                Run another Bar-Raiser panel
              </h2>
              <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
                A live, three-interviewer panel scored against the real bar. About 15 minutes.
              </p>
            </div>
            <Button size="lg" asChild className="shrink-0">
              <Link href="/mock">Start a panel</Link>
            </Button>
          </div>

          {recentPanels.length > 0 && (
            <section>
              <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Recent panels
              </h3>
              <ul className="mt-4 space-y-2">
                {recentPanels.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/mock/${p.id}`}
                      className="group flex items-center justify-between rounded-lg border bg-card px-5 py-4 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {titleCase(p.company)}
                          {p.title ? ` · ${p.title}` : ""}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {formatDate(p.endedAtIso)}
                          {p.overallSignal
                            ? ` · Read as ${SIGNAL_LABEL[p.overallSignal]}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Future gamified widgets (daily streak, story bank) land here once
              they have real backing data. The dashboard shows shipped features
              only; no "coming soon" tiles. */}
        </motion.div>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { pageTransition } from "@/lib/motion";
import type { CockpitData } from "@/lib/coach/aggregate-types";
import { masterySeniorLPs } from "@/lib/coach/aggregate-types";
import { CockpitGreeting } from "@/features/dashboard/components/cockpit-greeting";
import { StreakCard } from "@/features/dashboard/components/streak-card";
import { SignalCard } from "@/features/dashboard/components/signal-card";
import { StoriesCard } from "@/features/dashboard/components/stories-card";
import { TodaysDrillCard } from "@/features/dashboard/components/todays-drill-card";
import { WeekStats } from "@/features/dashboard/components/week-stats";
import { SignalTrendChart } from "@/features/dashboard/components/signal-trend-chart";
import {
  PendingOutcomesCard,
  type PendingOutcome,
} from "@/features/dashboard/components/pending-outcomes-card";

interface DashboardViewProps {
  data: CockpitData;
  hasPanels: boolean;
  interviewDateIso: string | null;
  pendingOutcomes: PendingOutcome[];
}

export function DashboardView({
  data,
  hasPanels,
  interviewDateIso,
  pendingOutcomes,
}: DashboardViewProps) {
  // First-run: a brand-new user (no panels yet) gets one confident invitation
  // into the live room, not a cockpit of empty em-dashes pointing at the
  // parked coach.
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
              targetCompany={data.targetCompany}
              daysToInterview={data.daysToInterview}
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
                A live, three-interviewer panel scores you against the real bar — and
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

  const seniorLPs = masterySeniorLPs(data.mastery);

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
            targetCompany={data.targetCompany}
            daysToInterview={data.daysToInterview}
            interviewDateIso={interviewDateIso}
          />

          <PendingOutcomesCard sessions={pendingOutcomes} />

          <div className="grid gap-3 sm:grid-cols-3">
            <StreakCard streakDays={data.streakDays} />
            <SignalCard
              current={data.signal.current}
              previous={data.signal.previous}
            />
            <StoriesCard />
          </div>

          <TodaysDrillCard
            lpName={data.drill.lpName}
            questionText={data.drill.questionText}
            estMinutes={data.drill.estMinutes}
            reason={data.drill.reason}
          />

          <WeekStats stats={data.weekStats} seniorLPs={seniorLPs} />

          <SignalTrendChart history={data.signal.history} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/practice"
              className="group flex items-center justify-between rounded-lg border bg-card px-5 py-4 transition-colors hover:bg-accent/40"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Practice
                </p>
                <p className="mt-0.5 text-sm font-medium">Open free practice</p>
              </div>
              <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="/practice/history"
              className="group flex items-center justify-between rounded-lg border bg-card px-5 py-4 transition-colors hover:bg-accent/40"
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  History
                </p>
                <p className="mt-0.5 text-sm font-medium">Recent sessions</p>
              </div>
              <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

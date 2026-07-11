import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DashboardView } from "@/features/dashboard/views/dashboard-view";

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const [user, pending, recent, panelCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { interviewDate: true, targetCompanies: true },
    }),
    // COMPLETED panels with no real-outcome label yet — the D13 capture funnel's
    // discovery surface. Bounded; the report page is where the label is entered.
    prisma.mockSession.findMany({
      where: { userId, status: "COMPLETED", outcome: { is: null } },
      select: { id: true, endedAt: true, scenario: { select: { company: true } } },
      orderBy: { endedAt: "desc" },
      take: 5,
    }),
    // Recent completed panels for the dashboard history strip.
    prisma.mockSession.findMany({
      where: { userId, status: "COMPLETED" },
      select: {
        id: true,
        endedAt: true,
        overallSignal: true,
        passed: true,
        scenario: { select: { company: true, title: true } },
      },
      orderBy: { endedAt: "desc" },
      take: 5,
    }),
    // Has this user ever run a panel? Drives the first-run zero-state — a
    // brand-new user gets one confident "start your first interview" hero.
    prisma.mockSession.count({ where: { userId } }),
  ]);

  return (
    <DashboardView
      targetCompany={user?.targetCompanies?.[0] ?? "amazon"}
      daysToInterview={daysUntil(user?.interviewDate)}
      interviewDateIso={user?.interviewDate?.toISOString() ?? null}
      hasPanels={panelCount > 0}
      pendingOutcomes={pending.map((s) => ({
        id: s.id,
        company: s.scenario.company,
        endedAtIso: s.endedAt?.toISOString() ?? null,
      }))}
      recentPanels={recent.map((s) => ({
        id: s.id,
        company: s.scenario.company,
        title: s.scenario.title,
        endedAtIso: s.endedAt?.toISOString() ?? null,
        overallSignal: s.overallSignal,
        passed: s.passed,
      }))}
    />
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCockpitData } from "@/lib/coach/aggregates";
import { DashboardView } from "@/features/dashboard/views/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const [data, user, pending] = await Promise.all([
    getCockpitData(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { interviewDate: true },
    }),
    // COMPLETED panels with no real-outcome label yet — the D13 capture funnel's
    // discovery surface. Bounded; the report page is where the label is entered.
    prisma.mockSession.findMany({
      where: { userId, status: "COMPLETED", outcome: { is: null } },
      select: { id: true, endedAt: true, scenario: { select: { company: true } } },
      orderBy: { endedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <DashboardView
      data={data}
      interviewDateIso={user?.interviewDate?.toISOString() ?? null}
      pendingOutcomes={pending.map((s) => ({
        id: s.id,
        company: s.scenario.company,
        endedAtIso: s.endedAt?.toISOString() ?? null,
      }))}
    />
  );
}

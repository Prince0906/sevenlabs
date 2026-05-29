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

  const [data, user] = await Promise.all([
    getCockpitData(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { interviewDate: true },
    }),
  ]);

  return (
    <DashboardView
      data={data}
      interviewDateIso={user?.interviewDate?.toISOString() ?? null}
    />
  );
}

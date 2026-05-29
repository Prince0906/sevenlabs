"use client";

import { useSession } from "next-auth/react";
import { SetInterviewDateDialog } from "./set-interview-date-dialog";
import { cn } from "@/lib/utils";

interface CockpitGreetingProps {
  targetCompany: string;
  daysToInterview: number | null;
  interviewDateIso: string | null;
}

function displayName(
  user: { name?: string | null; email?: string | null } | undefined
) {
  if (!user) return "there";
  if (user.name) return user.name.split(" ")[0];
  if (user.email) return user.email.split("@")[0];
  return "there";
}

const COMPANY_LABEL: Record<string, string> = {
  amazon: "Amazon",
};

export function CockpitGreeting({
  targetCompany,
  daysToInterview,
  interviewDateIso,
}: CockpitGreetingProps) {
  const { data, status } = useSession();
  const name = status === "loading" ? "" : displayName(data?.user);
  const companyName = COMPANY_LABEL[targetCompany] ?? targetCompany;
  const currentDate = interviewDateIso ? new Date(interviewDateIso) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {companyName} interview prep
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight lg:text-3xl">
            Welcome back{name ? `, ${name}` : ""}
          </h1>
        </div>
        <SetInterviewDateDialog currentDate={currentDate} />
      </div>

      {daysToInterview !== null && (
        <div className="flex items-baseline gap-3 border-t pt-6">
          <p
            className={cn(
              "font-display text-5xl font-semibold tracking-tight tabular-nums lg:text-6xl",
              daysToInterview <= 7 && "text-signal-newgrad"
            )}
          >
            {daysToInterview}
          </p>
          <p className="text-sm text-muted-foreground">
            {daysToInterview === 0
              ? "interview is today"
              : daysToInterview === 1
                ? "day to your interview"
                : "days to your interview"}
          </p>
        </div>
      )}
    </div>
  );
}

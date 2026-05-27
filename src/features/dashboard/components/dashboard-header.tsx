"use client";

import { useSession } from "next-auth/react";
import { Headphones, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

function displayName(user: { name?: string | null; email?: string | null } | undefined) {
  if (!user) return "there";
  if (user.name) return user.name.split(" ")[0];
  if (user.email) return user.email.split("@")[0];
  return "there";
}

export function DashboardHeader() {
  const { status, data } = useSession();

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Nice to see you</p>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          {status === "loading" ? "..." : displayName(data?.user)}
        </h1>
      </div>

      <div className="lg:flex items-center gap-3 hidden">
        <Button variant="outline" size="sm" asChild>
          <Link href="mailto:cristiahydra@gmail.com">
            <ThumbsUp />
            <span className="hidden lg:block">Feedback</span>
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="mailto:cristiahydra@gmail.com">
            <Headphones />
            <span className="hidden lg:block">Need help?</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

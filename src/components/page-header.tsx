import type { ReactNode } from "react";
import { Headphones, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  className?: string;
  rightAction?: ReactNode;
}

export function PageHeader({
  title,
  className,
  rightAction,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="font-display text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {rightAction ?? (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`mailto:${BRAND.supportEmail}`}>
                <ThumbsUp />
                <span className="hidden lg:block">Feedback</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`mailto:${BRAND.supportEmail}`}>
                <Headphones />
                <span className="hidden lg:block">Need help?</span>
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icons/labels are swapped purely via CSS `dark:` variants (driven by the
 * `.dark` class next-themes sets on <html> before hydration), so the rendered
 * markup is identical server- and client-side — no mount flag, no hydration
 * mismatch. `resolvedTheme` is only read in the click handler, which runs
 * post-hydration when it is always defined.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium tracking-tight text-sidebar-foreground transition-colors hover:bg-accent/40 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5",
        className
      )}
    >
      <Moon className="size-4 shrink-0 dark:hidden" />
      <Sun className="hidden size-4 shrink-0 dark:block" />
      <span className="group-data-[collapsible=icon]:hidden">
        <span className="dark:hidden">Dark mode</span>
        <span className="hidden dark:inline">Light mode</span>
      </span>
    </button>
  );
}

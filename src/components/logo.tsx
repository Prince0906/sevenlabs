import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Wordmark — the brand renders as type, not a raster logo. The cobalt period
 * is the brand accent: the one blue in the whole app.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-lg font-bold tracking-tight text-foreground",
        className
      )}
    >
      {BRAND.name}
      <span className="text-primary">.</span>
    </span>
  );
}

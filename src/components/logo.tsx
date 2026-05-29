import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Editorial serif wordmark — the brand renders as type, not a raster logo.
 * The emerald period nods to the Senior signal: the destination the product
 * moves you toward.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-lg font-semibold tracking-tight text-foreground",
        className
      )}
    >
      {BRAND.name}
      <span className="text-signal-senior">.</span>
    </span>
  );
}

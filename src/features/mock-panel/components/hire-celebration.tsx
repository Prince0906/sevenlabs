"use client";

import { motion, useReducedMotion } from "framer-motion";

// Signal + clay hues only — the celebration borrows the product's own palette
// rather than introducing party colors, so it stays inside the editorial lane.
const COLORS = [
  "var(--signal-newgrad)",
  "var(--signal-sde2)",
  "var(--signal-senior)",
  "var(--clay-strong)",
];
const COUNT = 16;

/**
 * A one-shot, restrained burst behind the verdict seal when the committee leans
 * hire — the single dopamine beat the report otherwise lacks. Deterministic
 * (no random), and skipped entirely under prefers-reduced-motion.
 */
export function HireCelebration() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 overflow-visible"
    >
      {Array.from({ length: COUNT }).map((_, i) => {
        const angle = (i / COUNT) * Math.PI * 2;
        const dist = 56 + (i % 4) * 24;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist - 24;
        return (
          <motion.span
            key={i}
            className="absolute left-7 top-7 size-1.5 rounded-full"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], x, y, scale: [0.4, 1, 1, 0.7] }}
            transition={{
              duration: 1.4,
              delay: 0.18 + (i % 5) * 0.04,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
  );
}

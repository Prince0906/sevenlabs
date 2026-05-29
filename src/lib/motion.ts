import type { Variants, Transition } from "framer-motion";

const SOFT_EASE: Transition["ease"] = [0.22, 1, 0.36, 1];

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: SOFT_EASE },
  },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: SOFT_EASE },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: SOFT_EASE },
  },
};

export const signalSlide: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 22,
  mass: 0.6,
};

export const pulseOnIncrement: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.12, 1],
    transition: { duration: 0.45, ease: SOFT_EASE },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15, ease: SOFT_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: SOFT_EASE },
  },
};

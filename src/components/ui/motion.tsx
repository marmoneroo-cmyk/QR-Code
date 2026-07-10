'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Shared entrance-motion primitives for the admin surface.
 * Keep transforms on small wrappers (cards), not on containers with
 * position:fixed descendants. Reduced-motion is respected via the
 * `useReducedMotion` hook below (Framer Motion transforms bypass the CSS
 * `prefers-reduced-motion` media query on their own, so each primitive
 * checks it explicitly and renders with no transform/opacity animation
 * when the user has requested reduced motion).
 */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Fade + rise a block into view on mount. */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <motion.div className={className} initial={false} animate={{ opacity: 1, y: 0 }}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Container that staggers its direct <motion.* variants={staggerItem}> children in. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <motion.div className={className} initial={false} animate="show">
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div className={className} variants={staggerContainer} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

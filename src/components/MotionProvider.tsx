'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * App-wide reduced-motion honoring. `reducedMotion="user"` makes EVERY Framer Motion
 * component respect the OS "reduce motion" setting — disabling transform/layout
 * animations (while keeping safe opacity/colour fades) — including the screens that
 * apply the shared `staggerContainer`/`staggerItem` variants directly rather than the
 * `Reveal`/`Stagger` primitives. One root switch = complete coverage, no per-call-site
 * `useReducedMotion` threading required.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

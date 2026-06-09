'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * CELEBRATION kit — the "victory moment" layer. A win should FEEL like a win:
 * a soft confetti burst, a glow ring, a little reinforcement. Pure decoration,
 * pointer-events-none, and fully disabled under prefers-reduced-motion.
 *
 * Determinism: piece positions are derived from the index (cos/sin), never
 * Math.random() — so SSR and client render identically (no hydration mismatch).
 */

const CONFETTI_COLORS = ['#fbbf24', '#34d399', '#f472b6', '#7dd3fc', '#f59e0b', '#a78bfa'];

/**
 * A one-shot confetti burst that radiates from the top-center of its parent and
 * falls away. Place inside a `relative` container. Renders nothing when reduced
 * motion is requested.
 */
export function Confetti({ count = 30, originY = '34%' }: { count?: number; originY?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 120 + (i % 5) * 30;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist - 30;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const w = 6 + (i % 3) * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 rounded-[2px]"
            style={{ top: originY, width: w, height: w * 1.7, background: color }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x, y: y + 260, opacity: 0, rotate: 420, scale: 0.5 }}
            transition={{ duration: 1.7 + (i % 4) * 0.22, ease: 'easeOut', delay: (i % 6) * 0.045 }}
          />
        );
      })}
    </span>
  );
}

/**
 * An expanding glow ring — a single soft "pulse" of accent light. Good behind a
 * trophy, a checkmark, or a hero drink at the moment of a win.
 */
export function VictoryRing({ accent = '#fbbf24', size = 220 }: { accent?: string; size?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ width: size, height: size, border: `2px solid ${accent}`, boxShadow: `0 0 60px ${accent}` }}
      initial={{ opacity: 0.55, scale: 0.3 }}
      animate={{ opacity: 0, scale: 1.6 }}
      transition={{ duration: 1.4, ease: 'easeOut' }}
    />
  );
}

/**
 * Wraps content and fires confetti once when `celebrate` flips true (e.g. an action
 * marked done). The burst auto-clears after ~2s so it never lingers. The wrapper is
 * `relative` so the burst is anchored to its children.
 */
export function CelebrateOnTrigger({
  celebrate,
  children,
  count = 26,
}: {
  celebrate: boolean;
  children?: ReactNode;
  count?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!celebrate) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, [celebrate]);
  return (
    <span className="relative block">
      {children}
      <AnimatePresence>{show ? <Confetti count={count} /> : null}</AnimatePresence>
    </span>
  );
}

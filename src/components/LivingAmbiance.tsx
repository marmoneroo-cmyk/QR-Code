'use client';

import { motion } from 'framer-motion';

/**
 * LivingAmbiance — a deliberately restrained "the drink is alive" layer.
 * Luxury = minimal, so this is NOT a particle storm: just a slowly breathing
 * accent halo (universal) and, for effervescent drinks only, a few faint rising
 * bubbles. Pointer-events-none, sits in the scene background. Deterministic
 * bubble params (no random) so SSR/CSR markup matches.
 */

interface LivingAmbianceProps {
  accent: string;
  effervescent?: boolean;
  className?: string;
}

const BUBBLES = [
  { left: 45, size: 5, delay: 0, dur: 9, drift: 6 },
  { left: 52, size: 4, delay: 1.6, dur: 11, drift: -8 },
  { left: 48, size: 6, delay: 3.1, dur: 10, drift: 4 },
  { left: 55, size: 3, delay: 4.4, dur: 12, drift: -5 },
  { left: 42, size: 4, delay: 5.7, dur: 10.5, drift: 7 },
  { left: 50, size: 5, delay: 2.3, dur: 13, drift: -3 },
  { left: 47, size: 3, delay: 6.8, dur: 9.5, drift: 5 },
] as const;

export function LivingAmbiance({ accent, effervescent = false, className }: LivingAmbianceProps) {
  return (
    <div className={`pointer-events-none ${className ?? ''}`} aria-hidden>
      {/* Breathing accent halo — the subtle 'is alive' glow */}
      <motion.div
        className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 rounded-full blur-[140px]"
        style={{ width: 700, height: 500, backgroundColor: accent }}
        initial={{ opacity: 0.13, scale: 1 }}
        animate={{ opacity: [0.13, 0.2, 0.13], scale: [1, 1.05, 1] }}
        transition={{ duration: 7.5, ease: 'easeInOut', repeat: Infinity }}
      />

      {/* Effervescence — only for sparkling drinks, and kept very faint */}
      {effervescent &&
        BUBBLES.map((b, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${b.left}%`,
              bottom: '16%',
              width: b.size,
              height: b.size,
              backgroundColor: 'rgba(255,255,255,0.55)',
              boxShadow: `0 0 6px ${accent}`,
            }}
            initial={{ opacity: 0, y: 0, x: 0 }}
            animate={{ opacity: [0, 0.5, 0.42, 0], y: [0, -280], x: [0, b.drift] }}
            transition={{ duration: b.dur, delay: b.delay, ease: 'easeOut', repeat: Infinity }}
          />
        ))}
    </div>
  );
}

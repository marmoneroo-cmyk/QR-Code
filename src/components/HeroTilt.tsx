'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useAnimationFrame,
} from 'framer-motion';

interface HeroTiltProps {
  src: string;
  alt?: string;
  accent?: string;
  className?: string;
}

/**
 * Interactive 3D tilt showcase for a single hero image. Follows the pointer
 * (or touch drag) to tilt the drink in 3D with depth, a moving light sweep and
 * a soft accent glow. When idle it sways gently so it always feels alive.
 */
export function HeroTilt({ src, alt = '', accent = '#e8b339', className }: HeroTiltProps) {
  const active = useRef(false);

  // Normalised pointer position, -0.5 … 0.5.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [24, -24]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-28, 28]), {
    stiffness: 140,
    damping: 18,
  });
  const shineX = useTransform(px, [-0.5, 0.5], ['22%', '78%']);
  const shineY = useTransform(py, [-0.5, 0.5], ['18%', '82%']);

  // Gentle idle sway when the user isn't interacting.
  useAnimationFrame((t) => {
    if (active.current) return;
    const s = t / 1000;
    px.set(Math.sin(s * 0.45) * 0.16);
    py.set(Math.cos(s * 0.35) * 0.1);
  });

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    active.current = true;
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    active.current = false;
  };

  return (
    <div
      className={`relative select-none touch-none ${className ?? ''}`}
      style={{ perspective: 1400 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerDown={onMove}
    >
      {/* Accent glow behind the drink */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full blur-[120px]"
        style={{ backgroundColor: accent, opacity: 0.18, x: useTransform(px, [-0.5, 0.5], [-30, 30]) }}
      />

      <motion.div
        className="relative w-full h-full"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="w-full h-full object-contain pointer-events-none drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
          style={{ transform: 'translateZ(40px)' }}
        />
        {/* Light sweep that tracks the tilt */}
        <motion.div
          className="pointer-events-none absolute inset-0 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle at var(--sx) var(--sy), rgba(255,255,255,0.22), transparent 55%)',
            ['--sx' as string]: shineX,
            ['--sy' as string]: shineY,
            transform: 'translateZ(60px)',
          }}
        />
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <span
          className="px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-amber-200/20 text-amber-200/80 text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          ↔ Move to tilt
        </span>
      </div>
    </div>
  );
}

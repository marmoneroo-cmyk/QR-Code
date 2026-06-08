'use client';

import { motion } from 'framer-motion';
import { useAmbientSound } from '@/lib/useAmbientSound';

interface AmbientToggleProps {
  className?: string;
}

export function AmbientToggle({ className = '' }: AmbientToggleProps) {
  const { muted, toggle } = useAmbientSound();

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.8 }}
      aria-label={muted ? 'Enable ambient sound' : 'Mute ambient sound'}
      className={`pointer-events-auto w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 ${
        muted
          ? 'border-amber-200/30 text-amber-200/60 hover:text-amber-200 hover:border-amber-200/60 bg-black/30'
          : 'border-amber-200/80 text-amber-100 bg-amber-200/15 shadow-[0_0_15px_rgba(252,211,77,0.3)]'
      } backdrop-blur-sm ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M2 5v4h2l3 3V2L4 5H2z" fill="currentColor" />
        {muted ? (
          <>
            <line x1="9" y1="5" x2="13" y2="9" />
            <line x1="13" y1="5" x2="9" y2="9" />
          </>
        ) : (
          <>
            <path d="M9.5 4.5c1 1 1 4 0 5" />
            <path d="M11 3c2 2 2 6 0 8" />
          </>
        )}
      </svg>
    </motion.button>
  );
}

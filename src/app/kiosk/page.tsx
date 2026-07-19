'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { Reveal } from '@/components/ui/motion';
import { MENU, type CocktailConfig } from '@/data/cocktail';

const CocktailScene = dynamic(
  () => import('@/components/CocktailScene').then((mod) => mod.CocktailScene),
  { ssr: false }
);

const ROTATE_MS = 12000;

function isAvailableNow(cocktail: CocktailConfig, hour: number): boolean {
  if (!cocktail.availableHours) return true;
  const [start, end] = cocktail.availableHours;
  if (start <= end) return hour >= start && hour < end;
  // wraps midnight (e.g., [22, 4] → 22-23 + 0-3)
  return hour >= start || hour < end;
}

export default function KioskPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  // Seeded to 0, then set to the real clock in the rotation effect below (which runs before
  // the interval ever reads it) — avoids calling Date.now() during render.
  const startedAt = useRef<number>(0);

  useEffect(() => {
    setNow(new Date());
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  const items = useMemo(() => {
    if (!scheduleEnabled || !now) return MENU;
    const hour = now.getHours();
    const filtered = MENU.filter((c) => isAvailableNow(c, hour));
    return filtered.length > 0 ? filtered : MENU;
  }, [scheduleEnabled, now]);

  // Reset index when the available set shrinks below current index
  useEffect(() => {
    if (index >= items.length) {
      setIndex(0);
    }
  }, [items.length, index]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.location.href = '/';
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowLeft') {
        setIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 's' || e.key === 'S') {
        setScheduleEnabled((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    startedAt.current = Date.now();
    setProgress(0);
    if (paused) return;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const pct = Math.min(1, elapsed / ROTATE_MS);
      setProgress(pct);
      if (pct >= 1) {
        setIndex((i) => (i + 1) % items.length);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [index, paused, items.length]);

  const current = items[index];
  if (!current) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.slug}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <CocktailScene config={current} />
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-0 left-0 right-0 h-[2px] z-50 bg-amber-200/10">
        <motion.div
          className="h-full bg-amber-200/80"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </div>

      <Reveal
        delay={0.3}
        className="absolute bottom-6 right-6 z-50 text-amber-200/50 text-10 tracking-[0.4em] uppercase select-none"
      >
        <span className="font-sans">
          {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          {scheduleEnabled && items.length !== MENU.length && (
            <span className="ml-3 text-amber-100">· {MENU.length - items.length} hidden</span>
          )}
          {paused && <span className="ml-3 text-amber-100">· paused</span>}
        </span>
      </Reveal>

      <Reveal
        delay={0.4}
        className="absolute bottom-6 left-6 z-50 text-amber-200/40 text-9 tracking-[0.35em] uppercase select-none"
      >
        <span className="font-sans">
          ESC to exit · ← → to switch · space to pause · S to {scheduleEnabled ? 'show all' : 'apply schedule'}
          {now && scheduleEnabled && (
            <span className="ml-3 text-amber-200/60">
              · {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
            </span>
          )}
        </span>
      </Reveal>

      <Link
        href="/"
        className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full border border-amber-200/30 text-amber-200/70 hover:text-amber-200 hover:border-amber-200/70 transition-colors flex items-center justify-center text-sm"
        aria-label="Exit kiosk"
      >
        ×
      </Link>
    </div>
  );
}

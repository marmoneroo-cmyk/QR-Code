'use client';

import Link from 'next/link';
import { useLocalStorageState } from '@/lib/useLocalStorageState';
import { motion } from 'framer-motion';
import { ADMIN_GROUPS } from './adminNav';
import { LUX_EASE } from './premium';
import type { Lang } from '@/data/cocktail';

const sans = 'var(--font-inter, sans-serif)';
const ADV_KEY = 'cocktail-demo:admin-advanced';

interface AdminLauncherProps {
  lang: Lang;
  active?: string;
  /** Called after a tile is clicked — used to close the overlay. */
  onNavigate?: () => void;
}

const groupVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

const tileVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: LUX_EASE } },
};

/**
 * Premium icon-tile launcher for the consolidated admin sections — 6 primary
 * groups plus an "Advanced" group hidden behind a persisted toggle, so an owner
 * sees a calm control center while operators can reveal the expert surfaces.
 */
export function AdminLauncher({ lang, active, onNavigate }: AdminLauncherProps) {
  const isHe = lang === 'he';
  // Advanced-mode flag on the shared SSR-safe localStorage store — hydrates without a
  // set-state-in-effect and syncs across tabs (the store handles read/write + quota guarding).
  const { value: showAdvanced, set: setShowAdvanced } = useLocalStorageState<boolean>(
    ADV_KEY,
    (raw) => raw === 'true',
    String,
    false,
  );
  const toggleAdvanced = () => setShowAdvanced(!showAdvanced);

  const groups = ADMIN_GROUPS.filter((g) => !g.advanced || showAdvanced);

  return (
    <div className="flex flex-col gap-9" dir={isHe ? 'rtl' : 'ltr'}>
      {groups.map((g) => (
        <section key={g.en}>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[10px] tracking-[0.4em] uppercase" style={{ fontFamily: sans, color: 'rgba(232,201,135,0.6)' }}>
              {isHe ? g.he : g.en}
            </p>
            <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)' }} />
            <span className="text-[9px] tabular-nums" style={{ fontFamily: sans, color: 'rgba(255,255,255,0.25)' }}>
              {g.items.length}
            </span>
          </div>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            variants={groupVariants}
            initial="hidden"
            animate="show"
          >
            {g.items.map((it) => {
              const on = active === it.href;
              const Icon = it.Icon;
              return (
                <motion.div key={it.href} variants={tileVariants}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={on ? 'page' : undefined}
                    className={`group relative flex h-full items-start gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                      on
                        ? 'border-amber-300/50 bg-amber-300/[0.07]'
                        : 'glass-panel border-white/10 hover:border-amber-200/35 hover:-translate-y-1'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{ background: 'radial-gradient(120% 100% at 50% 0%, rgba(232,201,135,0.07), transparent 65%)' }}
                    />
                    <span
                      className={`relative shrink-0 grid place-items-center w-11 h-11 rounded-xl border transition-all duration-300 ${
                        on
                          ? 'border-amber-300/50 text-amber-200 bg-amber-300/10'
                          : 'border-white/10 text-amber-200/70 group-hover:text-amber-100 group-hover:border-amber-200/40 group-hover:shadow-[0_0_22px_rgba(232,201,135,0.18)]'
                      }`}
                    >
                      <Icon size={19} strokeWidth={1.5} />
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block text-white/90 text-[13px] tracking-wide" style={{ fontFamily: sans, fontWeight: 500 }}>
                        {isHe ? it.he : it.en}
                      </span>
                      <span className="block text-white/40 text-[11px] leading-snug mt-0.5" style={{ fontFamily: sans }}>
                        {isHe ? it.descHe : it.descEn}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="relative self-center text-amber-200/0 transition-all duration-300 group-hover:text-amber-200/70 ltr:-translate-x-1 ltr:group-hover:translate-x-0 rtl:translate-x-1 rtl:group-hover:translate-x-0"
                    >
                      {isHe ? '←' : '→'}
                    </span>
                    {on && (
                      <span aria-hidden className="absolute top-3 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" style={{ insetInlineEnd: '0.75rem' }} />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      ))}

      {/* Advanced-mode toggle — quiet, persisted; reveals the expert group */}
      <div className="flex items-center justify-center pt-1">
        <button
          type="button"
          onClick={toggleAdvanced}
          aria-pressed={showAdvanced}
          className="inline-flex items-center gap-2.5 text-[10px] tracking-[0.24em] uppercase text-white/40 hover:text-amber-100 transition-colors"
          style={{ fontFamily: sans }}
        >
          <span
            className={`relative inline-flex h-4 w-7 items-center rounded-full border transition-colors ${
              showAdvanced ? 'border-amber-200/50 bg-amber-300/15' : 'border-white/15 bg-white/[0.03]'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                showAdvanced ? 'bg-amber-300 translate-x-3.5 rtl:-translate-x-3.5' : 'bg-white/40 translate-x-0.5 rtl:-translate-x-0.5'
              }`}
            />
          </span>
          {isHe ? 'מצב מתקדם' : 'Advanced mode'}
        </button>
      </div>
    </div>
  );
}

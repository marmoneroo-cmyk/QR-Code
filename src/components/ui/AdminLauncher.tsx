'use client';

import Link from 'next/link';
import { ADMIN_GROUPS } from './adminNav';
import type { Lang } from '@/data/cocktail';

const sans = 'var(--font-inter, sans-serif)';

interface AdminLauncherProps {
  lang: Lang;
  active?: string;
  /** Called after a tile is clicked — used to close the overlay. */
  onNavigate?: () => void;
}

/** Icon-tile launcher for every admin section, grouped and labelled. */
export function AdminLauncher({ lang, active, onNavigate }: AdminLauncherProps) {
  const isHe = lang === 'he';
  return (
    <div className="flex flex-col gap-7" dir={isHe ? 'rtl' : 'ltr'}>
      {ADMIN_GROUPS.map((g) => (
        <section key={g.en}>
          <p className="text-amber-200/55 text-[10px] tracking-[0.35em] uppercase mb-3" style={{ fontFamily: sans }}>
            {isHe ? g.he : g.en}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {g.items.map((it) => {
              const on = active === it.href;
              const Icon = it.Icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  className={`group flex items-start gap-3 rounded-2xl border p-4 transition-all duration-200 ${
                    on
                      ? 'border-amber-300/60 bg-amber-300/[0.08]'
                      : 'border-white/10 bg-white/[0.02] hover:border-amber-200/40 hover:bg-white/[0.05] hover:-translate-y-0.5'
                  }`}
                >
                  <span
                    className={`shrink-0 grid place-items-center w-10 h-10 rounded-xl border transition-colors ${
                      on
                        ? 'border-amber-300/50 text-amber-200 bg-amber-300/10'
                        : 'border-white/10 text-amber-200/80 group-hover:text-amber-100 group-hover:border-amber-200/40'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-white/90 text-[13px] tracking-wide" style={{ fontFamily: sans, fontWeight: 500 }}>
                      {isHe ? it.he : it.en}
                    </span>
                    <span className="block text-white/45 text-[11px] leading-snug mt-0.5" style={{ fontFamily: sans }}>
                      {isHe ? it.descHe : it.descEn}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

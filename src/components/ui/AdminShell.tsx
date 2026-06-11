'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Home, X } from 'lucide-react';
import { useLang } from '@/lib/useLang';
import { AdminLauncher } from './AdminLauncher';
import { AuthStatus } from '@/components/admin/AuthStatus';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const heSerif = 'var(--font-frank-ruhl, serif)';
const body = 'var(--font-garamond, serif)';
const heBody = 'var(--font-heebo, sans-serif)';

interface AdminShellProps {
  title: string;
  eyebrow?: string;
  /** Optional Hebrew overrides; falls back to the (English) props when absent. */
  titleHe?: string;
  eyebrowHe?: string;
  subtitle?: string;
  subtitleHe?: string;
  active?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for every admin-section page. The top bar is intentionally tiny:
 * back-to-menu, a Home link, and a single "Sections" button that opens an
 * icon-tile launcher (the whole admin is one click away from anywhere). RTL-aware
 * and bilingual, driven by the global persisted language.
 */
export function AdminShell({
  title,
  eyebrow = 'Restaurant Admin',
  titleHe,
  eyebrowHe,
  subtitle,
  subtitleHe,
  active,
  actions,
  children,
}: AdminShellProps) {
  const { lang, setLang } = useLang();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const isHebrew = lang === 'he';
  const titleFont = isHebrew ? heSerif : serif;
  const bodyFont = isHebrew ? heBody : body;

  const shownTitle = isHebrew ? titleHe ?? title : title;
  const shownEyebrow = isHebrew ? eyebrowHe ?? eyebrow : eyebrow;
  const shownSubtitle = isHebrew ? subtitleHe ?? subtitle : subtitle;

  const pill =
    'inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase text-white/70 hover:text-amber-100 hover:border-amber-200/40 transition-colors';

  return (
    <div
      className="relative min-h-screen bg-black text-white print:bg-white print:text-black"
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black via-zinc-950 to-black print:hidden" />

      {/* Top bar — minimal */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-black/60 backdrop-blur-xl print:hidden">
        <div className="mx-auto max-w-6xl px-6 md:px-10 min-h-16 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-200/80 hover:text-amber-100 transition-colors text-[10px] tracking-[0.3em] uppercase shrink-0"
            style={{ fontFamily: sans }}
          >
            <span>{isHebrew ? '→' : '←'}</span>
            <span>{isHebrew ? 'תפריט' : 'Menu'}</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link href="/admin/home" className={pill} style={{ fontFamily: sans }}>
              <Home size={13} strokeWidth={1.6} />
              <span className="hidden sm:inline">{isHebrew ? 'בית' : 'Home'}</span>
            </Link>
            <button type="button" onClick={() => setLauncherOpen(true)} className={pill} style={{ fontFamily: sans }} aria-haspopup="dialog">
              <LayoutGrid size={13} strokeWidth={1.6} />
              <span>{isHebrew ? 'מסכים' : 'Sections'}</span>
            </button>
            <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
              {(['en', 'he'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 rounded-full text-[9px] tracking-[0.15em] uppercase transition-colors ${
                    lang === l ? 'bg-amber-100 text-black' : 'text-white/55 hover:text-white/90'
                  }`}
                  style={{ fontFamily: sans }}
                >
                  {l === 'en' ? 'EN' : 'עב'}
                </button>
              ))}
            </div>
            <AuthStatus lang={lang} />
          </div>
        </div>
      </header>

      {/* Launcher overlay */}
      {launcherOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md overflow-y-auto print:hidden"
          onClick={() => setLauncherOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="min-h-full px-6 md:px-10 py-14" onClick={(e) => e.stopPropagation()} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center justify-between mb-8">
                <h2
                  className="text-white tracking-[0.02em]"
                  style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 500, fontSize: 'clamp(1.6rem,4vw,2.4rem)' }}
                >
                  {isHebrew ? 'כל המסכים' : 'All Sections'}
                </h2>
                <button
                  type="button"
                  onClick={() => setLauncherOpen(false)}
                  className="grid place-items-center w-10 h-10 rounded-full border border-white/15 text-white/70 hover:text-amber-100 hover:border-amber-200/40 transition-colors"
                  aria-label={isHebrew ? 'סגור' : 'Close'}
                >
                  <X size={18} strokeWidth={1.6} />
                </button>
              </div>
              <AdminLauncher lang={lang} active={active} onNavigate={() => setLauncherOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-12 md:pt-16 pb-8">
        <p className="text-amber-200/70 text-[10px] tracking-[0.45em] uppercase mb-4" style={{ fontFamily: sans }}>
          {shownEyebrow}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1
            className="text-white leading-[1.05] tracking-[0.02em]"
            style={{
              fontFamily: titleFont,
              fontStyle: isHebrew ? 'normal' : 'italic',
              fontWeight: 500,
              fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)',
            }}
          >
            {shownTitle}
          </h1>
          {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
        </div>
        <div className="flex items-center gap-3 mt-5">
          <div className="w-14 h-px bg-amber-200/35" />
          <div className="w-1.5 h-1.5 border border-amber-200/55 rotate-45" />
          <div className="w-14 h-px bg-amber-200/35" />
        </div>
        {shownSubtitle && (
          <p
            className="text-white/45 text-[15px] mt-5 max-w-2xl leading-relaxed"
            style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}
          >
            {shownSubtitle}
          </p>
        )}
      </div>

      {/* Page content */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-24">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutGrid, Home, X } from 'lucide-react';
import { useLang } from '@/lib/useLang';
import { AdminLauncher } from './AdminLauncher';
import { AuthStatus } from '@/components/admin/AuthStatus';
import { AmbientBackdrop, GlowDivider, LUX_EASE } from './premium';

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
 * Shared shell for every admin-section page — the Phase-5 premium chrome.
 * A floating glass capsule nav (back-to-menu · Home · Sections launcher · lang ·
 * auth), a cinematic full-screen launcher, and an animated editorial page header.
 * RTL-aware and bilingual, driven by the global persisted language. The public
 * API is unchanged — every admin page inherits this look with zero edits.
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
  const reduce = useReducedMotion();
  const isHebrew = lang === 'he';
  const titleFont = isHebrew ? heSerif : serif;
  const bodyFont = isHebrew ? heBody : body;

  const shownTitle = isHebrew ? titleHe ?? title : title;
  const shownEyebrow = isHebrew ? eyebrowHe ?? eyebrow : eyebrow;
  const shownSubtitle = isHebrew ? subtitleHe ?? subtitle : subtitle;

  const launcherTriggerRef = useRef<HTMLButtonElement | null>(null);
  const launcherDialogRef = useRef<HTMLDivElement | null>(null);

  // Escape closes the launcher while open.
  useEffect(() => {
    if (!launcherOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLauncherOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [launcherOpen]);

  // Move focus into the dialog on open, trap Tab within it, and restore
  // focus to the trigger button on close.
  useEffect(() => {
    if (!launcherOpen) return;
    const dialog = launcherDialogRef.current;
    dialog?.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleTabTrap);
    return () => {
      window.removeEventListener('keydown', handleTabTrap);
      launcherTriggerRef.current?.focus();
    };
  }, [launcherOpen]);

  const pill =
    'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-10 tracking-[0.2em] uppercase text-white/65 hover:text-amber-100 hover:border-amber-200/40 hover:bg-white/[0.05] transition-all';

  return (
    <div
      className="relative min-h-screen bg-black text-white print:bg-white print:text-black"
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <AmbientBackdrop />

      {/* Floating glass capsule nav */}
      <header className="sticky top-0 z-30 px-4 pt-3 pb-2 print:hidden">
        <div className="glass-chrome backdrop-blur-2xl mx-auto max-w-6xl rounded-2xl px-4 sm:px-5 min-h-14 py-2.5 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-amber-200/80 hover:text-amber-100 transition-colors text-10 tracking-[0.3em] uppercase shrink-0"
            style={{ fontFamily: sans }}
          >
            <span className="transition-transform group-hover:-translate-x-0.5">{isHebrew ? '→' : '←'}</span>
            <span>{isHebrew ? 'תפריט' : 'Menu'}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/admin/home" className={pill} style={{ fontFamily: sans }} aria-label={isHebrew ? 'בית' : 'Home'}>
              <Home size={13} strokeWidth={1.6} />
              <span className="hidden sm:inline">{isHebrew ? 'בית' : 'Home'}</span>
            </Link>
            <button
              type="button"
              ref={launcherTriggerRef}
              onClick={() => setLauncherOpen(true)}
              className={pill}
              style={{ fontFamily: sans }}
              aria-haspopup="dialog"
            >
              <LayoutGrid size={13} strokeWidth={1.6} />
              <span>{isHebrew ? 'מסכים' : 'Sections'}</span>
            </button>
            <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
              {(['en', 'he'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`px-2.5 py-1 rounded-full text-9 tracking-[0.15em] uppercase transition-all ${
                    lang === l ? 'text-black' : 'text-white/50 hover:text-white/90'
                  }`}
                  style={{
                    fontFamily: sans,
                    background: lang === l ? 'linear-gradient(105deg, var(--champagne-bright), var(--champagne))' : undefined,
                  }}
                >
                  {l === 'en' ? 'EN' : 'עב'}
                </button>
              ))}
            </div>
            <AuthStatus lang={lang} />
          </div>
        </div>
      </header>

      {/* Cinematic launcher overlay */}
      <AnimatePresence>
        {launcherOpen && (
          <motion.div
            ref={launcherDialogRef}
            tabIndex={-1}
            className="fixed inset-0 z-50 overflow-y-auto print:hidden outline-none"
            style={{ background: 'rgba(3,3,4,0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
            onClick={() => setLauncherOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-launcher-title"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: LUX_EASE }}
          >
            <motion.div
              className="min-h-full px-6 md:px-10 py-14"
              onClick={(e) => e.stopPropagation()}
              dir={isHebrew ? 'rtl' : 'ltr'}
              initial={reduce ? false : { opacity: 0, y: 26, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 14, scale: 0.99 }}
              transition={reduce ? { duration: 0 } : { duration: 0.4, ease: LUX_EASE }}
            >
              <div className="mx-auto max-w-5xl">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <p className="text-10 tracking-[0.42em] uppercase mb-3" style={{ fontFamily: sans, color: 'rgba(232,201,135,0.7)' }}>
                      {isHebrew ? 'ניווט' : 'Navigate'}
                    </p>
                    <h2
                      id="admin-launcher-title"
                      className="text-white tracking-[0.02em]"
                      style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 500, fontSize: 'clamp(1.8rem,4.5vw,2.8rem)' }}
                    >
                      {isHebrew ? 'כל המסכים' : 'All Sections'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLauncherOpen(false)}
                    className="grid place-items-center w-11 h-11 rounded-full border border-white/15 text-white/70 hover:text-amber-100 hover:border-amber-200/50 hover:rotate-90 transition-all duration-300"
                    aria-label={isHebrew ? 'סגור' : 'Close'}
                  >
                    <X size={18} strokeWidth={1.6} />
                  </button>
                </div>
                <AdminLauncher lang={lang} active={active} onNavigate={() => setLauncherOpen(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editorial page header */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-12 md:pt-16 pb-8">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: LUX_EASE }}
          className="text-10 tracking-[0.45em] uppercase mb-4"
          style={{ fontFamily: sans, color: 'rgba(232,201,135,0.72)' }}
        >
          {shownEyebrow}
        </motion.p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, delay: 0.06, ease: LUX_EASE }}
            className="text-white leading-[1.05] tracking-[0.02em]"
            style={{
              fontFamily: titleFont,
              fontStyle: isHebrew ? 'normal' : 'italic',
              fontWeight: 500,
              fontSize: 'clamp(2.4rem, 6vw, 4rem)',
            }}
          >
            {shownTitle}
          </motion.h1>
          {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.14, ease: LUX_EASE }}
          style={{ transformOrigin: isHebrew ? 'right' : 'left' }}
        >
          <GlowDivider className="mt-5" />
        </motion.div>
        {shownSubtitle && (
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.2, ease: LUX_EASE }}
            className="text-white/45 text-15 mt-5 max-w-2xl leading-relaxed"
            style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}
          >
            {shownSubtitle}
          </motion.p>
        )}
      </div>

      {/* Page content */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-24">
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

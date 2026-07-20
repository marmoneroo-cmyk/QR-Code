'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CURRENCY_SYMBOL, type Currency, type Lang } from '@/data/cocktail';

interface SettingsToolbarProps {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  restaurantName: string;
  onRestaurantChange: (name: string) => void;
}

const CURRENCIES: ReadonlyArray<Currency> = ['ILS', 'USD', 'EUR'];

// Inline SVG flags (render identically on every OS, unlike flag emoji).
function FlagEN() {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <rect width="24" height="24" fill="#fff" />
      <rect x="9.5" width="5" height="24" fill="#ce1124" />
      <rect y="9.5" width="24" height="5" fill="#ce1124" />
    </svg>
  );
}
function FlagIL() {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <rect width="24" height="24" fill="#fff" />
      <rect y="4.4" width="24" height="2.7" fill="#0038b8" />
      <rect y="16.9" width="24" height="2.7" fill="#0038b8" />
      <g stroke="#0038b8" strokeWidth="1.05" fill="none">
        <path d="M12 8.1 L14.7 12.75 L9.3 12.75 Z" />
        <path d="M12 15.4 L9.3 10.75 L14.7 10.75 Z" />
      </g>
    </svg>
  );
}

const LANGS: ReadonlyArray<{ value: Lang; flag: React.ReactNode; aria: string }> = [
  { value: 'en', flag: <FlagEN />, aria: 'English' },
  { value: 'he', flag: <FlagIL />, aria: 'עברית' },
];

/**
 * The round icon-chrome, shared by the toolbar's real buttons and by controls that are
 * actually links. Kept as a class helper rather than baked into IconButton so a link can
 * wear the same chrome WITHOUT nesting a <button> inside an <a> — that nesting is invalid
 * HTML and gave one visual control two tab stops and a doubled screen-reader announcement.
 */
function iconChromeClass(active?: boolean): string {
  return `w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${
    active
      ? 'border-amber-200/50 bg-amber-200/10 text-amber-100'
      : 'border-white/10 bg-white/[0.04] text-white/60 hover:border-amber-200/40 hover:text-amber-100'
  }`;
}

function IconButton({
  onClick,
  ariaLabel,
  active,
  children,
}: {
  onClick?: () => void;
  ariaLabel: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={iconChromeClass(active)}>
      {children}
    </button>
  );
}

export function SettingsToolbar({
  lang,
  onLangChange,
  currency,
  onCurrencyChange,
  restaurantName,
  onRestaurantChange,
}: SettingsToolbarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isHebrew = lang === 'he';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const t = {
    settings: isHebrew ? 'הגדרות' : 'Settings',
    language: isHebrew ? 'שפה' : 'Language',
    currency: isHebrew ? 'מטבע' : 'Currency',
    restaurant: isHebrew ? 'שם המסעדה' : 'Restaurant',
    admin: isHebrew ? 'ניהול' : 'Admin',
    scan: isHebrew ? 'סריקת QR' : 'Scan QR',
  };

  const rowLabel = 'text-white/70 text-11 tracking-[0.12em] mb-2.5 font-sans';

  return (
    <div ref={rootRef} className="fixed top-6 start-6 z-50 flex items-center gap-2.5">
      <div className="relative">
        <IconButton onClick={() => setOpen((v) => !v)} ariaLabel={t.settings} active={open}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </IconButton>

        <AnimatePresence>
          {open && (
            <motion.div
              className="absolute start-0 top-12 w-[280px] rounded-3xl border border-white/10 bg-[#0b0b0d]/95 backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              dir={isHebrew ? 'rtl' : 'ltr'}
            >
              <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
                <p className="text-amber-200/75 text-11 tracking-[0.28em] uppercase font-sans" style={{ fontWeight: 500 }}>
                  {t.settings}
                </p>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Language — country flags */}
                <div>
                  <p className={rowLabel}>{t.language}</p>
                  <div className="flex gap-3">
                    {LANGS.map((l) => {
                      const selected = lang === l.value;
                      return (
                        <button
                          key={l.value}
                          type="button"
                          onClick={() => onLangChange(l.value)}
                          aria-label={l.aria}
                          aria-pressed={selected}
                          className={`w-9 h-9 rounded-full overflow-hidden transition-all duration-300 ${
                            selected
                              ? 'ring-2 ring-amber-200 ring-offset-2 ring-offset-[#0b0b0d] scale-105'
                              : 'ring-1 ring-white/15 opacity-55 hover:opacity-100'
                          }`}
                        >
                          {l.flag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Currency — full-width segmented */}
                <div>
                  <p className={rowLabel}>{t.currency}</p>
                  <div className="flex w-full rounded-full border border-white/10 bg-white/[0.03] p-0.5">
                    {CURRENCIES.map((c) => {
                      const selected = currency === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onCurrencyChange(c)}
                          aria-pressed={selected}
                          className={`flex-1 py-1.5 rounded-full text-11 tracking-[0.06em] transition-all duration-300 ${
                            selected
                              ? 'bg-amber-100 text-black shadow-[0_2px_10px_rgba(252,211,77,0.25)]'
                              : 'text-white/50 hover:text-white/90'
                          } font-sans`}
                          style={{ fontWeight: 500 }}
                        >
                          {CURRENCY_SYMBOL[c]} {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Restaurant name */}
                <div>
                  <label htmlFor="restaurant-name-input" className={rowLabel}>{t.restaurant}</label>
                  <input
                    id="restaurant-name-input"
                    type="text"
                    value={restaurantName}
                    onChange={(e) => onRestaurantChange(e.target.value)}
                    placeholder={isHebrew ? 'שם המסעדה' : 'Restaurant name'}
                    /* This name renders as the menu header, so an unbounded value pushes
                       the whole menu down the page (300 chars added ~920px of heading
                       before the first item). Every other stored name in the app is
                       capped; maxLength also stops the input at the limit rather than
                       accepting text that silently degrades the guest view. */
                    maxLength={60}
                    className="w-full bg-transparent border-b border-white/15 focus:border-amber-200/60 outline-none text-white text-15 py-1.5 transition-colors duration-300 placeholder:text-white/60 font-sans"
                    dir={isHebrew ? 'rtl' : 'ltr'}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Admin is intentionally NOT linked from the public guest menu — the owner reaches
          /admin directly (it lives behind auth). Exposing it here let any guest at the table
          open the revenue dashboard. */}
      {/* The link IS the control — it wears the icon chrome itself instead of wrapping a
          button, so this is one element, one tab stop, one announcement. */}
      <Link href="/scan" aria-label={t.scan} className={iconChromeClass()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="15" width="6" height="6" rx="1" />
          <path d="M15 15h2v2M21 15v6M15 21h2M19 19h2" />
        </svg>
      </Link>
    </div>
  );
}

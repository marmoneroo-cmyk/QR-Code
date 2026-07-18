'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Package, QrCode } from 'lucide-react';
import {
  CATEGORY_LABEL,
  CURRENCY_SYMBOL,
  MENU,
  formatPrice,
  getAccent,
  type CocktailConfig,
  type Currency,
} from '@/data/cocktail';
import { useDrafts } from '@/lib/useDrafts';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import { useOrigin } from '@/lib/useOrigin';

type Density = 1 | 2 | 4;
type CardTheme = 'gold' | 'minimal';

interface PrintCard {
  cocktail: CocktailConfig;
  isDraft: boolean;
  qr: string;
  url: string;
}

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const body = 'var(--font-garamond, serif)';

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  width: 320,
  margin: 1,
  errorCorrectionLevel: 'H',
  color: { dark: '#0a0a0a', light: '#ffffff' },
};

export default function PrintPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const { drafts, hydrated } = useDrafts();
  const origin = useOrigin();
  const [density, setDensity] = useState<Density>(2);
  const [linkTarget, setLinkTarget] = useState<'breakdown' | 'ar'>('breakdown');
  const [currency, setCurrency] = useState<Currency>('ILS');
  const [includeNote, setIncludeNote] = useState(true);
  const [cardTheme, setCardTheme] = useState<CardTheme>('gold');
  const [cards, setCards] = useState<PrintCard[]>([]);
  const [busy, setBusy] = useState(false);

  const allCocktails = useMemo(
    () => [
      ...MENU.map((c) => ({ cocktail: c, isDraft: false })),
      ...drafts
        .filter((d) => !MENU.some((m) => m.slug === d.slug))
        .map((d) => ({ cocktail: d as CocktailConfig, isDraft: true })),
    ],
    [drafts]
  );

  useEffect(() => {
    if (!origin || !hydrated) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      const next: PrintCard[] = [];
      for (const item of allCocktails) {
        const path =
          linkTarget === 'ar'
            ? `/ar/${item.cocktail.slug}`
            : item.isDraft
              ? `/drafts/${item.cocktail.slug}`
              : `/cocktails/${item.cocktail.slug}`;
        const url = `${origin}${path}`;
        try {
          const qr = await QRCode.toDataURL(url, QR_OPTIONS);
          next.push({ cocktail: item.cocktail, isDraft: item.isDraft, qr, url });
        } catch {
          // skip
        }
      }
      if (!cancelled) {
        setCards(next);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, hydrated, allCocktails, linkTarget]);

  const gridClass =
    density === 1
      ? 'grid-cols-1 print:grid-cols-1'
      : density === 2
        ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
        : // 4 per page → 4-up on screen, 2×2 (= 4 per A4 sheet) in print
          'grid-cols-2 lg:grid-cols-4 print:grid-cols-2';

  return (
    <AdminShell
      title="Editorial table tents"
      titleHe="כרטיסי שולחן"
      eyebrow="Print Kit"
      eyebrowHe="ערכת הדפסה"
      active="/admin/print"
      subtitle="Print on heavy stock, fold or cut. Each card carries the hero image, name, ingredients, bartender note, price, and a QR pointing to the digital experience."
      subtitleHe="הדפס על נייר עבה, קפל או חתוך. כל כרטיס נושא את התמונה, השם, המרכיבים, הערת הברמן, המחיר וקוד QR לחוויה הדיגיטלית."
      actions={
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-amber-200 text-black text-11 tracking-[0.25em] uppercase shadow-[0_18px_50px_-22px_rgba(251,191,36,0.9)] hover:bg-amber-100 hover:scale-[1.03] transition-all duration-300"
          style={{ fontFamily: sans, fontWeight: 600 }}
        >
          <Printer size={14} strokeWidth={2} />
          {t('Print sheet', 'הדפס גיליון')}
        </button>
      }
    >
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html,
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Kit preview — screen only, never prints */}
      {cards.length > 0 && (
        <section className="no-print mb-10" dir={isHebrew ? 'rtl' : 'ltr'}>
          <SectionLabel icon={Package}>{t('In this kit', 'בערכה')}</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {cards.map((card) => (
              <div
                key={card.cocktail.slug}
                className="shrink-0 w-28 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-amber-200/40"
                title={card.cocktail.title[lang]}
              >
                {card.cocktail.heroImage ? (
                  <GlassImage src={card.cocktail.heroImage} accent={getAccent(card.cocktail.slug)} className="w-full h-24 mb-2" />
                ) : (
                  <div className="w-full h-24 mb-2 grid place-items-center rounded-xl bg-white/[0.03]">
                    <QrCode size={20} className="text-white/25" strokeWidth={1.6} />
                  </div>
                )}
                <p className="text-white/80 text-11 text-center leading-tight truncate" style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 600 }}>
                  {card.cocktail.title[lang]}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Controls — screen only */}
      <section className="no-print mb-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-7" dir={isHebrew ? 'rtl' : 'ltr'}>
        <SectionLabel icon={QrCode}>{t('Sheet setup', 'הגדרות גיליון')}</SectionLabel>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <Toggle label={t('Per page', 'לכל עמוד')} options={[1, 2, 4]} value={density} onChange={(v) => setDensity(v as Density)} />
          <Toggle
            label={t('QR target', 'יעד QR')}
            options={['breakdown', 'ar']}
            value={linkTarget}
            onChange={(v) => setLinkTarget(v as 'breakdown' | 'ar')}
            labels={{ breakdown: t('Breakdown', 'פירוט'), ar: t('AR view', 'תצוגת AR') }}
          />
          <Toggle
            label={t('Currency', 'מטבע')}
            options={['ILS', 'USD', 'EUR']}
            value={currency}
            onChange={(v) => setCurrency(v as Currency)}
            labels={{ ILS: `${CURRENCY_SYMBOL.ILS} ILS`, USD: `${CURRENCY_SYMBOL.USD} USD`, EUR: `${CURRENCY_SYMBOL.EUR} EUR` }}
          />
          <label
            className="inline-flex items-center gap-2 text-white/60 text-10 tracking-[0.28em] uppercase cursor-pointer"
            style={{ fontFamily: sans }}
          >
            <input type="checkbox" checked={includeNote} onChange={(e) => setIncludeNote(e.target.checked)} className="accent-amber-300" />
            {t('Bartender note', 'הערת ברמן')}
          </label>
          <Toggle
            label={t('Card theme', 'עיצוב כרטיס')}
            options={['gold', 'minimal']}
            value={cardTheme}
            onChange={(v) => setCardTheme(v as CardTheme)}
            labels={{ gold: t('Gold accent', 'זהב'), minimal: t('Minimal', 'מינימלי') }}
          />
        </div>
        <p className="text-white/30 text-9 tracking-[0.22em] uppercase mt-4" style={{ fontFamily: sans }}>
          {t('Theme affects on-screen preview only — print stays clean', 'העיצוב משפיע על התצוגה המקדימה בלבד — ההדפסה נשארת נקייה')}
        </p>
      </section>

      {busy && (
        <p className="no-print inline-flex items-center gap-2 text-amber-200/70 text-sm italic mb-6" style={{ fontFamily: body }}>
          <Package size={14} strokeWidth={1.8} className="animate-pulse" />
          {t('Generating QR codes…', 'מייצר קודי QR…')}
        </p>
      )}

      {/* Cards grid */}
      <div className={`grid gap-6 print:gap-3 ${gridClass}`}>
        {cards.map((card) => (
          <PrintTableTent key={card.cocktail.slug} card={card} currency={currency} includeNote={includeNote} density={density} cardTheme={cardTheme} />
        ))}
      </div>
    </AdminShell>
  );
}

function Toggle<T extends string | number>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: ReadonlyArray<T>;
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<string, string>>;
}) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="text-white/40 text-10 tracking-[0.28em] uppercase" style={{ fontFamily: sans }}>
        {label}
      </span>
      <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
        {options.map((opt) => {
          const isActive = value === opt;
          const text = labels?.[String(opt)] ?? String(opt);
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3.5 py-1.5 rounded-full text-11 tracking-[0.08em] transition-all duration-300 ${
                isActive ? 'bg-amber-100 text-black' : 'text-white/55 hover:text-white/90'
              }`}
              style={{ fontFamily: sans, fontWeight: 500 }}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrintTableTent({
  card,
  currency,
  includeNote,
  density,
  cardTheme,
}: {
  card: PrintCard;
  currency: Currency;
  includeNote: boolean;
  density: Density;
  cardTheme: CardTheme;
}) {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const { cocktail } = card;
  const isCompact = density === 4;
  const isGold = cardTheme === 'gold';
  const accent = getAccent(cocktail.slug);

  return (
    <article
      className={`print-card rounded-xl border border-white/10 bg-zinc-950 print:bg-white print:border-amber-700/40 px-6 ${
        isCompact ? 'py-5' : 'py-8'
      } flex flex-col items-center text-center relative overflow-hidden`}
      style={
        // 1 & 2 per page use a fixed proportion; 4-up grows with its content
        // (at the narrow 4-column width a fixed ratio is too short and clips).
        isCompact ? { minHeight: '20rem' } : { aspectRatio: density === 1 ? '3 / 2' : '5 / 7' }
      }
    >
      {/* Screen-only chrome — never prints. Gold theme tints the backdrop with the cocktail accent. */}
      <div
        className="pointer-events-none absolute inset-0 print:hidden bg-gradient-to-b from-zinc-900 via-black to-zinc-950 opacity-60"
      />
      {isGold && (
        <>
          <span
            className="pointer-events-none absolute inset-0 print:hidden rounded-xl"
            style={{ boxShadow: `inset 0 0 0 1px ${accent}33, inset 0 70px 90px -70px ${accent}99` }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-x-6 top-0 h-px print:hidden"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}aa, transparent)` }}
            aria-hidden
          />
        </>
      )}

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-between">
        <div className="flex items-center gap-2 opacity-70 print:text-amber-700">
          <div className="w-8 h-px bg-amber-200/60 print:bg-amber-700/60" />
          <div className="w-1.5 h-1.5 border border-amber-200/80 print:border-amber-700/80 rotate-45" />
          <div className="w-8 h-px bg-amber-200/60 print:bg-amber-700/60" />
        </div>

        <p className="text-amber-200/85 print:text-amber-800 text-9 tracking-[0.5em] uppercase mt-3 mb-2" style={{ fontFamily: sans }}>
          {CATEGORY_LABEL[cocktail.category][lang]}
        </p>

        <h2
          className={`text-white print:text-black tracking-[0.03em] mb-2 ${isCompact ? 'text-2xl' : 'text-3xl md:text-4xl'}`}
          style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 500 }}
        >
          {cocktail.title[lang]}
        </h2>

        {cocktail.tagline && (
          <p
            className={`text-white/55 print:text-black/65 italic mb-4 max-w-xs leading-relaxed ${isCompact ? 'text-xs' : 'text-sm'}`}
            style={{ fontFamily: body }}
          >
            {cocktail.tagline[lang]}
          </p>
        )}

        {cocktail.heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cocktail.heroImage}
            alt={cocktail.title[lang]}
            className={`object-contain max-w-[80%] print:my-1 ${
              isCompact ? 'h-28 my-1' : density === 2 ? 'h-52 my-2' : 'h-64 my-2'
            }`}
          />
        )}

        {includeNote && cocktail.bartenderNote[lang] && !isCompact && (
          <blockquote className="text-white/65 print:text-black/65 italic max-w-xs leading-snug text-sm mt-3 mb-2" style={{ fontFamily: body }}>
            &ldquo;{cocktail.bartenderNote[lang]}&rdquo;
            {cocktail.bartenderName && (
              <footer className="text-amber-200/70 print:text-amber-700 text-9 tracking-[0.3em] uppercase mt-2 not-italic" style={{ fontFamily: sans }}>
                — {cocktail.bartenderName}
              </footer>
            )}
          </blockquote>
        )}

        <div className={`flex items-end justify-between w-full ${isCompact ? 'mt-2' : 'mt-4'}`}>
          <div className="text-left">
            <p className="text-amber-200/70 print:text-amber-700 text-8 tracking-[0.4em] uppercase mb-1" style={{ fontFamily: sans }}>
              {t('Scan', 'סרקו')}
            </p>
            <p className="text-white/55 print:text-black/55 text-9 italic" style={{ fontFamily: body }}>
              {t('for the 3D experience', 'לחוויה התלת-ממדית')}
            </p>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.qr} alt="" className={`${isCompact ? 'w-16 h-16' : 'w-20 h-20'} rounded-md`} />

          {cocktail.priceILS !== undefined ? (
            <p className="text-amber-100 print:text-black text-right text-lg" style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 500 }}>
              {formatPrice(cocktail.priceILS, currency)}
            </p>
          ) : (
            <div className="w-12" />
          )}
        </div>
      </div>
    </article>
  );
}

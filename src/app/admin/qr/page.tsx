'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Download, QrCode as QrIcon, ScanLine } from 'lucide-react';
import { MENU, type CocktailConfig, getAccent } from '@/data/cocktail';
import { useDrafts } from '@/lib/useDrafts';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel, Pill } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import { useOrigin } from '@/lib/useOrigin';

interface QrCard {
  cocktail: CocktailConfig;
  isDraft: boolean;
  dataUrl: string;
  url: string;
}

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  width: 600,
  margin: 1,
  errorCorrectionLevel: 'H',
  color: { dark: '#0a0a0a', light: '#fde68a' },
};

export function QrPanel() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const { drafts, hydrated } = useDrafts();
  const origin = useOrigin();
  const [cards, setCards] = useState<QrCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [arMode, setArMode] = useState(false);

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
    setGenerating(true);
    (async () => {
      const next: QrCard[] = [];
      for (const item of allCocktails) {
        const path = arMode
          ? `/ar/${item.cocktail.slug}`
          : item.isDraft
            ? `/drafts/${item.cocktail.slug}`
            : `/cocktails/${item.cocktail.slug}`;
        const url = `${origin}${path}`;
        try {
          const dataUrl = await QRCode.toDataURL(url, QR_OPTIONS);
          next.push({ cocktail: item.cocktail, isDraft: item.isDraft, dataUrl, url });
        } catch {
          // skip
        }
      }
      if (!cancelled) {
        setCards(next);
        setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, hydrated, allCocktails, arMode]);

  const handleDownload = (card: QrCard) => {
    const link = document.createElement('a');
    link.href = card.dataUrl;
    link.download = `qr-${card.cocktail.slug}.png`;
    link.click();
  };

  const handleDownloadAll = async () => {
    for (const card of cards) {
      handleDownload(card);
      await new Promise((r) => window.setTimeout(r, 200));
    }
  };

  return (
    <>
      <div className="mb-6 flex justify-end flex-wrap gap-3" dir={isHebrew ? 'rtl' : 'ltr'}>
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={generating || cards.length === 0}
          className="group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-xs tracking-[0.16em] uppercase text-white/80 transition-colors hover:border-amber-200/40 hover:text-amber-100 disabled:opacity-40"
          style={{ fontFamily: sans, fontWeight: 600 }}
        >
          <Download size={13} strokeWidth={1.8} />
          {t('Download all', 'הורד הכול')}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-13 tracking-[0.16em] uppercase text-black transition-shadow"
          style={{
            fontFamily: sans,
            fontWeight: 700,
            background: 'linear-gradient(105deg, var(--champagne-bright), var(--champagne) 55%, var(--champagne-deep))',
            boxShadow: '0 10px 34px rgba(232, 201, 135, 0.26)',
          }}
        >
          <QrIcon size={14} strokeWidth={2} />
          {t('Print sheet', 'הדפס גיליון')}
        </button>
      </div>

      <div className="no-print mb-4">
        <SectionLabel icon={ScanLine}>{t('Table tents · scan to taste', 'כרטיסי שולחן · סרקו לטעימה')}</SectionLabel>
      </div>

      <div className="no-print flex items-center gap-3 mb-10">
        <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {[
            { v: false, label: t('Breakdown', 'פירוק') },
            { v: true, label: t('AR view', 'תצוגת AR') },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setArMode(o.v)}
              className={`px-4 py-1.5 rounded-full text-10 tracking-[0.2em] uppercase transition-all ${
                arMode === o.v ? 'bg-amber-100 text-black' : 'text-white/55 hover:text-white/90'
              }`}
              style={{ fontFamily: sans, fontWeight: 500 }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {generating && (
          <span className="text-amber-200/60 text-sm italic">
            {t(`Generating ${allCocktails.length} QR codes…`, `מייצר ${allCocktails.length} קודי QR…`)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4" dir={isHebrew ? 'rtl' : 'ltr'}>
        {cards.map((card) => {
          const accent = getAccent(card.cocktail.slug);
          const heroImage = card.cocktail.heroImage;
          return (
            <div
              key={card.cocktail.slug}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-black/80 p-6 flex flex-col items-center text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_-24px_rgba(0,0,0,0.8)] transition-colors hover:border-amber-200/40 print:break-inside-avoid print:border-amber-700/40 print:bg-white print:shadow-none"
              style={{ boxShadow: `0 30px 90px -60px ${accent}` }}
            >
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-px print:hidden"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
                aria-hidden
              />

              {/* Cocktail glass — definite height, never crops */}
              {heroImage && (
                <GlassImage
                  src={heroImage}
                  accent={accent}
                  className="w-full h-28 mb-3 transition-transform duration-300 group-hover:scale-105 print:hidden"
                />
              )}

              <p className="text-amber-200/70 text-9 tracking-[0.4em] uppercase mb-1.5 print:text-amber-700" style={{ fontFamily: sans }}>
                {t('Scan to explore', 'סרקו לגילוי')}
              </p>
              <h3
                className="text-white text-xl mb-4 print:text-black"
                style={{
                  fontFamily: isHebrew ? 'var(--font-frank-ruhl, serif)' : serif,
                  fontStyle: isHebrew ? 'normal' : 'italic',
                  fontWeight: 600,
                }}
              >
                {card.cocktail.title[lang]}
              </h3>

              {/* QR — framed on warm paper, wrapped in a subtle accent ring + glow so it reads as a luxury object */}
              <div
                className="relative rounded-2xl p-2.5 mb-4 print:p-0 print:border print:border-amber-700/30"
                style={{
                  background: 'rgba(253,230,138,0.08)',
                  border: `1px solid ${accent}55`,
                  boxShadow: `0 0 0 1px ${accent}22, 0 16px 50px -28px ${accent}`,
                }}
              >
                <span
                  className="pointer-events-none absolute -inset-px rounded-2xl print:hidden"
                  style={{ boxShadow: `inset 0 0 18px -6px ${accent}66` }}
                  aria-hidden
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.dataUrl}
                  alt={t(`QR for ${card.cocktail.title.en}`, `קוד QR עבור ${card.cocktail.title[lang]}`)}
                  className="relative w-40 h-40 rounded-lg"
                />
              </div>

              <p className="text-white/40 text-10 mb-4 break-all max-w-full print:text-black/60" style={{ fontFamily: sans }} dir="ltr">
                {card.url.replace(/^https?:\/\//, '')}
              </p>

              <button
                type="button"
                onClick={() => handleDownload(card)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-amber-200/40 text-amber-100 hover:bg-amber-200/10 transition-colors text-10 tracking-[0.3em] uppercase print:hidden"
                style={{ fontFamily: sans }}
              >
                <Download size={12} strokeWidth={1.8} />
                {t('Download PNG', 'הורד PNG')}
              </button>

              {card.isDraft && (
                <div className="mt-3 print:hidden">
                  <Pill icon={QrIcon} text={t('Draft only · localStorage', 'טיוטה בלבד · localStorage')} accent="#fda4af" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function QrAdminPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  return (
    <AdminShell
      title="QR Table Tents"
      titleHe="כרטיסי QR"
      eyebrow="QR Codes"
      eyebrowHe="קודי QR"
      active="/admin/qr"
      subtitle="Download each QR or print the whole sheet on tag stock. A scan jumps straight to the 3D breakdown experience."
      subtitleHe="הורד כל קוד QR או הדפס את הגיליון כולו. סריקה קופצת ישר לחוויית הפירוק התלת-ממדית."
    >
      <QrPanel />
    </AdminShell>
  );
}

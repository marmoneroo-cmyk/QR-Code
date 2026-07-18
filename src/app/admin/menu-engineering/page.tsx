'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Star, Beef, Puzzle, TrendingDown } from 'lucide-react';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, LiveDot, SectionLabel, Skeleton, SkeletonGrid } from '@/components/ui/dataviz';
import { HoverLift, AccentWash } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { GlassCard, PanelHeader, ErrorState } from '@/components/ui/premium';
import { useLang } from '@/lib/useLang';
import { hasConfidentSample } from '@/lib/analytics/rate';
import type { MenuClass, MenuEngineering, MenuEngineeringItem } from '@/lib/analytics/types';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

interface ClassMeta {
  label: { en: string; he: string };
  rec: { en: string; he: string };
  color: string;
  tint: string;
  icon: LucideIcon;
}

const CLASS_META: Record<MenuClass, ClassMeta> = {
  star: {
    label: { en: 'Stars', he: 'כוכבים' },
    rec: { en: 'Feature first · protect quality', he: 'הצג ראשון · שמור על איכות' },
    color: '#fbbf24',
    tint: 'rgba(251,191,36,0.07)',
    icon: Star,
  },
  plowhorse: {
    label: { en: 'Plowhorses', he: 'סוסי עבודה' },
    rec: { en: 'Popular, thin margin — nudge price up', he: 'פופולרי, רווח דק — העלה מחיר' },
    color: '#7dd3fc',
    tint: 'rgba(125,211,252,0.07)',
    icon: Beef,
  },
  puzzle: {
    label: { en: 'Puzzles', he: 'חידות' },
    rec: { en: 'High margin, low demand — promote', he: 'רווח גבוה, ביקוש נמוך — קדם' },
    color: '#c4b5fd',
    tint: 'rgba(196,181,253,0.07)',
    icon: Puzzle,
  },
  dog: {
    label: { en: 'Dogs', he: 'כלבים' },
    rec: { en: 'Low on both — rework or cut', he: 'נמוך בשניהם — שנה או הסר' },
    color: '#fb7185',
    tint: 'rgba(251,113,133,0.07)',
    icon: TrendingDown,
  },
};

/** Class order top→bottom in the legend / per-item priority. */
const CLASS_ORDER: MenuClass[] = ['star', 'plowhorse', 'puzzle', 'dog'];

interface EnrichedItem extends MenuEngineeringItem {
  title: { en: string; he: string };
  hero: string;
  accent: string;
}

export function MenuEngineeringPanel() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const { data, loading, error: fetchError, reload } = useApiData<MenuEngineering>(
    '/api/analytics/menu-engineering',
    { refreshInterval: 20000 },
  );
  const error = Boolean(fetchError);
  const load = reload;

  /** Slug currently hovered in the matrix (drives popover + scale). */
  const [hovered, setHovered] = useState<string | null>(null);
  /** Slug pinned by a click — stays highlighted in the matrix and below. */
  const [selected, setSelected] = useState<string | null>(null);
  /** Slug whose card shows a transient glow after a matrix click (~2s). */
  const [flashed, setFlashed] = useState<string | null>(null);

  /** Refs to each per-item card so a matrix click can scroll to it. */
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const flashTimer = useRef<number | null>(null);

  const registerCard = useCallback((slug: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(slug, el);
    else cardRefs.current.delete(slug);
  }, []);

  /** Pin the item, scroll its card into view, and flash a glow ring for ~2s. */
  const selectItem = useCallback((slug: string) => {
    setSelected(slug);
    const el = cardRefs.current.get(slug);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashed(slug);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashed(null), 2000);
  }, []);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  /** Enrich each item with its cocktail visuals; drop any without a matching cocktail. */
  const items: EnrichedItem[] = useMemo(() => {
    return (data?.items ?? [])
      .map((r) => {
        const c = findCocktailBySlug(r.slug);
        return c ? { ...r, title: c.title, hero: c.heroImage, accent: getAccent(r.slug) } : null;
      })
      .filter((x): x is EnrichedItem => Boolean(x));
  }, [data]);

  const counts = useMemo(() => {
    const base: Record<MenuClass, number> = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
    for (const i of items) base[i.klass] += 1;
    return base;
  }, [items]);

  const xMax = Math.max(1, ...items.map((i) => i.units));
  const yMax = Math.max(1, ...items.map((i) => i.margin));
  const medDemand = data?.medianDemand ?? 0;
  const medMargin = data?.medianMargin ?? 0;
  // Position each thumbnail so the MEDIAN lands exactly on the 50% quadrant boundary (the
  // crosshair) — the server classifies by median, so max-normalizing here could draw an item
  // in the wrong quadrant (e.g. a "Star" sitting in the "Dog" corner). Piecewise-linear:
  // [0..median] → [0..50%], [median..max] → [50%..100%], then inset so thumbnails don't clip.
  const axisFrac = (value: number, med: number, max: number): number => {
    const f =
      med <= 0
        ? 0.12
        : value <= med
          ? (value / med) * 0.5
          : 0.5 + ((value - med) / Math.max(1e-9, max - med)) * 0.5;
    return Math.max(0, Math.min(1, f));
  };
  const pos = (i: EnrichedItem) => ({
    left: `${12 + axisFrac(i.units, medDemand, xMax) * 76}%`,
    bottom: `${15 + axisFrac(i.margin, medMargin, yMax) * 70}%`,
  });

  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col gap-12" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="flex justify-end">
        <LiveDot label={isHebrew ? 'חי' : 'Live'} />
      </div>

      {/* Error state: load failed and we have no prior successful data — replaces the zeroed KPI strip + empty matrix */}
      {!loading && error && !hasItems && (
        <GlassCard className="p-10" static>
          <ErrorState
            title={t('Couldn’t load — check your connection', 'טעינה נכשלה — בדקו את החיבור')}
            onRetry={load}
            retryLabel={t('Try again', 'נסו שוב')}
          />
        </GlassCard>
      )}

      {/* Class summary KPI strip */}
      {!(error && !hasItems) && (
        loading && !hasItems ? (
          <SkeletonGrid count={4} className="grid grid-cols-2 lg:grid-cols-4 gap-3" />
        ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CLASS_ORDER.map((k) => {
            const meta = CLASS_META[k];
            const Icon = meta.icon;
            return (
              <GlassCard key={k} className="p-4" style={{ borderColor: `${meta.color}33` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ color: meta.color, background: `${meta.color}1a` }}>
                    <Icon size={15} strokeWidth={1.8} />
                  </span>
                </div>
                <p className="text-white text-2xl leading-tight" style={{ fontFamily: serif, fontWeight: 700 }}>{counts[k]}</p>
                <p className="text-11 mt-1 tracking-wide" style={{ color: meta.color, fontFamily: sans }}>{meta.label[lang]}</p>
              </GlassCard>
            );
          })}
        </section>
        )
      )}

      {/* Premium 2×2 matrix with cocktail thumbnails */}
      {!(error && !hasItems) && (
      <GlassCard className="p-6" static>
        <div className="flex items-center justify-between mb-4">
          <PanelHeader label={t('The matrix', 'המטריצה')} />
          <p className="text-white/30 text-9 tracking-wider" style={{ fontFamily: sans }}>
            {t('↑ margin · → demand', '↑ רווח · → ביקוש')}
          </p>
        </div>
        <div className="relative w-full" style={{ height: 420 }} dir="ltr">
          {/* quadrant tints: TL puzzle, TR star, BL dog, BR plowhorse */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 rounded-2xl overflow-hidden">
            <div style={{ background: CLASS_META.puzzle.tint }} />
            <div style={{ background: CLASS_META.star.tint }} />
            <div style={{ background: CLASS_META.dog.tint }} />
            <div style={{ background: CLASS_META.plowhorse.tint }} />
          </div>
          {/* median crosshair */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
          {/* corner labels with icons */}
          <QuadrantLabel klass="puzzle" lang={lang} className="top-3 left-3" />
          <QuadrantLabel klass="star" lang={lang} className="top-3 right-3" />
          <QuadrantLabel klass="dog" lang={lang} className="bottom-3 left-3" />
          <QuadrantLabel klass="plowhorse" lang={lang} className="bottom-3 right-3" />
          {/* thumbnails */}
          {items.map((i) => (
            <MatrixThumb
              key={i.slug}
              item={i}
              lang={lang}
              t={t}
              pos={pos(i)}
              isHovered={hovered === i.slug}
              isSelected={selected === i.slug}
              isDimmed={selected !== null && selected !== i.slug && hovered !== i.slug}
              onHover={setHovered}
              onSelect={selectItem}
            />
          ))}
          {loading && !hasItems && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-2xl" />
          )}
        </div>
      </GlassCard>
      )}

      {/* Per-item image cards */}
      {hasItems && (
        <section>
          <SectionLabel>{t('Every drink', 'כל משקה')}</SectionLabel>
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((i) => (
              <ItemCard
                key={i.slug}
                item={i}
                lang={lang}
                t={t}
                registerCard={registerCard}
                isSelected={selected === i.slug}
                isFlashed={flashed === i.slug}
              />
            ))}
          </Stagger>
        </section>
      )}

      {/* Recommendations legend */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CLASS_ORDER.map((k) => {
          const meta = CLASS_META[k];
          const Icon = meta.icon;
          return (
            <GlassCard key={k} className="p-4" style={{ borderColor: `${meta.color}33` }} static>
              <div dir={isHebrew ? 'rtl' : 'ltr'} className="flex items-start gap-3">
                <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0" style={{ color: meta.color, background: `${meta.color}1a` }}>
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-11 tracking-[0.3em] uppercase mb-1" style={{ color: meta.color, fontFamily: sans }}>{meta.label[lang]}</p>
                  <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: sans }}>{meta.rec[lang]}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </section>

      <p className="text-center text-white/30 text-10 tracking-[0.4em] uppercase pt-6 border-t border-white/10" style={{ fontFamily: sans }}>
        {t('Seeded cost estimates · override per drink', 'הערכות עלות · עדכן לכל משקה')}
      </p>
    </div>
  );
}

function QuadrantLabel({ klass, lang, className }: { klass: MenuClass; lang: 'en' | 'he'; className: string }) {
  const meta = CLASS_META[klass];
  const Icon = meta.icon;
  return (
    <span className={`absolute inline-flex items-center gap-1.5 text-9 tracking-[0.3em] uppercase ${className}`} style={{ color: `${meta.color}cc`, fontFamily: sans }}>
      <Icon size={11} strokeWidth={2} /> {meta.label[lang]}
    </span>
  );
}

interface MatrixThumbProps {
  item: EnrichedItem;
  lang: 'en' | 'he';
  t: (en: string, he: string) => string;
  pos: { left: string; bottom: string };
  isHovered: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string) => void;
}

/** A positioned, interactive cocktail thumbnail inside the 2×2 matrix.
 *  Hover scales it + adds an accent ring and a real-data stat popover.
 *  Click pins it (selected) and scrolls to the matching card below. */
function MatrixThumb({ item, lang, t, pos, isHovered, isSelected, isDimmed, onHover, onSelect }: MatrixThumbProps) {
  const meta = CLASS_META[item.klass];
  const active = isHovered || isSelected;
  // Popover flips to the inner side near the right edge so it never causes horizontal scroll.
  const nearRight = parseFloat(pos.left) > 55;

  return (
    <button
      type="button"
      onMouseEnter={() => onHover(item.slug)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item.slug)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(item.slug)}
      aria-label={`${item.title[lang]} — ${meta.label[lang]}`}
      className="group absolute flex -translate-x-1/2 translate-y-1/2 flex-col items-center rounded-2xl outline-none transition-[opacity,transform] duration-300 focus-visible:ring-2"
      style={{
        left: pos.left,
        bottom: pos.bottom,
        opacity: isDimmed ? 0.4 : 1,
        zIndex: active ? 30 : 10,
      }}
    >
      <span
        className="rounded-full p-[2px] transition-transform duration-300"
        style={{
          transform: active ? 'scale(1.22)' : 'scale(1)',
          boxShadow: active ? `0 0 26px ${meta.color}` : `0 0 16px ${meta.color}66`,
          border: `${isSelected ? 2 : 1}px solid ${active ? meta.color : `${meta.color}99`}`,
        }}
      >
        <GlassImage src={item.hero} accent={item.accent} className="h-16 w-16 rounded-full" />
      </span>
      <span
        className="mt-1.5 max-w-[92px] truncate text-center text-10 leading-tight transition-colors"
        style={{ fontFamily: sans, color: active ? meta.color : 'rgba(255,255,255,0.65)' }}
      >
        {item.title[lang]}
      </span>

      {/* Stat popover — real data only; shown on hover/focus. */}
      {isHovered && (
        <span
          dir={lang === 'he' ? 'rtl' : 'ltr'}
          className="pointer-events-none absolute bottom-full z-40 mb-2 w-44 rounded-xl border p-3 text-start backdrop-blur-md"
          style={{
            [nearRight ? 'right' : 'left']: 0,
            background: 'rgba(0,0,0,0.82)',
            borderColor: `${meta.color}66`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px ${meta.color}22`,
          }}
        >
          <span
            className="mb-1.5 block truncate text-13 leading-tight text-white"
            style={{ fontFamily: serif, fontWeight: 700 }}
          >
            {item.title[lang]}
          </span>
          <span
            className="mb-2 block text-9 uppercase tracking-[0.2em]"
            style={{ color: meta.color, fontFamily: sans }}
          >
            {meta.label[lang]}
          </span>
          <span className="grid grid-cols-3 gap-1 text-center">
            <PopStat v={`${Math.round(item.marginPct)}%`} l={t('margin', 'רווח')} accent={meta.color} />
            <PopStat v={hasConfidentSample(item.views) ? `${Math.round(item.conversionPct)}%` : '—'} l={t('order rate', 'אחוז הזמנה')} />
            <PopStat v={`${item.views}`} l={t('views', 'צפיות')} />
          </span>
        </span>
      )}
    </button>
  );
}

/** Compact stat used inside the matrix popover. */
function PopStat({ v, l, accent }: { v: string; l: string; accent?: string }) {
  return (
    <span className="block">
      <span className="block text-13" style={{ color: accent ?? 'rgba(255,255,255,0.9)', fontFamily: serif, fontWeight: 700 }}>{v}</span>
      <span className="block text-8 tracking-wide text-white/40" style={{ fontFamily: sans }}>{l}</span>
    </span>
  );
}

interface ItemCardProps {
  item: EnrichedItem;
  lang: 'en' | 'he';
  t: (en: string, he: string) => string;
  registerCard: (slug: string, el: HTMLDivElement | null) => void;
  isSelected: boolean;
  isFlashed: boolean;
}

function ItemCard({ item, lang, t, registerCard, isSelected, isFlashed }: ItemCardProps) {
  const meta = CLASS_META[item.klass];
  const Icon = meta.icon;
  const borderColor = isSelected ? meta.color : `${meta.color}30`;
  return (
    <motion.div variants={staggerItem}>
      <HoverLift accent={item.accent} className="h-full rounded-3xl">
        <div
          ref={(el) => registerCard(item.slug, el)}
          className="group relative h-full overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.04] to-transparent p-4 transition-[box-shadow,border-color] duration-500"
          style={{
            borderColor,
            boxShadow: isFlashed ? `0 0 0 2px ${meta.color}, 0 0 28px ${meta.color}80` : 'none',
          }}
          dir={lang === 'he' ? 'rtl' : 'ltr'}
        >
          <AccentWash accent={item.accent} />
          <span className="absolute top-3 end-3 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-9 tracking-[0.15em] uppercase backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.4)', color: meta.color, border: `1px solid ${meta.color}66`, fontFamily: sans }}>
            <Icon size={10} strokeWidth={2} /> {meta.label[lang]}
          </span>
          <GlassImage src={item.hero} accent={item.accent} className="relative w-full h-44 mb-3 transition-transform duration-500 group-hover:scale-105" />
          <p className="relative text-white/90 text-15 text-center leading-tight mb-3" style={{ fontFamily: serif, fontStyle: lang === 'he' ? 'normal' : 'italic', fontWeight: 600 }}>
            {item.title[lang]}
          </p>
          <div className="relative grid grid-cols-3 gap-1 text-center">
            <Stat v={`${Math.round(item.marginPct)}%`} l={t('margin', 'רווח')} accent={meta.color} />
            <Stat v={hasConfidentSample(item.views) ? `${Math.round(item.conversionPct)}%` : '—'} l={t('order rate', 'אחוז הזמנה')} />
            <Stat v={`${item.views}`} l={t('views', 'צפיות')} />
          </div>
        </div>
      </HoverLift>
    </motion.div>
  );
}

function Stat({ v, l, accent }: { v: string; l: string; accent?: string }) {
  return (
    <div>
      <p className="text-sm" style={{ color: accent ?? 'rgba(255,255,255,0.9)', fontFamily: serif, fontWeight: 700 }}>{v}</p>
      <p className="text-white/40 text-9 tracking-wide" style={{ fontFamily: sans }}>{l}</p>
    </div>
  );
}

export default function MenuEngineeringPage() {
  return (
    <AdminShell
      title="Menu Engineering"
      titleHe="הנדסת תפריט"
      eyebrow="Profitability × Demand"
      eyebrowHe="רווחיות × ביקוש"
      active="/admin/menu-engineering"
      subtitle="Each drink plotted by margin and real demand, then classified Star / Plowhorse / Puzzle / Dog — with a concrete action for each."
      subtitleHe="כל משקה ממופה לפי רווח וביקוש אמיתי, ומסווג כוכב / סוס עבודה / חידה / כלב — עם פעולה קונקרטית לכל אחד."
    >
      <MenuEngineeringPanel />
    </AdminShell>
  );
}

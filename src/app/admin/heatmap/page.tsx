'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Moon, Clock } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { KpiCard, SectionLabel, Skeleton, SkeletonGrid } from '@/components/ui/dataviz';
import { GlassCard, EmptyState } from '@/components/ui/premium';
import { useLang } from '@/lib/useLang';
import type { AttentionHeatmap, HeatmapSection } from '@/lib/analytics/heatmap';

const SECTION_LABEL: Record<string, { en: string; he: string }> = {
  hero: { en: 'Hero image', he: 'תמונת הירו' },
  ingredients: { en: 'Ingredients', he: 'מרכיבים' },
  flavor: { en: 'Flavor profile', he: 'פרופיל טעמים' },
  story: { en: 'Story', he: 'סיפור' },
  also_viewed: { en: 'Also viewed', he: 'צפו גם ב' },
  video: { en: 'Video', he: 'סרטון' },
  price: { en: 'Price', he: 'מחיר' },
};

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const ACCENT = '#fbbf24';

/** Canonical top-to-bottom order the sections appear to a guest on the cocktail page. */
const CANONICAL_ORDER = ['hero', 'ingredients', 'flavor', 'story', 'video', 'also_viewed', 'price'] as const;

/** Orders sections as a guest scrolls the page: known sections in canonical order first,
 *  then any unrecognized sections appended (so nothing in the data is ever dropped). */
function orderForMockup(sections: readonly HeatmapSection[]): HeatmapSection[] {
  const rank = new Map<string, number>(CANONICAL_ORDER.map((s, i) => [s, i]));
  return [...sections].sort((a, b) => {
    const ra = rank.get(a.section) ?? CANONICAL_ORDER.length;
    const rb = rank.get(b.section) ?? CANONICAL_ORDER.length;
    return ra === rb ? b.views - a.views : ra - rb;
  });
}

/** Amber-scaled cell style: faint white at low intensity → saturated amber glow at high. */
function cellStyle(intensity: number): React.CSSProperties {
  const t = Math.max(0, Math.min(1, intensity));
  const bgAlpha = 0.04 + t * 0.5; // 0.04 → 0.54
  const borderAlpha = 0.06 + t * 0.55;
  const glow = t > 0.55 ? `0 0 ${Math.round(t * 34)}px -6px ${ACCENT}` : 'none';
  return {
    background: `linear-gradient(135deg, rgba(251,191,36,${bgAlpha.toFixed(3)}), rgba(251,191,36,${(bgAlpha * 0.55).toFixed(3)}))`,
    borderColor: `rgba(251,191,36,${borderAlpha.toFixed(3)})`,
    boxShadow: glow,
  };
}

const sectionLabel = (section: string, lang: 'en' | 'he'): string =>
  SECTION_LABEL[section]?.[lang] ?? section;

/** Body only (no AdminShell) — composed by the Menu Analysis workspace and the standalone route. */
export function HeatmapPanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);
  const [data, setData] = useState<AttentionHeatmap | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/heatmap', { cache: 'no-store' });
      const json: { success: boolean; data?: AttentionHeatmap } = await res.json();
      setData(json.success && json.data ? json.data : { sections: [], hasData: false });
    } catch {
      setData({ sections: [], hasData: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => data?.sections ?? [], [data]);
  const maxViews = useMemo(() => sections.reduce((m, s) => Math.max(m, s.views), 0), [sections]);
  const orderedSections = useMemo(() => orderForMockup(sections), [sections]);
  const hottestSection = useMemo(
    () => sections.reduce<string | null>((hot, s) => (s.views === maxViews ? s.section : hot), null),
    [sections, maxViews],
  );

  const stats = useMemo(() => {
    if (sections.length === 0) return null;
    const byViews = [...sections].sort((a, b) => b.views - a.views);
    const byDwell = [...sections].sort((a, b) => b.avgDwellMs - a.avgDwellMs);
    return {
      peak: byViews[0],
      quietest: byViews[byViews.length - 1],
      longest: byDwell[0],
    };
  }, [sections]);

  if (loading) {
    return (
      <div className="flex flex-col gap-10" dir={isHe ? 'rtl' : 'ltr'}>
        <SkeletonGrid count={3} className="grid grid-cols-1 sm:grid-cols-3 gap-3" />
        <section>
          <Skeleton className="mb-4 h-3 w-40" />
          <div className="mx-auto w-full max-w-[360px] flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={`w-full rounded-xl ${i === 0 ? 'h-[88px]' : 'h-[64px]'}`} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!data?.hasData || !stats) {
    return (
      <GlassCard className="p-12" static>
        <div dir={isHe ? 'rtl' : 'ltr'}>
          <EmptyState title={t('No attention data yet. Collect real guest visits.', 'אין עדיין נתוני תשומת לב. אספו עוד ביקורי אורחים.')} />
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-10" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Callout KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label={t('Drew the most attention', 'משך הכי הרבה תשומת לב')}
          value={sectionLabel(stats.peak.section, lang)}
          accent={ACCENT}
          icon={Flame}
          hint={`${stats.peak.views.toLocaleString()} ${t('views', 'צפיות')}`}
        />
        <KpiCard
          label={t('Quietest section', 'החלק השקט ביותר')}
          value={sectionLabel(stats.quietest.section, lang)}
          accent="#7dd3fc"
          icon={Moon}
          hint={`${stats.quietest.views.toLocaleString()} ${t('views', 'צפיות')}`}
        />
        <KpiCard
          label={t('Held the eye longest', 'החזיק את העין הכי הרבה')}
          value={`${(stats.longest.avgDwellMs / 1000).toFixed(1)}s`}
          accent="#34d399"
          icon={Clock}
          hint={sectionLabel(stats.longest.section, lang)}
        />
      </section>

      {/* Page mockup with heat overlay */}
      <GlassCard className="p-6 sm:p-7" static>
        <SectionLabel icon={Flame}>{t('The page, lit by attention', 'הדף, מואר לפי תשומת לב')}</SectionLabel>

        {/* Phone / page frame — centered, max ~360px, the cocktail page top-to-bottom */}
        <div className="mx-auto w-full max-w-[360px]">
          <div className="rounded-[2rem] border border-white/12 bg-black/40 p-2.5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
            <div className="rounded-[1.6rem] border border-white/[0.06] bg-zinc-950/60 p-2 flex flex-col gap-2">
              {orderedSections.map((s) => (
                <MockupSection
                  key={s.section}
                  section={s}
                  maxViews={maxViews}
                  isHottest={s.section === hottestSection}
                  lang={lang}
                  isHe={isHe}
                />
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-white/30 text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
            {t('Top to bottom, as a guest sees it', 'מלמעלה למטה, כפי שאורח רואה')}
          </p>
        </div>

        {/* Horizontal heat legend: cold → hot */}
        <div className="mx-auto mt-7 flex max-w-[360px] items-center gap-3" style={{ fontFamily: sans }}>
          <span className="text-white/35 text-[10px] tracking-[0.25em] uppercase whitespace-nowrap">{t('Cold', 'קר')}</span>
          <div
            className="h-2 flex-1 rounded-full border border-white/[0.06]"
            style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.04), rgba(251,191,36,0.45) 60%, ${ACCENT})` }}
            aria-hidden
          />
          <span className="inline-flex items-center gap-1 text-amber-200/80 text-[10px] tracking-[0.25em] uppercase whitespace-nowrap">
            <Flame size={11} strokeWidth={2} /> {t('Hot', 'חם')}
          </span>
        </div>
      </GlassCard>
    </div>
  );
}

interface MockupSectionProps {
  section: HeatmapSection;
  maxViews: number;
  isHottest: boolean;
  lang: 'en' | 'he';
  isHe: boolean;
}

/** One section block in the page mockup, tinted by its attention intensity. */
function MockupSection({ section, maxViews, isHottest, lang, isHe }: MockupSectionProps) {
  const intensity = maxViews > 0 ? section.views / maxViews : 0;
  const bright = intensity > 0.5;
  const isHero = section.section === 'hero';
  const textColor = bright ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.72)';
  const metaColor = bright ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.4)';
  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition-transform hover:scale-[1.01] ${
        isHero ? 'min-h-[88px]' : 'min-h-[64px]'
      }`}
      style={cellStyle(intensity)}
    >
      {isHottest && (
        <span
          className={`absolute top-2 grid h-6 w-6 place-items-center rounded-full ${isHe ? 'left-2' : 'right-2'}`}
          style={{ color: '#fff', background: 'rgba(0,0,0,0.28)', boxShadow: `0 0 14px -2px ${ACCENT}` }}
          title={isHe ? 'החלק החם ביותר' : 'Hottest section'}
        >
          <Flame size={13} strokeWidth={2.2} fill={ACCENT} />
        </span>
      )}
      <div className={`min-w-0 ${isHottest ? (isHe ? 'pl-7' : 'pr-7') : ''}`}>
        <p className="text-[13px] leading-tight truncate" style={{ color: textColor, fontFamily: sans }}>
          {sectionLabel(section.section, lang)}
        </p>
        <p className="text-[10px] mt-0.5 tracking-wide" style={{ color: metaColor, fontFamily: sans }}>
          {(section.avgDwellMs / 1000).toFixed(1)}s {isHe ? 'בממוצע' : 'avg dwell'}
        </p>
      </div>
      <p
        className="shrink-0 text-xl leading-none tabular-nums"
        style={{ color: bright ? '#fff' : 'rgba(255,255,255,0.85)', fontFamily: serif, fontWeight: 700 }}
      >
        {section.views.toLocaleString()}
      </p>
    </div>
  );
}

export default function HeatmapPage() {
  return (
    <AdminShell
      title="Attention Heatmap"
      titleHe="מפת תשומת לב"
      eyebrow="Which part drew the eye"
      eyebrowHe="מה משך את העין"
      active="/admin/heatmap"
      subtitle="How long each part of the cocktail page actually held attention — data you can't get any other way."
      subtitleHe="כמה זמן כל חלק בדף הקוקטייל באמת החזיק תשומת לב — נתון שאי אפשר לקבל בשום דרך אחרת."
    >
      <HeatmapPanel />
    </AdminShell>
  );
}

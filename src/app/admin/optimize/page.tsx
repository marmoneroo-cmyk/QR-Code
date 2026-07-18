'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Wrench, ArrowUpCircle, BadgePercent, Scissors, Star, ShieldCheck, Trash2, ShoppingBag, ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, Pill, Skeleton } from '@/components/ui/dataviz';
import { HoverLift, AccentWash, BeforeAfterImage } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { EmptyState } from '@/components/ui/premium';
import { useLang } from '@/lib/useLang';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import type { MenuEngineering, MenuEngineeringItem } from '@/lib/analytics/types';
import { buildRecommendations, type Recommendation, type Confidence, type RecAction } from '@/lib/optimization';
import { estimatePotential, buildMenuBenchmark } from '@/lib/value/potential';
import { PotentialValue } from '@/components/ui/value';
import { formatILS } from '@/lib/format';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';

/** Map qualitative confidence to a presentational % for the AI badge. */
const CONFIDENCE_PCT: Record<Confidence, number> = { low: 60, medium: 78, high: 92 };

const CONFIDENCE_LABEL: Record<Confidence, { en: string; he: string }> = {
  high: { en: 'AI confidence', he: 'ביטחון AI' },
  medium: { en: 'AI confidence', he: 'ביטחון AI' },
  low: { en: 'AI · low data', he: 'AI · מעט נתונים' },
};

/** Each action carries an icon + accent colour for instant visual scanning. */
const ACTION: Record<RecAction, { en: string; he: string; icon: LucideIcon; color: string }> = {
  fix_offer: { en: 'Fix offer', he: 'תקנו הצעה', icon: Wrench, color: '#f59e0b' },
  promote_position: { en: 'Promote', he: 'קדמו', icon: ArrowUpCircle, color: '#7dd3fc' },
  raise_price: { en: 'Raise price', he: 'העלו מחיר', icon: BadgePercent, color: '#34d399' },
  reduce_cost: { en: 'Reduce cost', he: 'הפחיתו עלות', icon: Scissors, color: '#a78bfa' },
  feature: { en: 'Feature it', he: 'הדגישו', icon: Star, color: '#fbbf24' },
  keep_position: { en: 'Keep', he: 'שמרו', icon: ShieldCheck, color: '#34d399' },
  review_or_remove: { en: 'Review', he: 'בדקו', icon: Trash2, color: '#fb7185' },
};

function ActionBadge({ action, lang }: { action: RecAction; lang: 'en' | 'he' }) {
  const a = ACTION[action];
  const Icon = a.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] tracking-[0.18em] uppercase"
      style={{ color: a.color, background: `${a.color}1a`, border: `1px solid ${a.color}55`, fontFamily: sans, fontWeight: 600 }}
    >
      <Icon size={12} strokeWidth={2} /> {a[lang]}
    </span>
  );
}

/** Short, glance-able "after" badge for the visual before/after, keyed by action. */
function afterBadge(action: RecAction, lang: 'en' | 'he'): string {
  const isHe = lang === 'he';
  switch (action) {
    case 'fix_offer':
      return isHe ? 'משופר' : 'fixed';
    case 'promote_position':
    case 'feature':
      return isHe ? 'מומלץ' : 'featured';
    case 'raise_price':
      return '₪';
    default:
      return isHe ? 'מבצע' : 'promo';
  }
}

/** Actions that send the manager to the promotions composer, prefilled with the drink. */
const PROMOTION_ACTIONS: ReadonlySet<RecAction> = new Set<RecAction>(['promote_position', 'feature']);
/** Actions that open the cocktail editor for that drink. */
const EDITOR_ACTIONS: ReadonlySet<RecAction> = new Set<RecAction>(['fix_offer', 'raise_price', 'reduce_cost', 'review_or_remove']);

/** Resolve the "Apply" destination for a recommendation, or null when there's nothing to apply. */
function applyHref(action: RecAction, slug: string): string | null {
  if (PROMOTION_ACTIONS.has(action)) return `/admin/promote?cocktail=${encodeURIComponent(slug)}`;
  if (EDITOR_ACTIONS.has(action)) return `/admin/${encodeURIComponent(slug)}/edit`;
  return null; // keep_position → no Apply
}

/** Amber luxury pill that routes to the editor/promotions screen for this recommendation. */
function ApplyAction({ action, slug, lang }: { action: RecAction; slug: string; lang: 'en' | 'he' }) {
  const href = applyHref(action, slug);
  // Arrow points toward reading flow: left in RTL (Hebrew), right in LTR.
  const Arrow = lang === 'he' ? ArrowLeft : ArrowRight;

  if (!href) {
    // keep_position — nothing to change; show a calm disabled "Keep" chip.
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] tracking-[0.12em] uppercase select-none"
        style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: sans, fontWeight: 600 }}
        aria-disabled
      >
        <ShieldCheck size={13} strokeWidth={2} className="shrink-0" />
        {lang === 'he' ? 'שמרו כפי שהוא' : 'Keep as is'}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="group/apply inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] tracking-[0.12em] uppercase transition-colors hover:bg-amber-300/20"
      style={{ color: 'var(--warning)', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.45)', fontFamily: sans, fontWeight: 600 }}
    >
      <Lightbulb size={13} strokeWidth={2} className="shrink-0" />
      {lang === 'he' ? 'החל' : 'Apply'}
      <Arrow size={13} strokeWidth={2} className="shrink-0 transition-transform group-hover/apply:translate-x-0.5" />
    </Link>
  );
}

export function OptimizePanel() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const [data, setData] = useState<MenuEngineering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sales, setSales] = useState<Record<string, { units: number; revenue: number }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [meRes, salesRes] = await Promise.all([
        fetch('/api/analytics/menu-engineering', { cache: 'no-store' }),
        fetch('/api/sales', { cache: 'no-store' }),
      ]);
      const meJson: { success: boolean; data?: MenuEngineering } = await meRes.json();
      if (meJson.success && meJson.data) setData(meJson.data);
      else setError(true);
      // Sales are optional (table may not exist yet) — degrade gracefully.
      const salesJson: { success: boolean; data?: { slug: string; units: number; revenue: number }[] } = await salesRes.json();
      if (salesJson.success && salesJson.data) {
        const map: Record<string, { units: number; revenue: number }> = {};
        for (const s of salesJson.data) map[s.slug] = { units: s.units, revenue: s.revenue };
        setSales(map);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recommendations = useMemo<Recommendation[]>(
    () => (data ? buildRecommendations(data.items) : []),
    [data],
  );

  // Achievable benchmark (menu's own medians) — basis for every upside estimate.
  const bench = useMemo(
    () => buildMenuBenchmark(data?.items ?? []),
    [data],
  );

  // slug → analytics item, so each card can estimate its own honest upside.
  const itemBySlug = useMemo(() => {
    const map = new Map<string, MenuEngineeringItem>();
    for (const it of data?.items ?? []) map.set(it.slug, it);
    return map;
  }, [data]);

  return (
    <>
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" dir={isHebrew ? 'rtl' : 'ltr'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-3xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-rose-300/80 text-sm" style={{ fontFamily: sans }}>
          {isHebrew ? 'טעינת הנתונים נכשלה.' : 'Failed to load data.'}
        </p>
      )}

      {!loading && !error && recommendations.length === 0 && (
        <EmptyState
          title={
            isHebrew
              ? 'אין עדיין מספיק נתונים להמלצות. אספו עוד ביקורי אורחים וחזרו.'
              : 'Not enough data for recommendations yet. Collect more guest visits and come back.'
          }
        />
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div dir={isHebrew ? 'rtl' : 'ltr'}>
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((r) => {
            const cocktail = findCocktailBySlug(r.slug);
            const accent = getAccent(r.slug);
            const title = cocktail?.title[lang] ?? r.slug;
            const sale = sales[r.slug];
            const item = itemBySlug.get(r.slug);
            // Honest, thin-data-safe upside (null when there's no real basis).
            const potential = item ? estimatePotential(item, bench) : null;
            return (
              <motion.article
                key={`${r.slug}:${r.action}`}
                variants={staggerItem}
                className="h-full"
              >
                <HoverLift accent={accent} className="h-full">
                  <div
                    className="group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.05] to-transparent transition-colors"
                    style={{ borderColor: `${accent}33` }}
                  >
                    {/* Per-drink accent backdrop wash. */}
                    <AccentWash accent={accent} />

                    {/* Visual: doubled cocktail glass with accent glow (never crops). */}
                    <div className="relative grid place-items-center px-5 pt-6">
                      {cocktail ? (
                        <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-56 transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-56 rounded-2xl border border-white/10 bg-white/[0.02]" aria-hidden />
                      )}
                      <span className="absolute top-4 start-4">
                        <ActionBadge action={r.action} lang={lang} />
                      </span>
                    </div>

                    <div className="relative flex flex-1 flex-col gap-2.5 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className="text-white/95 text-[17px] leading-tight"
                          style={{
                            fontFamily: isHebrew ? serifHe : serif,
                            fontStyle: isHebrew ? 'normal' : 'italic',
                            fontWeight: 600,
                          }}
                        >
                          {title}
                        </h3>
                        <span className="shrink-0">
                          <ConfidenceBadge pct={CONFIDENCE_PCT[r.confidence]} label={CONFIDENCE_LABEL[r.confidence][lang]} />
                        </span>
                      </div>

                      <p className="text-white text-[14px] leading-snug" style={{ fontFamily: sans, fontWeight: 500 }}>
                        {r.headline[lang]}
                      </p>

                      <div className="mt-auto flex flex-col gap-2.5 pt-1">
                        {/* Primary: honest revenue upside (renders a "collect more data" note when null). */}
                        <PotentialValue potential={potential} lang={lang} accent={accent} size="md" />

                        {/* Visual Before → After: drink imagery, not numbers. */}
                        {cocktail && potential && (
                          <BeforeAfterImage
                            src={cocktail.heroImage}
                            accent={accent}
                            lang={lang}
                            afterBadge={afterBadge(r.action, lang)}
                          />
                        )}

                        {sale && (
                          <Pill
                            icon={ShoppingBag}
                            accent="#7dd3fc"
                            text={`${sale.units} ${isHebrew ? 'יח׳' : 'units'} · ${formatILS(sale.revenue)}`}
                          />
                        )}

                        <ApplyAction action={r.action} slug={r.slug} lang={lang} />
                      </div>
                    </div>
                  </div>
                </HoverLift>
              </motion.article>
            );
          })}
        </Stagger>
        </div>
      )}
    </>
  );
}

export default function OptimizePage() {
  return (
    <AdminShell
      title="Menu Optimization"
      titleHe="אופטימיזציית תפריט"
      eyebrow="Action, not metrics"
      eyebrowHe="פעולה, לא מספרים"
      active="/admin/optimize"
      subtitle="What to do next for each cocktail — derived from real behaviour. Numeric estimates appear only when the data supports them."
      subtitleHe="מה לעשות הלאה לכל קוקטייל — נגזר מהתנהגות אמיתית. הערכות מספריות מופיעות רק כשהנתונים תומכים."
    >
      <OptimizePanel />
    </AdminShell>
  );
}

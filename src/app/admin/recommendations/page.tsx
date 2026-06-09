'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Link2, Lightbulb, ArrowRight, ArrowLeft, Crown } from 'lucide-react';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, Skeleton, LiveDot } from '@/components/ui/dataviz';
import { PotentialValue } from '@/components/ui/value';
import { buildMenuBenchmark, estimatePotential } from '@/lib/value/potential';
import type { MenuBenchmark, RevenuePotential } from '@/lib/value/potential';
import { useLang } from '@/lib/useLang';
import { HoverLift, Tilt, AccentWash } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { motion } from 'framer-motion';
import type { CoViewRow, Recommendations } from '@/lib/analytics/recommendations-types';
import type { MenuEngineering, MenuEngineeringItem } from '@/lib/analytics/types';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';
const PAIR_ACCENT = '#7dd3fc';

/** Co-view strength → presentational AI-confidence %. More shared sessions = stronger signal. */
function pairingConfidence(row: CoViewRow): number {
  const top = row.related[0]?.coViews ?? 0;
  return Math.min(95, 58 + top * 6);
}

export default function RecommendationsPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const [data, setData] = useState<Recommendations | null>(null);
  const [menuItems, setMenuItems] = useState<MenuEngineeringItem[]>([]);
  const [loading, setLoading] = useState(true);

  const titleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of MENU) map.set(c.slug, c.title[lang]);
    return map;
  }, [lang]);

  const titleOf = useCallback(
    (slug: string): string => titleBySlug.get(slug) ?? slug,
    [titleBySlug],
  );

  const load = useCallback(async () => {
    try {
      const [recRes, meRes] = await Promise.all([
        fetch('/api/analytics/recommendations', { cache: 'no-store' }),
        fetch('/api/analytics/menu-engineering', { cache: 'no-store' }),
      ]);
      const recJson: { success: boolean; data?: Recommendations } = await recRes.json();
      if (recJson.success && recJson.data) setData(recJson.data);
      const meJson: { success: boolean; data?: MenuEngineering } = await meRes.json();
      if (meJson.success && meJson.data) setMenuItems(meJson.data.items);
    } catch {
      /* keep last good */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const rows: CoViewRow[] = data?.rows ?? [];
  const hasData = data?.hasData ?? false;

  // Realistic, menu-own benchmark + a slug→item lookup for honest upside estimates.
  const bench: MenuBenchmark = useMemo(() => buildMenuBenchmark(menuItems), [menuItems]);
  const itemBySlug = useMemo(() => {
    const map = new Map<string, MenuEngineeringItem>();
    for (const it of menuItems) map.set(it.slug, it);
    return map;
  }, [menuItems]);

  // Rank recommendations by estimated revenue upside (nulls last). #0 is the Top Pick.
  const ranked: { row: CoViewRow; potential: RevenuePotential | null }[] = useMemo(() => {
    const scored = rows.map((row) => {
      const item = itemBySlug.get(row.slug);
      const potential = item ? estimatePotential(item, bench) : null;
      return { row, potential };
    });
    return scored.sort((a, b) => (b.potential?.revenueILS ?? -1) - (a.potential?.revenueILS ?? -1));
  }, [rows, itemBySlug, bench]);

  // Arrow points toward reading flow: left in RTL (Hebrew), right in LTR.
  const ApplyArrow = isHebrew ? ArrowLeft : ArrowRight;

  return (
    <AdminShell
      title="Recommendations"
      titleHe="המלצות"
      eyebrow="Behavioral · co-view"
      eyebrowHe="התנהגותי · צפייה משותפת"
      active="/admin/recommendations"
      subtitle="Guests who viewed one drink also viewed these — surface natural pairings and upsells straight from real browsing behaviour."
      subtitleHe="אורחים שצפו במשקה אחד צפו גם באלה — חשוף שילובים טבעיים והגדלת מכירה ישירות מהתנהגות גלישה אמיתית."
      actions={<LiveDot label={t('Live', 'חי')} />}
    >
      {loading && rows.length === 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-12" dir={isHebrew ? 'rtl' : 'ltr'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="px-5 pt-5">
                <Skeleton className="h-36 w-full rounded-2xl" />
              </div>
              <div className="flex flex-col gap-2.5 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {!loading && !hasData && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-10 text-center">
          <p className="text-amber-200/80 text-[10px] tracking-[0.4em] uppercase mb-4" style={{ fontFamily: sans }}>
            {t('No co-views yet', 'אין צפיות משותפות עדיין')}
          </p>
          <p className="text-white/55 text-sm leading-relaxed max-w-xl mx-auto" style={{ fontFamily: sans }} dir={isHebrew ? 'rtl' : 'ltr'}>
            {t(
              'Co-views appear once guests browse more than one drink in the same session. As traffic grows, this page reveals which cocktails are explored together.',
              'צפיות משותפות מופיעות כאשר אורחים מעיינים ביותר ממשקה אחד באותו ביקור. ככל שהתנועה גדלה, עמוד זה חושף אילו קוקטיילים נחקרים יחד.',
            )}
          </p>
        </section>
      )}

      {hasData && (
        <section dir={isHebrew ? 'rtl' : 'ltr'}>
        <Stagger className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 mb-12 items-start">
          {ranked.map(({ row, potential }, index) => {
            const cocktail = findCocktailBySlug(row.slug);
            const accent = getAccent(row.slug);
            const title = cocktail?.title[lang] ?? row.slug;
            const top = row.related[0];
            const confidence = pairingConfidence(row);
            const isTopPick = index === 0 && potential !== null;
            const rankLabel = index === 0 ? t('#1 this week', '#1 השבוע') : `#${index + 1}`;
            const imageHeight = isTopPick ? 'h-64 sm:h-72' : 'h-56';

            const glass =
              cocktail ? (
                <GlassImage
                  src={cocktail.heroImage}
                  accent={accent}
                  className={`w-full ${imageHeight} transition-transform duration-300 group-hover:scale-[1.04]`}
                />
              ) : (
                <div className={`w-full ${imageHeight} rounded-2xl border border-white/10 bg-white/[0.02]`} aria-hidden />
              );

            return (
              <motion.article
                key={row.slug}
                variants={staggerItem}
                className={`${isTopPick ? 'sm:col-span-2 xl:col-span-1' : ''}`}
              >
              <HoverLift
                accent={accent}
                lift={isTopPick ? -8 : -5}
                className="h-full"
              >
              <div
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.05] to-transparent transition-colors"
                style={{
                  borderColor: isTopPick ? 'rgba(251,191,36,0.55)' : `${accent}33`,
                  boxShadow: isTopPick ? `0 26px 70px -24px ${accent}55` : undefined,
                }}
              >
                {/* Per-drink accent wash — colours the card to its cocktail. */}
                <AccentWash accent={accent} opacity={isTopPick ? 0.26 : 0.16} />

                {/* Top-Pick corner ribbon — only the #1 ranked, money-backed card. */}
                {isTopPick && (
                  <div className="pointer-events-none absolute -end-12 top-5 z-20 rotate-45">
                    <span
                      className="block px-12 py-1 text-center text-[10px] tracking-[0.16em] uppercase shadow-lg"
                      style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', color: '#1a1205', fontFamily: sans, fontWeight: 800 }}
                    >
                      {t('Top pick', 'המלצה מובילה')}
                    </span>
                  </div>
                )}

                {/* Visual: generous, contained cocktail glass with accent glow (never crops). */}
                <div className="relative grid place-items-center px-5 pt-5">
                  {isTopPick ? <Tilt className="w-full">{glass}</Tilt> : glass}
                  {/* Rank badge — bold standing in the ranking. */}
                  <span className="absolute top-4 start-4 z-10">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] tracking-[0.14em] uppercase"
                      style={{
                        color: isTopPick ? '#1a1205' : '#fbbf24',
                        background: isTopPick ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'rgba(251,191,36,0.14)',
                        border: '1px solid rgba(251,191,36,0.55)',
                        fontFamily: sans,
                        fontWeight: 800,
                      }}
                    >
                      {isTopPick && <Crown size={12} strokeWidth={2.4} />} {rankLabel}
                    </span>
                  </span>
                  <span className="absolute top-4 end-4 z-10">
                    <ConfidenceBadge pct={confidence} label={t('AI confidence', 'ביטחון AI')} />
                  </span>
                </div>

                <div className="relative flex flex-1 flex-col gap-3 p-5">
                  <h3
                    className={`text-white/95 leading-tight ${isTopPick ? 'text-[22px]' : 'text-[18px]'}`}
                    style={{ fontFamily: isHebrew ? serifHe : serif, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 600 }}
                  >
                    {title}
                  </h3>

                  {/* HERO: big, bold, honest money potential. */}
                  <PotentialValue potential={potential} lang={lang} size="lg" accent="#fbbf24" />

                  {top ? (
                    <p className="text-white/85 text-[13px] leading-snug" style={{ fontFamily: sans, fontWeight: 500 }}>
                      <Link2 size={12} strokeWidth={2} className="inline mb-0.5 me-1" style={{ color: PAIR_ACCENT }} />
                      {titleOf(top.slug)}
                      <span className="text-white/40 font-mono text-[11px] ms-1">×{top.coViews}</span>
                    </p>
                  ) : (
                    <p className="text-white/40 text-[13px] italic" style={{ fontFamily: sans }}>
                      {t('No pairing yet.', 'אין שילוב.')}
                    </p>
                  )}

                  <div className="mt-auto pt-1">
                    <Link
                      href={`/admin/promotions?cocktail=${encodeURIComponent(row.slug)}`}
                      className="group/apply inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-2.5 text-[12px] tracking-[0.12em] uppercase transition-colors hover:bg-amber-300/20"
                      style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.45)', fontFamily: sans, fontWeight: 600 }}
                    >
                      <Lightbulb size={13} strokeWidth={2} className="shrink-0" />
                      {t('Create promotion', 'צור מבצע')}
                      <ApplyArrow size={13} strokeWidth={2} className="shrink-0 transition-transform group-hover/apply:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </div>
              </HoverLift>
              </motion.article>
            );
          })}
        </Stagger>
        </section>
      )}

      {hasData && (
        <p className="text-center text-white/30 text-[10px] tracking-[0.4em] uppercase pt-6 border-t border-white/10" style={{ fontFamily: sans }}>
          {t('Co-views counted per guest session · use for pairings & upsell', 'צפיות משותפות נספרות לכל ביקור · לשילובים והגדלת מכירה')}
        </p>
      )}
    </AdminShell>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sunrise, Flame, ArrowRight, Users, ShoppingBag, TrendingUp, TrendingDown, BadgeCheck, Share2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { AdminShell } from '@/components/ui/AdminShell';
import { Skeleton, SkeletonGrid, LiveDot, AreaChart, GlassImage, deltaPct } from '@/components/ui/dataviz';
import { Stagger, staggerItem, Reveal } from '@/components/ui/motion';
import { HoverLift, Tilt, AccentWash } from '@/components/ui/visual';
import { GlassCard, EmptyState, ErrorState } from '@/components/ui/premium';
import { ReadinessNote } from '@/components/ui/value';
import { useReadiness } from '@/lib/useReadiness';
import { useLang } from '@/lib/useLang';
import { getAccent, findCocktailBySlug } from '@/data/cocktail';
import { totalPotential, buildMenuBenchmark, estimatePotential, type MenuBenchmark } from '@/lib/value/potential';
import { sampleConfidence } from '@/lib/menu-intel/sample';
import { formatILS } from '@/lib/format';
import type { AnalyticsOverview, MenuEngineering, MenuEngineeringItem } from '@/lib/analytics/types';
import { useApiData } from '@/lib/data/useApiData';

const serif = 'var(--font-playfair, serif)';
const sans = 'var(--font-inter, sans-serif)';
const ils = formatILS;

interface Enriched extends MenuEngineeringItem {
  title: { en: string; he: string };
  hero: string;
  accent: string;
}

/**
 * Honest projection for the hero item. Current revenue is real (units × price); the upside
 * comes from the SHARED estimatePotential engine (tied to the menu's own median, returns null
 * when there's no quantified upside — never fabricated), and confidence is the real
 * sample-based curve. Replaces the earlier attention×price / (55 + views×1.3) heuristics that
 * invented orders and a precise-looking confidence out of thin air.
 */
function project(it: Enriched, bench: MenuBenchmark) {
  const pot = estimatePotential(it, bench);
  const beforeRev = it.units * (it.price || 0);
  const revenue = pot?.revenueILS ?? 0;
  return {
    orders: pot?.extraOrders ?? 0,
    revenue,
    beforeRev,
    afterRev: beforeRev + revenue,
    confidence: Math.round(sampleConfidence(it.views) * 100),
    hasUpside: pot !== null,
  };
}

interface BriefingInput {
  views: number;
  orders: number;
  conversionPct: number;
  revenue: number;
  topItem: string | null;
  opportunity: string | null;
}

/**
 * Deterministic natural-language morning briefing — NO LLM, NO fabrication.
 * Each clause is emitted only when its underlying real number is present.
 * Returns the EN + HE sentence and a plain-text share summary.
 */
function buildBriefing(input: Readonly<BriefingInput>): { en: string; he: string; share: string } {
  const { views, orders, conversionPct, revenue, topItem, opportunity } = input;
  const conv = Math.round(conversionPct);
  const enParts: string[] = [];
  const heParts: string[] = [];

  if (views > 0 || orders > 0) {
    enParts.push(`${views.toLocaleString()} views and ${orders.toLocaleString()} orders (${conv}% conversion).`);
    heParts.push(`${views.toLocaleString()} צפיות ו-${orders.toLocaleString()} הזמנות (המרה ${conv}%).`);
  }
  if (revenue > 0) {
    enParts.push(`Revenue ${ils(revenue)}.`);
    heParts.push(`הכנסה ${ils(revenue)}.`);
  }
  if (topItem) {
    enParts.push(`The hot drink — ${topItem}.`);
    heParts.push(`המשקה החם — ${topItem}.`);
  }
  if (opportunity) {
    enParts.push(`Top opportunity: ${opportunity}.`);
    heParts.push(`הזדמנות מובילה: ${opportunity}.`);
  }

  const en = enParts.length ? `This morning: ${enParts.join(' ')}` : 'This morning: tracking quietly — no notable activity yet.';
  const he = heParts.length ? `הבוקר: ${heParts.join(' ')}` : 'הבוקר: הכל שקט — אין עדיין פעילות בולטת.';
  return { en, he, share: en };
}

export default function ExecutiveSummaryPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);

  const {
    data: me,
    loading: meLoading,
    error: meError,
    reload: reloadMe,
  } = useApiData<MenuEngineering>('/api/analytics/menu-engineering', { refreshInterval: 25000 });
  const {
    data: ov,
    loading: ovLoading,
    error: ovError,
    reload: reloadOv,
  } = useApiData<AnalyticsOverview>('/api/analytics/overview', { refreshInterval: 25000 });
  const [copied, setCopied] = useState(false);
  const readiness = useReadiness();

  // Dual-endpoint page (mirrors events/page.tsx's two-hooks-plus-merged-load pattern).
  // loading/error/hasLoadedOnce are now derived from two independent polls instead of the
  // original single atomic try/catch that updated `me`/`ov` together only when both succeeded.
  const loading = meLoading || ovLoading;
  const error = Boolean(meError || ovError);
  const hasLoadedOnce = me !== null && ov !== null;
  const load = useCallback(() => {
    reloadMe();
    reloadOv();
  }, [reloadMe, reloadOv]);

  const items: Enriched[] = useMemo(() => {
    return (me?.items ?? [])
      .map((r) => {
        const c = findCocktailBySlug(r.slug);
        return c ? { ...r, title: c.title, hero: c.heroImage, accent: getAccent(r.slug) } : null;
      })
      .filter((x): x is Enriched => Boolean(x));
  }, [me]);

  const hasData = items.length > 0 && (ov?.totalViews ?? 0) > 0;

  // Honest money hero: sums ONLY quantified upsides from real per-item analytics.
  const potential = useMemo(() => totalPotential(me?.items ?? []), [me]);
  const bench = useMemo(() => buildMenuBenchmark(me?.items ?? []), [me]);

  const ranked = useMemo(() => {
    const score = (i: Enriched) => (i.highInterestLowConversion ? 1000 : 0) + (i.klass === 'puzzle' ? 500 : 0) + i.attentionScore;
    return [...items].sort((a, b) => score(b) - score(a));
  }, [items]);

  const hero = ranked[0];
  const more = ranked.slice(1, 4);
  const trending = useMemo(() => [...items].sort((a, b) => b.attentionScore - a.attentionScore).slice(0, 8), [items]);

  const viewsDelta = deltaPct(ov?.viewsByDay);
  const ordersDelta = deltaPct(ov?.ordersByDay);

  /** Top-opportunity recommendation — mirrors the hero's leak/feature logic (EN + HE). */
  const opportunity = useMemo<{ en: string; he: string } | null>(() => {
    if (!hero) return null;
    if (hero.highInterestLowConversion) {
      return {
        en: `fix the offer for ${hero.title.en}`,
        he: `תקנו את ההצעה ל${hero.title.he}`,
      };
    }
    return {
      en: `feature ${hero.title.en} more prominently`,
      he: `הדגישו את ${hero.title.he} בצורה בולטת יותר`,
    };
  }, [hero]);

  const briefing = useMemo(() => {
    const topSlug = ov?.topItemSlug ?? null;
    const topCocktail = topSlug ? findCocktailBySlug(topSlug) : null;
    const en = buildBriefing({
      views: ov?.totalViews ?? 0,
      orders: ov?.totalOrders ?? 0,
      conversionPct: ov?.conversionPct ?? 0,
      revenue: ov?.totalRevenue ?? 0,
      topItem: topCocktail?.title.en ?? hero?.title.en ?? null,
      opportunity: opportunity?.en ?? null,
    }).en;
    const he = buildBriefing({
      views: ov?.totalViews ?? 0,
      orders: ov?.totalOrders ?? 0,
      conversionPct: ov?.conversionPct ?? 0,
      revenue: ov?.totalRevenue ?? 0,
      topItem: topCocktail?.title.he ?? hero?.title.he ?? null,
      opportunity: opportunity?.he ?? null,
    }).he;
    return { en, he };
  }, [ov, hero, opportunity]);

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const heading = isHe ? 'סיכום מנהלים' : 'Executive Summary';
    const text = `${heading}\n\n${isHe ? briefing.he : briefing.en}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      /* user dismissed the share sheet, or clipboard denied — no-op */
    }
  }, [isHe, briefing]);

  return (
    <AdminShell
      title="Executive Summary"
      titleHe="סיכום מנהלים"
      eyebrow="Your AI restaurant advisor"
      eyebrowHe="יועץ ה‑AI של המסעדה"
      active="/admin/executive"
      subtitle="The opportunity worth the most money — and the revenue it can generate."
      subtitleHe="ההזדמנות ששווה הכי הרבה כסף — וכמה הכנסה היא יכולה לייצר."
      actions={<LiveDot label={isHe ? 'חי' : 'Live'} />}
    >
      {loading && !me && (
        <div className="flex flex-col gap-12" dir={isHe ? 'rtl' : 'ltr'}>
          <Skeleton className="h-[460px] w-full rounded-[2rem] md:h-[600px]" />
          <SkeletonGrid count={4} className="grid grid-cols-2 lg:grid-cols-4 gap-3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {!loading && !hasData && error && !hasLoadedOnce && (
        <div dir={isHe ? 'rtl' : 'ltr'}>
          <GlassCard static className="p-12">
            <ErrorState
              title={t('Couldn’t load — check your connection', 'טעינה נכשלה — בדקו את החיבור')}
              onRetry={load}
              retryLabel={t('Try again', 'נסו שוב')}
            />
          </GlassCard>
        </div>
      )}

      {!loading && !hasData && !(error && !hasLoadedOnce) && (
        <div dir={isHe ? 'rtl' : 'ltr'}>
          <GlassCard static className="p-12">
            <EmptyState title={t('No activity yet. Once guests scan and order, your advisor appears here.', 'אין עדיין פעילות. כשאורחים יסרקו ויזמינו, היועץ יופיע כאן.')} />
          </GlassCard>
        </div>
      )}

      {hasData && hero && (
        <div className="flex flex-col gap-12" dir={isHe ? 'rtl' : 'ltr'}>
          {/* Honesty caveat: while the dataset is still thin, say engine findings are
              provisional rather than presenting them as settled. Only shown alongside real content. */}
          <ReadinessNote readiness={readiness} lang={lang} tone="expert" />

          {/* MONEY HERO — open opportunity value + actions today (honest: quantified upside only) */}
          <MoneyHero potential={potential} t={t} isHe={isHe} />

          {/* HERO */}
          {(() => {
            const p = project(hero, bench);
            const leak = hero.highInterestLowConversion;
            return (
              <Reveal>
              <section className="relative overflow-hidden rounded-[2rem] border" style={{ borderColor: `${hero.accent}55`, boxShadow: `0 40px 120px -50px ${hero.accent}` }}>
                <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${hero.accent}26, rgba(8,8,10,0.7) 60%)` }} aria-hidden />
                <AccentWash accent={hero.accent} opacity={0.18} />
                <div className="relative z-10 grid md:grid-cols-2 gap-2 items-stretch">
                  {/* Image and text are separate grid cells; with dir=rtl inherited, CSS Grid
                      auto-placement would otherwise always put the first DOM cell (image) in the
                      right column, pushing text left — explicit order keeps text leading from the
                      right in Hebrew (matching the rest of the app), unaffected in English. */}
                  <div className={`relative min-h-[420px] md:min-h-[600px] grid place-items-center p-6 md:p-8 ${isHe ? 'md:order-2' : ''}`}>
                    <Tilt className="w-full">
                      <GlassImage src={hero.hero} accent={hero.accent} className="w-full h-[420px] md:h-[600px]" />
                    </Tilt>
                    <span className="absolute top-5 start-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-10 tracking-[0.2em] uppercase backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.4)', color: hero.accent, fontFamily: sans, border: `1px solid ${hero.accent}55` }}>
                      <Flame size={12} strokeWidth={2} /> {t('Top opportunity', 'הזדמנות מובילה')}
                    </span>
                  </div>
                  <div className={`p-7 md:p-9 flex flex-col justify-center gap-5 text-center md:text-start ${isHe ? 'md:order-1' : ''}`}>
                    <div>
                      <div className="inline-flex items-center gap-1.5 mb-2 rounded-full border px-2.5 py-1 text-10 tracking-[0.18em] uppercase" style={{ borderColor: 'rgba(52,211,153,0.4)', color: 'var(--success)', fontFamily: sans }}>
                        <BadgeCheck size={12} strokeWidth={2} /> {t('Confidence', 'ביטחון')} {p.confidence}%
                      </div>
                      <h2 className="text-white leading-[1]" style={{ fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 700, fontSize: 'clamp(2.2rem,5vw,3.4rem)' }}>
                        {hero.title[lang]}
                      </h2>
                      <p className="text-white/65 text-sm mt-2.5 max-w-md mx-auto md:mx-0" style={{ fontFamily: sans }}>
                        {leak
                          ? t(`${hero.attentionScore}/100 attention, only ${Math.round(hero.conversionPct)}% ordered.`, `${hero.attentionScore}/100 תשומת לב, רק ${Math.round(hero.conversionPct)}% הזמינו.`)
                          : t(`Best margin (${ils(hero.margin)}/glass), low visibility.`, `המרווח הכי טוב (${ils(hero.margin)} לכוס), נראוּת נמוכה.`)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 justify-center md:justify-start">
                      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5">
                        <p className="text-9 tracking-[0.25em] uppercase text-white/40" style={{ fontFamily: sans }}>{t('Today', 'היום')}</p>
                        <p className="text-white/80 text-lg tabular-nums" style={{ fontFamily: serif, fontWeight: 600 }}>{ils(p.beforeRev)}<span className="text-11 text-white/35">/{t('mo', 'חודש')}</span></p>
                      </div>
                      <ArrowRight size={20} className={`text-white/40 ${isHe ? 'rotate-180' : ''}`} strokeWidth={1.6} />
                      <div className="rounded-xl border px-4 py-2.5" style={{ borderColor: `${hero.accent}66`, background: `${hero.accent}14` }}>
                        <p className="text-9 tracking-[0.25em] uppercase" style={{ color: hero.accent, fontFamily: sans }}>{t('Projected', 'תחזית')}</p>
                        <p className="text-xl tabular-nums" style={{ color: hero.accent, fontFamily: serif, fontWeight: 700 }}>{ils(p.afterRev)}<span className="text-11 text-white/35">/{t('mo', 'חודש')}</span></p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      {p.orders > 0 && <Pill icon={ShoppingBag} text={`+${p.orders} ${t('orders/mo', 'הזמנות/חודש')}`} />}
                      {p.revenue > 0 && <Pill icon={TrendingUp} text={`≈ +${ils(p.revenue)} ${t('potential', 'פוטנציאל')}`} accent={hero.accent} />}
                      {!p.hasUpside && (
                        <span className="text-white/45 text-xs" style={{ fontFamily: sans }}>
                          {t('Not enough data to quantify upside yet.', 'עדיין אין מספיק נתונים לכימות הפוטנציאל.')}
                        </span>
                      )}
                    </div>

                    <Link href={leak ? '/admin/menu-analysis' : '/admin/experience'} className="inline-flex w-fit mx-auto md:mx-0 items-center gap-2 rounded-full px-6 py-3 text-11 tracking-[0.2em] uppercase text-black transition-transform hover:scale-[1.04]" style={{ background: hero.accent, fontFamily: sans, fontWeight: 700 }}>
                      {leak ? t('Fix the offer', 'תקנו את ההצעה') : t('Feature it', 'הדגישו אותו')}
                      <ArrowRight size={14} strokeWidth={2.2} className={isHe ? 'rotate-180' : ''} />
                    </Link>
                  </div>
                </div>
              </section>
              </Reveal>
            );
          })()}

          {/* Real demand trend — last 14 days of actual views (no projection) */}
          {(ov?.viewsByDay?.length ?? 0) > 1 && (
            <GlassCard static accent={hero.accent} className="p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="inline-flex items-center gap-2 text-amber-200/70 text-10 tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
                  <TrendingUp size={13} strokeWidth={2} /> {t('Demand trend', 'מגמת ביקוש')}
                </p>
                <p className="text-white/40 text-10 tracking-[0.2em] uppercase" style={{ fontFamily: sans }}>{t('last 14 days', '14 ימים אחרונים')}</p>
              </div>
              <AreaChart data={(ov?.viewsByDay ?? []).slice(-14)} color={hero.accent} height={120} />
            </GlassCard>
          )}

          {/* Morning briefing — deterministic, real-data advisor callout */}
          <section
            className="relative overflow-hidden rounded-2xl p-[1px]"
            style={{ background: 'linear-gradient(120deg, rgba(251,191,36,0.55), rgba(125,211,252,0.35) 55%, rgba(52,211,153,0.45))' }}
          >
            <div className="rounded-[calc(1rem-1px)] bg-zinc-950/85 backdrop-blur-xl p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="mt-0.5 inline-grid place-items-center rounded-full p-2 shrink-0"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)' }}
                    aria-hidden
                  >
                    <Sunrise size={18} strokeWidth={1.9} className="text-amber-200" />
                  </span>
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 text-amber-200/70 text-10 tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
                      <Sunrise size={12} strokeWidth={2} /> {t('Morning Briefing', 'תקציר הבוקר')}
                    </p>
                    <p
                      className="text-white/90 mt-2 text-base md:text-lg leading-relaxed break-words"
                      style={{ fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHe ? 'normal' : 'italic' }}
                    >
                      {isHe ? briefing.he : briefing.en}
                    </p>
                    <p className="text-white/30 text-10 mt-2 tracking-wide" style={{ fontFamily: sans }}>
                      {t('Projections shown elsewhere are estimates.', 'התחזיות המוצגות במקומות אחרים הן הערכות.')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-11 tracking-[0.2em] uppercase text-white/85 transition-colors hover:border-amber-200/50 hover:text-white"
                  style={{ fontFamily: sans, fontWeight: 600 }}
                  aria-live="polite"
                >
                  {copied ? <Check size={14} strokeWidth={2.2} className="text-emerald-300" /> : <Share2 size={14} strokeWidth={2} />}
                  {copied ? t('Copied', 'הועתק') : t('Share snapshot', 'שתף תמונת מצב')}
                </button>
              </div>
            </div>
          </section>

          {/* KPI cards with real trend */}
          <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <motion.div variants={staggerItem}><KpiTrend label={t('Demand', 'ביקוש')} value={(ov?.totalViews ?? 0).toLocaleString()} delta={viewsDelta} series={(ov?.viewsByDay ?? []).slice(-14)} color="#e8c987" t={t} /></motion.div>
            <motion.div variants={staggerItem}><KpiTrend label={t('Orders', 'הזמנות')} value={(ov?.totalOrders ?? 0).toLocaleString()} delta={ordersDelta} series={(ov?.ordersByDay ?? []).slice(-14)} color="#34d399" t={t} /></motion.div>
            <motion.div variants={staggerItem}><KpiStat label={t('Revenue', 'הכנסה')} value={ils(ov?.totalRevenue ?? 0)} color="#7dd3fc" /></motion.div>
            <motion.div variants={staggerItem}><KpiStat label={t('Conversion', 'המרה')} value={`${Math.round(ov?.conversionPct ?? 0)}%`} color="#f59e0b" /></motion.div>
          </Stagger>

          {/* More opportunities */}
          {more.length > 0 && (
            <section>
              <p className="text-amber-200/70 text-10 tracking-[0.4em] uppercase mb-4" style={{ fontFamily: sans }}>{t('More opportunities', 'הזדמנויות נוספות')}</p>
              <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {more.map((it) => {
                  const p = project(it, bench);
                  return (
                    <motion.div key={it.slug} variants={staggerItem}>
                      <HoverLift accent={it.accent} className="h-full">
                        <Link href="/admin/menu-analysis" className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-amber-200/40 transition-colors flex flex-col" dir={isHe ? 'rtl' : 'ltr'}>
                          <AccentWash accent={it.accent} opacity={0.14} />
                          <GlassImage src={it.hero} accent={it.accent} className="relative w-full h-72 mb-3 transition-transform duration-300 group-hover:scale-105" />
                          <p className="relative text-white/90 text-base text-center" style={{ fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>{it.title[lang]}</p>
                          <p className="relative text-center text-11 mt-2 mb-3" style={{ color: 'var(--success)', fontFamily: sans }}>
                            <BadgeCheck size={11} strokeWidth={2} className="inline mb-0.5" /> {t('Confidence', 'ביטחון')} {p.confidence}%
                          </p>
                          <div className="relative mt-auto grid grid-cols-2 gap-1 text-center">
                            <Mini v={`+${p.orders}`} l={t('orders', 'הזמנות')} />
                            <Mini v={`≈${ils(p.revenue)}`} l={t('potential', 'פוטנציאל')} accent={it.accent} />
                          </div>
                        </Link>
                      </HoverLift>
                    </motion.div>
                  );
                })}
              </Stagger>
            </section>
          )}

          {/* Trending carousel */}
          <section>
            <p className="inline-flex items-center gap-2 text-amber-200/70 text-10 tracking-[0.4em] uppercase mb-4" style={{ fontFamily: sans }}>
              <Flame size={13} strokeWidth={2} className="text-rose-300" /> {t('Trending now', 'חם עכשיו')}
            </p>
            <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {trending.map((it, i) => (
                <motion.div key={it.slug} variants={staggerItem}>
                  <HoverLift accent={it.accent} className="h-full">
                    <Link href="/admin/menu-analysis" className="group relative block h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 hover:border-amber-200/40 transition-colors">
                      <AccentWash accent={it.accent} opacity={0.16} />
                      <span className="absolute top-3 left-4 z-10 text-white/15 text-4xl font-bold leading-none" style={{ fontFamily: serif }}>{i + 1}</span>
                      <GlassImage src={it.hero} accent={it.accent} className="relative w-full h-72 mb-3 transition-transform duration-300 group-hover:scale-110" />
                      <p className="relative text-white/90 text-15 text-center leading-tight" style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 600 }}>{it.title[lang]}</p>
                      <p className="relative text-amber-200/70 text-11 text-center mt-1 tabular-nums" style={{ fontFamily: sans }}>
                        <TrendingUp size={11} className="inline mb-0.5" strokeWidth={2} /> {it.views} {t('views', 'צפיות')} · {it.attentionScore}/100
                      </p>
                    </Link>
                  </HoverLift>
                </motion.div>
              ))}
            </Stagger>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

/** Prominent, honest money strip: open potential (₪) + recommended actions today. */
function MoneyHero({ potential, t, isHe }: { potential: { revenueILS: number; count: number }; t: (en: string, he: string) => string; isHe: boolean }) {
  const hasUpside = potential.count > 0;
  return (
    <Link
      href="/admin/opportunities"
      className="group relative block overflow-hidden rounded-[1.75rem] p-[1px] transition-transform hover:scale-[1.005]"
      style={{ background: 'linear-gradient(120deg, rgba(52,211,153,0.55), rgba(16,185,129,0.18) 60%, rgba(52,211,153,0.4))' }}
    >
      <div className="rounded-[calc(1.75rem-1px)] bg-zinc-950/85 backdrop-blur-xl p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-emerald-300/80 text-10 tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
              <Flame size={12} strokeWidth={2} /> {t('Open opportunity', 'הזדמנות פתוחה')}
            </p>
            {hasUpside ? (
              <p className="mt-2 leading-[1] text-emerald-300 tabular-nums" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(2.4rem,6vw,4rem)' }}>
                {ils(potential.revenueILS)}
              </p>
            ) : (
              <p className="mt-2 leading-tight text-white/85" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.5rem,3.5vw,2.2rem)' }}>
                {t('Collect more traffic', 'אסוף עוד תנועה')}
              </p>
            )}
            <p className="mt-2 text-white/55 text-13 md:text-sm break-words" style={{ fontFamily: sans }}>
              {hasUpside
                ? t('Open potential — what to do now.', 'פוטנציאל פתוח — מה לעשות עכשיו.')
                : t('Not enough real traffic to estimate upside yet.', 'אין עדיין מספיק תנועה אמיתית כדי להעריך פוטנציאל.')}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-end">
              <p className="text-emerald-300 leading-none tabular-nums" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.6rem,3vw,2.2rem)' }}>
                {hasUpside ? potential.count : '—'}
              </p>
              <p className="mt-1 text-white/50 text-11 tracking-wide" style={{ fontFamily: sans }}>
                {t('actions today', 'פעולות מומלצות היום')}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-11 tracking-[0.2em] uppercase text-emerald-200 transition-colors group-hover:border-emerald-300/70" style={{ fontFamily: sans, fontWeight: 600 }}>
              {t('Act now', 'פעלו עכשיו')}
              <ArrowRight size={13} strokeWidth={2.2} className={isHe ? 'rotate-180' : ''} />
            </span>
          </div>
        </div>
        <p className="mt-4 text-white/30 text-10 tracking-wide" style={{ fontFamily: sans }}>
          {t('Estimate · based on real data', 'צפי · מבוסס נתונים אמיתיים')}
        </p>
      </div>
    </Link>
  );
}

function Pill({ icon: Icon, text, accent }: { icon: typeof Users; text: string; accent?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs" style={{ color: accent ?? 'rgba(255,255,255,0.8)', fontFamily: sans }}>
      <Icon size={13} strokeWidth={1.8} /> {text}
    </span>
  );
}

function Mini({ v, l, accent }: { v: string; l: string; accent?: string }) {
  return (
    <div>
      <p className="text-sm tabular-nums" style={{ color: accent ?? 'rgba(255,255,255,0.9)', fontFamily: serif, fontWeight: 700 }}>{v}</p>
      <p className="text-white/40 text-9 tracking-wide" style={{ fontFamily: sans }}>{l}</p>
    </div>
  );
}

function KpiTrend({ label, value, delta, series, color, t }: { label: string; value: string; delta: number | null; series: number[]; color: string; t: (en: string, he: string) => string }) {
  const up = (delta ?? 0) >= 0;
  return (
    <GlassCard accent={color} className="p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-white/45 text-11 tracking-wide" style={{ fontFamily: sans }}>{label}</p>
        {delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-11 tabular-nums ${up ? 'text-emerald-300' : 'text-rose-300'}`} style={{ fontFamily: sans }}>
            {up ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingDown size={12} strokeWidth={2} />}
            {up ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="text-white text-2xl mb-2 tabular-nums" style={{ fontFamily: serif, fontWeight: 700 }}>{value}</p>
      <AreaChart data={series} color={color} height={36} showDot={false} strokeWidth={1.75} />
      <p className="text-white/30 text-9 mt-1.5 tracking-wide" style={{ fontFamily: sans }}>{t('vs last week', 'מול שבוע קודם')}</p>
    </GlassCard>
  );
}

function KpiStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <GlassCard accent={color} className="p-4 flex flex-col justify-center">
      <span className="w-1.5 h-1.5 rounded-full mb-3" style={{ background: color }} />
      <p className="text-white text-2xl leading-tight tabular-nums" style={{ fontFamily: serif, fontWeight: 700 }}>{value}</p>
      <p className="text-white/45 text-11 mt-1 tracking-wide" style={{ fontFamily: sans }}>{label}</p>
    </GlassCard>
  );
}

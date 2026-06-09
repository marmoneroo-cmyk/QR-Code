'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ShieldCheck, Target, Eye, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel, CountUpText, LiveDot, Skeleton } from '@/components/ui/dataviz';
import {
  totalPotential,
  estimatePotential,
  buildMenuBenchmark,
  type RevenuePotential,
} from '@/lib/value/potential';
import { useLang } from '@/lib/useLang';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { HoverLift, Tilt, AccentWash, StoryBlock } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import type { AnalyticsOverview, MenuEngineeringItem } from '@/lib/analytics/types';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const heSerif = 'var(--font-frank-ruhl, serif)';
const ils = (n: number) => `₪${Math.round(n).toLocaleString()}`;

/** Closed-loop measured item — only the status field is used here (trust = real wins). */
type ImpactStatus = 'success' | 'declined' | 'no_effect' | 'too_early' | 'insufficient_data';
interface ClosedLoopMeasured {
  result: { status: ImpactStatus };
}

const POLL_MS = 18000;

/** A single per-item upside enriched with its cocktail visuals (real estimate only). */
interface ItemUpside {
  slug: string;
  title: { en: string; he: string };
  hero: string;
  accent: string;
  potential: RevenuePotential;
}

export default function RevenueCenterPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);
  const titleFont = isHe ? heSerif : serif;

  const [items, setItems] = useState<MenuEngineeringItem[] | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [measured, setMeasured] = useState<ClosedLoopMeasured[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [meRes, ovRes, clRes] = await Promise.all([
        fetch('/api/analytics/menu-engineering', { cache: 'no-store' }),
        fetch('/api/analytics/overview', { cache: 'no-store' }),
        fetch('/api/closed-loop', { cache: 'no-store' }),
      ]);
      const meJson: { success: boolean; data?: { items?: MenuEngineeringItem[] } } = await meRes.json();
      const ovJson: { success: boolean; data?: AnalyticsOverview } = await ovRes.json();
      const clJson: { success: boolean; data?: { measured?: ClosedLoopMeasured[] } } = await clRes.json();
      if (meJson.success && meJson.data?.items) setItems(meJson.data.items);
      if (ovJson.success && ovJson.data) setOverview(ovJson.data);
      if (clJson.success && clJson.data?.measured) setMeasured(clJson.data.measured);
    } catch {
      /* keep last good data — never blank the screen on a transient error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Kick the first fetch off the effect's synchronous path so the initial
    // setState lands in a later tick (avoids cascading renders), then poll.
    const kickoff = window.setTimeout(load, 0);
    const id = window.setInterval(load, POLL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(id);
    };
  }, [load]);

  const safeItems = useMemo(() => items ?? [], [items]);

  // GIANT HERO number — honest aggregate of quantified per-item upside (ESTIMATE).
  const potential = useMemo(() => totalPotential(safeItems), [safeItems]);

  // PROVEN — only real, measured closed-loop wins (no estimates here).
  const proven = useMemo(() => {
    const all = measured ?? [];
    const worked = all.filter((m) => m.result.status === 'success').length;
    const pct = all.length > 0 ? Math.round((worked / all.length) * 100) : 0;
    return { total: all.length, worked, pct };
  }, [measured]);

  // WHERE THE MONEY IS — split the estimated upside by lever (conversion vs visibility).
  const levers = useMemo(() => {
    const bench = buildMenuBenchmark(safeItems);
    let conversion = 0;
    let visibility = 0;
    for (const it of safeItems) {
      const p = estimatePotential(it, bench);
      if (!p) continue;
      if (p.lever === 'conversion') conversion += p.revenueILS;
      else visibility += p.revenueILS;
    }
    return { conversion, visibility };
  }, [safeItems]);

  // TOP 3 items by estimated upside (with visuals).
  const topUpside = useMemo<ItemUpside[]>(() => {
    const bench = buildMenuBenchmark(safeItems);
    const enriched: ItemUpside[] = [];
    for (const it of safeItems) {
      const p = estimatePotential(it, bench);
      const c = findCocktailBySlug(it.slug);
      if (!p || !c) continue;
      enriched.push({ slug: it.slug, title: c.title, hero: c.heroImage, accent: getAccent(it.slug), potential: p });
    }
    return enriched.sort((a, b) => b.potential.revenueILS - a.potential.revenueILS).slice(0, 3);
  }, [safeItems]);

  const heroCocktail = useMemo(() => {
    const slug = overview?.topItemSlug ?? topUpside[0]?.slug ?? null;
    return slug ? findCocktailBySlug(slug) ?? null : null;
  }, [overview, topUpside]);
  const heroAccent = heroCocktail ? getAccent(heroCocktail.slug) : '#34d399';

  const hasUpside = potential.count > 0;
  const hasActualSales = Boolean(overview?.hasData) && (overview?.totalOrders ?? 0) > 0;

  return (
    <AdminShell
      title="Revenue Center"
      titleHe="מרכז הכנסות"
      eyebrow="The growth engine"
      eyebrowHe="מנוע הצמיחה"
      active="/admin/revenue"
      subtitle="How much money this platform can make you — quantified from your real data, and proven by what already worked."
      subtitleHe="כמה כסף הפלטפורמה יכולה לייצר לכם — מכומת מהנתונים האמיתיים שלכם, ומוכח על־ידי מה שכבר עבד."
      actions={<LiveDot label={t('Live', 'חי')} />}
    >
      {loading && !items ? (
        <div className="flex flex-col gap-12" dir={isHe ? 'rtl' : 'ltr'}>
          <Skeleton className="h-[360px] w-full rounded-[2rem] md:h-[440px]" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-14" dir={isHe ? 'rtl' : 'ltr'}>
          {/* 1 — GIANT HERO: 50/50 — money headline beside a big tilted drink (ESTIMATE) */}
          <section
            className="relative overflow-hidden rounded-[2rem] border px-6 py-12 md:px-12 md:py-16"
            style={{ borderColor: `${heroAccent}44`, boxShadow: `0 50px 140px -60px ${heroAccent}` }}
          >
            <AccentWash accent={heroAccent} opacity={0.18} />
            {/* radial glow behind the number */}
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: `radial-gradient(circle, ${heroAccent}22, transparent 62%)` }}
              aria-hidden
            />
            <div className="relative z-10 grid items-center gap-8 md:grid-cols-2 md:gap-12">
              {/* big tilted hero drink — ~50% of the hero */}
              {heroCocktail ? (
                <Tilt className="mx-auto w-full max-w-[420px]">
                  <GlassImage
                    src={heroCocktail.heroImage}
                    accent={heroAccent}
                    className="h-64 w-full md:h-[26rem]"
                  />
                </Tilt>
              ) : (
                <span aria-hidden />
              )}

              <div className={`flex flex-col gap-5 ${isHe ? 'items-end text-end md:text-start' : 'items-start text-start'}`}>
                <p className="text-emerald-300/80 text-[11px] md:text-[12px] tracking-[0.35em] uppercase" style={{ fontFamily: sans }}>
                  {t('Available now · estimate', 'זמין עכשיו · צפי')}
                </p>

                {hasUpside ? (
                  <motion.h2
                    key={potential.revenueILS}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="leading-[0.92] text-emerald-300"
                    style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(3.4rem, 9vw, 7rem)' }}
                  >
                    <CountUpText text={ils(potential.revenueILS)} durationMs={1100} />
                  </motion.h2>
                ) : (
                  <h2
                    className="max-w-md leading-tight text-white/85"
                    style={{ fontFamily: titleFont, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600, fontSize: 'clamp(1.6rem, 4vw, 2.6rem)' }}
                  >
                    {t('Collect more traffic to quantify opportunity', 'אסוף עוד תנועה כדי לכמת הזדמנות')}
                  </h2>
                )}

                {hasUpside && (
                  <p className="text-white/55 text-[13px] md:text-[14px]" style={{ fontFamily: sans }}>
                    {t(
                      `${potential.count} actions · ~${ils(potential.profitILS)} added profit`,
                      `${potential.count} פעולות · רווח נוסף ~${ils(potential.profitILS)}`,
                    )}
                  </p>
                )}

                <Link
                  href="/admin/actions"
                  className="group mt-1 inline-flex items-center gap-2 rounded-full bg-amber-300 px-8 py-3.5 text-[12px] tracking-[0.2em] uppercase text-black transition-transform hover:scale-[1.04]"
                  style={{ fontFamily: sans, fontWeight: 700 }}
                >
                  {t('Act now', 'בצע עכשיו')}
                  <ArrowRight size={15} strokeWidth={2.4} className={isHe ? 'rotate-180' : ''} />
                </Link>
              </div>
            </div>
          </section>

          {/* 1b — STORY: today's available money → tomorrow's lead-drink potential (visual) */}
          {hasUpside && heroCocktail && (
            <StoryBlock
              src={heroCocktail.heroImage}
              accent={heroAccent}
              lang={lang}
              eyebrow={t('Today → tomorrow', 'היום → מחר')}
              title={t(`${ils(potential.revenueILS)} on the table`, `${ils(potential.revenueILS)} על השולחן`)}
              imageHeight="h-52 md:h-72"
            >
              <p className="text-white/55 text-[13px] md:text-[14px] leading-relaxed" style={{ fontFamily: sans }}>
                {t(
                  `Lead with ${heroCocktail.title.en} tomorrow and unlock ~${ils(potential.profitILS)} added profit.`,
                  `הובילו עם ${heroCocktail.title.he} מחר ופתחו רווח נוסף של ~${ils(potential.profitILS)}.`,
                )}
              </p>
            </StoryBlock>
          )}

          {/* 2 — PROVEN counter row (TRUST: real, measured closed-loop results) */}
          <section>
            <SectionLabel icon={ShieldCheck}>{t('Proven · measured results', 'מוכח · תוצאות שנמדדו')}</SectionLabel>
            {proven.total === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center">
                <p className="text-white/55 text-[14px]" style={{ fontFamily: sans }}>
                  {t('0 — act to generate measurable wins', '0 — בצעו פעולות כדי לייצר תוצאות מדידות')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <ProvenStat value={proven.total} label={t('measured', 'נמדדו')} accent="#7dd3fc" />
                <ProvenStat value={proven.worked} label={t('worked', 'הצליחו')} accent="#34d399" />
                <ProvenStat value={`${proven.pct}%`} label={t('success', 'הצלחה')} accent="#fbbf24" />
              </div>
            )}
          </section>

          {/* 3 — ACTUAL sales this period (REAL measured revenue — NOT attributed to the platform) */}
          <section>
            <SectionLabel icon={Receipt}>{t('Actual sales this period', 'מכירות בפועל בתקופה')}</SectionLabel>
            {hasActualSales ? (
              <div className="grid grid-cols-3 gap-3">
                <ActualStat value={ils(overview?.totalRevenue ?? 0)} label={t('revenue', 'הכנסה')} accent="#7dd3fc" />
                <ActualStat value={ils(overview?.totalProfit ?? 0)} label={t('gross profit', 'רווח גולמי')} accent="#34d399" />
                <ActualStat value={(overview?.totalOrders ?? 0).toLocaleString()} label={t('orders', 'הזמנות')} accent="#fbbf24" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center">
                <p className="text-white/55 text-[14px]" style={{ fontFamily: sans }}>
                  {t('No measured sales yet this period.', 'אין עדיין מכירות שנמדדו בתקופה זו.')}
                </p>
              </div>
            )}
            <p className="mt-3 text-white/30 text-[10px] tracking-wide" style={{ fontFamily: sans }}>
              {t('Real measured revenue. Not attributed to the platform.', 'הכנסה אמיתית שנמדדה. לא מיוחסת לפלטפורמה.')}
            </p>
          </section>

          {/* 4 — WHERE THE MONEY IS: split estimated upside by lever + top 3 items */}
          {hasUpside && (
            <section>
              <SectionLabel icon={Target}>{t('Where the money is', 'איפה הכסף')}</SectionLabel>

              <div className="grid gap-3 md:grid-cols-2">
                <LeverBar
                  icon={Target}
                  label={t('conversion', 'תיקון המרה')}
                  value={levers.conversion}
                  max={Math.max(levers.conversion, levers.visibility, 1)}
                  accent="#34d399"
                />
                <LeverBar
                  icon={Eye}
                  label={t('visibility', 'הגדלת חשיפה')}
                  value={levers.visibility}
                  max={Math.max(levers.conversion, levers.visibility, 1)}
                  accent="#7dd3fc"
                />
              </div>

              {topUpside.length > 0 && (
                <Stagger className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {topUpside.map((it) => (
                    <motion.div key={it.slug} variants={staggerItem}>
                      <HoverLift accent={it.accent} className="h-full">
                        <div
                          className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                          dir={isHe ? 'rtl' : 'ltr'}
                        >
                          <AccentWash accent={it.accent} opacity={0.18} />
                          <GlassImage src={it.hero} accent={it.accent} className="relative mb-4 h-64 w-full transition-transform duration-300 group-hover:scale-[1.03]" />
                          <p
                            className="relative text-center text-white/90 text-[16px]"
                            style={{ fontFamily: isHe ? heSerif : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
                          >
                            {it.title[lang]}
                          </p>
                          <p className="relative mt-3 text-center leading-none text-emerald-300" style={{ fontFamily: serif, fontWeight: 700, fontSize: '1.9rem' }}>
                            +{ils(it.potential.revenueILS)}
                          </p>
                          <p className="relative mt-1.5 text-center text-white/40 text-[10px] tracking-[0.18em] uppercase" style={{ fontFamily: sans }}>
                            {t('estimated upside', 'צפי הכנסה')}
                          </p>
                        </div>
                      </HoverLift>
                    </motion.div>
                  ))}
                </Stagger>
              )}
            </section>
          )}

          {/* 5 — CTA */}
          <section className="flex flex-col items-center gap-4 text-center">
            <Link
              href="/admin/actions"
              className="group inline-flex items-center gap-2 rounded-full bg-amber-300 px-10 py-4 text-[12px] tracking-[0.2em] uppercase text-black transition-transform hover:scale-[1.04]"
              style={{ fontFamily: sans, fontWeight: 700 }}
            >
              <Sparkles size={15} strokeWidth={2.2} />
              {t('Act now', 'בצע עכשיו')}
              <ArrowRight size={15} strokeWidth={2.4} className={isHe ? 'rotate-180' : ''} />
            </Link>
            <LiveDot label={t('Updating live', 'מתעדכן בזמן אמת')} />
          </section>
        </div>
      )}
    </AdminShell>
  );
}

/** Big trust stat — real measured closed-loop count (not an estimate). */
function ProvenStat({ value, label, accent }: { value: number | string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
      <p className="leading-none" style={{ color: accent, fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.8rem, 5vw, 2.8rem)' }}>
        <CountUpText text={String(value)} />
      </p>
      <p className="mt-2 text-white/45 text-[11px] tracking-[0.1em] uppercase" style={{ fontFamily: sans }}>{label}</p>
    </div>
  );
}

/** Real actual-sales stat (measured revenue — not attributed to the platform). */
function ActualStat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <span className="mb-3 block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      <p className="leading-tight text-white text-2xl" style={{ fontFamily: serif, fontWeight: 700 }}>
        <CountUpText text={value} />
      </p>
      <p className="mt-1 text-white/45 text-[11px] tracking-wide" style={{ fontFamily: sans }}>{label}</p>
    </div>
  );
}

/** A labeled lever bar — share of estimated upside attributable to one lever. */
function LeverBar({
  icon: Icon,
  label,
  value,
  max,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: number;
  max: number;
  accent: string;
}) {
  const pct = Math.max(3, Math.round((value / max) * 100));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-white/70 text-[12px] tracking-[0.05em]" style={{ fontFamily: sans }}>
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ color: accent, background: `${accent}1a` }}>
            <Icon size={14} strokeWidth={1.9} />
          </span>
          {label}
        </span>
        <span className="text-[18px] tabular-nums" style={{ color: accent, fontFamily: serif, fontWeight: 700 }}>
          +{ils(value)}
        </span>
      </div>
      <span className="relative block h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: accent }} />
      </span>
    </div>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, ShoppingBag, TrendingUp, TrendingDown, Coins, Percent } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { LiveFunnel } from '@/components/admin/LiveFunnel';
import { AreaChart, GlassImage, KpiCard, deltaPct, SectionLabel, LiveDot, Skeleton } from '@/components/ui/dataviz';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { HoverLift, AccentWash } from '@/components/ui/visual';
import { GlassCard, PanelHeader, EmptyState, ErrorState } from '@/components/ui/premium';
import { useLang } from '@/lib/useLang';
import { hasConfidentSample } from '@/lib/analytics/rate';
import { formatILS } from '@/lib/format';
import type { AnalyticsOverview, MenuEngineering, MenuEngineeringItem } from '@/lib/analytics/types';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const ils = formatILS;

interface PerformerCard extends MenuEngineeringItem {
  title: { en: string; he: string };
  hero: string;
  accent: string;
}

/** Trend window options for the period selector (client-side slicing only). */
const TREND_PERIODS = [
  { key: '7d', n: 7, en: '7 days', he: '7 ימים' },
  { key: '14d', n: 14, en: '14 days', he: '14 ימים' },
  { key: 'all', n: Infinity, en: 'All', he: 'הכל' },
] as const;

type TrendPeriodKey = (typeof TREND_PERIODS)[number]['key'];

/** Take the last n points of a series; if shorter than n, return all of it. */
function sliceTail(series: number[] | undefined, n: number): number[] {
  const arr = series ?? [];
  if (!Number.isFinite(n) || arr.length <= n) return arr;
  return arr.slice(-n);
}

const sum = (arr: number[]): number => arr.reduce((s, v) => s + v, 0);

interface TrendPanelProps {
  title: string;
  total: number;
  data: number[];
  color: string;
  delta: number | null;
  icon: LucideIcon;
  peakLabel: string;
  lastLabel: string;
}

/** A single day-trend panel: title + window total + WoW delta + real AreaChart + peak/last annotation. */
function TrendPanel({ title, total, data, color, delta, icon: Icon, peakLabel, lastLabel }: TrendPanelProps) {
  const hasData = data.length > 0;
  const peak = hasData ? Math.max(...data) : 0;
  const last = hasData ? data[data.length - 1] : 0;
  const up = (delta ?? 0) >= 0;
  return (
    <GlassCard className="p-6" static>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center w-8 h-8 rounded-lg shrink-0" style={{ color, background: `${color}1a` }}>
            <Icon size={15} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-white/45 text-11 tracking-wide truncate" style={{ fontFamily: sans }}>{title}</p>
            <p className="text-white text-2xl leading-tight" style={{ fontFamily: serif, fontWeight: 700 }}>
              {total.toLocaleString()}
            </p>
          </div>
        </div>
        {delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-11 shrink-0 ${up ? 'text-emerald-300' : 'text-rose-300'}`} style={{ fontFamily: sans }}>
            {up ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingDown size={12} strokeWidth={2} />}
            {up ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>

      <div className="mt-4">
        {hasData ? (
          <AreaChart data={data} color={color} height={160} />
        ) : (
          <div className="h-[160px] grid place-items-center text-white/25 text-xs" style={{ fontFamily: sans }}>—</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-10 text-white/40 tracking-wide" style={{ fontFamily: sans }}>
        <span>{peakLabel} {peak.toLocaleString()}</span>
        <span>{lastLabel} {last.toLocaleString()}</span>
      </div>
    </GlassCard>
  );
}

export default function AnalyticsPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  // Both endpoints share the old 15s poll cadence (a single setInterval used to fetch them
  // together via Promise.all); SWR's default revalidateOnFocus replaces the old
  // visibilitychange listener.
  const {
    data: overview,
    loading: ovLoading,
    error: ovError,
    reload: reloadOverview,
  } = useApiData<AnalyticsOverview>('/api/analytics/overview', { refreshInterval: 15000 });
  const {
    data: me,
    loading: meLoading,
    reload: reloadMe,
  } = useApiData<MenuEngineering>('/api/analytics/menu-engineering', { refreshInterval: 15000 });

  const titleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of MENU) map.set(c.slug, c.title[lang]);
    return map;
  }, [lang]);

  // loading matches the old useState(true) spinner: true until the first response lands.
  const loading = ovLoading || meLoading;
  // overview is the KPI source; its failure drives the error banner — menu-engineering
  // failures don't, matching the original `setError(!ovJson.success)` design.
  const error = Boolean(ovError);
  const load = useCallback(() => {
    reloadOverview();
    reloadMe();
  }, [reloadOverview, reloadMe]);

  const viewsDelta = deltaPct(overview?.viewsByDay);
  const ordersDelta = deltaPct(overview?.ordersByDay);

  // Period selector controls ONLY the trend charts + their window-sums (client-side slicing).
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriodKey>('14d');
  const activePeriod = TREND_PERIODS.find((p) => p.key === trendPeriod) ?? TREND_PERIODS[1];
  const viewsSlice = useMemo(() => sliceTail(overview?.viewsByDay, activePeriod.n), [overview?.viewsByDay, activePeriod.n]);
  const ordersSlice = useMemo(() => sliceTail(overview?.ordersByDay, activePeriod.n), [overview?.ordersByDay, activePeriod.n]);

  /** Top performers by views, enriched with cocktail imagery (missing ones guarded out). */
  const performers: PerformerCard[] = useMemo(() => {
    return (me?.items ?? [])
      .map((r): PerformerCard | null => {
        const c = findCocktailBySlug(r.slug);
        return c ? { ...r, title: c.title, hero: c.heroImage, accent: getAccent(r.slug) } : null;
      })
      .filter((x): x is PerformerCard => Boolean(x))
      .sort((a, b) => b.views - a.views)
      .slice(0, 4);
  }, [me]);

  return (
    <AdminShell
      title="Performance"
      titleHe="ביצועים"
      eyebrow="Restaurant Analytics"
      eyebrowHe="אנליטיקת מסעדה"
      active="/admin/analytics"
      subtitle="What your diners scan, view, and order — live."
      subtitleHe="מה שהאורחים סורקים, צופים ומזמינים — בזמן אמת."
      actions={
        <span className="inline-flex items-center gap-2 text-emerald-300/80 text-10 tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>
          <LiveDot label={isHebrew ? 'חי' : 'Live'} />
          {t('auto-refresh', 'רענון אוטומטי')}
        </span>
      }
    >
      <div dir={isHebrew ? 'rtl' : 'ltr'} className="flex flex-col gap-12">
        <LiveFunnel lang={lang} />

        {/* First-load failure: say so with a retry, so zeroed KPIs are never mistaken for real no-engagement data. */}
        {error && !overview && !loading && (
          <ErrorState
            title={t('Couldn’t load analytics — check your connection', 'טעינת הנתונים נכשלה — בדקו את החיבור')}
            hint={t('This is a loading problem, not a lack of activity.', 'זו תקלת טעינה, לא היעדר פעילות.')}
            onRetry={load}
            retryLabel={t('Try again', 'נסו שוב')}
          />
        )}

        {/* Premium KPI row */}
        <motion.section
          className="grid grid-cols-2 lg:grid-cols-5 gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <KpiCard
            label={t('Revenue', 'הכנסה')}
            value={ils(overview?.totalRevenue ?? 0)}
            accent="#7dd3fc"
            icon={Coins}
            hint={t('total in window', 'סה״כ בחלון')}
          />
          <KpiCard
            label={t('Demand · views', 'ביקוש · צפיות')}
            value={(overview?.totalViews ?? 0).toLocaleString()}
            accent="#fbbf24"
            icon={Eye}
            delta={viewsDelta}
            series={(overview?.viewsByDay ?? []).slice(-14)}
            hint={t('vs last week', 'מול שבוע קודם')}
          />
          <KpiCard
            label={t('Orders', 'הזמנות')}
            value={(overview?.totalOrders ?? 0).toLocaleString()}
            accent="#34d399"
            icon={ShoppingBag}
            delta={ordersDelta}
            series={(overview?.ordersByDay ?? []).slice(-14)}
            hint={t('vs last week', 'מול שבוע קודם')}
          />
          <KpiCard
            label={t('Conversion', 'המרה')}
            value={hasConfidentSample(overview?.totalViews ?? 0) ? `${Math.round(overview?.conversionPct ?? 0)}%` : '—'}
            accent="#f59e0b"
            icon={Percent}
            hint={t('ordered / viewed', 'הזמינו / צפו')}
          />
          <KpiCard
            label={t('Profit', 'רווח')}
            value={ils(overview?.totalProfit ?? 0)}
            accent="#a78bfa"
            icon={TrendingUp}
            hint={t('revenue − pour cost', 'הכנסה − עלות מזיגה')}
          />
        </motion.section>

        {!loading && overview && !overview.hasData && (
          <EmptyState
            title={t(
              'No views or orders captured yet — interact with the menu to populate these.',
              'עדיין אין צפיות או הזמנות — פעל בתפריט כדי למלא את הנתונים.',
            )}
          />
        )}

        {/* Top performers with imagery */}
        {performers.length > 0 && (
          <section>
            <SectionLabel icon={TrendingUp}>{t('Top performers', 'הפריטים המובילים')}</SectionLabel>
            <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {performers.map((it, i) => (
                <motion.div key={it.slug} variants={staggerItem}>
                  <HoverLift accent={it.accent} className="h-full">
                    <div className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-5">
                      <AccentWash accent={it.accent} />
                      <span className="absolute top-3 start-4 z-10 text-white/15 text-5xl font-bold leading-none" style={{ fontFamily: serif }}>
                        {i + 1}
                      </span>
                      <GlassImage src={it.hero} accent={it.accent} className="relative w-full h-72 lg:h-80 mb-4 transition-transform duration-500 group-hover:scale-[1.04]" />
                      <p className="relative text-white/95 text-17 text-center leading-tight" style={{ fontFamily: isHebrew ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 600 }}>
                        {it.title[lang]}
                      </p>
                      <div className="relative mt-3 flex items-center justify-center gap-4 text-xs" style={{ fontFamily: sans }}>
                        <span className="inline-flex items-center gap-1 text-amber-200/80">
                          <Eye size={13} strokeWidth={2} /> {it.views.toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-300/80">
                          <ShoppingBag size={13} strokeWidth={2} /> {it.orders.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </HoverLift>
                </motion.div>
              ))}
            </Stagger>
          </section>
        )}

        {/* Day-trend panels with a client-side period selector */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel icon={TrendingUp}>{t('Daily trend', 'מגמה יומית')}</SectionLabel>
            <div
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
              role="group"
              aria-label={t('Trend period', 'טווח זמן')}
            >
              {TREND_PERIODS.map((p) => {
                const isActive = p.key === trendPeriod;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setTrendPeriod(p.key)}
                    aria-pressed={isActive}
                    className={`rounded-full px-3 py-1 text-11 tracking-wide transition-colors duration-200 ${
                      isActive ? 'bg-amber-400/90 text-black' : 'text-white/55 hover:text-white/85'
                    }`}
                    style={{ fontFamily: sans }}
                  >
                    {t(p.en, p.he)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TrendPanel
              title={t('Drink views', 'צפיות בקוקטיילים')}
              total={sum(viewsSlice)}
              data={viewsSlice}
              color="#e8c987"
              delta={viewsDelta}
              icon={Eye}
              peakLabel={t('peak', 'שיא')}
              lastLabel={t('today', 'היום')}
            />
            <TrendPanel
              title={t('Orders', 'הזמנות')}
              total={sum(ordersSlice)}
              data={ordersSlice}
              color="#34d399"
              delta={ordersDelta}
              icon={ShoppingBag}
              peakLabel={t('peak', 'שיא')}
              lastLabel={t('today', 'היום')}
            />
          </div>
        </section>

        {/* Top items table */}
        <GlassCard className="p-6" static>
          <PanelHeader label={t('Top items', 'פריטים מובילים')} />
          {overview && overview.topItems.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-10 tracking-[0.3em] uppercase">
                    <th className="text-start pb-3 font-normal">{t('Cocktail', 'קוקטייל')}</th>
                    <th className="text-end pb-3 font-normal">{t('Views', 'צפיות')}</th>
                    <th className="text-end pb-3 font-normal">{t('Orders', 'הזמנות')}</th>
                    <th className="text-end pb-3 font-normal hidden sm:table-cell">{t('Units', 'יח׳')}</th>
                    <th className="text-end pb-3 font-normal">{t('Revenue', 'הכנסה')}</th>
                    <th className="text-end pb-3 font-normal">{t('Conv.', 'המרה')}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topItems.map((row) => (
                    <tr key={row.slug} className="border-t border-white/[0.06]">
                      <td className="py-3 text-white/90">
                        <span style={{ fontFamily: serif, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                          {titleBySlug.get(row.slug) ?? row.slug}
                        </span>
                      </td>
                      <td className="py-3 text-end text-white/70 font-mono">{row.views.toLocaleString()}</td>
                      <td className="py-3 text-end text-white/70 font-mono">{row.orders.toLocaleString()}</td>
                      <td className="py-3 text-end text-white/70 font-mono hidden sm:table-cell">{row.units.toLocaleString()}</td>
                      <td className="py-3 text-end text-emerald-200/90 font-mono">{ils(row.revenue)}</td>
                      <td className="py-3 text-end text-amber-100 font-mono" title={t('Not enough data yet to trust this rate', 'עדיין אין מספיק נתונים כדי לסמוך על האחוז')}>{hasConfidentSample(row.views) ? `${Math.round(row.conversionPct)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loading ? (
            <div className="mt-4 flex flex-col gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <EmptyState title={t('No items yet.', 'עדיין אין פריטים.')} />
          )}
        </GlassCard>

        {/* Engagement by hour */}
        <GlassCard className="p-6" static>
          <PanelHeader label={t('Engagement by hour (UTC)', 'מעורבות לפי שעה (UTC)')} />
          <div className="mt-4 flex items-end gap-1.5 h-32" dir="ltr">
            {(overview?.hourHeatmap ?? new Array(24).fill(0)).map((v, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${h}:00 — ${(v * 100).toFixed(0)}%`}>
                <div className="w-full rounded-sm" style={{ height: `${Math.max(2, v * 100)}%`, background: `rgba(232, 201, 135, ${0.25 + v * 0.65})` }} />
                {(h === 0 || h === 6 || h === 12 || h === 18 || h === 23) && (
                  <span className="text-white/40 text-9 font-mono" style={{ fontFamily: sans }}>
                    {h.toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        <p className="text-center text-white/30 text-10 tracking-[0.4em] uppercase pt-6 border-t border-white/10" style={{ fontFamily: sans }}>
          {t('Live · anonymized events', 'בזמן אמת · אירועים אנונימיים')}
        </p>
      </div>
    </AdminShell>
  );
}

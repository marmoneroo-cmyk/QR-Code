'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MENU } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { AdminLauncher } from '@/components/ui/AdminLauncher';
import { Skeleton, AreaChart, CountUpText } from '@/components/ui/dataviz';
import { GlassCard, PanelHeader, CtaPill, EmptyState, ErrorState, StatBlock, LUX_EASE } from '@/components/ui/premium';
import { GlassSheen } from '@/components/ui/visual';
import { staggerContainer, staggerItem } from '@/components/ui/motion';
import { useLang } from '@/lib/useLang';
import { hasConfidentSample } from '@/lib/analytics/rate';
import { totalPotential } from '@/lib/value/potential';
import { formatILS } from '@/lib/format';
import type { Opportunity, OpportunityType } from '@/lib/opportunities/types';
import type { AnalyticsOverview, MenuEngineering } from '@/lib/analytics/types';
import type { Promotion } from '@/lib/promotions/types';
import type { ClosedLoopReport } from '@/lib/closedloop/server';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';

const OPP_LABEL: Record<OpportunityType, { en: string; he: string }> = {
  fix_offer: { en: 'Review offer', he: 'בדקו הצעה' },
  promote_position: { en: 'Move up', he: 'העלו במיקום' },
  promote_marketing: { en: 'Promote', he: 'קדמו' },
  promotion_candidate: { en: 'Promo candidate', he: 'מועמד למבצע' },
  reengage_returning: { en: 'Re-engage', he: 'החזירו' },
};

export default function HomeDashboardPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';

  const {
    data: oppsData,
    loading: oppsLoading,
    error: oppsError,
    reload: reloadOpps,
  } = useApiData<{ opportunities: Opportunity[] }>('/api/analytics/opportunities');
  const {
    data: overview,
    loading: overviewLoading,
    error: overviewError,
    reload: reloadOverview,
  } = useApiData<AnalyticsOverview>('/api/analytics/overview');
  const {
    data: menu,
    loading: menuLoading,
    error: menuError,
    reload: reloadMenu,
  } = useApiData<MenuEngineering>('/api/analytics/menu-engineering');
  const {
    data: promosData,
    loading: promosLoading,
    error: promosError,
    reload: reloadPromos,
  } = useApiData<Promotion[]>('/api/promotions/mine?activeOnly=true');
  const {
    data: loop,
    loading: loopLoading,
    error: loopError,
    reload: reloadLoop,
  } = useApiData<ClosedLoopReport>('/api/closed-loop');

  const opps = oppsData?.opportunities ?? [];
  const promos = promosData ?? [];
  // Loading until every widget's endpoint has settled — matches the old Promise.all gate.
  const loading = oppsLoading || overviewLoading || menuLoading || promosLoading || loopLoading;
  // A live backend returns zeroed data (not null) for a new restaurant, so ALL-failed
  // means an outage/auth failure — a real error, not "no data yet".
  const error = !loading && [oppsError, overviewError, menuError, promosError, loopError].every((e) => e !== null);

  const load = useCallback(() => {
    reloadOpps();
    reloadOverview();
    reloadMenu();
    reloadPromos();
    reloadLoop();
  }, [reloadOpps, reloadOverview, reloadMenu, reloadPromos, reloadLoop]);

  const titleBySlug = useMemo(() => new Map(MENU.map((c) => [c.slug, c.title])), []);
  const t = (slug: string | null | undefined) => (slug ? titleBySlug.get(slug)?.[lang] ?? slug : '—');

  const traffic = useMemo(() => {
    const series = overview?.viewsByDay ?? [];
    const last7 = series.slice(-7).reduce((a, b) => a + b, 0);
    const prev7 = series.slice(-14, -7).reduce((a, b) => a + b, 0);
    const deltaPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
    return { series: series.slice(-14), deltaPct };
  }, [overview]);

  const menuTop = menu?.items?.length
    ? [...menu.items].sort((a, b) => b.attentionScore - a.attentionScore)[0]
    : null;
  const menuWeak = menu?.items?.length
    ? [...menu.items].sort((a, b) => a.attentionScore - b.attentionScore)[0]
    : null;

  const wins = (loop?.measured ?? []).filter((m) => m.result.status === 'success' || m.result.status === 'declined').slice(0, 3);

  // Honest money hero: sums ONLY quantified upsides from real per-item analytics.
  const potential = useMemo(() => totalPotential(menu?.items ?? []), [menu]);

  return (
    <AdminShell
      title="Home"
      titleHe="בית"
      eyebrow="What should I do today?"
      eyebrowHe="מה כדאי לעשות היום?"
      active="/admin/home"
      subtitle="Your restaurant at a glance — top actions, health, and what changed. Everything else is one click away."
      subtitleHe="המסעדה שלך במבט אחד — פעולות מובילות, בריאות, ומה השתנה. כל השאר במרחק קליק."
    >
      {/* MONEY HERO — dominant revenue hero (honest: quantified upside only, realized = ₪0) */}
      {!loading && <MoneyHero potential={potential} isHe={isHe} />}

      {/* Icon launcher — the control center: click any section */}
      <section className="mb-12">
        <AdminLauncher lang={lang} />
      </section>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3" dir={isHe ? 'rtl' : 'ltr'} aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`glass-panel rounded-3xl p-5 flex flex-col gap-3 ${i === 0 ? 'md:col-span-2' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-2.5 w-10" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title={isHe ? 'לא הצלחנו לטעון את הנתונים' : 'Couldn’t load your dashboard'}
          hint={isHe ? 'בדקו את החיבור ונסו שוב — הנתונים שלכם בטוחים.' : 'Check your connection and try again — your data is safe.'}
          onRetry={load}
          retryLabel={isHe ? 'נסו שוב' : 'Try again'}
        />
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-3"
          dir={isHe ? 'rtl' : 'ltr'}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {/* Top Opportunities — wide */}
          <Widget title={isHe ? 'הזדמנויות מובילות' : 'Top Opportunities'} href="/admin/opportunities" cta={isHe ? 'הכול' : 'All'} className="md:col-span-2" isHe={isHe}>
            {opps.length === 0 ? (
              <EmptyState
                title={isHe ? 'אין עדיין נתונים.' : 'No data yet.'}
                hint={isHe ? 'ככל שיגיעו עוד אורחים, הזדמנויות יופיעו כאן.' : 'As more guests arrive, opportunities appear here.'}
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {opps.slice(0, 3).map((o, i) => (
                  <li key={`${o.slug}:${o.type}:${i}`} className="flex items-start gap-3 rounded-xl border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-white/[0.06] hover:bg-white/[0.02]">
                    <span className="mt-0.5 shrink-0 text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-full border border-amber-200/30 text-amber-200/90" style={{ fontFamily: sans }}>
                      {OPP_LABEL[o.type][lang]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white/90 text-[13px] leading-snug" style={{ fontFamily: sans }}>{t(o.slug)}</p>
                      <p className="text-white/50 text-[12px] leading-snug truncate" style={{ fontFamily: sans }}>{o.action[lang]}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          {/* Impact Tracker */}
          <Widget title={isHe ? 'מד השפעה' : 'Impact Tracker'} href="/admin/results" cta={isHe ? 'לולאה' : 'Loop'} isHe={isHe}>
            {wins.length === 0 ? (
              <EmptyState title={isHe ? 'אין עדיין תוצאות נמדדות.' : 'No measured results yet.'} />
            ) : (
              <ul className="flex flex-col gap-2">
                {wins.map((m) => (
                  <li key={m.change.id} className="text-[12px]" style={{ fontFamily: sans }}>
                    <span className="text-white/80">{t(m.change.entityId)}</span>{' '}
                    <span className={m.result.direction === 'down' ? 'text-rose-200' : 'text-emerald-200'}>
                      {m.result.deltaPct !== null ? `${m.result.deltaPct > 0 ? '+' : ''}${m.result.deltaPct}%` : (isHe ? 'עלייה' : 'up')}
                    </span>
                    <span className="text-white/35"> · {m.observationDays}{isHe ? 'י' : 'd'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          {/* Business Health */}
          <Widget title={isHe ? 'בריאות העסק' : 'Business Health'} href="/admin/analytics" cta={isHe ? 'אנליטיקה' : 'Analytics'} isHe={isHe}>
            {!overview ? (
              <EmptyState title={isHe ? 'אין עדיין נתונים.' : 'No data yet.'} />
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <Kpi label={isHe ? 'צפיות' : 'Views'} value={String(overview.totalViews)} />
                <Kpi label={isHe ? 'אחוז הזמנה' : 'Order rate'} value={hasConfidentSample(overview.totalViews) ? `${Math.round(overview.conversionPct)}%` : '—'} />
                <Kpi label={isHe ? 'הכנסה' : 'Revenue'} value={formatILS(overview.totalRevenue)} />
                <Kpi label={isHe ? 'רווח' : 'Profit'} value={formatILS(overview.totalProfit)} />
              </div>
            )}
          </Widget>

          {/* Traffic Trends */}
          <Widget title={isHe ? 'מגמת תנועה' : 'Traffic Trends'} href="/admin/analytics" cta={isHe ? '14 ימים' : '14 days'} isHe={isHe}>
            {traffic.series.length === 0 ? (
              <EmptyState title={isHe ? 'אין עדיין נתונים.' : 'No data yet.'} />
            ) : (
              <div className="flex flex-col gap-2">
                <AreaChart data={traffic.series} color="var(--champagne)" height={64} />
                <p className="text-[12px]" style={{ fontFamily: sans }}>
                  {traffic.deltaPct === null ? (
                    <span className="text-white/40">{isHe ? 'אין מספיק היסטוריה' : 'Not enough history'}</span>
                  ) : (
                    <span className={traffic.deltaPct < 0 ? 'text-rose-200' : 'text-emerald-200'}>
                      {traffic.deltaPct > 0 ? '▲ +' : traffic.deltaPct < 0 ? '▼ ' : '■ '}{traffic.deltaPct}% {isHe ? 'מול השבוע הקודם' : 'vs prior 7 days'}
                    </span>
                  )}
                </p>
              </div>
            )}
          </Widget>

          {/* Promotion Status */}
          <Widget title={isHe ? 'מבצעים פעילים' : 'Promotion Status'} href="/admin/promote" cta={isHe ? 'נהל' : 'Manage'} isHe={isHe}>
            {promos.length === 0 ? (
              <EmptyState title={isHe ? 'אין מבצעים פעילים.' : 'No active promotions.'} />
            ) : (
              <ul className="flex flex-col gap-1.5 text-[12px]" style={{ fontFamily: sans }}>
                {promos.slice(0, 4).map((p) => (
                  <li key={p.id} className="text-white/80">
                    {p.name} <span className="text-amber-200/80">−{p.value}{p.type === 'percentage' ? '%' : '₪'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          {/* Menu Performance */}
          <Widget title={isHe ? 'ביצועי תפריט' : 'Menu Performance'} href="/admin/menu-engineering" cta={isHe ? 'הנדסה' : 'Detail'} isHe={isHe}>
            {!menuTop ? (
              <EmptyState title={isHe ? 'אין עדיין נתונים.' : 'No data yet.'} />
            ) : (
              <div className="flex flex-col gap-2 text-[12px]" style={{ fontFamily: sans }}>
                <p><span className="text-emerald-200/90">★ {isHe ? 'מוביל: ' : 'Best: '}</span><span className="text-white/85">{t(menuTop.slug)}</span></p>
                {menuWeak && menuWeak.slug !== menuTop.slug && (
                  <p><span className="text-rose-200/80">↓ {isHe ? 'חלש: ' : 'Weakest: '}</span><span className="text-white/85">{t(menuWeak.slug)}</span></p>
                )}
              </div>
            )}
          </Widget>

          {/* Recent Changes */}
          <Widget title={isHe ? 'שינויים אחרונים' : 'Recent Changes'} href="/admin/results" cta={isHe ? 'הכול' : 'All'} isHe={isHe}>
            {!loop || loop.timeline.length === 0 ? (
              <EmptyState title={isHe ? 'אין שינויים שתועדו.' : 'No changes logged.'} />
            ) : (
              <ul className="flex flex-col gap-1.5 text-[12px]" style={{ fontFamily: sans }}>
                {loop.timeline.slice(0, 4).map((c) => (
                  <li key={c.id} className="text-white/75 flex justify-between gap-2">
                    <span className="truncate">{c.summary ?? c.changeType}</span>
                    <span className="text-white/30 shrink-0">{c.createdAt.slice(5, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </motion.div>
      )}
    </AdminShell>
  );
}

/**
 * Dominant, honest money hero — the "growth engine" panel. Emerald stays the
 * money/growth semantic; the frame is a slow flowing gradient border with a
 * glass sheen. Realized is honestly ₪0 — no measured attribution yet.
 */
function MoneyHero({ potential, isHe }: { potential: { revenueILS: number; count: number }; isHe: boolean }) {
  const t = (en: string, he: string) => (isHe ? he : en);
  const hasUpside = potential.count > 0;
  const availableText = formatILS(potential.revenueILS);
  return (
    <motion.section
      className="relative mb-8 overflow-hidden rounded-[28px] p-[1px]"
      style={{
        background: 'linear-gradient(120deg, rgba(52,211,153,0.5), rgba(232,201,135,0.16) 38%, rgba(16,185,129,0.1) 62%, rgba(52,211,153,0.42))',
        backgroundSize: '220% 220%',
        animation: 'border-flow 14s ease-in-out infinite',
      }}
      dir={isHe ? 'rtl' : 'ltr'}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: LUX_EASE }}
    >
      <div className="relative rounded-[27px] bg-zinc-950/92 backdrop-blur-xl px-6 py-8 sm:px-9">
        <GlassSheen />
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 start-1/4 h-64 w-1/2 rounded-full opacity-[0.09]"
          style={{ background: 'radial-gradient(ellipse at center, #34d399, transparent 65%)', filter: 'blur(30px)' }}
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          {/* Three stats */}
          <motion.div
            className="flex flex-wrap items-end gap-x-12 gap-y-6"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={staggerItem}>
              <StatBlock value={potential.count} label={t('recommended actions', 'פעולות מומלצות')} tone="emerald" />
            </motion.div>

            <motion.div variants={staggerItem}>
              {hasUpside ? (
                <StatBlock
                  value={
                    <CountUpText
                      text={availableText}
                      className="block leading-none"
                      style={{ fontFamily: 'var(--font-playfair, serif)', fontWeight: 700 }}
                    />
                  }
                  label={t('available now · est.', 'זמין כעת · צפי')}
                  size="hero"
                  tone="emerald"
                />
              ) : (
                <StatBlock
                  value={<span className="leading-tight text-white/85" style={{ fontSize: 'clamp(1.3rem,3vw,1.8rem)' }}>{t('collect more guest visits', 'אספו עוד ביקורי אורחים')}</span>}
                  label={t('available now · est.', 'זמין כעת · צפי')}
                  size="hero"
                  tone="white"
                />
              )}
            </motion.div>

            <motion.div variants={staggerItem}>
              <StatBlock value="₪0" label={t('realized', 'מומשו')} tone="muted" />
            </motion.div>
          </motion.div>

          {/* Act now CTA */}
          <CtaPill href="/admin/actions">
            {t('Act now', 'בצע עכשיו')}
            <span className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">{isHe ? '↩' : '→'}</span>
          </CtaPill>
        </div>
      </div>
    </motion.section>
  );
}

function Widget({ title, href, cta, children, className, isHe }: { title: string; href: string; cta: string; children: ReactNode; className?: string; isHe: boolean }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      <GlassCard className="h-full p-5 flex flex-col gap-3.5">
        <PanelHeader label={title} href={href} cta={cta} isHe={isHe} />
        {children}
      </GlassCard>
    </motion.div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white text-xl leading-none" style={{ fontFamily: 'var(--font-playfair, serif)', fontWeight: 600 }}>{value}</p>
      <p className="mt-1.5 text-[10px] tracking-[0.12em] uppercase text-white/40" style={{ fontFamily: sans }}>{label}</p>
    </div>
  );
}

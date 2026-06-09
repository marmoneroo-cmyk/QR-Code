'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { MENU } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { AdminLauncher } from '@/components/ui/AdminLauncher';
import { Skeleton, AreaChart, CountUpText } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import { totalPotential } from '@/lib/value/potential';
import type { Opportunity, OpportunityType } from '@/lib/opportunities/types';
import type { AnalyticsOverview, MenuEngineering } from '@/lib/analytics/types';
import type { Promotion } from '@/lib/promotions/types';
import type { ClosedLoopReport } from '@/lib/closedloop/server';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

const OPP_LABEL: Record<OpportunityType, { en: string; he: string }> = {
  fix_offer: { en: 'Review offer', he: 'בדקו הצעה' },
  promote_position: { en: 'Move up', he: 'העלו במיקום' },
  promote_marketing: { en: 'Promote', he: 'קדמו' },
  promotion_candidate: { en: 'Promo candidate', he: 'מועמד למבצע' },
  reengage_returning: { en: 'Re-engage', he: 'החזירו' },
};

interface Json<T> {
  success: boolean;
  data?: T;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const json: Json<T> = await res.json();
    return json.success && json.data !== undefined ? json.data : null;
  } catch {
    return null;
  }
}

export default function HomeDashboardPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [menu, setMenu] = useState<MenuEngineering | null>(null);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loop, setLoop] = useState<ClosedLoopReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [o, ov, me, pr, cl] = await Promise.all([
        getJson<{ opportunities: Opportunity[] }>('/api/analytics/opportunities'),
        getJson<AnalyticsOverview>('/api/analytics/overview'),
        getJson<MenuEngineering>('/api/analytics/menu-engineering'),
        getJson<Promotion[]>('/api/promotions?restaurant=diner&activeOnly=true'),
        getJson<ClosedLoopReport>('/api/closed-loop'),
      ]);
      if (cancelled) return;
      setOpps(o?.opportunities ?? []);
      setOverview(ov);
      setMenu(me);
      setPromos(pr ?? []);
      setLoop(cl);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-3 ${i === 0 ? 'md:col-span-2' : ''}`}
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
      ) : (
        <div className="grid gap-4 md:grid-cols-3" dir={isHe ? 'rtl' : 'ltr'}>
          {/* Top Opportunities — wide */}
          <Widget title={isHe ? 'הזדמנויות מובילות' : 'Top Opportunities'} href="/admin/opportunities" cta={isHe ? 'הכול' : 'All'} className="md:col-span-2" lang={lang}>
            {opps.length === 0 ? (
              <Empty isHe={isHe} />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {opps.slice(0, 3).map((o, i) => (
                  <li key={`${o.slug}:${o.type}:${i}`} className="flex items-start gap-3">
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
          <Widget title={isHe ? 'מד השפעה' : 'Impact Tracker'} href="/admin/closed-loop" cta={isHe ? 'לולאה' : 'Loop'} lang={lang}>
            {wins.length === 0 ? (
              <p className="text-white/40 text-[12px] italic" style={{ fontFamily: sans }}>
                {isHe ? 'אין עדיין תוצאות נמדדות.' : 'No measured results yet.'}
              </p>
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
          <Widget title={isHe ? 'בריאות העסק' : 'Business Health'} href="/admin/analytics" cta={isHe ? 'אנליטיקה' : 'Analytics'} lang={lang}>
            {!overview ? <Empty isHe={isHe} /> : (
              <div className="grid grid-cols-2 gap-3">
                <Kpi label={isHe ? 'צפיות' : 'Views'} value={String(overview.totalViews)} />
                <Kpi label={isHe ? 'המרה' : 'Conversion'} value={`${Math.round(overview.conversionPct)}%`} />
                <Kpi label={isHe ? 'הכנסה' : 'Revenue'} value={`₪${Math.round(overview.totalRevenue).toLocaleString()}`} />
                <Kpi label={isHe ? 'רווח' : 'Profit'} value={`₪${Math.round(overview.totalProfit).toLocaleString()}`} />
              </div>
            )}
          </Widget>

          {/* Traffic Trends */}
          <Widget title={isHe ? 'מגמת תנועה' : 'Traffic Trends'} href="/admin/analytics" cta={isHe ? '14 ימים' : '14 days'} lang={lang}>
            {traffic.series.length === 0 ? <Empty isHe={isHe} /> : (
              <div className="flex flex-col gap-2">
                <AreaChart data={traffic.series} color="#fbbf24" height={64} />
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
          <Widget title={isHe ? 'מבצעים פעילים' : 'Promotion Status'} href="/admin/promotions" cta={isHe ? 'נהל' : 'Manage'} lang={lang}>
            {promos.length === 0 ? (
              <p className="text-white/40 text-[12px] italic" style={{ fontFamily: sans }}>
                {isHe ? 'אין מבצעים פעילים.' : 'No active promotions.'}
              </p>
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
          <Widget title={isHe ? 'ביצועי תפריט' : 'Menu Performance'} href="/admin/menu-engineering" cta={isHe ? 'הנדסה' : 'Detail'} lang={lang}>
            {!menuTop ? <Empty isHe={isHe} /> : (
              <div className="flex flex-col gap-2 text-[12px]" style={{ fontFamily: sans }}>
                <p><span className="text-emerald-200/90">★ {isHe ? 'מוביל: ' : 'Best: '}</span><span className="text-white/85">{t(menuTop.slug)}</span></p>
                {menuWeak && menuWeak.slug !== menuTop.slug && (
                  <p><span className="text-rose-200/80">↓ {isHe ? 'חלש: ' : 'Weakest: '}</span><span className="text-white/85">{t(menuWeak.slug)}</span></p>
                )}
              </div>
            )}
          </Widget>

          {/* Recent Changes */}
          <Widget title={isHe ? 'שינויים אחרונים' : 'Recent Changes'} href="/admin/closed-loop" cta={isHe ? 'הכול' : 'All'} lang={lang}>
            {!loop || loop.timeline.length === 0 ? (
              <p className="text-white/40 text-[12px] italic" style={{ fontFamily: sans }}>
                {isHe ? 'אין שינויים שתועדו.' : 'No changes logged.'}
              </p>
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
        </div>
      )}
    </AdminShell>
  );
}

/**
 * Dominant, honest money hero (Bloomberg/Tesla feel): three stacked/inline stats
 * (recommended actions · available-now estimate · realized) + a big amber "Act now"
 * CTA → opportunities. Realized is honestly ₪0 — we have no measured attribution yet.
 */
function MoneyHero({ potential, isHe }: { potential: { revenueILS: number; count: number }; isHe: boolean }) {
  const t = (en: string, he: string) => (isHe ? he : en);
  const hasUpside = potential.count > 0;
  const availableText = `₪${Math.round(potential.revenueILS).toLocaleString()}`;
  return (
    <section
      className="relative mb-8 overflow-hidden rounded-2xl p-[1px]"
      style={{ background: 'linear-gradient(120deg, rgba(52,211,153,0.55), rgba(16,185,129,0.12) 55%, rgba(52,211,153,0.45))' }}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <div className="rounded-[calc(1rem-1px)] bg-zinc-950/90 backdrop-blur-xl px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Three stats */}
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
            {/* Recommended actions */}
            <div className="min-w-0">
              <p className="text-emerald-300 leading-none" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.6rem,3.5vw,2.4rem)' }}>
                {potential.count}
              </p>
              <p className="mt-1.5 text-white/50 text-[11px] tracking-wide" style={{ fontFamily: sans }}>
                {t('recommended actions', 'פעולות מומלצות')}
              </p>
            </div>

            {/* Available now · estimate (hero number) */}
            <div className="min-w-0">
              {hasUpside ? (
                <CountUpText
                  text={availableText}
                  className="block text-emerald-300 leading-none"
                  style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(2rem,5vw,3.2rem)' }}
                />
              ) : (
                <p className="text-white/85 leading-tight" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.3rem,3vw,1.8rem)' }}>
                  {t('collect more traffic', 'אסוף עוד תנועה')}
                </p>
              )}
              <p className="mt-1.5 text-white/50 text-[11px] tracking-wide" style={{ fontFamily: sans }}>
                {t('available now · est.', 'זמין כעת · צפי')}
              </p>
            </div>

            {/* Realized — honestly ₪0 (no measured attribution yet) */}
            <div className="min-w-0">
              <p className="text-white/40 leading-none" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.6rem,3.5vw,2.4rem)' }}>
                ₪0
              </p>
              <p className="mt-1.5 text-white/40 text-[11px] tracking-wide" style={{ fontFamily: sans }}>
                {t('realized', 'מומשו')}
              </p>
            </div>
          </div>

          {/* Act now CTA — big amber pill */}
          <Link
            href="/admin/opportunities"
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-7 py-3.5 text-[13px] tracking-[0.16em] uppercase text-black shadow-[0_10px_30px_rgba(252,211,77,0.28)] transition-all hover:from-amber-200 hover:to-amber-300 hover:shadow-[0_12px_38px_rgba(252,211,77,0.4)]"
            style={{ fontFamily: sans, fontWeight: 700 }}
          >
            {t('Act now', 'בצע עכשיו')}
            <span className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">{isHe ? '↩' : '→'}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Widget({ title, href, cta, children, className, lang }: { title: string; href: string; cta: string; children: ReactNode; className?: string; lang: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-amber-200/90 text-[10px] tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>{title}</h3>
        <Link href={href} className="text-amber-200/60 hover:text-amber-100 text-[10px] tracking-[0.2em] uppercase" style={{ fontFamily: sans }}>
          {cta} {lang === 'he' ? '↩' : '→'}
        </Link>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white text-xl" style={{ fontFamily: serif, fontWeight: 600 }}>{value}</p>
      <p className="text-white/45 text-[11px]" style={{ fontFamily: sans }}>{label}</p>
    </div>
  );
}

function Empty({ isHe }: { isHe: boolean }) {
  return <p className="text-white/40 text-[12px] italic" style={{ fontFamily: sans }}>{isHe ? 'אין עדיין נתונים.' : 'No data yet.'}</p>;
}

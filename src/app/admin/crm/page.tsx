'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Users, Repeat, CalendarCheck, Activity, Flame, Eye, ShoppingBag, Languages, Smartphone } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { KpiCard, SectionLabel, Pill, Skeleton, SkeletonGrid, LiveDot } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import type { CrmSignals } from '@/lib/analytics/crm-types';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

interface SplitRow {
  label: string;
  count: number;
  color: string;
}

/** Horizontal share bar: each row sized by its share of the total. */
function ShareBar({ rows }: { rows: SplitRow[] }) {
  const total = Math.max(1, rows.reduce((sum, r) => sum + r.count, 0));
  return (
    <div className="space-y-3" dir="ltr">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
        {rows.map((r) => (
          <div key={r.label} style={{ width: `${(r.count / total) * 100}%`, background: r.color }} title={`${r.label}: ${r.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {rows.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-2 text-[11px]" style={{ fontFamily: sans }}>
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            <span className="text-white/70">{r.label}</span>
            <span className="text-white/40 font-mono">{((r.count / total) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface SegmentCardProps {
  icon: LucideIcon;
  accent: string;
  title: string;
  count: number;
  total: number;
  meaning: string;
}

/** Premium behavior-segment card: icon, big serif count, share bar, one-line meaning. */
function SegmentCard({ icon: Icon, accent, title, count, total, meaning }: SegmentCardProps) {
  const share = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="grid place-items-center w-9 h-9 rounded-xl" style={{ color: accent, background: `${accent}1a` }}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="text-white/40 text-[11px] font-mono" style={{ fontFamily: sans }}>{share.toFixed(0)}%</span>
      </div>
      <div>
        <p className="text-white leading-none" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(2rem,4vw,2.6rem)' }}>
          {count.toLocaleString()}
        </p>
        <p className="text-white/55 text-[12px] mt-2 tracking-wide" style={{ fontFamily: sans }}>{title}</p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden" dir="ltr">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, share)}%`, background: accent }} />
      </div>
      <p className="text-white/45 text-[12px] leading-relaxed" style={{ fontFamily: sans }}>{meaning}</p>
    </div>
  );
}

interface DonutSegment {
  label: string;
  count: number;
  color: string;
}

/** Polar → cartesian on a unit circle, 12 o'clock = 0°, clockwise. */
function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** SVG arc path for a donut slice between two angles (degrees). */
function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number): string {
  const so = polar(cx, cy, rOuter, endDeg);
  const eo = polar(cx, cy, rOuter, startDeg);
  const si = polar(cx, cy, rInner, startDeg);
  const ei = polar(cx, cy, rInner, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return [
    `M ${so.x} ${so.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${eo.x} ${eo.y}`,
    `L ${si.x} ${si.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ');
}

/** Luxury donut: each segment a proportional arc, total in the center, legend below. */
function DonutChart({ segments, centerValue, centerLabel }: { segments: DonutSegment[]; centerValue: string; centerLabel: string }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const SIZE = 240;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rOuter = 104;
  const rInner = 70;
  const GAP = total > 0 ? 2 : 0; // degrees of breathing room between slices

  let cursor = 0;
  const slices = segments.map((s) => {
    const sweep = total > 0 ? (s.count / total) * 360 : 0;
    const start = cursor + GAP / 2;
    const end = cursor + sweep - GAP / 2;
    cursor += sweep;
    return { ...s, start, end, drawable: end > start };
  });

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-8" dir="ltr">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
          {/* track */}
          <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={rOuter - rInner} />
          {slices.map((s) =>
            s.drawable ? (
              <path key={s.label} d={arcPath(cx, cy, rOuter, rInner, s.start, s.end)} fill={s.color} stroke="rgba(8,8,12,0.55)" strokeWidth={1}>
                <title>{`${s.label}: ${s.count} (${total > 0 ? ((s.count / total) * 100).toFixed(0) : 0}%)`}</title>
              </path>
            ) : null,
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-white leading-none" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(1.8rem,3vw,2.4rem)' }}>
              {centerValue}
            </p>
            <p className="text-white/45 text-[10px] uppercase tracking-[0.3em] mt-2" style={{ fontFamily: sans }}>
              {centerLabel}
            </p>
          </div>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-3">
        {segments.map((s) => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <li key={s.label} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-white/70 text-[13px]" style={{ fontFamily: sans }}>{s.label}</span>
              <span className="text-white text-[13px] font-medium tabular-nums" style={{ fontFamily: sans }}>{s.count.toLocaleString()}</span>
              <span className="w-10 text-right text-white/40 text-[11px] font-mono tabular-nums">{pct.toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Radial 24-hour clock: one wedge per UTC hour, length + opacity ∝ activity. Peak hour highlighted. */
function RadialHourClock({ histogram, peakHour, peakAccent }: { histogram: number[]; peakHour: number; peakAccent: string }) {
  const SIZE = 260;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rBase = 46; // hub radius (min spoke start)
  const rMax = 116; // max spoke tip
  const n = histogram.length || 24;
  const wedge = 360 / n;
  const hasAny = histogram.some((v) => v > 0);

  return (
    <div className="flex justify-center" dir="ltr">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: SIZE, height: 'auto', display: 'block' }} role="img" aria-label="Activity by hour">
        {/* guide rings */}
        <circle cx={cx} cy={cy} r={rMax} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={rBase} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        {histogram.map((v, h) => {
          const start = h * wedge + wedge * 0.16;
          const end = (h + 1) * wedge - wedge * 0.16;
          const len = rBase + Math.max(0.04, v) * (rMax - rBase);
          const isPeak = hasAny && h === peakHour;
          const fill = isPeak ? peakAccent : `rgba(252, 211, 77, ${0.22 + v * 0.68})`;
          return (
            <path key={h} d={arcPath(cx, cy, len, rBase, start, end)} fill={fill}>
              <title>{`${h.toString().padStart(2, '0')}:00 — ${(v * 100).toFixed(0)}%`}</title>
            </path>
          );
        })}
        {/* cardinal hour labels */}
        {[0, 6, 12, 18].map((h) => {
          const p = polar(cx, cy, rMax + 12, h * wedge);
          return (
            <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontFamily="monospace" fill="rgba(255,255,255,0.4)">
              {h.toString().padStart(2, '0')}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function CrmPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const [data, setData] = useState<CrmSignals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/crm', { cache: 'no-store' });
      const json: { success: boolean; data?: CrmSignals } = await res.json();
      if (json.success && json.data) setData(json.data);
    } catch {
      /* keep last good data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const sessions = data?.totalSessions ?? 0;
  const ordering = data?.orderingSessions ?? 0;
  const orderRate = sessions > 0 ? (ordering / sessions) * 100 : 0;
  const avgEvents = data?.avgEventsPerSession ?? 0;
  const browsing = Math.max(0, sessions - ordering);
  const engaged = Math.round((avgEvents >= 4 ? 1 : avgEvents / 4) * sessions);
  const histogram: number[] = data?.hourHistogram ?? new Array<number>(24).fill(0);
  const peakHour = useMemo(() => histogram.indexOf(Math.max(...histogram)), [histogram]);

  const segmentColors = { ordering: '#34d399', browsing: '#fbbf24', engaged: '#f87171' } as const;
  const donutSegments = useMemo(
    () => [
      { label: t('Ordering guests', 'אורחים מזמינים'), count: ordering, color: segmentColors.ordering },
      { label: t('Browsing guests', 'אורחים מתעניינים'), count: browsing, color: segmentColors.browsing },
      { label: t('Engaged guests', 'אורחים מעורבים'), count: engaged, color: segmentColors.engaged },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordering, browsing, engaged, isHebrew],
  );

  return (
    <AdminShell
      title="Audience"
      titleHe="קהל"
      eyebrow="Your AI audience advisor"
      eyebrowHe="יועץ הקהל של ה‑AI"
      active="/admin/crm"
      subtitle="Anonymous behavior profiles — session-level signals only, with no names or contact details collected."
      subtitleHe="פרופילי התנהגות אנונימיים — אותות ברמת מושב בלבד, ללא שמות או פרטי קשר."
      actions={<LiveDot label={t('Live · auto-refresh', 'חי · רענון אוטומטי')} />}
    >
      {loading && !data ? (
        <div dir={isHebrew ? 'rtl' : 'ltr'}>
          <SkeletonGrid count={4} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12" />
          <section className="mb-12">
            <Skeleton className="mb-4 h-3 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          </section>
          <section className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </section>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
        <KpiCard icon={Users} accent="#fbbf24" label={t('Total guests', 'סך אורחים')} value={sessions.toLocaleString()} hint={t('distinct sessions', 'מושבים ייחודיים')} />
        <KpiCard icon={Repeat} accent="#34d399" label={t('Order rate', 'שיעור הזמנה')} value={`${orderRate.toFixed(0)}%`} hint={t('ordered / visited', 'הזמינו / ביקרו')} />
        <KpiCard icon={CalendarCheck} accent="#7dd3fc" label={t('Ordering guests', 'אורחים מזמינים')} value={ordering.toLocaleString()} hint={t('completed an order', 'השלימו הזמנה')} />
        <KpiCard icon={Activity} accent="#f59e0b" label={t('Avg actions', 'פעולות ממוצעות')} value={avgEvents.toFixed(1)} hint={t('per session', 'למושב')} />
      </section>

      {/* Empty state */}
      {!loading && data && !data.hasData && (
        <p className="text-center text-white/40 text-sm italic mb-12" style={{ fontFamily: sans }}>
          {t('No guests captured yet — interact with the menu to populate audience signals.', 'עדיין לא נקלטו אורחים — פעל בתפריט כדי למלא את אותות הקהל.')}
        </p>
      )}

      {/* Behavior segments */}
      <section className="mb-12">
        <SectionLabel icon={Users}>{t('Guest segments', 'מקטעי אורחים')}</SectionLabel>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 mb-3">
          <DonutChart
            segments={donutSegments}
            centerValue={sessions.toLocaleString()}
            centerLabel={t('Guests', 'אורחים')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SegmentCard
            icon={ShoppingBag}
            accent="#34d399"
            title={t('Ordering guests', 'אורחים מזמינים')}
            count={ordering}
            total={sessions}
            meaning={t('Reached checkout and completed an order — your most valuable visitors.', 'הגיעו לקופה והשלימו הזמנה — המבקרים היקרים ביותר.')}
          />
          <SegmentCard
            icon={Eye}
            accent="#fbbf24"
            title={t('Browsing guests', 'אורחים מתעניינים')}
            count={browsing}
            total={sessions}
            meaning={t('Explored the menu but did not order — the audience worth converting next.', 'עיינו בתפריט אך לא הזמינו — הקהל ששווה להמיר בהמשך.')}
          />
          <SegmentCard
            icon={Flame}
            accent="#f87171"
            title={t('Engaged guests', 'אורחים מעורבים')}
            count={engaged}
            total={sessions}
            meaning={t(`Averaged ${avgEvents.toFixed(1)} actions per visit — deep, attentive sessions.`, `ממוצע ${avgEvents.toFixed(1)} פעולות לביקור — מושבים עמוקים וקשובים.`)}
          />
        </div>
      </section>

      {/* Language + device split */}
      <section className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <SectionLabel icon={Languages}>{t('Language', 'שפה')}</SectionLabel>
          <ShareBar
            rows={[
              { label: 'EN', count: data?.languageSplit.en ?? 0, color: '#fcd34d' },
              { label: 'עברית', count: data?.languageSplit.he ?? 0, color: '#34d399' },
            ]}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <SectionLabel icon={Smartphone}>{t('Device', 'מכשיר')}</SectionLabel>
          <ShareBar
            rows={[
              { label: t('Mobile', 'נייד'), count: data?.deviceSplit.mobile ?? 0, color: '#fcd34d' },
              { label: t('Tablet', 'טאבלט'), count: data?.deviceSplit.tablet ?? 0, color: '#38bdf8' },
              { label: t('Desktop', 'שולחני'), count: data?.deviceSplit.desktop ?? 0, color: '#34d399' },
            ]}
          />
        </div>
      </section>

      {/* Hour histogram */}
      <section className="mb-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <SectionLabel>{t('Active guests by hour (UTC)', 'אורחים פעילים לפי שעה (UTC)')}</SectionLabel>
          {data?.hasData && <Pill icon={Flame} text={t(`Peak ${peakHour.toString().padStart(2, '0')}:00`, `שיא ${peakHour.toString().padStart(2, '0')}:00`)} accent="#fbbf24" />}
        </div>
        <RadialHourClock histogram={histogram} peakHour={peakHour} peakAccent="#fbbf24" />
      </section>

      {/* Returning-visitor caveat */}
      <section className="mb-12 rounded-2xl border border-amber-300/25 bg-amber-950/10 p-6" dir={isHebrew ? 'rtl' : 'ltr'}>
        <SectionLabel>{t('On returning guests', 'לגבי אורחים חוזרים')}</SectionLabel>
        <p className="text-white/55 text-sm leading-relaxed" style={{ fontFamily: sans }}>
          {t(
            'Every signal here is scoped to a single session. Events carry no persistent visitor id, so cross-visit "returning guest" profiles await a future visitor-id migration.',
            'כל אות כאן מתייחס למושב בודד. לאירועים אין מזהה מבקר קבוע, ולכן פרופילי "אורח חוזר" בין ביקורים ממתינים למיגרציה עתידית של מזהה-מבקר.',
          )}
        </p>
      </section>

      <p className="text-center text-white/30 text-[10px] tracking-[0.4em] uppercase pt-6 border-t border-white/10" style={{ fontFamily: sans }}>
        {t('Anonymous session signals · no PII · refreshes automatically', 'אותות מושב אנונימיים · ללא מידע אישי · מתעדכן אוטומטית')}
      </p>
        </>
      )}
    </AdminShell>
  );
}

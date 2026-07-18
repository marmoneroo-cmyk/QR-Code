'use client';

import {
  Activity,
  ShieldCheck,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Fingerprint,
  Heart,
  Circle,
  ListChecks,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { LiveDot, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { GlassCard, StatBlock } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { motion } from 'framer-motion';
import { useLang } from '@/lib/useLang';
import type { HealthStatus, SignalBlock, SignalVerification } from '@/lib/analytics/signals-types';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

/**
 * The /api/signals/verify payload carries English, machine-stable identifiers
 * (signal names, trend/drift metrics) and English human sentences (per-block
 * `detail` lines and readiness `blockedBy` strings). For Hebrew mode we localize
 * entirely on the client: stable identifiers are looked up in maps, and the
 * sentence strings are re-composed in Hebrew from the locale-neutral numbers
 * (counts / percentages / IDs) parsed back out of the English template. All
 * numbers, thresholds and logic stay exactly as the server produced them.
 */

/** Stable signal identifier → Hebrew block name (English key is shown as-is in EN). */
const SIGNAL_HE: Record<string, string> = {
  Dwell: 'שהות',
  Scroll: 'גלילה',
  Favorites: 'מועדפים',
  Visitor: 'מבקר',
  Source: 'מקור',
  Table: 'שולחן',
  Revenue: 'הכנסה',
};

/** Stable coverage-trend metric → Hebrew label. */
const TREND_METRIC_HE: Record<string, string> = {
  'Visitor coverage': 'כיסוי מבקרים',
  'Source coverage': 'כיסוי מקור',
};

/** Stable drift metric → Hebrew label (statistical P-codes stay as-is). */
const DRIFT_METRIC_HE: Record<string, string> = {
  'Dwell P50 (s)': 'שהות P50 (שׄ)',
  'Scroll P50 (%)': 'גלילה P50 (%)',
  'Favorites/day': 'מועדפים/יום',
  'Events/day': 'אירועים/יום',
};

/** Pull all numbers (including decimals) out of a server string, in order. */
function numbersIn(text: string): number[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** Localize a signal block name; falls back to the raw key for unknown signals. */
function localizeSignal(signal: string, isHe: boolean): string {
  if (!isHe) return signal;
  return SIGNAL_HE[signal] ?? signal;
}

/** Localize a coverage-trend metric label. */
function localizeTrendMetric(metric: string, isHe: boolean): string {
  if (!isHe) return metric;
  return TREND_METRIC_HE[metric] ?? metric;
}

/** Localize a drift metric label. */
function localizeDriftMetric(metric: string, isHe: boolean): string {
  if (!isHe) return metric;
  return DRIFT_METRIC_HE[metric] ?? metric;
}

/**
 * Re-compose a per-block instrumentation `detail` line in Hebrew. The English
 * template is keyed by signal; numbers are parsed from the original string so
 * counts/percentages stay byte-identical to the server output.
 */
function localizeDetail(signal: string, detail: string, isHe: boolean): string {
  if (!isHe) return detail;
  const n = numbersIn(detail);
  switch (signal) {
    case 'Dwell':
      // "42 samples · invalid 0%"
      return `${n[0] ?? 0} דגימות · לא תקין ${n[1] ?? 0}%`;
    case 'Scroll':
      // "18 samples · 100% rate 33.3%"
      return `${n[0] ?? 0} דגימות · שיעור 100% ${n[2] ?? 0}%`;
    case 'Favorites':
      // "0 events · add 0% / remove 0%"
      return `${n[0] ?? 0} אירועים · הוספה ${n[1] ?? 0}% / הסרה ${n[2] ?? 0}%`;
    case 'Visitor':
      // "6 visitors · 3 sess/visitor · coverage 66.9%"
      return `${n[0] ?? 0} מבקרים · ${n[1] ?? 0} ביקורים/מבקר · כיסוי ${n[2] ?? 0}%`;
    case 'Source':
      // "69.1% of events tagged"
      return `${n[0] ?? 0}% מהאירועים מתויגים`;
    case 'Table':
      // "no ?t= scans yet"  |  "12 table-tagged events"
      return detail.startsWith('no ')
        ? 'עדיין אין סריקות ?t='
        : `${n[0] ?? 0} אירועים מתויגי-שולחן`;
    case 'Revenue':
      // "no orders yet"  |  "1/6 orders carry price+cost"
      return detail.startsWith('no ')
        ? 'עדיין אין הזמנות'
        : `${n[0] ?? 0}/${n[1] ?? 0} הזמנות נושאות מחיר+עלות`;
    default:
      return detail;
  }
}

/**
 * Re-compose a readiness-gate `blockedBy` string in Hebrew. Each English
 * template is matched by a stable prefix; numbers come straight from the
 * original string so thresholds and counts are unchanged.
 */
function localizeBlocker(blocker: string, isHe: boolean): string {
  if (!isHe) return blocker;
  const n = numbersIn(blocker);
  if (blocker === 'Core signal not Green') return 'סיגנל ליבה לא ירוק';
  if (blocker === 'Critical drift (Alert)') return 'סחיפה קריטית (התראה)';
  if (blocker === 'no data yet') return 'עדיין אין נתונים';
  if (blocker.startsWith('Ready ')) {
    // "Ready 2/7 consecutive days"
    return `מוכן ${n[0] ?? 0}/${n[1] ?? 0} ימים רצופים`;
  }
  if (blocker.startsWith('Only ')) {
    // "Only 475 events (need 500)"
    return `רק ${n[0] ?? 0} אירועים (צריך ${n[1] ?? 0})`;
  }
  if (blocker.startsWith('Visitor coverage')) {
    // "Visitor coverage 66.9% (need 95)"
    return `כיסוי מבקרים ${n[0] ?? 0}% (צריך ${n[1] ?? 0})`;
  }
  if (blocker.startsWith('Source coverage')) {
    // "Source coverage 69.1% (need 95)"
    return `כיסוי מקור ${n[0] ?? 0}% (צריך ${n[1] ?? 0})`;
  }
  if (blocker.startsWith('Dwell samples')) {
    // "Dwell samples 42 (need 50)"
    return `דגימות שהות ${n[0] ?? 0} (צריך ${n[1] ?? 0})`;
  }
  if (blocker.startsWith('Scroll samples')) {
    // "Scroll samples 18 (need 50)"
    return `דגימות גלילה ${n[0] ?? 0} (צריך ${n[1] ?? 0})`;
  }
  return blocker;
}

/** Status palette — green / amber / red, used for rings, bars and glow. */
const STATUS = {
  healthy: { color: '#34d399', soft: 'rgba(52,211,153,0.14)', ring: 'rgba(52,211,153,0.45)', icon: CheckCircle2 },
  warning: { color: '#fbbf24', soft: 'rgba(251,191,36,0.14)', ring: 'rgba(251,191,36,0.45)', icon: AlertTriangle },
  fail: { color: '#fb7185', soft: 'rgba(251,113,133,0.14)', ring: 'rgba(251,113,133,0.45)', icon: AlertTriangle },
} satisfies Record<HealthStatus, { color: string; soft: string; ring: string; icon: LucideIcon }>;

const EMPTY_BLOCK: SignalBlock = {
  stats: { count: 0, avg: 0, p50: 0, p75: 0, p90: 0, p95: 0, min: 0, max: 0 },
  invalidPct: 0,
  missingPct: 0,
  status: 'warning',
};

type Tr = (en: string, he: string) => string;

/** Small colored ring around a status glyph — the recurring "health dot" motif. */
function StatusRing({ status, size = 30 }: { status: HealthStatus; size?: number }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className="grid place-items-center rounded-full border"
      style={{ width: size, height: size, color: s.color, borderColor: s.ring, background: s.soft }}
    >
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  );
}

/** A health value bar — colored fill on a track (data-quality at a glance). */
function HealthBar({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: color, boxShadow: `0 0 12px ${color}99` }}
      />
    </span>
  );
}

/**
 * Circular progress-ring gauge — the readiness centerpiece. Renders
 * `value / target` (e.g. 2/7) as an SVG arc via stroke-dasharray: emerald when
 * the gate is ready, amber while it climbs. Definite, responsive size; the big
 * number lives in the center. The arc is drawn from 12 o'clock, clockwise,
 * mirrored under RTL so progress always reads "forward" for the locale.
 */
function ReadinessRing({
  value,
  target,
  ready,
  color,
  caption,
  isHe,
}: {
  value: number;
  target: number;
  ready: boolean;
  color: string;
  caption: string;
  isHe: boolean;
}) {
  const SIZE = 184;
  const STROKE = 12;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTarget = target > 0 ? target : 1;
  const pct = Math.max(0, Math.min(1, value / safeTarget));
  const dash = circumference * pct;

  return (
    <div
      className="relative mx-auto shrink-0"
      style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}
      role="img"
      aria-label={`${value} / ${target}`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" aria-hidden>
        {/* Start arc at 12 o'clock; flip horizontally in RTL so it fills "forward". */}
        <g transform={isHe ? `translate(${SIZE} 0) scale(-1 1) rotate(-90 ${SIZE / 2} ${SIZE / 2})` : `rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color}cc)` }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="leading-none tabular-nums" style={{ fontFamily: serif, fontWeight: 700 }}>
            <span style={{ fontSize: 'clamp(2.6rem,7vw,3.4rem)', color }}>{value}</span>
            <span className="text-white/60 text-2xl">/{target}</span>
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-10 tracking-[0.25em] uppercase" style={{ fontFamily: sans, color: ready ? color : 'rgba(255,255,255,0.45)' }}>
            {ready ? <CheckCircle2 size={12} strokeWidth={2.4} /> : null}
            {caption}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * "How to go green" checklist — turns the readiness `blockedBy` reasons (already
 * Hebrew-localized via localizeBlocker) into actionable rows. Every entry in
 * `blockedBy` is, by definition, an unmet requirement → amber Circle. When the
 * gate is ready the list is empty, so we render a single emerald "all clear"
 * row to confirm the criteria are met.
 */
function GoGreenChecklist({ blockers, t, isHe }: { blockers: string[]; t: Tr; isHe: boolean }) {
  const allClear = blockers.length === 0;
  return (
    <GlassCard static className="p-5 backdrop-blur-sm">
      <p className="mb-4 inline-flex items-center gap-2 text-10 tracking-[0.3em] uppercase text-white/55" style={{ fontFamily: sans }}>
        <ListChecks size={13} strokeWidth={2} />
        {t('How to go green', 'מה צריך כדי להגיע לירוק')}
      </p>
      <ul className="space-y-2">
        {allClear ? (
          <li className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-950/20 px-3.5 py-2.5">
            <CheckCircle2 size={16} strokeWidth={2.2} style={{ color: STATUS.healthy.color }} className="shrink-0" />
            <span className="text-emerald-200/90 text-13" style={{ fontFamily: sans }}>
              {t('All criteria met — the gate is green.', 'כל הקריטריונים מולאו — השער ירוק.')}
            </span>
          </li>
        ) : (
          blockers.map((b) => (
            <li key={b} className="flex items-center gap-3 rounded-xl border border-amber-300/15 bg-amber-950/15 px-3.5 py-2.5">
              <Circle size={16} strokeWidth={2.2} style={{ color: STATUS.warning.color }} className="shrink-0" />
              <span className="text-amber-100/85 text-13 leading-snug" style={{ fontFamily: sans }}>
                {localizeBlocker(b, isHe)}
              </span>
            </li>
          ))
        )}
      </ul>
    </GlassCard>
  );
}

/** Up / down / flat direction glyph with color. */
function Direction({ dir, value }: { dir: 'up' | 'down' | 'flat'; value: string }) {
  const conf =
    dir === 'up'
      ? { color: '#34d399', Icon: TrendingUp }
      : dir === 'down'
      ? { color: '#fb7185', Icon: TrendingDown }
      : { color: '#9ca3af', Icon: Minus };
  const { Icon } = conf;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums" style={{ color: conf.color, fontFamily: sans }}>
      <Icon size={15} strokeWidth={2.2} />
      {value}
    </span>
  );
}

/** Distribution card — gauge-style hero number (P95) + percentile chips. */
function DistCard({
  title,
  unit,
  block,
  icon: Icon,
  extra,
  t,
}: {
  title: string;
  unit: string;
  block: SignalBlock;
  icon: LucideIcon;
  extra?: string;
  t: Tr;
}) {
  const s = block.stats;
  const cfg = STATUS[block.status];
  const clean = Math.max(0, 100 - block.invalidPct - block.missingPct);
  return (
    <GlassCard
      static
      accent={cfg.color}
      className="p-6"
      style={{ borderColor: cfg.ring, boxShadow: `0 30px 80px -60px ${cfg.color}` }}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="inline-flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color: cfg.color, background: cfg.soft }}>
            <Icon size={17} strokeWidth={1.9} />
          </span>
          <span className="text-amber-200/80 text-10 tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>
            {title}
          </span>
        </span>
        <StatusRing status={block.status} size={26} />
      </div>

      {s.count === 0 ? (
        <p className="py-6 text-center text-white/70 text-sm" style={{ fontFamily: sans }}>
          {t('not collected yet', 'עדיין לא נאסף')}
        </p>
      ) : (
        <>
          {/* Gauge-style headline number: P95 */}
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="leading-none tabular-nums" style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(2.4rem,6vw,3.2rem)', color: cfg.color }}>
                {s.p95}
                <span className="text-white/60 text-lg">{unit}</span>
              </p>
              <p className="mt-1 text-white/70 text-10 tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
                P95 · {t('samples', 'דגימות')} {s.count.toLocaleString()}
              </p>
            </div>
            <div className="text-end">
              <p className="text-white/70 text-xl tabular-nums" style={{ fontFamily: serif, fontWeight: 600 }}>
                {s.avg}
                <span className="text-white/70 text-sm">{unit}</span>
              </p>
              <p className="text-white/70 text-10 tracking-[0.2em] uppercase" style={{ fontFamily: sans }}>
                {t('avg', 'ממוצע')}
              </p>
            </div>
          </div>

          {/* Percentile chips */}
          <div className="mb-5 grid grid-cols-4 gap-2 text-center">
            {([['P50', s.p50], ['P75', s.p75], ['P90', s.p90], ['max', s.max]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-2">
                <p className="text-white/70 text-9 uppercase tracking-wider" style={{ fontFamily: sans }}>{k}</p>
                <p className="text-white/90 text-sm tabular-nums" style={{ fontFamily: serif, fontWeight: 600 }}>{v}{unit}</p>
              </div>
            ))}
          </div>

          {/* Clean-data bar */}
          <div className="flex items-center gap-3">
            <HealthBar pct={clean} color={cfg.color} />
            <span className="shrink-0 text-11 tabular-nums" style={{ color: cfg.color, fontFamily: sans }}>
              {clean}% {t('clean', 'תקין')}
            </span>
          </div>
          <p className="mt-2 text-white/70 text-10" style={{ fontFamily: sans }}>
            {t('invalid', 'לא תקין')} {block.invalidPct}% · {t('missing', 'חסר')} {block.missingPct}%{extra ? ` · ${extra}` : ''}
          </p>
        </>
      )}
    </GlassCard>
  );
}

/** Compact stat tile for the identity / favorites grids. */
function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassCard static className="p-4">
      <StatBlock value={value} label={label} />
    </GlassCard>
  );
}

export default function SignalsPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t: Tr = (en, he) => (isHebrew ? he : en);
  const { data: d, loading } = useApiData<SignalVerification>('/api/signals/verify', { refreshInterval: 15000 });

  const id = d?.identity;
  const ready = d?.readiness.ready ?? false;
  const heroColor = ready ? '#34d399' : '#fbbf24';
  const heroSoft = ready ? 'rgba(52,211,153,0.10)' : 'rgba(251,191,36,0.10)';
  const streak = d?.readiness.consecutiveReadyDays ?? 0;
  const required = d?.readiness.requiredDays ?? 7;

  // Instrumentation health roll-up for the hero summary.
  const health = d?.instrumentationHealth ?? [];
  const counts = health.reduce(
    (acc, h) => ({ ...acc, [h.status]: acc[h.status] + 1 }),
    { healthy: 0, warning: 0, fail: 0 } as Record<HealthStatus, number>,
  );

  return (
    <AdminShell
      title="Signal Verification"
      titleHe="אימות סיגנלים"
      eyebrow="Internal QA · pre-engine"
      eyebrowHe="QA פנימי · לפני המנוע"
      active="/admin/signals"
      subtitle="We are no longer testing features — we are testing the measurement system itself. Every signal must be proven healthy before any score is computed on top of it."
      subtitleHe="כבר לא בודקים פיצ'רים — בודקים את מערכת המדידה עצמה. כל סיגנל חייב להיות בריא לפני שמחשבים ציון מעליו."
      actions={
        <>
          <LiveDot label={isHebrew ? 'חי' : 'Live'} />
          <span className="text-white/70 text-10 tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>
            {d ? t(`${d.totalEvents.toLocaleString()} events · ${d.collectedSinceDays ?? 0}d`, `${d.totalEvents.toLocaleString()} אירועים · ${d.collectedSinceDays ?? 0}י`) : ''}
          </span>
        </>
      }
    >
      <div dir={isHebrew ? 'rtl' : 'ltr'} className="flex flex-col gap-10">
        {/* ENGINE READINESS — the centerpiece go/no-go */}
        <GlassCard
          static
          accent={heroColor}
          className="p-8 md:p-10"
          style={{
            borderColor: ready ? 'rgba(52,211,153,0.45)' : 'rgba(251,191,36,0.45)',
            boxShadow: `0 50px 140px -60px ${heroColor}`,
          }}
        >
          <div className="absolute inset-0" style={{ background: `radial-gradient(120% 100% at 0% 0%, ${heroSoft}, rgba(8,8,10,0.4) 60%)` }} aria-hidden />
          <div
            className="absolute -top-24 start-[-6rem] h-72 w-72 rounded-full blur-3xl opacity-50"
            style={{ background: `radial-gradient(circle, ${heroColor}, transparent 70%)` }}
            aria-hidden
          />

          <div className="relative z-10 grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
            {/* Verdict */}
            <div>
              <p className="inline-flex items-center gap-2 text-10 tracking-[0.4em] uppercase" style={{ fontFamily: sans, color: heroColor }}>
                <Gauge size={14} strokeWidth={2} /> {t('Engine Readiness', 'מוכנות המנוע')}
              </p>
              <div className="mt-3 flex items-center gap-4">
                {ready ? <CheckCircle2 size={56} strokeWidth={1.6} style={{ color: heroColor }} /> : <AlertTriangle size={56} strokeWidth={1.6} style={{ color: heroColor }} />}
                <p className="leading-[0.9]" style={{ fontFamily: serif, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 700, fontSize: 'clamp(3rem,8vw,5rem)', color: heroColor }}>
                  {d ? (ready ? t('READY', 'מוכן') : t('NOT READY', 'לא מוכן')) : '—'}
                </p>
              </div>
              <p className="mt-3 max-w-md text-white/55 text-sm" style={{ fontFamily: sans }}>
                {ready
                  ? t('All instruments verified. The scoring engine can be built on these signals.', 'כל המכשירים אומתו. ניתן לבנות את מנוע הניקוד על הסיגנלים האלה.')
                  : t('Hold. One or more signals are not yet proven. No score is computed until the gate is green.', 'המתן. סיגנל אחד או יותר עדיין לא אומת. לא מחושב ציון עד שהשער ירוק.')}
              </p>
            </div>

            {/* Readiness ring gauge + health roll-up */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm">
              <p className="mb-4 text-center text-white/70 text-10 tracking-[0.3em] uppercase" style={{ fontFamily: sans }}>{t('Green streak', 'רצף ירוק')}</p>
              <ReadinessRing
                value={streak}
                target={required}
                ready={ready}
                color={heroColor}
                caption={t('consecutive days', 'ימים רצופים')}
                isHe={isHebrew}
              />

              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                {([['healthy', counts.healthy], ['warning', counts.warning], ['fail', counts.fail]] as const).map(([k, n]) => (
                  <div key={k} className="rounded-xl py-2.5" style={{ background: STATUS[k].soft }}>
                    <p className="text-2xl tabular-nums" style={{ fontFamily: serif, fontWeight: 700, color: STATUS[k].color }}>{n}</p>
                    <p className="text-9 tracking-[0.15em] uppercase text-white/45" style={{ fontFamily: sans }}>
                      {k === 'healthy' ? t('healthy', 'בריא') : k === 'warning' ? t('warning', 'אזהרה') : t('fail', 'כשל')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How to go green — actionable checklist from the readiness blockers */}
          {d && (
            <div className="relative z-10 mt-7 border-t border-white/10 pt-6">
              <GoGreenChecklist blockers={d.readiness.blockedBy} t={t} isHe={isHebrew} />
            </div>
          )}
        </GlassCard>

        {/* INSTRUMENTATION HEALTH — grid of status cards */}
        <section>
          <SectionLabel icon={ShieldCheck}>{t('Instrumentation Health', 'תקינות מדידה')}</SectionLabel>
          <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {health.map((h) => {
              const cfg = STATUS[h.status];
              return (
                <motion.div key={h.signal} variants={staggerItem}>
                  <GlassCard static accent={cfg.color} className="flex items-start gap-3 p-4" style={{ borderColor: cfg.ring }}>
                    <StatusRing status={h.status} />
                    <div className="min-w-0">
                      <p className="truncate text-white/90 text-sm" style={{ fontFamily: sans, fontWeight: 600 }}>{localizeSignal(h.signal, isHebrew)}</p>
                      <p className="mt-0.5 text-white/45 text-11 leading-snug" style={{ fontFamily: sans }}>{localizeDetail(h.signal, h.detail, isHebrew)}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
            {!d &&
              (loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
                      <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="mt-2 h-2.5 w-32" />
                      </div>
                    </div>
                  ))
                : <p className="text-white/40 text-sm" style={{ fontFamily: sans }}>—</p>)}
          </Stagger>
        </section>

        {/* DISTRIBUTIONS — gauge cards */}
        <section>
          <SectionLabel icon={Gauge}>{t('Signal Distributions', 'התפלגויות סיגנל')}</SectionLabel>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DistCard title={t('Active dwell', 'שהייה פעילה')} unit="s" icon={Activity} block={d?.dwell ?? EMPTY_BLOCK} t={t} />
            <DistCard
              title={t('Scroll depth', 'עומק גלילה')}
              unit="%"
              icon={Gauge}
              block={d?.scrollDepth ?? EMPTY_BLOCK}
              extra={d ? `${t('100% rate', 'שיעור 100%')} ${d.scrollDepth.full100Pct}%` : undefined}
              t={t}
            />
          </div>
        </section>

        {/* COVERAGE TREND + DRIFT — direction-coded rows */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <GlassCard static className="p-6">
            <SectionLabel icon={TrendingUp}>{t('Coverage trend', 'מגמת כיסוי')}</SectionLabel>
            <div className="space-y-2.5">
              {(d?.trends ?? []).map((tr) => (
                <div key={tr.metric} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3">
                  <span className="text-white/75 text-sm" style={{ fontFamily: sans }}>{localizeTrendMetric(tr.metric, isHebrew)}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-white/70 text-xs tabular-nums" style={{ fontFamily: sans }}>{tr.priorPct}%</span>
                    <Direction dir={tr.trend} value={`${tr.recentPct}%`} />
                  </span>
                </div>
              ))}
              {(!d || d.trends.length === 0) && <p className="text-white/35 text-sm" style={{ fontFamily: sans }}>—</p>}
            </div>
          </GlassCard>

          <GlassCard static className="p-6">
            <SectionLabel icon={AlertTriangle}>{t('Signal drift', 'סחיפת סיגנל')}</SectionLabel>
            <div className="space-y-2.5">
              {(d?.drift ?? []).map((dr) => {
                const cfg = STATUS[dr.status];
                return (
                  <div key={dr.signal} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <StatusRing status={dr.status} size={22} />
                      <span className="text-white/75 text-sm" style={{ fontFamily: sans }}>{localizeDriftMetric(dr.signal, isHebrew)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-white/70 text-xs tabular-nums" style={{ fontFamily: sans }}>{dr.baseline} {isHebrew ? '←' : '→'} {dr.recent}</span>
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums" style={{ color: cfg.color, fontFamily: sans }}>
                        {dr.deltaPct >= 0 ? <TrendingUp size={14} strokeWidth={2.2} /> : <TrendingDown size={14} strokeWidth={2.2} />}
                        {dr.deltaPct >= 0 ? '+' : ''}{dr.deltaPct}%
                      </span>
                    </span>
                  </div>
                );
              })}
              {(!d || d.drift.length === 0) && <p className="text-white/35 text-sm" style={{ fontFamily: sans }}>—</p>}
            </div>
          </GlassCard>
        </section>

        {/* IDENTITY & POLLUTION */}
        <section>
          <SectionLabel icon={Fingerprint}>{t('Visitor identity & pollution', 'זהות מבקר וזיהום')}</SectionLabel>
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <motion.div variants={staggerItem}><StatTile label={t('Visitors', 'מבקרים')} value={(id?.uniqueVisitors ?? 0).toLocaleString()} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Sessions', 'ביקורים')} value={(id?.uniqueSessions ?? 0).toLocaleString()} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Sessions / visitor', 'ביקורים/מבקר')} value={id?.sessionsPerVisitor ?? 0} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Return visitors', 'חוזרים')} value={id?.returnVisitors ?? 0} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('visitor_id coverage', 'כיסוי visitor_id')} value={`${id?.visitorCoveragePct ?? 0}%`} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Avg events/session', 'ממוצע/ביקור')} value={id?.avgEventsPerSession ?? 0} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Max events/visitor', 'מקס/מבקר')} value={id?.maxEventsPerVisitor ?? 0} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Max events/session', 'מקס/ביקור')} value={id?.maxEventsPerSession ?? 0} /></motion.div>
          </Stagger>
          {d && !d.hasVisitorColumn && (
            <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-950/10 px-4 py-3 text-amber-200/70 text-xs" style={{ fontFamily: sans }} dir={isHebrew ? 'rtl' : 'ltr'}>
              <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              {t('visitor_id column not present yet — reading from metadata (Phase A). Run migration 0006 → Phase B.', 'עמודת visitor_id עדיין לא קיימת — נקרא מ-metadata (Phase A). הרץ migration 0006 ← Phase B.')}
            </p>
          )}
        </section>

        {/* FAVORITES */}
        <section>
          <SectionLabel icon={Heart}>{t('Favorites', 'מועדפים')}</SectionLabel>
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <motion.div variants={staggerItem}><StatTile label={t('Events', 'אירועים')} value={(d?.favorites.events ?? 0).toLocaleString()} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Unique items', 'פריטים')} value={d?.favorites.distinctItems ?? 0} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Add rate', 'שיעור הוספה')} value={`${d?.favorites.addRatePct ?? 0}%`} /></motion.div>
            <motion.div variants={staggerItem}><StatTile label={t('Remove rate', 'שיעור הסרה')} value={`${d?.favorites.removeRatePct ?? 0}%`} /></motion.div>
          </Stagger>
        </section>

        <p className="inline-flex items-center justify-center gap-2 border-t border-white/10 pt-6 text-center text-white/70 text-10 tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
          <Users size={12} strokeWidth={2} />
          {t('Internal QA · the engine is built only after every signal here is healthy', 'QA פנימי · המנוע נבנה רק אחרי שכל סיגנל כאן בריא')}
        </p>
      </div>
    </AdminShell>
  );
}

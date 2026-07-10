'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Sunrise } from 'lucide-react';
import type { RevenuePotential } from '@/lib/value/potential';
import type { Readiness } from '@/lib/useReadiness';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const ils = (n: number) => `₪${Math.round(n).toLocaleString()}`;

/**
 * Honesty caveat for engine-claim surfaces. When the dataset isn't ready yet, it says
 * the findings are preliminary rather than presenting them as settled — self-hiding when
 * the data is ready (or unknown). `tone` picks the voice: `owner` (hospitality) for the
 * Act group, `expert` for the Advanced/Analytics layer. Shared so every surface tells the
 * same honest story (one Business Brain, no per-screen copy drift).
 */
export function ReadinessNote({
  readiness,
  lang,
  tone = 'owner',
}: {
  readiness: Readiness | null;
  lang: 'en' | 'he';
  tone?: 'owner' | 'expert';
}) {
  if (!readiness || readiness.ready) return null;
  const d = readiness.consecutiveReadyDays;
  const r = readiness.requiredDays;
  const copy =
    tone === 'expert'
      ? {
          en: `Signal readiness ${d}/${r} ready days — engine findings are still provisional.`,
          he: `מוכנות אות ${d}/${r} ימים — ממצאי המנוע עדיין ראשוניים.`,
        }
      : {
          en: `Still learning your guests — these picks sharpen as more orders come in (day ${d} of ${r}).`,
          he: `עדיין לומדים את האורחים שלכם — ההמלצות יתחדדו ככל שיצטברו עוד הזמנות (יום ${d} מתוך ${r}).`,
        };
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200/15 bg-amber-100/[0.03] px-4 py-3"
    >
      <Sunrise size={15} className="shrink-0 text-amber-200/70" strokeWidth={1.6} />
      <p className="text-[12px] leading-relaxed text-amber-100/70" style={{ fontFamily: sans }}>
        {copy[lang]}
      </p>
    </motion.div>
  );
}

/**
 * Prominent, HONEST revenue-upside block. Headlines the estimated extra revenue,
 * always framed as an estimate ("צפי / Est."), shows the assumption (basis) and a
 * sample-size confidence dot. When `potential` is null, shows a "collect more data"
 * note instead of a fabricated number.
 */
export function PotentialValue({
  potential,
  lang,
  accent = '#34d399',
  size = 'md',
}: {
  potential: RevenuePotential | null;
  lang: 'en' | 'he';
  accent?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const isHe = lang === 'he';
  if (!potential) {
    return (
      <p className="text-white/35 text-[11px] italic" style={{ fontFamily: sans }}>
        {isHe ? 'אספו עוד ביקורי אורחים להערכת פוטנציאל' : 'Collect more guest visits to estimate upside'}
      </p>
    );
  }
  const basis = isHe ? potential.basisHe : potential.basisEn;
  const fontSize = size === 'lg' ? '2rem' : size === 'md' ? '1.5rem' : '1.15rem';
  const confColor = potential.confidence === 'high' ? '#34d399' : potential.confidence === 'medium' ? '#fbbf24' : '#9ca3af';
  return (
    <div
      className="rounded-xl px-3.5 py-2.5"
      style={{ background: `${accent}14`, border: `1px solid ${accent}40` }}
      title={basis}
    >
      <p className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em]" style={{ color: accent, fontFamily: sans }}>
        <TrendingUp size={11} strokeWidth={2.4} />
        {isHe ? 'צפי הכנסה נוספת' : 'Est. revenue upside'}
        <span className="inline-flex items-center gap-1 text-white/40 normal-case tracking-normal">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: confColor }} />
        </span>
      </p>
      <p style={{ color: accent, fontFamily: serif, fontWeight: 700, fontSize, lineHeight: 1.05 }}>
        +{ils(potential.revenueILS)}
      </p>
      <p className="mt-0.5 text-white/45 text-[10px] leading-snug" style={{ fontFamily: sans }}>
        {isHe
          ? `+${potential.extraOrders} הזמנות · רווח ~${ils(potential.profitILS)} · ${basis}`
          : `+${potential.extraOrders} orders · ~${ils(potential.profitILS)} profit · ${basis}`}
      </p>
    </div>
  );
}

/**
 * Two-bar Before → After comparison (current vs projected), normalized to the max.
 * Pure visual; pass real `before` and a labeled projected `after`.
 */
export function BeforeAfterBar({
  before,
  after,
  lang,
  accent = '#34d399',
  unit = '',
  format,
}: {
  before: number;
  after: number;
  lang: 'en' | 'he';
  accent?: string;
  unit?: string;
  format?: (n: number) => string;
}) {
  const isHe = lang === 'he';
  const max = Math.max(before, after, 1);
  const fmt = format ?? ((n: number) => `${Math.round(n).toLocaleString()}${unit}`);
  const Row = ({ label, val, color }: { label: string; val: number; color: string }) => (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[9px] uppercase tracking-[0.15em] text-white/40" style={{ fontFamily: sans }}>{label}</span>
      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="absolute inset-y-0 start-0 rounded-full transition-[width] duration-500" style={{ width: `${Math.max(3, (val / max) * 100)}%`, background: color }} />
      </span>
      <span className="w-12 shrink-0 text-end text-[11px] tabular-nums" style={{ color, fontFamily: sans, fontWeight: 600 }}>{fmt(val)}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <Row label={isHe ? 'לפני' : 'Before'} val={before} color="rgba(255,255,255,0.45)" />
      <Row label={isHe ? 'אחרי' : 'After'} val={after} color={accent} />
    </div>
  );
}

/** Segmented "AI confidence" meter (████░ 91%) — gives a sense of machine intelligence. */
export function ConfidenceMeter({
  pct,
  lang,
  label,
  segments = 10,
}: {
  pct: number;
  lang: 'en' | 'he';
  label?: string;
  segments?: number;
}) {
  const isHe = lang === 'he';
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const filled = Math.round((clamped / 100) * segments);
  const color = clamped >= 80 ? '#34d399' : clamped >= 60 ? '#fbbf24' : '#9ca3af';
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/45" style={{ fontFamily: sans }}>
        {label ?? (isHe ? 'ביטחון AI' : 'AI confidence')}
      </span>
      <span className="inline-flex gap-[2px]" aria-hidden>
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className="h-3 w-1.5 rounded-sm transition-colors" style={{ background: i < filled ? color : 'rgba(255,255,255,0.12)' }} />
        ))}
      </span>
      <span className="text-[12px] tabular-nums" style={{ color, fontFamily: sans, fontWeight: 700 }}>
        {clamped}%
      </span>
    </div>
  );
}

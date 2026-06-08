'use client';

import { TrendingUp } from 'lucide-react';
import type { RevenuePotential } from '@/lib/value/potential';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const ils = (n: number) => `₪${Math.round(n).toLocaleString()}`;

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
        {isHe ? 'אסוף עוד תנועה להערכת פוטנציאל' : 'Collect more traffic to estimate upside'}
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

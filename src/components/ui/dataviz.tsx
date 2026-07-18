'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, BadgeCheck } from 'lucide-react';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

/**
 * Shared luxury data-viz primitives for the admin screens.
 * Use these everywhere so every screen feels like one premium product.
 */

/** A whole, contained cocktail glass (transparent PNG on dark) with an accent glow.
 *  Pass a DEFINITE height in className (e.g. "w-full h-40"); the image never crops. */
export function GlassImage({
  src,
  accent,
  className,
  alt = '',
}: {
  src: string;
  accent: string;
  className?: string;
  /** Accessible name. Empty (default) keeps the image decorative (hidden from AT); pass the
   *  drink/subject name on informative images so screen-reader users hear what it is. */
  alt?: string;
}) {
  return (
    <span className={`relative block overflow-hidden ${className ?? ''}`}>
      <span
        className="absolute inset-[12%] rounded-full blur-2xl opacity-45"
        style={{ background: `radial-gradient(circle, ${accent}66, transparent 72%)` }}
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        className="absolute inset-0 h-full w-full object-contain mix-blend-screen"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

/** Tiny bar sparkline. Pass a real numeric series (no fabricated data). */
export function Sparkline({ data, color, className }: { data: number[]; color: string; className?: string }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data);
  return (
    <div className={`flex items-end gap-[2px] h-7 ${className ?? ''}`}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: color, opacity: 0.35 + (i / data.length) * 0.6 }}
        />
      ))}
    </div>
  );
}

/** Catmull-Rom → cubic-bezier smooth path through points (in viewBox units). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Smooth SVG area+line chart with a gradient fill and a glowing end dot.
 *  Responsive width; constant stroke; pass a DEFINITE height (px). Real data only. */
export function AreaChart({
  data,
  color = '#fbbf24',
  height = 120,
  className,
  showDot = true,
  strokeWidth = 2,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
  showDot?: boolean;
  strokeWidth?: number;
}) {
  const id = useId().replace(/:/g, '');
  if (!data || data.length === 0) return null;
  const W = 100;
  const H = 100;
  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const n = data.length;
  const pts = data.map((v, i) => ({ x: n === 1 ? W / 2 : (i / (n - 1)) * W, y: H - ((v - min) / range) * H }));
  const line = smoothPath(pts);
  const last = pts[n - 1];
  const area = `${line} L ${last.x} ${H} L ${pts[0].x} ${H} Z`;
  return (
    <div className={`relative ${className ?? ''}`} style={{ height }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#area-${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {showDot && (
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${last.x}%`, top: `${last.y}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      )}
    </div>
  );
}

/** Week-over-week % change from a daily series (last 7 vs prior 7). null if not enough history. */
export function deltaPct(series: number[] | undefined): number | null {
  if (!series || series.length < 8) return null;
  const a = series.slice(-7).reduce((s, n) => s + n, 0);
  const b = series.slice(-14, -7).reduce((s, n) => s + n, 0);
  return b > 0 ? Math.round(((a - b) / b) * 100) : null;
}

/** easeOutCubic count-up toward a target. Animates on mount and whenever the
 *  target changes; respects prefers-reduced-motion. */
function useCountUp(target: number, durationMs: number): number {
  const [n, setN] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined') {
      setN(target);
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || durationMs <= 0) {
      setN(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

/** Renders a value string with its single numeric token counting up
 *  (preserves prefix/suffix like "₪3,200" or "23%"). Falls back to the raw
 *  string when there isn't exactly one clean number to animate. */
export function CountUpText({
  text,
  durationMs = 900,
  className,
  style,
}: {
  text: string;
  durationMs?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const m = text.match(/^(\D*)([\d][\d.,]*)(.*)$/);
  const numStr = m ? m[2] : '';
  const target = m ? parseFloat(numStr.replace(/,/g, '')) : NaN;
  const animatable = m !== null && Number.isFinite(target);
  const n = useCountUp(animatable ? target : 0, durationMs);
  if (!animatable || !m) return <span className={className} style={style}>{text}</span>;
  const decimals = numStr.includes('.') ? (numStr.split('.')[1]?.length ?? 0) : 0;
  const hasComma = numStr.includes(',');
  const shown = decimals > 0 ? n.toFixed(decimals) : hasComma ? Math.round(n).toLocaleString() : String(Math.round(n));
  return (
    <span className={className} style={style}>
      {m[1]}
      {shown}
      {m[3]}
    </span>
  );
}

/** Shimmer skeleton block. Pass size via className (e.g. "h-6 w-24"). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`relative block overflow-hidden rounded-md bg-white/[0.06] ${className ?? ''}`} style={style} aria-hidden>
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </span>
  );
}

/** A KPI-card-shaped skeleton (matches KpiCard footprint). */
export function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="mb-2 h-7 w-24" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/** A grid of KPI skeletons for loading states. */
export function SkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={className ?? 'grid grid-cols-2 gap-3 lg:grid-cols-4'}>
      {Array.from({ length: count }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}

/** Pulsing "live" indicator for auto-refreshing screens. */
export function LiveDot({ label, accent = '#34d399', className }: { label?: string; accent?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-10 uppercase tracking-[0.2em] ${className ?? ''}`} style={{ color: accent, fontFamily: sans }}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: accent }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
      </span>
      {label}
    </span>
  );
}

/** Unified KPI card. Optional icon, week-over-week delta, and sparkline. */
export function KpiCard({
  label,
  value,
  accent = '#fbbf24',
  icon: Icon,
  delta,
  series,
  hint,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: LucideIcon;
  delta?: number | null;
  series?: number[];
  hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.03]">
      <div className="flex items-center justify-between mb-2">
        {Icon ? (
          <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ color: accent, background: `${accent}1a` }}>
            <Icon size={15} strokeWidth={1.8} />
          </span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        )}
        {delta !== undefined && delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-11 ${up ? 'text-emerald-300' : 'text-rose-300'}`} style={{ fontFamily: sans }}>
            {up ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingDown size={12} strokeWidth={2} />}
            {up ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      <p className="text-white text-2xl leading-tight" style={{ fontFamily: serif, fontWeight: 700 }}><CountUpText text={value} /></p>
      <p className="text-white/45 text-11 mt-1 tracking-wide" style={{ fontFamily: sans }}>{label}</p>
      {series && series.length > 0 && <div className="mt-2"><AreaChart data={series} color={accent} height={32} showDot={false} strokeWidth={1.75} /></div>}
      {hint && <p className="text-white/30 text-9 mt-1.5 tracking-wide" style={{ fontFamily: sans }}>{hint}</p>}
    </div>
  );
}

/** Rounded pill with an icon — for projected metrics / quick facts. */
export function Pill({ icon: Icon, text, accent }: { icon: LucideIcon; text: string; accent?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs"
      style={{ color: accent ?? 'rgba(255,255,255,0.8)', fontFamily: sans }}
    >
      <Icon size={13} strokeWidth={1.8} /> {text}
    </span>
  );
}

/** "AI confidence 92%" badge. */
export function ConfidenceBadge({ pct, label = 'AI confidence' }: { pct: number; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-10 tracking-[0.18em] uppercase"
      style={{ borderColor: 'rgba(52,211,153,0.4)', color: '#34d399', fontFamily: sans }}
    >
      <BadgeCheck size={12} strokeWidth={2} /> {label} {pct}%
    </span>
  );
}

/** Section eyebrow label. */
export function SectionLabel({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <p className="inline-flex items-center gap-2 text-amber-200/70 text-10 tracking-[0.4em] uppercase mb-4" style={{ fontFamily: sans }}>
      {Icon && <Icon size={13} strokeWidth={2} />}
      {children}
    </p>
  );
}

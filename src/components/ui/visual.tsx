'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { GlassImage } from './dataviz';

/**
 * Premium VISUAL kit — pure presentation, no data/logic. Used by the Visual Pass to
 * make every screen feel expensive: bigger drink imagery, per-drink accent backdrops,
 * subtle parallax/hover motion, image-led story blocks, and visual before/after.
 */

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

function alphaHex(opacity: number): string {
  return Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Card wrapper: gentle lift + accent glow on hover (Apple-ish). */
export function HoverLift({
  children,
  accent = '#fbbf24',
  className,
  lift = -5,
}: {
  children: ReactNode;
  accent?: string;
  className?: string;
  lift?: number;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: lift, boxShadow: `0 22px 60px -18px ${accent}66` }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}

/** Subtle 3D parallax tilt toward the cursor — for premium hero/large images. */
export function Tilt({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 18 });
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Per-drink accent backdrop wash (Aperol→orange, Negroni→red…). Place in a `relative` parent. */
export function AccentWash({ accent, className, opacity = 0.16 }: { accent: string; className?: string; opacity?: number }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
      style={{ background: `radial-gradient(120% 90% at 50% 0%, ${accent}${alphaHex(opacity)}, transparent 70%)` }}
    />
  );
}

/** One image column of BeforeAfterImage. Module-scoped (not created during the parent's
 * render) so it never remounts — its own image state/animation is preserved across re-renders. */
function CompareCol({
  label,
  badge,
  dim,
  badgeAccent,
  src,
  accent,
  imageClass,
  isHe,
}: {
  label: string;
  badge?: string;
  dim?: boolean;
  badgeAccent?: string;
  src: string;
  accent: string;
  imageClass?: string;
  isHe: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.22em] text-white/40" style={{ fontFamily: sans }}>
        {label}
      </span>
      <span className={`relative block w-full ${dim ? 'opacity-55 grayscale-[0.3]' : ''}`}>
        <GlassImage src={src} accent={accent} className={`w-full ${imageClass}`} />
        {badge ? (
          <span
            className="absolute top-1 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black"
            style={{ insetInlineEnd: '0.25rem', background: badgeAccent ?? accent, boxShadow: `0 0 14px ${badgeAccent ?? accent}` }}
          >
            {badge}
          </span>
        ) : (
          <span
            className="absolute top-1 inline-flex items-center rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/30"
            style={{ insetInlineEnd: '0.25rem' }}
          >
            {isHe ? 'אין' : 'none'}
          </span>
        )}
      </span>
    </div>
  );
}

/** Visual Before → After: two drink images (the "after" wears a glowing badge). Images, not numbers. */
export function BeforeAfterImage({
  src,
  accent,
  lang,
  beforeBadge,
  afterBadge,
  imageClass = 'h-32',
}: {
  src: string;
  accent: string;
  lang: 'en' | 'he';
  beforeBadge?: string;
  afterBadge: string;
  imageClass?: string;
}) {
  const isHe = lang === 'he';
  return (
    <div className="flex items-stretch gap-2">
      <CompareCol label={isHe ? 'לפני' : 'Before'} badge={beforeBadge} dim src={src} accent={accent} imageClass={imageClass} isHe={isHe} />
      <span className="self-center text-lg text-white/30">{isHe ? '←' : '→'}</span>
      <CompareCol label={isHe ? 'אחרי' : 'After'} badge={afterBadge} badgeAccent={accent} src={src} accent={accent} imageClass={imageClass} isHe={isHe} />
    </div>
  );
}

/** 50/50 image + content "visual story block" for big screens. Image leads on desktop. */
export function StoryBlock({
  src,
  accent,
  eyebrow,
  title,
  children,
  imageHeight = 'h-44 md:h-64',
  lang,
}: {
  src?: string;
  accent: string;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  imageHeight?: string;
  lang: 'en' | 'he';
}) {
  const isHe = lang === 'he';
  return (
    <div
      className="relative grid items-center gap-6 overflow-hidden rounded-3xl border bg-white/[0.02] p-5 md:grid-cols-2"
      style={{ borderColor: `${accent}26` }}
    >
      <AccentWash accent={accent} opacity={0.14} />
      {src ? (
        <div className="relative">
          <Tilt>
            <GlassImage src={src} accent={accent} className={`w-full ${imageHeight}`} />
          </Tilt>
        </div>
      ) : (
        <span />
      )}
      <div className="relative min-w-0" style={{ direction: isHe ? 'rtl' : 'ltr' }}>
        {eyebrow ? (
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em]" style={{ color: accent, fontFamily: sans }}>
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-white text-2xl md:text-3xl leading-tight" style={{ fontFamily: serif, fontWeight: 700 }}>
          {title}
        </h3>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * A cocktail glass that BREAKS THE FRAME — overflows its slot upward with a grounded
 * shadow + accent glow, so the drink feels bigger than its container (the premium
 * "hero" / featured treatment). The PARENT must be `overflow-visible` and reserve top
 * space (e.g. pt-20). `overflow` is the image height relative to the slot.
 */
export function FrameBreakImage({
  src,
  accent,
  className,
  overflow = '155%',
  alt = '',
}: {
  src: string;
  accent: string;
  className?: string;
  overflow?: string;
  /** Accessible name. Empty (default) keeps the hero image decorative; pass the drink name
   *  on informative images so it's announced to screen-reader users. */
  alt?: string;
}) {
  return (
    <span className={`relative block ${className ?? ''}`} aria-hidden={alt ? undefined : true}>
      <span
        className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute bottom-0 left-1/2 w-auto max-w-none -translate-x-1/2 object-contain mix-blend-screen"
        style={{ height: overflow, filter: `drop-shadow(0 26px 34px ${accent}40) drop-shadow(0 12px 22px rgba(0,0,0,0.55))` }}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

/**
 * Premium glass layer — diagonal light wash, a light streak, an inner vignette, and
 * faint noise (luxury-watch-site feel). Place inside a `relative` rounded parent; it
 * inherits the radius. Pure decoration, pointer-events-none.
 */
export function GlassSheen({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className ?? ''}`}>
      <span className="absolute inset-0" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 42%)' }} />
      <span className="absolute -inset-y-12 -left-1/3 w-1/3 rotate-12 opacity-40" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
      <span className="absolute inset-0" style={{ boxShadow: 'inset 0 0 130px rgba(0,0,0,0.5)' }} />
      <span
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
    </span>
  );
}

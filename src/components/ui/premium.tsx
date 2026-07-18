'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, RotateCw } from 'lucide-react';
import { GlassSheen } from './visual';

/**
 * Phase-5 premium primitives — "Obsidian & Champagne".
 * Pure presentation: no data, no logic, no API awareness. Every component is
 * RTL-safe (logical properties only) and respects prefers-reduced-motion via
 * the global CSS kill-switch. Compose these instead of restyling per screen.
 */

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

export const LUX_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ─── Ambient stage ─────────────────────────────────────────────────────── */

/**
 * Fixed cinematic backdrop: two ultra-soft drifting glows (champagne top,
 * emerald floor) over the obsidian base. Sits behind everything; print-hidden.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden print:hidden" style={{ background: 'var(--bg-0)' }}>
      <span
        className="absolute -top-[30%] start-[8%] h-[65vh] w-[70vw] rounded-full opacity-[0.10]"
        style={{ background: 'radial-gradient(ellipse at center, var(--champagne) 0%, transparent 62%)', animation: 'drift 26s ease-in-out infinite', filter: 'blur(50px)' }}
      />
      <span
        className="absolute -bottom-[35%] end-[4%] h-[60vh] w-[55vw] rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(ellipse at center, #34d399 0%, transparent 60%)', animation: 'drift 34s ease-in-out infinite reverse', filter: 'blur(60px)' }}
      />
      <span className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  );
}

/* ─── Structure & labels ────────────────────────────────────────────────── */

/** The house divider motif: hairline · rotated diamond · hairline. */
export function GlowDivider({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`} aria-hidden>
      <div className="w-14 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,201,135,0.5))' }} />
      <div className="w-1.5 h-1.5 rotate-45 border" style={{ borderColor: 'rgba(232,201,135,0.6)' }} />
      <div className="w-14 h-px" style={{ background: 'linear-gradient(90deg, rgba(232,201,135,0.5), transparent)' }} />
    </div>
  );
}

/** Eyebrow label — tracked uppercase champagne, the section voice. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-10 tracking-[0.42em] uppercase ${className ?? ''}`} style={{ fontFamily: sans, color: 'rgba(232,201,135,0.75)' }}>
      {children}
    </p>
  );
}

/* ─── Panels ────────────────────────────────────────────────────────────── */

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Accent color for the hover glow (defaults to champagne). */
  accent?: string;
  /** Disable the hover lift for static/informational panels. */
  static?: boolean;
  sheen?: boolean;
  style?: CSSProperties;
}

/** The standard premium panel: layered glass, lit top edge, gentle hover lift. */
export function GlassCard({ children, className, accent = '#e8c987', static: isStatic, sheen, style }: GlassCardProps) {
  const inner = (
    <>
      {sheen && <GlassSheen />}
      {children}
    </>
  );
  if (isStatic) {
    return (
      <section className={`glass-panel relative overflow-hidden rounded-3xl ${className ?? ''}`} style={style}>
        {inner}
      </section>
    );
  }
  return (
    <motion.section
      className={`glass-panel relative overflow-hidden rounded-3xl ${className ?? ''}`}
      style={style}
      whileHover={{ y: -4, boxShadow: `0 26px 60px -22px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.08)` }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {inner}
    </motion.section>
  );
}

interface PanelHeaderProps {
  label: string;
  href?: string;
  cta?: string;
  isHe?: boolean;
}

/** Panel header row: tracked label + quiet action link (dir-aware arrow). */
export function PanelHeader({ label, href, cta, isHe }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-10 tracking-[0.3em] uppercase" style={{ fontFamily: sans, color: 'rgba(232,201,135,0.85)' }}>
        {label}
      </h3>
      {href && cta && (
        <Link
          href={href}
          className="group/link inline-flex items-center gap-1 text-10 tracking-[0.2em] uppercase text-white/40 hover:text-amber-100 transition-colors"
          style={{ fontFamily: sans }}
        >
          {cta}
          <span className="transition-transform group-hover/link:translate-x-0.5 rtl:group-hover/link:-translate-x-0.5">{isHe ? '←' : '→'}</span>
        </Link>
      )}
    </div>
  );
}

/* ─── Actions ───────────────────────────────────────────────────────────── */

interface CtaPillProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** 'champagne' (default) for primary; 'ghost' for quiet secondary. */
  tone?: 'champagne' | 'ghost';
}

/** The primary call-to-action pill — champagne gradient with a hover sheen sweep. */
export function CtaPill({ href, children, className, tone = 'champagne' }: CtaPillProps) {
  if (tone === 'ghost') {
    return (
      <Link
        href={href}
        className={`group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-xs tracking-[0.16em] uppercase text-white/80 transition-colors hover:border-amber-200/40 hover:text-amber-100 ${className ?? ''}`}
        style={{ fontFamily: sans, fontWeight: 600 }}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-13 tracking-[0.16em] uppercase text-black transition-shadow ${className ?? ''}`}
      style={{
        fontFamily: sans,
        fontWeight: 700,
        background: 'linear-gradient(105deg, var(--champagne-bright), var(--champagne) 55%, var(--champagne-deep))',
        boxShadow: '0 10px 34px rgba(232, 201, 135, 0.26)',
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 -start-1/2 w-1/3 -skew-x-12 opacity-0 transition-all duration-700 group-hover:start-[120%] group-hover:opacity-60"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)' }}
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

/* ─── States ────────────────────────────────────────────────────────────── */

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

/** Elegant empty state — thin ringed icon + quiet copy (never a bare italic line). */
export function EmptyState({ title, hint, icon, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 py-6 text-center ${className ?? ''}`}>
      <span className="grid place-items-center w-10 h-10 rounded-full border border-white/10 text-amber-200/50">
        {icon ?? <Sparkles size={16} strokeWidth={1.4} />}
      </span>
      <p className="text-white/55 text-xs" style={{ fontFamily: sans }}>{title}</p>
      {hint && <p className="text-white/30 text-11 max-w-[26ch] leading-relaxed" style={{ fontFamily: sans }}>{hint}</p>}
    </div>
  );
}

interface ErrorStateProps {
  /** What failed, in owner-friendly language (NOT the raw error). */
  title: string;
  hint?: string;
  /** Optional retry handler — renders a "Try again" button when provided. */
  onRetry?: () => void;
  /** Retry button label (bilingual caller supplies the right language). */
  retryLabel?: string;
  className?: string;
}

/**
 * Distinct error state — visually separate from EmptyState so a backend failure never
 * masquerades as "no data yet". Rose-tinted alert ring + an optional retry action.
 */
export function ErrorState({ title, hint, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-2.5 py-6 text-center ${className ?? ''}`}
    >
      <span className="grid place-items-center w-10 h-10 rounded-full border border-rose-400/25 text-rose-300/70">
        <AlertTriangle size={16} strokeWidth={1.5} />
      </span>
      <p className="text-rose-200/80 text-xs" style={{ fontFamily: sans }}>{title}</p>
      {hint && <p className="text-white/30 text-11 max-w-[28ch] leading-relaxed" style={{ fontFamily: sans }}>{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-11 text-white/70 transition-colors hover:border-white/30 hover:text-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          style={{ fontFamily: sans }}
        >
          <RotateCw size={12} strokeWidth={2} /> {retryLabel}
        </button>
      )}
    </div>
  );
}

/* ─── Numbers ───────────────────────────────────────────────────────────── */

interface StatBlockProps {
  value: ReactNode;
  label: string;
  /** 'hero' = biggest serif; 'default' = card KPI. */
  size?: 'hero' | 'default';
  tone?: 'champagne' | 'emerald' | 'muted' | 'white';
  className?: string;
}

const TONE_COLOR: Record<NonNullable<StatBlockProps['tone']>, string> = {
  champagne: 'var(--champagne)',
  emerald: '#6ee7b7',
  muted: 'rgba(255,255,255,0.38)',
  white: 'rgba(255,255,255,0.92)',
};

/** Serif display number over a quiet tracked label. */
export function StatBlock({ value, label, size = 'default', tone = 'white', className }: StatBlockProps) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <div
        className="leading-none"
        style={{
          fontFamily: serif,
          fontWeight: 700,
          color: TONE_COLOR[tone],
          fontSize: size === 'hero' ? 'clamp(2.4rem, 5.5vw, 3.6rem)' : 'clamp(1.5rem, 3vw, 2.1rem)',
        }}
      >
        {value}
      </div>
      <p className="mt-2 text-11 tracking-[0.14em] uppercase" style={{ fontFamily: sans, color: 'var(--ink-mid)' }}>
        {label}
      </p>
    </div>
  );
}

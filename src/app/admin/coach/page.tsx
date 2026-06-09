'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Clock, Sunrise, Check } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, LiveDot, Skeleton } from '@/components/ui/dataviz';
import { PotentialValue, ConfidenceMeter } from '@/components/ui/value';
import { Tilt, AccentWash, FrameBreakImage, GlassSheen } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { buildActions, type CoachAction } from '@/lib/value/actions';
import { buildMenuBenchmark } from '@/lib/value/potential';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { useLang } from '@/lib/useLang';
import type { Opportunity } from '@/lib/opportunities/types';
import type { MenuEngineeringItem } from '@/lib/analytics/types';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';

/** Auto-refresh cadence — the coach is a live surface that re-reads on each tick. */
const POLL_MS = 20_000;

/** The amber "do it" pill — the single most important affordance on the screen. */
const primaryBtn =
  'group inline-flex items-center gap-2.5 rounded-full bg-amber-100 px-7 py-3.5 text-[13px] font-semibold tracking-[0.08em] text-black transition-all duration-300 hover:bg-amber-200 hover:gap-3.5 hover:shadow-[0_0_40px_rgba(251,191,36,0.35)]';

export default function CoachPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const headFont = isHe ? serifHe : serif;

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [items, setItems] = useState<MenuEngineeringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [oppsRes, engRes] = await Promise.all([
        fetch('/api/analytics/opportunities', { cache: 'no-store' }),
        fetch('/api/analytics/menu-engineering', { cache: 'no-store' }),
      ]);

      const oppsJson: { success: boolean; data?: { opportunities: Opportunity[] } } = await oppsRes.json();
      if (oppsJson.success && oppsJson.data) setOpportunities(oppsJson.data.opportunities);
      else setError(true);

      // Menu-engineering is best-effort — a failure here only removes the ₪ estimate.
      try {
        const engJson: { success: boolean; data?: { items: MenuEngineeringItem[] } } = await engRes.json();
        setItems(engJson.success && engJson.data ? engJson.data.items : []);
      } catch {
        setItems([]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    // Defer the initial fetch off the effect body so the first paint isn't a
    // synchronous setState cascade; the interval then keeps the surface live.
    const initial = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [load]);

  // Achievable benchmark from the menu's OWN medians (never fabricated) + slug lookup,
  // so each action carries its real, honest revenue estimate.
  const bench = useMemo(() => buildMenuBenchmark(items), [items]);
  const itemBySlug = useMemo(() => new Map(items.map((i) => [i.slug, i])), [items]);
  const actions = useMemo<CoachAction[]>(
    () => buildActions(opportunities, itemBySlug, bench),
    [opportunities, itemBySlug, bench],
  );

  const top = actions[0];
  const nextUp = actions.slice(1, 4);
  const showInitialLoading = loading && !hasLoadedOnce;
  // "No data at all" vs "all caught up" — only the former is a data problem.
  const noData = error || opportunities.length === 0;

  return (
    <AdminShell
      title="AI Coach"
      titleHe="המאמן שלך"
      eyebrow="Your coach for today"
      eyebrowHe="המאמן שלך להיום"
      active="/admin/coach"
      subtitle="One move that makes the most money — with the reason and a one-click path."
      subtitleHe="המהלך שמרוויח הכי הרבה — עם הסיבה ובלחיצה אחת."
      actions={<LiveDot label={isHe ? 'חי' : 'Live'} />}
    >
      {showInitialLoading ? (
        <CoachSkeleton />
      ) : top ? (
        <>
          <HeroAction action={top} lang={lang} headFont={headFont} isHe={isHe} />
          {nextUp.length > 0 && <NextUpStrip actions={nextUp} lang={lang} isHe={isHe} />}
        </>
      ) : (
        <EmptyHero noData={noData} lang={lang} headFont={headFont} isHe={isHe} />
      )}
    </AdminShell>
  );
}

/* ── The #1 action — a near-FULL-SCREEN cinematic stage where the DRINK IS KING ── */

function HeroAction({
  action,
  lang,
  headFont,
  isHe,
}: {
  action: CoachAction;
  lang: 'en' | 'he';
  headFont: string;
  isHe: boolean;
}) {
  const cocktail = findCocktailBySlug(action.slug);
  const accent = getAccent(action.slug);
  const title = action.title[lang];
  // One line of WHY — the single strongest piece of evidence. No clutter.
  const why = action.why[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      // The stage: tall, centered, overflow-visible so the glass can rise above
      // everything. Generous top padding reserves the air the frame-break needs.
      className="relative flex min-h-[calc(100vh-13rem)] flex-col items-center overflow-visible rounded-[2.5rem] border border-white/10 bg-white/[0.02] px-6 pb-12 pt-28 text-center md:px-10 md:pt-36"
    >
      {/* Per-drink accent wash + luxury glass sheen on the whole stage */}
      <AccentWash accent={accent} opacity={0.26} />
      <GlassSheen />

      {/* THE DRINK — massive, breaking the frame, tilting toward the cursor */}
      <div className="relative w-full max-w-[26rem]">
        {cocktail ? (
          <Tilt className="block w-full" max={8}>
            <FrameBreakImage src={cocktail.heroImage} accent={accent} overflow="170%" className="h-80 w-full md:h-[26rem]" />
          </Tilt>
        ) : (
          <div className="h-80 w-full rounded-3xl bg-white/[0.03] md:h-[26rem]" />
        )}
      </div>

      {/* THE MOVE — vertical, centered, staggered entrance below the drink */}
      <Stagger className="relative z-[1] mt-2 flex w-full max-w-2xl flex-col items-center">
        <motion.p
          variants={staggerItem}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.45em]"
          style={{ color: accent, fontFamily: sans }}
        >
          <Sunrise size={13} strokeWidth={2} />
          {isHe ? 'המהלך של היום' : "Today's move"}
        </motion.p>

        <motion.h2
          variants={staggerItem}
          className="mt-5 text-balance text-white"
          style={{
            fontFamily: headFont,
            fontStyle: isHe ? 'normal' : 'italic',
            fontWeight: 500,
            lineHeight: 1.04,
            fontSize: 'clamp(2.4rem, 6vw, 4.6rem)',
          }}
        >
          {title}
        </motion.h2>

        {/* ONE line of WHY — the single strongest evidence */}
        {why && (
          <motion.p
            variants={staggerItem}
            className="mt-6 text-[15px] leading-relaxed text-white/65"
            style={{ fontFamily: sans }}
          >
            <span className="text-white/85">{why.label[lang]}</span>
            <span className="text-white/35"> — </span>
            <span className="tabular-nums text-white" style={{ fontWeight: 600 }}>
              {why.value}
            </span>
          </motion.p>
        )}

        {/* Value (honest estimate) + confidence + effort — centered */}
        <motion.div
          variants={staggerItem}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <PotentialValue potential={action.potential} lang={lang} size="lg" accent="#34d399" />
          <div className="flex flex-wrap items-center justify-center gap-4">
            <ConfidenceMeter pct={action.confidencePct} lang={lang} />
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/40" style={{ fontFamily: sans }}>
              <Clock size={12} strokeWidth={1.8} />
              {isHe ? `~${action.effortMin} דק'` : `~${action.effortMin} min`}
            </span>
          </div>
        </motion.div>

        {/* The one LARGE primary CTA — "Act now" */}
        <motion.div variants={staggerItem} className="mt-9">
          <Link href={action.executeHref} className={primaryBtn} style={{ fontFamily: sans }}>
            {isHe ? 'בצע עכשיו' : 'Act now'}
            <ArrowRight
              size={17}
              strokeWidth={2.2}
              className={isHe ? 'rotate-180 transition-transform group-hover:-translate-x-0.5' : 'transition-transform group-hover:translate-x-0.5'}
            />
          </Link>
        </motion.div>
      </Stagger>
    </motion.section>
  );
}

/* ── "Next up" — a tiny, muted footer strip (thumbnails only) ─────────────── */

function NextUpStrip({
  actions,
  lang,
  isHe,
}: {
  actions: CoachAction[];
  lang: 'en' | 'he';
  isHe: boolean;
}) {
  return (
    <section className="mt-10 flex flex-wrap items-center justify-center gap-3 opacity-60 transition-opacity hover:opacity-100">
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/35" style={{ fontFamily: sans }}>
        {isHe ? 'הבאים בתור' : 'Next up'}
      </span>
      {actions.map((a) => {
        const cocktail = findCocktailBySlug(a.slug);
        const accent = getAccent(a.slug);
        return (
          <Link
            key={a.id}
            href={a.executeHref}
            title={a.title[lang]}
            aria-label={a.title[lang]}
            className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 transition-colors hover:border-white/30"
          >
            <AccentWash accent={accent} opacity={0.18} />
            {cocktail ? (
              <GlassImage src={cocktail.heroImage} accent={accent} className="relative h-12 w-12" />
            ) : (
              <span className="relative block h-12 w-12 bg-white/[0.04]" />
            )}
          </Link>
        );
      })}
    </section>
  );
}

/* ── Empty / all-caught-up state ──────────────────────────────────────────── */

function EmptyHero({
  noData,
  lang,
  headFont,
  isHe,
}: {
  noData: boolean;
  lang: 'en' | 'he';
  headFont: string;
  isHe: boolean;
}) {
  void lang;
  const accent = '#34d399';
  const heading = noData
    ? isHe
      ? 'אסוף עוד תנועה'
      : 'Collect more traffic'
    : isHe
      ? 'הכל מטופל'
      : 'All caught up';
  const body = noData
    ? isHe
      ? 'אין עדיין מספיק נתונים כדי להמליץ על מהלך. ברגע שאורחים יתחילו לסרוק את התפריט, המאמן יציע לך מה לעשות.'
      : 'Not enough data yet to recommend a move. Once guests start scanning the menu, your coach will surface the one thing to do.'
    : isHe
      ? 'אין כרגע מהלך פתוח. חזור מאוחר יותר — המאמן ימשיך לעקוב אחרי התנועה ויעדכן ברגע שתופיע הזדמנות.'
      : 'No open move right now. Check back later — your coach keeps watching the traffic and will surface the next opportunity the moment it appears.';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] px-8 py-20 text-center"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: `radial-gradient(90% 70% at 50% 0%, ${accent}1f, transparent 60%)` }}
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <span
          className="grid h-16 w-16 place-items-center rounded-full border"
          style={{ borderColor: `${accent}55`, color: accent, background: `${accent}12` }}
        >
          {noData ? <Sparkles size={26} strokeWidth={1.6} /> : <Check size={28} strokeWidth={2} />}
        </span>
        <h2
          className="mt-6 text-white"
          style={{
            fontFamily: headFont,
            fontStyle: isHe ? 'normal' : 'italic',
            fontWeight: 500,
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
          }}
        >
          {heading}
        </h2>
        <p className="mt-4 text-[14px] leading-relaxed text-white/45" style={{ fontFamily: sans }}>
          {body}
        </p>
      </div>
    </motion.section>
  );
}

/* ── Loading skeleton — mirrors the hero footprint ────────────────────────── */

function CoachSkeleton() {
  return (
    <div className="rounded-[2.25rem] border border-white/10 bg-white/[0.02] p-7 md:p-14">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[34rem] rounded-3xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-3 h-20 w-48 rounded-xl" />
          <Skeleton className="mt-2 h-12 w-44 rounded-full" />
        </div>
      </div>
    </div>
  );
}

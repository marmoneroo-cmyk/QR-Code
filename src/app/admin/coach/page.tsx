'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Clock, Sunrise, Check } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel, LiveDot, Skeleton } from '@/components/ui/dataviz';
import { PotentialValue, ConfidenceMeter } from '@/components/ui/value';
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
          {nextUp.length > 0 && (
            <section className="mt-14">
              <SectionLabel icon={Sparkles}>{isHe ? 'הבאים בתור' : 'Next up'}</SectionLabel>
              <div className="flex flex-col gap-3">
                {nextUp.map((a, i) => (
                  <NextRow key={a.id} action={a} rank={i + 2} lang={lang} isHe={isHe} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyHero noData={noData} lang={lang} headFont={headFont} isHe={isHe} />
      )}
    </AdminShell>
  );
}

/* ── The #1 action — a GIANT full-width hero ──────────────────────────────── */

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

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02]"
    >
      {/* Ambient accent wash behind the whole hero */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ background: `radial-gradient(120% 90% at ${isHe ? '85%' : '15%'} 10%, ${accent}22, transparent 60%)` }}
        aria-hidden
      />
      <div className="relative grid items-center gap-8 p-7 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10 md:p-12">
        {/* HUGE glass — ~40-50% of the hero */}
        <div className="order-1 flex justify-center md:order-none">
          {cocktail ? (
            <GlassImage
              src={cocktail.heroImage}
              accent={accent}
              className="aspect-[3/4] w-full max-w-[20rem] md:max-w-none"
            />
          ) : (
            <div className="aspect-[3/4] w-full max-w-[20rem] rounded-3xl bg-white/[0.03] md:max-w-none" />
          )}
        </div>

        {/* The move */}
        <div className="order-2 min-w-0 md:order-none">
          <p
            className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em]"
            style={{ color: accent, fontFamily: sans }}
          >
            <Sunrise size={13} strokeWidth={2} />
            {isHe ? 'המהלך של היום' : "Today's move"}
          </p>

          <h2
            className="mt-4 text-white"
            style={{
              fontFamily: headFont,
              fontStyle: isHe ? 'normal' : 'italic',
              fontWeight: 500,
              lineHeight: 1.08,
              fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
            }}
          >
            {title}
          </h2>

          {/* WHY — real evidence as a clean bullet list */}
          {action.why.length > 0 && (
            <div className="mt-7">
              <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/70" style={{ fontFamily: sans }}>
                {isHe ? 'למה' : 'Why'}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {action.why.map((ev, i) => (
                  <li
                    key={`${ev.label.en}-${i}`}
                    className="flex items-baseline gap-2.5 text-[14px] leading-relaxed text-white/70"
                    style={{ fontFamily: sans }}
                  >
                    <span className="mt-[1px] shrink-0" style={{ color: accent }} aria-hidden>
                      •
                    </span>
                    <span className="min-w-0">
                      <span className="text-white/85">{ev.label[lang]}</span>
                      <span className="text-white/40"> — </span>
                      <span className="tabular-nums text-white" style={{ fontWeight: 600 }}>
                        {ev.value}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Value (honest estimate) + confidence + effort */}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <PotentialValue potential={action.potential} lang={lang} size="lg" accent="#34d399" />
            <div className="flex flex-col gap-2.5">
              <ConfidenceMeter pct={action.confidencePct} lang={lang} />
              <span
                className="inline-flex items-center gap-1.5 text-[11px] text-white/40"
                style={{ fontFamily: sans }}
              >
                <Clock size={12} strokeWidth={1.8} />
                {isHe ? `~${action.effortMin} דק'` : `~${action.effortMin} min`}
              </span>
            </div>
          </div>

          {/* The one big primary CTA */}
          <div className="mt-8">
            <Link href={action.executeHref} className={primaryBtn} style={{ fontFamily: sans }}>
              {action.executeLabel[lang]}
              <ArrowRight
                size={16}
                strokeWidth={2.2}
                className={isHe ? 'rotate-180 transition-transform group-hover:-translate-x-0.5' : 'transition-transform group-hover:translate-x-0.5'}
              />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ── "Next up" — compact rows for actions 2-4 ─────────────────────────────── */

function NextRow({
  action,
  rank,
  lang,
  isHe,
}: {
  action: CoachAction;
  rank: number;
  lang: 'en' | 'he';
  isHe: boolean;
}) {
  const cocktail = findCocktailBySlug(action.slug);
  const accent = getAccent(action.slug);
  const ils = (n: number) => `₪${Math.round(n).toLocaleString()}`;

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 transition-colors hover:border-white/20 hover:bg-white/[0.03]">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/12 text-[12px] tabular-nums text-white/50"
        style={{ fontFamily: sans }}
        aria-hidden
      >
        {rank}
      </span>

      {cocktail ? (
        <GlassImage src={cocktail.heroImage} accent={accent} className="h-12 w-12 shrink-0" />
      ) : (
        <span className="h-12 w-12 shrink-0 rounded-full bg-white/[0.04]" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-white/90" style={{ fontFamily: sans, fontWeight: 600 }}>
          {action.title[lang]}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {action.potential ? (
            <span className="text-[12px] tabular-nums text-emerald-300" style={{ fontFamily: sans, fontWeight: 600 }}>
              +{ils(action.potential.revenueILS)}
            </span>
          ) : (
            <span className="text-[11px] italic text-white/30" style={{ fontFamily: sans }}>
              {isHe ? 'אסוף עוד תנועה' : 'Collect more traffic'}
            </span>
          )}
          <ConfidenceMeter pct={action.confidencePct} lang={lang} segments={6} />
        </div>
      </div>

      <Link
        href={action.executeHref}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-[11px] tracking-[0.06em] text-white/70 transition-colors hover:border-amber-200/40 hover:text-amber-100"
        style={{ fontFamily: sans }}
      >
        <span className="hidden sm:inline">{action.executeLabel[lang]}</span>
        <ArrowRight size={14} strokeWidth={2} className={isHe ? 'rotate-180' : ''} />
      </Link>
    </div>
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
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-7 md:p-12">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10">
        <Skeleton className="mx-auto aspect-[3/4] w-full max-w-[20rem] rounded-3xl md:max-w-none" />
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

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PartyPopper,
  Trophy,
  ArrowUpRight,
  ShieldCheck,
  Rocket,
  Eye,
  DoorOpen,
  Heart,
  Target,
  ShoppingBag,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { CountUpText, LiveDot, SectionLabel } from '@/components/ui/dataviz';
import { FrameBreakImage, GlassSheen, AccentWash, HoverLift, Tilt } from '@/components/ui/visual';
import { Confetti, VictoryRing } from '@/components/ui/celebrate';
import { Reveal, Stagger, staggerItem } from '@/components/ui/motion';
import { useLang } from '@/lib/useLang';
import type { MetricKey, Confidence } from '@/lib/closedloop/types';
import type { ClosedLoopItem, ClosedLoopReport } from '@/lib/closedloop/server';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';

const POLL_MS = 20000;
const DAY_MS = 86400000;
const EMERALD = '#34d399';
const GOLD = '#fbbf24';

type Lang = 'en' | 'he';
type TabKey = 'week' | 'month' | 'all';

interface Bilingual {
  en: string;
  he: string;
}

const TABS: { key: TabKey; label: Bilingual; days: number | null }[] = [
  { key: 'week', label: { en: 'This week', he: 'השבוע' }, days: 7 },
  { key: 'month', label: { en: 'This month', he: 'החודש' }, days: 30 },
  { key: 'all', label: { en: 'All time', he: 'כל הזמנים' }, days: null },
];

const METRIC: Record<MetricKey, { label: Bilingual; icon: LucideIcon }> = {
  views: { label: { en: 'Views', he: 'צפיות' }, icon: Eye },
  opens: { label: { en: 'Opens', he: 'פתיחות' }, icon: DoorOpen },
  favorites: { label: { en: 'Favorites', he: 'מועדפים' }, icon: Heart },
  intent: { label: { en: 'Order intent', he: 'כוונת הזמנה' }, icon: Target },
  sales: { label: { en: 'Sales', he: 'מכירות' }, icon: ShoppingBag },
  shares: { label: { en: 'Shares', he: 'שיתופים' }, icon: Share2 },
};

const CONF_LABEL: Record<Confidence, Bilingual> = {
  high: { en: 'High confidence', he: 'ביטחון גבוה' },
  medium: { en: 'Medium confidence', he: 'ביטחון בינוני' },
  low: { en: 'Early signal', he: 'אות מוקדם' },
};

const CONF_COLOR: Record<Confidence, string> = {
  high: EMERALD,
  medium: GOLD,
  low: '#a3a3a3',
};

/** A measured item that genuinely worked, with a reportable positive delta. */
function isWin(item: ClosedLoopItem): boolean {
  return item.result.status === 'success' && typeof item.result.deltaPct === 'number' && item.result.deltaPct > 0;
}

/** Human relative date — real timestamps only, never fabricated. */
function relativeDate(iso: string, isHe: boolean): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
  if (days === 0) return isHe ? 'היום' : 'today';
  if (days === 1) return isHe ? 'אתמול' : 'yesterday';
  if (days < 7) return isHe ? `לפני ${days} ימים` : `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return isHe ? `לפני ${w} שב׳` : `${w}w ago`;
  }
  const m = Math.floor(days / 30);
  return isHe ? `לפני ${m} חוד׳` : `${m}mo ago`;
}

export default function HallOfWinsPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = useCallback((en: string, he: string) => (isHe ? he : en), [isHe]);

  const [data, setData] = useState<ClosedLoopReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/closed-loop', { cache: 'no-store' });
      const json: { success: boolean; data?: ClosedLoopReport } = await res.json();
      setData(json.success && json.data ? json.data : { measured: [], timeline: [], hasData: false });
    } catch {
      setData({ measured: [], timeline: [], hasData: false });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // All real wins, newest first (the #1 / freshest gets the larger treatment).
  const allWins = useMemo<ClosedLoopItem[]>(() => {
    const wins = (data?.measured ?? []).filter(isWin);
    return [...wins].sort((a, b) => new Date(b.change.createdAt).getTime() - new Date(a.change.createdAt).getTime());
  }, [data]);

  const wins = useMemo<ClosedLoopItem[]>(() => {
    const cfg = TABS.find((x) => x.key === tab);
    if (!cfg || cfg.days === null) return allWins;
    const cutoff = Date.now() - cfg.days * DAY_MS;
    return allWins.filter((w) => new Date(w.change.createdAt).getTime() >= cutoff);
  }, [allWins, tab]);

  // Real average uplift across the currently-shown wins (no fabrication).
  const avgUplift = useMemo<number | null>(() => {
    const deltas = wins.map((w) => w.result.deltaPct).filter((d): d is number => typeof d === 'number');
    if (deltas.length === 0) return null;
    return Math.round(deltas.reduce((s, n) => s + n, 0) / deltas.length);
  }, [wins]);

  // The single best win in the active window — by real deltaPct. Gets the crown label.
  const bestWinId = useMemo<string | null>(() => {
    let best: ClosedLoopItem | null = null;
    for (const w of wins) {
      const d = w.result.deltaPct;
      if (typeof d !== 'number') continue;
      if (!best || d > (best.result.deltaPct ?? 0)) best = w;
    }
    return best?.change.id ?? null;
  }, [wins]);

  const hasAnyWinEver = allWins.length > 0;

  return (
    <AdminShell
      title="Hall of Wins"
      titleHe="אולם ההצלחות"
      eyebrow="What the platform already did"
      eyebrowHe="מה שהמערכת כבר עשתה"
      active="/admin/wins"
      subtitle="Every change that measurably worked — celebrated."
      subtitleHe="כל שינוי שעבד באמת — בחגיגיות."
    >
      <div className="flex flex-col gap-10" dir={isHe ? 'rtl' : 'ltr'}>
        {/* ── Header: live counter + real avg uplift + tabs ───────────────── */}
        {loaded && hasAnyWinEver && (
          <Reveal>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <SectionLabel icon={Trophy}>{t('Measured wins', 'ניצחונות נמדדים')}</SectionLabel>
                  <h2
                    className="mb-1 leading-tight text-white"
                    style={{
                      fontFamily: isHe ? serifHe : serif,
                      fontStyle: isHe ? 'normal' : 'italic',
                      fontWeight: 700,
                      fontSize: 'clamp(1.4rem,3vw,1.9rem)',
                    }}
                  >
                    {t('Wins worth celebrating', 'ניצחונות ששווה לחגוג')}
                  </h2>
                  <div className="flex items-baseline gap-3">
                    <span
                      className="leading-none text-white"
                      style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(2.6rem,7vw,4rem)' }}
                    >
                      <CountUpText text={String(wins.length)} />
                    </span>
                    <span className="text-white/55 text-base" style={{ fontFamily: sans }}>
                      {wins.length === 1 ? t('win', 'ניצחון') : t('wins', 'ניצחונות')}
                    </span>
                  </div>
                  {avgUplift !== null && (
                    <p className="mt-1 text-[13px]" style={{ fontFamily: sans }}>
                      <span style={{ color: EMERALD, fontWeight: 700 }}>
                        <CountUpText text={`+${avgUplift}%`} />
                      </span>{' '}
                      <span className="text-white/45">{t('average uplift', 'עלייה ממוצעת')}</span>
                    </p>
                  )}
                </div>
                <LiveDot label={t('Live', 'בזמן אמת')} />
              </div>

              {/* Time tabs */}
              <div className="inline-flex w-fit gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                {TABS.map((x) => {
                  const active = tab === x.key;
                  return (
                    <button
                      key={x.key}
                      type="button"
                      onClick={() => setTab(x.key)}
                      className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors"
                      style={{
                        fontFamily: sans,
                        fontWeight: 600,
                        color: active ? '#000' : 'rgba(255,255,255,0.6)',
                        background: active ? GOLD : 'transparent',
                      }}
                    >
                      {x.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>
        )}

        {/* ── Loading skeletons ───────────────────────────────────────────── */}
        {!loaded && (
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 w-full animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        )}

        {/* ── Empty state: no wins EVER → premium, motivating ─────────────── */}
        {loaded && !hasAnyWinEver && <EmptyState lang={lang} isHe={isHe} t={t} />}

        {/* ── Empty within the active tab (but wins exist elsewhere) ──────── */}
        {loaded && hasAnyWinEver && wins.length === 0 && (
          <Reveal>
            <div
              className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center"
              style={{ fontFamily: sans }}
            >
              <p className="text-white/70 text-[15px]">
                {t('No wins in this window — yet.', 'אין ניצחונות בחלון הזה — עדיין.')}
              </p>
              <button
                type="button"
                onClick={() => setTab('all')}
                className="mt-3 text-[12px] uppercase tracking-[0.2em]"
                style={{ color: GOLD, fontWeight: 600 }}
              >
                {t('See all wins →', 'הצג את כל הניצחונות →')}
              </button>
            </div>
          </Reveal>
        )}

        {/* ── The celebration grid ────────────────────────────────────────── */}
        {loaded && wins.length > 0 && (
          <Stagger className="grid gap-6 sm:grid-cols-2">
            {wins.map((w, i) => (
              <motion.div
                key={w.change.id}
                variants={staggerItem}
                className={i === 0 ? 'sm:col-span-2' : ''}
              >
                <WinCard
                  item={w}
                  lang={lang}
                  isHe={isHe}
                  t={t}
                  featured={i === 0}
                  isBest={w.change.id === bestWinId}
                  activeTab={tab}
                />
              </motion.div>
            ))}
          </Stagger>
        )}
      </div>
    </AdminShell>
  );
}

interface WinCardProps {
  item: ClosedLoopItem;
  lang: Lang;
  isHe: boolean;
  t: (en: string, he: string) => string;
  featured: boolean;
  isBest: boolean;
  activeTab: TabKey;
}

const BEST_LABEL: Record<TabKey, Bilingual> = {
  week: { en: 'Best result this week', he: 'התוצאה הכי טובה השבוע' },
  month: { en: 'Best result this month', he: 'התוצאה הכי טובה החודש' },
  all: { en: 'Best result of all time', he: 'התוצאה הכי טובה אי פעם' },
};

function WinCard({ item, lang, isHe, t, featured, isBest, activeTab }: WinCardProps) {
  const slug = item.change.entityId;
  const cocktail = slug ? findCocktailBySlug(slug) : undefined;
  const accent = slug ? getAccent(slug) : GOLD;
  const title = cocktail ? cocktail.title[lang] : item.change.summary ?? (slug ?? '');
  const delta = item.result.deltaPct ?? 0;

  const metric = METRIC[item.metric];
  const MetricIcon = metric.icon;
  const confColor = CONF_COLOR[item.confidence];

  // Reserve top space for the frame-breaking drink on an overflow-visible panel.
  const imageSlotH = featured ? 'h-56 md:h-64' : 'h-44';
  const padTop = featured ? 'pt-28 md:pt-32' : 'pt-24';

  return (
    <HoverLift accent={accent} className="h-full">
      <div
        className={`relative h-full overflow-visible rounded-[28px] border bg-white/[0.02] px-6 pb-6 ${padTop}`}
        style={{ borderColor: `${accent}33` }}
      >
        <AccentWash accent={accent} opacity={featured ? 0.24 : 0.18} />
        <GlassSheen />

        {/* Frame-breaking drink — the featured (most-recent) win gets a victory glow + confetti */}
        {cocktail && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            {featured && <VictoryRing accent={accent} size={240} />}
            <Tilt className="flex justify-center">
              <FrameBreakImage
                src={cocktail.heroImage}
                accent={accent}
                className={`${imageSlotH} w-40`}
                overflow="165%"
              />
            </Tilt>
          </div>
        )}
        {featured && <Confetti count={36} />}

        <div className="relative flex h-full flex-col gap-3" dir={isHe ? 'rtl' : 'ltr'}>
          {/* Crown — the single best result in the active window (real max deltaPct) */}
          {isBest && (
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em]"
              style={{ borderColor: `${GOLD}66`, color: GOLD, background: `${GOLD}14`, fontFamily: sans, fontWeight: 700 }}
            >
              <Trophy size={12} strokeWidth={2} /> {BEST_LABEL[activeTab][lang]}
            </span>
          )}

          {/* Success badge */}
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em]"
            style={{ borderColor: `${EMERALD}66`, color: EMERALD, background: `${EMERALD}14`, fontFamily: sans, fontWeight: 700 }}
          >
            <PartyPopper size={13} strokeWidth={2} /> {t('🎉 Success', '🎉 הצלחה')}
          </span>

          {/* Cocktail name */}
          <h3
            className="leading-tight text-white"
            style={{
              fontFamily: isHe ? serifHe : serif,
              fontStyle: isHe ? 'normal' : 'italic',
              fontWeight: 600,
              fontSize: featured ? 'clamp(1.5rem,3.5vw,2rem)' : '1.25rem',
            }}
          >
            {title}
          </h3>

          {/* HUGE real delta */}
          <p
            className="inline-flex items-baseline gap-1.5"
            style={{ color: EMERALD, fontFamily: serif, fontWeight: 700 }}
          >
            <ArrowUpRight size={featured ? 34 : 26} strokeWidth={2.4} className="self-center" />
            <CountUpText
              text={`+${delta}%`}
              style={{ fontSize: featured ? 'clamp(2.6rem,7vw,4rem)' : 'clamp(1.9rem,5vw,2.6rem)', lineHeight: 1 }}
            />
          </p>

          {/* Story-first result line — real delta + real metric, ordered per language */}
          <p className="text-[15px] text-white/80" style={{ fontFamily: sans, fontWeight: 600 }}>
            {isHe ? `${metric.label.he} +${delta}%` : `+${delta}% ${metric.label.en}`}
          </p>

          {/* Real, attributable facts only: metric · window · date */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-white/55" style={{ fontFamily: sans }}>
            <span className="inline-flex items-center gap-1.5" style={{ color: accent }}>
              <MetricIcon size={13} strokeWidth={1.9} /> {metric.label[lang]}
            </span>
            <span className="text-white/25">·</span>
            <span>
              {t('over', 'במשך')} {item.observationDays}
              {t('d', ' י׳')}
              {item.stillAccumulating ? t(' · still measuring', ' · עדיין נמדד') : ''}
            </span>
            <span className="text-white/25">·</span>
            <span>{relativeDate(item.change.createdAt, isHe)}</span>
          </div>

          {/* Confidence — honest about sample strength */}
          <div className="mt-auto pt-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]"
              style={{ borderColor: `${confColor}55`, color: confColor, fontFamily: sans, fontWeight: 600 }}
            >
              <ShieldCheck size={11} strokeWidth={2} /> {CONF_LABEL[item.confidence][lang]}
            </span>
          </div>
        </div>
      </div>
    </HoverLift>
  );
}

interface EmptyStateProps {
  lang: Lang;
  isHe: boolean;
  t: (en: string, he: string) => string;
}

function EmptyState({ isHe, t }: EmptyStateProps) {
  return (
    <Reveal>
      <div
        className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] px-8 py-16 text-center"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        <AccentWash accent={GOLD} opacity={0.2} />
        <GlassSheen />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
          <span
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ color: GOLD, background: `${GOLD}1a`, boxShadow: `0 0 40px ${GOLD}33` }}
          >
            <Trophy size={30} strokeWidth={1.6} />
          </span>
          <h2
            className="leading-tight text-white"
            style={{ fontFamily: isHe ? serifHe : serif, fontWeight: 700, fontSize: 'clamp(1.7rem,4vw,2.4rem)' }}
          >
            {t('Your first win is coming', 'הניצחון הראשון שלך מתקרב')}
          </h2>
          <p className="text-white/55 text-[15px] leading-relaxed" style={{ fontFamily: sans }}>
            {t(
              'Make a move and the platform will measure it — when a change works, it lands here in lights.',
              'בצעו צעד והמערכת תמדוד אותו — כששינוי עובד, הוא ינחת כאן באורות.'
            )}
          </p>
          <Link
            href="/admin/actions"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-300 px-7 py-3 text-[11px] uppercase tracking-[0.25em] text-black transition-transform hover:scale-[1.04]"
            style={{ fontFamily: sans, fontWeight: 700 }}
          >
            <Rocket size={14} strokeWidth={2.2} />
            {t('Make your first move', 'בצע את המהלך הראשון')}
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

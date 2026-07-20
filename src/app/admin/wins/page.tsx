'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { useNow } from '@/lib/useNow';
import { AdminShell } from '@/components/ui/AdminShell';
import { CountUpText, LiveDot, SectionLabel } from '@/components/ui/dataviz';
import { FrameBreakImage, GlassSheen, AccentWash, HoverLift, Tilt } from '@/components/ui/visual';
import { Confetti, VictoryRing } from '@/components/ui/celebrate';
import { Reveal, Stagger, staggerItem } from '@/components/ui/motion';
import { GlassCard, EmptyState as PremiumEmptyState, ErrorState, CtaPill } from '@/components/ui/premium';
import { useLang } from '@/lib/useLang';
import type { MetricKey, Confidence } from '@/lib/closedloop/types';
import type { ClosedLoopItem, ClosedLoopReport } from '@/lib/closedloop/server';
import { useApiData } from '@/lib/data/useApiData';

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

export function WinsPanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = useCallback((en: string, he: string) => (isHe ? he : en), [isHe]);

  const [tab, setTab] = useState<TabKey>('all');

  // loaded/error are derived to match the page's original semantics: `loaded` used to mean
  // "the first load attempt has settled" (success or failure) and `error` mirrored the latest
  // fetch's outcome while `data` kept the last good payload — exactly what useApiData's
  // loading/error already track, just under the old names so the JSX below stays untouched.
  const { data, loading, error: fetchError, reload: load } = useApiData<ClosedLoopReport>(
    '/api/closed-loop',
    { refreshInterval: POLL_MS },
  );
  const loaded = !loading;
  const error = Boolean(fetchError);

  // Seeded-once clock (render-pure) for the time-window cutoffs below.
  const now = useNow();

  // All real wins, newest first (the #1 / freshest gets the larger treatment).
  const allWins = useMemo<ClosedLoopItem[]>(() => {
    const wins = (data?.measured ?? []).filter(isWin);
    return [...wins].sort((a, b) => new Date(b.change.createdAt).getTime() - new Date(a.change.createdAt).getTime());
  }, [data]);

  const wins = useMemo<ClosedLoopItem[]>(() => {
    const cfg = TABS.find((x) => x.key === tab);
    if (!cfg || cfg.days === null) return allWins;
    const cutoff = now - cfg.days * DAY_MS;
    return allWins.filter((w) => new Date(w.change.createdAt).getTime() >= cutoff);
  }, [allWins, tab, now]);

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

  // Completed actions still inside their measurement window. Without this strip
  // the owner marked an action "בוצע", opened the Hall of Wins, and saw nothing —
  // the pipeline was measuring, but the room said their work didn't exist.
  const pending = useMemo<ClosedLoopItem[]>(() => {
    return (data?.measured ?? [])
      .filter((m) => !isWin(m))
      .filter(
        (m) =>
          m.stillAccumulating ||
          m.result.status === 'too_early' ||
          m.result.status === 'insufficient_data',
      )
      .sort((a, b) => new Date(b.change.createdAt).getTime() - new Date(a.change.createdAt).getTime())
      .slice(0, 6);
  }, [data]);

  return (
    <>
      <div className="flex flex-col gap-10" dir={isHe ? 'rtl' : 'ltr'}>
        {/* ── Header: live counter + real avg uplift + tabs ───────────────── */}
        {loaded && hasAnyWinEver && (
          <Reveal>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <SectionLabel icon={Trophy}>{t('Measured wins', 'ניצחונות נמדדים')}</SectionLabel>
                  <h2
                    className="mb-1 leading-tight text-white font-serif"
                    style={{
                      fontStyle: isHe ? 'normal' : 'italic',
                      fontWeight: 700,
                      fontSize: 'clamp(1.4rem,3vw,1.9rem)',
                    }}
                  >
                    {t('Wins worth celebrating', 'ניצחונות ששווה לחגוג')}
                  </h2>
                  <div className="flex items-baseline gap-3">
                    <span
                      className="leading-none text-white font-serif"
                      style={{ fontWeight: 700, fontSize: 'clamp(2.6rem,7vw,4rem)' }}
                    >
                      <CountUpText text={String(wins.length)} />
                    </span>
                    <span className="text-white/55 text-base font-sans">
                      {wins.length === 1 ? t('win', 'ניצחון') : t('wins', 'ניצחונות')}
                    </span>
                  </div>
                  {avgUplift !== null && (
                    <p className="mt-1 text-13 font-sans">
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
                      className="rounded-full px-4 py-1.5 text-11 uppercase tracking-[0.18em] transition-colors font-sans"
                      style={{
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

        {/* ── Error state: load failed and we have no prior successful data ─ */}
        {loaded && error && !hasAnyWinEver && (
          <Reveal>
            <GlassCard static className="px-6 py-10 text-center">
              <ErrorState
                title={t('Couldn’t load — check your connection', 'טעינה נכשלה — בדקו את החיבור')}
                onRetry={load}
                retryLabel={t('Try again', 'נסו שוב')}
              />
            </GlassCard>
          </Reveal>
        )}

        {/* ── On the way: completed actions still being measured ──────────── */}
        {loaded && !error && pending.length > 0 && (
          <Reveal>
            <GlassCard static className="rounded-[28px] px-6 py-6">
              <SectionLabel icon={Rocket}>{t('On the way', 'בדרך לניצחון')}</SectionLabel>
              <ul className="mt-4 flex flex-col gap-3">
                {pending.map((m) => {
                  const cocktail = findCocktailBySlug(m.change.entityId ?? '');
                  const name = cocktail ? cocktail.title[lang] : m.change.entityId;
                  return (
                    <li
                      key={m.change.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <span className="text-white text-15 font-serif" style={{ fontWeight: 600 }}>
                          {name}
                        </span>
                        <span className="ms-3 text-white/55 text-13 font-sans">{m.change.summary}</span>
                      </div>
                      <span className="shrink-0 text-13 font-sans" style={{ color: GOLD }}>
                        {t(
                          `Done · measuring — day ${m.observationDays + 1}`,
                          `בוצע · במדידה — יום ${m.observationDays + 1}`,
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-white/45 text-12 font-sans">
                {t(
                  'When the numbers prove a change worked, it graduates to a win here.',
                  'כשהמספרים יוכיחו שהשינוי עבד, הוא יהפוך כאן לניצחון.',
                )}
              </p>
            </GlassCard>
          </Reveal>
        )}

        {/* ── Empty state: no wins EVER → premium, motivating ─────────────── */}
        {loaded && !error && !hasAnyWinEver && pending.length === 0 && <EmptyState lang={lang} isHe={isHe} t={t} />}

        {/* ── Empty within the active tab (but wins exist elsewhere) ──────── */}
        {loaded && hasAnyWinEver && wins.length === 0 && (
          <Reveal>
            <GlassCard static className="px-6 py-10 text-center">
              <PremiumEmptyState title={t('No wins in this window — yet.', 'אין ניצחונות בחלון הזה — עדיין.')} />
              <button
                type="button"
                onClick={() => setTab('all')}
                className="mt-1 text-xs uppercase tracking-[0.2em] font-sans"
                style={{ color: GOLD, fontWeight: 600 }}
              >
                {t('See all wins →', 'הצג את כל הניצחונות →')}
              </button>
            </GlassCard>
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
    </>
  );
}

export default function HallOfWinsPage() {
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
      <WinsPanel />
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
              className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-10 uppercase tracking-[0.22em] font-sans"
              style={{ borderColor: `${GOLD}66`, color: GOLD, background: `${GOLD}14`, fontWeight: 700 }}
            >
              <Trophy size={12} strokeWidth={2} /> {BEST_LABEL[activeTab][lang]}
            </span>
          )}

          {/* Success badge */}
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-10 uppercase tracking-[0.22em] font-sans"
            style={{ borderColor: `${EMERALD}66`, color: EMERALD, background: `${EMERALD}14`, fontWeight: 700 }}
          >
            <PartyPopper size={13} strokeWidth={2} /> {t('🎉 Success', '🎉 הצלחה')}
          </span>

          {/* Cocktail name */}
          <h3
            className="leading-tight text-white font-serif"
            style={{
              fontStyle: isHe ? 'normal' : 'italic',
              fontWeight: 600,
              fontSize: featured ? 'clamp(1.5rem,3.5vw,2rem)' : '1.25rem',
            }}
          >
            {title}
          </h3>

          {/* HUGE real delta */}
          <p
            className="inline-flex items-baseline gap-1.5 font-serif"
            style={{ color: EMERALD, fontWeight: 700 }}
          >
            <ArrowUpRight size={featured ? 34 : 26} strokeWidth={2.4} className="self-center" />
            <CountUpText
              text={`+${delta}%`}
              style={{ fontSize: featured ? 'clamp(2.6rem,7vw,4rem)' : 'clamp(1.9rem,5vw,2.6rem)', lineHeight: 1 }}
            />
          </p>

          {/* Story-first result line — real delta + real metric, ordered per language */}
          <p className="text-15 text-white/80 font-sans" style={{ fontWeight: 600 }}>
            {isHe ? `${metric.label.he} +${delta}%` : `+${delta}% ${metric.label.en}`}
          </p>

          {/* Real, attributable facts only: metric · window · date */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/55 font-sans">
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
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-10 uppercase tracking-[0.18em] font-sans"
              style={{ borderColor: `${confColor}55`, color: confColor, fontWeight: 600 }}
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
      <GlassCard static accent={GOLD} className="rounded-[32px] px-8 py-16 text-center">
        <AccentWash accent={GOLD} opacity={0.2} />
        <GlassSheen />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-4" dir={isHe ? 'rtl' : 'ltr'}>
          <span
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ color: GOLD, background: `${GOLD}1a`, boxShadow: `0 0 40px ${GOLD}33` }}
          >
            <Trophy size={30} strokeWidth={1.6} />
          </span>
          <h2
            className="leading-tight text-white font-serif"
            style={{ fontWeight: 700, fontSize: 'clamp(1.7rem,4vw,2.4rem)' }}
          >
            {t('Your first win is coming', 'הניצחון הראשון שלך מתקרב')}
          </h2>
          <p className="text-white/55 text-15 leading-relaxed font-sans">
            {t(
              'Make a move and the platform will measure it — when a change works, it lands here in lights.',
              'בצעו צעד והמערכת תמדוד אותו — כששינוי עובד, הוא ינחת כאן באורות.'
            )}
          </p>
          <CtaPill href="/admin/actions" className="mt-2">
            <Rocket size={14} strokeWidth={2.2} />
            {t('Make your first move', 'בצע את המהלך הראשון')}
          </CtaPill>
        </div>
      </GlassCard>
    </Reveal>
  );
}

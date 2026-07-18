'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Target, Martini, Clock, Check, ChevronDown, RotateCcw, CheckCircle2, ArrowRight, ArrowLeft, PartyPopper } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel, LiveDot, Skeleton } from '@/components/ui/dataviz';
import { PotentialValue, ConfidenceMeter, ReadinessNote } from '@/components/ui/value';
import { useReadiness } from '@/lib/useReadiness';
import { useOppStatuses } from '@/lib/useOppStatuses';
import { buildActions, type CoachAction } from '@/lib/value/actions';
import { splitFocusActions } from '@/lib/value/focus';
import { buildMenuBenchmark } from '@/lib/value/potential';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { HoverLift, AccentWash, Tilt } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { GlassCard, EmptyState as PremiumEmptyState } from '@/components/ui/premium';
import { Confetti } from '@/components/ui/celebrate';
import { useLang } from '@/lib/useLang';
import { formatILS } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import type { Opportunity } from '@/lib/opportunities/types';
import type { MenuEngineeringItem } from '@/lib/analytics/types';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';

/** How many focus actions we surface at once — the whole point is to NOT overwhelm. */
const FOCUS_COUNT = 3;
/** Auto-refresh cadence (ms) so the screen stays live without a manual reload. */
const POLL_MS = 20_000;
/** How long the success moment (confetti + reinforcement line) lingers after "Done". */
const CELEBRATE_MS = 2_000;

/**
 * Honest, hospitality-voiced reinforcement shown the moment an action is done.
 * Only ever surfaces a ₪ figure when `valueILS` is a real number from the action,
 * and always frames it as an estimate ("about" / "בערך"). No invented numbers.
 */
function celebrationMessage(valueILS: number | null, lang: 'en' | 'he'): string {
  if (typeof valueILS === 'number') {
    return lang === 'he'
      ? `יפה — בערך ${formatILS(valueILS)} של פוטנציאל עכשיו בתנועה.`
      : `Nice — that's about ${formatILS(valueILS)} of upside now in motion.`;
  }
  return lang === 'he' ? 'בוצע. דבר אחד פחות על הפס.' : 'Done. One less thing on the pass.';
}

export function ActionsPanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const headFont = isHe ? serifHe : serif;

  const { data: oppsData, loading, error: oppsError } = useApiData<{ opportunities: Opportunity[] }>(
    '/api/analytics/opportunities',
    { refreshInterval: POLL_MS },
  );
  const { data: engData } = useApiData<{ items: MenuEngineeringItem[] }>(
    '/api/analytics/menu-engineering',
    { refreshInterval: POLL_MS },
  );
  const opportunities = oppsData?.opportunities ?? [];
  const items = engData?.items ?? [];
  // error only when the FIRST load never produced data (matches the old `initial`-gating: polls
  // kept last-good and never flipped error); SWR keeps last-good data, so oppsData===null means
  // "never loaded".
  const error = Boolean(oppsError) && oppsData === null;
  const readiness = useReadiness();

  // Achievable target from the menu's OWN medians (never fabricated) + a slug→item lookup.
  const bench = useMemo(() => buildMenuBenchmark(items), [items]);
  const itemBySlug = useMemo(() => new Map(items.map((it) => [it.slug, it])), [items]);

  // Only buildActions output is rendered — its value is already an honest, labeled estimate.
  const actions = useMemo(
    () => buildActions(opportunities, itemBySlug, bench),
    [opportunities, itemBySlug, bench],
  );

  const { statuses, markDone, clearStatus } = useOppStatuses();
  const now = useNow();

  // The id whose row is mid-celebration (confetti + reinforcement line). Cleared by an
  // effect timeout — never set synchronously during render (React 19 would throw).
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const handleDone = useCallback(
    (id: string) => {
      markDone(id);
      setCelebratingId(id);
    },
    [markDone],
  );

  useEffect(() => {
    if (!celebratingId) return;
    const t = window.setTimeout(() => setCelebratingId(null), CELEBRATE_MS);
    return () => window.clearTimeout(t);
  }, [celebratingId]);

  // Always surface the top OPEN actions (up to FOCUS_COUNT), so finishing one promotes
  // the next into focus instead of leaving fewer and fewer. "Done today" tracks EVERY
  // completed action across the full ranked list — never a fragile top-N slice — so a
  // finished action can't vanish on a re-rank and can always be undone.
  const { focusOpen, focusDone } = useMemo(
    () => splitFocusActions(actions, statuses, now, FOCUS_COUNT),
    [actions, statuses, now],
  );

  const hasAnyFocus = focusOpen.length > 0 || focusDone.length > 0;
  const allDone = focusOpen.length === 0 && focusDone.length > 0;

  return (
    <>
      <div className="flex flex-col gap-8" dir={isHe ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel icon={Target}>{isHe ? 'הפוקוס של היום' : "Today's focus"}</SectionLabel>
          <LiveDot label={isHe ? 'מתעדכן' : 'Live'} />
        </div>

        {loading && (
          <div className="flex flex-col gap-6">
            {Array.from({ length: FOCUS_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-3xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-rose-300/80 text-sm" style={{ fontFamily: sans }}>
            {isHe ? 'טעינה נכשלה.' : 'Failed to load.'}
          </p>
        )}

        {!loading && !error && (
          <>
            {/* Honesty caveat: while the dataset is still thin, say these picks are
                preliminary rather than presenting them as settled. Only shown alongside real content. */}
            <ReadinessNote readiness={readiness} lang={lang} />

            {!hasAnyFocus && <EmptyState isHe={isHe} />}

            {allDone && <AllDoneState isHe={isHe} headFont={headFont} />}

            {focusOpen.length > 0 && (
              <Stagger className="flex flex-col gap-6">
                {focusOpen.map((action) => {
                  // Rank is the action's true 1-based position in the full ranked list.
                  const rank = actions.findIndex((a) => a.id === action.id) + 1;
                  return (
                    <ActionRow
                      key={action.id}
                      action={action}
                      rank={rank}
                      lang={lang}
                      isHe={isHe}
                      headFont={headFont}
                      celebrating={celebratingId === action.id}
                      onDone={() => handleDone(action.id)}
                    />
                  );
                })}
              </Stagger>
            )}

            {focusDone.length > 0 && (
              <DoneTodaySection
                actions={focusDone}
                lang={lang}
                isHe={isHe}
                headFont={headFont}
                celebratingId={celebratingId}
                onUndo={(id) => clearStatus(id)}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function ActionCenterPage() {
  return (
    <AdminShell
      title="Action Center"
      titleHe="מרכז הפעולות"
      eyebrow="3 things to do today"
      eyebrowHe="3 דברים לעשות היום"
      active="/admin/actions"
      subtitle="Do these and move on. Each shows its value, effort, and confidence."
      subtitleHe="בצעו ותמשיכו הלאה. לכל פעולה ערך, מאמץ ורמת ביטחון."
    >
      <ActionsPanel />
    </AdminShell>
  );
}

/* ── One big focus row ─────────────────────────────────────────────────────── */

interface ActionRowProps {
  action: CoachAction;
  rank: number;
  lang: 'en' | 'he';
  isHe: boolean;
  headFont: string;
  celebrating: boolean;
  onDone: () => void;
}

function ActionRow({ action, rank, lang, isHe, headFont, celebrating, onDone }: ActionRowProps) {
  const cocktail = findCocktailBySlug(action.slug);
  const accent = getAccent(action.slug);
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <HoverLift accent={accent} className="rounded-[1.75rem]">
      <motion.article
        variants={staggerItem}
        className="group relative overflow-hidden rounded-[1.75rem] border bg-white/[0.02] p-6 md:p-8"
        style={{ borderColor: `${accent}33` }}
      >
        <AccentWash accent={accent} opacity={0.18} />
        <span
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
          aria-hidden
        />
        {celebrating && <Confetti count={22} />}

        <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:gap-8">
          {/* Rank numeral */}
          <span
            className="shrink-0 leading-none text-white/[0.18] select-none"
            style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(4rem, 11vw, 7rem)' }}
            aria-hidden
          >
            {rank}
          </span>

          {/* Big glass — the visual anchor */}
          <div className="relative shrink-0 self-center">
            {cocktail ? (
              <Tilt className="transition-transform duration-300 group-hover:scale-[1.03]">
                <GlassImage
                  src={cocktail.heroImage}
                  accent={accent}
                  className="h-64 w-64 md:h-72 md:w-72"
                />
              </Tilt>
            ) : (
              <div className="grid h-64 w-64 place-items-center rounded-3xl border border-white/10 bg-white/[0.02] md:h-72 md:w-72">
                <Martini size={40} className="text-white/20" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <h3
              className="text-white/95 leading-tight"
              style={{
                fontFamily: headFont,
                fontStyle: isHe ? 'normal' : 'italic',
                fontWeight: 600,
                fontSize: 'clamp(1.6rem, 3.4vw, 2.3rem)',
              }}
            >
              {action.title[lang]}
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-13 text-white/75"
                style={{ fontFamily: sans }}
              >
                <Clock size={14} strokeWidth={1.9} />
                {isHe ? `~${action.effortMin} דק'` : `~${action.effortMin} min`}
              </span>
              <ConfidenceMeter pct={action.confidencePct} lang={lang} />
            </div>

            <div className="max-w-sm">
              <PotentialValue potential={action.potential} lang={lang} accent={accent} size="md" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-col gap-3 md:w-48">
            <Link
              href={action.executeHref}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ background: accent, fontFamily: sans }}
            >
              {action.executeLabel[lang]}
              <Arrow size={16} strokeWidth={2.2} />
            </Link>
            <button
              type="button"
              onClick={onDone}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-5 py-3.5 text-sm text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              style={{ fontFamily: sans }}
            >
              <Check size={16} strokeWidth={2.2} style={{ color: 'var(--success)' }} />
              {isHe ? 'בוצע' : 'Done'}
            </button>
          </div>
        </div>
      </motion.article>
    </HoverLift>
  );
}

/* ── Done today (collapsed) ────────────────────────────────────────────────── */

interface DoneTodaySectionProps {
  actions: CoachAction[];
  lang: 'en' | 'he';
  isHe: boolean;
  headFont: string;
  celebratingId: string | null;
  onUndo: (id: string) => void;
}

function DoneTodaySection({ actions, lang, isHe, headFont, celebratingId, onUndo }: DoneTodaySectionProps) {
  const [open, setOpen] = useState(false);
  // The freshly-completed action's reinforcement line — shown briefly even while the
  // list stays collapsed, so the win is felt without forcing the section open.
  const justDone = celebratingId ? actions.find((a) => a.id === celebratingId) ?? null : null;
  return (
    <div className="glass-panel rounded-3xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-3xl px-5 py-4 text-start transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      >
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/70" style={{ fontFamily: sans }}>
          <CheckCircle2 size={14} strokeWidth={2} className="text-emerald-300/70" />
          {isHe ? `בוצעו היום (${actions.length})` : `Done today (${actions.length})`}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className="text-white/40 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden
        />
      </button>

      {justDone && (
        <div className="relative overflow-hidden px-5 pb-4">
          <Confetti count={22} />
          <p
            className="relative inline-flex items-center gap-2 text-13 text-emerald-200/90"
            style={{ fontFamily: sans }}
            role="status"
          >
            <PartyPopper size={14} strokeWidth={1.9} className="text-emerald-300/80" />
            {celebrationMessage(justDone.valueILS, lang)}
          </p>
        </div>
      )}

      {open && (
        <ul className="flex flex-col gap-2 px-5 pb-5">
          {actions.map((a) => {
            const cocktail = findCocktailBySlug(a.slug);
            const accent = getAccent(a.slug);
            const title = cocktail?.title[lang] ?? a.slug;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {cocktail ? (
                    <GlassImage src={cocktail.heroImage} accent={accent} className="h-10 w-10 shrink-0" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-white/[0.02]" />
                  )}
                  <span className="truncate text-sm text-white/80" style={{ fontFamily: headFont }}>
                    {title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUndo(a.id)}
                  aria-label={isHe ? 'החזר' : 'Undo'}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-11 text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                  style={{ fontFamily: sans }}
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  {isHe ? 'החזר' : 'Undo'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Empty / celebratory states ────────────────────────────────────────────── */

function AllDoneState({ isHe, headFont }: { isHe: boolean; headFont: string }) {
  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-emerald-400/[0.04] p-12 text-center">
      <PartyPopper size={28} strokeWidth={1.6} className="mx-auto mb-4 text-emerald-300/80" />
      <h3
        className="text-white/90 leading-tight"
        style={{ fontFamily: headFont, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600, fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}
      >
        {isHe ? 'זהו, האולם מסודר להיום. עבודה יפה.' : "That's the floor handled for today. Nicely done."}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-sm text-white/50" style={{ fontFamily: sans }}>
        {isHe ? 'חזרו מחר לפעולות חדשות, או פתחו את הפעולות שבוצעו למטה.' : 'Come back tomorrow for fresh actions, or reopen what you did below.'}
      </p>
    </section>
  );
}

function EmptyState({ isHe }: { isHe: boolean }) {
  return (
    <GlassCard static className="p-12">
      <PremiumEmptyState
        title={isHe ? 'אין פעולות פתוחות — אספו עוד ביקורי אורחים.' : 'Nothing to do — collect more guest visits.'}
      />
    </GlassCard>
  );
}

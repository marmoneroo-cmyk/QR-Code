'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, Clock, Check, ChevronDown, RotateCcw, CheckCircle2, ArrowRight, ArrowLeft, PartyPopper } from 'lucide-react';
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

/** How many focus actions we surface at once — the whole point is to NOT overwhelm. */
const FOCUS_COUNT = 3;
/** Auto-refresh cadence (ms) so the screen stays live without a manual reload. */
const POLL_MS = 20_000;

/* ── Done state, persisted to the SAME key the Opportunity board uses so they sync ── */

const OPPS_STORAGE_KEY = 'cocktail-demo:opps';

type OppStatusKind = 'done' | 'dismissed' | 'snoozed';

interface OppStatusEntry {
  status: OppStatusKind;
  /** Epoch ms; only meaningful for `snoozed` (kept so we don't clobber the board). */
  until?: number;
}

type OppStatusMap = Record<string, OppStatusEntry>;

/** SSR-safe read. Never touches `window` on the server; tolerates corrupt JSON. */
function readOppStatuses(): OppStatusMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OPPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as OppStatusMap;
  } catch {
    return {};
  }
}

function writeOppStatuses(map: OppStatusMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OPPS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / privacy mode — keep working from in-memory state */
  }
}

/** A snooze counts as "active" only while its `until` is still in the future. */
function isStatusActive(entry: OppStatusEntry, now: number): boolean {
  if (entry.status === 'snoozed') return typeof entry.until === 'number' && entry.until > now;
  return true;
}

/**
 * Mirrors the persisted status map in React state so clicks reflect instantly.
 * Reads localStorage once on mount (SSR-safe: empty map until then), writes back
 * on every mutation, and listens for cross-tab/board changes so the two screens
 * stay in lock-step.
 */
function useOppStatuses() {
  const [statuses, setStatuses] = useState<OppStatusMap>({});

  useEffect(() => {
    setStatuses(readOppStatuses());
    const onStorage = (e: StorageEvent) => {
      if (e.key === OPPS_STORAGE_KEY) setStatuses(readOppStatuses());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const markDone = useCallback((id: string) => {
    setStatuses((prev) => {
      const next: OppStatusMap = { ...prev, [id]: { status: 'done' } };
      writeOppStatuses(next);
      return next;
    });
  }, []);

  const clearStatus = useCallback((id: string) => {
    setStatuses((prev) => {
      if (!(id in prev)) return prev;
      const next: OppStatusMap = { ...prev };
      delete next[id];
      writeOppStatuses(next);
      return next;
    });
  }, []);

  return { statuses, markDone, clearStatus };
}

export default function ActionCenterPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const headFont = isHe ? serifHe : serif;

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [items, setItems] = useState<MenuEngineeringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const [oppsRes, engRes] = await Promise.all([
        fetch('/api/analytics/opportunities', { cache: 'no-store' }),
        fetch('/api/analytics/menu-engineering', { cache: 'no-store' }),
      ]);

      const oppsJson: { success: boolean; data?: { opportunities: Opportunity[] } } = await oppsRes.json();
      if (oppsJson.success && oppsJson.data) {
        setOpportunities(oppsJson.data.opportunities);
        setError(false);
      } else if (initial) {
        setError(true);
      }

      // Menu-engineering powers the ₪ estimates; a failure here just drops upside numbers.
      try {
        const engJson: { success: boolean; data?: { items: MenuEngineeringItem[] } } = await engRes.json();
        setItems(engJson.success && engJson.data ? engJson.data.items : []);
      } catch {
        setItems([]);
      }
    } catch {
      if (initial) setError(true);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const id = window.setInterval(() => void load(false), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Achievable target from the menu's OWN medians (never fabricated) + a slug→item lookup.
  const bench = useMemo(() => buildMenuBenchmark(items), [items]);
  const itemBySlug = useMemo(() => new Map(items.map((it) => [it.slug, it])), [items]);

  // Only buildActions output is rendered — its value is already an honest, labeled estimate.
  const actions = useMemo(
    () => buildActions(opportunities, itemBySlug, bench),
    [opportunities, itemBySlug, bench],
  );

  const { statuses, markDone, clearStatus } = useOppStatuses();
  const now = Date.now();

  // The focus is the TOP 3 actions; within those, split open vs. already done today.
  const { focusOpen, focusDone } = useMemo(() => {
    const top = actions.slice(0, FOCUS_COUNT);
    const open: CoachAction[] = [];
    const done: CoachAction[] = [];
    for (const a of top) {
      const entry = statuses[a.id];
      if (entry && isStatusActive(entry, now)) done.push(a);
      else open.push(a);
    }
    return { focusOpen: open, focusDone: done };
  }, [actions, statuses, now]);

  const hasAnyFocus = focusOpen.length > 0 || focusDone.length > 0;
  const allDone = hasAnyFocus && focusOpen.length === 0;

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
      <div className="flex flex-col gap-8" dir={isHe ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel icon={Sparkles}>{isHe ? 'הפוקוס של היום' : "Today's focus"}</SectionLabel>
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
            {!hasAnyFocus && <EmptyState isHe={isHe} />}

            {allDone && <AllDoneState isHe={isHe} headFont={headFont} />}

            {focusOpen.length > 0 && (
              <div className="flex flex-col gap-6">
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
                      onDone={() => markDone(action.id)}
                    />
                  );
                })}
              </div>
            )}

            {focusDone.length > 0 && (
              <DoneTodaySection
                actions={focusDone}
                lang={lang}
                isHe={isHe}
                headFont={headFont}
                onUndo={(id) => clearStatus(id)}
              />
            )}
          </>
        )}
      </div>
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
  onDone: () => void;
}

function ActionRow({ action, rank, lang, isHe, headFont, onDone }: ActionRowProps) {
  const cocktail = findCocktailBySlug(action.slug);
  const accent = getAccent(action.slug);
  const Arrow = isHe ? ArrowLeft : ArrowRight;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-3xl border bg-white/[0.02] p-6 md:p-7"
      style={{ borderColor: `${accent}33` }}
    >
      <span
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
        aria-hidden
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        {/* Rank numeral */}
        <span
          className="shrink-0 leading-none text-white/15 select-none"
          style={{ fontFamily: serif, fontWeight: 700, fontSize: 'clamp(3rem, 8vw, 5rem)' }}
          aria-hidden
        >
          {rank}
        </span>

        {/* Big glass */}
        <div className="shrink-0 self-center">
          {cocktail ? (
            <GlassImage
              src={cocktail.heroImage}
              accent={accent}
              className="h-36 w-36 md:h-40 md:w-40 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-36 w-36 place-items-center rounded-2xl border border-white/10 bg-white/[0.02] md:h-40 md:w-40">
              <Sparkles size={26} className="text-white/20" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <h3
            className="text-white/95 leading-tight"
            style={{
              fontFamily: headFont,
              fontStyle: isHe ? 'normal' : 'italic',
              fontWeight: 600,
              fontSize: 'clamp(1.35rem, 3vw, 1.9rem)',
            }}
          >
            {action.title[lang]}
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70"
              style={{ fontFamily: sans }}
            >
              <Clock size={13} strokeWidth={1.9} />
              {isHe ? `~${action.effortMin} דק'` : `~${action.effortMin} min`}
            </span>
            <ConfidenceMeter pct={action.confidencePct} lang={lang} />
          </div>

          <div className="max-w-sm">
            <PotentialValue potential={action.potential} lang={lang} accent={accent} size="md" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-3 md:w-44">
          <Link
            href={action.executeHref}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-medium text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ background: accent, fontFamily: sans }}
          >
            {action.executeLabel[lang]}
            <Arrow size={15} strokeWidth={2.2} />
          </Link>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-[13px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            style={{ fontFamily: sans }}
          >
            <Check size={15} strokeWidth={2.2} style={{ color: '#34d399' }} />
            {isHe ? 'בוצע' : 'Done'}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/* ── Done today (collapsed) ────────────────────────────────────────────────── */

interface DoneTodaySectionProps {
  actions: CoachAction[];
  lang: 'en' | 'he';
  isHe: boolean;
  headFont: string;
  onUndo: (id: string) => void;
}

function DoneTodaySection({ actions, lang, isHe, headFont, onUndo }: DoneTodaySectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-3xl px-5 py-4 text-start transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      >
        <span className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-white/70" style={{ fontFamily: sans }}>
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
                  <span className="truncate text-[14px] text-white/80" style={{ fontFamily: headFont }}>
                    {title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUndo(a.id)}
                  aria-label={isHe ? 'החזר' : 'Undo'}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
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
        {isHe ? 'כל הכבוד — סיימת להיום' : "Nice — you're done for today"}
      </h3>
      <p className="mx-auto mt-3 max-w-md text-[14px] text-white/50" style={{ fontFamily: sans }}>
        {isHe ? 'חזרו מחר לפעולות חדשות, או פתחו את הפעולות שבוצעו למטה.' : 'Come back tomorrow for fresh actions, or reopen what you did below.'}
      </p>
    </section>
  );
}

function EmptyState({ isHe }: { isHe: boolean }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
      <p className="text-sm italic text-white/45" style={{ fontFamily: sans }}>
        {isHe ? 'אין פעולות פתוחות — אספו עוד תנועה.' : 'Nothing to do — collect more traffic.'}
      </p>
    </section>
  );
}

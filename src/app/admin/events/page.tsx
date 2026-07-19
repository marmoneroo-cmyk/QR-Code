'use client';

import { useCallback, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eye, Heart, Share2, ShoppingBag, MousePointerClick, Target, ShieldCheck, ShieldAlert, Activity, Fingerprint, Hash, Pause, Play, ListFilter } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { KpiCard, SectionLabel, GlassImage, Skeleton, LiveDot } from '@/components/ui/dataviz';
import { GlassCard, EmptyState } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { motion } from 'framer-motion';
import { useLang } from '@/lib/useLang';
import { eventTypeLabel } from '@/lib/tracking/eventLabels';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import type { IntegrityReport, RawEvent, RawEventsResult } from '@/lib/analytics/types';
import { useApiData } from '@/lib/data/useApiData';

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function ago(iso: string, isHebrew: boolean): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const unit = (en: string, he: string) => (isHebrew ? he : en);
  if (secs < 60) return `${secs}${unit('s', 'שנ׳')}`;
  if (secs < 3600) return `${Math.round(secs / 60)}${unit('m', 'דק׳')}`;
  if (secs < 86400) return `${Math.round(secs / 3600)}${unit('h', 'שע׳')}`;
  return `${Math.round(secs / 86400)}${unit('d', 'י׳')}`;
}

/** Visual identity per event type — icon + accent color for color-coding the feed. */
interface TypeStyle {
  icon: LucideIcon;
  color: string;
  en: string;
  he: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  view: { icon: Eye, color: '#7dd3fc', en: 'View', he: 'צפייה' },
  open: { icon: MousePointerClick, color: '#a78bfa', en: 'Open', he: 'פתיחה' },
  favorite: { icon: Heart, color: '#fb7185', en: 'Favorite', he: 'מועדף' },
  intent: { icon: Target, color: '#fbbf24', en: 'Intent', he: 'כוונה' },
  share: { icon: Share2, color: '#34d399', en: 'Share', he: 'שיתוף' },
  order: { icon: ShoppingBag, color: '#f59e0b', en: 'Order', he: 'הזמנה' },
};

const FALLBACK_STYLE: TypeStyle = { icon: Activity, color: 'rgba(255,255,255,0.6)', en: 'Event', he: 'אירוע' };

function styleFor(name: string | null): TypeStyle {
  if (!name) return FALLBACK_STYLE;
  return TYPE_STYLES[name] ?? FALLBACK_STYLE;
}

/**
 * Hebrew display labels for the integrity-rule names emitted by the analytics
 * layer (queries.ts). Display-only — the English `name` stays the lookup key, so
 * an unknown / future rule passes through unchanged in either language.
 */
const INTEGRITY_RULE_HE: Record<string, string> = {
  'Orders ≤ Opens': 'הזמנות ≤ פתיחות',
  'Ingredients ≤ Opens': 'מרכיבים ≤ פתיחות',
  '360/AR ≤ Opens': '360/AR ≤ פתיחות',
  'Called waiter ≤ Opens': 'קריאות מלצר ≤ פתיחות',
  'Units ≥ Orders': 'יחידות ≥ הזמנות',
};

function integrityRuleLabel(name: string, isHebrew: boolean): string {
  if (!isHebrew) return name;
  return INTEGRITY_RULE_HE[name] ?? name;
}

/** Pills summarizing per-type counts, only for the canonical types we have icons for. */
const PILL_ORDER = ['view', 'open', 'favorite', 'intent', 'share', 'order'] as const;

export default function EventInspectorPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const [eventFilter, setEventFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  /** Client-side feed filter: which event types are toggled on (empty = show all). */
  const [selectedTypes, setSelectedTypes] = useState<ReadonlySet<string>>(() => new Set());
  /** Live-tail: when true, the auto-refresh poll AND focus revalidation are suspended. */
  const [paused, setPaused] = useState(false);

  // The raw-events key carries the filters, so SWR refetches whenever they change — no effect.
  // Pause gates both the 12s poll and focus revalidation; both endpoints share that cadence.
  const params = new URLSearchParams();
  if (eventFilter) params.set('event', eventFilter);
  if (sessionFilter) params.set('session', sessionFilter.trim());
  params.set('limit', '200');
  const swrOpts = { refreshInterval: paused ? 0 : 12000, revalidateOnFocus: !paused };

  const { data: raw, loading, reload: reloadRaw } = useApiData<RawEventsResult>(
    `/api/events/raw?${params.toString()}`,
    swrOpts,
  );
  const { data: integrity, reload: reloadIntegrity } = useApiData<IntegrityReport>(
    '/api/events/integrity',
    swrOpts,
  );
  const load = useCallback(() => {
    reloadRaw();
    reloadIntegrity();
  }, [reloadRaw, reloadIntegrity]);

  const events: RawEvent[] = useMemo(() => raw?.events ?? [], [raw]);

  /** Multi-select chip toggle — immutable Set update (none selected = show all). */
  const toggleType = useCallback((name: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  /** The feed, narrowed by the toggled chips. Client-side only — fetch is unchanged. */
  const visibleEvents: RawEvent[] = useMemo(() => {
    if (selectedTypes.size === 0) return events;
    return events.filter((e) => e.event_name != null && selectedTypes.has(e.event_name));
  }, [events, selectedTypes]);

  /** Derived health summary from the events currently in view. */
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    const sessions = new Set<string>();
    for (const e of events) {
      if (e.event_name) counts[e.event_name] = (counts[e.event_name] ?? 0) + 1;
      if (e.session_id) sessions.add(e.session_id);
    }
    return { counts, uniqueSessions: sessions.size };
  }, [events]);

  /** Event types present in view, canonical-ordered first, then any extras — drives the chips. */
  const chipTypes: string[] = useMemo(() => {
    const canonical = PILL_ORDER.filter((k) => (summary.counts[k] ?? 0) > 0);
    const extra = Object.keys(summary.counts).filter(
      (k) => !PILL_ORDER.includes(k as (typeof PILL_ORDER)[number]),
    );
    return [...canonical, ...extra];
  }, [summary]);

  const checks = integrity?.checks ?? [];
  const passedChecks = checks.filter((c) => c.passed).length;
  const validPct = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : null;
  const allPassed = integrity?.allPassed ?? false;

  return (
    <AdminShell
      title="Event Inspector"
      titleHe="בוחן אירועים"
      eyebrow="Raw data · integrity"
      eyebrowHe="נתונים גולמיים · תקינות"
      active="/admin/events"
      subtitle="The ground truth: every captured event, plus automatic integrity checks. When a number looks wrong, verify it here before trusting any chart."
      subtitleHe="האמת הגולמית: כל אירוע שנקלט, יחד עם בדיקות תקינות אוטומטיות. כשמספר נראה לא נכון — אמת אותו כאן לפני שתסמוך על גרף."
      actions={
        <span className="inline-flex items-center gap-3">
          <LiveDot
            label={paused ? t('Paused', 'מושהה') : t('Live', 'חי')}
            accent={paused ? 'rgba(255,255,255,0.35)' : '#34d399'}
          />
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            aria-label={paused ? t('Resume live updates', 'חידוש עדכונים חיים') : t('Pause live updates', 'השהיית עדכונים חיים')}
            title={paused ? t('Resume', 'חידוש') : t('Pause', 'השהיה')}
            className="grid place-items-center w-7 h-7 rounded-lg border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white"
          >
            {paused ? <Play size={13} strokeWidth={2} /> : <Pause size={13} strokeWidth={2} />}
          </button>
          <span className="text-white/70 text-10 tracking-[0.3em] uppercase font-sans">
            {integrity ? t(`${integrity.totalEvents} events`, `${integrity.totalEvents} אירועים`) : ''}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-10" dir={isHebrew ? 'rtl' : 'ltr'}>
        {/* KPI strip — event health at a glance */}
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <motion.div variants={staggerItem}>
            <KpiCard
              label={t('Total events', 'סך אירועים')}
              value={(integrity?.totalEvents ?? events.length).toLocaleString()}
              accent="#7dd3fc"
              icon={Activity}
              hint={t('captured all-time', 'נקלטו בסך הכל')}
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <KpiCard
              label={t('Unique sessions', 'סשנים ייחודיים')}
              value={summary.uniqueSessions.toLocaleString()}
              accent="#a78bfa"
              icon={Fingerprint}
              hint={t('in current view', 'בתצוגה הנוכחית')}
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <KpiCard
              label={t('Integrity', 'תקינות')}
              value={validPct === null ? '—' : `${validPct}%`}
              accent={allPassed ? '#34d399' : '#fb7185'}
              icon={allPassed ? ShieldCheck : ShieldAlert}
              hint={checks.length > 0 ? t(`${passedChecks}/${checks.length} checks pass`, `${passedChecks}/${checks.length} בדיקות עברו`) : t('checking…', 'בודק…')}
            />
          </motion.div>
          <motion.div variants={staggerItem}>
            <KpiCard
              label={t('Shown', 'מוצגים')}
              value={visibleEvents.length.toLocaleString()}
              accent="#e8c987"
              icon={Hash}
              hint={
                selectedTypes.size > 0
                  ? t(`filtered of ${events.length}`, `מסונן מתוך ${events.length}`)
                  : t('latest 200 events', '200 אירועים אחרונים')
              }
            />
          </motion.div>
        </Stagger>

        {/* Per-type breakdown — interactive toggle chips that filter the feed */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <SectionLabel icon={ListFilter}>{t('Filter by type', 'סינון לפי סוג')}</SectionLabel>
            {selectedTypes.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTypes(new Set())}
                className="text-white/45 hover:text-white/80 text-10 tracking-[0.3em] uppercase transition-colors font-sans"
              >
                {t(`clear (${selectedTypes.size})`, `נקה (${selectedTypes.size})`)}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {chipTypes.map((k) => {
              const s = styleFor(k);
              const Icon = s.icon;
              const active = selectedTypes.has(k);
              const accent = TYPE_STYLES[k]?.color ?? 'rgba(255,255,255,0.6)';
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleType(k)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors font-sans"
                  style={{
                    color: active ? '#0b0b0f' : accent,
                    background: active ? accent : 'rgba(255,255,255,0.04)',
                    borderColor: active ? accent : 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
                  {eventTypeLabel(k, lang)} · {summary.counts[k]}
                </button>
              );
            })}
            {chipTypes.length === 0 &&
              (loading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)
              ) : (
                <span className="text-white/70 text-xs font-sans">
                  {t('No events in view.', 'אין אירועים בתצוגה.')}
                </span>
              ))}
          </div>
        </section>

        {/* Data Integrity Validator */}
        <section>
          <SectionLabel icon={allPassed ? ShieldCheck : ShieldAlert}>{t('Data integrity validator', 'מאמת תקינות נתונים')}</SectionLabel>
          <GlassCard
            static
            accent={allPassed ? '#34d399' : '#fb7185'}
            className={`p-6 ${allPassed ? 'border-emerald-300/25 bg-emerald-950/10' : 'border-rose-400/30 bg-rose-950/15'}`}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-11 tracking-wider uppercase font-sans"
                style={{ color: allPassed ? 'var(--success-soft)' : 'var(--critical-light)' }}
              >
                {allPassed ? <ShieldCheck size={14} strokeWidth={2} /> : <ShieldAlert size={14} strokeWidth={2} />}
                {integrity ? (allPassed ? t('all checks pass', 'כל הבדיקות עברו') : t('violations found', 'נמצאו הפרות')) : t('checking…', 'בודק…')}
              </span>
              {validPct !== null && (
                <span className="text-11 font-sans" style={{ color: allPassed ? 'var(--success-soft)' : 'var(--critical-light)' }}>
                  {validPct}% {t('valid', 'תקין')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {checks.map((c) => (
                <span
                  key={c.name}
                  className={`font-sans inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-11 ${
                    c.passed ? 'text-emerald-200/90 border border-emerald-300/30' : 'text-rose-200 border border-rose-400/50'
                  }`}
                >
                  {c.passed ? <ShieldCheck size={12} strokeWidth={2} /> : <ShieldAlert size={12} strokeWidth={2} />} {integrityRuleLabel(c.name, isHebrew)}
                </span>
              ))}
            </div>
            {integrity && integrity.issues.length > 0 && (
              <div className="mt-4 space-y-1">
                {integrity.issues.slice(0, 12).map((iss, i) => (
                  <p key={i} className="text-rose-200/90 text-xs" style={{ fontFamily: mono }} dir="ltr">
                    {iss.slug} · {iss.rule} → {iss.detail}
                  </p>
                ))}
              </div>
            )}
          </GlassCard>
        </section>

        {/* Filters */}
        <section className="flex flex-wrap items-center gap-3">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            aria-label={t('Event type', 'סוג אירוע')}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white/80 text-sm font-sans"
          >
            <option value="">{t('All events', 'כל האירועים')}</option>
            {(raw?.eventNames ?? []).map((n) => (
              <option key={n} value={n}>
                {eventTypeLabel(n, lang)}
              </option>
            ))}
          </select>
          <input
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            placeholder={t('filter by session id…', 'סינון לפי session id…')}
            aria-label={t('filter by session id…', 'סינון לפי session id…')}
            className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white/80 text-sm flex-1 min-w-[200px]"
            style={{ fontFamily: mono }}
            dir="ltr"
          />
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 rounded-lg border border-amber-200/40 hover:border-amber-200/80 text-amber-100 text-10 tracking-[0.3em] uppercase font-sans"
          >
            {t('refresh', 'רענון')}
          </button>
        </section>

        {/* Event stream — clean color-coded feed, no horizontal scroll */}
        <section>
          <SectionLabel icon={Activity}>{t('Live event stream', 'זרם אירועים חי')}</SectionLabel>
          <GlassCard static className="overflow-x-auto p-3">
          <ul className="flex flex-col gap-1.5">
            {visibleEvents.map((e) => {
              const s = styleFor(e.event_name);
              const Icon = s.icon;
              const cocktail = e.cocktail_slug ? findCocktailBySlug(e.cocktail_slug) : undefined;
              const accent = e.cocktail_slug ? getAccent(e.cocktail_slug) : s.color;
              const label = cocktail ? cocktail.title[lang] : e.cocktail_slug ?? null;
              return (
                <li
                  key={e.id}
                  className="group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 hover:border-white/15 hover:bg-white/[0.03] transition-colors"
                  style={{ borderInlineStartColor: `${s.color}55`, borderInlineStartWidth: 2 }}
                >
                  {/* Type icon chip */}
                  <span className="grid place-items-center w-8 h-8 shrink-0 rounded-lg" style={{ color: s.color, background: `${s.color}1a` }}>
                    <Icon size={15} strokeWidth={1.9} />
                  </span>

                  {/* Optional cocktail thumbnail */}
                  {cocktail && (
                    <GlassImage src={cocktail.heroImage} accent={accent} className="w-9 h-9 shrink-0 rounded-lg" />
                  )}

                  {/* Type + item label */}
                  <div className="min-w-0 flex-1">
                    <p className="text-13 leading-tight truncate font-sans" style={{ color: s.color }}>
                      {e.event_name ? eventTypeLabel(e.event_name, lang) : t(s.en, s.he)}
                      {label && <span className="text-white/70"> · {label}</span>}
                    </p>
                    <p className="text-white/70 text-10 truncate" style={{ fontFamily: mono }} dir="ltr">
                      {e.event_name ? `${e.event_name} · ` : ''}
                      {(e.session_id ?? '—').slice(0, 12)}
                      {e.table_id ? ` · ${e.table_id}` : ''}
                      {e.value_num != null ? ` · ${e.value_num}` : ''}
                    </p>
                  </div>

                  {/* Relative time */}
                  <span className="shrink-0 text-white/70 text-11 tabular-nums" style={{ fontFamily: mono }} dir="ltr">
                    {ago(e.created_at, isHebrew)}
                  </span>
                </li>
              );
            })}
            {visibleEvents.length === 0 &&
              (loading && events.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5"
                  >
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="mb-1.5 h-3 w-2/5" />
                      <Skeleton className="h-2.5 w-3/5" />
                    </div>
                    <Skeleton className="h-3 w-8 shrink-0" />
                  </li>
                ))
              ) : (
                <li>
                  <EmptyState title={t('No events match.', 'אין אירועים תואמים.')} />
                </li>
              ))}
          </ul>
          </GlassCard>
        </section>

        <p className="text-center text-white/70 text-10 tracking-[0.4em] uppercase pt-6 mt-2 border-t border-white/10 font-sans">
          {t('Showing latest 200 events · all metrics count UNIQUE sessions', 'מציג 200 אירועים אחרונים · כל המדדים סופרים sessions ייחודיים')}
        </p>
      </div>
    </AdminShell>
  );
}

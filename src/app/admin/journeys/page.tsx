'use client';

import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  QrCode,
  Share2,
  Link2,
  Smartphone,
  Monitor,
  Tablet,
  Clock,
  Eye,
  FlaskConical,
  Heart,
  ShoppingBag,
  Languages,
  DoorOpen,
  BookOpen,
  PhoneCall,
  Footprints,
  ChevronRight,
  Filter,
  BadgeCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { CountUpText, GlassImage, KpiCard, LiveDot, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { GlassCard, EmptyState } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { HoverLift, AccentWash } from '@/components/ui/visual';
import { useLang } from '@/lib/useLang';
import { deviceLabel } from '@/lib/tracking/eventLabels';
import type { JourneyStep, SessionJourney, SessionJourneys } from '@/lib/analytics/journey-types';
import { formatILS } from '@/lib/format';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

const STEP_LABEL: Record<string, { en: string; he: string }> = {
  menu_opened: { en: 'Opened menu', he: 'פתח תפריט' },
  menu_closed: { en: 'Left menu', he: 'עזב תפריט' },
  menu_shared: { en: 'Shared menu', he: 'שיתף תפריט' },
  language_changed: { en: 'Changed language', he: 'החליף שפה' },
  cocktail_impression: { en: 'Saw card', he: 'ראה כרטיס' },
  cocktail_opened: { en: 'Viewed', he: 'צפה ב' },
  cocktail_scrolled_to: { en: 'Scrolled to', he: 'גלל אל' },
  cocktail_fully_viewed: { en: 'Lingered on', he: 'התעכב על' },
  cocktail_shared: { en: 'Shared', he: 'שיתף' },
  cocktail_favorited: { en: 'Favorited', he: 'סימן מועדף' },
  cocktail_dwell: { en: 'Lingered on', he: 'התעכב על' },
  cocktail_scroll_depth: { en: 'Scrolled through', he: 'גלל דרך' },
  section_attention: { en: 'Focused on', he: 'התמקד ב' },
  cocktail_video_opened: { en: 'Watched video', he: 'צפה בווידאו' },
  ingredients_opened: { en: 'Opened ingredients', he: 'פתח מרכיבים' },
  ar_opened: { en: 'Opened AR', he: 'פתח AR' },
  '360_opened': { en: 'Opened 360°', he: 'פתח 360°' },
  call_waiter_clicked: { en: 'Called waiter', he: 'קרא למלצר' },
  add_to_order_clicked: { en: 'Added to order', he: 'הוסיף להזמנה' },
  order_started: { en: 'Started order', he: 'התחיל הזמנה' },
  order_completed: { en: 'Ordered', he: 'הזמין' },
  reservation_clicked: { en: 'Reservation', he: 'הזמנת מקום' },
  phone_clicked: { en: 'Called', he: 'התקשר' },
  whatsapp_clicked: { en: 'WhatsApp', he: 'וואטסאפ' },
  experiment_exposure: { en: 'Experiment', he: 'ניסוי' },
};

/** Small icon per event family — keeps the step row visual, not textual. */
function stepIcon(event: string): LucideIcon {
  if (event.startsWith('cocktail_fav') || event === 'cocktail_favorited') return Heart;
  if (event === 'ingredients_opened') return FlaskConical;
  if (event === 'language_changed') return Languages;
  if (event === 'menu_closed') return DoorOpen;
  if (event === 'menu_opened') return BookOpen;
  if (event.includes('shared')) return Share2;
  if (event.includes('order') || event === 'add_to_order_clicked') return ShoppingBag;
  if (event === 'call_waiter_clicked' || event === 'phone_clicked' || event === 'whatsapp_clicked') return PhoneCall;
  return Eye;
}

const SOURCE_META: Record<string, { icon: LucideIcon; en: string; he: string; accent: string }> = {
  qr: { icon: QrCode, en: 'QR scan', he: 'סריקת QR', accent: '#fbbf24' },
  share: { icon: Share2, en: 'Shared link', he: 'קישור משותף', accent: '#34d399' },
  direct: { icon: Link2, en: 'Direct', he: 'ישיר', accent: '#7dd3fc' },
};

function sourceMeta(source: string | null): { icon: LucideIcon; en: string; he: string; accent: string } {
  return SOURCE_META[source ?? ''] ?? { icon: Link2, en: source ?? 'Unknown', he: source ?? 'לא ידוע', accent: '#a1a1aa' };
}

function deviceIcon(device: string | null): LucideIcon {
  const d = (device ?? '').toLowerCase();
  if (d.includes('tablet') || d.includes('ipad')) return Tablet;
  if (d.includes('desktop') || d.includes('mac') || d.includes('windows')) return Monitor;
  return Smartphone;
}

function clock(iso: string): string {
  const d = new Date(iso);
  const p = (n: number): string => n.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function duration(ms: number, isHebrew: boolean): string {
  const mins = Math.round(ms / 60000);
  const m = isHebrew ? 'ד' : 'm';
  const h = isHebrew ? 'ש' : 'h';
  if (mins < 1) return `<1${m}`;
  if (mins < 60) return `${mins}${m}`;
  return `${Math.floor(mins / 60)}${h} ${mins % 60}${m}`;
}

/** Distinct cocktail slugs touched in a session, in first-seen order. */
function viewedSlugs(session: SessionJourney): string[] {
  const seen = new Set<string>();
  for (const step of session.steps) {
    if (step.cocktailSlug && !seen.has(step.cocktailSlug)) seen.add(step.cocktailSlug);
  }
  return [...seen];
}

/* ─────────────────────────────────────────────────────────────────────────
   AGGREGATE FUNNEL — the canonical guest flow, computed from real sessions.
   Each stage owns a set of real event keys. A session "reaches" a stage if it
   fired any event belonging to that stage OR to a later stage (cumulative, so
   counts are monotonically non-increasing — a true funnel).
   ───────────────────────────────────────────────────────────────────────── */

interface FunnelStage {
  /** Stable key for React + ordering. */
  key: string;
  en: string;
  he: string;
  icon: LucideIcon;
  accent: string;
  /** Event keys (from STEP_LABEL) that satisfy this stage. */
  events: string[];
}

const FUNNEL_STAGES: readonly FunnelStage[] = [
  {
    key: 'opened',
    en: 'Menu opened',
    he: 'תפריט נפתח',
    icon: BookOpen,
    accent: '#fbbf24',
    events: ['menu_opened'],
  },
  {
    key: 'cocktail',
    en: 'Cocktail opened',
    he: 'קוקטייל נפתח',
    icon: Eye,
    accent: '#7dd3fc',
    events: ['cocktail_opened', 'cocktail_scrolled_to', 'cocktail_fully_viewed', 'cocktail_video_opened'],
  },
  {
    key: 'interest',
    en: 'Ingredients / interest',
    he: 'מרכיבים / עניין',
    icon: FlaskConical,
    accent: '#a78bfa',
    events: ['ingredients_opened', 'cocktail_dwell', 'cocktail_scroll_depth', 'section_attention', 'ar_opened', '360_opened', 'cocktail_favorited'],
  },
  {
    key: 'intent',
    en: 'Order intent',
    he: 'כוונת הזמנה',
    icon: ShoppingBag,
    accent: '#fb923c',
    events: ['add_to_order_clicked', 'order_started'],
  },
  {
    key: 'completed',
    en: 'Order completed',
    he: 'הזמנה הושלמה',
    icon: BadgeCheck,
    accent: '#34d399',
    events: ['order_completed'],
  },
] as const;

interface FunnelNode {
  stage: FunnelStage;
  /** Sessions that reached this stage (cumulative). */
  count: number;
  /** % of total sessions that reached this stage. */
  pctOfTotal: number;
  /** % lost between the previous stage and this one (null for the first stage). */
  dropPct: number | null;
}

/**
 * Build the cumulative funnel from real sessions. Walk stages from last to
 * first so a session that reaches a deep stage is correctly credited to every
 * earlier stage too (monotonic, non-fabricated).
 */
function computeFunnel(sessions: readonly SessionJourney[]): FunnelNode[] {
  const total = sessions.length;

  // Precompute, per stage, the set of events that satisfy it OR any later stage.
  const cumulativeEvents: Set<string>[] = [];
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) {
    const later = cumulativeEvents[0] ?? new Set<string>();
    const here = new Set<string>(later);
    for (const e of FUNNEL_STAGES[i].events) here.add(e);
    cumulativeEvents.unshift(here);
  }

  const counts = FUNNEL_STAGES.map((_, idx) => {
    const allowed = cumulativeEvents[idx];
    return sessions.reduce((acc, s) => (s.steps.some((step) => allowed.has(step.event)) ? acc + 1 : acc), 0);
  });

  return FUNNEL_STAGES.map((stage, idx) => {
    const count = counts[idx];
    const prev = idx > 0 ? counts[idx - 1] : null;
    const dropPct = prev !== null && prev > 0 ? Math.round(((prev - count) / prev) * 100) : prev === 0 ? 0 : null;
    return {
      stage,
      count,
      pctOfTotal: total > 0 ? Math.round((count / total) * 100) : 0,
      dropPct,
    };
  });
}

/** Warmer color the larger the drop-off (green = small, red = severe). Real %, honest scale. */
function dropColor(dropPct: number): string {
  if (dropPct <= 0) return '#34d399'; // no loss
  if (dropPct < 20) return '#a3e635'; // minor
  if (dropPct < 40) return '#fbbf24'; // notable
  if (dropPct < 60) return '#fb923c'; // heavy
  return '#f87171'; // severe
}

interface FunnelStepperProps {
  nodes: FunnelNode[];
  total: number;
  isHebrew: boolean;
  t: (en: string, he: string) => string;
}

/**
 * Horizontal funnel stepper that WRAPS to rows on small screens (flex-wrap,
 * never a side-scroller). Each node shows its count + % of sessions; each
 * connector between nodes shows the drop-off %, color-coded by severity.
 */
function FunnelStepper({ nodes, total, isHebrew, t }: FunnelStepperProps) {
  // RTL-aware arrow: flows toward the reading direction.
  const FlowArrow = ChevronRight;

  return (
    <section className="mb-8" dir={isHebrew ? 'rtl' : 'ltr'}>
      <SectionLabel icon={Filter}>{t('Guest path', 'מסע האורח')}</SectionLabel>

      <GlassCard className="p-5 sm:p-6" static>
        {/* flex-wrap = wraps to rows; no overflow-x anywhere */}
        <div className="flex flex-wrap items-stretch justify-center gap-y-4">
          {nodes.map((node, idx) => {
            const { stage, count, pctOfTotal, dropPct } = node;
            const Icon = stage.icon;
            const isLast = idx === nodes.length - 1;

            return (
              <div key={stage.key} className="flex items-stretch">
                {/* STAGE NODE */}
                <div className="flex flex-col items-center text-center w-[120px] sm:w-[132px] shrink-0">
                  <span
                    className="grid place-items-center w-12 h-12 rounded-2xl mb-2.5"
                    style={{ color: stage.accent, background: `${stage.accent}1a`, border: `1px solid ${stage.accent}40` }}
                  >
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <p
                    className="text-white text-22 leading-none"
                    style={{ fontFamily: serif, fontWeight: 700 }}
                  >
                    <CountUpText text={count.toLocaleString()} />
                  </p>
                  <p className="text-white/45 text-11 font-mono mt-1">
                    {pctOfTotal}%
                  </p>
                  <p
                    className="text-white/70 text-11 leading-tight mt-1.5 px-1"
                    style={{ fontFamily: sans }}
                  >
                    {isHebrew ? stage.he : stage.en}
                  </p>
                  {/* slim share-of-total bar — pure visual reinforcement of the % */}
                  <span className="mt-2 h-1 w-full max-w-[88px] overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pctOfTotal}%`, background: stage.accent, opacity: 0.7 }}
                    />
                  </span>
                </div>

                {/* CONNECTOR + DROP-OFF — sits between two nodes */}
                {!isLast && (
                  <div className="flex flex-col items-center justify-center px-1.5 sm:px-2.5 shrink-0 self-center">
                    <FlowArrow
                      size={18}
                      strokeWidth={2}
                      className={`text-white/25 shrink-0 ${isHebrew ? 'rotate-180' : ''}`}
                    />
                    {nodes[idx + 1].dropPct !== null && (
                      <span
                        className="mt-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-10 font-mono leading-none whitespace-nowrap"
                        style={{
                          color: dropColor(nodes[idx + 1].dropPct as number),
                          borderColor: `${dropColor(nodes[idx + 1].dropPct as number)}40`,
                          background: `${dropColor(nodes[idx + 1].dropPct as number)}12`,
                        }}
                        title={t('Drop-off to next stage', 'נשירה לשלב הבא')}
                      >
                        −{nodes[idx + 1].dropPct}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p
          className="text-white/70 text-10 tracking-[0.25em] uppercase text-center mt-5 pt-4 border-t border-white/10"
          style={{ fontFamily: sans }}
        >
          {t(
            `${total.toLocaleString()} sessions · real events`,
            `${total.toLocaleString()} ביקורים · אירועים אמיתיים`,
          )}
        </p>
      </GlassCard>
    </section>
  );
}

export function JourneysPanel() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, loading } = useApiData<SessionJourneys>('/api/sessions', { refreshInterval: 15000 });

  const titleBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of MENU) m.set(c.slug, c.title[lang]);
    return m;
  }, [lang]);

  const stepText = (s: JourneyStep): string => {
    const label = STEP_LABEL[s.event] ?? { en: s.event, he: s.event };
    const name = s.cocktailSlug ? titleBySlug.get(s.cocktailSlug) ?? s.cocktailSlug : '';
    const base = isHebrew ? label.he : label.en;
    const withItem = ['cocktail_opened', 'cocktail_fully_viewed', 'order_completed', 'ingredients_opened', 'cocktail_shared', 'ar_opened', '360_opened', 'cocktail_impression', 'cocktail_video_opened', 'cocktail_dwell', 'cocktail_scroll_depth', 'section_attention'];
    if (s.event === 'order_completed' && s.value) return `${base} ${name} ×${s.value}`;
    if (name && withItem.includes(s.event)) return `${base} ${name}`;
    return base;
  };

  const sessions = data?.sessions ?? [];

  // KPI strip — total sessions, avg steps, avg duration, share-sourced %.
  const kpis = useMemo(() => {
    const total = sessions.length;
    if (total === 0) return { total: 0, avgSteps: 0, avgDuration: '—', sharePct: 0 };
    const stepsSum = sessions.reduce((acc, s) => acc + s.steps.length, 0);
    const durationSum = sessions.reduce((acc, s) => acc + s.durationMs, 0);
    const shared = sessions.filter((s) => s.source === 'share').length;
    return {
      total,
      avgSteps: Math.round(stepsSum / total),
      avgDuration: duration(Math.round(durationSum / total), isHebrew),
      sharePct: Math.round((shared / total) * 100),
    };
  }, [sessions, isHebrew]);

  // Aggregate journey funnel — cumulative reach per canonical stage, real events only.
  const funnel = useMemo(() => computeFunnel(sessions), [sessions]);

  // Most-touched drinks across all sessions — pure visual lead-in for the funnel.
  // Read-only derivation: ranks slugs by how many sessions touched them, takes top 8.
  const topSlugs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      for (const slug of viewedSlugs(s)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug)
      .filter((slug) => findCocktailBySlug(slug))
      .slice(0, 8);
  }, [sessions]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <LiveDot label={isHebrew ? 'חי' : 'Live'} />
      </div>

      {sessions.length === 0 && loading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div>
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="mt-2 h-2.5 w-32" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((__, j) => (
                  <Skeleton key={j} className="h-6 w-20 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && !loading && (
        <EmptyState title={t('No sessions captured yet.', 'עדיין לא נקלטו ביקורים.')} />
      )}

      {sessions.length > 0 && topSlugs.length > 0 && (
        <div className="mb-5 flex flex-wrap justify-center gap-3" dir={isHebrew ? 'rtl' : 'ltr'}>
          {topSlugs.map((slug) => {
            const c = findCocktailBySlug(slug);
            if (!c) return null;
            return (
              <GlassImage
                key={slug}
                src={c.heroImage}
                accent={getAccent(slug)}
                className="w-16 h-24 sm:w-[4.5rem] sm:h-28"
              />
            );
          })}
        </div>
      )}

      {sessions.length > 0 && (
        <FunnelStepper nodes={funnel} total={kpis.total} isHebrew={isHebrew} t={t} />
      )}

      {sessions.length > 0 && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8" dir={isHebrew ? 'rtl' : 'ltr'}>
          <KpiCard label={t('Sessions', 'ביקורים')} value={kpis.total.toLocaleString()} accent="#fbbf24" icon={Footprints} />
          <KpiCard label={t('Avg steps', 'צעדים בממוצע')} value={kpis.avgSteps.toString()} accent="#7dd3fc" icon={Eye} />
          <KpiCard label={t('Avg duration', 'משך ממוצע')} value={kpis.avgDuration} accent="#a78bfa" icon={Clock} />
          <KpiCard label={t('Share-sourced', 'מקור שיתוף')} value={`${kpis.sharePct}%`} accent="#34d399" icon={Share2} />
        </section>
      )}

      <Stagger className="flex flex-col gap-4">
        {sessions.map((s) => {
          const open = openId === s.sessionId;
          const src = sourceMeta(s.source);
          const SrcIcon = src.icon;
          const DeviceIcon = deviceIcon(s.device);
          const slugs = viewedSlugs(s);

          // Accent wash uses the dominant drink when the session centers on one.
          const dominantAccent = slugs.length === 1 ? getAccent(slugs[0]) : src.accent;
          const singleDrink = slugs.length === 1;

          return (
            <motion.div key={s.sessionId} variants={staggerItem}>
            <HoverLift accent={dominantAccent} className="rounded-3xl">
            <div
              className="glass-panel relative overflow-hidden rounded-3xl"
              style={open ? { borderColor: `${dominantAccent}55` } : undefined}
            >
              {singleDrink && <AccentWash accent={dominantAccent} opacity={0.12} />}
              {/* HEADER — clean visual summary, not a raw log line */}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : s.sessionId)}
                className="relative w-full p-5 text-start hover:bg-white/[0.02] transition-colors rounded-3xl"
                dir={isHebrew ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  {/* identity: source + device */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="grid place-items-center w-10 h-10 rounded-xl shrink-0"
                      style={{ color: src.accent, background: `${src.accent}1a`, border: `1px solid ${src.accent}33` }}
                    >
                      <SrcIcon size={18} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-white/90 text-sm leading-tight" style={{ fontFamily: serif, fontWeight: 600 }}>
                        {isHebrew ? src.he : src.en}
                      </p>
                      <p className="flex items-center gap-1.5 text-white/70 text-11 mt-0.5" style={{ fontFamily: sans }}>
                        <DeviceIcon size={12} strokeWidth={1.8} />
                        {deviceLabel(s.device, lang) ?? t('device', 'מכשיר')}
                        {s.tableId && (
                          <span className="text-amber-200/70">· {t('Table', 'שולחן')} {s.tableId}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* facts: duration · steps · revenue */}
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-white/55 text-xs" style={{ fontFamily: sans }}>
                      <Clock size={13} strokeWidth={1.8} /> {duration(s.durationMs, isHebrew)}
                    </span>
                    <span className="text-white/70 text-xs" style={{ fontFamily: sans }}>
                      {s.steps.length} {t('steps', 'צעדים')}
                    </span>
                    {s.ordered ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300/90 text-13 font-mono">
                        <ShoppingBag size={13} strokeWidth={1.8} /> {formatILS(s.revenue)}
                      </span>
                    ) : (
                      <span className="text-white/20 text-13" aria-label={t('no order', 'ללא הזמנה')}>—</span>
                    )}
                    <span className="text-white/35 text-xs">{open ? '▾' : '▸'}</span>
                  </div>
                </div>

                {/* STEP CHIPS — horizontal row that WRAPS (no overflow-x) */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {s.steps.map((step, i) => {
                    const Icon = stepIcon(step.event);
                    const isOrder = step.event === 'order_completed';
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-10 max-w-full"
                        style={{
                          fontFamily: sans,
                          borderColor: isOrder ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)',
                          color: isOrder ? 'var(--success)' : 'rgba(255,255,255,0.7)',
                          background: isOrder ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <Icon size={11} strokeWidth={1.8} className="shrink-0" />
                        <span className="truncate">{stepText(step)}</span>
                      </span>
                    );
                  })}
                </div>

                {/* COCKTAIL THUMBNAILS — drink-forward, doubled size, wrap, never crop */}
                {slugs.length > 0 && (
                  <div className="flex flex-wrap gap-4 mt-5">
                    {slugs.map((slug) => {
                      const c = findCocktailBySlug(slug);
                      if (!c) return null;
                      return (
                        <div key={slug} className="flex flex-col items-center w-[5.5rem]">
                          <GlassImage src={c.heroImage} accent={getAccent(slug)} className="w-[5.5rem] h-28" />
                          <span className="text-white/55 text-10 text-center mt-1.5 leading-tight truncate w-full" style={{ fontFamily: sans }}>
                            {c.title[lang]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </button>

              {/* EXPANDED — full timeline + value summary */}
              {open && (
                <div className="px-6 pb-6 pt-1" dir={isHebrew ? 'rtl' : 'ltr'}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6 pb-5 border-b border-white/10">
                    {[
                      { label: t('Source', 'מקור'), value: isHebrew ? src.he : src.en },
                      { label: t('Started', 'התחיל'), value: clock(s.start) },
                      { label: t('Views', 'צפיות'), value: s.views },
                      { label: t('Ingredients', 'מרכיבים'), value: s.ingredients },
                      { label: t('Shares', 'שיתופים'), value: s.shares },
                      { label: t('Orders', 'הזמנות'), value: s.orders },
                      { label: t('Revenue', 'הכנסה'), value: formatILS(s.revenue), accent: true },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-white/70 text-9 tracking-[0.2em] uppercase mb-1" style={{ fontFamily: sans }}>
                          {m.label}
                        </p>
                        <p className={`text-sm font-mono ${m.accent ? 'text-emerald-200/90' : 'text-white/85'}`}>
                          {m.value}
                        </p>
                      </div>
                    ))}
                    {s.profit > 0 && (
                      <div>
                        <p className="text-white/70 text-9 tracking-[0.2em] uppercase mb-1" style={{ fontFamily: sans }}>
                          {t('Profit', 'רווח')}
                        </p>
                        <p className="text-sm font-mono text-emerald-300/90">{formatILS(s.profit)}</p>
                      </div>
                    )}
                  </div>

                  <SectionLabel icon={Footprints}>{t('Step by step', 'צעד אחר צעד')}</SectionLabel>
                  <ol className="relative border-s border-white/10 ms-2">
                    {s.steps.map((step, i) => {
                      const isOrder = step.event === 'order_completed';
                      const Icon = stepIcon(step.event);
                      return (
                        <li key={i} className="ms-5 pb-4 last:pb-0">
                          <span
                            className="absolute -start-[6.5px] mt-1 w-3 h-3 rounded-full border border-black"
                            style={{ backgroundColor: isOrder ? 'var(--success)' : 'var(--warning-light)' }}
                          />
                          <div className="flex items-baseline gap-3">
                            <span className="text-white/70 text-11 font-mono w-16 shrink-0">{clock(step.at)}</span>
                            <span className={`inline-flex items-center gap-1.5 text-sm ${isOrder ? 'text-emerald-200' : 'text-white/85'}`} style={{ fontFamily: sans }}>
                              <Icon size={13} strokeWidth={1.8} className="shrink-0 opacity-70" />
                              {stepText(step)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
            </HoverLift>
            </motion.div>
          );
        })}
      </Stagger>

      <p className="text-center text-white/70 text-10 tracking-[0.4em] uppercase pt-6 mt-8 border-t border-white/10" style={{ fontFamily: sans }}>
        {t('Latest 40 · anonymous', '40 אחרונים · אנונימי')}
      </p>
    </>
  );
}

export default function JourneysPage() {
  return (
    <AdminShell
      title="Journeys"
      titleHe="מסעות"
      eyebrow="Session Replay · lite"
      eyebrowHe="שחזור ביקור · קל"
      active="/admin/journeys"
      subtitle="Every visitor's exact path, step by step — opened menu → viewed → ingredients → shared → ordered. Anonymous, but more revealing than any single score."
      subtitleHe="המסלול המדויק של כל מבקר, צעד אחר צעד — פתח תפריט → צפה → מרכיבים → שיתף → הזמין. אנונימי, אך חושף יותר מכל ציון בודד."
    >
      <JourneysPanel />
    </AdminShell>
  );
}

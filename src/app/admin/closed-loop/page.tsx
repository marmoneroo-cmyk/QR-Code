'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  TrendingDown,
  Minus,
  Clock,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { HoverLift, AccentWash, BeforeAfterImage } from '@/components/ui/visual';
import { GlassCard, EmptyState, ErrorState } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { useLang } from '@/lib/useLang';
import type { ImpactStatus, MetricKey, Confidence } from '@/lib/closedloop/types';
import type { ClosedLoopItem, ClosedLoopReport } from '@/lib/closedloop/server';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

/** Visual treatment per measured-result status: icon, accent color, arrow glyph. */
interface StatusStyle {
  en: string;
  he: string;
  color: string;
  icon: LucideIcon;
}

const STATUS: Record<ImpactStatus, StatusStyle> = {
  success: { en: 'Worked', he: 'עבד', color: '#34d399', icon: CheckCircle2 },
  declined: { en: 'Declined', he: 'ירד', color: '#fb7185', icon: TrendingDown },
  no_effect: { en: 'No clear effect', he: 'אין השפעה ברורה', color: '#e7e5e4', icon: Minus },
  too_early: { en: 'Too early', he: 'מוקדם מדי', color: '#fbbf24', icon: Clock },
  insufficient_data: { en: 'Need more data', he: 'דרושים נתונים', color: '#fbbf24', icon: HelpCircle },
};

const CONF_PCT: Record<Confidence, number> = { high: 90, medium: 70, low: 50 };
const CONF_LABEL: Record<Confidence, { en: string; he: string }> = {
  high: { en: 'High confidence', he: 'ביטחון גבוה' },
  medium: { en: 'Medium confidence', he: 'ביטחון בינוני' },
  low: { en: 'Low confidence', he: 'ביטחון נמוך' },
};

const METRIC: Record<MetricKey, { en: string; he: string }> = {
  views: { en: 'Views', he: 'צפיות' },
  opens: { en: 'Opens', he: 'פתיחות' },
  favorites: { en: 'Favorites', he: 'מועדפים' },
  intent: { en: 'Intent', he: 'כוונה' },
  sales: { en: 'Sales', he: 'מכירות' },
  shares: { en: 'Shares', he: 'שיתופים' },
};

const inputCls =
  'bg-white/[0.04] border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:border-amber-200/50 focus:outline-none transition-colors';

export function ClosedLoopPanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);
  const { data, loading, error, reload } = useApiData<ClosedLoopReport>('/api/closed-loop');
  const load = reload;

  // manual external-change form
  const [summary, setSummary] = useState('');
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const titleBySlug = useMemo(() => new Map(MENU.map((c) => [c.slug, c.title])), []);

  const submitManual = async () => {
    if (!summary.trim()) {
      setMsg(isHe ? 'נדרש תיאור' : 'Description required');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summary.trim(), entityId: slug || undefined, date: date || undefined }),
      });
      const json: { success: boolean } = await res.json();
      if (json.success) {
        setSummary('');
        setSlug('');
        setDate('');
        setMsg(isHe ? 'נרשם ✓' : 'Logged ✓');
        await load();
      } else {
        setMsg(isHe ? 'השמירה נכשלה — נסו שוב' : 'Could not save — try again');
      }
    } catch {
      setMsg(isHe ? 'השמירה נכשלה — נסו שוב' : 'Could not save — try again');
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (iso: string): string => iso.slice(0, 10);

  return (
    <>
      <div className="flex flex-col gap-12" dir={isHe ? 'rtl' : 'ltr'}>
        {loading && (
          <section>
            <Skeleton className="mb-4 h-3 w-44 rounded-full" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-3xl" />
              ))}
            </div>
          </section>
        )}

        {/* Measured results */}
        {!loading && (
          <section>
            <SectionLabel icon={CheckCircle2}>{t('Measured results', 'תוצאות נמדדות')}</SectionLabel>

            {error && (
              <ErrorState
                title={t('Couldn’t load — check your connection', 'טעינה נכשלה — בדקו את החיבור')}
                onRetry={load}
                retryLabel={t('Try again', 'נסו שוב')}
              />
            )}

            {!error && (!data || data.measured.length === 0) && (
              <EmptyState
                title={t(
                  'No measurable changes yet. Make a change (promotion/experience) or log an external one below.',
                  'אין עדיין שינויים מדידים. בצעו פעולה (מבצע/חוויה) או רשמו שינוי חיצוני למטה.'
                )}
              />
            )}

            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.measured.map((m: ClosedLoopItem) => (
                <motion.div key={m.change.id} variants={staggerItem}>
                  <ResultCard item={m} lang={lang} isHe={isHe} t={t} titleBySlug={titleBySlug} />
                </motion.div>
              ))}
            </Stagger>
          </section>
        )}

        {/* Manual external-change log */}
        <GlassCard static className="max-w-xl p-6">
          <div className="mb-1 inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ color: 'var(--warning)', background: 'rgba(251,191,36,0.1)' }}>
              <Wrench size={15} strokeWidth={1.8} />
            </span>
            <h3 className="text-white text-15" style={{ fontFamily: serif, fontWeight: 600 }}>
              {t('Log an external change', 'רישום שינוי חיצוני')}
            </h3>
          </div>
          <p className="mb-4 text-white/45 text-xs" style={{ fontFamily: sans }}>
            {t(
              'For actions the platform can’t see (printed menu, Instagram campaign, new photo shoot).',
              'לפעולות שהמערכת לא רואה (תפריט מודפס, קמפיין אינסטגרם, צילום חדש).'
            )}
          </p>
          <div className="flex flex-col gap-3">
            <input
              className={inputCls}
              placeholder={t('What changed? (e.g. moved higher in the printed menu)', 'מה שינית? (למשל: הזזתי גבוה בתפריט המודפס)')}
              aria-label={t('What changed? (e.g. moved higher in the printed menu)', 'מה שינית? (למשל: הזזתי גבוה בתפריט המודפס)')}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <div className="flex gap-3">
              <select aria-label={t('Cocktail (optional)', 'קוקטייל (אופציונלי)')} className={`${inputCls} flex-1`} value={slug} onChange={(e) => setSlug(e.target.value)}>
                <option value="">{t('Cocktail (optional)', 'קוקטייל (אופציונלי)')}</option>
                {MENU.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title[lang]}
                  </option>
                ))}
              </select>
              <input aria-label={t('Date', 'תאריך')} className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button
              type="button"
              onClick={submitManual}
              disabled={saving}
              className="group relative inline-flex w-fit shrink-0 items-center justify-center gap-2 self-start overflow-hidden rounded-full px-6 py-3 text-11 tracking-[0.25em] uppercase text-black transition-shadow disabled:opacity-50"
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
              <span className="relative z-10 inline-flex items-center gap-2">
                <PlusCircle size={14} strokeWidth={2.2} />
                {saving ? t('Logging…', 'רושם…') : t('Log change', 'רשום שינוי')}
              </span>
            </button>
            {msg && (
              <p role="status" aria-live="polite" className="text-amber-200/80 text-xs" style={{ fontFamily: sans }}>
                {msg}
              </p>
            )}
          </div>
        </GlassCard>

        {/* Timeline */}
        {data && data.timeline.length > 0 && (
          <section>
            <SectionLabel icon={Clock}>{t('Change timeline', 'ציר הזמן של השינויים')}</SectionLabel>
            <GlassCard static className="divide-y divide-white/[0.06]">
              {data.timeline.slice(0, 30).map((c) => {
                const manual = c.source === 'manual';
                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3 text-xs" style={{ fontFamily: sans }}>
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                      style={{
                        color: manual ? 'var(--warning)' : 'rgba(255,255,255,0.55)',
                        background: manual ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {manual ? <Wrench size={11} strokeWidth={2} /> : <Zap size={11} strokeWidth={2} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/75">{c.summary ?? c.changeType}</span>
                    <span className="shrink-0 text-white/35">
                      {manual ? t('manual', 'ידני') : t('auto', 'אוטו')} · {fmtDate(c.createdAt)}
                    </span>
                  </div>
                );
              })}
            </GlassCard>
          </section>
        )}
      </div>
    </>
  );
}

export default function ClosedLoopPage() {
  return (
    <AdminShell
      title="Closed Loop"
      titleHe="לולאה סגורה"
      eyebrow="Did our changes work?"
      eyebrowHe="האם השינויים עבדו?"
      active="/admin/closed-loop"
      subtitle="Recommendation → Action → Measured Result. Every result shows its confidence and observation window — so you don't overreact to small samples. No fabricated numbers."
      subtitleHe="המלצה ← פעולה ← תוצאה נמדדת. לכל תוצאה רמת ביטחון וחלון תצפית — כדי לא להגיב יתר על המידה למדגם קטן. בלי מספרים מומצאים."
    >
      <ClosedLoopPanel />
    </AdminShell>
  );
}

/** Short status label worn by the "after" drink image in the visual before→after. */
function afterBadge(status: ImpactStatus, isHe: boolean): string {
  switch (status) {
    case 'success':
      return isHe ? 'הצליח' : 'worked';
    case 'declined':
      return isHe ? 'ירד' : 'down';
    case 'no_effect':
      return '—';
    default:
      return isHe ? 'מוקדם' : 'early';
  }
}

interface ResultCardProps {
  item: ClosedLoopItem;
  lang: 'en' | 'he';
  isHe: boolean;
  t: (en: string, he: string) => string;
  titleBySlug: Map<string, { en: string; he: string }>;
}

function ResultCard({ item: m, lang, isHe, t, titleBySlug }: ResultCardProps) {
  const st = STATUS[m.result.status];
  const StatusIcon = st.icon;
  const slug = m.change.entityId;
  const cocktail = slug ? findCocktailBySlug(slug) : undefined;
  const accent = slug ? getAccent(slug) : st.color;
  const title = slug ? titleBySlug.get(slug)?.[lang] ?? slug : '';
  const delta = m.result.deltaPct;
  const down = m.result.direction === 'down';
  const DeltaArrow = down ? ArrowDownRight : ArrowUpRight;

  return (
    <HoverLift
      accent={accent}
      className="relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white/[0.02]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl border"
        style={{ borderColor: `${st.color}33` }}
      />
      <AccentWash accent={accent} />

      <div className="relative flex flex-1 flex-col" dir={isHe ? 'rtl' : 'ltr'}>
        {/* Doubled hero image (taller, never cropped) */}
        {cocktail ? (
          <div className="relative grid place-items-center p-4 pb-0">
            <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-44" />
          </div>
        ) : (
          <div className="h-10" aria-hidden />
        )}

        {/* Status badge */}
        <div className="px-5 pt-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-10 uppercase tracking-[0.2em]"
            style={{ borderColor: `${st.color}66`, color: st.color, background: `${st.color}14`, fontFamily: sans, fontWeight: 600 }}
          >
            <StatusIcon size={13} strokeWidth={2} /> {st[lang]}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-5 pt-2.5">
          {title && (
            <h4
              className="text-white text-17 leading-tight"
              style={{ fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
            >
              {title}
            </h4>
          )}

          {/* Big delta with arrow */}
          {delta !== null ? (
            <p className="inline-flex items-baseline gap-1.5" style={{ color: down ? 'var(--critical-soft)' : 'var(--success)', fontFamily: serif, fontWeight: 700 }}>
              <DeltaArrow size={26} strokeWidth={2.4} className="self-center" />
              <span style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', lineHeight: 1 }}>
                {delta > 0 ? '+' : ''}
                {delta}%
              </span>
            </p>
          ) : (
            <p className="text-white/35 text-sm italic" style={{ fontFamily: sans }}>
              {t('No delta yet', 'אין דלתא')}
            </p>
          )}

          {/* Visual Before → After: the change's cocktail image, "after" wears the result label */}
          {cocktail && (
            <BeforeAfterImage
              src={cocktail.heroImage}
              accent={accent}
              lang={lang}
              afterBadge={afterBadge(m.result.status, isHe)}
            />
          )}

          {/* Metric · window (compact) */}
          <p className="text-white/50 text-11" style={{ fontFamily: sans }}>
            {METRIC[m.metric][lang]} · {m.observationDays}
            {t('d', 'י')}
            {m.stillAccumulating ? t(' · live', ' · נצבר') : ''}
          </p>

          <div className="mt-auto pt-1.5">
            <ConfidenceBadge pct={CONF_PCT[m.confidence]} label={CONF_LABEL[m.confidence][lang]} />
          </div>
        </div>
      </div>
    </HoverLift>
  );
}

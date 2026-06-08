'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import type { ImpactStatus, MetricKey, Confidence } from '@/lib/closedloop/types';
import type { ClosedLoopItem, ClosedLoopReport } from '@/lib/closedloop/server';

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
  'bg-black/40 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/30 focus:border-amber-200/50 focus:outline-none transition-colors';

export default function ClosedLoopPage() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);
  const [data, setData] = useState<ClosedLoopReport | null>(null);
  const [loading, setLoading] = useState(true);

  // manual external-change form
  const [summary, setSummary] = useState('');
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const titleBySlug = useMemo(() => new Map(MENU.map((c) => [c.slug, c.title])), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/closed-loop', { cache: 'no-store' });
      const json: { success: boolean; data?: ClosedLoopReport } = await res.json();
      setData(json.success && json.data ? json.data : { measured: [], timeline: [], hasData: false });
    } catch {
      setData({ measured: [], timeline: [], hasData: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        body: JSON.stringify({ restaurant: 'diner', summary: summary.trim(), entityId: slug || undefined, date: date || undefined }),
      });
      const json: { success: boolean } = await res.json();
      if (json.success) {
        setSummary('');
        setSlug('');
        setDate('');
        setMsg(isHe ? 'נרשם ✓' : 'Logged ✓');
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (iso: string): string => iso.slice(0, 10);

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
            <SectionLabel icon={Sparkles}>{t('Measured results', 'תוצאות נמדדות')}</SectionLabel>

            {(!data || data.measured.length === 0) && (
              <p className="text-white/40 text-sm italic" style={{ fontFamily: sans }}>
                {t(
                  'No measurable changes yet. Make a change (promotion/experience) or log an external one below.',
                  'אין עדיין שינויים מדידים. בצעו פעולה (מבצע/חוויה) או רשמו שינוי חיצוני למטה.'
                )}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.measured.map((m: ClosedLoopItem) => (
                <ResultCard key={m.change.id} item={m} lang={lang} isHe={isHe} t={t} titleBySlug={titleBySlug} />
              ))}
            </div>
          </section>
        )}

        {/* Manual external-change log */}
        <section className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-1 inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)' }}>
              <Wrench size={15} strokeWidth={1.8} />
            </span>
            <h3 className="text-white text-[15px]" style={{ fontFamily: serif, fontWeight: 600 }}>
              {t('Log an external change', 'רישום שינוי חיצוני')}
            </h3>
          </div>
          <p className="mb-4 text-white/45 text-[12px]" style={{ fontFamily: sans }}>
            {t(
              'For actions the platform can’t see (printed menu, Instagram campaign, new photo shoot).',
              'לפעולות שהמערכת לא רואה (תפריט מודפס, קמפיין אינסטגרם, צילום חדש).'
            )}
          </p>
          <div className="flex flex-col gap-3">
            <input
              className={inputCls}
              placeholder={t('What changed? (e.g. moved higher in the printed menu)', 'מה שינית? (למשל: הזזתי גבוה בתפריט המודפס)')}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <div className="flex gap-3">
              <select className={`${inputCls} flex-1`} value={slug} onChange={(e) => setSlug(e.target.value)}>
                <option value="">{t('Cocktail (optional)', 'קוקטייל (אופציונלי)')}</option>
                {MENU.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.title[lang]}
                  </option>
                ))}
              </select>
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button
              type="button"
              onClick={submitManual}
              disabled={saving}
              className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-amber-300 px-6 py-3 text-[11px] uppercase tracking-[0.25em] text-black transition-transform hover:scale-[1.04] disabled:opacity-50"
              style={{ fontFamily: sans, fontWeight: 700 }}
            >
              <PlusCircle size={14} strokeWidth={2.2} />
              {saving ? t('Logging…', 'רושם…') : t('Log change', 'רשום שינוי')}
            </button>
            {msg && (
              <p className="text-amber-200/80 text-xs" style={{ fontFamily: sans }}>
                {msg}
              </p>
            )}
          </div>
        </section>

        {/* Timeline */}
        {data && data.timeline.length > 0 && (
          <section>
            <SectionLabel icon={Clock}>{t('Change timeline', 'ציר הזמן של השינויים')}</SectionLabel>
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] divide-y divide-white/[0.06]">
              {data.timeline.slice(0, 30).map((c) => {
                const manual = c.source === 'manual';
                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3 text-[12px]" style={{ fontFamily: sans }}>
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                      style={{
                        color: manual ? '#fbbf24' : 'rgba(255,255,255,0.55)',
                        background: manual ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {manual ? <Wrench size={11} strokeWidth={2} /> : <Sparkles size={11} strokeWidth={2} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-white/75">{c.summary ?? c.changeType}</span>
                    <span className="shrink-0 text-white/35">
                      {manual ? t('manual', 'ידני') : t('auto', 'אוטו')} · {fmtDate(c.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}

/** Normalized baseline for the relative before/after visual (no fabricated absolutes). */
const RELATIVE_BASELINE = 100;

interface BeforeAfterProps {
  deltaPct: number;
  direction: 'up' | 'down' | 'flat' | null;
  t: (en: string, he: string) => string;
}

/**
 * Compact BEFORE → AFTER mini-visual. The engine only exposes a per-day-rate
 * delta (no raw counts), so we normalize Before to a baseline and derive After
 * as baseline × (1 + deltaPct/100). It is therefore labeled RELATIVE — never
 * presenting fabricated absolute numbers.
 */
function BeforeAfter({ deltaPct, direction, t }: BeforeAfterProps) {
  const before = RELATIVE_BASELINE;
  const after = Math.max(0, before * (1 + deltaPct / 100));
  const max = Math.max(before, after, 1);
  const beforeH = Math.max(6, (before / max) * 100);
  const afterH = Math.max(6, (after / max) * 100);
  const down = direction === 'down';
  const flat = direction === 'flat' || direction === null;
  const afterColor = flat ? '#e7e5e4' : down ? '#fb7185' : '#34d399';
  const DeltaArrow = down ? ArrowDownRight : flat ? Minus : ArrowUpRight;

  const Bar = ({ heightPct, color, labelEn, labelHe }: { heightPct: number; color: string; labelEn: string; labelHe: string }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <div className="flex h-12 w-full items-end justify-center">
        <div
          className="w-7 rounded-t-md transition-all"
          style={{ height: `${heightPct}%`, background: color, boxShadow: `0 0 14px -4px ${color}` }}
        />
      </div>
      <span className="truncate text-[9px] uppercase tracking-[0.12em] text-white/45" style={{ fontFamily: sans }}>
        {t(labelEn, labelHe)}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.22em] text-white/30" style={{ fontFamily: sans }}>
          {t('Relative', 'יחסי')}
        </span>
        <span
          className="inline-flex items-center gap-0.5 text-[12px]"
          style={{ color: afterColor, fontFamily: serif, fontWeight: 700 }}
        >
          <DeltaArrow size={13} strokeWidth={2.4} />
          {deltaPct > 0 ? '+' : ''}
          {deltaPct}%
        </span>
      </div>
      <div className="flex items-end gap-2.5">
        <Bar heightPct={beforeH} color="rgba(255,255,255,0.32)" labelEn="Before" labelHe="לפני" />
        <DeltaArrow size={16} strokeWidth={2.2} className="mb-5 shrink-0" style={{ color: afterColor }} aria-hidden />
        <Bar heightPct={afterH} color={afterColor} labelEn="After" labelHe="אחרי" />
      </div>
    </div>
  );
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
  const cocktail = m.change.entityId ? findCocktailBySlug(m.change.entityId) : undefined;
  const accent = m.change.entityId ? getAccent(m.change.entityId) : st.color;
  const title = m.change.entityId ? titleBySlug.get(m.change.entityId)?.[lang] ?? m.change.entityId : '';
  const delta = m.result.deltaPct;
  const down = m.result.direction === 'down';
  const DeltaArrow = down ? ArrowDownRight : ArrowUpRight;

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-3xl border bg-white/[0.02]"
      style={{ borderColor: `${st.color}33`, boxShadow: `0 30px 90px -55px ${st.color}` }}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      {/* Image (always definite height, never cropped) */}
      {cocktail ? (
        <div className="relative grid place-items-center p-4 pb-0">
          <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-36" />
        </div>
      ) : (
        <div className="h-12" aria-hidden />
      )}

      {/* Big status badge */}
      <div className="px-5 pt-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{ borderColor: `${st.color}66`, color: st.color, background: `${st.color}14`, fontFamily: sans, fontWeight: 600 }}
        >
          <StatusIcon size={13} strokeWidth={2} /> {st[lang]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5 pt-2.5">
        {title && (
          <h4
            className="text-white text-[17px] leading-tight"
            style={{ fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
          >
            {title}
          </h4>
        )}

        {/* Big delta with arrow */}
        {delta !== null ? (
          <p className="inline-flex items-baseline gap-1.5" style={{ color: down ? '#fb7185' : '#34d399', fontFamily: serif, fontWeight: 700 }}>
            <DeltaArrow size={26} strokeWidth={2.4} className="self-center" />
            <span style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', lineHeight: 1 }}>
              {delta > 0 ? '+' : ''}
              {delta}%
            </span>
          </p>
        ) : (
          <p className="text-white/35 text-sm italic" style={{ fontFamily: sans }}>
            {t('No reportable delta yet', 'אין עדיין דלתא מדידה')}
          </p>
        )}

        {/* Before → After mini-visual (relative — derived from the delta, no fabricated absolutes) */}
        {delta !== null && <BeforeAfter deltaPct={delta} direction={m.result.direction} t={t} />}

        {/* Metric + observation window */}
        <p className="text-white/55 text-[12px]" style={{ fontFamily: sans }}>
          {METRIC[m.metric][lang]} · {m.observationDays} {t('days', 'ימים')}
          {m.stillAccumulating ? t(' (accumulating)', ' (נצבר)') : ''}
        </p>

        {/* Action taken */}
        <p className="text-white/45 text-[12px] leading-snug" style={{ fontFamily: sans }}>
          <span className="text-white/35">{t('Action: ', 'פעולה: ')}</span>
          {m.change.summary}
        </p>

        <div className="mt-auto pt-1.5">
          <ConfidenceBadge pct={CONF_PCT[m.confidence]} label={CONF_LABEL[m.confidence][lang]} />
        </div>
      </div>
    </article>
  );
}

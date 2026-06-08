'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Sparkles, CalendarClock, Power, Percent, Plus, X, Eye } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, KpiCard, Pill, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { useLang } from '@/lib/useLang';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import type { Lang } from '@/data/cocktail';
import type { Promotion, DiscountType, PromotionScope } from '@/lib/promotions/types';
import type { Schedule, Weekday } from '@/lib/scheduling/types';
import type { BadgeKind } from '@/lib/experience/types';

type ScheduleMode = 'always' | 'weekly' | 'range' | 'seasonal';

const WEEKDAYS: ReadonlyArray<{ idx: number; en: string; he: string }> = [
  { idx: 0, en: 'Sun', he: 'א' },
  { idx: 1, en: 'Mon', he: 'ב' },
  { idx: 2, en: 'Tue', he: 'ג' },
  { idx: 3, en: 'Wed', he: 'ד' },
  { idx: 4, en: 'Thu', he: 'ה' },
  { idx: 5, en: 'Fri', he: 'ו' },
  { idx: 6, en: 'Sat', he: 'ש' },
];

const BADGE_KINDS: BadgeKind[] = ['happy_hour', 'discount', 'seasonal', 'limited_time', 'custom'];

/**
 * Bilingual display labels for the badge kinds this screen offers. Display only —
 * the value sent to the API stays the raw key. Partial because BadgeKind has more
 * members than this screen exposes; unmapped kinds fall back to the raw key (so
 * English output is unchanged) via badgeKindLabel.
 */
const BADGE_KIND_LABEL: Partial<Record<BadgeKind, { en: string; he: string }>> = {
  happy_hour: { en: 'happy_hour', he: 'שעה שמחה' },
  discount: { en: 'discount', he: 'הנחה' },
  seasonal: { en: 'seasonal', he: 'עונתי' },
  limited_time: { en: 'limited_time', he: 'זמן מוגבל' },
  custom: { en: 'custom', he: 'מותאם אישית' },
};

const badgeKindLabel = (kind: BadgeKind, isHe: boolean): string =>
  BADGE_KIND_LABEL[kind]?.[isHe ? 'he' : 'en'] ?? kind;

interface FormState {
  name: string;
  type: DiscountType;
  value: number;
  scope: PromotionScope;
  targetSlugs: string[];
  badgeKind: BadgeKind;
  mode: ScheduleMode;
  days: number[];
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  startMonthDay: string;
  endMonthDay: string;
}

const EMPTY: FormState = {
  name: '',
  type: 'percentage',
  value: 20,
  scope: 'all',
  targetSlugs: [],
  badgeKind: 'happy_hour',
  mode: 'always',
  days: [5],
  start: '17:00',
  end: '20:00',
  startDate: '',
  endDate: '',
  startMonthDay: '06-01',
  endMonthDay: '08-31',
};

function buildSchedule(f: FormState): Schedule | undefined {
  switch (f.mode) {
    case 'weekly':
      return { windows: [{ kind: 'recurring', days: f.days as Weekday[], start: f.start, end: f.end }] };
    case 'range':
      return f.startDate && f.endDate ? { windows: [{ kind: 'range', startDate: f.startDate, endDate: f.endDate }] } : undefined;
    case 'seasonal':
      return { windows: [{ kind: 'seasonal', startMonthDay: f.startMonthDay, endMonthDay: f.endMonthDay }] };
    default:
      return undefined;
  }
}

function scheduleSummary(s: Schedule | undefined, isHe: boolean): string {
  if (!s || s.windows.length === 0) return isHe ? 'תמיד' : 'Always';
  const w = s.windows[0];
  if (w.kind === 'recurring') {
    const days = w.days.map((d) => WEEKDAYS[d][isHe ? 'he' : 'en']).join(', ');
    return `${days} ${w.start}–${w.end}`;
  }
  if (w.kind === 'range') return `${w.startDate} → ${w.endDate}`;
  return `${w.startMonthDay} → ${w.endMonthDay}`;
}

type PromoStatus = 'off' | 'active' | 'scheduled' | 'ended';

/** Derive a display status from the active flag and a date-range schedule (no fabricated data). */
function promoStatus(p: Promotion & { active?: boolean }): PromoStatus {
  if (p.active === false) return 'off';
  const w = p.schedule?.windows?.[0];
  if (w?.kind === 'range') {
    const now = Date.now();
    const start = Date.parse(`${w.startDate}T00:00:00`);
    const end = Date.parse(`${w.endDate}T23:59:59`);
    if (!Number.isNaN(end) && now > end) return 'ended';
    if (!Number.isNaN(start) && now < start) return 'scheduled';
  }
  return 'active';
}

const STATUS_STYLE: Record<PromoStatus, { en: string; he: string; cls: string; dot: string }> = {
  active: { en: 'Live', he: 'פעיל', cls: 'border-emerald-300/40 text-emerald-200 bg-emerald-300/10', dot: '#34d399' },
  scheduled: { en: 'Scheduled', he: 'מתוזמן', cls: 'border-sky-300/40 text-sky-200 bg-sky-300/10', dot: '#7dd3fc' },
  ended: { en: 'Ended', he: 'הסתיים', cls: 'border-white/20 text-white/40 bg-white/[0.03]', dot: '#9ca3af' },
  off: { en: 'Off', he: 'כבוי', cls: 'border-white/20 text-white/40 bg-white/[0.03]', dot: '#6b7280' },
};

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const inputCls =
  'bg-black/40 border border-white/12 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none transition-colors focus:border-amber-200/50 placeholder:text-white/30';

/** Discount chip text from the live form state (e.g. "−20%" / "−15₪"). */
const formDiscountLabel = (f: Pick<FormState, 'type' | 'value'>): string =>
  `−${Number.isFinite(f.value) ? f.value : 0}${f.type === 'percentage' ? '%' : '₪'}`;

/**
 * Compact, guest-facing preview of how a promotion will read on the menu —
 * a single menu-card mockup with the cocktail hero (when exactly one item is
 * selected) or a generic glow, plus the badge label and discount chip rendered
 * the way the live badge appears. Lightweight: reuses GlassImage, no 3D.
 */
function LivePreview({ form, lang, isHe }: { form: FormState; lang: Lang; isHe: boolean }) {
  const t = (en: string, he: string) => (isHe ? he : en);
  const selected =
    form.scope === 'item' && form.targetSlugs.length === 1 ? findCocktailBySlug(form.targetSlugs[0]) : undefined;
  const accent = selected ? getAccent(selected.slug) : '#fbbf24';
  const badge = badgeKindLabel(form.badgeKind, isHe);
  const discount = formDiscountLabel(form);
  const cardName =
    selected?.title[lang] ??
    (form.scope === 'item'
      ? t(`${form.targetSlugs.length} items`, `${form.targetSlugs.length} פריטים`)
      : t('Full menu', 'כל התפריט'));

  return (
    <div className="flex flex-col gap-3 min-w-0" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 text-white/40 text-[10px] tracking-[0.18em] uppercase" style={{ fontFamily: sans }}>
        <Eye size={12} strokeWidth={2} />
        {t('Guest preview', 'תצוגת אורח')}
      </div>

      <div
        className="relative flex flex-col overflow-hidden rounded-3xl border bg-white/[0.02] p-4"
        style={{ borderColor: `${accent}33` }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
          aria-hidden
        />

        {/* Floating badge — mirrors how the live menu badge appears */}
        <div className={`absolute top-3 z-10 flex flex-wrap items-center gap-1.5 ${isHe ? 'left-3' : 'right-3'}`}>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase"
            style={{ color: accent, background: `${accent}1f`, border: `1px solid ${accent}55`, fontFamily: sans, fontWeight: 700 }}
          >
            {badge}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px]"
            style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}40`, fontFamily: serif, fontWeight: 700 }}
          >
            {discount}
          </span>
        </div>

        {selected ? (
          <GlassImage src={selected.heroImage} accent={accent} className="w-full h-28 mb-3" />
        ) : (
          <div
            className="relative grid place-items-center w-full h-28 mb-3 rounded-2xl"
            style={{ background: `radial-gradient(circle at 50% 35%, ${accent}22, transparent 70%)` }}
          >
            <Percent size={30} strokeWidth={1.4} style={{ color: accent }} />
          </div>
        )}

        <h4 className="text-white text-[16px] leading-tight truncate" style={{ fontFamily: serif, fontWeight: 600 }}>
          {form.name.trim() || cardName}
        </h4>
        <p className="mt-1 text-white/45 text-[11px] truncate" style={{ fontFamily: sans }}>
          {form.name.trim() ? cardName : t('Untitled promotion', 'מבצע ללא שם')}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill icon={CalendarClock} text={scheduleSummary(buildSchedule(form), isHe)} />
        </div>
      </div>
    </div>
  );
}

function PromotionsPageInner() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const formRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promotions?restaurant=diner', { cache: 'no-store' });
      const json: { success: boolean; data?: Promotion[] } = await res.json();
      setItems(json.success && json.data ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill the form when arriving from a cocktail page via ?cocktail=<slug>.
  // Runs once on mount; ignores unknown / missing slugs so the page is unaffected.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = new URLSearchParams(window.location.search).get('cocktail');
    if (!slug) return;
    const cocktail = findCocktailBySlug(slug);
    if (!cocktail) return;
    setForm((f) => ({
      ...f,
      scope: 'item',
      targetSlugs: f.targetSlugs.includes(cocktail.slug) ? f.targetSlugs : [...f.targetSlugs, cocktail.slug],
    }));
    setPrefilled(true);
    const node = formRef.current;
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = window.setTimeout(() => setPrefilled(false), 2400);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() }));
  const toggleSlug = (s: string) =>
    setForm((f) => ({ ...f, targetSlugs: f.targetSlugs.includes(s) ? f.targetSlugs.filter((x) => x !== s) : [...f.targetSlugs, s] }));

  const submit = async () => {
    if (!form.name.trim()) {
      setMsg(isHe ? 'נדרש שם' : 'Name required');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        restaurant: 'diner',
        name: form.name.trim(),
        type: form.type,
        value: Number(form.value),
        scope: form.scope,
        targetSlugs: form.scope === 'item' ? form.targetSlugs : undefined,
        schedule: buildSchedule(form),
        badgeKind: form.badgeKind,
        active: true,
      };
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: { success: boolean; error?: string } = await res.json();
      if (json.success) {
        setForm(EMPTY);
        setMsg(isHe ? 'נשמר ✓' : 'Saved ✓');
        await load();
      } else {
        setMsg(json.error ?? 'Error');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/promotions?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const toggleActive = async (p: Promotion & { active?: boolean }) => {
    await fetch('/api/promotions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, active: !(p as { active?: boolean }).active }),
    });
    await load();
  };

  const counts = useMemo(() => {
    const c = { active: 0, scheduled: 0, off: 0, ended: 0 };
    for (const p of items) c[promoStatus(p as Promotion & { active?: boolean })] += 1;
    return c;
  }, [items]);

  const discountLabel = (p: Promotion) => `−${p.value}${p.type === 'percentage' ? '%' : '₪'}`;

  return (
    <AdminShell
      title="Promotions"
      titleHe="מבצעים"
      eyebrow="Happy hour · discounts · scheduled"
      eyebrowHe="שעה שמחה · הנחות · מתוזמן"
      active="/admin/promotions"
      subtitle="Discounts that auto-apply on the menu and light their own badge when live. No developer needed."
      subtitleHe="הנחות שמופעלות אוטומטית בתפריט ומדליקות badge כשהן פעילות. ללא צורך במפתח."
    >
      <div className="flex flex-col gap-8" dir={isHe ? 'rtl' : 'ltr'}>
        {/* KPI strip */}
        {items.length > 0 && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label={t('Live now', 'פעיל עכשיו')} value={String(counts.active)} icon={Sparkles} accent="#34d399" />
            <KpiCard label={t('Scheduled', 'מתוזמן')} value={String(counts.scheduled)} icon={CalendarClock} accent="#7dd3fc" />
            <KpiCard label={t('Paused', 'מושהה')} value={String(counts.off)} icon={Power} accent="#f59e0b" />
            <KpiCard label={t('Total', 'סך הכל')} value={String(items.length)} icon={Tag} accent="#fbbf24" />
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] items-start">
          {/* Create form */}
          <section
            ref={formRef}
            className={`rounded-3xl border bg-white/[0.02] p-6 flex flex-col gap-4 transition-[border-color,box-shadow] duration-700 ${
              prefilled ? 'border-amber-300/60 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_0_40px_-8px_rgba(252,211,77,0.45)]' : 'border-white/10'
            }`}
          >
            <SectionLabel icon={Plus}>{t('New promotion', 'מבצע חדש')}</SectionLabel>

            {/* Live guest-facing preview — updates as the form changes */}
            <LivePreview form={form} lang={lang} isHe={isHe} />

            <input
              className={inputCls}
              placeholder={t('Name (e.g. Happy Hour)', 'שם (למשל שעה שמחה)')}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />

            <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5">
              <select className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value as DiscountType)}>
                <option value="percentage">{t('Percentage %', 'אחוז %')}</option>
                <option value="fixed">{t('Fixed ₪', 'סכום ₪')}</option>
              </select>
              <input
                className={`${inputCls} w-20 text-center`}
                type="number"
                min={0}
                value={form.value}
                onChange={(e) => set('value', Number(e.target.value))}
              />
              <select className={inputCls} value={form.scope} onChange={(e) => set('scope', e.target.value as PromotionScope)}>
                <option value="all">{t('All items', 'כל התפריט')}</option>
                <option value="item">{t('Specific items', 'פריטים נבחרים')}</option>
              </select>
            </div>

            {form.scope === 'item' && (
              <div className="flex flex-wrap gap-2">
                {MENU.map((c) => {
                  const on = form.targetSlugs.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => toggleSlug(c.slug)}
                      className={`px-3 py-1.5 rounded-full border text-[11px] transition-colors ${
                        on ? 'border-amber-300/60 text-amber-200 bg-amber-300/10' : 'border-white/12 text-white/50 hover:border-white/25'
                      }`}
                      style={{ fontFamily: sans }}
                    >
                      {c.title[lang]}
                    </button>
                  );
                })}
              </div>
            )}

            {/* schedule */}
            <select className={inputCls} value={form.mode} onChange={(e) => set('mode', e.target.value as ScheduleMode)}>
              <option value="always">{t('Always on', 'תמיד פעיל')}</option>
              <option value="weekly">{t('Weekly (days + time)', 'שבועי (ימים + שעות)')}</option>
              <option value="range">{t('Date range', 'טווח תאריכים')}</option>
              <option value="seasonal">{t('Seasonal (month-day)', 'עונתי (חודש-יום)')}</option>
            </select>

            {form.mode === 'weekly' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.idx}
                      type="button"
                      onClick={() => toggleDay(d.idx)}
                      className={`w-9 h-9 rounded-full border text-[11px] transition-colors ${
                        form.days.includes(d.idx) ? 'border-amber-300/60 text-amber-200 bg-amber-300/10' : 'border-white/12 text-white/50 hover:border-white/25'
                      }`}
                    >
                      {d[isHe ? 'he' : 'en']}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <input className={`${inputCls} w-28`} type="time" value={form.start} onChange={(e) => set('start', e.target.value)} />
                  <input className={`${inputCls} w-28`} type="time" value={form.end} onChange={(e) => set('end', e.target.value)} />
                </div>
              </div>
            )}

            {form.mode === 'range' && (
              <div className="flex flex-wrap gap-2.5">
                <input className={inputCls} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                <input className={inputCls} type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
            )}

            {form.mode === 'seasonal' && (
              <div className="flex gap-2.5 items-center">
                <input className={`${inputCls} w-28`} placeholder="MM-DD" value={form.startMonthDay} onChange={(e) => set('startMonthDay', e.target.value)} />
                <span className="text-white/40">→</span>
                <input className={`${inputCls} w-28`} placeholder="MM-DD" value={form.endMonthDay} onChange={(e) => set('endMonthDay', e.target.value)} />
              </div>
            )}

            <select className={inputCls} value={form.badgeKind} onChange={(e) => set('badgeKind', e.target.value as BadgeKind)}>
              {BADGE_KINDS.map((b) => (
                <option key={b} value={b}>
                  {t('badge', 'תווית')}: {badgeKindLabel(b, isHe)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-300 text-black text-[11px] tracking-[0.25em] uppercase transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{ fontFamily: sans, fontWeight: 700 }}
            >
              <Plus size={14} strokeWidth={2.4} />
              {saving ? t('Saving…', 'שומר…') : t('Add promotion', 'הוסף מבצע')}
            </button>
            {msg && <p className="text-amber-200/80 text-xs" style={{ fontFamily: sans }}>{msg}</p>}
          </section>

          {/* List */}
          <section className="flex flex-col gap-4">
            <SectionLabel icon={Tag}>{t(`Promotions (${items.length})`, `מבצעים (${items.length})`)}</SectionLabel>

            {loading && (
              <div className="grid sm:grid-cols-2 gap-4" aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-5">
                    <Skeleton className="h-32 w-full mb-4 rounded-2xl" />
                    <Skeleton className="h-4 w-2/3 mb-3" />
                    <div className="flex gap-2 mb-3">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-1/2 mb-3" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </div>
                ))}
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
                <p className="text-white/40 text-sm italic" style={{ fontFamily: sans }}>
                  {t('No promotions yet. Create one →', 'אין מבצעים עדיין. צרו אחד →')}
                </p>
              </div>
            )}

            <Stagger className="grid sm:grid-cols-2 gap-4">
              {items.map((p) => {
                const status = promoStatus(p as Promotion & { active?: boolean });
                const st = STATUS_STYLE[status];
                const isActive = status !== 'off';
                const slugs = p.scope === 'item' ? p.targetSlugs ?? [] : [];
                const featured = slugs.map((s) => findCocktailBySlug(s)).find(Boolean);
                const accent = featured ? getAccent(featured.slug) : '#fbbf24';
                return (
                  <motion.article
                    key={p.id}
                    variants={staggerItem}
                    className="group relative flex flex-col overflow-hidden rounded-3xl border bg-white/[0.02] p-5 transition-colors"
                    style={{ borderColor: `${accent}33` }}
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
                      aria-hidden
                    />

                    {/* Featured cocktail image (specific-item promos) or generic glow header */}
                    {featured ? (
                      <GlassImage src={featured.heroImage} accent={accent} className="w-full h-32 mb-4" />
                    ) : (
                      <div
                        className="relative grid place-items-center w-full h-32 mb-4 rounded-2xl"
                        style={{ background: `radial-gradient(circle at 50% 35%, ${accent}22, transparent 70%)` }}
                      >
                        <Percent size={34} strokeWidth={1.4} style={{ color: accent }} />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-white text-[17px] leading-tight min-w-0" style={{ fontFamily: serif, fontWeight: 600 }}>
                        {p.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="shrink-0 text-rose-300/60 hover:text-rose-300 transition-colors"
                        aria-label="delete"
                      >
                        <X size={16} strokeWidth={2.2} />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px]"
                        style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}40`, fontFamily: serif, fontWeight: 700 }}
                      >
                        {discountLabel(p)}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] tracking-[0.18em] uppercase ${st.cls}`} style={{ fontFamily: sans }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {st[isHe ? 'he' : 'en']}
                      </span>
                    </div>

                    <p className="mt-3 text-white/45 text-[11px]" style={{ fontFamily: sans }}>
                      {p.scope === 'all' ? t('All items', 'כל התפריט') : slugs.map((s) => findCocktailBySlug(s)?.title[lang] ?? s).join(', ')}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill icon={CalendarClock} text={scheduleSummary(p.schedule, isHe)} />
                      <span className="text-white/30 text-[10px] tracking-[0.15em] uppercase" style={{ fontFamily: sans }}>
                        {badgeKindLabel(p.badgeKind ?? 'happy_hour', isHe)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleActive(p as Promotion & { active?: boolean })}
                      className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[10px] tracking-[0.18em] uppercase transition-colors ${
                        isActive ? 'border-emerald-300/40 text-emerald-200 hover:bg-emerald-300/10' : 'border-white/20 text-white/45 hover:bg-white/[0.04]'
                      }`}
                      style={{ fontFamily: sans }}
                    >
                      <Power size={12} strokeWidth={2} />
                      {isActive ? t('Active', 'פעיל') : t('Off', 'כבוי')}
                    </button>
                  </motion.article>
                );
              })}
            </Stagger>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

export default function PromotionsPage() {
  return <PromotionsPageInner />;
}

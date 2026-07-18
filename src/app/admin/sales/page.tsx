'use client';

import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { Coins, Boxes, UploadCloud, AlertTriangle, LayoutGrid } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, KpiCard, SectionLabel, Skeleton, SkeletonGrid } from '@/components/ui/dataviz';
import { GlassCard, EmptyState, ErrorState } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { motion } from 'framer-motion';
import { useLang } from '@/lib/useLang';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { formatILS } from '@/lib/format';
import type { SaleInput, SalesByItem } from '@/lib/sales/repository';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const inputCls = 'bg-black/40 border border-white/12 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-amber-200/40 transition-colors';
const ils = formatILS;

function parseCsv(text: string): SaleInput[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^slug/i.test(l))
    .map((l) => {
      const [slug, units, revenue] = l.split(/[,\t]/).map((s) => s.trim());
      return { slug, units: Number(units) || 0, revenue: Number(revenue) || 0 };
    })
    .filter((r) => r.slug);
}

/** Tiles laid into wrapping rows whose widths are ∝ revenue. Each row is packed
 *  to ~100% width, so a tile's AREA (width × fixed row height) tracks its share
 *  of revenue. Sorted desc → biggest sellers get the biggest tiles. No scroll. */
interface TreemapDatum {
  slug: string;
  title: string;
  revenue: number;
  accent: string;
}

function packRows(items: TreemapDatum[], targetPerRow: number): TreemapDatum[][] {
  const rows: TreemapDatum[][] = [];
  for (let i = 0; i < items.length; i += targetPerRow) {
    rows.push(items.slice(i, i + targetPerRow));
  }
  return rows;
}

function RevenueTreemap({
  data,
  totalRevenue,
  formatIls,
  isHe,
}: {
  data: TreemapDatum[];
  totalRevenue: number;
  formatIls: (n: number) => string;
  isHe: boolean;
}) {
  // More items per row when there are many, so tiles never get too thin/tall.
  const perRow = data.length <= 4 ? data.length : data.length <= 9 ? 3 : 4;
  const rows = packRows(data, perRow);
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label={isHe ? 'מפת הכנסות לפי פריט' : 'Revenue by item'}>
      {rows.map((row, ri) => {
        const rowTotal = row.reduce((sum, d) => sum + d.revenue, 0) || 1;
        return (
          <div key={ri} className="flex gap-1.5">
            {row.map((d) => {
              const widthPct = Math.max(8, (d.revenue / rowTotal) * 100);
              const sharePct = totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 100) : 0;
              return (
                <div
                  key={d.slug}
                  className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-3 transition-transform duration-300 hover:scale-[1.015]"
                  style={{
                    width: `${widthPct}%`,
                    minHeight: 92,
                    borderColor: `${d.accent}40`,
                    background: `linear-gradient(150deg, ${d.accent}26, ${d.accent}0d)`,
                  }}
                  title={`${d.title} · ${formatIls(d.revenue)}`}
                >
                  <span
                    className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full opacity-50 blur-2xl"
                    style={{ background: `radial-gradient(circle, ${d.accent}66, transparent 72%)` }}
                    aria-hidden
                  />
                  <p
                    className="relative truncate text-[13px] leading-tight text-white/90"
                    style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
                  >
                    {d.title}
                  </p>
                  <div className="relative mt-1 flex items-baseline justify-between gap-1.5">
                    <span className="text-[15px] font-bold leading-none tabular-nums" style={{ color: d.accent, fontFamily: serif }}>
                      {formatIls(d.revenue)}
                    </span>
                    <span className="shrink-0 text-[10px] text-white/40 tabular-nums" style={{ fontFamily: sans }}>
                      {sharePct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function SalesPanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const t = (en: string, he: string) => (isHe ? he : en);

  const [csv, setCsv] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const { data: rawSales, loading, error: fetchError, reload } = useApiData<SalesByItem[]>('/api/sales');
  const sales = rawSales ?? [];
  const error = Boolean(fetchError);

  const readDroppedFile = useCallback((file: File) => {
    if (typeof window === 'undefined' || typeof FileReader === 'undefined') return;
    const name = file.name.toLowerCase();
    const looksTextual =
      file.type.startsWith('text/') || /\.(csv|txt|tsv)$/.test(name) || file.type === '';
    if (!looksTextual) {
      setMsg(isHe ? 'קובץ לא נתמך — צרפו CSV או TXT' : 'Unsupported file — drop a CSV or TXT');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsv((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${text}` : text));
      setMsg(null);
    };
    reader.onerror = () => setMsg(isHe ? 'קריאת הקובץ נכשלה' : 'Could not read the file');
    reader.readAsText(file);
  }, [isHe]);

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) readDroppedFile(file);
  }, [readDroppedFile]);

  const knownSlugs = useMemo(() => new Set(MENU.map((c) => c.slug)), []);
  const parsed = useMemo(() => parseCsv(csv), [csv]);
  const unknown = parsed.filter((r) => !knownSlugs.has(r.slug)).map((r) => r.slug);

  const load = reload;

  const submit = async () => {
    if (!start || !end) {
      setMsg(isHe ? 'בחרו טווח תאריכים' : 'Pick a date range');
      return;
    }
    if (parsed.length === 0) {
      setMsg(isHe ? 'אין שורות לייבוא' : 'No rows to import');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart: start, periodEnd: end, rows: parsed }),
      });
      const json: { success: boolean; data?: { imported: number }; error?: string } = await res.json();
      if (json.success) {
        setMsg((isHe ? 'יובאו ' : 'Imported ') + (json.data?.imported ?? 0));
        setCsv('');
        await load();
      } else {
        setMsg(json.error ?? t('Error', 'שגיאה'));
      }
    } finally {
      setSaving(false);
    }
  };

  const ranked = useMemo(() => [...sales].sort((a, b) => b.revenue - a.revenue), [sales]);
  const maxRevenue = useMemo(() => Math.max(1, ...sales.map((s) => s.revenue)), [sales]);
  const treemap = useMemo<TreemapDatum[]>(
    () =>
      ranked
        .filter((s) => s.revenue > 0)
        .map((s) => {
          const c = findCocktailBySlug(s.slug);
          return {
            slug: s.slug,
            title: c ? c.title[lang] : s.slug,
            revenue: s.revenue,
            accent: getAccent(s.slug),
          };
        }),
    [ranked, lang],
  );
  const totals = useMemo(
    () =>
      sales.reduce(
        (acc, s) => ({ revenue: acc.revenue + s.revenue, units: acc.units + s.units }),
        { revenue: 0, units: 0 },
      ),
    [sales],
  );

  return (
    <>
      <div className="flex flex-col gap-10" dir={isHe ? 'rtl' : 'ltr'}>
        {/* KPI strip */}
        {sales.length > 0 ? (
          <Stagger className="grid grid-cols-3 gap-3">
            <motion.div variants={staggerItem}><KpiCard label={t('Revenue', 'הכנסה')} value={ils(totals.revenue)} accent="#e8c987" icon={Coins} /></motion.div>
            <motion.div variants={staggerItem}><KpiCard label={t('Units sold', 'יחידות שנמכרו')} value={totals.units.toLocaleString()} accent="#34d399" icon={Boxes} /></motion.div>
            <motion.div variants={staggerItem}><KpiCard label={t('Items', 'פריטים')} value={sales.length.toLocaleString()} accent="#7dd3fc" icon={Boxes} /></motion.div>
          </Stagger>
        ) : loading ? (
          <SkeletonGrid count={3} className="grid grid-cols-3 gap-3" />
        ) : null}

        <div className="grid gap-8 lg:grid-cols-5">
          {/* CSV import form */}
          <GlassCard static className="lg:col-span-2 p-6 flex flex-col gap-4 h-fit">
            <SectionLabel icon={UploadCloud}>{t('Import CSV', 'ייבוא CSV')}</SectionLabel>
            <p className="text-white/45 text-[12px] -mt-2" style={{ fontFamily: sans }}>
              {t('One row per item:', 'שורה לכל פריט:')}{' '}
              <code className="text-amber-200/80">slug,units,revenue</code>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-white/50 text-[11px] flex flex-col gap-1.5" style={{ fontFamily: sans }}>
                {t('From', 'מתאריך')}
                <input className={inputCls} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="text-white/50 text-[11px] flex flex-col gap-1.5" style={{ fontFamily: sans }}>
                {t('To', 'עד תאריך')}
                <input className={inputCls} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <div
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative rounded-2xl border border-dashed transition-colors ${dragging ? 'border-amber-200/60 ring-2 ring-amber-300/70' : 'border-amber-200/25 bg-white/[0.02]'}`}
            >
              <textarea
                className={`${inputCls} w-full h-44 font-mono text-[12px] resize-none leading-relaxed !border-0 !bg-transparent`}
                placeholder={'diner-aperol-spritz,42,2520\ndiner-negroni,8,464'}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                aria-label={t('CSV sales data', 'נתוני מכירות CSV')}
                dir="ltr"
              />
              {dragging && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-amber-300/10 backdrop-blur-[1px]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-black/60 px-4 py-2 text-amber-200 text-[11px] tracking-[0.18em] uppercase" style={{ fontFamily: sans }}>
                    <UploadCloud size={14} strokeWidth={2.2} />
                    {t('Drop CSV to load', 'שחררו CSV לטעינה')}
                  </span>
                </div>
              )}
            </div>
            <p className="text-white/35 text-[11px] -mt-1 inline-flex items-center gap-1.5" style={{ fontFamily: sans }}>
              <UploadCloud size={11} strokeWidth={1.8} className="shrink-0" />
              {t('Drag & drop a .csv / .txt file here, or paste above.', 'גררו ושחררו קובץ ‎.csv / .txt‎ כאן, או הדביקו למעלה.')}
            </p>
            <div className="flex items-center justify-between gap-2 text-[11px]" style={{ fontFamily: sans }}>
              <span className="text-white/45">{t(`${parsed.length} valid rows`, `${parsed.length} שורות תקינות`)}</span>
              {unknown.length > 0 && (
                <span className="inline-flex items-center gap-1 text-rose-300/90 text-end">
                  <AlertTriangle size={12} strokeWidth={2} className="shrink-0" />
                  <span className="truncate">{t('unknown: ', 'לא מוכרים: ')}{unknown.join(', ')}</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="mt-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-amber-300 text-black text-[11px] tracking-[0.25em] uppercase font-semibold transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{ fontFamily: sans }}
            >
              <UploadCloud size={14} strokeWidth={2.2} />
              {saving ? t('Importing…', 'מייבא…') : t('Import sales', 'ייבא מכירות')}
            </button>
            {msg && <p role="status" aria-live="polite" className="text-amber-200/80 text-xs text-center" style={{ fontFamily: sans }}>{msg}</p>}
          </GlassCard>

          {/* Aggregated sales cards */}
          <section className="lg:col-span-3 flex flex-col gap-4">
            <SectionLabel icon={Coins}>{t(`Imported sales · ${sales.length}`, `מכירות שנקלטו · ${sales.length}`)}</SectionLabel>
            {sales.length === 0 && loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <GlassCard key={i} static className="p-4 flex flex-col">
                    <Skeleton className="h-32 w-full mb-3 rounded-xl" />
                    <Skeleton className="h-4 w-32 mx-auto" />
                    <div className="mt-3 flex items-baseline justify-between">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
                  </GlassCard>
                ))}
              </div>
            ) : error ? (
              <GlassCard static className="p-10">
                <ErrorState
                  title={t('Couldn’t load — check your connection', 'טעינה נכשלה — בדקו את החיבור')}
                  onRetry={load}
                  retryLabel={t('Try again', 'נסו שוב')}
                />
              </GlassCard>
            ) : sales.length === 0 ? (
              <GlassCard static className="p-10">
                <EmptyState title={t('No sales yet — import a CSV to begin.', 'אין מכירות עדיין — ייבאו CSV כדי להתחיל.')} />
              </GlassCard>
            ) : (
              <div className="flex flex-col gap-5">
                {treemap.length > 0 && (
                  <GlassCard static className="p-4">
                    <SectionLabel icon={LayoutGrid}>{t('Revenue treemap', 'מפת הכנסות')}</SectionLabel>
                    <RevenueTreemap data={treemap} totalRevenue={totals.revenue} formatIls={ils} isHe={isHe} />
                  </GlassCard>
                )}
                <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ranked.map((s) => {
                  const c = findCocktailBySlug(s.slug);
                  const accent = getAccent(s.slug);
                  const title = c ? c.title[lang] : s.slug;
                  const pct = Math.max(4, Math.round((s.revenue / maxRevenue) * 100));
                  return (
                    <motion.div key={s.slug} variants={staggerItem}>
                    <GlassCard
                      accent={accent}
                      className="group relative p-4 flex flex-col"
                    >
                      {c ? (
                        <GlassImage src={c.heroImage} accent={accent} className="w-full h-32 mb-3 transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-32 mb-3 rounded-xl border border-dashed border-white/10 grid place-items-center">
                          <span className="text-white/25 text-[10px] tracking-wide" style={{ fontFamily: sans }}>{t('no image', 'אין תמונה')}</span>
                        </div>
                      )}
                      <p className="text-white/90 text-[15px] text-center leading-tight" style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>
                        {title}
                      </p>
                      <div className="mt-3 flex items-baseline justify-between gap-2" style={{ fontFamily: sans }}>
                        <span className="text-white/45 text-[11px]">{s.units} {t('units', 'יח׳')}</span>
                        <span className="text-[17px] tabular-nums" style={{ color: accent, fontFamily: serif, fontWeight: 700 }}>{ils(s.revenue)}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: accent, opacity: 0.85 }} />
                      </div>
                    </GlassCard>
                    </motion.div>
                  );
                })}
                </Stagger>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default function SalesPage() {
  return (
    <AdminShell
      title="Sales Ingestion"
      titleHe="קליטת מכירות"
      eyebrow="Read-only · what actually sold"
      eyebrowHe="קריאה בלבד · נתוני המכירות"
      active="/admin/sales"
      subtitle="Import what actually sold (from your POS). We only read sales — we never place orders. This turns interest into proven sales."
      subtitleHe="ייבאו מה שבאמת נמכר (מה-POS). אנחנו רק קוראים מכירות — לא מבצעים הזמנות. זה הופך עניין למכירות מוכחות."
    >
      <SalesPanel />
    </AdminShell>
  );
}

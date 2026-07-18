'use client';

import { useCallback, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { motion } from 'framer-motion';
import { QrCode, Eye, ShoppingBag, Target, Crown, Share2, LayoutGrid } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, KpiCard, LiveDot, Pill, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { GlassCard, EmptyState } from '@/components/ui/premium';
import { HoverLift, AccentWash } from '@/components/ui/visual';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { useLang } from '@/lib/useLang';
import { useOrigin } from '@/lib/useOrigin';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import { formatILS } from '@/lib/format';
import type { TableIntelligence, TableRow } from '@/lib/analytics/tables-types';
import { useApiData } from '@/lib/data/useApiData';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

const ils = formatILS;

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  width: 600,
  margin: 1,
  errorCorrectionLevel: 'H',
  color: { dark: '#0a0a0a', light: '#fde68a' },
};

interface TableQr {
  table: number;
  url: string;
  dataUrl: string;
}

/** A table has no stored "top cocktail" — derive a stable signature drink from
 *  its id so each card still carries a real glass image (guards missing cocktail). */
const MENU_SLUGS = [
  'diner-aperol-spritz',
  'diner-negroni',
  'diner-pinky',
  'diner-margarita',
  'diner-green-garden',
  'diner-whiskey-sour',
] as const;

function signatureSlug(tableId: string): string {
  let hash = 0;
  for (const ch of tableId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return MENU_SLUGS[hash % MENU_SLUGS.length];
}

export function TablesPanel() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);

  const { data, loading } = useApiData<TableIntelligence>('/api/analytics/tables', { refreshInterval: 20000 });
  const [tableCount, setTableCount] = useState(12);
  const [qrs, setQrs] = useState<TableQr[]>([]);
  const [generating, setGenerating] = useState(false);
  const origin = useOrigin();

  const generateQrs = useCallback(async () => {
    if (!origin) return;
    setGenerating(true);
    try {
      const count = Math.min(Math.max(tableCount, 1), 60);
      const out: TableQr[] = [];
      for (let n = 1; n <= count; n += 1) {
        const url = `${origin}/?t=${n}&src=table_qr`;
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await QRCode.toDataURL(url, QR_OPTIONS);
        out.push({ table: n, url, dataUrl });
      }
      setQrs(out);
    } finally {
      setGenerating(false);
    }
  }, [origin, tableCount]);

  const tables = data?.tables ?? [];

  // KPI strip — total tables, total revenue, avg conversion, best table.
  const totalRevenue = data?.totalRevenue ?? 0;
  const avgConversion = useMemo(() => {
    if (tables.length === 0) return 0;
    const sum = tables.reduce((s, x) => s + x.conversionPct, 0);
    return sum / tables.length;
  }, [tables]);
  const bestTable = useMemo<TableRow | null>(() => {
    if (tables.length === 0) return null;
    return tables.reduce((best, x) => (x.revenue > best.revenue ? x : best), tables[0]);
  }, [tables]);

  const viral = data?.viral;
  const hasViral = Boolean(viral && (viral.sessions > 0 || viral.revenue > 0));

  return (
    <>
      <div className="mb-4 flex justify-end no-print">
        <LiveDot label={isHebrew ? 'חי' : 'Live'} />
      </div>

      {/* QR generator — this is what makes attribution real */}
      <GlassCard className="mb-10 p-6 no-print" static>
        <SectionLabel icon={QrCode}>{t('Generate table QR codes', 'ייצר קודי QR לשולחנות')}</SectionLabel>
        <div className="flex flex-wrap items-center gap-3 mb-2" dir={isHebrew ? 'rtl' : 'ltr'}>
          <label className="text-white/60 text-sm" style={{ fontFamily: sans }}>
            {t('Number of tables', 'מספר שולחנות')}
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={tableCount}
            onChange={(e) => setTableCount(Number(e.target.value))}
            aria-label={t('Number of tables', 'מספר שולחנות')}
            className="w-20 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white/80 text-sm"
            dir="ltr"
          />
          <button
            type="button"
            onClick={generateQrs}
            disabled={generating || !origin}
            className="px-5 py-2 rounded-full text-[10px] tracking-[0.25em] uppercase text-black disabled:opacity-50"
            style={{ fontFamily: sans, background: 'linear-gradient(105deg, var(--champagne-bright), var(--champagne) 55%, var(--champagne-deep))' }}
          >
            {generating ? t('Generating…', 'מייצר…') : t('Generate', 'ייצר')}
          </button>
          {qrs.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2 rounded-full border border-amber-200/40 hover:border-amber-200/80 text-amber-100 text-[10px] tracking-[0.25em] uppercase"
              style={{ fontFamily: sans }}
            >
              {t('Print sheet', 'הדפס גיליון')}
            </button>
          )}
        </div>
        <p className="text-white/35 text-[11px]" style={{ fontFamily: sans }} dir={isHebrew ? 'rtl' : 'ltr'}>
          {t('Every scan, view and order is attributed to its table.', 'כל סריקה, צפייה והזמנה מיוחסות לשולחן.')}
        </p>
      </GlassCard>

      {qrs.length > 0 && (
        <section className="mb-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 print:grid-cols-3">
          {qrs.map((q) => (
            <div key={q.table} className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col items-center break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.dataUrl} alt={`${t('Table', 'שולחן')} ${q.table}`} className="w-full rounded-md mb-2" />
              <span className="text-white/80 text-sm" style={{ fontFamily: serif, fontStyle: 'italic' }}>
                {t('Table', 'שולחן')} {q.table}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* KPI strip */}
      {tables.length > 0 && (
        <section className="mb-12 grid grid-cols-2 lg:grid-cols-4 gap-3 no-print" dir={isHebrew ? 'rtl' : 'ltr'}>
          <KpiCard label={t('Active tables', 'שולחנות פעילים')} value={tables.length.toLocaleString()} icon={Target} accent="#fbbf24" />
          <KpiCard label={t('Attributed revenue', 'הכנסה מיוחסת')} value={ils(totalRevenue)} icon={ShoppingBag} accent="#34d399" />
          <KpiCard label={t('Avg order rate', 'אחוז הזמנה ממוצע')} value={`${avgConversion.toFixed(1)}%`} icon={Eye} accent="#7dd3fc" />
          <KpiCard
            label={t('Best table', 'השולחן המוביל')}
            value={bestTable ? `${t('T', 'ש')}${bestTable.tableId}` : '—'}
            icon={Crown}
            accent="#f59e0b"
            hint={bestTable ? ils(bestTable.revenue) : undefined}
          />
        </section>
      )}

      {/* Share / viral split — kept OUT of table attribution */}
      {hasViral && viral && (
        <section className="mb-12 no-print" dir={isHebrew ? 'rtl' : 'ltr'}>
          <SectionLabel icon={Share2}>{t('Shared / viral · uncredited', 'שיתופי / ויראלי · לא מיוחס')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Pill icon={Share2} text={`${viral.sessions.toLocaleString()} ${t('sessions', 'ביקורים')}`} accent="#7dd3fc" />
            <Pill icon={ShoppingBag} text={`${viral.orders.toLocaleString()} ${t('orders', 'הזמנות')}`} accent="#7dd3fc" />
            <Pill icon={Share2} text={`${ils(viral.revenue)} ${t('re-shared', 'משיתוף')}`} accent="#7dd3fc" />
          </div>
        </section>
      )}

      {/* Floor-plan visualization — tables as spatial nodes on a venue floor */}
      <section className="mb-12 no-print" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionLabel icon={LayoutGrid}>{t('Floor plan', 'מפת רצפה')}</SectionLabel>
          {tables.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-white/40" style={{ fontFamily: sans }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-end gap-0.5" aria-hidden>
                  <span className="block h-2 w-2 rounded-[3px] bg-white/25" />
                  <span className="block h-3.5 w-3.5 rounded-[4px] bg-white/35" />
                </span>
                {t('Revenue', 'הכנסה')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.12), #fbbf24)' }} aria-hidden />
                {t('Order rate', 'אחוז הזמנה')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Crown size={11} strokeWidth={2} className="text-amber-300" />
                {t('Top', 'מוביל')}
              </span>
            </div>
          )}
        </div>
        <FloorPlan tables={tables} bestTableId={bestTable?.tableId ?? null} loading={loading} t={t} />
      </section>

      {/* Per-table premium cards */}
      <section className="no-print" dir={isHebrew ? 'rtl' : 'ltr'}>
        <SectionLabel icon={Target}>{t('Per-table performance', 'ביצועים לפי שולחן')}</SectionLabel>
        {tables.length > 0 ? (
          <Stagger className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((row) => {
              const isBest = bestTable?.tableId === row.tableId;
              const slug = signatureSlug(row.tableId);
              const cocktail = findCocktailBySlug(slug);
              const accent = getAccent(slug);
              return (
                <motion.div key={row.tableId} variants={staggerItem}>
                  <HoverLift accent={accent}>
                    <article
                      className="glass-panel group relative flex h-full flex-col overflow-hidden rounded-3xl transition-colors"
                      style={{ borderColor: isBest ? `${accent}66` : `${accent}26`, boxShadow: isBest ? `0 30px 90px -50px ${accent}` : undefined }}
                    >
                      <AccentWash accent={accent} opacity={isBest ? 0.24 : 0.16} />
                      {/* Hero cocktail visual — doubled glass, the signature drink leads */}
                      <div className="relative grid place-items-center px-5 pt-6">
                        {cocktail ? (
                          <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-56 transition-transform duration-500 group-hover:scale-[1.07]" />
                        ) : (
                          <div className="w-full h-56 rounded-2xl border border-white/10 bg-white/[0.02]" aria-hidden />
                        )}
                        {/* Big serif table numeral */}
                        <span
                          className="absolute top-4 start-5 leading-none text-white/90"
                          style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(3rem,6vw,4rem)' }}
                        >
                          {row.tableId}
                        </span>
                        {isBest && (
                          <span
                            className="absolute top-5 end-5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] tracking-[0.2em] uppercase"
                            style={{ color: accent, background: `${accent}1a`, border: `1px solid ${accent}55`, fontFamily: sans }}
                          >
                            <Crown size={11} strokeWidth={2} /> {t('Top', 'מוביל')}
                          </span>
                        )}
                      </div>

                      <div className="relative flex flex-1 flex-col p-5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <MiniStat v={row.views.toLocaleString()} l={t('Views', 'צפיות')} />
                          <MiniStat v={row.orders.toLocaleString()} l={t('Orders', 'הזמנות')} />
                          <MiniStat v={ils(row.revenue)} l={t('Revenue', 'הכנסה')} accent="#34d399" />
                          <MiniStat v={`${row.conversionPct.toFixed(1)}%`} l={t('Order rate', 'אחוז הזמנה')} accent={accent} />
                        </div>
                      </div>
                    </article>
                  </HoverLift>
                </motion.div>
              );
            })}
          </Stagger>
        ) : loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
                <div className="px-5 pt-6">
                  <Skeleton className="h-56 w-full rounded-2xl" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div dir={isHebrew ? 'rtl' : 'ltr'}>
            <EmptyState
              title={t(
                'No table data yet. Print a QR per table — scans attribute here automatically.',
                'עדיין אין נתוני שולחנות. הדפס QR לכל שולחן — סריקות ייוחסו כאן אוטומטית.',
              )}
            />
          </div>
        )}
      </section>
    </>
  );
}

function MiniStat({ v, l, accent }: { v: string; l: string; accent?: string }) {
  return (
    <div>
      <p className="text-[18px] leading-none" style={{ color: accent ?? 'rgba(255,255,255,0.92)', fontFamily: serif, fontWeight: 700 }}>{v}</p>
      <p className="text-white/40 text-[10px] mt-1 tracking-wide" style={{ fontFamily: sans }}>{l}</p>
    </div>
  );
}

type Translate = (en: string, he: string) => string;

const NODE_MIN_PX = 64;
const NODE_MAX_PX = 116;
const FAINT_HEAT = 0.12;
const FULL_HEAT = 0.92;
const FLOOR_ACCENT = '#fbbf24';

/** Map a value into [0,1] relative to the floor's max (linear, guards empty). */
function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** Spatial "floor plan": each table is a node whose SIZE scales with revenue
 *  (views fallback) and whose amber GLOW scales with conversion%. Crown marks
 *  the top performer. Touch-friendly: a key stat sits under every node, and a
 *  richer popover appears on hover/focus. No horizontal scroll — nodes wrap. */
function FloorPlan({
  tables,
  bestTableId,
  loading,
  t,
}: {
  tables: TableRow[];
  bestTableId: string | null;
  loading: boolean;
  t: Translate;
}) {
  // Scale basis: prefer revenue across the floor; fall back to views if the
  // whole floor has zero revenue yet (early life — scans but no orders).
  const maxRevenue = tables.reduce((m, x) => Math.max(m, x.revenue), 0);
  const maxViews = tables.reduce((m, x) => Math.max(m, x.views), 0);
  const useRevenueForSize = maxRevenue > 0;
  const sizeMax = useRevenueForSize ? maxRevenue : maxViews;

  const floorClass =
    'relative rounded-3xl border border-amber-200/15 bg-zinc-950/40 p-5 sm:p-7 ' +
    'before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl ' +
    "before:bg-[linear-gradient(rgba(251,191,36,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.05)_1px,transparent_1px)] " +
    'before:bg-[size:32px_32px] before:opacity-60';

  if (loading && tables.length === 0) {
    return (
      <div className={floorClass}>
        <div className="relative flex flex-wrap items-end gap-5 sm:gap-7">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="rounded-2xl" style={{ width: NODE_MIN_PX + (i % 3) * 18, height: NODE_MIN_PX + (i % 3) * 18 }} />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <HoverLift accent={FLOOR_ACCENT} className="relative">
        <AccentWash accent={FLOOR_ACCENT} className="rounded-3xl" />
        <div className={`${floorClass} grid min-h-[260px] place-items-center text-center`}>
          <div className="relative max-w-sm">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-amber-200/25 text-amber-200/70">
              <QrCode size={24} strokeWidth={1.6} />
            </span>
            <p className="text-white/70" style={{ fontFamily: serif, fontStyle: 'italic', fontSize: '1.3rem' }}>
              {t('An empty floor — for now.', 'רצפה ריקה — לבינתיים.')}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-white/40" style={{ fontFamily: sans }}>
              {t(
                'Place a QR on each table. As guests scan, tables light up by revenue and orders.',
                'הנח QR על כל שולחן. ככל שאורחים סורקים, השולחנות נדלקים לפי הכנסה והזמנות.',
              )}
            </p>
          </div>
        </div>
      </HoverLift>
    );
  }

  return (
    <HoverLift accent={FLOOR_ACCENT} className="relative">
      <AccentWash accent={FLOOR_ACCENT} className="rounded-3xl" />
      <div className={floorClass}>
        <Stagger className="relative flex flex-wrap items-end justify-center gap-5 sm:gap-7">
          {tables.map((row) => (
            <FloorNode
              key={row.tableId}
              row={row}
              sizeRatio={normalize(useRevenueForSize ? row.revenue : row.views, sizeMax)}
              isBest={bestTableId === row.tableId}
              t={t}
            />
          ))}
        </Stagger>
      </div>
    </HoverLift>
  );
}

/** A single table tile on the floor. */
function FloorNode({
  row,
  sizeRatio,
  isBest,
  t,
}: {
  row: TableRow;
  sizeRatio: number;
  isBest: boolean;
  t: Translate;
}) {
  const accent = getAccent(signatureSlug(row.tableId));
  const size = NODE_MIN_PX + sizeRatio * (NODE_MAX_PX - NODE_MIN_PX);
  const heat = FAINT_HEAT + (Math.min(100, Math.max(0, row.conversionPct)) / 100) * (FULL_HEAT - FAINT_HEAT);

  return (
    <motion.div variants={staggerItem} className="group/node relative flex flex-col items-center gap-1.5">
      <button
        type="button"
        className="relative grid place-items-center rounded-[28%] outline-none transition-transform duration-300 focus-visible:scale-[1.06] group-hover/node:-translate-y-1 group-hover/node:scale-[1.06]"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 50% 38%, rgba(251,191,36,${heat}), rgba(251,191,36,${heat * 0.35}) 70%, rgba(24,24,27,0.85))`,
          border: `1px solid ${isBest ? '#fbbf24aa' : `rgba(251,191,36,${0.25 + heat * 0.4})`}`,
          boxShadow: `0 0 ${10 + heat * 34}px -6px rgba(251,191,36,${heat}), inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
        aria-label={`${t('Table', 'שולחן')} ${row.tableId}: ${row.views} ${t('views', 'צפיות')}, ${row.orders} ${t('orders', 'הזמנות')}, ${ils(row.revenue)}, ${row.conversionPct.toFixed(1)}% ${t('order rate', 'אחוז הזמנה')}`}
      >
        {/* hover/focus ring */}
        <span
          className="pointer-events-none absolute inset-[-5px] rounded-[30%] opacity-0 transition-opacity duration-300 group-hover/node:opacity-100 group-focus-within/node:opacity-100"
          style={{ border: `1px solid ${accent}66` }}
          aria-hidden
        />
        {isBest && (
          <span className="absolute -top-2.5 -end-1.5 grid h-6 w-6 place-items-center rounded-full bg-zinc-950 text-amber-300 ring-1 ring-amber-300/50" aria-hidden>
            <Crown size={13} strokeWidth={2} />
          </span>
        )}
        <span
          className="leading-none text-white"
          style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 700, fontSize: `clamp(1.1rem, ${size / 44}rem, 2rem)` }}
        >
          {row.tableId}
        </span>

        {/* hover/focus stat popover — pointer-events-none so it never blocks taps */}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-10 w-max -translate-x-1/2 scale-95 rounded-xl border border-white/12 bg-zinc-900/95 px-3 py-2 text-left opacity-0 shadow-xl backdrop-blur transition-all duration-200 group-hover/node:scale-100 group-hover/node:opacity-100 group-focus-within/node:scale-100 group-focus-within/node:opacity-100"
          dir="ltr"
        >
          <span className="block text-[11px] text-white/55" style={{ fontFamily: sans }}>
            {t('Table', 'שולחן')} {row.tableId}
          </span>
          <span className="mt-1 block whitespace-nowrap text-[12px] text-white/85" style={{ fontFamily: sans }}>
            {row.views.toLocaleString()} {t('views', 'צפיות')}
            <span className="text-white/30"> · </span>
            {row.orders.toLocaleString()} {t('orders', 'הזמנות')}
          </span>
          <span className="mt-0.5 block whitespace-nowrap text-[12px]" style={{ fontFamily: sans }}>
            <span className="text-emerald-300">{ils(row.revenue)}</span>
            <span className="text-white/30"> · </span>
            <span style={{ color: accent }}>{row.conversionPct.toFixed(1)}%</span>
          </span>
        </span>
      </button>

      {/* always-visible key stat (touch-friendly) */}
      <span className="text-[10px] leading-none text-white/45" style={{ fontFamily: sans }}>
        {row.revenue > 0 ? ils(row.revenue) : `${row.views.toLocaleString()} ${t('views', 'צפיות')}`}
      </span>
    </motion.div>
  );
}

export default function TablesPage() {
  return (
    <AdminShell
      title="Tables"
      titleHe="שולחנות"
      eyebrow="Table Attribution"
      eyebrowHe="ייחוס לפי שולחן"
      active="/admin/tables"
      subtitle="Generate a unique QR per table, then see scans → views → orders → revenue for each one. The strongest signal a venue owner can act on."
      subtitleHe="ייצר QR ייחודי לכל שולחן, ואז ראה סריקות ← צפיות ← הזמנות ← הכנסה לכל שולחן. האות החזק ביותר שבעל מקום יכול לפעול לפיו."
    >
      <TablesPanel />
    </AdminShell>
  );
}

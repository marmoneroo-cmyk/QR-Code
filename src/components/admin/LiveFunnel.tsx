'use client';

import { useCallback, useMemo, useState } from 'react';
import { MENU, type Lang } from '@/data/cocktail';
import { useNow } from '@/lib/useNow';
import { useApiData } from '@/lib/data/useApiData';

/**
 * LiveFunnel — the first REAL (non-demo) analytics surface. Fetches the
 * per-cocktail conversion funnel from /api/analytics/funnel and renders
 * Seen → Opened → Ingredients → 360/AR → Called → Ordered with drop-off bars.
 */

interface FunnelRow {
  cocktailSlug: string;
  seen: number;
  opened: number;
  ingredients: number;
  breakdown: number;
  called: number;
  ordered: number;
  units: number;
  flag?: 'leak' | 'high_converter' | null;
}

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

const STAGES = [
  { key: 'seen', en: 'Seen', he: 'נצפה' },
  { key: 'opened', en: 'Opened', he: 'נפתח' },
  { key: 'ingredients', en: 'Ingredients', he: 'מרכיבים' },
  { key: 'breakdown', en: '360 / AR', he: '360 / AR' },
  { key: 'called', en: 'Called waiter', he: 'קרא למלצר' },
  { key: 'ordered', en: 'Ordered', he: 'הוזמן' },
] as const;

export function LiveFunnel({ lang }: { lang: Lang }) {
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const titleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of MENU) map.set(c.slug, c.title[lang]);
    return map;
  }, [lang]);

  // Polls every 10s; SWR's default revalidateOnFocus replaces the old visibilitychange
  // listener. onSuccess fires after every successful fetch (poll, focus, or manual reload),
  // so updatedAt bumps exactly like the old `setUpdatedAt(Date.now())` did — without ever
  // calling Date.now() during render.
  const {
    data: rawRows,
    loading,
    error: fetchError,
    reload,
  } = useApiData<FunnelRow[]>('/api/analytics/funnel', {
    refreshInterval: 10000,
    onSuccess: () => setUpdatedAt(Date.now()),
  });

  const error = Boolean(fetchError);

  // Keep any cocktail with activity in ANY stage (direct QR visits have seen=0 but
  // opened>0 — they must still appear). Derived from the raw payload each render instead
  // of being filtered once at fetch time.
  const rows = useMemo(() => {
    if (!rawRows) return null;
    return rawRows.filter((r) => r.seen + r.opened + r.ingredients + r.breakdown + r.called + r.ordered > 0);
  }, [rawRows]);

  // Wraps reload so the refresh button's dot still pings on a manual click — useApiData's
  // `loading` only covers the very first load, so background polls fall back to the idle
  // pulse (useApiData doesn't surface SWR's isValidating).
  const load = useCallback(() => {
    setManualRefreshing(true);
    reload().finally(() => setManualRefreshing(false));
  }, [reload]);
  const refreshing = loading || manualRefreshing;

  const now = useNow(1000);
  const agoLabel = (() => {
    if (updatedAt === null) return '';
    const secs = Math.max(0, Math.round((now - updatedAt) / 1000));
    if (secs < 5) return t('updated just now', 'עודכן הרגע');
    return t(`updated ${secs}s ago`, `עודכן לפני ${secs} ש׳`);
  })();

  return (
    <section className="mb-12 rounded-2xl border border-amber-200/20 bg-gradient-to-b from-amber-950/10 to-black p-6">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <p className="text-amber-200/80 text-10 tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
          {t('Conversion funnel · live', 'משפך המרה · חי')}
        </p>
        <div className="flex items-center gap-3">
          {updatedAt !== null && (
            <span className="text-white/70 text-9 tracking-wider" style={{ fontFamily: sans }}>
              {agoLabel}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300/30 hover:border-emerald-300/70 text-emerald-200/90 text-9 tracking-[0.3em] uppercase transition-colors"
            style={{ fontFamily: sans }}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${refreshing ? 'animate-ping' : 'animate-pulse'}`} />
            {t('refresh', 'רענון')}
          </button>
        </div>
      </div>

      {/* Stage legend — clarifies what each step means */}
      <p className="text-white/70 text-10 leading-relaxed mb-5" style={{ fontFamily: sans }} dir={isHebrew ? 'rtl' : 'ltr'}>
        {t(
          'Seen = card viewed in the menu · Opened = entered the drink page · Ingredients/360/Waiter = actions inside · Ordered = guests who ordered · units = total drinks.',
          'נצפה = הכרטיס נראה בתפריט · נפתח = כניסה לעמוד המשקה · מרכיבים/360/מלצר = פעולות בפנים · הוזמן = אורחים שהזמינו · יח׳ = סך הכוסות.',
        )}
      </p>

      {error && (
        <p className="text-white/70 text-sm" style={{ fontFamily: sans }}>
          {t('Could not load live data (is Supabase + migration 0004 applied?).', 'לא ניתן לטעון נתונים חיים (האם Supabase + migration 0004 הוחלו?).')}
        </p>
      )}

      {!error && rows === null && (
        <p className="text-white/70 text-sm" style={{ fontFamily: sans }}>
          {t('Loading…', 'טוען…')}
        </p>
      )}

      {!error && rows !== null && rows.length === 0 && (
        <p className="text-white/70 text-sm leading-relaxed" style={{ fontFamily: sans }}>
          {t(
            'No interactions captured yet. Open the menu, view a cocktail, tap ingredients / 360 / order — events appear here within seconds.',
            'עדיין לא נקלטו אינטראקציות. פתח את התפריט, צפה בקוקטייל, לחץ מרכיבים / 360 / הזמנה — האירועים יופיעו כאן תוך שניות.',
          )}
        </p>
      )}

      {!error && rows !== null && rows.length > 0 && (
        <div className="space-y-6">
          {rows.slice(0, 6).map((row) => {
            // Bars are proportional to the largest stage (handles direct visits
            // where seen < opened). Conversion is vs. the funnel entry point.
            const base = Math.max(1, row.seen, row.opened, row.ingredients, row.breakdown, row.called, row.ordered);
            const entry = Math.max(1, row.seen, row.opened);
            const convPct = ((row.ordered / entry) * 100).toFixed(1);
            return (
              <div key={row.cocktailSlug}>
                <div className="flex items-baseline justify-between mb-2 gap-3" dir={isHebrew ? 'rtl' : 'ltr'}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-white/90 truncate" style={{ fontFamily: serif, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                      {titleBySlug.get(row.cocktailSlug) ?? row.cocktailSlug}
                    </span>
                    {row.flag === 'leak' && (
                      <span className="shrink-0 text-rose-200 text-9 tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border border-rose-400/40" style={{ fontFamily: sans }}>
                        ⚠ {t('leak', 'דליפה')}
                      </span>
                    )}
                    {row.flag === 'high_converter' && (
                      <span className="shrink-0 text-emerald-200 text-9 tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border border-emerald-300/40" style={{ fontFamily: sans }}>
                        ★ {t('high converter', 'שיעור הזמנות גבוה')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    {row.units > 0 && (
                      <span className="text-emerald-200/90 text-xs font-mono">
                        {row.units} {t('units', 'יח׳')}
                      </span>
                    )}
                    <span className="text-amber-100/90 text-xs font-mono">
                      {t('conv', 'המרה')} {convPct}%
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2" dir={isHebrew ? 'rtl' : 'ltr'}>
                  {STAGES.map((stage) => {
                    const value = row[stage.key] as number;
                    const pct = Math.round((value / base) * 100);
                    return (
                      <div key={stage.key} className="min-w-0">
                        <div className="h-12 rounded-md bg-white/[0.04] relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-400/70 to-amber-200/40"
                            style={{ height: `${Math.max(4, pct)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-mono">
                            {value}
                          </span>
                        </div>
                        <p className="text-white/70 text-8 tracking-wider uppercase mt-1 text-center truncate" style={{ fontFamily: sans }}>
                          {t(stage.en, stage.he)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

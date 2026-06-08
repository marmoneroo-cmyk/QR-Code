'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Link2, Eye, Sparkles, Wand2, ArrowRight, ArrowLeft } from 'lucide-react';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, Pill, Skeleton, LiveDot } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import type { CoViewRow, Recommendations } from '@/lib/analytics/recommendations-types';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';
const PAIR_ACCENT = '#7dd3fc';

/** Co-view strength → presentational AI-confidence %. More shared sessions = stronger signal. */
function pairingConfidence(row: CoViewRow): number {
  const top = row.related[0]?.coViews ?? 0;
  return Math.min(95, 58 + top * 6);
}

export default function RecommendationsPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const [data, setData] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);

  const titleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of MENU) map.set(c.slug, c.title[lang]);
    return map;
  }, [lang]);

  const titleOf = useCallback(
    (slug: string): string => titleBySlug.get(slug) ?? slug,
    [titleBySlug],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/recommendations', { cache: 'no-store' });
      const json: { success: boolean; data?: Recommendations } = await res.json();
      if (json.success && json.data) setData(json.data);
    } catch {
      /* keep last good */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const rows: CoViewRow[] = data?.rows ?? [];
  const hasData = data?.hasData ?? false;
  // Arrow points toward reading flow: left in RTL (Hebrew), right in LTR.
  const ApplyArrow = isHebrew ? ArrowLeft : ArrowRight;

  return (
    <AdminShell
      title="Recommendations"
      titleHe="המלצות"
      eyebrow="Behavioral · co-view"
      eyebrowHe="התנהגותי · צפייה משותפת"
      active="/admin/recommendations"
      subtitle="Guests who viewed one drink also viewed these — surface natural pairings and upsells straight from real browsing behaviour."
      subtitleHe="אורחים שצפו במשקה אחד צפו גם באלה — חשוף שילובים טבעיים והגדלת מכירה ישירות מהתנהגות גלישה אמיתית."
      actions={<LiveDot label={t('Live', 'חי')} />}
    >
      {loading && rows.length === 0 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-12" dir={isHebrew ? 'rtl' : 'ltr'}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="px-5 pt-5">
                <Skeleton className="h-36 w-full rounded-2xl" />
              </div>
              <div className="flex flex-col gap-2.5 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {!loading && !hasData && (
        <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-10 text-center">
          <p className="text-amber-200/80 text-[10px] tracking-[0.4em] uppercase mb-4" style={{ fontFamily: sans }}>
            {t('No co-views yet', 'אין צפיות משותפות עדיין')}
          </p>
          <p className="text-white/55 text-sm leading-relaxed max-w-xl mx-auto" style={{ fontFamily: sans }} dir={isHebrew ? 'rtl' : 'ltr'}>
            {t(
              'Co-views appear once guests browse more than one drink in the same session. As traffic grows, this page reveals which cocktails are explored together.',
              'צפיות משותפות מופיעות כאשר אורחים מעיינים ביותר ממשקה אחד באותו ביקור. ככל שהתנועה גדלה, עמוד זה חושף אילו קוקטיילים נחקרים יחד.',
            )}
          </p>
        </section>
      )}

      {hasData && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-12" dir={isHebrew ? 'rtl' : 'ltr'}>
          {rows.map((row) => {
            const cocktail = findCocktailBySlug(row.slug);
            const accent = getAccent(row.slug);
            const title = cocktail?.title[lang] ?? row.slug;
            const top = row.related[0];
            const confidence = pairingConfidence(row);

            return (
              <article
                key={row.slug}
                className="group relative flex flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.05] to-transparent transition-colors"
                style={{ borderColor: `${accent}33` }}
              >
                {/* Visual: contained cocktail glass with accent glow (never crops). */}
                <div className="relative grid place-items-center px-5 pt-5">
                  {cocktail ? (
                    <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-36 transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-36 rounded-2xl border border-white/10 bg-white/[0.02]" aria-hidden />
                  )}
                  <span className="absolute top-4 start-4">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] tracking-[0.18em] uppercase"
                      style={{ color: PAIR_ACCENT, background: `${PAIR_ACCENT}1a`, border: `1px solid ${PAIR_ACCENT}55`, fontFamily: sans, fontWeight: 600 }}
                    >
                      <Link2 size={12} strokeWidth={2} /> {t('Pairing', 'שילוב')}
                    </span>
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="text-white/95 text-[17px] leading-tight"
                      style={{ fontFamily: isHebrew ? serifHe : serif, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 600 }}
                    >
                      {title}
                    </h3>
                    <span className="shrink-0">
                      <ConfidenceBadge pct={confidence} label={t('AI confidence', 'ביטחון AI')} />
                    </span>
                  </div>

                  {top ? (
                    <p className="text-white text-[14px] leading-snug" style={{ fontFamily: sans, fontWeight: 500 }}>
                      <Sparkles size={13} strokeWidth={2} className="inline mb-0.5 me-1" style={{ color: accent }} />
                      {t('Pair with', 'שלבו עם')} {titleOf(top.slug)}
                    </p>
                  ) : (
                    <p className="text-white/40 text-[13px] italic" style={{ fontFamily: sans }}>
                      {t('No pairing yet for this drink.', 'אין עדיין שילוב למשקה זה.')}
                    </p>
                  )}

                  {row.related.length > 0 && (
                    <p className="text-white/50 text-[12px] leading-relaxed" style={{ fontFamily: sans }}>
                      {t('Guests who viewed this also explored these — natural upsells.', 'אורחים שצפו בזה חקרו גם את אלה — הגדלת מכירה טבעית.')}
                    </p>
                  )}

                  <div className="mt-auto flex flex-col gap-2.5 pt-1">
                    {row.related.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {row.related.slice(0, 3).map((rel) => (
                          <span
                            key={rel.slug}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                            style={{ borderColor: `${getAccent(rel.slug)}55`, background: `${getAccent(rel.slug)}12`, color: 'rgba(255,255,255,0.82)', fontFamily: sans }}
                          >
                            {titleOf(rel.slug)}
                            <span className="font-mono text-[10px]" style={{ color: getAccent(rel.slug) }}>×{rel.coViews}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <Pill
                      icon={Eye}
                      accent={PAIR_ACCENT}
                      text={`${row.views} ${t('co-view sessions (est.)', 'ביקורים משותפים (הערכה)')}`}
                    />

                    <Link
                      href={`/admin/promotions?cocktail=${encodeURIComponent(row.slug)}`}
                      className="group/apply inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] tracking-[0.12em] uppercase transition-colors hover:bg-amber-300/20"
                      style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.45)', fontFamily: sans, fontWeight: 600 }}
                    >
                      <Wand2 size={13} strokeWidth={2} className="shrink-0" />
                      {t('Create promotion', 'צור מבצע')}
                      <ApplyArrow size={13} strokeWidth={2} className="shrink-0 transition-transform group-hover/apply:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {hasData && (
        <p className="text-center text-white/30 text-[10px] tracking-[0.4em] uppercase pt-6 border-t border-white/10" style={{ fontFamily: sans }}>
          {t('Co-views counted per guest session · use for pairings & upsell', 'צפיות משותפות נספרות לכל ביקור · לשילובים והגדלת מכירה')}
        </p>
      )}
    </AdminShell>
  );
}

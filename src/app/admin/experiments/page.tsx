'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, ArrowUpRight, ArrowDownRight, FlaskConical, Hourglass } from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, ConfidenceBadge, Skeleton, LiveDot } from '@/components/ui/dataviz';
import { GlassCard } from '@/components/ui/premium';
import { Stagger, staggerItem } from '@/components/ui/motion';
import { motion } from 'framer-motion';
import { useLang } from '@/lib/useLang';
import { findCocktailBySlug, getAccent } from '@/data/cocktail';
import type { ExperimentResult, VariantResult, ExperimentsResponse } from '@/lib/experiments/results-types';

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

/**
 * Optional mapping from an experiment id to the cocktail it is tested on.
 * Only experiments that visibly change a specific drink get an image; the
 * current copy test ("order-cta") is menu-wide, so it has no slug here.
 * Add entries as drink-specific experiments are introduced.
 */
const EXPERIMENT_COCKTAIL: Record<string, string> = {};

function experimentSlug(exp: ExperimentResult): string | undefined {
  return EXPERIMENT_COCKTAIL[exp.id];
}

/** The leading non-control variant — the challenger whose uplift we headline. */
function challengerOf(exp: ExperimentResult): VariantResult | undefined {
  return exp.variants
    .filter((v) => !v.isControl)
    .sort((a, b) => b.conversionPct - a.conversionPct)[0];
}

export default function ExperimentsPage() {
  const { lang } = useLang();
  const isHebrew = lang === 'he';
  const t = (en: string, he: string): string => (isHebrew ? he : en);
  const [data, setData] = useState<ExperimentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/experiments/results', { cache: 'no-store' });
      const json: { success: boolean; data?: ExperimentsResponse } = await res.json();
      if (json.success && json.data) setData(json.data);
    } catch {
      /* keep last good */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const experiments = data?.experiments ?? [];

  return (
    <AdminShell
      title="Experiments"
      titleHe="ניסויים"
      eyebrow="A/B Testing"
      eyebrowHe="בדיקות A/B"
      active="/admin/experiments"
      subtitle="Live split tests with conversion uplift and statistical significance — sessions are split deterministically and measured against real orders."
      subtitleHe="בדיקות פיצול חיות עם שיפור המרה ומובהקות סטטיסטית — ה-sessions מפוצלים דטרמיניסטית ונמדדים מול הזמנות אמיתיות."
      actions={<LiveDot label={t('Live', 'חי')} />}
    >
      {loading && experiments.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir={isHebrew ? 'rtl' : 'ltr'}>
          {Array.from({ length: 2 }).map((_, i) => (
            <GlassCard key={i} static className="p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {Array.from({ length: 2 }).map((__, j) => (
                  <div key={j} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <Skeleton className="mb-2.5 h-4 w-20" />
                    <Skeleton className="mb-2 h-7 w-16" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <div dir={isHebrew ? 'rtl' : 'ltr'}>
      <Stagger className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {experiments.map((exp) => {
          const slug = experimentSlug(exp);
          const cocktail = slug ? findCocktailBySlug(slug) : undefined;
          const accent = slug ? getAccent(slug) : '#e8c987';
          const challenger = challengerOf(exp);
          const up = (challenger?.upliftPct ?? 0) >= 0;

          return (
            <motion.div key={exp.id} variants={staggerItem}>
            <GlassCard
              accent={accent}
              className="p-6 flex flex-col h-full"
              style={{ boxShadow: exp.significant ? '0 30px 90px -50px rgba(52,211,153,0.6)' : undefined }}
            >
              {/* tested cocktail — only when a real drink is mapped */}
              {cocktail && (
                <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-28 mb-4" />
              )}

              {/* hypothesis / title + significance */}
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                <p className="inline-flex items-center gap-2 text-white/90 text-lg" style={{ fontFamily: serif, fontStyle: isHebrew ? 'normal' : 'italic' }}>
                  <FlaskConical size={16} strokeWidth={1.8} className="text-amber-200/70 shrink-0" />
                  {cocktail ? cocktail.title[lang] : exp.attribute[lang]}
                </p>
                {exp.significant ? (
                  <ConfidenceBadge pct={Math.round(exp.confidencePct)} label={t('significance', 'מובהקות')} />
                ) : exp.hasData ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase" style={{ borderColor: 'rgba(251,191,36,0.4)', color: '#fbbf24', fontFamily: sans }}>
                    <Hourglass size={11} strokeWidth={2} /> {t('collecting data', 'אוסף נתונים')} · {Math.round(exp.confidencePct)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase" style={{ borderColor: 'rgba(251,191,36,0.4)', color: '#fbbf24', fontFamily: sans }}>
                    <Hourglass size={11} strokeWidth={2} /> {t('collecting data', 'אוסף נתונים')}
                  </span>
                )}
              </div>
              {cocktail && (
                <p className="text-white/45 text-[11px] mb-3 tracking-wide" style={{ fontFamily: sans }}>{exp.attribute[lang]}</p>
              )}

              {/* A vs B variant mini-panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {exp.variants.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-2xl border p-4 ${
                      v.isWinner ? 'border-emerald-300/50 bg-emerald-950/20' : 'border-white/10 bg-black/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="inline-flex items-center gap-1.5 text-white/85 text-[13px]" style={{ fontFamily: sans }}>
                        {v.label[lang]}
                        {v.isControl && (
                          <span className="text-white/30 text-[9px] tracking-wider uppercase">{t('control', 'בקרה')}</span>
                        )}
                      </span>
                      {v.isWinner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] tracking-[0.15em] uppercase text-emerald-300" style={{ fontFamily: sans }}>
                          <Trophy size={11} strokeWidth={2} /> {t('winner', 'מנצח')}
                        </span>
                      )}
                    </div>
                    <p className="text-2xl tabular-nums" style={{ fontFamily: serif, fontWeight: 700, color: v.isWinner ? '#6ee7b7' : '#fde68a' }}>
                      {v.conversionPct.toFixed(1)}<span className="text-base text-white/40">%</span>
                    </p>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden my-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, v.conversionPct)}%`,
                          background: v.isWinner
                            ? 'linear-gradient(90deg, rgba(110,231,183,0.5), rgba(52,211,153,0.9))'
                            : 'linear-gradient(90deg, rgba(251,191,36,0.4), rgba(251,191,36,0.8))',
                        }}
                      />
                    </div>
                    <p className="text-white/45 text-[11px] tabular-nums" style={{ fontFamily: sans }}>
                      {v.conversions}/{v.exposures} {t('converted', 'המירו')}
                    </p>
                  </div>
                ))}
              </div>

              {/* headline lift */}
              {challenger && exp.hasData && challenger.exposures > 0 && (
                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
                  <span className="text-white/40 text-[10px] tracking-[0.25em] uppercase" style={{ fontFamily: sans }}>
                    {t('Lift vs control', 'שיפור מול בקרה')}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-3xl leading-none tabular-nums ${up ? 'text-emerald-300' : 'text-rose-300'}`} style={{ fontFamily: serif, fontWeight: 700 }}>
                    {up ? <ArrowUpRight size={26} strokeWidth={2.2} /> : <ArrowDownRight size={26} strokeWidth={2.2} />}
                    {up ? '+' : '−'}{Math.abs(challenger.upliftPct).toFixed(0)}%
                  </span>
                </div>
              )}

              {!exp.hasData && (
                <p className="text-white/40 text-[12px] mt-4 pt-4 border-t border-white/10" style={{ fontFamily: sans }}>
                  {t(
                    'No exposures yet — open a cocktail and use the order bar; each session is split between variants and measured here.',
                    'עדיין אין חשיפות — פתח קוקטייל והשתמש בסרגל ההזמנה; כל session מפוצל בין הוריאציות ונמדד כאן.',
                  )}
                </p>
              )}
            </GlassCard>
            </motion.div>
          );
        })}
      </Stagger>
      </div>

      <p className="text-center text-white/30 text-[10px] tracking-[0.4em] uppercase pt-8 mt-8 border-t border-white/10" style={{ fontFamily: sans }}>
        {t('Sessions split deterministically · winner declared at 95% significance', 'פיצול דטרמיניסטי · מנצח נקבע ב-95% מובהקות')}
      </p>
    </AdminShell>
  );
}

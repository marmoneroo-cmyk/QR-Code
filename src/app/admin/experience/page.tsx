'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Tags,
  Zap,
  LayoutGrid,
  Eye,
  Check,
  Video,
  FlaskConical,
  BookOpen,
  Gauge,
  Wine,
  Layers,
  Smile,
} from 'lucide-react';
import { AdminShell } from '@/components/ui/AdminShell';
import { GlassImage, SectionLabel, Skeleton } from '@/components/ui/dataviz';
import { useLang } from '@/lib/useLang';
import { MENU, findCocktailBySlug, getAccent } from '@/data/cocktail';
import type { ExperienceConfig, ExperienceModule, BadgeKind, BadgeConfig } from '@/lib/experience/types';

const MANUAL_BADGES: BadgeKind[] = ['signature', 'new_item', 'limited_time', 'seasonal'];
const AUTO_BADGES: BadgeKind[] = ['guest_favorite', 'trending'];
const MODULES: ExperienceModule[] = [
  'hero_video',
  'ingredient_breakdown',
  'story',
  'taste_profile',
  'perfect_pairings',
  'related_items',
  'mood_tags',
];

const MODULE_LABEL: Record<ExperienceModule, { en: string; he: string }> = {
  hero_video: { en: 'Hero video', he: 'סרטון' },
  ingredient_breakdown: { en: 'Breakdown', he: 'מרכיבים' },
  story: { en: 'Story', he: 'סיפור' },
  taste_profile: { en: 'Taste profile', he: 'פרופיל טעם' },
  perfect_pairings: { en: 'Pairings', he: 'התאמות' },
  related_items: { en: 'Related', he: 'קשורים' },
  mood_tags: { en: 'Mood tags', he: 'תגיות מצב' },
};

const MODULE_ICON: Record<ExperienceModule, LucideIcon> = {
  hero_video: Video,
  ingredient_breakdown: FlaskConical,
  story: BookOpen,
  taste_profile: Gauge,
  perfect_pairings: Wine,
  related_items: Layers,
  mood_tags: Smile,
};

const BADGE_LABEL: Record<BadgeKind, { en: string; he: string }> = {
  signature: { en: 'Signature', he: 'קוקטייל הבית' },
  new_item: { en: 'New', he: 'חדש' },
  limited_time: { en: 'Limited', he: 'מוגבל' },
  seasonal: { en: 'Seasonal', he: 'עונתי' },
  guest_favorite: { en: 'Guest Fav (auto)', he: 'מועדף (אוטו)' },
  trending: { en: 'Trending (auto)', he: 'חם (אוטו)' },
  happy_hour: { en: 'Happy Hour', he: 'שעה שמחה' },
  discount: { en: 'Discount', he: 'הנחה' },
  custom: { en: 'Custom', he: 'מותאם' },
};

interface ItemState {
  manual: Set<BadgeKind>;
  auto: Set<BadgeKind>;
  disabledModules: Set<ExperienceModule>;
}

function configToState(cfg: ExperienceConfig | undefined): ItemState {
  const manual = new Set<BadgeKind>();
  const auto = new Set<BadgeKind>();
  for (const b of cfg?.badges ?? []) {
    if (b.enabled && b.mode === 'manual') manual.add(b.kind);
    if (b.enabled && b.mode === 'auto') auto.add(b.kind);
  }
  const disabledModules = new Set<ExperienceModule>();
  for (const m of MODULES) if (cfg?.modules?.[m]?.enabled === false) disabledModules.add(m);
  return { manual, auto, disabledModules };
}

function stateToConfig(s: ItemState): ExperienceConfig {
  const badges: BadgeConfig[] = [
    ...[...s.manual].map((kind) => ({ kind, mode: 'manual' as const, enabled: true })),
    ...[...s.auto].map((kind) => ({ kind, mode: 'auto' as const, enabled: true })),
  ];
  const modules: ExperienceConfig['modules'] = {};
  for (const m of s.disabledModules) modules[m] = { enabled: false };
  return { badges, modules };
}

const sans = 'var(--font-inter, sans-serif)';
const serif = 'var(--font-playfair, serif)';

export function ExperiencePanel() {
  const { lang } = useLang();
  const isHe = lang === 'he';
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let dbConfig: Record<string, ExperienceConfig> = {};
    try {
      const res = await fetch('/api/experience/mine', { cache: 'no-store' });
      const json: { success: boolean; data?: Record<string, ExperienceConfig> } = await res.json();
      if (json.success && json.data) dbConfig = json.data;
    } catch {
      // start empty
    }
    const next: Record<string, ItemState> = {};
    for (const c of MENU) next[c.slug] = configToState(dbConfig[c.slug]);
    setStates(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBadge = (slug: string, kind: BadgeKind, auto: boolean) =>
    setStates((prev) => {
      const s = prev[slug];
      if (!s) return prev;
      const set = new Set(auto ? s.auto : s.manual);
      if (set.has(kind)) set.delete(kind);
      else set.add(kind);
      return { ...prev, [slug]: { ...s, [auto ? 'auto' : 'manual']: set } };
    });

  const toggleModule = (slug: string, m: ExperienceModule) =>
    setStates((prev) => {
      const s = prev[slug];
      if (!s) return prev;
      const set = new Set(s.disabledModules);
      if (set.has(m)) set.delete(m);
      else set.add(m);
      return { ...prev, [slug]: { ...s, disabledModules: set } };
    });

  const save = async (slug: string) => {
    const s = states[slug];
    if (!s) return;
    setSaving(slug);
    setSaved(null);
    setSaveError(null);
    try {
      const res = await fetch('/api/experience', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, config: stateToConfig(s) }),
      });
      const json: { success: boolean } = await res.json();
      if (json.success) {
        setSaved(slug);
      } else {
        setSaveError(slug);
      }
    } catch {
      setSaveError(slug);
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir={isHe ? 'rtl' : 'ltr'} aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.02]">
              <Skeleton className="h-48 w-full rounded-none" />
              <div className="flex items-center justify-between gap-3 px-6 pt-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
              <div className="px-6 pt-5">
                <Skeleton className="h-2.5 w-16 mb-3" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Skeleton key={j} className="h-7 w-20 rounded-full" />
                  ))}
                </div>
              </div>
              <div className="px-6 pb-6 pt-5">
                <Skeleton className="h-2.5 w-24 mb-3" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton key={j} className="h-7 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir={isHe ? 'rtl' : 'ltr'}>
          {MENU.map((c) => {
            const s = states[c.slug];
            if (!s) return null;
            const cocktail = findCocktailBySlug(c.slug);
            const accent = getAccent(c.slug);
            const activeBadges = s.manual.size + s.auto.size;
            const liveModules = MODULES.length - s.disabledModules.size;
            const isSaving = saving === c.slug;
            const isSaved = saved === c.slug;
            const isSaveError = saveError === c.slug;
            // Derived LIVE from the in-memory toggle state `s` (same Sets the toggles mutate),
            // so the preview reflects unsaved changes instantly. Order = config order, auto last.
            const previewBadges: { kind: BadgeKind; auto: boolean }[] = [
              ...MANUAL_BADGES.filter((k) => s.manual.has(k)).map((kind) => ({ kind, auto: false })),
              ...AUTO_BADGES.filter((k) => s.auto.has(k)).map((kind) => ({ kind, auto: true })),
            ];
            const previewModules = MODULES.filter((m) => !s.disabledModules.has(m));
            return (
              <article
                key={c.slug}
                className="relative flex flex-col overflow-hidden rounded-[1.75rem] border bg-white/[0.02]"
                style={{ borderColor: `${accent}33`, boxShadow: `0 30px 90px -60px ${accent}` }}
              >
                {/* LIVE guest-view preview — a compact phone-frame mock of the diner menu card.
                    Everything below is derived from `s` so it updates instantly as toggles change. */}
                <div className="relative px-6 pt-6" style={{ background: `linear-gradient(150deg, ${accent}14, rgba(8,8,10,0.5) 75%)` }}>
                  <span
                    className="absolute top-4 start-4 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-9 uppercase tracking-[0.22em] backdrop-blur-md"
                    style={{ background: 'rgba(0,0,0,0.4)', color: accent, border: `1px solid ${accent}55`, fontFamily: sans }}
                  >
                    <Eye size={11} strokeWidth={2} /> {isHe ? 'תצוגת אורח' : 'Guest view'}
                  </span>

                  {/* Phone frame: rounded bezel + notch sells the "this is the diner's screen" feel. */}
                  <div className="mx-auto w-full max-w-[260px]">
                    <div
                      className="relative overflow-hidden rounded-[2rem] border border-white/12 p-2.5 pt-3"
                      style={{ background: 'rgba(6,6,8,0.72)', boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px -40px ${accent}` }}
                    >
                      {/* notch */}
                      <span
                        className="absolute top-1.5 left-1/2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15"
                        aria-hidden
                      />
                      {/* screen */}
                      <div
                        className="overflow-hidden rounded-[1.4rem] border border-white/10"
                        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${accent}1f, rgba(8,8,10,0.92) 70%)` }}
                        dir={isHe ? 'rtl' : 'ltr'}
                      >
                        {/* image + floating active badge chips */}
                        <div className="relative">
                          {cocktail ? (
                            <GlassImage src={cocktail.heroImage} accent={accent} className="w-full h-36" />
                          ) : (
                            <div className="h-36 w-full grid place-items-center text-white/25 text-11" style={{ fontFamily: sans }}>
                              {isHe ? 'אין תמונה' : 'No image'}
                            </div>
                          )}
                          {previewBadges.length > 0 && (
                            <div className="absolute top-2 start-2 z-10 flex max-w-[85%] flex-wrap gap-1">
                              {previewBadges.map(({ kind, auto }) => (
                                <span
                                  key={kind}
                                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-8 uppercase tracking-[0.1em] backdrop-blur-sm"
                                  style={{ background: `${accent}26`, color: accent, border: `1px solid ${accent}66`, fontFamily: sans }}
                                >
                                  {auto && <Zap size={7} strokeWidth={2.4} className="opacity-90" />}
                                  {BADGE_LABEL[kind][lang]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* title + tagline */}
                        <div className="px-3 pt-2">
                          <p
                            className="truncate text-white/95 text-sm leading-tight"
                            style={{
                              fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif,
                              fontStyle: isHe ? 'normal' : 'italic',
                              fontWeight: 600,
                            }}
                          >
                            {c.title[lang]}
                          </p>
                          {cocktail?.tagline && (
                            <p className="mt-0.5 truncate text-white/40 text-9 tracking-wide" style={{ fontFamily: sans }}>
                              {cocktail.tagline[lang]}
                            </p>
                          )}
                        </div>

                        {/* active modules — small icon row the guest will actually get */}
                        <div className="px-3 pb-3 pt-2.5">
                          {previewModules.length > 0 ? (
                            <ul className="flex flex-col gap-1.5">
                              {previewModules.map((m) => {
                                const Icon = MODULE_ICON[m];
                                return (
                                  <li key={m} className="flex items-center gap-2 text-white/70 text-10" style={{ fontFamily: sans }}>
                                    <span
                                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                                      style={{ background: `${accent}1a`, color: accent }}
                                    >
                                      <Icon size={11} strokeWidth={1.9} />
                                    </span>
                                    <span className="truncate">{MODULE_LABEL[m][lang]}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-white/30 text-10" style={{ fontFamily: sans }}>
                              {isHe ? 'אין מודולים פעילים' : 'No active modules'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Title + Save */}
                <div className="flex items-center justify-between gap-3 px-6 pt-1">
                  <div className="min-w-0">
                    <h3
                      className="truncate text-white/95 text-19 leading-tight"
                      style={{ fontFamily: isHe ? 'var(--font-frank-ruhl, serif)' : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
                    >
                      {c.title[lang]}
                    </h3>
                    <p className="mt-0.5 text-white/35 text-10 tracking-wide" style={{ fontFamily: sans }}>
                      {activeBadges} {isHe ? 'תגיות' : 'badges'} · {liveModules}/{MODULES.length} {isHe ? 'מודולים' : 'modules'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => save(c.slug)}
                    disabled={isSaving}
                    className="group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-5 py-2 text-10 uppercase tracking-[0.2em] text-black transition-shadow disabled:opacity-50"
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
                    <span className="relative z-10 inline-flex items-center gap-1.5">
                      {isSaved && !isSaving && <Check size={12} strokeWidth={2.6} />}
                      {isSaving
                        ? isHe ? 'שומר…' : 'Saving…'
                        : isSaveError
                        ? isHe ? 'השמירה נכשלה' : 'Save failed'
                        : isSaved
                        ? isHe ? 'נשמר' : 'Saved'
                        : isHe ? 'שמור' : 'Save'}
                    </span>
                  </button>
                </div>
                {isSaveError && (
                  <p className="px-6 -mt-1 text-rose-300/80 text-11" style={{ fontFamily: sans }}>
                    {isHe ? 'לא ניתן היה לשמור — בדקו את החיבור ונסו שוב.' : 'Could not save — check your connection and try again.'}
                  </p>
                )}

                {/* Badges */}
                <div className="px-6 pt-5">
                  <SectionLabel icon={Tags}>{isHe ? 'תגיות' : 'Badges'}</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {[...MANUAL_BADGES.map((k) => ({ k, auto: false })), ...AUTO_BADGES.map((k) => ({ k, auto: true }))].map(({ k, auto }) => {
                      const on = (auto ? s.auto : s.manual).has(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => toggleBadge(c.slug, k, auto)}
                          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-10 tracking-[0.08em] transition-colors"
                          style={
                            on
                              ? { borderColor: `${accent}99`, color: accent, background: `${accent}1f`, fontFamily: sans }
                              : { borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', fontFamily: sans }
                          }
                        >
                          {auto && <Zap size={10} strokeWidth={2} className="opacity-80" />}
                          {BADGE_LABEL[k][lang]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modules */}
                <div className="px-6 pb-6 pt-5">
                  <SectionLabel icon={LayoutGrid}>{isHe ? 'מודולים (כבוי = מוסתר)' : 'Modules (off = hidden)'}</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {MODULES.map((m) => {
                      const on = !s.disabledModules.has(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleModule(c.slug, m)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-10 tracking-[0.08em] transition-colors ${
                            on
                              ? 'border-emerald-300/40 text-emerald-100 bg-emerald-400/10'
                              : 'border-white/12 text-white/35 line-through'
                          }`}
                          style={{ fontFamily: sans }}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-300' : 'bg-white/25'}`} aria-hidden />
                          {MODULE_LABEL[m][lang]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function ExperienceBuilderPage() {
  return (
    <AdminShell
      title="Experience Builder"
      titleHe="בונה החוויה"
      eyebrow="Badges & modules per cocktail"
      eyebrowHe="badges ומודולים לכל קוקטייל"
      active="/admin/experience"
      subtitle="Turn content modules and badges on or off per cocktail. Auto badges activate from analytics; manual badges you control."
      subtitleHe="הפעילו/כבו מודולים ו-badges לכל קוקטייל. badges אוטומטיים נדלקים מהאנליטיקה; ידניים בשליטתכם."
    >
      <ExperiencePanel />
    </AdminShell>
  );
}

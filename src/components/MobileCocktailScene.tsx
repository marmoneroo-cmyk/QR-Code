'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { FlavorRadar } from './FlavorRadar';
import { BartenderNote } from './BartenderNote';
import { Pairings } from './Pairings';
import { AlsoViewed } from './AlsoViewed';
import { CocktailStory } from './CocktailStory';
import { SectionAttention } from './SectionAttention';
import { ShareButton } from './ShareButton';
import { LanguageToggle } from './LanguageToggle';
import { OrderBar } from './OrderBar';
import { track } from '@/lib/tracking/track';
import { getFeatureVideo, getEconomics, type CocktailConfig, type Lang, type LayerConfig } from '@/data/cocktail';
import type { ActiveModules } from '@/lib/experience/resolve';

interface MobileCocktailSceneProps {
  config: CocktailConfig;
  spacedLayers: LayerConfig[];
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  activeLayerId: string | null;
  onActiveLayer: (id: string | null) => void;
  accent: string;
  modules: ActiveModules;
}

/**
 * Phone / small-tablet layout (< 1024px). Mirrors the desktop experience for
 * a narrow screen: a CLEAR hero glass at the top, then each breakdown
 * component shown as its image WITH its description beside it (the desktop
 * "floating part + label" relationship), then flavor profile + bartender note.
 * No WebGL canvas here — image rows are sharp and reliable on phones.
 */
export function MobileCocktailScene({
  config,
  lang,
  onLangChange,
  activeLayerId,
  onActiveLayer,
  accent,
  modules,
}: MobileCocktailSceneProps) {
  const isHebrew = lang === 'he';
  const [videoOpen, setVideoOpen] = useState(false);
  const featureVideo = getFeatureVideo(config.slug);
  const titleFont = isHebrew ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)';
  const sansFont = isHebrew ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';
  const bodyFont = isHebrew ? 'var(--font-heebo, sans-serif)' : 'var(--font-garamond, serif)';

  const layerImage = (layerId: string): string | undefined =>
    config.layers.find((l) => l.id === layerId)?.image;

  return (
    <div
      className="relative w-full min-h-[100dvh] bg-black text-white"
      style={{ ['--accent' as string]: accent } as CSSProperties}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse at center 30%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%), linear-gradient(#000, #0a0a0c)',
        }}
      />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/70 backdrop-blur-xl border-b border-white/[0.07]">
        <Link
          href="/"
          className="text-amber-200/80 hover:text-amber-100 text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: sansFont }}
        >
          {isHebrew ? 'תפריט ↩' : '← Menu'}
        </Link>
        <div className="flex items-center gap-2">
          {featureVideo && modules.hero_video && (
            <button
              type="button"
              onClick={() => {
                setVideoOpen(true);
                track({ event: 'cocktail_video_opened', cocktailSlug: config.slug });
              }}
              className="px-3 py-1.5 rounded-full border border-amber-200/40 text-amber-200/85 text-[9px] tracking-[0.25em] uppercase inline-flex items-center gap-1.5"
              style={{ fontFamily: sansFont }}
            >
              <span className="text-[7px]">▶</span>
              {isHebrew ? 'סרטון' : 'Video'}
            </button>
          )}
          <Link
            href={`/ar/${config.slug}`}
            className="px-3 py-1.5 rounded-full border border-amber-200/40 text-amber-200/85 text-[9px] tracking-[0.25em] uppercase"
            style={{ fontFamily: sansFont }}
          >
            AR
          </Link>
          <ShareButton cocktail={config} lang={lang} />
          <LanguageToggle lang={lang} onChange={onLangChange} />
        </div>
      </header>

      {featureVideo && modules.hero_video && videoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-sm p-4"
          onClick={() => setVideoOpen(false)}
        >
          <button
            type="button"
            onClick={() => setVideoOpen(false)}
            className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full border border-amber-200/40 bg-black/50 text-amber-100 text-lg leading-none"
            aria-label={isHebrew ? 'סגור' : 'Close'}
          >
            ×
          </button>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={featureVideo}
            className="max-h-[85vh] max-w-[94vw] w-auto rounded-2xl"
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: `0 0 100px color-mix(in srgb, ${accent} 40%, transparent)` }}
          />
        </div>
      )}

      <main className="relative z-10 pb-28">
        {/* Title */}
        <div className="px-5 pt-7 pb-1 text-center">
          <h1
            className="text-white text-[2.4rem] leading-tight"
            style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 500 }}
          >
            {config.title[lang]}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3 opacity-70">
            <div className="w-8 h-px bg-amber-200/50" />
            <div className="w-1.5 h-1.5 border border-amber-200/70 rotate-45" />
            <div className="w-8 h-px bg-amber-200/50" />
          </div>
          <p
            className="text-amber-200/75 text-[10px] tracking-[0.45em] uppercase mt-3"
            style={{ fontFamily: sansFont }}
          >
            {config.subtitle[lang]}
          </p>
        </div>

        {/* Clear hero glass */}
        {config.heroImage && (
          <div className="flex items-center justify-center px-6 pt-4 pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.heroImage}
              alt={config.title[lang]}
              className="object-contain max-h-[48vh] w-auto mix-blend-screen"
              style={{ filter: 'drop-shadow(0 24px 60px color-mix(in srgb, var(--accent) 35%, transparent))' }}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        )}

        {/* Breakdown — each floating part shown WITH its description beside it */}
        {modules.ingredient_breakdown && (
        <SectionAttention section="ingredients" slug={config.slug}>
        <section className="px-4 pt-6">
          <p
            className="text-amber-200/70 text-[10px] tracking-[0.45em] uppercase mb-4 text-center"
            style={{ fontFamily: sansFont }}
          >
            {isHebrew ? 'מרכיבים' : 'Components'}
          </p>
          <ul className="space-y-2.5">
            {config.labels.map((label) => {
              const img = layerImage(label.layerId);
              const isActive = activeLayerId === label.layerId;
              return (
                <li key={label.id}>
                  <button
                    type="button"
                    onClick={() => onActiveLayer(isActive ? null : label.layerId)}
                    className={`w-full flex items-center gap-4 text-start rounded-2xl border p-3 transition-colors duration-300 ${
                      isActive ? 'border-amber-200/60 bg-amber-200/[0.06]' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    {/* Floating part image */}
                    <div className="shrink-0 w-16 h-16 flex items-center justify-center">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" aria-hidden className="max-w-full max-h-full object-contain mix-blend-screen" loading="lazy" decoding="async" />
                      )}
                    </div>
                    {/* Description beside it */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-200/45 text-[10px] tracking-[0.2em]" style={{ fontFamily: sansFont }}>
                          {label.number}
                        </span>
                        <h3
                          className="uppercase tracking-[0.16em] text-[12.5px] truncate"
                          style={{ fontFamily: sansFont, fontWeight: 500, color: 'var(--accent)' }}
                        >
                          {label.name[lang]}
                        </h3>
                      </div>
                      <p
                        className="text-white/70 text-[13px] leading-relaxed mt-1"
                        style={{ fontFamily: bodyFont, fontStyle: isHebrew ? 'normal' : 'italic' }}
                      >
                        {label.description[lang]}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        </SectionAttention>
        )}

        {/* Flavor profile */}
        {modules.taste_profile && (
        <SectionAttention section="flavor" slug={config.slug}>
        <section className="px-5 pt-9 mt-2 flex flex-col items-center">
          <p
            className="text-amber-200/70 text-[10px] tracking-[0.45em] uppercase mb-3"
            style={{ fontFamily: sansFont }}
          >
            {isHebrew ? 'פרופיל טעמים' : 'Flavor Profile'}
          </p>
          <FlavorRadar flavor={config.flavor} lang={lang} size={250} />
        </section>
        </SectionAttention>
        )}

        {/* Bartender note + pairings */}
        <section className="px-5 pt-9 mt-2 flex flex-col items-center gap-6 text-center">
          <BartenderNote cocktail={config} lang={lang} />
          {modules.perfect_pairings && <Pairings cocktail={config} lang={lang} />}
        </section>

        {/* Story (emotion) */}
        {modules.story && (
          <SectionAttention section="story" slug={config.slug}>
            <CocktailStory slug={config.slug} lang={lang} />
          </SectionAttention>
        )}

        {/* Data-driven cross-sell */}
        {modules.related_items && <AlsoViewed slug={config.slug} lang={lang} />}
      </main>

      {/* In-app conversion (order / call waiter) — diners are on mobile */}
      <OrderBar
        cocktailSlug={config.slug}
        accent={accent}
        lang={lang}
        priceILS={getEconomics(config).price}
        costILS={getEconomics(config).cost}
      />
    </div>
  );
}

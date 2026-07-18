'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CocktailLayers } from './CocktailLayers';
import { LuxuryLighting } from './LuxuryLighting';
import { IngredientLabels } from './IngredientLabels';
import { LanguageToggle } from './LanguageToggle';
import { FlavorRadar } from './FlavorRadar';
import { BartenderNote } from './BartenderNote';
import { Pairings } from './Pairings';
import { AlsoViewed } from './AlsoViewed';
import { CocktailStory } from './CocktailStory';
import { ShareButton } from './ShareButton';
import { PosterButton } from './PosterButton';
import { MobileLabelSheet } from './MobileLabelSheet';
import { AmbientToggle } from './AmbientToggle';
import { FullscreenButton } from './FullscreenButton';
import { ErrorBoundary } from './ErrorBoundary';
import { MobileCocktailScene } from './MobileCocktailScene';
import { LivingAmbiance } from './LivingAmbiance';
import { OrderBar } from './OrderBar';
import { track } from '@/lib/tracking/track';
import { setRestaurantSlug } from '@/lib/tracking/queue';
import { useEngagement } from '@/lib/tracking/useEngagement';
import { useGyroscope } from '@/lib/useGyroscope';
import { useViewHistory } from '@/lib/useViewHistory';
import { useIsMobile } from '@/lib/useMediaQuery';
import { useMenuConfig } from '@/lib/useMenuConfig';
import { resolveModules, type ActiveModules } from '@/lib/experience/resolve';
import { getAccent, isEffervescent, getEconomics, getFeatureVideo } from '@/data/cocktail';
import type { CocktailConfig } from '@/data/cocktail';
import { useLang } from '@/lib/useLang';

interface CocktailSceneProps {
  config: CocktailConfig;
}

export function CocktailScene({ config }: CocktailSceneProps) {
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const { lang, setLang } = useLang();
  const [videoOpen, setVideoOpen] = useState(false);
  // Promotional feature video (e.g. Aperol Spritz) — replaces the old 360 view.
  const featureVideo = getFeatureVideo(config.slug);
  const { tiltRef, enable: enableTilt, permissionRequired: tiltPermissionRequired, enabled: tiltEnabled } = useGyroscope();
  const { record: recordView } = useViewHistory();
  const isMobile = useIsMobile();
  const { experience } = useMenuConfig('diner');
  const modules = useMemo<ActiveModules>(
    () => resolveModules(experience[config.slug], new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [experience, config.slug],
  );

  useEffect(() => {
    recordView(config.slug);
  }, [config.slug, recordView]);

  // Engagement Intelligence: active dwell + scroll depth (desktop & mobile).
  useEngagement(config.slug);

  // --- Analytics: funnel signals (cocktail_opened → ingredients → 360 → …) ---
  const ingredientsTracked = useRef(false);
  const firstLangRender = useRef(true);

  useEffect(() => {
    setRestaurantSlug('diner');
    track({ event: 'cocktail_opened', cocktailSlug: config.slug });
    const fullyViewed = setTimeout(
      () => track({ event: 'cocktail_fully_viewed', cocktailSlug: config.slug }),
      8000,
    );
    return () => clearTimeout(fullyViewed);
  }, [config.slug]);

  useEffect(() => {
    if (activeLayerId && !ingredientsTracked.current) {
      ingredientsTracked.current = true;
      track({ event: 'ingredients_opened', cocktailSlug: config.slug, metadata: { layerId: activeLayerId } });
    }
  }, [activeLayerId, config.slug]);

  useEffect(() => {
    if (firstLangRender.current) {
      firstLangRender.current = false;
      return;
    }
    track({ event: 'language_changed', cocktailSlug: config.slug, metadata: { lang } });
  }, [lang, config.slug]);

  const isHebrew = lang === 'he';
  const accent = getAccent(config.slug);
  const effervescent = isEffervescent(config);
  const titleFont = isHebrew
    ? 'var(--font-frank-ruhl, Georgia, serif)'
    : 'var(--font-playfair, Georgia, serif)';
  const subtitleFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';

  // Only render layers that have a matching label (drops unlabeled duplicates like
  // an extra soda crown), then evenly redistribute their Y so gaps stay equal
  // regardless of how many components a given cocktail has.
  const spacedLayers = (() => {
    const labeledIds = new Set(config.labels.map((l) => l.layerId));
    const visible = config.layers
      .filter((l) => labeledIds.has(l.id))
      .sort((a, b) => a.y - b.y); // bottom → top by original Y
    const n = visible.length;
    const RANGE_BOTTOM = -1.4;
    const RANGE_TOP = 1.4;
    return visible.map((l, i) => ({
      ...l,
      y: n <= 1 ? 0 : RANGE_BOTTOM + (i * (RANGE_TOP - RANGE_BOTTOM)) / (n - 1),
    }));
  })();
  const spacedConfig: CocktailConfig = { ...config, layers: spacedLayers };

  // Phones / small tablets get a dedicated scrollable layout instead of the
  // immersive full-screen canvas (which hid the glass, flavors, ingredients).
  if (isMobile) {
    return (
      <MobileCocktailScene
        config={config}
        spacedLayers={spacedLayers}
        lang={lang}
        onLangChange={setLang}
        activeLayerId={activeLayerId}
        onActiveLayer={setActiveLayerId}
        accent={accent}
        modules={modules}
      />
    );
  }

  return (
    <div
      className="relative w-full h-screen bg-black overflow-hidden select-none"
      style={{ ['--accent' as string]: accent } as CSSProperties}
    >
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
        <LivingAmbiance accent={accent} effervescent={effervescent} className="absolute inset-0" />
      </div>

      <motion.div
        className="absolute top-10 left-10 z-30"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-amber-200/70 hover:text-amber-200 transition-colors text-[10px] tracking-[0.3em] uppercase mb-5"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          <span>{isHebrew ? '↩' : '←'}</span>
          <span>{isHebrew ? 'תפריט' : 'Menu'}</span>
        </Link>
        <h1
          className="text-white text-3xl md:text-5xl tracking-[0.08em]"
          style={{
            fontFamily: titleFont,
            fontWeight: isHebrew ? 500 : 500,
            fontStyle: isHebrew ? 'normal' : 'italic',
          }}
          dir={isHebrew ? 'rtl' : 'ltr'}
          lang={lang}
        >
          {config.title[lang]}
        </h1>
        <div className="flex items-center gap-2 mt-4">
          <div className="w-10 h-px bg-amber-200/50" />
          <div className="w-1.5 h-1.5 border border-amber-200/70 rotate-45" />
          <div className="w-10 h-px bg-amber-200/50" />
        </div>
        <p
          className="text-amber-200/75 text-[10px] tracking-[0.5em] uppercase mt-3"
          style={{ fontFamily: subtitleFont, fontWeight: 400 }}
          dir={isHebrew ? 'rtl' : 'ltr'}
          lang={lang}
        >
          {config.subtitle[lang]}
        </p>
      </motion.div>

      <motion.div
        className="absolute top-10 right-10 z-30 flex items-center gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          href={`/ar/${config.slug}`}
          onClick={() => track({ event: 'ar_opened', cocktailSlug: config.slug })}
          className="md:hidden inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200/40 hover:border-amber-200/80 bg-black/40 backdrop-blur-sm text-amber-200/85 hover:text-amber-100 transition-all duration-300 text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {isHebrew ? 'AR' : 'View in AR'}
        </Link>
        {featureVideo && modules.hero_video && (
          <button
            type="button"
            onClick={() => {
              setVideoOpen(true);
              track({ event: 'cocktail_video_opened', cocktailSlug: config.slug });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200/40 hover:border-amber-200/80 bg-black/40 backdrop-blur-sm text-amber-200/85 hover:text-amber-100 transition-all duration-300 text-[10px] tracking-[0.3em] uppercase"
            style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
            title={isHebrew ? 'נגן סרטון' : 'Play video'}
          >
            <span className="text-[8px]">▶</span>
            {isHebrew ? 'סרטון' : 'Video'}
          </button>
        )}
        <PosterButton cocktail={config} lang={lang} />
        <ShareButton cocktail={config} lang={lang} />
        <AmbientToggle />
        <FullscreenButton />
        <LanguageToggle lang={lang} onChange={setLang} />
      </motion.div>

      {/*
        Three-zone layout that fills the width on large screens (xl+):
          · LEFT   — description + flavor metrics
          · CENTER — the exploded breakdown (3D layers) + ingredient labels
          · RIGHT  — the full assembled drink photo
        Below xl the side columns collapse, the center column becomes full
        width (canvas full-screen, labels anchored to viewport centre), and the
        flavor/note block falls back to the bottom-left corner as before.
      */}
      <div className="absolute inset-0 z-10 flex">
        {/* LEFT — description + metrics, 48px from screen edge */}
        <motion.aside
          className={`hidden xl:flex flex-col justify-start gap-7 w-[260px] shrink-0 pl-12 pr-4 pt-48 pb-12 text-start overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            isHebrew ? 'items-end' : 'items-start'
          }`}
          dir={isHebrew ? 'rtl' : 'ltr'}
          lang={lang}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.0, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {modules.taste_profile && (
            <div className="text-start">
              <p
                className="text-amber-200/70 text-[11px] tracking-[0.45em] uppercase mb-4"
                style={{ fontFamily: subtitleFont }}
              >
                {isHebrew ? 'פרופיל טעמים' : 'Flavor Profile'}
              </p>
              <FlavorRadar flavor={config.flavor} lang={lang} size={200} />
            </div>
          )}
          <BartenderNote cocktail={config} lang={lang} />
          {modules.perfect_pairings && <Pairings cocktail={config} lang={lang} />}
          {modules.story && <CocktailStory slug={config.slug} lang={lang} />}
          {modules.related_items && <AlsoViewed slug={config.slug} lang={lang} />}
        </motion.aside>

        {/* CENTER — breakdown layers + ingredient labels (always present).
            If WebGL/3D crashes, fall back to the static hero image so the
            page never goes blank. */}
        <div className="relative flex-1 min-w-0">
          <ErrorBoundary
            label="cocktail-canvas"
            fallback={
              <div className="absolute inset-0 flex items-center justify-center p-8">
                {config.heroImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.heroImage}
                    alt={config.title[lang]}
                    className="object-contain max-h-[80%] max-w-[80%] mix-blend-screen"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                )}
              </div>
            }
          >
            <Canvas
              className="z-10"
              style={{ position: 'absolute', inset: 0 }}
              camera={{ position: [0, 0, 5], fov: 45 }}
              gl={{ antialias: true, alpha: true }}
              dpr={[1, 2]}
            >
              <Suspense fallback={null}>
                <LuxuryLighting />
                <CocktailLayers
                  layers={spacedLayers}
                  activeLayerId={activeLayerId}
                  onHoverLayer={setActiveLayerId}
                  tiltRef={tiltRef}
                />
              </Suspense>
            </Canvas>
          </ErrorBoundary>

          {modules.ingredient_breakdown && (
            <IngredientLabels
              config={spacedConfig}
              activeLayerId={activeLayerId}
              onHoverLabel={setActiveLayerId}
              lang={lang}
            />
          )}
        </div>

        {/* RIGHT — full drink photo; narrower at xl to keep labels clear, wider at 2xl */}
        <motion.aside
          className="hidden xl:flex items-center justify-center w-[400px] 2xl:w-[460px] shrink-0 pl-4 pr-10 2xl:pr-14 pt-24 pb-12"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.1, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
        >
          {config.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.heroImage}
              alt={config.title[lang]}
              className="object-contain max-h-[90vh] w-auto max-w-full mix-blend-screen"
              style={{ filter: 'drop-shadow(0 0 80px color-mix(in srgb, var(--accent) 50%, transparent))' }}
              loading="lazy"
              decoding="async"
            />
          )}
        </motion.aside>
      </div>

      {/* Flavor + note fallback for md→lg (below the xl 3-zone layout) */}
      <motion.div
        className={`absolute bottom-10 left-10 z-30 hidden md:flex xl:hidden flex-col gap-5 max-w-[320px] text-start ${
          isHebrew ? 'items-end' : 'items-start'
        }`}
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={lang}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {modules.taste_profile && (
          <div className="text-start">
            <p
              className="text-amber-200/70 text-[11px] tracking-[0.45em] uppercase mb-3"
              style={{ fontFamily: subtitleFont }}
            >
              {isHebrew ? 'פרופיל טעמים' : 'Flavor Profile'}
            </p>
            <FlavorRadar flavor={config.flavor} lang={lang} size={180} />
          </div>
        )}
        <BartenderNote cocktail={config} lang={lang} />
        {modules.perfect_pairings && <Pairings cocktail={config} lang={lang} />}
        {modules.story && <CocktailStory slug={config.slug} lang={lang} />}
        {modules.related_items && <AlsoViewed slug={config.slug} lang={lang} />}
      </motion.div>

      <MobileLabelSheet
        config={config}
        activeLayerId={activeLayerId}
        onClose={() => setActiveLayerId(null)}
        lang={lang}
      />

      {tiltPermissionRequired && !tiltEnabled && (
        <motion.button
          type="button"
          onClick={enableTilt}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="md:hidden fixed bottom-6 right-6 z-40 px-4 py-2 rounded-full border border-amber-200/40 bg-black/60 backdrop-blur-sm text-amber-100 text-[10px] tracking-[0.3em] uppercase"
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {isHebrew ? 'הפעל הטיה' : 'Enable tilt'}
        </motion.button>
      )}

      <OrderBar
        cocktailSlug={config.slug}
        accent={accent}
        lang={lang}
        priceILS={getEconomics(config).price}
        costILS={getEconomics(config).cost}
      />

      {/* Feature video player (Aperol Spritz) — opened by the ▶ Video button */}
      {featureVideo && modules.hero_video && videoOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setVideoOpen(false)}
        >
          <button
            type="button"
            onClick={() => setVideoOpen(false)}
            className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full border border-amber-200/40 hover:border-amber-200/80 bg-black/50 text-amber-100 text-lg leading-none"
            aria-label={isHebrew ? 'סגור' : 'Close'}
          >
            ×
          </button>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={featureVideo}
            className="max-h-[90vh] max-w-[90vw] w-auto rounded-2xl shadow-2xl"
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: `0 0 120px color-mix(in srgb, ${accent} 40%, transparent)` }}
          />
        </motion.div>
      )}
    </div>
  );
}

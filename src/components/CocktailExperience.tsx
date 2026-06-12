'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Layers, Play } from 'lucide-react';
import { getAccent, getFeatureVideo, formatPrice, findCocktailBySlug, MENU, type CocktailConfig, type Lang } from '@/data/cocktail';
import { FlavorRadar } from './FlavorRadar';
import { track } from '@/lib/tracking/track';
import { setRestaurantSlug } from '@/lib/tracking/queue';
import { useEngagement } from '@/lib/tracking/useEngagement';

/**
 * CocktailExperience — a full-screen, cinematic "dedicated landing page" for ONE drink.
 * Inspired by luxury-spirits sites and Apple product pages: the drink is the hero,
 * minimal text, three actions only (Ingredients / Video / AR), and an exploded
 * ingredient view that floats the components above the glass.
 *
 * Reusable: everything is driven by CocktailConfig (heroImage, labels, layers,
 * feature video, flavor profile). Mobile is the primary target; desktop gets the
 * same vertical spine, wider. The hero screen is LOCKED (no scroll) — only the
 * ingredient view scrolls. There is no order button by design: interest is
 * measured from real behaviour (opens, dwell, scroll) via the existing funnel
 * events (cocktail_opened / ingredients_opened / cocktail_video_opened) plus
 * useEngagement's dwell/scroll signals — analytics keep working unchanged.
 */

type ExperienceMode = 'hero' | 'ingredients' | 'video';

interface CocktailExperienceProps {
  config: CocktailConfig;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Dispatch by item kind — a dish gets a dish layout, a drink gets the cinematic one. */
export function CocktailExperience({ config }: CocktailExperienceProps) {
  return config.kind === 'food'
    ? <FoodExperience config={config} />
    : <DrinkExperience config={config} />;
}

function DrinkExperience({ config }: CocktailExperienceProps) {
  const [lang, setLang] = useState<Lang>('en');
  const [mode, setMode] = useState<ExperienceMode>('hero');
  const reduce = useReducedMotion();

  // Real engagement signals (active dwell + scroll depth) — this is how interest
  // is measured on this screen, instead of a fake "order" button.
  useEngagement(config.slug);

  const isHe = lang === 'he';
  const accent = getAccent(config.slug);
  const featureVideo = getFeatureVideo(config.slug);

  const serif = isHe ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)';
  const sans = isHe ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  // The floating ingredients = every label except the final "glass" one (that IS the drink).
  const { ingredients, glassLabel } = useMemo(() => {
    const float = config.labels.filter((l) => l.layerId !== 'glass');
    const glass = config.labels.find((l) => l.layerId === 'glass') ?? null;
    return { ingredients: float, glassLabel: glass };
  }, [config.labels]);

  const imageForLayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const layer of config.layers) map.set(layer.id, layer.image);
    return map;
  }, [config.layers]);

  // Keep the existing funnel intact: this screen replaces the old scene, so it
  // must fire the same entry event the scene fired.
  useEffect(() => {
    setRestaurantSlug('diner');
    track({ event: 'cocktail_opened', cocktailSlug: config.slug });
  }, [config.slug]);

  const openIngredients = () => {
    track({ event: 'ingredients_opened', cocktailSlug: config.slug });
    setMode('ingredients');
  };
  const openVideo = () => {
    track({ event: 'cocktail_video_opened', cocktailSlug: config.slug });
    setMode('video');
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-black text-white" dir={isHe ? 'rtl' : 'ltr'} lang={lang}>
      {/* Ambient stage light */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(90% 60% at 50% 30%, ${accent}1f, transparent 70%), radial-gradient(70% 45% at 50% 100%, ${accent}14, transparent 75%)`,
        }}
      />

      {/* Top bar — back · language. Nothing else. Back is contextual: inside
          ingredients/video it returns to the DRINK; only the hero leaves to the menu. */}
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 pt-5">
        {mode === 'hero' ? (
          <Link
            href="/"
            aria-label={isHe ? 'חזרה לתפריט' : 'Back to menu'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur-md transition-colors hover:text-white"
          >
            <span aria-hidden className="text-lg leading-none">{isHe ? '→' : '←'}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setMode('hero')}
            aria-label={isHe ? 'חזרה למשקה' : 'Back to the drink'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur-md transition-colors hover:text-white"
          >
            <span aria-hidden className="text-lg leading-none">{isHe ? '→' : '←'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setLang(isHe ? 'en' : 'he')}
          className="h-10 rounded-full border border-white/15 bg-black/40 px-4 text-[11px] tracking-[0.18em] text-white/75 backdrop-blur-md transition-colors hover:text-white"
          style={{ fontFamily: sans }}
        >
          {isHe ? 'EN' : 'עב'}
        </button>
      </header>

      <AnimatePresence mode="wait">
        {mode === 'hero' && (
          <HeroStage
            key="hero"
            config={config}
            lang={lang}
            accent={accent}
            serif={serif}
            sans={sans}
            reduce={!!reduce}
            hasVideo={Boolean(featureVideo)}
            onIngredients={openIngredients}
            onVideo={openVideo}
          />
        )}

        {mode === 'ingredients' && (
          <ExplodedView
            key="ingredients"
            ingredients={ingredients}
            glassLabel={glassLabel}
            glassImage={imageForLayer.get('glass') ?? config.heroImage}
            imageForLayer={imageForLayer}
            flavor={config.flavor}
            note={config.bartenderNote?.[lang]}
            noteName={config.bartenderName}
            currentSlug={config.slug}
            lang={lang}
            accent={accent}
            serif={serif}
            sans={sans}
            reduce={!!reduce}
          />
        )}

        {mode === 'video' && featureVideo && (
          <VideoStage
            key="video"
            src={featureVideo}
            lang={lang}
            sans={sans}
            cocktailSlug={config.slug}
            onEnd={() => setMode('hero')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Food experience — a dish, not a drink: no glass, no flavor radar ──────── */

function FoodExperience({ config }: CocktailExperienceProps) {
  const [lang, setLang] = useState<Lang>('en');
  const [mode, setMode] = useState<ExperienceMode>('hero');
  const reduce = useReducedMotion();
  useEngagement(config.slug);

  const isHe = lang === 'he';
  const accent = getAccent(config.slug);
  const featureVideo = getFeatureVideo(config.slug);
  const hasComponents = config.labels.length > 0;
  const serif = isHe ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)';
  const sans = isHe ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  useEffect(() => {
    setRestaurantSlug('diner');
    track({ event: 'cocktail_opened', cocktailSlug: config.slug });
  }, [config.slug]);

  const openIngredients = () => {
    track({ event: 'ingredients_opened', cocktailSlug: config.slug });
    setMode('ingredients');
  };
  const openVideo = () => {
    track({ event: 'cocktail_video_opened', cocktailSlug: config.slug });
    setMode('video');
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-black text-white" dir={isHe ? 'rtl' : 'ltr'} lang={lang}>
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(90% 55% at 50% 18%, ${accent}1c, transparent 70%)` }} />

      {/* Back is contextual: from a sub-view it returns to the DISH; only the hero leaves to the menu. */}
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 pt-5">
        {mode === 'hero' ? (
          <Link href="/" aria-label={isHe ? 'חזרה לתפריט' : 'Back to menu'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur-md transition-colors hover:text-white">
            <span aria-hidden className="text-lg leading-none">{isHe ? '→' : '←'}</span>
          </Link>
        ) : (
          <button type="button" onClick={() => setMode('hero')} aria-label={isHe ? 'חזרה למנה' : 'Back to the dish'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur-md transition-colors hover:text-white">
            <span aria-hidden className="text-lg leading-none">{isHe ? '→' : '←'}</span>
          </button>
        )}
        <button type="button" onClick={() => setLang(isHe ? 'en' : 'he')}
          className="h-10 rounded-full border border-white/15 bg-black/40 px-4 text-[11px] tracking-[0.18em] text-white/75 backdrop-blur-md transition-colors hover:text-white" style={{ fontFamily: sans }}>
          {isHe ? 'EN' : 'עב'}
        </button>
      </header>

      <AnimatePresence mode="wait">
        {mode === 'hero' && (
          <FoodHero
            key="hero"
            config={config}
            lang={lang}
            accent={accent}
            serif={serif}
            sans={sans}
            reduce={!!reduce}
            hasVideo={Boolean(featureVideo)}
            hasComponents={hasComponents}
            onIngredients={openIngredients}
            onVideo={openVideo}
          />
        )}

        {mode === 'ingredients' && hasComponents && (
          <FoodExplodedView
            key="ingredients"
            config={config}
            lang={lang}
            accent={accent}
            serif={serif}
            sans={sans}
            reduce={!!reduce}
          />
        )}

        {mode === 'video' && featureVideo && (
          <VideoStage key="video" src={featureVideo} lang={lang} sans={sans} cocktailSlug={config.slug} onEnd={() => setMode('hero')} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Food hero — the plated dish, name, price, two actions ─────────────────── */

interface FoodHeroProps {
  config: CocktailConfig;
  lang: Lang;
  accent: string;
  serif: string;
  sans: string;
  reduce: boolean;
  hasVideo: boolean;
  hasComponents: boolean;
  onIngredients: () => void;
  onVideo: () => void;
}

function FoodHero({ config, lang, accent, serif, sans, reduce, hasVideo, hasComponents, onIngredients, onVideo }: FoodHeroProps) {
  const isHe = lang === 'he';
  const dietary = [
    { on: config.dietary.vegan, en: 'Vegan', he: 'טבעוני' },
    { on: config.dietary.glutenFree, en: 'Gluten-free', he: 'ללא גלוטן' },
  ].filter((d) => d.on);

  return (
    <motion.main
      className="relative z-10 flex h-dvh flex-col items-center px-6 pt-20 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
      >
        {config.course && (
          <p className="mb-3 text-[11px] tracking-[0.4em] uppercase text-amber-200/70" style={{ fontFamily: sans }}>
            {config.course}
          </p>
        )}
        <h1
          className="text-[2.6rem] leading-[1.05] md:text-6xl"
          style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
        >
          {config.title[lang]}
        </h1>
        {config.tagline && (
          <p className="mt-3 text-[13px] tracking-[0.12em] text-white/55 md:text-sm" style={{ fontFamily: sans }}>
            {config.tagline[lang]}
          </p>
        )}
        {config.priceILS !== undefined && (
          <p className="mt-2 text-xl text-amber-100/90" style={{ fontFamily: sans, fontWeight: 600 }} dir="ltr">
            {formatPrice(config.priceILS, 'ILS')}
          </p>
        )}
      </motion.div>

      {/* The dish — tap to explore its components. No reflection (a photo, not a transparent glass). */}
      <motion.button
        type="button"
        onClick={hasComponents ? onIngredients : undefined}
        disabled={!hasComponents}
        aria-label={isHe ? 'גלה מה יש בפנים' : 'Discover what’s inside'}
        className="group relative mt-5 flex w-full flex-1 flex-col items-center justify-center outline-none disabled:cursor-default"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[70%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accent}44, transparent 70%)` }}
        />
        <motion.span
          className="relative block"
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.heroImage}
            alt={config.title[lang]}
            className="relative z-10 mx-auto max-h-[52vh] w-auto object-contain transition-transform duration-700 group-hover:scale-[1.03]"
            style={{ filter: `drop-shadow(0 40px 70px rgba(0,0,0,0.85)) drop-shadow(0 0 50px ${accent}30)` }}
          />
        </motion.span>
        {hasComponents && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-[0.45em] uppercase text-white/40 transition-colors group-hover:text-white/70"
            style={{ fontFamily: sans }}
          >
            {isHe ? 'גע לגילוי המרכיבים' : 'Tap to explore'}
          </span>
        )}
      </motion.button>

      {dietary.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {dietary.map((d) => (
            <span key={d.en} className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[11px] tracking-wide text-emerald-200/90" style={{ fontFamily: sans }}>
              {isHe ? d.he : d.en}
            </span>
          ))}
        </div>
      )}

      {(hasComponents || hasVideo) && (
        <motion.div
          className={`mt-7 grid w-full max-w-sm shrink-0 gap-3 ${hasComponents && hasVideo ? 'grid-cols-2' : 'grid-cols-1'}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        >
          {hasComponents && (
            <ActionTile label={isHe ? 'מרכיבים' : 'Ingredients'} icon={<Layers size={20} strokeWidth={1.6} aria-hidden />} onClick={onIngredients} sans={sans} />
          )}
          {hasVideo && (
            <ActionTile label={isHe ? 'וידאו' : 'Video'} icon={<Play size={20} strokeWidth={1.6} aria-hidden />} onClick={onVideo} sans={sans} />
          )}
        </motion.div>
      )}
    </motion.main>
  );
}

/* ── Food component breakdown — the dish's answer to the exploded drink view ── */

interface FoodExplodedViewProps {
  config: CocktailConfig;
  lang: Lang;
  accent: string;
  serif: string;
  sans: string;
  reduce: boolean;
}

function FoodExplodedView({ config, lang, accent, serif, sans, reduce }: FoodExplodedViewProps) {
  const isHe = lang === 'he';
  const components = config.labels;
  const note = config.bartenderNote?.[lang];

  return (
    <motion.section
      className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center px-6 pt-24 pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      aria-label={isHe ? 'פירוק מרכיבים' : 'Ingredient breakdown'}
    >
      <motion.p
        className="mb-10 text-center text-[11px] tracking-[0.5em] uppercase text-white/45"
        style={{ fontFamily: sans }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {isHe ? 'גלה מה יש בפנים' : 'Discover what’s inside'}
      </motion.p>

      <ol className="relative flex w-full flex-col gap-8">
        {components.map((label, i) => {
          const side = i % 2 === 0 ? 'start' : 'end'; // alternate around the spine
          return (
            <motion.li
              key={label.id}
              className={`relative flex items-center gap-5 ${side === 'end' ? 'flex-row-reverse text-end' : ''}`}
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12 + i * 0.1, ease: EASE }}
            >
              {/* Floating component image — the dish's answer to the drink's floating ingredient.
                  Wider box: the burger layers are landscape slices, not square garnishes. */}
              <motion.span
                className="relative block h-24 w-28 shrink-0 md:h-28 md:w-36"
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 4.5 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
              >
                <span aria-hidden className="absolute inset-0 rounded-full blur-2xl" style={{ background: `radial-gradient(circle, ${accent}40, transparent 70%)` }} />
                {label.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={label.image}
                    alt=""
                    aria-hidden
                    className="relative h-full w-full object-contain"
                    style={{ filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.7))' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
              </motion.span>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] tracking-[0.4em] text-white/35" style={{ fontFamily: sans }}>
                  {label.number}
                </p>
                <h3 className="mt-1 text-xl leading-tight text-white md:text-2xl" style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>
                  {label.name[lang]}
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/55 md:text-sm" style={{ fontFamily: sans }}>
                  {label.description[lang]}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* The finished dish at the base of the stack — like the glass under a drink. */}
      <motion.figure
        className="relative mt-14 flex flex-col items-center"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.2 + components.length * 0.1, ease: EASE }}
      >
        <span aria-hidden className="absolute left-1/2 top-1/2 h-[75%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${accent}45, transparent 70%)` }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={config.heroImage} alt={config.title[lang]} className="relative h-60 w-auto object-contain md:h-72" style={{ filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.8))' }} />
        <figcaption className="mt-4 text-center">
          <p className="text-lg text-white" style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>
            {config.title[lang]}
          </p>
        </figcaption>
      </motion.figure>

      {/* Flavor profile — the same radar the drinks use. */}
      <motion.div
        className="mt-14 flex flex-col items-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 + components.length * 0.1, ease: EASE }}
      >
        <p className="mb-5 text-center text-[11px] tracking-[0.5em] uppercase text-white/45" style={{ fontFamily: sans }}>
          {isHe ? 'פרופיל הטעמים' : 'Flavor profile'}
        </p>
        <FlavorRadar flavor={config.flavor} lang={lang} size={230} />
        {note && (
          <p className="mt-8 max-w-xs text-center text-[13px] italic leading-relaxed text-white/55" style={{ fontFamily: serif }}>
            ”{note}“{config.bartenderName ? ` — ${config.bartenderName}` : ''}
          </p>
        )}
      </motion.div>

      <AlsoExplored currentSlug={config.slug} lang={lang} serif={serif} sans={sans} />
    </motion.section>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

interface HeroStageProps {
  config: CocktailConfig;
  lang: Lang;
  accent: string;
  serif: string;
  sans: string;
  reduce: boolean;
  hasVideo: boolean;
  onIngredients: () => void;
  onVideo: () => void;
}

function HeroStage({
  config, lang, accent, serif, sans, reduce, hasVideo,
  onIngredients, onVideo,
}: HeroStageProps) {
  const isHe = lang === 'he';
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const px = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 20 });

  return (
    <motion.main
      ref={ref}
      // LOCKED screen: exactly one viewport, nothing scrolls here (only the
      // ingredient view scrolls). overflow-hidden also clips the reflection.
      className="relative z-10 flex h-dvh flex-col items-center overflow-hidden px-6 pt-20 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.7, ease: EASE }}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = ref.current?.getBoundingClientRect();
        if (r) mx.set((e.clientX - r.left) / r.width - 0.5);
      }}
      onMouseLeave={() => mx.set(0)}
    >
      {/* Name + one line. Nothing else. */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
      >
        <h1
          className="text-[2.6rem] leading-[1.05] md:text-6xl"
          style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
        >
          {config.title[lang]}
        </h1>
        {config.tagline && (
          <p className="mt-3 text-[13px] tracking-[0.2em] text-white/55 md:text-sm" style={{ fontFamily: sans }}>
            {config.tagline[lang]}
          </p>
        )}
        {config.priceILS !== undefined && (
          <p className="mt-2 text-xl text-amber-100/90" style={{ fontFamily: sans, fontWeight: 600 }}>
            {formatPrice(config.priceILS, 'ILS')}
          </p>
        )}
      </motion.div>

      {/* THE DRINK — ~55vh, glow, reflection, slow float. Tap = explore. */}
      <motion.button
        type="button"
        onClick={onIngredients}
        aria-label={isHe ? 'גלה מה יש בפנים' : 'Discover what’s inside'}
        className="group relative mt-4 flex-1 outline-none"
        style={{ x: px, minHeight: '56vh', maxHeight: '62vh' }}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[70%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
        />
        <motion.span
          className="relative block h-full"
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.heroImage}
            alt={config.title[lang]}
            className="relative z-10 h-full w-auto object-contain transition-transform duration-700 group-hover:scale-[1.03]"
            style={{ filter: `drop-shadow(0 40px 70px rgba(0,0,0,0.85)) drop-shadow(0 0 50px ${accent}30)` }}
          />
          {/* Reflection */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.heroImage}
            alt=""
            aria-hidden
            className="absolute left-0 top-full z-0 h-2/5 w-auto -scale-y-100 object-contain opacity-25"
            style={{
              maskImage: 'linear-gradient(to top, transparent 30%, black 100%)',
              WebkitMaskImage: 'linear-gradient(to top, transparent 30%, black 100%)',
            }}
          />
        </motion.span>
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-[0.45em] uppercase text-white/40 transition-colors group-hover:text-white/70"
          style={{ fontFamily: sans }}
        >
          {isHe ? 'גע בכוס לגילוי' : 'Tap to explore'}
        </span>
      </motion.button>

      {/* TWO actions. That's the whole control surface — no order button: interest
          is measured from real behaviour (opens, dwell, scroll), not a dead CTA. */}
      <motion.div
        className={`mt-8 grid w-full max-w-sm shrink-0 gap-3 ${hasVideo ? 'grid-cols-2' : 'grid-cols-1'}`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
      >
        <ActionTile
          label={isHe ? 'מרכיבים' : 'Ingredients'}
          icon={<Layers size={20} strokeWidth={1.6} aria-hidden />}
          onClick={onIngredients}
          sans={sans}
        />
        {hasVideo && (
          <ActionTile
            label={isHe ? 'וידאו' : 'Video'}
            icon={<Play size={20} strokeWidth={1.6} aria-hidden />}
            onClick={onVideo}
            sans={sans}
          />
        )}
      </motion.div>
    </motion.main>
  );
}

function ActionTile({ label, icon, onClick, sans }: { label: string; icon: ReactNode; onClick?: () => void; sans: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-3 py-4 backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:border-white/30 disabled:opacity-35"
    >
      <span aria-hidden className="leading-none text-amber-100/90">{icon}</span>
      <span className="text-[11px] tracking-[0.14em] uppercase text-white/80" style={{ fontFamily: sans }}>
        {label}
      </span>
    </button>
  );
}

/* ── Exploded ingredient view (the reference image) ───────────────────────── */

interface ExplodedViewProps {
  ingredients: CocktailConfig['labels'];
  glassLabel: CocktailConfig['labels'][number] | null;
  glassImage: string;
  imageForLayer: Map<string, string>;
  flavor: CocktailConfig['flavor'];
  note?: string;
  noteName?: string;
  currentSlug: string;
  lang: Lang;
  accent: string;
  serif: string;
  sans: string;
  reduce: boolean;
}

function ExplodedView({
  ingredients, glassLabel, glassImage, imageForLayer, flavor, note, noteName, currentSlug, lang, accent, serif, sans, reduce,
}: ExplodedViewProps) {
  const isHe = lang === 'he';
  // Natural label order = physical explosion order: 01 garnish floats highest,
  // the liquids (05/06) sit nearest the glass at the bottom — like the reference.
  const stack = ingredients;

  return (
    <motion.section
      className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center px-6 pt-24 pb-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      aria-label={isHe ? 'פירוק מרכיבים' : 'Ingredient breakdown'}
    >
      <motion.p
        className="mb-10 text-center text-[11px] tracking-[0.5em] uppercase text-white/45"
        style={{ fontFamily: sans }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {isHe ? 'גלה מה יש בפנים' : 'Discover what’s inside'}
      </motion.p>

      <ol className="relative flex w-full flex-col gap-9">
        {stack.map((label, i) => {
          const img = imageForLayer.get(label.layerId);
          const side = i % 2 === 0 ? 'start' : 'end'; // alternate around the spine
          return (
            <motion.li
              key={label.id}
              className={`relative flex items-center gap-4 ${side === 'end' ? 'flex-row-reverse text-end' : ''}`}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.12, ease: EASE }}
            >
              {/* Floating visual */}
              <motion.span
                className="relative block h-24 w-24 shrink-0 md:h-28 md:w-28"
                animate={reduce ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 4.5 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
              >
                <span aria-hidden className="absolute inset-0 rounded-full blur-2xl" style={{ background: `radial-gradient(circle, ${accent}38, transparent 70%)` }} />
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    aria-hidden
                    className="relative h-full w-full object-contain"
                    style={{ filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.7))' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
              </motion.span>

              {/* Number + name + ONE line */}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] tracking-[0.4em] text-white/35" style={{ fontFamily: sans }}>
                  {label.number}
                </p>
                <h3 className="mt-1 text-xl leading-tight text-white md:text-2xl" style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>
                  {label.name[lang]}
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/55 md:text-sm" style={{ fontFamily: sans }}>
                  {label.description[lang]}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* The glass at the base of the stack */}
      <motion.figure
        className="relative mt-12 flex flex-col items-center"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.2 + stack.length * 0.12, ease: EASE }}
      >
        <span aria-hidden className="absolute left-1/2 top-1/2 h-[75%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${accent}45, transparent 70%)` }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={glassImage} alt={glassLabel?.name[lang] ?? ''} className="relative h-56 w-auto object-contain md:h-64" style={{ filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.8))' }} />
        {glassLabel && (
          <figcaption className="mt-4 text-center">
            <p className="text-lg text-white" style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}>
              {glassLabel.name[lang]}
            </p>
            <p className="mt-1 max-w-xs text-[12px] text-white/50" style={{ fontFamily: sans }}>
              {glassLabel.description[lang]}
            </p>
          </figcaption>
        )}
      </motion.figure>

      {/* Flavor profile — the one "data" block a guest actually understands. */}
      <motion.div
        className="mt-14 flex flex-col items-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 + stack.length * 0.12, ease: EASE }}
      >
        <p className="mb-5 text-center text-[11px] tracking-[0.5em] uppercase text-white/45" style={{ fontFamily: sans }}>
          {isHe ? 'פרופיל הטעמים' : 'Flavor profile'}
        </p>
        <FlavorRadar flavor={flavor} lang={lang} size={230} />
        {note && (
          <p className="mt-8 max-w-xs text-center text-[13px] italic leading-relaxed text-white/55" style={{ fontFamily: serif }}>
            ”{note}“{noteName ? ` — ${noteName}` : ''}
          </p>
        )}
      </motion.div>

      {/* What other guests explored — the recommendation, right below the profile. */}
      <AlsoExplored currentSlug={currentSlug} lang={lang} serif={serif} sans={sans} />
    </motion.section>
  );
}

/* ── "Guests also explored" — co-view recommendation strip ─────────────────── */

interface AlsoExploredProps {
  currentSlug: string;
  lang: Lang;
  serif: string;
  sans: string;
}

/**
 * Shows up to 3 other drinks below the flavor profile. HONEST two-tier source:
 * real co-view data ("guests who opened this also explored…") when the analytics
 * have it for this drink; otherwise a curated same-category fallback labelled as
 * a plain suggestion ("you might also like") — never a fabricated behavior claim.
 */
function AlsoExplored({ currentSlug, lang, serif, sans }: AlsoExploredProps) {
  const isHe = lang === 'he';
  const [picks, setPicks] = useState<CocktailConfig[] | null>(null);
  const [fromGuests, setFromGuests] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let found: CocktailConfig[] = [];
      let behavioral = false;
      try {
        const res = await fetch('/api/analytics/recommendations', { cache: 'no-store' });
        const json: {
          success: boolean;
          data?: { rows?: { slug: string; related?: { slug: string; coViews: number }[] }[] };
        } = await res.json();
        const row = json.success ? json.data?.rows?.find((r) => r.slug === currentSlug) : undefined;
        const related = (row?.related ?? [])
          .map((r) => findCocktailBySlug(r.slug))
          .filter((c): c is CocktailConfig => Boolean(c) && c?.slug !== currentSlug);
        if (related.length > 0) {
          found = related.slice(0, 3);
          behavioral = true;
        }
      } catch {
        /* analytics never breaks the page — fall through to the curated list */
      }
      if (found.length === 0) {
        const self = findCocktailBySlug(currentSlug);
        const sameCategory = MENU.filter((c) => c.slug !== currentSlug && c.category === self?.category);
        const others = MENU.filter((c) => c.slug !== currentSlug && !sameCategory.includes(c));
        found = [...sameCategory, ...others].slice(0, 3);
      }
      if (!cancelled) {
        setPicks(found);
        setFromGuests(behavioral);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentSlug]);

  if (!picks || picks.length === 0) return null;

  const title = fromGuests
    ? isHe ? 'אורחים שפתחו את זה התעניינו גם ב…' : 'Guests who opened this also explored…'
    : isHe ? 'אולי תאהבו גם' : 'You might also like';

  return (
    <motion.aside
      className="mt-14 w-full"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
      aria-label={title}
    >
      <p className="mb-6 text-center text-[11px] tracking-[0.5em] uppercase text-white/45" style={{ fontFamily: sans }}>
        {title}
      </p>
      <div className="flex items-stretch justify-center gap-3">
        {picks.map((c) => {
          const cAccent = getAccent(c.slug);
          return (
            <Link
              key={c.slug}
              href={`/cocktails/${c.slug}`}
              className="group flex w-28 flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-2 pb-3 pt-2 text-center transition-all hover:-translate-y-1 hover:border-white/25 md:w-32"
            >
              <span className="relative block h-24 w-full md:h-28">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle, ${cAccent}40, transparent 70%)` }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.heroImage}
                  alt={c.title[lang]}
                  className="relative h-full w-full object-contain"
                  style={{ filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.7))' }}
                />
              </span>
              <span
                className="block w-full truncate text-[13px] leading-tight text-white/90"
                style={{ fontFamily: serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
              >
                {c.title[lang]}
              </span>
              {c.priceILS !== undefined && (
                <span className="text-[11px] text-amber-100/80" style={{ fontFamily: sans }}>
                  {formatPrice(c.priceILS, 'ILS')}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </motion.aside>
  );
}

/* ── Cinematic video ──────────────────────────────────────────────────────── */

interface VideoStageProps {
  src: string;
  lang: Lang;
  sans: string;
  /** When set, emits the raw `cocktail_video_progress` (max % watched) signal. */
  cocktailSlug?: string;
  onEnd: () => void;
}

function VideoStage({ src, lang, sans, cocktailSlug, onEnd }: VideoStageProps) {
  const isHe = lang === 'he';
  // H-A RAW SIGNAL ONLY: the max % of the video actually watched. No scoring/interpretation here.
  const maxPct = useRef(0);
  const flushed = useRef(false);
  const flushProgress = () => {
    if (flushed.current || !cocktailSlug) return;
    flushed.current = true;
    if (maxPct.current > 0) {
      track({ event: 'cocktail_video_progress', cocktailSlug, value: Math.round(maxPct.current * 100) });
    }
  };
  useEffect(() => {
    window.addEventListener('pagehide', flushProgress);
    return () => {
      window.removeEventListener('pagehide', flushProgress);
      flushProgress(); // emit when the player closes / the guest navigates away
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cocktailSlug]);

  return (
    <motion.section
      className="fixed inset-0 z-40 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      aria-label={isHe ? 'וידאו הכנה' : 'Preparation video'}
    >
      {/* No poster — the footage itself appears immediately, not a still of the drink. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0) {
            const pct = Math.min(1, v.currentTime / v.duration);
            if (pct > maxPct.current) maxPct.current = pct;
          }
        }}
        onEnded={() => {
          maxPct.current = 1;
          flushProgress();
          onEnd();
        }}
        className="h-full w-full object-contain"
      />
      <button
        type="button"
        onClick={onEnd}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-white/25 bg-black/50 px-7 py-2.5 text-[11px] tracking-[0.3em] uppercase text-white/85 backdrop-blur-md transition-colors hover:border-white/50"
        style={{ fontFamily: sans }}
      >
        {isHe ? 'דלג' : 'Skip'}
      </button>
    </motion.section>
  );
}

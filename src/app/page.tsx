'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MenuCard } from '@/components/MenuCard';
import { ImpressionTracker } from '@/components/ImpressionTracker';
import { SettingsToolbar } from '@/components/SettingsToolbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { useFavorites } from '@/lib/useFavorites';
import { useDrafts } from '@/lib/useDrafts';
import { useMenuOrder } from '@/lib/useMenuOrder';
import { useCurrency } from '@/lib/useCurrency';
import { useRestaurant } from '@/lib/useRestaurant';
import { useMenuConfig } from '@/lib/useMenuConfig';
import { track } from '@/lib/tracking/track';
import { setRestaurantSlug } from '@/lib/tracking/queue';
import { MENU, type CocktailConfig, type Lang } from '@/data/cocktail';

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [query, setQuery] = useState('');
  const { isFavorite, toggle } = useFavorites();
  const { drafts } = useDrafts();
  const { apply: applyMenuOrder } = useMenuOrder();
  const { currency, setCurrency } = useCurrency();
  const { name: restaurantName, setName: setRestaurantName, logo: restaurantLogo } = useRestaurant();
  const { promotions, experience } = useMenuConfig('diner');

  const isHebrew = lang === 'he';
  const titleFont = isHebrew ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)';
  const sansFont = isHebrew ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  const allCocktails = useMemo<ReadonlyArray<CocktailConfig>>(
    () => [...MENU, ...drafts.filter((d) => !MENU.some((m) => m.slug === d.slug))],
    [drafts]
  );
  const orderedCocktails = useMemo(() => applyMenuOrder(allCocktails), [allCocktails, applyMenuOrder]);
  const draftSlugs = useMemo(() => new Set(drafts.map((d) => d.slug)), [drafts]);

  // Search is the ONLY filter on the diner's first screen — they came to pick a
  // drink, not to operate a system. Everything else lives one tap into the card.
  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return orderedCocktails;
    return orderedCocktails.filter((cocktail) => {
      const haystack = [
        cocktail.title.en,
        cocktail.title.he,
        cocktail.tagline?.en ?? '',
        cocktail.tagline?.he ?? '',
        ...cocktail.labels.flatMap((l) => [l.name.en, l.name.he]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [query, orderedCocktails]);

  useEffect(() => {
    setRestaurantSlug('diner');
    track({ event: 'menu_opened' });
  }, []);

  const handleToggleFavorite = (slug: string) => {
    const adding = !isFavorite(slug);
    track({
      event: 'cocktail_favorited',
      cocktailSlug: slug,
      value: adding ? 1 : 0,
      metadata: { action: adding ? 'add' : 'remove' },
    });
    toggle(slug);
  };

  return (
    <div className="relative w-full min-h-screen bg-black">
      <BackgroundFX />

      <SettingsToolbar
        lang={lang}
        onLangChange={setLang}
        currency={currency}
        onCurrencyChange={setCurrency}
        restaurantName={restaurantName}
        onRestaurantChange={setRestaurantName}
      />

      <div className="relative z-10 w-full px-6 sm:px-8 pt-24 pb-28 flex flex-col items-center">
        {/* Compact hero — name of the place, what this is, and one search box. No essay. */}
        <motion.header
          className="text-center mb-10 md:mb-12 flex flex-col items-center"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          dir={isHebrew ? 'rtl' : 'ltr'}
          lang={lang}
        >
          {restaurantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurantLogo} alt={restaurantName} className="mb-5 max-h-16 w-auto object-contain" />
          ) : restaurantName ? (
            <p className="text-amber-200/70 text-[11px] tracking-[0.5em] uppercase mb-5" style={{ fontFamily: sansFont }}>
              {restaurantName}
            </p>
          ) : null}

          <h1
            className="text-white leading-[1.05] text-5xl md:text-6xl flex items-center gap-3"
            style={{ fontFamily: titleFont, fontStyle: isHebrew ? 'normal' : 'italic', fontWeight: 600 }}
          >
            <span aria-hidden style={{ fontStyle: 'normal' }}>🍸</span>
            <span
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #fde68a 55%, #d97706 115%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {isHebrew ? 'הקוקטיילים שלנו' : 'Our Cocktails'}
            </span>
          </h1>

          <p className="text-white/55 text-sm md:text-base mt-3" style={{ fontFamily: sansFont, letterSpacing: '0.04em' }}>
            {isHebrew
              ? `${allCocktails.length} קוקטיילים נבחרים`
              : `${allCocktails.length} hand-picked cocktails`}
          </p>

          {/* One clean search box — that's the whole control surface. */}
          <div className="relative mt-7 w-full max-w-sm">
            <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-amber-200/45 ${isHebrew ? 'right-4' : 'left-4'}`} aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isHebrew ? 'חיפוש משקה…' : 'Search a drink…'}
              aria-label={isHebrew ? 'חיפוש משקה' : 'Search a drink'}
              dir={isHebrew ? 'rtl' : 'ltr'}
              className={`w-full rounded-full border border-amber-200/20 bg-white/[0.04] py-3 text-white placeholder:text-white/35 outline-none backdrop-blur-sm transition-colors duration-300 focus:border-amber-200/55 focus:bg-white/[0.06] ${
                isHebrew ? 'pr-11 pl-5 text-right' : 'pl-11 pr-5'
              }`}
              style={{ fontFamily: sansFont, fontSize: '15px' }}
            />
          </div>
        </motion.header>

        {/* The gallery — the whole point of the screen. */}
        {filtered.length === 0 ? (
          <p className="text-center text-white/40 text-base italic mt-10" style={{ fontFamily: titleFont }}>
            {isHebrew ? 'לא נמצא משקה תואם.' : 'No matching drink.'}
          </p>
        ) : (
          <div className="w-full flex justify-center">
            <div className="flex flex-wrap justify-center gap-7 md:gap-8" style={{ width: 'min(100%, 1480px)' }}>
              {filtered.map((cocktail) => (
                <ImpressionTracker key={cocktail.slug} slug={cocktail.slug} className="w-full max-w-[360px] sm:w-[330px] min-w-0">
                  <MenuCard
                    cocktail={cocktail}
                    lang={lang}
                    currency={currency}
                    index={orderedCocktails.indexOf(cocktail)}
                    isFavorite={isFavorite(cocktail.slug)}
                    isDraft={draftSlugs.has(cocktail.slug)}
                    onToggleFavorite={handleToggleFavorite}
                    promotions={promotions}
                    experienceConfig={experience[cocktail.slug]}
                  />
                </ImpressionTracker>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

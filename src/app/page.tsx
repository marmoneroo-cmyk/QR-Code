'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal } from '@/components/ui/motion';
import { MenuCard } from '@/components/MenuCard';
import { ImpressionTracker } from '@/components/ImpressionTracker';
import { SettingsToolbar } from '@/components/SettingsToolbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { MenuFilters, type CategoryFilter } from '@/components/MenuFilters';
import { MoodFilter } from '@/components/MoodFilter';
import { TimeOfDayHint } from '@/components/TimeOfDayHint';
import { TopPicks } from '@/components/TopPicks';
import { matchesMood, type Mood } from '@/lib/mood';
import { useFavorites } from '@/lib/useFavorites';
import { useDrafts } from '@/lib/useDrafts';
import { useMenuOrder } from '@/lib/useMenuOrder';
import { useCurrency } from '@/lib/useCurrency';
import { useRestaurant } from '@/lib/useRestaurant';
import { useViewHistory } from '@/lib/useViewHistory';
import { useMenuConfig } from '@/lib/useMenuConfig';
import { track } from '@/lib/tracking/track';
import { setRestaurantSlug } from '@/lib/tracking/queue';
import Link from 'next/link';
import { CATEGORY_LABEL, MENU, type Category, type CocktailConfig, type Lang } from '@/data/cocktail';

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const { favorites, toggle, isFavorite } = useFavorites();
  const { drafts } = useDrafts();
  const { apply: applyMenuOrder } = useMenuOrder();
  const { currency, setCurrency } = useCurrency();
  const { name: restaurantName, setName: setRestaurantName, logo: restaurantLogo } = useRestaurant();
  const { history: viewHistory } = useViewHistory();
  const { promotions, experience } = useMenuConfig('diner');

  const isHebrew = lang === 'he';
  const titleFont = isHebrew
    ? 'var(--font-frank-ruhl, serif)'
    : 'var(--font-playfair, serif)';
  const sansFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-inter, sans-serif)';
  const bodyFont = isHebrew
    ? 'var(--font-heebo, sans-serif)'
    : 'var(--font-garamond, serif)';

  const allCocktails = useMemo<ReadonlyArray<CocktailConfig>>(
    () => [...MENU, ...drafts.filter((d) => !MENU.some((m) => m.slug === d.slug))],
    [drafts]
  );
  // Apply the manager's custom menu order (identity no-op when none is set).
  const orderedCocktails = useMemo(() => applyMenuOrder(allCocktails), [allCocktails, applyMenuOrder]);
  const draftSlugs = useMemo(() => new Set(drafts.map((d) => d.slug)), [drafts]);

  const categories = useMemo(() => {
    const seen = new Set<Category>();
    for (const c of allCocktails) seen.add(c.category);
    return [...seen];
  }, [allCocktails]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return orderedCocktails.filter((cocktail) => {
      if (filter === 'favorites' && !favorites.has(cocktail.slug)) return false;
      if (mood && !matchesMood(cocktail.flavor, mood)) return false;
      if (filter !== 'all' && filter !== 'favorites' && cocktail.category !== filter) {
        return false;
      }
      if (trimmed.length > 0) {
        const haystack = [
          cocktail.title.en,
          cocktail.title.he,
          cocktail.tagline?.en ?? '',
          cocktail.tagline?.he ?? '',
          ...cocktail.labels.flatMap((l) => [l.name.en, l.name.he]),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(trimmed)) return false;
      }
      return true;
    });
  }, [filter, query, favorites, orderedCocktails, mood]);

  // Always render one flat grid (4 per row) regardless of category — the
  // category chips still filter, but the menu is no longer split into sections.
  const groups = useMemo(
    () => [{ category: null as Category | null, items: filtered }],
    [filtered]
  );

  // --- Analytics: menu opened. Per-cocktail impressions are fired by
  // <ImpressionTracker> only when a card actually scrolls into view (deduped
  // per session) — so "seen" reflects real attention, not list membership. ---
  useEffect(() => {
    setRestaurantSlug('diner');
    track({ event: 'menu_opened' });
  }, []);

  // Fire on BOTH directions with an action, so we can verify Add/Remove rate
  // (a favorite signal that only logs adds can't be data-quality-checked).
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

      <div className="relative z-10 w-full px-8 pt-28 pb-32 flex flex-col items-center">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          dir={isHebrew ? 'rtl' : 'ltr'}
          lang={lang}
        >
          {restaurantLogo && (
            <motion.img
              src={restaurantLogo}
              alt={restaurantName}
              className="mx-auto mb-6 max-h-20 w-auto object-contain"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
          <motion.p
            className="text-amber-200/70 text-[11px] tracking-[0.6em] uppercase mb-8"
            style={{ fontFamily: sansFont }}
            initial={{ opacity: 0, letterSpacing: '0.2em' }}
            animate={{ opacity: 1, letterSpacing: '0.6em' }}
            transition={{ duration: 1.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {restaurantName || (isHebrew ? 'תפריט אינטראקטיבי · 2026' : 'Interactive Menu · 2026')}
          </motion.p>

          <h1
            className="text-white tracking-[0.04em] leading-[1.08]"
            style={{
              fontFamily: titleFont,
              fontWeight: 500,
            }}
          >
            <motion.span
              className="block text-5xl md:text-6xl"
              style={{
                fontStyle: isHebrew ? 'normal' : 'italic',
                background:
                  'linear-gradient(180deg, #ffffff 0%, #fde68a 50%, #d97706 110%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {isHebrew ? 'הקוקטיילים' : 'Our'}
            </motion.span>
            <motion.span
              className="block text-6xl md:text-7xl"
              style={{ fontWeight: 600, color: '#ffffff' }}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {isHebrew ? 'שלנו' : 'Cocktails'}
            </motion.span>
          </h1>

          <motion.div
            className="flex items-center justify-center gap-3 mt-9"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.0, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-amber-200/60" />
            <div className="w-2 h-2 border border-amber-200/70 rotate-45" />
            <div className="w-20 h-px bg-gradient-to-l from-transparent via-amber-200/60 to-amber-200/60" />
          </motion.div>

          <motion.p
            className="text-white/50 text-base mt-8 max-w-md mx-auto leading-relaxed italic"
            style={{ fontFamily: bodyFont }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
          >
            {isHebrew
              ? 'בחר פריט כדי לחקור את המרכיבים שלו בחוויה תלת־ממדית סוחפת.'
              : 'Choose an item to explore its ingredients in an immersive 3D breakdown.'}
          </motion.p>
        </motion.div>

        {viewHistory.length > 0 && filter === 'all' && query.trim().length === 0 && (
          <div className="mb-16 max-w-5xl mx-auto" dir={isHebrew ? 'rtl' : 'ltr'}>
            <p
              className="text-amber-200/70 text-[10px] tracking-[0.4em] uppercase mb-6 text-center"
              style={{ fontFamily: sansFont }}
            >
              {isHebrew ? 'נצפו לאחרונה' : 'Recently viewed'}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {viewHistory
                .map((entry) => allCocktails.find((c) => c.slug === entry.slug))
                .filter((c): c is NonNullable<typeof c> => Boolean(c))
                .slice(0, 5)
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={draftSlugs.has(c.slug) ? `/drafts/${c.slug}` : `/cocktails/${c.slug}`}
                    className="group flex items-center gap-3 px-4 py-2 rounded-full border border-amber-200/15 hover:border-amber-200/50 bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all duration-300"
                  >
                    {c.heroImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.heroImage}
                        alt=""
                        className="w-7 h-7 object-contain shrink-0"
                      />
                    )}
                    <span
                      className="text-white/85 group-hover:text-white text-sm transition-colors"
                      style={{
                        fontFamily: isHebrew
                          ? 'var(--font-frank-ruhl, serif)'
                          : 'var(--font-playfair, serif)',
                        fontStyle: isHebrew ? 'normal' : 'italic',
                      }}
                    >
                      {c.title[lang]}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        )}

        <Reveal className="mb-8 flex flex-col items-center gap-7">
          <TimeOfDayHint lang={lang} />
          {filter === 'all' && query.trim().length === 0 && mood === null && <TopPicks lang={lang} />}
        </Reveal>

        <Reveal delay={0.08} className="mb-10 w-full max-w-3xl">
          <MoodFilter lang={lang} active={mood} onChange={setMood} />
        </Reveal>

        <Reveal delay={0.16} className="mb-20 w-full max-w-3xl">
          <MenuFilters
            lang={lang}
            active={filter}
            categories={categories}
            favoriteCount={favorites.size}
            onChange={setFilter}
            query={query}
            onQueryChange={setQuery}
          />
        </Reveal>

        {filtered.length === 0 ? (
          <p
            className="text-center text-white/40 text-base italic"
            style={{ fontFamily: bodyFont }}
          >
            {isHebrew ? 'אין פריטים תואמים.' : 'No matching items.'}
          </p>
        ) : (
          <div className="space-y-20 w-full">
            {groups.map((group) => (
              <section key={group.category ?? 'all'}>
                {group.category && (
                  <div
                    className="flex items-center gap-4 mb-8 max-w-6xl mx-auto"
                    dir={isHebrew ? 'rtl' : 'ltr'}
                  >
                    <div className="flex-1 h-px bg-amber-200/15" />
                    <h3
                      className="text-amber-200/85 text-[11px] tracking-[0.5em] uppercase"
                      style={{ fontFamily: sansFont, fontWeight: 500 }}
                    >
                      {CATEGORY_LABEL[group.category][lang]}
                    </h3>
                    <div className="flex-1 h-px bg-amber-200/15" />
                  </div>
                )}
                <div className="w-full flex justify-center">
                  <div
                    className="flex flex-wrap justify-center gap-8"
                    style={{ width: 'min(100%, 1480px)' }}
                  >
                    {group.items.map((cocktail) => (
                      <ImpressionTracker
                        key={cocktail.slug}
                        slug={cocktail.slug}
                        className="w-[340px] max-w-full"
                      >
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

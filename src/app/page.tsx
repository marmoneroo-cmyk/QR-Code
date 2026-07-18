'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SettingsToolbar } from '@/components/SettingsToolbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { GlowDivider, EmptyState } from '@/components/ui/premium';
import { MenuRow, type MenuSection } from '@/components/MenuRow';
import { useDrafts } from '@/lib/useDrafts';
import { useMenuOrder } from '@/lib/useMenuOrder';
import { useCurrency } from '@/lib/useCurrency';
import { useRestaurant } from '@/lib/useRestaurant';
import { useMenuConfig } from '@/lib/useMenuConfig';
import { useLang } from '@/lib/useLang';
import { track } from '@/lib/tracking/track';
import { setRestaurantSlug } from '@/lib/tracking/queue';
import { MENU, type CocktailConfig } from '@/data/cocktail';
import { inferKind, type ItemKind } from '@/lib/menu/classify';

const MENU_SCROLL_KEY = 'cocktail-demo:menu-scroll';
const EASE = [0.16, 1, 0.3, 1] as const;

const MENU_SLUGS = new Set(MENU.map((m) => m.slug));

/**
 * Resolve an item's kind for menu grouping. An explicit `kind` always wins; the
 * built-in cocktails are drinks; any other item (e.g. an imported or older draft
 * with no `kind`) is classified from its name so food lands in a food row.
 */
function itemKind(c: CocktailConfig): ItemKind {
  if (c.kind) return c.kind;
  if (MENU_SLUGS.has(c.slug)) return 'drink';
  return inferKind(`${c.title.en} ${c.title.he}`, `${c.course?.en ?? ''} ${c.course?.he ?? ''}`);
}

/** Stable, language-independent grouping identifier for a course — so switching the
 *  guest's language never splits/reshuffles food sections. Falls back through whichever
 *  language the restaurant actually filled in. */
function courseKey(course: CocktailConfig['course']): string {
  const key = (course?.en || course?.he || '').trim().toLowerCase();
  return key || '__dishes__';
}

/** Human display label for a course, in the guest's current language — falls back to
 *  whichever language IS filled in, then to a generic default. */
function courseTitle(course: CocktailConfig['course'], isHe: boolean): string {
  const val = (isHe ? course?.he || course?.en : course?.en || course?.he) ?? '';
  return val.trim() || (isHe ? 'מנות' : 'Dishes');
}

/** Order food sections like a real menu: starters → mains → desserts; drinks last. */
function courseRank(course: CocktailConfig['course']): number {
  const c = `${course?.en ?? ''} ${course?.he ?? ''}`.toLowerCase();
  if (/ראשונ|starter|appetiz|פתיח/.test(c)) return 1;
  if (/סלט|salad/.test(c)) return 2;
  if (/מרק|soup/.test(c)) return 2.5;
  if (/עיקרי|main|המבורגר|burger|פסטה|pasta|סטייק|steak|פיצה|pizza|שניצל/.test(c)) return 3;
  if (/תוספת|side|צ['׳]יפס|fries/.test(c)) return 4;
  if (/ילדים|kids/.test(c)) return 4.5;
  if (/קינוח|dessert/.test(c)) return 5;
  if (/בירה|beer|יין|wine/.test(c)) return 8;
  return 3.5;
}

function matchesQuery(c: CocktailConfig, q: string): boolean {
  if (!q) return true;
  const hay = [
    c.title.en, c.title.he, c.tagline?.en ?? '', c.tagline?.he ?? '', c.course?.en ?? '', c.course?.he ?? '',
    ...c.labels.flatMap((l) => [l.name.en, l.name.he]),
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

export default function Home() {
  const { lang, setLang } = useLang();
  const [query, setQuery] = useState('');
  // Raw `query` drives the input (typing stays instant); the heavier filter/group
  // work keys off this debounced copy so it runs at most ~every 180ms, not per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { drafts } = useDrafts();
  const { apply: applyMenuOrder } = useMenuOrder();
  const { currency, setCurrency } = useCurrency();
  const { name: restaurantName, setName: setRestaurantName, logo: restaurantLogo } = useRestaurant();
  const { promotions, experience } = useMenuConfig('diner');

  const isHe = lang === 'he';
  const titleFont = isHe ? 'var(--font-frank-ruhl, serif)' : 'var(--font-playfair, serif)';
  const sans = isHe ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  // Built-in MENU wins. Hide any draft that duplicates a built-in by slug OR by
  // name (ignoring a trailing "(200 גרם)"-style suffix) — so promoting an item to
  // a built-in rich version doesn't leave the old imported draft showing twice.
  const allCocktails = useMemo<ReadonlyArray<CocktailConfig>>(() => {
    const norm = (s: string) => s.replace(/\([^)]*\)/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
    const menuKeys = new Set<string>();
    for (const m of MENU) {
      menuKeys.add(`s:${m.slug}`);
      if (m.title.he) menuKeys.add(`t:${norm(m.title.he)}`);
      if (m.title.en) menuKeys.add(`t:${norm(m.title.en)}`);
    }
    const uniqueDrafts = drafts.filter(
      (d) => !menuKeys.has(`s:${d.slug}`) && !menuKeys.has(`t:${norm(d.title.he)}`) && !menuKeys.has(`t:${norm(d.title.en)}`)
    );
    return [...MENU, ...uniqueDrafts];
  }, [drafts]);
  const orderedCocktails = useMemo(() => applyMenuOrder(allCocktails), [allCocktails, applyMenuOrder]);
  const draftSlugs = useMemo(() => new Set(drafts.map((d) => d.slug)), [drafts]);
  const featured = orderedCocktails[0] ?? null;

  // Debounce the query: filtering waits ~180ms after the last keystroke so a fast
  // typist doesn't re-filter+regroup the whole menu on every character.
  const SEARCH_DEBOUNCE_MS = 180;
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Group into Netflix-style rows: one per food course, plus one for all cocktails.
  const sections = useMemo<MenuSection[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const food = orderedCocktails.filter((c) => itemKind(c) === 'food');
    const drinks = orderedCocktails.filter((c) => itemKind(c) === 'drink');

    const byCourse = new Map<string, CocktailConfig[]>();
    for (const f of food) {
      const key = courseKey(f.course);
      const arr = byCourse.get(key) ?? [];
      arr.push(f);
      byCourse.set(key, arr);
    }
    const foodSections = [...byCourse.entries()]
      .map(([key, items]) => ({
        key,
        title: courseTitle(items[0]?.course, isHe),
        items,
        rank: courseRank(items[0]?.course),
      }))
      .sort((a, b) => a.rank - b.rank);

    const built: Array<{ key: string; title: string; items: CocktailConfig[] }> = [
      ...foodSections.map((s) => ({ key: `food:${s.key}`, title: s.title, items: s.items })),
      ...(drinks.length ? [{ key: 'bar', title: isHe ? 'קוקטיילים' : 'Cocktails', items: drinks }] : []),
    ];

    return built
      .map((s) => ({
        key: s.key,
        title: s.title,
        items: s.items
          .filter((c) => matchesQuery(c, q))
          .map((cocktail) => ({ cocktail, isDraft: draftSlugs.has(cocktail.slug) })),
      }))
      .filter((s) => s.items.length > 0);
  }, [orderedCocktails, draftSlugs, isHe, debouncedQuery]);

  useEffect(() => {
    setRestaurantSlug('diner');
    track({ event: 'menu_opened' });
  }, []);

  // Scroll memory: returning from an item lands the guest where they were.
  const saveMenuScroll = () => {
    try {
      sessionStorage.setItem(MENU_SCROLL_KEY, String(window.scrollY));
    } catch {
      /* private mode — won't persist */
    }
  };
  useEffect(() => {
    try {
      const saved = Number(sessionStorage.getItem(MENU_SCROLL_KEY));
      if (saved > 0) window.scrollTo(0, saved);
    } catch {
      /* skip */
    }
    window.addEventListener('scroll', saveMenuScroll, { passive: true });
    window.addEventListener('pagehide', saveMenuScroll);
    return () => {
      window.removeEventListener('scroll', saveMenuScroll);
      window.removeEventListener('pagehide', saveMenuScroll);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-black" onClickCapture={saveMenuScroll}>
      <BackgroundFX />
      <SettingsToolbar
        lang={lang}
        onLangChange={setLang}
        currency={currency}
        onCurrencyChange={setCurrency}
        restaurantName={restaurantName}
        onRestaurantChange={setRestaurantName}
      />

      {/* ── Cinematic hero — one big wow on entry ─────────────────────────── */}
      <section
        className="relative flex min-h-[42vh] w-full flex-col items-center justify-center overflow-hidden px-6 pt-24 pb-7 text-center md:min-h-[56vh] md:pb-10"
        dir={isHe ? 'rtl' : 'ltr'}
      >
        {featured && (
           
          <motion.img
            src={featured.heroImage}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="async"
            className="pointer-events-none absolute left-1/2 top-[44%] h-[80%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{ filter: 'drop-shadow(0 40px 80px rgba(0,0,0,0.9))' }}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.28, scale: 1 }}
            transition={{ duration: 1.8, ease: EASE }}
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(110% 75% at 50% 38%, transparent, rgba(0,0,0,0.55) 78%), linear-gradient(to bottom, rgba(0,0,0,0.35), transparent 35%, transparent 60%, #000 96%)' }}
        />

        <motion.div className="relative z-10 flex flex-col items-center" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.0, ease: EASE }} lang={lang}>
          {restaurantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurantLogo} alt={restaurantName} className="mb-5 max-h-16 w-auto object-contain" />
          ) : (
            <p className="mb-4 text-amber-200/70 text-11 tracking-[0.55em] uppercase" style={{ fontFamily: sans }}>
              {isHe ? 'תפריט' : 'Menu'}
            </p>
          )}

          <h1
            className="text-white leading-[1.04] text-5xl md:text-7xl"
            style={{ fontFamily: titleFont, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
          >
            <span
              style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #fde68a 58%, #d97706 120%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {restaurantName || (isHe ? 'התפריט שלנו' : 'Our Menu')}
            </span>
          </h1>

          <p className="mt-4 text-white/55 text-sm md:text-base" style={{ fontFamily: sans, letterSpacing: '0.04em' }}>
            {isHe ? `${orderedCocktails.length} מנות ומשקאות` : `${orderedCocktails.length} dishes & drinks`}
          </p>

          <GlowDivider className="mt-5" />

          <div className="relative mt-6 w-full max-w-sm">
            <span className="pointer-events-none absolute top-1/2 start-4 -translate-y-1/2 text-amber-200/45" aria-hidden>
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
              placeholder={isHe ? 'חיפוש בתפריט…' : 'Search the menu…'}
              aria-label={isHe ? 'חיפוש בתפריט' : 'Search the menu'}
              dir={isHe ? 'rtl' : 'ltr'}
              className="glass-chrome w-full rounded-full py-3 ps-11 pe-5 text-start text-white placeholder:text-white/60 outline-none backdrop-blur-xl transition-colors duration-300 focus:border-amber-200/55"
              style={{ fontFamily: sans, fontSize: '15px' }}
            />
          </div>
        </motion.div>
      </section>

      {/* ── The rows ──────────────────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <div className="relative z-10 py-16" dir={isHe ? 'rtl' : 'ltr'}>
          <EmptyState
            title={
              debouncedQuery.trim()
                ? isHe
                  ? `לא נמצאו תוצאות ל״${debouncedQuery.trim()}״`
                  : `No matches for “${debouncedQuery.trim()}”`
                : isHe
                  ? 'התפריט ריק כרגע'
                  : 'The menu is empty right now'
            }
            hint={
              debouncedQuery.trim()
                ? isHe
                  ? 'נסו מילה אחרת, או נקו את החיפוש'
                  : 'Try a different word, or clear the search'
                : undefined
            }
          />
        </div>
      ) : (
        <div className="relative z-10 flex flex-col gap-12 pb-28 pt-2 md:gap-14">
          {sections.map((section, i) => (
            <MenuRow
              key={section.key}
              section={section}
              lang={lang}
              currency={currency}
              promotions={promotions}
              experience={experience}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

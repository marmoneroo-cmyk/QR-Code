'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatPrice, getAccent, getHoverVideo, type CocktailConfig, type Currency, type Lang } from '@/data/cocktail';
import { resolveDinerBadges, resolveDinerPrice } from '@/data/experience';
import { MenuBadges } from './MenuBadges';
import { SmartImage } from './ui/SmartImage';
import { ImpressionTracker } from './ImpressionTracker';
import type { Promotion } from '@/lib/promotions/types';
import type { ExperienceConfig } from '@/lib/experience/types';

/**
 * A menu SECTION: a section title + a responsive grid of image-forward cards
 * (2 per row on phones, 3–4 on wider screens). One section per food course or
 * "Cocktails" (drinks). Vertical scroll — no horizontal rail.
 *
 * Phase-5 "Obsidian & Champagne": in large sections the FIRST item becomes a
 * double-size featured tile (the photography leads), card footers are glass,
 * and hover reveals a per-drink accent ring. Presentation only — impression
 * tracking, badge/price resolution and hover-video behavior are unchanged.
 */

const serif = 'var(--font-playfair, serif)';
const serifHe = 'var(--font-frank-ruhl, serif)';
const sans = 'var(--font-inter, sans-serif)';

export interface MenuSection {
  key: string;
  /** Display title — already in the right language (food = the restaurant's own section). */
  title: string;
  items: ReadonlyArray<{ cocktail: CocktailConfig; isDraft: boolean }>;
}

interface MenuRowProps {
  section: MenuSection;
  lang: Lang;
  currency: Currency;
  promotions?: Promotion[];
  experience: Record<string, ExperienceConfig>;
  index: number;
}

/**
 * Column count per breakpoint, capped to the section's own item count so a sparse
 * section (e.g. a "Specials" course with one item) never reserves empty grid tracks —
 * the classic symptom being a lone card floating beside a dead void. Once a section has
 * enough items to fill the curated 2/3/4 ladder, this is identical to it.
 */
function gridColsClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-2 md:grid-cols-3';
  return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
}

/** Matches the lg:4-column card width (~360px) so a capped-column row's cards stay
 *  the same visual scale as a full row instead of stretching to fill the section —
 *  undefined once there are enough items to fill the curated ladder (uses its own
 *  max-w-[1500px] ceiling instead). */
function gridMaxWidthPx(count: number): number | undefined {
  const CARD_W = 360;
  const GAP = 20;
  if (count <= 0 || count >= 4) return undefined;
  return count * CARD_W + (count - 1) * GAP;
}

export function MenuRow({ section, lang, currency, promotions, experience, index }: MenuRowProps) {
  const isHe = lang === 'he';
  const reduce = useReducedMotion();
  // One shared "now" for the whole row: time-based badges/prices resolve AFTER mount
  // (SSR-safe, null until then). Computed once here instead of once per card, so a
  // section of N cards no longer triggers N independent mount re-renders.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return (
    <motion.section
      className="w-full"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.7, delay: Math.min(index * 0.05, 0.25), ease: [0.16, 1, 0.3, 1] }}
      dir={isHe ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <div className="mx-auto mb-5 flex max-w-[1500px] items-baseline gap-4 px-6 md:px-10">
        <h2
          className="shrink-0 text-white text-xl md:text-2xl"
          style={{ fontFamily: isHe ? serifHe : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
        >
          {section.title}
        </h2>
        <span aria-hidden className="h-px flex-1 self-center" style={{ background: 'linear-gradient(90deg, rgba(232,201,135,0.22), rgba(255,255,255,0.06) 55%, transparent)' }} />
        {section.items.length > 1 && (
          <span className="shrink-0 text-[11px] tracking-[0.25em] tabular-nums" style={{ fontFamily: sans, color: 'rgba(232,201,135,0.55)' }}>
            {section.items.length}
          </span>
        )}
      </div>

      {/* Responsive grid — 2 per row on phones, 3–4 on wider screens, capped to the
          section's own item count so a sparse row never leaves empty tracks.
          Large sections lead with a double-size featured tile. */}
      <div
        className={`mx-auto grid max-w-[1500px] gap-3 px-6 pb-2 md:gap-5 md:px-10 ${gridColsClass(section.items.length)}`}
        style={{ maxWidth: gridMaxWidthPx(section.items.length) }}
      >
        {section.items.map(({ cocktail, isDraft }, i) => {
          const featured = section.items.length >= 5 && i === 0;
          return (
            <ImpressionTracker
              key={cocktail.slug}
              slug={cocktail.slug}
              className={`min-w-0 ${featured ? 'md:col-span-2 md:row-span-2' : ''}`}
            >
              <RowCard
                cocktail={cocktail}
                isDraft={isDraft}
                lang={lang}
                currency={currency}
                promotions={promotions}
                experienceConfig={experience[cocktail.slug]}
                now={now}
                delay={i}
                featured={featured}
              />
            </ImpressionTracker>
          );
        })}
      </div>
    </motion.section>
  );
}

interface RowCardProps {
  cocktail: CocktailConfig;
  isDraft: boolean;
  lang: Lang;
  currency: Currency;
  promotions?: Promotion[];
  experienceConfig?: ExperienceConfig;
  /** Shared post-mount timestamp from MenuRow; null until mounted (SSR-safe). */
  now: Date | null;
  delay: number;
  /** Double-size lead tile — bigger type/padding; same behavior. */
  featured?: boolean;
}

function RowCard({ cocktail, isDraft, lang, currency, promotions, experienceConfig, now, delay, featured }: RowCardProps) {
  const isHe = lang === 'he';
  const reduce = useReducedMotion();
  const accent = getAccent(cocktail.slug);
  const href = isDraft ? `/drafts/${cocktail.slug}` : `/cocktails/${cocktail.slug}`;
  const hoverVideo = getHoverVideo(cocktail.slug);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Time-based badges/price resolved AFTER mount (no SSR/CSR hydration mismatch),
  // using the single `now` shared by the whole MenuRow.
  const badges = now ? resolveDinerBadges(cocktail, now, { promotions, experienceConfig }) : [];
  const priced = now ? resolveDinerPrice(cocktail, now, { promotions }) : null;

  const onEnter = () => {
    if (!hoverVideo) return;
    setPlaying(true);
    const v = videoRef.current;
    if (v) { v.muted = true; v.currentTime = 0; void v.play().catch(() => {}); }
  };
  const onLeave = () => {
    if (!hoverVideo) return;
    setPlaying(false);
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = 0; }
  };

  return (
    <motion.div
      className="relative h-full w-full"
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, delay: Math.min(delay * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      {badges.length > 0 && (
        <div className="pointer-events-none absolute top-2.5 start-2.5 z-20">
          <MenuBadges badges={badges} lang={lang} />
        </div>
      )}
      {hoverVideo && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-2.5 end-2.5 z-20 grid place-items-center w-7 h-7 rounded-full border border-white/15 bg-black/45 backdrop-blur-md text-amber-100/80"
        >
          <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor"><path d="M0 0l9 5-9 5z" /></svg>
        </span>
      )}
      <Link
        href={href}
        className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div
          className="relative h-full min-h-0 aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.14] bg-gradient-to-b from-zinc-800/60 via-zinc-950 to-black transition-all duration-500 group-hover:-translate-y-1.5"
          style={{ boxShadow: '0 30px 60px -24px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.09)' }}
        >
          {/* per-drink accent: soft wash + hairline ring, both hover-revealed */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: `radial-gradient(120% 80% at 50% 30%, ${accent}24, transparent 70%)` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl border opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ borderColor: `${accent}55` }}
          />
          {/* Image fills the card; name + price sit on a glass footer. */}
          <div className="absolute inset-0 flex flex-col">
            <div className="relative flex-1 min-h-0">
              <span aria-hidden className="absolute inset-x-6 bottom-3 h-12 rounded-full blur-2xl" style={{ background: `radial-gradient(ellipse at center, ${accent}40, transparent 70%)` }} />
              <SmartImage
                src={cocktail.heroImage}
                alt={cocktail.title[lang]}
                sizes="(max-width: 768px) 50vw, 25vw"
                className={`object-contain drop-shadow-[0_22px_38px_rgba(0,0,0,0.75)] transition-transform duration-500 group-hover:scale-[1.05] ${
                  featured ? 'px-5 pt-7 pb-1 md:px-10 md:pt-12' : 'px-3 pt-5 pb-1 md:px-5 md:pt-7'
                }`}
                style={{ opacity: hoverVideo && playing ? 0 : 1 }}
              />
              {hoverVideo && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={videoRef}
                  src={hoverVideo}
                  muted
                  loop
                  playsInline
                  preload="none"
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                    featured ? 'px-5 pt-7 pb-1 md:px-10 md:pt-12' : 'px-3 pt-5 pb-1 md:px-5 md:pt-7'
                  }`}
                  style={{ opacity: playing ? 1 : 0 }}
                />
              )}
            </div>
            <div
              className={`relative shrink-0 border-t border-white/[0.07] bg-black/35 backdrop-blur-md ${
                featured ? 'px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4' : 'px-3 pb-3 pt-2.5 md:px-4 md:pb-4'
              }`}
              dir={isHe ? 'rtl' : 'ltr'}
            >
              <div className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 -z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 45%, transparent)' }} />
              <h3
                className={`line-clamp-2 text-white leading-tight ${featured ? 'text-[17px] md:text-[24px]' : 'text-[16px]'}`}
                style={{ fontFamily: isHe ? serifHe : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
              >
                {cocktail.title[lang]}
              </h3>
              {featured && cocktail.tagline && (
                <p className="mt-1 hidden md:block text-white/50 text-[12.5px] leading-snug line-clamp-1" style={{ fontFamily: sans }}>
                  {cocktail.tagline[lang]}
                </p>
              )}
              {priced && priced.discounted ? (
                <p className="mt-1 inline-flex items-baseline gap-1.5" style={{ fontFamily: sans }} dir="ltr">
                  <span className="text-[12px] line-through opacity-40">{formatPrice(priced.original, currency)}</span>
                  <span className={`text-amber-300 font-semibold ${featured ? 'text-[15px] md:text-[18px]' : 'text-[15px]'}`}>{formatPrice(priced.price, currency)}</span>
                </p>
              ) : cocktail.priceILS !== undefined ? (
                <p className={`mt-1 text-amber-100/90 ${featured ? 'text-[15px] md:text-[18px]' : 'text-[15px]'}`} style={{ fontFamily: sans, fontWeight: 600 }} dir="ltr">
                  {formatPrice(cocktail.priceILS, currency)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

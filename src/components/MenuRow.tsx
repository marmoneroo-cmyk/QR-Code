'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { formatPrice, getAccent, getHoverVideo, type CocktailConfig, type Currency, type Lang } from '@/data/cocktail';
import { resolveDinerBadges, resolveDinerPrice } from '@/data/experience';
import { MenuBadges } from './MenuBadges';
import { ImpressionTracker } from './ImpressionTracker';
import type { Promotion } from '@/lib/promotions/types';
import type { ExperienceConfig } from '@/lib/experience/types';

/**
 * A Netflix-style menu ROW: a section title + a horizontal, snap-scrolling rail
 * of image-forward cards. One row per course (food) or "Cocktails" (drinks).
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

export function MenuRow({ section, lang, currency, promotions, experience, index }: MenuRowProps) {
  const isHe = lang === 'he';
  return (
    <motion.section
      className="w-full"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay: Math.min(index * 0.05, 0.25), ease: [0.16, 1, 0.3, 1] }}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto mb-4 flex max-w-[1500px] items-baseline gap-3 px-6 md:px-10">
        <h2
          className="text-white text-xl md:text-2xl"
          style={{ fontFamily: isHe ? serifHe : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
        >
          {section.title}
        </h2>
        <span className="text-amber-200/40 text-[11px] tracking-[0.25em]" style={{ fontFamily: sans }}>
          {section.items.length}
        </span>
      </div>

      {/* The rail */}
      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-3 md:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {section.items.map(({ cocktail, isDraft }, i) => (
          <ImpressionTracker key={cocktail.slug} slug={cocktail.slug} className="shrink-0 snap-start">
            <RowCard
              cocktail={cocktail}
              isDraft={isDraft}
              lang={lang}
              currency={currency}
              promotions={promotions}
              experienceConfig={experience[cocktail.slug]}
              delay={i}
            />
          </ImpressionTracker>
        ))}
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
  delay: number;
}

function RowCard({ cocktail, isDraft, lang, currency, promotions, experienceConfig, delay }: RowCardProps) {
  const isHe = lang === 'he';
  const accent = getAccent(cocktail.slug);
  const href = isDraft ? `/drafts/${cocktail.slug}` : `/cocktails/${cocktail.slug}`;
  const hoverVideo = getHoverVideo(cocktail.slug);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Time-based badges/price resolved AFTER mount (no SSR/CSR hydration mismatch).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
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
      className="relative w-[210px] shrink-0 snap-start md:w-[230px]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: Math.min(delay * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      {badges.length > 0 && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-20">
          <MenuBadges badges={badges} lang={lang} />
        </div>
      )}
      <Link href={href} className="group block" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <div
          className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 via-black to-zinc-950/80 transition-all duration-500 group-hover:-translate-y-1.5 md:h-80"
          style={{ boxShadow: '0 30px 60px -24px rgba(0,0,0,0.8)' }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: `radial-gradient(120% 80% at 50% 30%, ${accent}24, transparent 70%)` }}
          />
          {/* Image fills the card; name + price sit on a scrim. */}
          <div className="absolute inset-0 flex flex-col">
            <div className="relative flex-1 min-h-0">
              <span aria-hidden className="absolute inset-x-6 bottom-3 h-12 rounded-full blur-2xl" style={{ background: `radial-gradient(ellipse at center, ${accent}40, transparent 70%)` }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cocktail.heroImage}
                alt={cocktail.title[lang]}
                className="absolute inset-0 h-full w-full object-contain px-5 pt-7 pb-1 drop-shadow-[0_22px_38px_rgba(0,0,0,0.75)] transition-transform duration-500 group-hover:scale-[1.05]"
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
                  className="absolute inset-0 h-full w-full object-contain px-5 pt-7 pb-1 transition-opacity duration-500"
                  style={{ opacity: playing ? 1 : 0 }}
                />
              )}
            </div>
            <div className="relative shrink-0 px-4 pb-4 pt-2" dir={isHe ? 'rtl' : 'ltr'}>
              <div className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 40%, transparent)' }} />
              <h3
                className="truncate text-white text-[16px] leading-tight"
                style={{ fontFamily: isHe ? serifHe : serif, fontStyle: isHe ? 'normal' : 'italic', fontWeight: 600 }}
              >
                {cocktail.title[lang]}
              </h3>
              {priced && priced.discounted ? (
                <p className="mt-1 inline-flex items-baseline gap-1.5" style={{ fontFamily: sans }} dir="ltr">
                  <span className="text-[12px] line-through opacity-40">{formatPrice(priced.original, currency)}</span>
                  <span className="text-amber-300 text-[15px] font-semibold">{formatPrice(priced.price, currency)}</span>
                </p>
              ) : cocktail.priceILS !== undefined ? (
                <p className="mt-1 text-amber-100/90 text-[15px]" style={{ fontFamily: sans, fontWeight: 600 }} dir="ltr">
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

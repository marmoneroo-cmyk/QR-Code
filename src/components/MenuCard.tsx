'use client';

import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef, useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { formatPrice, getHoverVideo, type CocktailConfig, type Currency, type Lang } from '@/data/cocktail';
import { resolveDinerBadges, resolveDinerPrice } from '@/data/experience';
import { MenuBadges } from './MenuBadges';
import type { Promotion } from '@/lib/promotions/types';
import type { ExperienceConfig } from '@/lib/experience/types';

interface MenuCardProps {
  cocktail: CocktailConfig;
  lang: Lang;
  currency?: Currency;
  index?: number;
  isFavorite?: boolean;
  isDraft?: boolean;
  onToggleFavorite?: (slug: string) => void;
  /** Owner-configured promotions (from the DB; falls back to in-code defaults). */
  promotions?: Promotion[];
  /** Owner-configured experience for this cocktail (badges/modules). */
  experienceConfig?: ExperienceConfig;
}

export function MenuCard({
  cocktail,
  lang,
  currency = 'ILS',
  index = 0,
  isFavorite = false,
  isDraft = false,
  onToggleFavorite,
  promotions,
  experienceConfig,
}: MenuCardProps) {
  const href = isDraft ? `/drafts/${cocktail.slug}` : `/cocktails/${cocktail.slug}`;
  const hoverVideo = getHoverVideo(cocktail.slug);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  // Resolve time-based badges/price client-side AFTER mount (avoids SSR/CSR
  // hydration mismatch; authoritative resolution moves server-side with the menu).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const badges = now ? resolveDinerBadges(cocktail, now, { promotions, experienceConfig }) : [];
  const priced = now ? resolveDinerPrice(cocktail, now, { promotions }) : null;
  const xPos = useMotionValue(0);
  const yPos = useMotionValue(0);

  const rotateX = useSpring(useTransform(yPos, [-0.5, 0.5], [16, -16]), {
    stiffness: 180,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(xPos, [-0.5, 0.5], [-16, 16]), {
    stiffness: 180,
    damping: 22,
  });
  const shineX = useTransform(xPos, [-0.5, 0.5], ['10%', '90%']);
  const shineY = useTransform(yPos, [-0.5, 0.5], ['10%', '90%']);

  const handleMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = (event.clientY - rect.top) / rect.height - 0.5;
    xPos.set(nx);
    yPos.set(ny);
  };

  const handleEnter = () => {
    setPlaying(true);
    const v = videoRef.current;
    if (v) {
      v.muted = true; // some browsers require the property (not just attr) before play()
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  };

  const handleLeave = () => {
    xPos.set(0);
    yPos.set(0);
    setPlaying(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  // Tap-to-play for touch devices (hover is unreliable on phones). Stops the
  // click from bubbling to the card's <Link> so it plays in place instead of
  // navigating.
  const togglePlay = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      v.currentTime = 0;
      setPlaying(false);
    } else {
      v.muted = true;
      v.currentTime = 0;
      void v.play().catch(() => {});
      setPlaying(true);
    }
  };

  const isHebrew = lang === 'he';

  return (
    <div className="relative">
      {badges.length > 0 && (
        <div className="pointer-events-none absolute top-3 left-3 z-30">
          <MenuBadges badges={badges} lang={lang} />
        </div>
      )}
      <Link href={href} className="block">
      <motion.div
        className="relative w-full h-[560px] [transform-style:preserve-3d]"
        style={{ perspective: 1600 }}
        onMouseMove={handleMove}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 1.1,
          delay: 0.5 + index * 0.15,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <motion.div
          className="pointer-events-none absolute -inset-10 rounded-3xl opacity-60"
          style={{
            background:
              'radial-gradient(circle at center, rgba(252,211,77,0.18), transparent 65%)',
            filter: 'blur(40px)',
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="group relative w-full h-full rounded-2xl border border-amber-200/25 hover:border-amber-200/60 bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950/80 overflow-hidden transition-colors duration-500"
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
            boxShadow:
              '0 50px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at top, rgba(252,211,77,0.06), transparent 60%)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at bottom, rgba(190,24,93,0.18), transparent 65%)',
              }}
            />
          </div>

          <motion.div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background:
                'radial-gradient(circle at var(--mx) var(--my), rgba(252,211,77,0.16), transparent 55%)',
              ['--mx' as string]: shineX,
              ['--my' as string]: shineY,
            }}
          />

          <div
            className="pointer-events-none absolute top-0 left-0 right-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(252,211,77,0.6), transparent)',
            }}
          />

          <div
            className="absolute top-5 left-5 right-5 flex items-center justify-between z-20"
            style={{ transform: 'translateZ(20px)' }}
          >
            <span
              className="text-amber-200/60 text-[9px] tracking-[0.4em] uppercase opacity-70"
              style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
            >
              No. {String(index + 1).padStart(2, '0')}
            </span>
            {onToggleFavorite ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(cocktail.slug);
                }}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`relative w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 ${
                  isFavorite
                    ? 'border-rose-300/80 bg-rose-900/30 text-rose-200 shadow-[0_0_12px_rgba(244,114,182,0.4)]'
                    : 'border-amber-200/40 text-amber-200/60 hover:text-amber-100 hover:border-amber-200/70'
                }`}
              >
                <svg
                  width="11"
                  height="10"
                  viewBox="0 0 11 10"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.2"
                >
                  <path d="M5.5 9.2L4.5 8.3C1.5 5.7 0 4.4 0 2.7 0 1.3 1.1 0.2 2.5 0.2c0.8 0 1.6 0.4 2 1 0.4-0.6 1.2-1 2-1C7.9 0.2 9 1.3 9 2.7c0 1.7-1.5 3-4.5 5.6L5.5 9.2z" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 opacity-70">
                <div className="w-3 h-px bg-amber-200/50" />
                <div className="w-1 h-1 border border-amber-200/60 rotate-45" />
                <div className="w-3 h-px bg-amber-200/50" />
              </div>
            )}
          </div>

          {/*
            Content laid out as a flex COLUMN so the glass image and the
            description can never overlap, no matter how long the title is:
            the image takes the remaining space on top, the text takes only
            what it needs at the bottom.
          */}
          <div
            className="absolute inset-0 flex flex-col"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div
              className="pointer-events-none relative flex-1 min-h-0 flex items-end justify-center px-6 pt-14 pb-3"
              style={{ transform: 'translateZ(60px)' }}
            >
              <div
                className="pointer-events-none absolute inset-x-10 bottom-1 h-12 opacity-50 group-hover:opacity-80 transition-opacity duration-700"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(252,211,77,0.5), transparent 70%)',
                  filter: 'blur(20px)',
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cocktail.heroImage}
                alt={cocktail.title[lang]}
                className="relative object-contain max-h-full max-w-[82%] drop-shadow-[0_30px_60px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_30px_80px_rgba(252,211,77,0.35)] transition-opacity duration-500"
                style={{ opacity: hoverVideo && playing ? 0 : 1 }}
              />
              {hoverVideo && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  ref={videoRef}
                  src={hoverVideo}
                  poster={cocktail.heroImage}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="absolute inset-0 m-auto h-full w-full object-contain transition-opacity duration-500"
                  style={{ opacity: playing ? 1 : 0 }}
                />
              )}
            </div>

            {/*
              Fixed-height text block so EVERY card is identical: the title
              always reserves two lines, the tagline always reserves two
              lines, and the price + "Explore" row is pinned to the same
              baseline via mt-auto. Result — all rows line up across cards
              regardless of title length or content.
            */}
            <div
              className="relative shrink-0 h-[244px] px-7 pb-7 pt-1 flex flex-col"
              style={{ transform: 'translateZ(40px)' }}
              dir={isHebrew ? 'rtl' : 'ltr'}
              lang={lang}
            >
              <div className={`flex items-center gap-2 mb-4 opacity-70 ${isHebrew ? 'justify-end' : ''}`}>
                <div className="w-7 h-px bg-amber-200/60" />
                <div className="w-1 h-1 border border-amber-200/80 rotate-45" />
                <div className="w-7 h-px bg-amber-200/60" />
              </div>
              <h2
                className="text-3xl text-white leading-tight line-clamp-2 min-h-[4.6rem]"
                style={{
                  fontFamily: isHebrew
                    ? 'var(--font-frank-ruhl, serif)'
                    : 'var(--font-playfair, serif)',
                  fontStyle: isHebrew ? 'normal' : 'italic',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
              >
                {cocktail.title[lang]}
              </h2>
              <p
                className="text-[12px] text-amber-200/75 mt-2 leading-relaxed line-clamp-2 min-h-[2.4rem]"
                style={{
                  fontFamily: isHebrew
                    ? 'var(--font-heebo, sans-serif)'
                    : 'var(--font-garamond, serif)',
                }}
              >
                {cocktail.tagline?.[lang] ?? ''}
              </p>
              <div className={`mt-auto flex items-end justify-between gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <p
                  className="text-amber-100 text-lg tracking-wider"
                  style={{
                    fontFamily: 'var(--font-inter, sans-serif)',
                    fontWeight: 500,
                  }}
                >
                  {priced && priced.discounted ? (
                  <span className="inline-flex items-baseline gap-2">
                    <span className="text-sm line-through opacity-40">
                      {formatPrice(priced.original, currency)}
                    </span>
                    <span className="text-amber-300">{formatPrice(priced.price, currency)}</span>
                  </span>
                ) : cocktail.priceILS !== undefined ? (
                  formatPrice(cocktail.priceILS, currency)
                ) : (
                  ''
                )}
                </p>
                <div
                  className={`flex items-center gap-2 text-amber-200/60 group-hover:text-amber-100 transition-all duration-500 ${
                    isHebrew ? 'flex-row-reverse' : ''
                  }`}
                >
                  <span
                    className="text-[10px] tracking-[0.35em] uppercase whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
                  >
                    {isHebrew ? 'גלה את הקוקטייל' : 'Explore breakdown'}
                  </span>
                  <motion.span
                    className="text-base"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {isHebrew ? '←' : '→'}
                  </motion.span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(252,211,77,0.4), transparent)',
            }}
          />
        </motion.div>
      </motion.div>
      </Link>

      {hoverVideo && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={
            playing ? (isHebrew ? 'עצור סרטון' : 'Stop video') : (isHebrew ? 'נגן סרטון' : 'Play video')
          }
          className={`absolute left-1/2 top-[34%] z-40 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200/70 bg-black/55 backdrop-blur-md text-amber-100 shadow-[0_8px_30px_rgba(0,0,0,0.65)] transition-all duration-300 hover:scale-110 hover:border-amber-200 active:scale-95 ${
            playing ? 'h-10 w-10 opacity-50' : 'h-16 w-16 opacity-95'
          }`}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

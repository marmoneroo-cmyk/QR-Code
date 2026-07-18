import type { ActiveBadge, BadgeTone } from '@/lib/experience/types';
import type { Lang } from '@/data/cocktail';

/** Restrained, luxury badge styling per tone (no loud colours). */
const TONE_CLASS: Record<BadgeTone, string> = {
  gold: 'border-amber-300/45 text-amber-200 bg-amber-300/10',
  hot: 'border-rose-300/45 text-rose-200 bg-rose-400/10',
  cool: 'border-sky-300/40 text-sky-100 bg-sky-400/10',
  accent: 'border-white/30 text-white/90 bg-white/10',
};

interface MenuBadgesProps {
  badges: ActiveBadge[];
  lang: Lang;
  className?: string;
}

export function MenuBadges({ badges, lang, className = '' }: MenuBadgesProps) {
  if (badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b) => (
        <span
          key={`${b.kind}:${b.label.en}`}
          className={`px-2.5 py-1 rounded-full border backdrop-blur-md text-8 leading-none tracking-[0.2em] uppercase ${TONE_CLASS[b.tone]}`}
          style={{ fontFamily: 'var(--font-inter, sans-serif)' }}
        >
          {b.label[lang] || b.label.en}
        </span>
      ))}
    </div>
  );
}

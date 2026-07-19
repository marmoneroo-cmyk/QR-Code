import { getStory } from '@/data/stories';
import type { Lang } from '@/data/cocktail';

/** The "story" experience module — a short evocative line. Hidden if none exists. */
export function CocktailStory({ slug, lang }: { slug: string; lang: Lang }) {
  const story = getStory(slug);
  if (!story) return null;
  const isHebrew = lang === 'he';
  const serif = isHebrew ? 'var(--font-frank-ruhl, serif)' : 'var(--font-garamond, serif)';

  return (
    <section className="px-6 pt-9 flex flex-col items-center text-center max-w-xl mx-auto" dir={isHebrew ? 'rtl' : 'ltr'}>
      <p className="text-amber-200/70 text-10 tracking-[0.45em] uppercase mb-3 font-sans">
        {isHebrew ? 'הסיפור' : 'The Story'}
      </p>
      <p
        className="text-white/75 text-15 leading-relaxed"
        style={{ fontFamily: serif, fontStyle: isHebrew ? 'normal' : 'italic' }}
      >
        {story[lang]}
      </p>
    </section>
  );
}

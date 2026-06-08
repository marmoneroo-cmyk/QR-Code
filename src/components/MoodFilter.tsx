import { MOODS, MOOD_LABEL, type Mood } from '@/lib/mood';
import type { Lang } from '@/data/cocktail';

interface MoodFilterProps {
  lang: Lang;
  active: Mood | null;
  onChange: (mood: Mood | null) => void;
}

/** "What suits me now?" — a restrained mood selector above the menu grid. */
export function MoodFilter({ lang, active, onChange }: MoodFilterProps) {
  const isHebrew = lang === 'he';
  const sans = isHebrew ? 'var(--font-heebo, sans-serif)' : 'var(--font-inter, sans-serif)';

  return (
    <div className="flex flex-col items-center gap-3" dir={isHebrew ? 'rtl' : 'ltr'}>
      <p className="text-amber-200/60 text-[10px] tracking-[0.4em] uppercase" style={{ fontFamily: sans }}>
        {isHebrew ? 'מה מתאים לי עכשיו?' : 'What suits me now?'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {MOODS.map((m) => {
          const on = active === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(on ? null : m)}
              className={`px-4 py-1.5 rounded-full border text-[11px] tracking-[0.12em] transition-colors ${
                on
                  ? 'border-amber-300/70 text-amber-100 bg-amber-300/10'
                  : 'border-white/15 text-white/55 hover:border-amber-200/40'
              }`}
              style={{ fontFamily: sans }}
            >
              {MOOD_LABEL[m][lang]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

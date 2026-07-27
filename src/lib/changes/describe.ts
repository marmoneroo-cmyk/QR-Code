import { findCocktailBySlug } from '@/data/cocktail';
import type { ChangeRecord } from './repository';

/**
 * Owner-facing display for a change-log entry.
 *
 * The audit log stores a language-neutral `summary` (a promo name, an item, or
 * the owner's own free text) and encodes the ACTION in `changeType`. This turns
 * that pair into a localized label + detail, and also strips the English wrappers
 * ("Promotion updated: …", "Promotion deleted") that older rows baked into their
 * summary before the log went language-neutral — so a Hebrew owner never sees
 * English verbs on their timeline.
 */
export interface ChangeDisplay {
  /** Localized action verb, e.g. "מבצע נוסף". Empty for free-text/manual entries. */
  label: string;
  /** The meaningful detail — promo name, item, or the owner's own summary. */
  detail: string;
}

const ACTION_LABELS: Record<string, { en: string; he: string }> = {
  promotion_created: { en: 'Promotion added', he: 'מבצע נוסף' },
  promotion_edited: { en: 'Promotion updated', he: 'מבצע עודכן' },
  promotion_activated: { en: 'Promotion updated', he: 'מבצע עודכן' },
  promotion_deleted: { en: 'Promotion removed', he: 'מבצע הוסר' },
  // Experience edits logged English summaries ("Experience updated: diner-negroni"),
  // which rendered verbatim on the Hebrew Home + Results timelines.
  experience_updated: { en: 'Experience updated', he: 'החוויה עודכנה' },
  experience_edited: { en: 'Experience updated', he: 'החוויה עודכנה' },
};

/** Remove English wrappers baked into summaries logged before the log went neutral. */
function stripLegacyWrapper(summary: string): string {
  return summary
    .replace(/^Promotion updated:\s*/i, '')
    .replace(/^Promotion:\s*/i, '')
    .replace(/^Promotion deleted$/i, '')
    .replace(/^Experience updated:\s*/i, '')
    // legacy "(−5%)" → "· −5%" so it reads like the current neutral format
    .replace(/\s*\(−?(\d+[%₪])\)\s*$/, ' · −$1')
    .trim();
}

export function describeChange(
  c: Pick<ChangeRecord, 'changeType' | 'summary'>,
  isHe: boolean,
): ChangeDisplay {
  const known = ACTION_LABELS[c.changeType];
  const raw = c.summary ?? '';
  if (known) {
    const stripped = stripLegacyWrapper(raw);
    // A bare slug is a developer identifier, not a menu item name — show the
    // drink's own bilingual title when the detail is just its slug.
    const item = findCocktailBySlug(stripped);
    return {
      label: isHe ? known.he : known.en,
      detail: item ? item.title[isHe ? 'he' : 'en'] : stripped,
    };
  }
  // action_* (already a localized title), manual (owner free text), external, …
  return { label: '', detail: raw || c.changeType };
}

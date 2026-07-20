import type { DietaryFlags } from '@/data/cocktail';

/**
 * Menu sites render dietary icons with alt-text, which flattens into the item
 * name when the page is scraped: "סלט המאירי מנה צמחונית מנה ללא גלוטן".
 *
 * Only FULL badge phrases are listed here, never the bare adjective. A real menu
 * has both "המבורגר צמחוני" and "המבורגר טבעוני" as separate dishes — stripping a
 * lone "צמחוני" would collapse them into one indistinguishable "המבורגר".
 *
 * `vegan` is deliberately absent from the vegetarian badges: "מנה צמחונית" means
 * vegetarian, and the model has no vegetarian flag. Promoting it to vegan would
 * tell a vegan guest something the restaurant never claimed.
 */
const BADGES: ReadonlyArray<{ pattern: RegExp; flag?: keyof DietaryFlags }> = [
  { pattern: /מנה\s+ללא\s+גלוטן/g, flag: 'glutenFree' },
  { pattern: /מנה\s+טבעונית/g, flag: 'vegan' },
  { pattern: /מנה\s+צמחונית/g },
  { pattern: /gluten[-\s]free\s+dish/gi, flag: 'glutenFree' },
  { pattern: /vegan\s+dish/gi, flag: 'vegan' },
  { pattern: /vegetarian\s+dish/gi },
];

export interface BadgeExtraction {
  /** The name with badge alt-text removed. Never empty — falls back to the input. */
  name: string;
  /** Only the flags the menu actually asserted. Absent ⇒ not claimed, not false-by-default. */
  flags: Partial<DietaryFlags>;
}

/**
 * Split scraped dietary badge alt-text off an item name and return it as flags.
 * A name made up entirely of badges is left alone — that means the guess is wrong.
 */
export function extractDietaryBadges(rawName: string): BadgeExtraction {
  const flags: Partial<DietaryFlags> = {};
  let name = rawName;

  for (const { pattern, flag } of BADGES) {
    // `g` regexes are stateful across .test/.replace; rebuild per use.
    const re = new RegExp(pattern.source, pattern.flags);
    if (!re.test(name)) continue;
    if (flag) flags[flag] = true;
    name = name.replace(new RegExp(pattern.source, pattern.flags), ' ');
  }

  const cleaned = name.replace(/\s+/g, ' ').trim();
  return { name: cleaned || rawName.trim(), flags };
}

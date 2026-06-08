import type { Localized } from './cocktail';

/**
 * Short, evocative per-cocktail stories — the "emotion" layer. Rendered on the
 * cocktail page when present (and when the `story` experience module is on).
 */
export const COCKTAIL_STORIES: Record<string, Localized> = {
  'diner-aperol-spritz': {
    en: 'Born on the terraces of the Veneto, where golden hour lingers and no one is in a hurry.',
    he: 'נולד על מרפסות הוונטו, היכן ששעת הזהב מתמהמהת ואיש אינו ממהר.',
  },
  'diner-negroni': {
    en: "Count Camillo's bold request in 1919 Florence — gin where soda once stood. A drink with a spine.",
    he: 'בקשתו הנועזת של הרוזן קמילו בפירנצה 1919 — ג׳ין במקום סודה. משקה עם עמוד שדרה.',
  },
  'diner-pinky': {
    en: 'A blush of berries and a wink — playful and romantic, made for first dates and second glances.',
    he: 'סומק של פירות יער וקריצה — שובב ורומנטי, נברא לדייטים ראשונים ולמבטים שניים.',
  },
  'diner-margarita': {
    en: 'Salt, lime, and the warmth of agave — a taste of the coast wherever you are.',
    he: 'מלח, ליים וחום האגבה — טעם של חוף בכל מקום שתהיו.',
  },
  'diner-green-garden': {
    en: 'Cucumber, basil, and morning dew — the garden, bottled at its freshest.',
    he: 'מלפפון, בזיליקום וטל בוקר — הגן, בקבוק ברגע הרענן ביותר.',
  },
  'diner-whiskey-sour': {
    en: 'Bourbon meets citrus in a velvet shake — old-school swagger, smoothed by time.',
    he: 'בורבון פוגש הדרים בניעור קטיפתי — יוקרה של פעם, מעודנת בזמן.',
  },
  'garden-spritz': {
    en: 'Elderflower and bubbles over ice — an afternoon that refuses to end.',
    he: 'פרחי סמבוק ובועות על קרח — אחר צהריים שמסרב להסתיים.',
  },
  'citrus-lime-sour': {
    en: 'Pure citrus brightness — sharp, clean, and impossibly refreshing.',
    he: 'בהירות הדרים טהורה — חדה, נקייה ומרעננת עד בלתי אפשרי.',
  },
  'smoked-old-fashioned': {
    en: 'Bourbon, bitters, and a curl of smoke — a ritual in a glass.',
    he: 'בורבון, ביטרס וקורט עשן — טקס בכוס.',
  },
};

export function getStory(slug: string): Localized | null {
  return COCKTAIL_STORIES[slug] ?? null;
}

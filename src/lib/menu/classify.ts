export type ItemKind = 'drink' | 'food';

const DRINK_RE =
  /קוקטייל|בירה|בירות|יין|יינות|שתי[יה]|משק[הא]|לימונד|קפה|תה\b|סודה|מיץ|אלכוהול|ליקר|וו?יסקי|וודקה|ג['׳]ין|רום|טקילה|cocktail|beer|wine|spirit|drink|juice|soda|coffee|tea|lemonade|mocktail|spritz|sour|negroni|margarita|whisk|gin|vodka|rum|tequila|aperol|campari|tonic|highball/i;

const FOOD_RE =
  /המבורגר|פסטה|סלט|סטייק|פיצה|כריך|צ['׳]יפס|שניצל|קינוח|עוג[הת]|מרק|ראשונ|עיקרי|תוספת|ילדים|טוסט|לחם|מנ[הות]|פוקאצ|חביתה|נקניק|דג|עוף|בשר|אורז|burger|pasta|salad|steak|pizza|sandwich|fries|schnitzel|dessert|cake|soup|starter|main|side|kids|toast|bread|dish|chicken|fish|meat|rice|breakfast/i;

/**
 * Best-effort classify a menu item as a drink or food, from its name and (more
 * reliably) the menu section it came from. Food wins when both match. Used at
 * IMPORT time where the section name (e.g. "המבורגרים", "קינוחים", "בירות") is a
 * strong signal. Imported items default to food — most menus are food.
 *
 * NOTE: the editor does NOT auto-infer; it trusts the stored `kind` (drink for
 * code-defined cocktails, set explicitly here for imports) and lets the owner
 * flip it. So this default never mislabels the existing cocktail menu.
 */
export function inferKind(name: string, category?: string | null): ItemKind {
  const hay = `${category ?? ''} ${name}`;
  if (FOOD_RE.test(hay)) return 'food';
  if (DRINK_RE.test(hay)) return 'drink';
  return 'food';
}

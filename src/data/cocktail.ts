import type { MenuCategory } from '@/lib/segments';

export type Lang = 'en' | 'he';

export type Localized = Readonly<Record<Lang, string>>;

export type Category = 'citrus' | 'smoky' | 'bitter' | 'sweet' | 'mocktail';

export type Currency = 'ILS' | 'USD' | 'EUR';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  ILS: '₪',
  USD: '$',
  EUR: '€',
};

// Static FX rates relative to ILS as of 2026-05; replace with live API when backend exists
export const FX_FROM_ILS: Record<Currency, number> = {
  ILS: 1,
  USD: 0.27,
  EUR: 0.25,
};

export function formatPrice(priceInILS: number | undefined, currency: Currency): string {
  if (priceInILS === undefined || priceInILS === null) return '';
  const converted = priceInILS * FX_FROM_ILS[currency];
  if (currency === 'ILS') return `${Math.round(converted)} ${CURRENCY_SYMBOL[currency]}`;
  return `${CURRENCY_SYMBOL[currency]}${converted.toFixed(2)}`;
}

export interface FlavorProfile {
  sweet: number;
  bitter: number;
  citrus: number;
  smoky: number;
  herbal: number;
}

export interface LayerConfig {
  id: string;
  image: string;
  y: number;
  z: number;
  scale: number;
  floatAmp: number;
  floatSpeed: number;
  parallaxFactor: number;
  generationPrompt: string;
}

export interface IngredientLabel {
  id: string;
  number: string;
  name: Localized;
  description: Localized;
  origin?: Localized;
  layerId: string;
  /** Optional explicit image (food components use this; drinks resolve via layerId). */
  image?: string;
}

export interface DietaryFlags {
  vegan: boolean;
  glutenFree: boolean;
  alcoholFree: boolean;
}

export interface CocktailConfig {
  slug: string;
  title: Localized;
  subtitle: Localized;
  tagline?: Localized;
  category: Category;
  /** 'drink' (cocktail) or 'food'. Drives which editor/menu fields apply. Absent ⇒ 'drink'. */
  kind?: 'drink' | 'food';
  /** For food: the menu section / course it belongs to (e.g. "Mains", "Desserts"). */
  course?: string;
  /** Business menu category (cocktail/burger/dessert…) for segmented analytics. Derived if absent. */
  menuCategory?: MenuCategory;
  heroImage: string;
  heroPrompt?: string;
  flavor: FlavorProfile;
  bartenderNote: Localized;
  bartenderName?: string;
  dietary: DietaryFlags;
  pairings?: Localized[];
  priceILS?: number;
  /** Pour cost (ingredients) in ILS — drives margin / menu-engineering. */
  costILS?: number;
  availableHours?: [number, number];
  layers: LayerConfig[];
  labels: IngredientLabel[];
}

const STYLE_SUFFIX =
  'cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k';

export const SHARED_LAYERS: LayerConfig[] = [
  {
    id: 'glass',
    image: '/cocktail/glass.png',
    y: -1.4,
    z: 0,
    scale: 0.5,
    floatAmp: 0.015,
    floatSpeed: 0.4,
    parallaxFactor: 0.2,
    generationPrompt: `Studio product photograph of a brand new tall straight-sided cylindrical Collins tumbler glass, completely straight vertical walls running from the rim straight down to a thick flat heavy base resting flat on its bottom, the simple shape of a tall water glass, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
  },
  {
    id: 'splash_clear',
    image: '/cocktail/splash_clear.png',
    y: -0.467,
    z: 0.1,
    scale: 0.5,
    floatAmp: 0.04,
    floatSpeed: 0.7,
    parallaxFactor: 0.5,
    generationPrompt: `An isolated crown-shaped liquid splash of warm amber golden colored liquid suspended high in mid-air, a free-floating coronet of liquid with droplets flying outward and nothing else in the frame, pure black empty void, ${STYLE_SUFFIX}`,
  },
  {
    id: 'splash_soda',
    image: '/cocktail/splash_clear.png',
    y: -0.933,
    z: 0.15,
    scale: 0.5,
    floatAmp: 0.04,
    floatSpeed: 0.65,
    parallaxFactor: 0.4,
    generationPrompt: `An isolated crown-shaped liquid splash of crystal-clear colorless liquid suspended high in mid-air, a free-floating coronet of liquid with droplets flying outward and nothing else in the frame, pure black empty void, ${STYLE_SUFFIX}`,
  },

  {
    id: 'splash_pink',
    image: '/cocktail/splash_pink.png',
    y: 0,
    z: 0.2,
    scale: 0.5,
    floatAmp: 0.05,
    floatSpeed: 0.8,
    parallaxFactor: 0.6,
    generationPrompt: `An isolated crown-shaped liquid splash of pink grapefruit colored liquid suspended in mid-air, with droplets flying outward, just an isolated burst of liquid alone in empty space, nothing else around it, pure black void background, ${STYLE_SUFFIX}`,
  },
  {
    id: 'ice',
    image: '/cocktail/ice.png',
    y: 0.467,
    z: 0.3,
    scale: 0.35,
    floatAmp: 0.06,
    floatSpeed: 0.6,
    parallaxFactor: 0.7,
    generationPrompt: `A cluster of clear crushed ice cubes floating in mid-air against pure black void, sparkling and glistening, with small water droplets around them, no surface, no shadow, ${STYLE_SUFFIX}`,
  },
  {
    id: 'lime_wedges',
    image: '/cocktail/lime.png',
    y: 0.933,
    z: 0.4,
    scale: 0.35,
    floatAmp: 0.07,
    floatSpeed: 0.5,
    parallaxFactor: 0.8,
    generationPrompt: `Four fresh bright green lime wedges floating in mid-air against pure black void with juice droplets splashing around them, vibrant green color, no surface, no shadow, ${STYLE_SUFFIX}`,
  },
  {
    id: 'lime_peel',
    image: '/cocktail/peel.png',
    y: 1.4,
    z: 0.5,
    scale: 0.28,
    floatAmp: 0.08,
    floatSpeed: 0.4,
    parallaxFactor: 1.0,
    generationPrompt: `A single long spiraling lime peel twist suspended in mid-air, bright green outer skin, curled into an elegant ribbon shape, pure black void, no surface, no shadow, ${STYLE_SUFFIX}`,
  },
];

export interface LayerOverride {
  prompt?: string;
  hide?: boolean;
}

export function makeCustomLayers(
  slug: string,
  overrides: Partial<Record<string, LayerOverride>> = {}
): LayerConfig[] {
  return SHARED_LAYERS
    .filter((l) => !overrides[l.id]?.hide)
    .map((l) => ({
      ...l,
      image: `/cocktail/drafts/${slug}-${l.id}.png`,
      generationPrompt: overrides[l.id]?.prompt ?? l.generationPrompt,
    }));
}


const GREEN_GARDEN_LABELS: IngredientLabel[] = [
  {
    id: 'basil',
    number: '01',
    name: { en: 'Fresh Basil', he: 'בזיליקום טרי' },
    description: { en: 'Slapped gently before serving — the herbal perfume wakes with every sip.', he: 'טפיחה עדינה לפני ההגשה — הניחוח העשבוני מתעורר בכל לגימה.' },
    origin: { en: 'Rooftop garden', he: 'מגן הגג' },
    layerId: 'lime_peel',
  },
  {
    id: 'cucumber_ribbon',
    number: '02',
    name: { en: 'Cucumber Ribbon', he: 'רצועת מלפפון' },
    description: { en: 'Shaved long and thin — cool green freshness in every sip.', he: 'מגולפת דק לאורך — רעננות ירוקה וקרירה בכל לגימה.' },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Crushed Ice', he: 'קרח כתוש' },
    description: { en: 'Crushed just before the pour — a soft chill that lasts the whole glass.', he: 'נכתש רגע לפני המזיגה — צינה רכה שנשארת לאורך כל הכוס.' },
    layerId: 'ice',
  },
  {
    id: 'elderflower',
    number: '04',
    name: { en: 'Elderflower Cordial', he: 'סירופ סמבוק' },
    description: { en: 'Gently sweet and floral — the perfume that holds the drink together.', he: 'מתיקות פרחונית עדינה — הניחוח שמחזיק את כל המשקה.' },
    origin: { en: "St-Germain", he: 'St-Germain' },
    layerId: 'splash_pink',
  },
  {
    id: 'lime_juice',
    number: '05',
    name: { en: 'Lime Juice', he: 'מיץ ליים' },
    description: { en: 'A flash of bright acidity — keeps the green notes alive.', he: 'הבזק של חמיצות בהירה — שומר על הירוק חי וערני.' },
    layerId: 'splash_clear',
  },
  {
    id: 'sparkling',
    number: '06',
    name: { en: 'Sparkling Water', he: 'מים מוגזים' },
    description: { en: 'Not a drop of spirit — just bubbles, balance and a breath of the garden.', he: 'בלי טיפת אלכוהול — רק בועות, איזון וניחוח של גינה.' },
    layerId: 'glass',
  },
];

const SMOKED_OLD_FASHIONED_LABELS: IngredientLabel[] = [
  {
    id: 'orange_peel',
    number: '01',
    name: { en: 'Orange Peel', he: 'קליפת תפוז' },
    description: { en: 'Passed through the smoke before serving — the citrus oils pick up a toasted edge.', he: 'עוברת בעשן רגע לפני ההגשה — שמני ההדר מקבלים קצה קלוי.' },
    layerId: 'lime_peel',
  },
  {
    id: 'cherry',
    number: '02',
    name: { en: 'Brandied Cherry', he: 'דובדבן בברנדי' },
    description: { en: 'A Luxardo soaked in-house — a sweet ruby reward waiting at the bottom of the glass.', he: 'לוקסארדו בהשרייה אצלנו — פרס מתוק ורובי שמחכה בתחתית הכוס.' },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Clear Ice Sphere', he: 'כדור קרח שקוף' },
    description: { en: 'Melts slow and patient — keeps the drink cold and strong to the last sip.', he: 'נמס לאט ובסבלנות — שומר על המשקה קר וחזק עד הלגימה האחרונה.' },
    layerId: 'ice',
  },
  {
    id: 'bitters',
    number: '04',
    name: { en: 'Angostura Bitters', he: 'ביטרס אנגוסטורה' },
    description: { en: 'Just a few dashes — spice that threads through every sip.', he: 'כמה טיפות בלבד — תיבול שנשזר בכל לגימה.' },
    origin: { en: 'House of Angostura, Trinidad', he: 'House of Angostura, טרינידד' },
    layerId: 'splash_pink',
  },
  {
    id: 'demerara',
    number: '05',
    name: { en: 'Demerara Syrup', he: 'סירופ דמררה' },
    description: { en: 'Raw cane sugar — caramel sweetness that answers the oak.', he: 'סוכר קנים גולמי — מתיקות של קרמל שמתחברת לאלון המעושן.' },
    layerId: 'splash_clear',
  },
  {
    id: 'bourbon',
    number: '06',
    name: { en: 'Smoked Bourbon', he: 'בורבון מעושן' },
    description: { en: 'Smoked over oak chips right at the bar — caramel, vanilla and warm wood.', he: 'מעושן על שבבי אלון אצלנו בבר — קרמל, וניל וחמימות של עץ.' },
    origin: { en: 'Buffalo Trace', he: 'Buffalo Trace' },
    layerId: 'glass',
  },
];

export const CITRUS_LIME_SOUR: CocktailConfig = {
  slug: 'citrus-lime-sour',
  title: { en: 'Citrus Lime Sour', he: 'סיטרוס ליים סאוור' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Gin · Pink grapefruit · Fresh lime · Crushed ice',
    he: 'ג׳ין · אשכולית ורודה · ליים טרי · קרח כתוש',
  },
  category: 'citrus',
  heroImage: '/cocktail/citrus-lime-sour-hero.png',
  flavor: { sweet: 2, bitter: 1, citrus: 5, smoky: 0, herbal: 2 },
  bartenderNote: {
    en: 'Bright and easy — the one I reach for on a warm evening.',
    he: 'בהיר וקליל — זה שאני לוקח בערב חם.',
  },
  bartenderName: 'Daniel Cohen',
  dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  pairings: [
    { en: 'Oysters', he: 'אויסטרים' },
    { en: 'Ceviche', he: 'סביצ׳ה' },
    { en: 'Salted snacks', he: 'נשנושים מלוחים' },
  ],
  priceILS: 58,
  availableHours: [12, 24],
  layers: SHARED_LAYERS,
  labels: [
    {
      id: 'lime_peel',
      number: '01',
      name: { en: 'Lime Peel', he: 'קליפת ליים' },
      description: {
        en: 'Expressed over the glass — sharp citrus oils open the drink.',
        he: 'נסחטת מעל הכוס — שמני ההדר החדים פותחים את המשקה.',
      },
      origin: { en: 'Persian lime, hand-zested', he: 'ליים פרסי, מסולסל ידנית' },
      layerId: 'lime_peel',
    },
    {
      id: 'fresh_lime',
      number: '02',
      name: { en: 'Fresh Lime', he: 'ליים טרי' },
      description: {
        en: 'Squeezed à la minute — the acid spine of the drink.',
        he: 'נסחט במקום — עמוד השדרה החמוץ של המשקה.',
      },
      origin: { en: 'Pressed à la minute', he: 'נסחט במקום, בכל הזמנה' },
      layerId: 'lime_wedges',
    },
    {
      id: 'crushed_ice',
      number: '03',
      name: { en: 'Crushed Ice', he: 'קרח כתוש' },
      description: {
        en: 'Crushed fine — a soft chill that spreads through the whole glass.',
        he: 'נכתש דק — צינה רכה שמתפזרת בכל הכוס.',
      },
      origin: { en: 'House-crushed mineral ice', he: 'ממים מינרליים, נכתש אצלנו' },
      layerId: 'ice',
    },
    {
      id: 'citrus_fruit',
      number: '04',
      name: { en: 'Citrus / Fruit', he: 'הדרים / פרי' },
      description: {
        en: 'Pink grapefruit — bittersweet body and a soft blush in the glass.',
        he: 'אשכולית ורודה — גוף מר-מתוק וסומק עדין בכוס.',
      },
      origin: { en: 'Pamplemousse Rose, Combier', he: 'Pamplemousse Rose, Combier' },
      layerId: 'splash_pink',
    },
    {
      id: 'simple_syrup',
      number: '05',
      name: { en: 'Simple Syrup', he: 'סירופ סוכר' },
      description: {
        en: 'Just enough sweetness to balance the lime — and not a drop more.',
        he: 'בדיוק מספיק מתיקות כדי לאזן את הליים — ולא טיפה יותר.',
      },
      origin: { en: 'House-made, 1:1', he: 'תוצרת בית, 1:1' },
      layerId: 'splash_clear',
    },
    {
      id: 'gin',
      number: '06',
      name: { en: 'Gin', he: 'ג׳ין' },
      description: {
        en: 'Classic London Dry — juniper out front, a clean botanical base.',
        he: 'לונדון דריי קלאסי — ערער מוביל ובסיס צמחי נקי.',
      },
      origin: { en: 'Tanqueray London Dry', he: 'Tanqueray London Dry' },
      layerId: 'glass',
    },
  ],
};

export const SMOKED_OLD_FASHIONED: CocktailConfig = {
  slug: 'smoked-old-fashioned',
  title: { en: 'Smoked Old Fashioned', he: 'אולד פאשנד מעושן' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Bourbon · Demerara · Smoked oak · Orange peel',
    he: 'בורבון · דמררה · אלון מעושן · קליפת תפוז',
  },
  category: 'smoky',
  heroImage: '/cocktail/smoked-old-fashioned-hero.png',
  heroPrompt: `A heavy crystal-cut rocks glass filled with deep amber smoked old fashioned, a single large clear ice sphere inside, thin orange peel twist garnish, wisp of smoke rising from the rim, sitting against pure black void with subtle warm rim lighting, ${STYLE_SUFFIX}`,
  flavor: { sweet: 2, bitter: 3, citrus: 1, smoky: 5, herbal: 2 },
  bartenderNote: {
    en: 'Aged oak meets caramelized sugar — a slow drink for slow conversations.',
    he: 'אלון מיושן פוגש סוכר מקורמל — משקה איטי לשיחה איטית.',
  },
  bartenderName: 'Daniel Cohen',
  dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  pairings: [
    { en: 'Aged cheese', he: 'גבינות מיושנות' },
    { en: 'Dark chocolate', he: 'שוקולד מריר' },
    { en: 'Ribeye steak', he: 'אנטריקוט' },
  ],
  priceILS: 68,
  availableHours: [17, 24],
  layers: makeCustomLayers('smoked-old-fashioned', {
    lime_peel: {
      prompt: `A wispy curl of orange citrus peel ribbon with a delicate trail of smoke rising from it, deep amber-orange color, spiral shape suspended in mid-air, pitch black void, dramatic side light, no lime, no green, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    lime_wedges: {
      prompt: `A single brandied Luxardo maraschino cherry with its stem, glossy deep ruby red preserved cherry, suspended in mid-air, pitch black void, no green, no lime, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_pink: {
      prompt: `Angostura aromatic bitters liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, deep mahogany dark amber-red color, small droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_clear: {
      prompt: `Demerara raw cane sugar syrup liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, rich caramel-amber translucent liquid, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_soda: { hide: true },
    glass: {
      prompt: `Studio product photograph of a brand new short straight-sided heavy tumbler glass with a thick faceted diamond-cut crystal base, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: SMOKED_OLD_FASHIONED_LABELS,
};

export const GARDEN_SPRITZ: CocktailConfig = {
  slug: 'garden-spritz',
  title: { en: 'Garden Spritz', he: 'ספריץ גן' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Cucumber · Basil · Elderflower · Sparkling water',
    he: 'מלפפון · בזיליקום · פרחי סמבוק · מים מוגזים',
  },
  category: 'mocktail',
  heroImage: '/cocktail/garden-spritz-hero.png',
  heroPrompt: `A tall stemless wine glass filled with pale cucumber-green sparkling mocktail, fresh basil leaves floating on top, thin cucumber ribbon garnish, condensation on the glass, against pure black void with cool soft lighting, ${STYLE_SUFFIX}`,
  flavor: { sweet: 1, bitter: 1, citrus: 2, smoky: 0, herbal: 5 },
  bartenderNote: {
    en: 'All the ritual of a cocktail, none of the spirit — herbs from our own rooftop garden.',
    he: 'כל הטקס של קוקטייל, בלי האלכוהול — עשבים מגן הגג שלנו.',
  },
  bartenderName: 'Daniel Cohen',
  dietary: { vegan: true, glutenFree: true, alcoholFree: true },
  pairings: [
    { en: 'Burrata', he: 'בורטה' },
    { en: 'Garden salad', he: 'סלט קיץ' },
    { en: 'Grilled fish', he: 'דג צרוב' },
  ],
  priceILS: 42,
  availableHours: [8, 24],
  layers: SHARED_LAYERS,
  labels: GREEN_GARDEN_LABELS,
};

// ---------------------------------------------------------------------------
// Diner restaurant — imported via scripts/import-restaurant.ts on 2026-05-27
// All 6 cocktails from https://www.dinerrest.co.il/menus
// ---------------------------------------------------------------------------

const APEROL_SPRITZ_LABELS: IngredientLabel[] = [
  {
    id: 'orange_peel',
    number: '01',
    name: { en: 'Orange Peel', he: 'קליפת תפוז' },
    description: {
      en: 'Hand-cut and expressed over the glass — the citrus oils wake the drink up.',
      he: 'נחתכת ביד ונסחטת מעל הכוס — שמני ההדר מעירים את המשקה.',
    },
    origin: { en: 'Hand-zested', he: 'מסולסל ידנית' },
    layerId: 'lime_peel',
  },
  {
    id: 'orange_slice',
    number: '02',
    name: { en: 'Orange Slice', he: 'פלח תפוז' },
    description: {
      en: 'Cut fresh every morning — bright aroma, golden garnish.',
      he: 'נחתך טרי כל בוקר — ארומה בוהקת וקישוט זהוב.',
    },
    origin: { en: 'Fresh, pressed daily', he: 'טרי, נחתך כל יום' },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Ice Cubes', he: 'קוביות קרח' },
    description: {
      en: 'Keeps it cool, lengthens the drink and sharpens the bubbles.',
      he: 'שומר על קור, מאריך את המשקה ומחדד את הבועות.',
    },
    origin: { en: 'House-cut, mineral water', he: 'קוביות מים מינרליים' },
    layerId: 'ice',
  },
  {
    id: 'aperol',
    number: '04',
    name: { en: 'Aperol', he: 'אפרול' },
    description: {
      en: 'The bittersweet heart — bitter orange, herbs and gentian.',
      he: 'הלב המר-מתוק של המשקה — תפוז מר, עשבי תיבול וגנציאנה.',
    },
    origin: { en: 'Aperol, Padua, Italy', he: 'Aperol, פדובה, איטליה' },
    layerId: 'splash_pink',
  },
  {
    id: 'prosecco',
    number: '05',
    name: { en: 'Prosecco', he: 'פרוסקו' },
    description: {
      en: 'Italian sparkling wine — brings bubbles, lightness and elegance.',
      he: 'יין מבעבע איטלקי — מוסיף בועות, קלילות ואלגנטיות.',
    },
    origin: { en: 'Veneto DOC', he: 'ונטו DOC' },
    layerId: 'splash_clear',
  },
  {
    id: 'soda_water',
    number: '06',
    name: { en: 'Soda Water', he: 'מי סודה' },
    description: {
      en: 'A gentle splash of fizz — balances the sweetness, opens the aromas.',
      he: 'נגיעת בועות עדינה — מאזנת את המתיקות ופותחת את הארומות.',
    },
    layerId: 'splash_soda',
  },
  {
    id: 'aperol_spritz',
    number: '07',
    name: { en: 'Aperol Spritz', he: 'אפרול שפריץ' },
    description: {
      en: 'The perfect balance of bitter, sweet, bubbly and refreshing.',
      he: 'איזון מושלם בין מר, מתוק, מבעבע ומרענן.',
    },
    layerId: 'glass',
  },
];

const NEGRONI_LABELS: IngredientLabel[] = [
  {
    id: 'orange_peel',
    number: '01',
    name: { en: 'Orange Peel', he: 'קליפת תפוז' },
    description: {
      en: 'Expressed over the rim — citrus oil wakes the bitter base.',
      he: 'נסחטת מעל שפת הכוס — שמן ההדר מעיר את הבסיס המר.',
    },
    origin: { en: 'Hand-zested', he: 'מסולסל ידנית' },
    layerId: 'lime_peel',
  },
  {
    id: 'orange_slice',
    number: '02',
    name: { en: 'Orange Wheel', he: 'פלח תפוז' },
    description: {
      en: 'Floats alongside the ice — sweet fragrance and a flash of colour.',
      he: 'צף לצד הקרח — ניחוח מתוק והבזק של צבע.',
    },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Ice Sphere', he: 'כדור קרח' },
    description: {
      en: 'Melts slow — keeps the drink cold without ever watering it down.',
      he: 'נמס לאט-לאט — שומר על המשקה קר בלי לדלל אותו.',
    },
    layerId: 'ice',
  },
  {
    id: 'sweet_vermouth',
    number: '04',
    name: { en: 'Sweet Vermouth', he: 'ורמוט מתוק' },
    description: {
      en: 'The soft side of the trio — herbs, gentle sweetness, deep colour.',
      he: 'הצד הרך של המשולש — עשבי תיבול, מתיקות עדינה וצבע עמוק.',
    },
    origin: { en: 'Carpano Antica Formula', he: 'Carpano Antica Formula' },
    layerId: 'splash_pink',
  },
  {
    id: 'campari',
    number: '05',
    name: { en: 'Campari', he: 'קמפרי' },
    description: {
      en: 'The bitter heart — herbs, citrus peel, ruby red.',
      he: 'הלב המר — עשבים, קליפות הדרים, אדום רובי.',
    },
    origin: { en: 'Davide Campari, Milan', he: 'Davide Campari, מילאנו' },
    layerId: 'splash_clear',
  },
  {
    id: 'gin',
    number: '06',
    name: { en: 'Gin', he: 'ג׳ין' },
    description: {
      en: 'The botanical backbone — juniper-led London Dry.',
      he: 'עמוד השדרה הצמחי — לונדון דריי על בסיס ערער.',
    },
    origin: { en: 'Tanqueray London Dry', he: 'Tanqueray London Dry' },
    layerId: 'glass',
  },
];

const PINKY_LABELS: IngredientLabel[] = [
  {
    id: 'lime_peel',
    number: '01',
    name: { en: 'Lime Peel', he: 'קליפת ליים' },
    description: { en: 'Twisted fresh over the top — sharp citrus oils across the surface.', he: 'מסולסלת טרייה מעל הכוס — שמני הדר חדים על פני המשקה.' },
    layerId: 'lime_peel',
  },
  {
    id: 'raspberries',
    number: '02',
    name: { en: 'Fresh Raspberries', he: 'פטל טרי' },
    description: { en: 'Lightly crushed — the pink deepens and the fruit wakes up.', he: 'נמעכים קלות — הוורוד מעמיק והפרי מתעורר.' },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Crushed Ice', he: 'קרח כתוש' },
    description: { en: 'Crushed fine — chills in seconds without watering anything down.', he: 'נכתש דק — מצנן בשניות בלי לדלל את המשקה.' },
    layerId: 'ice',
  },
  {
    id: 'raspberry_liqueur',
    number: '04',
    name: { en: 'Raspberry Liqueur', he: 'ליקר פטל' },
    description: { en: 'Just a drizzle — berry sweetness that gives body and blush.', he: 'רק מזיגה קטנה — מתיקות פירותית שנותנת גוף וסומק.' },
    origin: { en: 'Chambord', he: 'Chambord' },
    layerId: 'splash_pink',
  },
  {
    id: 'tonic',
    number: '05',
    name: { en: 'Tonic Water', he: 'מי טוניק' },
    description: { en: 'A crisp quinine edge — keeps the glass light and lively.', he: 'מרירות קינין עדינה — שומרת על הכוס קלילה ותוססת.' },
    layerId: 'splash_clear',
  },
  {
    id: 'pink_gin',
    number: '06',
    name: { en: 'Pink Gin', he: 'ג׳ין ורוד' },
    description: { en: 'London Dry infused with strawberries — soft, botanical, blushing.', he: 'לונדון דריי בהשריית תות — רך, צמחי ומסמיק.' },
    origin: { en: 'Beefeater Pink', he: 'Beefeater Pink' },
    layerId: 'glass',
  },
];

const MARGARITA_LABELS: IngredientLabel[] = [
  {
    id: 'salt_rim',
    number: '01',
    name: { en: 'Salt Rim', he: 'שפת מלח' },
    description: { en: 'Coarse sea salt — sharpens the lime and frames every sip.', he: 'מלח ים גס — מחדד את הליים ופותח כל לגימה.' },
    layerId: 'lime_peel',
  },
  {
    id: 'lime_wedge',
    number: '02',
    name: { en: 'Lime Wedge', he: 'פלח ליים' },
    description: { en: 'Perched on the rim — one last squeeze whenever you want it.', he: 'יושב על שפת הכוס — סחיטה אחרונה מתי שרק מתחשק.' },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Ice', he: 'קרח' },
    description: { en: 'Shaken hard — chills the spirit, refines the texture.', he: 'מנוער חזק — מצנן את המשקה ומעדן את המרקם.' },
    layerId: 'ice',
  },
  {
    id: 'lime_juice',
    number: '04',
    name: { en: 'Fresh Lime Juice', he: 'מיץ ליים טרי' },
    description: { en: 'Pressed à la minute — the acid spine of the drink.', he: 'נסחט ברגע ההזמנה — עמוד השדרה החמוץ של המשקה.' },
    layerId: 'splash_pink',
  },
  {
    id: 'triple_sec',
    number: '05',
    name: { en: 'Triple Sec', he: 'טריפל סק' },
    description: { en: 'A sweep of orange sweetness — softens the lime’s sharp edge.', he: 'מתיקות של תפוז — מרככת את החדות של הליים.' },
    origin: { en: 'Cointreau', he: 'Cointreau' },
    layerId: 'splash_clear',
  },
  {
    id: 'tequila',
    number: '06',
    name: { en: 'Tequila Blanco', he: 'טקילה בלאנקו' },
    description: { en: 'The agave heart — clean, peppery, with a whisper of smoke.', he: 'לב האגבה — נקי, פלפלי, עם נגיעה מעושנת.' },
    origin: { en: '100% Blue Weber agave', he: '100% אגבה כחולה' },
    layerId: 'glass',
  },
];


const WHISKEY_SOUR_LABELS: IngredientLabel[] = [
  {
    id: 'cherry',
    number: '01',
    name: { en: 'Maraschino Cherry', he: 'דובדבן מרשינו' },
    description: { en: 'Rests on the foam — sweet, ruby, saved for last.', he: 'נח על הקצף — מתוק, רובי, ושומרים אותו לסוף.' },
    layerId: 'lime_peel',
  },
  {
    id: 'lemon_peel',
    number: '02',
    name: { en: 'Lemon Peel', he: 'קליפת לימון' },
    description: { en: 'Twisted over the foam — a flash of bright citrus oil.', he: 'נסחטת מעל הקצף — הבזק של שמן הדר בהיר.' },
    layerId: 'lime_wedges',
  },
  {
    id: 'ice',
    number: '03',
    name: { en: 'Ice', he: 'קרח' },
    description: { en: 'Shaken twice — first to chill, then to build the foam.', he: 'מנוער פעמיים — פעם לקור, פעם לקצף.' },
    layerId: 'ice',
  },
  {
    id: 'egg_white',
    number: '04',
    name: { en: 'Egg White', he: 'חלבון ביצה' },
    description: { en: 'Whipped into velvet — softens the lemon’s sharp edge.', he: 'מוקצף לקטיפה — מרכך את החדות של הלימון.' },
    layerId: 'splash_pink',
  },
  {
    id: 'lemon_juice',
    number: '05',
    name: { en: 'Fresh Lemon Juice', he: 'מיץ לימון טרי' },
    description: { en: 'Squeezed sharp and fresh — bright acidity against the syrup’s sweetness.', he: 'נסחט טרי — חמיצות חדה מול מתיקות הסירופ.' },
    layerId: 'splash_clear',
  },
  {
    id: 'bourbon',
    number: '06',
    name: { en: 'Bourbon Whiskey', he: 'בורבון' },
    description: { en: 'Caramel, oak, soft warmth — the backbone of the sour.', he: 'קרמל, אלון וחמימות רכה — עמוד השדרה של הסאוור.' },
    origin: { en: 'Maker’s Mark', he: 'Maker’s Mark' },
    layerId: 'glass',
  },
];

export const DINER_APEROL_SPRITZ: CocktailConfig = {
  slug: 'diner-aperol-spritz',
  priceILS: 54,
  title: { en: 'Aperol Spritz', he: 'אפרול שפריץ' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Aperol · Prosecco · Soda · Orange peel',
    he: 'אפרול · פרוסקו · סודה · קליפת תפוז',
  },
  category: 'citrus',
  heroImage: '/cocktail/diner-aperol-spritz-hero.png',
  heroPrompt: `A tall wine glass filled with bright orange Aperol Spritz over a single large ice cube, garnished with a fresh orange slice on the rim, condensation droplets on the glass, against pure black void with warm rim lighting, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, photorealistic, 8k`,
  flavor: { sweet: 3, bitter: 3, citrus: 4, smoky: 0, herbal: 2 },
  bartenderNote: {
    en: 'Built for slow evenings and warm light.',
    he: 'נבנה לערבים איטיים ולאור חם.',
  },
  bartenderName: 'Diner',
  dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  // 7-layer Aperol with per-slot prompts engineered to avoid Pollinations' green-lime bias
  layers: makeCustomLayers('diner-aperol-spritz', {
    lime_peel: {
      prompt: `Long curling ribbon of fresh orange citrus rind, freshly cut, vibrant sunset orange amber color, oils visible on surface, twisted into elegant spiral shape, suspended in mid-air, pitch black background, no lime, ${STYLE_SUFFIX}`,
    },
    lime_wedges: {
      prompt: `Three thin round wheels of fresh blood orange citrus fruit, deep amber-orange flesh segments visible, floating in mid-air against pitch black void, no lime, no green color, vivid sunset orange, ${STYLE_SUFFIX}`,
    },
    splash_pink: {
      prompt: `Aperol liquor liquid liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, vivid amber-orange color exactly like the Aperol bottle, perfect crown shape, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, ${STYLE_SUFFIX}`,
    },
    splash_clear: {
      prompt: `An isolated crown-shaped liquid splash of pale golden sparkling colored liquid suspended high in mid-air, a free-floating coronet of liquid with droplets flying outward and nothing else in the frame, pure black empty void, ${STYLE_SUFFIX}`,
    },
    splash_soda: {
      prompt: `An isolated crown-shaped liquid splash of crystal-clear colorless sparkling liquid suspended high in mid-air, a free-floating coronet of liquid with droplets flying outward and nothing else in the frame, pure black empty void, ${STYLE_SUFFIX}`,
    },
    glass: {
      prompt: `Studio product photograph of a brand new tall elegant stemmed wine goblet with a curved tulip-shaped bowl on a long slender stem and round foot, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: APEROL_SPRITZ_LABELS,
};

export const DINER_NEGRONI: CocktailConfig = {
  slug: 'diner-negroni',
  priceILS: 62,
  title: { en: 'Negroni', he: 'נגרוני' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Gin · Campari · Sweet vermouth · Orange peel',
    he: 'ג׳ין · קמפרי · ורמוט מתוק · קליפת תפוז',
  },
  category: 'bitter',
  heroImage: '/cocktail/diner-negroni-hero.png',
  heroPrompt: `A short crystal rocks glass filled with deep ruby red Negroni over one large clear ice sphere, garnished with a long thin orange peel twist, served against pure black void with warm low-key lighting from the side, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, photorealistic, 8k`,
  flavor: { sweet: 2, bitter: 5, citrus: 2, smoky: 0, herbal: 4 },
  bartenderNote: {
    en: 'Three parts equal, bitter and beautiful — the cocktail bartenders order for themselves.',
    he: 'שלושה חלקים שווים, מר ויפהפה — הקוקטייל שהבארטנדרים מזמינים לעצמם.',
  },
  bartenderName: 'Diner',
  dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  layers: makeCustomLayers('diner-negroni', {
    lime_peel: {
      prompt: `A long curling ribbon of fresh orange citrus rind, freshly cut, deep amber-orange color, twisted spiral, suspended in mid-air, pitch black void, no lime, no green, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    lime_wedges: {
      prompt: `Two thin round wheels of fresh orange citrus fruit, amber-orange flesh segments visible, floating in mid-air against pitch black void, no lime, no green, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_pink: {
      prompt: `Campari liquor liquid liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, vivid deep ruby red bitter liqueur color, perfect crown shape, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_clear: {
      prompt: `Sweet vermouth Carpano Antica liquid liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, rich amber-red color, perfect crown shape, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_soda: { hide: true },
    glass: {
      prompt: `Studio product photograph of a brand new short straight-sided heavy tumbler glass with a thick faceted diamond-cut crystal base, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: NEGRONI_LABELS,
};

export const DINER_PINKY: CocktailConfig = {
  slug: 'diner-pinky',
  priceILS: 56,
  title: { en: 'Pinky', he: 'פינקי' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Pink gin · Raspberry · Lime · Tonic',
    he: 'ג׳ין ורוד · פטל · ליים · טוניק',
  },
  category: 'sweet',
  heroImage: '/cocktail/diner-pinky-hero.png',
  heroPrompt: `A tall stemmed balloon wine glass with a long stem and round foot base, filled with vibrant pink raspberry gin cocktail over crushed ice, garnished with fresh raspberries and a lime wheel, the COMPLETE glass fully visible in frame from the rim all the way down to the stem and round foot base, entire glass centered with generous empty margin around all four edges so nothing is cropped, gentle bubbles rising, condensation on glass, against pure black void, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, photorealistic, 8k`,
  flavor: { sweet: 4, bitter: 1, citrus: 3, smoky: 0, herbal: 1 },
  bartenderNote: {
    en: 'Don’t let the color fool you — raspberry and pink gin have backbone.',
    he: 'אל תיתן לצבע להטעות — פטל וג׳ין ורוד יש להם עמוד שדרה.',
  },
  bartenderName: 'Diner',
  dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  layers: makeCustomLayers('diner-pinky', {
    lime_peel: {
      prompt: `A single fresh lime peel twist spiral, bright green outer skin curled into elegant ribbon, suspended in mid-air, pitch black void, no surface or shadow, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    lime_wedges: {
      prompt: `Three fresh ripe raspberries, vivid red berry fruit floating in mid-air against pitch black void, juicy droplets visible, no green, no lime fruit, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_pink: {
      prompt: `Raspberry liqueur Chambord liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, vivid pink magenta color, perfect crown shape, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_clear: {
      prompt: `An isolated crown-shaped liquid splash of crystal-clear colorless sparkling liquid suspended high in mid-air, a free-floating coronet of liquid with droplets flying outward and nothing else in the frame, pure black empty void, ${STYLE_SUFFIX}`,
    },
    splash_soda: { hide: true },
    glass: {
      prompt: `Studio product photograph of a brand new footed tulip goblet glass with a curved bowl narrowing slightly toward the top on a short stem and round foot, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: PINKY_LABELS,
};

export const DINER_MARGARITA: CocktailConfig = {
  slug: 'diner-margarita',
  priceILS: 58,
  title: { en: 'Margarita', he: 'מרגריטה' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Tequila · Triple sec · Fresh lime · Salt rim',
    he: 'טקילה · טריפל סק · ליים טרי · מלח',
  },
  category: 'citrus',
  heroImage: '/cocktail/diner-margarita-hero.png',
  heroPrompt: `A coupe glass with a perfect salt rim filled with pale yellow-green margarita, garnished with a fresh lime wheel on the rim, single ice cube inside, against pure black void with crisp side lighting, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, photorealistic, 8k`,
  flavor: { sweet: 2, bitter: 1, citrus: 5, smoky: 1, herbal: 1 },
  bartenderNote: {
    en: 'Salt, lime, agave — three ingredients, infinite variations, one classic.',
    he: 'מלח, ליים, אגבה — שלושה מרכיבים, אינסוף וריאציות, קלאסיקה אחת.',
  },
  bartenderName: 'Diner',
  dietary: { vegan: true, glutenFree: true, alcoholFree: false },
  layers: makeCustomLayers('diner-margarita', {
    lime_peel: { hide: true },
    lime_wedges: {
      prompt: `Three fresh round wheels of lime fruit, vivid bright green lime citrus slices showing inner flesh segments, floating in mid-air against pitch black void, juicy juice droplets visible, no surface or shadow, ${STYLE_SUFFIX}`,
    },
    splash_pink: {
      prompt: `Fresh lime juice liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, pale yellow-green liquid color, droplets flying outward, perfect crown shape, pitch black void, just an isolated burst of liquid alone in empty space, ${STYLE_SUFFIX}`,
    },
    splash_clear: {
      prompt: `Cointreau triple sec orange liqueur liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, light amber-clear color, perfect crown shape, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, ${STYLE_SUFFIX}`,
    },
    splash_soda: { hide: true },
    glass: {
      prompt: `Studio product photograph of a brand new tall straight-sided cylindrical Collins tumbler glass, completely straight vertical walls running from the rim straight down to a thick flat heavy base resting flat on its bottom, the simple shape of a tall water glass, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, a thin ring of coarse white salt crystals decorates only the outer top rim edge, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: MARGARITA_LABELS,
};

export const DINER_GREEN_GARDEN: CocktailConfig = {
  slug: 'diner-green-garden',
  priceILS: 52,
  title: { en: 'Green Garden', he: 'גרין גארדן' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Cucumber · Basil · Elderflower · Lime',
    he: 'מלפפון · בזיליקום · סמבוק · ליים',
  },
  category: 'mocktail',
  heroImage: '/cocktail/diner-green-garden-hero.png',
  heroPrompt: `A tall highball glass filled with crystal clear pale green cucumber-basil mocktail over crushed ice, fresh basil leaves and a cucumber ribbon as garnish, soft droplets on the glass, against pure black void with cool soft lighting, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, photorealistic, 8k`,
  flavor: { sweet: 1, bitter: 1, citrus: 3, smoky: 0, herbal: 5 },
  bartenderNote: {
    en: 'A handful of garden — no booze, no apology.',
    he: 'חופן מהגינה — בלי אלכוהול, בלי התנצלות.',
  },
  bartenderName: 'Diner',
  dietary: { vegan: true, glutenFree: true, alcoholFree: true },
  layers: makeCustomLayers('diner-green-garden', {
    lime_peel: {
      prompt: `A sprig of fresh green basil leaves, vibrant herbal aromatic plant, suspended in mid-air, droplets visible, pitch black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
    lime_wedges: {
      prompt: `A long thin ribbon of fresh cucumber, bright pale green vegetable slice curled elegantly, floating in mid-air against pitch black void, droplets, no surface or shadow, ${STYLE_SUFFIX}`,
    },
    splash_pink: {
      prompt: `Elderflower cordial St-Germain liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, pale floral yellow-clear color, perfect crown shape, droplets flying outward, pitch black void, just an isolated burst of liquid alone in empty space, ${STYLE_SUFFIX}`,
    },
    splash_clear: {
      prompt: `Fresh lime juice liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, pale green-yellow liquid color, droplets flying outward, perfect crown shape, pitch black void, just an isolated burst of liquid alone in empty space, ${STYLE_SUFFIX}`,
    },
    splash_soda: {
      prompt: `An isolated crown-shaped liquid splash of crystal-clear colorless sparkling liquid suspended high in mid-air, a free-floating coronet of liquid with droplets flying outward and nothing else in the frame, pure black empty void, ${STYLE_SUFFIX}`,
    },
    glass: {
      prompt: `Studio product photograph of a brand new tall straight-sided cylindrical Collins tumbler glass, completely straight vertical walls running from the rim straight down to a thick flat heavy base resting flat on its bottom, the simple shape of a tall water glass, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: GREEN_GARDEN_LABELS,
};

export const DINER_WHISKEY_SOUR: CocktailConfig = {
  slug: 'diner-whiskey-sour',
  priceILS: 58,
  title: { en: 'Whiskey Sour', he: 'וויסקי סאוור' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Bourbon · Fresh lemon · Sugar · Egg white',
    he: 'בורבון · לימון טרי · סוכר · חלבון ביצה',
  },
  category: 'smoky',
  heroImage: '/cocktail/diner-whiskey-sour-hero.png',
  heroPrompt: `A short coupe glass filled with golden amber whiskey sour topped with thick foamy egg white head, garnished with a maraschino cherry and lemon peel, against pure black void with warm rim lighting from the side, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, photorealistic, 8k`,
  flavor: { sweet: 3, bitter: 2, citrus: 4, smoky: 3, herbal: 1 },
  bartenderNote: {
    en: 'Bourbon’s warmth meets a citrus kick — silk and edge in one pour.',
    he: 'החום של הבורבון פוגש בעיטה הדרית — משי וחוד באותה לגימה.',
  },
  bartenderName: 'Diner',
  dietary: { vegan: false, glutenFree: true, alcoholFree: false },
  layers: makeCustomLayers('diner-whiskey-sour', {
    lime_peel: {
      prompt: `A single maraschino cherry, deep ruby red cherry fruit with stem, suspended in mid-air, pitch black void, no surface or shadow, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    lime_wedges: {
      prompt: `A long curling ribbon of fresh yellow lemon peel, bright sunny yellow citrus rind twisted into spiral, suspended in mid-air, pitch black void, no green, no lime, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_pink: {
      prompt: `Frothy egg white foam splash, thick creamy white foam frozen mid-air, soft cloud-like texture, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_clear: {
      prompt: `Fresh lemon juice liquid crown splash suspended high in empty mid-air, a free-floating coronet of liquid with nothing else in the frame, pale yellow citrus liquid, droplets flying outward, perfect crown shape, pitch black void, just an isolated burst of liquid alone in empty space, cinematic product photography, pitch black studio background, dramatic moody lighting from upper-right, ultra-sharp focus, commercial advertising style, transparent PNG with alpha channel, isolated subject, no background, photorealistic, 8k`,
    },
    splash_soda: { hide: true },
    glass: {
      prompt: `Studio product photograph of a brand new tall straight-sided cylindrical Collins tumbler glass, completely straight vertical walls running from the rim straight down to a thick flat heavy base resting flat on its bottom, the simple shape of a tall water glass, pristine spotless clear empty glassware standing completely alone, fresh from the factory and sparkling clean, floating in pure black void, no surface or shadow, ${STYLE_SUFFIX}`,
    },
  }),
  labels: WHISKEY_SOUR_LABELS,
};

/* ── Food — a dish, not a drink. Same rich treatment: numbered component
   breakdown + a preparation video. Driven by `kind: 'food'`. ──────────────── */

const TRUFFLE_BURGER_LABELS: IngredientLabel[] = [
  {
    id: 'bun-top',
    number: '01',
    layerId: 'bun-top',
    image: '/Food/comp-bun-cut.png',
    name: { en: 'Brioche bun · top', he: 'לחמנייה עליונה' },
    description: {
      en: 'Buttery sesame brioche, toasted golden.',
      he: 'בריוש חמאתי עם שומשום, מוזהב בקלייה.',
    },
  },
  {
    id: 'aioli',
    number: '02',
    layerId: 'aioli',
    image: '/Food/comp-aioli-cut.png',
    name: { en: 'Truffle aioli', he: 'איולי כמהין' },
    description: {
      en: 'Velvety aioli laced with black truffle — earthy depth and a rich aroma.',
      he: 'איולי קטיפתי עם תמצית כמהין שחור — עומק אדמתי וניחוח עשיר.',
    },
  },
  {
    id: 'sweet-potato',
    number: '03',
    layerId: 'sweet-potato',
    image: '/Food/comp-sweet-potato-cut.png',
    name: { en: 'Crispy sweet-potato straws', he: 'שבבי בטטה פריכים' },
    description: {
      en: 'Thin, crisp sweet-potato straws for gentle sweetness and crunch.',
      he: 'שבבי בטטה דקים ופריכים שמוסיפים מתיקות עדינה ומרקם פריך.',
    },
  },
  {
    id: 'lettuce',
    number: '04',
    layerId: 'lettuce',
    image: '/Food/comp-lettuce-cut.png',
    name: { en: 'Fresh lettuce', he: 'חסה טרייה' },
    description: {
      en: 'Cool, fresh leaves that balance the richness.',
      he: 'עלי חסה טריים וקרירים שמאזנים את העושר.',
    },
  },
  {
    id: 'patty',
    number: '05',
    layerId: 'patty',
    image: '/Food/comp-patty-cut.png',
    name: { en: 'Beef patty · 200g', he: 'קציצת בקר · 200 גרם' },
    description: {
      en: 'Coarse-ground fresh beef, fire-seared, juicy at the center.',
      he: 'בקר טרי נטחן גס, צרוב על האש, עסיסי במרכז.',
    },
  },
  {
    id: 'bun-bottom',
    number: '06',
    layerId: 'bun-bottom',
    image: '/Food/comp-bun-bottom-cut.png',
    name: { en: 'Brioche bun · bottom', he: 'לחמנייה תחתונה' },
    description: {
      en: 'Soft and buttery, toasted to hold it all together.',
      he: 'רכה וחמאתית, קלויה כדי להחזיק את הכל יחד.',
    },
  },
];

export const TRUFFLE_BURGER: CocktailConfig = {
  slug: 'truffle-burger',
  priceILS: 96,
  title: { en: 'Truffle Burger', he: 'המבורגר כמהין' },
  subtitle: { en: 'Components Breakdown', he: 'פירוט המרכיבים' },
  tagline: {
    en: 'Truffle aioli · Sweet-potato straws · 200g beef',
    he: 'איולי כמהין · שבבי בטטה · בקר 200 גרם',
  },
  category: 'smoky',
  kind: 'food',
  course: 'Mains',
  menuCategory: 'burger',
  heroImage: '/Food/truffle-burger-cut.png',
  flavor: { sweet: 2, bitter: 1, citrus: 0, smoky: 4, herbal: 2 },
  bartenderNote: {
    en: 'The secret is balance — rich truffle against cool lettuce and crisp sweet potato.',
    he: 'הסוד הוא האיזון — כמהין עשיר מול חסה קרירה ובטטה פריכה.',
  },
  bartenderName: 'Chef',
  dietary: { vegan: false, glutenFree: false, alcoholFree: true },
  layers: [],
  labels: TRUFFLE_BURGER_LABELS,
};

export const MENU: ReadonlyArray<CocktailConfig> = [
  CITRUS_LIME_SOUR,
  SMOKED_OLD_FASHIONED,
  GARDEN_SPRITZ,
  DINER_APEROL_SPRITZ,
  DINER_NEGRONI,
  DINER_PINKY,
  DINER_MARGARITA,
  DINER_GREEN_GARDEN,
  DINER_WHISKEY_SOUR,
  TRUFFLE_BURGER,
];

export function findCocktailBySlug(slug: string): CocktailConfig | undefined {
  return MENU.find((item) => item.slug === slug);
}

/** Business menu category for an item — explicit if set, otherwise a sensible default. */
export function menuCategoryOf(config: CocktailConfig | undefined | null): MenuCategory {
  if (!config) return 'other';
  if (config.menuCategory) return config.menuCategory;
  return config.kind === 'food' ? 'main' : 'cocktail';
}

export const CATEGORY_LABEL: Record<Category, Localized> = {
  citrus: { en: 'Bright & Crisp', he: 'בהיר ורענן' },
  smoky: { en: 'Deep & Smoky', he: 'עמוק ומעושן' },
  bitter: { en: 'Bitter Elegance', he: 'מרירות אלגנטית' },
  sweet: { en: 'Golden Hour', he: 'שעת הזהב' },
  mocktail: { en: 'Bright & Free', he: 'צלול וחופשי' },
};

export const FLAVOR_LABEL: Record<keyof FlavorProfile, Localized> = {
  sweet: { en: 'Sweet', he: 'מתוק' },
  bitter: { en: 'Bitter', he: 'מר' },
  citrus: { en: 'Citrus', he: 'הדרי' },
  smoky: { en: 'Smoky', he: 'מעושן' },
  herbal: { en: 'Herbal', he: 'עשבוני' },
};

// Per-cocktail signature glow colour — builds emotional memory per drink.
// Used as a CSS accent for the scene glow, ingredient connectors and flavour tags.
export const DEFAULT_ACCENT = '#e8b339';

export const COCKTAIL_ACCENT: Record<string, string> = {
  'diner-aperol-spritz': '#ff7a1a', // warm Aperol orange
  'diner-negroni': '#c01230', // deep Campari ruby
  'diner-pinky': '#ec4899', // raspberry pink
  'diner-margarita': '#9acd32', // lime green
  'diner-green-garden': '#74c69d', // cucumber-basil green
  'diner-whiskey-sour': '#e0a020', // golden amber
  'smoked-old-fashioned': '#c8741f', // smoked bronze
  'citrus-lime-sour': '#e8b53a', // citrus gold
  'garden-spritz': '#7bc96f', // garden green
  'truffle-burger': '#c8741f', // toasted truffle bronze
};

export function getAccent(slug: string): string {
  return COCKTAIL_ACCENT[slug] ?? DEFAULT_ACCENT;
}

/**
 * Per-cocktail promotional videos. `hover` autoplays (muted, looped) on the menu
 * card; `feature` plays full-screen behind a play button on the cocktail page.
 * Only populated where real footage exists.
 */
export const COCKTAIL_VIDEOS: Record<string, { hover?: string; feature?: string }> = {
  'diner-aperol-spritz': {
    hover: '/cocktail/video/diner-aperol-spritz-hover.mp4',
    feature: '/cocktail/video/diner-aperol-spritz-feature.mp4',
  },
  'diner-pinky': {
    hover: '/cocktail/video/diner-pinky.mp4',
    feature: '/cocktail/video/diner-pinky.mp4',
  },
  'garden-spritz': {
    hover: '/cocktail/video/garden-spritz.mp4',
    feature: '/cocktail/video/garden-spritz.mp4',
  },
  'truffle-burger': {
    feature: '/Food/truffle-burger-assembly.mp4',
  },
};

export function getHoverVideo(slug: string): string | null {
  return COCKTAIL_VIDEOS[slug]?.hover ?? null;
}

export function getFeatureVideo(slug: string): string | null {
  return COCKTAIL_VIDEOS[slug]?.feature ?? null;
}

/**
 * Heuristic: does this drink sparkle? Used to add a faint rising-bubble layer
 * only where it makes sense (spritzes, sodas) and never on a stirred drink.
 */
export function isEffervescent(config: CocktailConfig): boolean {
  const hay = JSON.stringify(config).toLowerCase();
  return /prosecco|sparkling|soda water|club soda|tonic|champagne|cava|seltzer|spritz|bubbl|fizz/.test(hay);
}

/**
 * Estimated pour cost (ingredients) per cocktail, ILS. Seeded estimates so the
 * menu-engineering matrix works out of the box; an owner can later override per
 * drink via `costILS` on the config / the admin form.
 */
export const COCKTAIL_COST: Record<string, number> = {
  'citrus-lime-sour': 16,
  'smoked-old-fashioned': 20,
  'garden-spritz': 10,
  'diner-aperol-spritz': 14,
  'diner-negroni': 20,
  'diner-pinky': 14,
  'diner-margarita': 16,
  'diner-green-garden': 13,
  'diner-whiskey-sour': 15,
};

export interface CocktailEconomics {
  price: number;
  cost: number;
  margin: number;
  marginPct: number;
}

/** Resolve unit economics: explicit costILS wins, else the seeded estimate. */
export function getEconomics(cocktail: Pick<CocktailConfig, 'slug' | 'priceILS' | 'costILS'>): CocktailEconomics {
  const price = cocktail.priceILS ?? 0;
  const cost = cocktail.costILS ?? COCKTAIL_COST[cocktail.slug] ?? 0;
  const margin = Math.max(0, price - cost);
  const marginPct = price > 0 ? (margin / price) * 100 : 0;
  return { price, cost, margin, marginPct };
}

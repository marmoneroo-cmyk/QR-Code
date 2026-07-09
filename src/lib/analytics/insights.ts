import 'server-only';
import { MENU } from '@/data/cocktail';
import { getAnalyticsOverview, getCocktailFunnels, getMenuEngineering } from '@/lib/analytics/queries';
import type { FunnelRow } from '@/lib/analytics/queries';
import type { MenuEngineeringItem } from '@/lib/analytics/types';
import type { ExecutiveSummary, Insight } from '@/lib/analytics/insights-types';

/** Bilingual cocktail titles keyed by slug, for human-readable sentences. */
const TITLES = new Map<string, { en: string; he: string }>(
  MENU.map((c) => [c.slug, { en: c.title.en, he: c.title.he }]),
);

function titleEn(slug: string): string {
  return TITLES.get(slug)?.en ?? slug;
}
function titleHe(slug: string): string {
  return TITLES.get(slug)?.he ?? slug;
}

/** Safe percentage of part/whole, rounded to a whole number; 0 when whole is 0. */
function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function emptySummary(): ExecutiveSummary {
  return {
    promote: [], promoteHe: [],
    remove: [], removeHe: [],
    underperforming: [], underperformingHe: [],
    working: [], workingHe: [],
    losing: [], losingHe: [],
    insights: [],
    hasData: false,
  };
}

/** The single biggest drop-off stage across all cocktails' funnels. */
interface DropOff {
  stageEn: string;
  stageHe: string;
  pct: number;
}

const FUNNEL_STAGES: ReadonlyArray<{
  from: keyof FunnelRow;
  to: keyof FunnelRow;
  en: string;
  he: string;
}> = [
  { from: 'seen', to: 'opened', en: 'seen → opened', he: 'נראה ← נפתח' },
  { from: 'opened', to: 'ingredients', en: 'opened → ingredients', he: 'נפתח ← מרכיבים' },
  { from: 'opened', to: 'called', en: 'opened → called waiter', he: 'נפתח ← קריאת מלצר' },
  { from: 'opened', to: 'ordered', en: 'opened → ordered', he: 'נפתח ← הזמנה' },
];

/**
 * Aggregate funnels across all cocktails, then find the stage with the largest
 * average drop-off. Returns null when there isn't enough funnel volume.
 */
function biggestDropOff(funnels: FunnelRow[]): DropOff | null {
  if (funnels.length === 0) return null;

  let best: DropOff | null = null;
  for (const stage of FUNNEL_STAGES) {
    let fromTotal = 0;
    let toTotal = 0;
    for (const row of funnels) {
      const fromVal = row[stage.from];
      const toVal = row[stage.to];
      if (typeof fromVal === 'number') fromTotal += fromVal;
      if (typeof toVal === 'number') toTotal += toVal;
    }
    if (fromTotal <= 0) continue;
    const dropPct = pct(fromTotal - toTotal, fromTotal);
    if (best === null || dropPct > best.pct) {
      best = { stageEn: stage.en, stageHe: stage.he, pct: dropPct };
    }
  }
  return best;
}

/** The strongest star by units (most ordered), or null when none qualify. */
function topStar(items: MenuEngineeringItem[]): MenuEngineeringItem | null {
  const stars = items.filter((i) => i.klass === 'star' && i.units > 0);
  if (stars.length === 0) return null;
  return stars.reduce((best, cur) => (cur.units > best.units ? cur : best));
}

/**
 * Build the owner-facing executive summary by synthesizing existing analytics.
 * Rule-based and deterministic — no LLM. Guards against empty data and
 * divide-by-zero everywhere; returns hasData:false with empty arrays if there
 * are no events.
 */
export async function getExecutiveSummary(restaurantSlug: string = 'diner'): Promise<ExecutiveSummary> {
  const [engineering, funnels, overview] = await Promise.all([
    getMenuEngineering(restaurantSlug),
    getCocktailFunnels(restaurantSlug),
    getAnalyticsOverview(restaurantSlug),
  ]);

  const hasData = engineering.hasData || overview.hasData || funnels.length > 0;
  if (!hasData) return emptySummary();

  const items = engineering.items;
  const summary = emptySummary();
  summary.hasData = true;
  const insights: Insight[] = [];

  // --- Promote: puzzles (high margin, low demand) ---
  const puzzles = items
    .filter((i) => i.klass === 'puzzle')
    .sort((a, b) => b.margin - a.margin);
  for (const i of puzzles) {
    summary.promote.push(
      `Promote ${titleEn(i.slug)}: ₪${i.margin} margin but low demand — feature it / run a QR campaign.`,
    );
    summary.promoteHe.push(
      `קדם את ${titleHe(i.slug)}: רווח ₪${i.margin} אך ביקוש נמוך — הצג בבולטות / הפעל קמפיין QR.`,
    );
    insights.push({
      tone: 'opportunity',
      slug: i.slug,
      text: `Promote ${titleEn(i.slug)} — ₪${i.margin} margin, low demand.`,
      textHe: `קדם את ${titleHe(i.slug)} — רווח ₪${i.margin}, ביקוש נמוך.`,
    });
  }

  // --- Remove / rework: dogs (low demand, low margin) ---
  const dogs = items.filter((i) => i.klass === 'dog');
  for (const i of dogs) {
    summary.remove.push(`Reconsider ${titleEn(i.slug)}: low demand and low margin.`);
    summary.removeHe.push(`שקול מחדש את ${titleHe(i.slug)}: ביקוש נמוך ורווח נמוך.`);
    insights.push({
      tone: 'warning',
      slug: i.slug,
      text: `Reconsider ${titleEn(i.slug)} — low demand and low margin.`,
      textHe: `שקול מחדש את ${titleHe(i.slug)} — ביקוש ורווח נמוכים.`,
    });
  }

  // --- Underperforming: high interest, low conversion ---
  const underperformers = items
    .filter((i) => i.highInterestLowConversion)
    .sort((a, b) => b.attentionScore - a.attentionScore);
  for (const i of underperformers) {
    const conv = Math.round(i.conversionPct);
    summary.underperforming.push(
      `${titleEn(i.slug)}: attention ${i.attentionScore}/100 but only ${conv}% order it — revisit price/photo/description.`,
    );
    summary.underperformingHe.push(
      `${titleHe(i.slug)}: תשומת לב ${i.attentionScore}/100 אך רק ${conv}% מזמינים — בדוק מחיר/תמונה/תיאור.`,
    );
    insights.push({
      tone: 'warning',
      slug: i.slug,
      text: `${titleEn(i.slug)} draws attention (${i.attentionScore}/100) but only ${conv}% order it.`,
      textHe: `${titleHe(i.slug)} מושך תשומת לב (${i.attentionScore}/100) אך רק ${conv}% מזמינים אותו.`,
    });
  }

  // --- Working: strongest star + overall conversion ---
  const star = topStar(items);
  if (star) {
    summary.working.push(`${titleEn(star.slug)} is your strongest performer (${star.units} ordered).`);
    summary.workingHe.push(`${titleHe(star.slug)} הוא הביצועים הטובים ביותר (${star.units} הוזמנו).`);
    insights.push({
      tone: 'positive',
      slug: star.slug,
      text: `${titleEn(star.slug)} is your strongest performer (${star.units} ordered).`,
      textHe: `${titleHe(star.slug)} הוא המוצר החזק ביותר (${star.units} הוזמנו).`,
    });
  }
  if (overview.totalViews > 0) {
    const conv = Math.round(overview.conversionPct);
    summary.working.push(
      `Overall ${conv}% of menu views convert to an order (${overview.totalOrders} of ${overview.totalViews}).`,
    );
    summary.workingHe.push(
      `בסך הכל ${conv}% מצפיות התפריט הופכות להזמנה (${overview.totalOrders} מתוך ${overview.totalViews}).`,
    );
    insights.push({
      tone: overview.conversionPct >= 10 ? 'positive' : 'neutral',
      text: `Overall conversion is ${conv}% (${overview.totalOrders}/${overview.totalViews} views).`,
      textHe: `המרה כוללת ${conv}% (${overview.totalOrders}/${overview.totalViews} צפיות).`,
    });
  }

  // --- Losing: biggest funnel drop-off ---
  const drop = biggestDropOff(funnels);
  if (drop) {
    summary.losing.push(`Most drop-off happens at ${drop.stageEn} (${drop.pct}% lost).`);
    summary.losingHe.push(`רוב הנשירה מתרחשת ב${drop.stageHe} (${drop.pct}% אבדו).`);
    insights.push({
      tone: 'warning',
      text: `Most customers drop off at ${drop.stageEn} (${drop.pct}% lost).`,
      textHe: `רוב הלקוחות נושרים ב${drop.stageHe} (${drop.pct}% אבדו).`,
    });
  }

  // Prioritize the feed: opportunities & warnings first, positives next, neutral last.
  const order: Record<Insight['tone'], number> = { opportunity: 0, warning: 1, positive: 2, neutral: 3 };
  summary.insights = [...insights].sort((a, b) => order[a.tone] - order[b.tone]);

  return summary;
}

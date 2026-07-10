import { formatILS } from '../format';
import { confidenceBucket } from '../menu-intel/thresholds';
import type { MenuEngineeringItem } from '../analytics/types';
import type { Recommendation, RecAction, Confidence, Bilingual, RecommendOptions } from './types';

/** A modest, testable price increase used to derive an honest profit estimate. */
const PRICE_BUMP_ILS = 3;

const ACTION_WEIGHT: Record<RecAction, number> = {
  fix_offer: 100,
  promote_position: 80,
  raise_price: 70,
  reduce_cost: 60,
  review_or_remove: 50,
  feature: 40,
  keep_position: 20,
};

const ils = formatILS;

function confidenceFactor(c: Confidence): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1;
}

/**
 * Build one prioritized recommendation per item from menu-engineering data.
 * Numeric impact estimates appear only where they are computable AND confidence
 * is at least medium — low-data items get a direction and an explicit
 * "needs more data" stance instead of an invented number.
 */
export function buildRecommendations(
  items: readonly MenuEngineeringItem[],
  opts: RecommendOptions = {},
): Recommendation[] {
  const minSample = opts.minSample ?? 30;
  const recs: Recommendation[] = [];

  for (const it of items) {
    const confidence = confidenceBucket(it.views, minSample);
    const lowData = confidence === 'low';

    const make = (
      action: RecAction,
      headline: Bilingual,
      rationale: Bilingual,
      estimatedImpact?: Bilingual,
    ): Recommendation => ({
      slug: it.slug,
      action,
      headline,
      rationale,
      estimatedImpact: lowData ? undefined : estimatedImpact,
      confidence,
      priority: ACTION_WEIGHT[action] * confidenceFactor(confidence) + Math.min(it.views, 500) / 50,
    });

    // 1) Conversion leak — the strongest signal, independent of menu class.
    if (it.highInterestLowConversion) {
      recs.push(
        make(
          'fix_offer',
          {
            en: 'Guests are interested but not ordering — test the image, description, or price.',
            he: 'האורחים מתעניינים אך לא מזמינים — בדקו תמונה, תיאור או מחיר.',
          },
          {
            en: `High attention (${it.attentionScore}/100) but only ${it.conversionPct}% intent.`,
            he: `תשומת לב גבוהה (${it.attentionScore}/100) אך רק ${it.conversionPct}% כוונה.`,
          },
          // No fabricated % — proving lift needs an A/B test (see Experiments).
          undefined,
        ),
      );
      continue;
    }

    switch (it.klass) {
      case 'puzzle': // high margin, low demand
        recs.push(
          make(
            'promote_position',
            {
              en: 'High margin but few guests see it — move it higher or feature it.',
              he: 'מרווח גבוה אך מעטים רואים אותו — העלו במיקום או הדגישו.',
            },
            {
              en: `Strong margin (${ils(it.margin)}/unit) with low demand (${it.views} views).`,
              he: `מרווח חזק (${ils(it.margin)} ליחידה) עם ביקוש נמוך (${it.views} צפיות).`,
            },
          ),
        );
        break;
      case 'plowhorse': { // low margin, high demand — derivable impact
        const impact = it.units * PRICE_BUMP_ILS;
        recs.push(
          make(
            'raise_price',
            {
              en: `Popular but thin margin — a ${ils(PRICE_BUMP_ILS)} price test could lift profit.`,
              he: `פופולרי אך מרווח דק — בדיקת מחיר של ${ils(PRICE_BUMP_ILS)} עשויה להגדיל רווח.`,
            },
            {
              en: `High demand (${it.units} units) at a low margin (${it.marginPct}%).`,
              he: `ביקוש גבוה (${it.units} יחידות) במרווח נמוך (${it.marginPct}%).`,
            },
            {
              en: `≈ +${ils(impact)} profit at current volume (verify with a price test).`,
              he: `≈ +${ils(impact)} רווח בנפח הנוכחי (אמתו בבדיקת מחיר).`,
            },
          ),
        );
        break;
      }
      case 'dog': // low margin, low demand
        recs.push(
          make(
            'review_or_remove',
            {
              en: 'Low interest and low margin — consider reworking or removing it.',
              he: 'עניין נמוך ומרווח נמוך — שקלו לשפר או להסיר.',
            },
            {
              en: `${it.views} views, ${it.conversionPct}% intent, ${it.marginPct}% margin.`,
              he: `${it.views} צפיות, ${it.conversionPct}% כוונה, ${it.marginPct}% מרווח.`,
            },
          ),
        );
        break;
      case 'star': // high margin, high demand
        recs.push(
          make(
            'keep_position',
            {
              en: 'A star — keep it prominent and protect its position.',
              he: 'כוכב — שמרו אותו בולט והגנו על מיקומו.',
            },
            {
              en: `High demand and margin (${ils(it.margin)}/unit).`,
              he: `ביקוש ומרווח גבוהים (${ils(it.margin)} ליחידה).`,
            },
          ),
        );
        break;
      default:
        break;
    }
  }

  return recs.sort((a, b) => b.priority - a.priority);
}

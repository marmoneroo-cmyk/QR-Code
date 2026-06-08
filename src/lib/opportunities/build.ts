import type {
  MenuSignals,
  ItemSignals,
  Opportunity,
  OpportunityType,
  Confidence,
  Evidence,
  Bilingual,
  OpportunityOptions,
} from './types';

const TYPE_WEIGHT: Record<OpportunityType, number> = {
  fix_offer: 100,
  promote_position: 90,
  promote_marketing: 80,
  promotion_candidate: 70,
  reengage_returning: 60,
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function confidenceFrom(sample: number, minSample: number): Confidence {
  if (sample >= minSample * 3) return 'high';
  if (sample >= minSample) return 'medium';
  return 'low';
}

function factor(c: Confidence): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1;
}

/**
 * Clamp a rate to [0,1]. Rates can legitimately exceed 1 because impressions
 * (menu scroll-into-view) undercount: guests reach a drink via direct QR/links
 * or "also viewed", and favorite/share from the card without opening the detail.
 * We never display a >100% rate.
 */
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const ev = (en: string, he: string, value: string | number): Evidence => ({
  label: { en, he },
  value: String(value),
});

/**
 * Build prioritised opportunities from assembled signals.
 * No fabricated numbers — evidence cites real counts; the action is a direction.
 */
export function buildOpportunities(signals: MenuSignals, opts: OpportunityOptions = {}): Opportunity[] {
  const minSample = opts.minSample ?? 10;
  const items = signals.items;
  const medImpr = median(items.map((i) => i.impressions));
  const out: Opportunity[] = [];

  const add = (
    it: ItemSignals,
    type: OpportunityType,
    evidence: Evidence[],
    action: Bilingual,
    sample: number,
  ): void => {
    const confidence = confidenceFrom(sample, minSample);
    out.push({
      slug: it.slug,
      type,
      confidence,
      evidence,
      action,
      priority: TYPE_WEIGHT[type] * factor(confidence) + Math.min(sample, 100) / 20,
    });
  };

  for (const it of items) {
    const openRate = it.impressions > 0 ? clamp01(it.opens / it.impressions) : it.opens > 0 ? 1 : 0;
    const intentRate = it.opens > 0 ? clamp01((it.favorites + it.salesUnits) / it.opens) : 0;
    const shareRate = it.opens > 0 ? clamp01(it.shares / it.opens) : 0;
    const pct = (n: number): string => `${Math.round(n * 100)}%`;

    // 1) High engagement + low intent  → review the offer.  (mutually exclusive with #2)
    if (it.opens >= 3 && openRate >= 0.4 && intentRate < 0.15) {
      add(
        it,
        'fix_offer',
        [
          ev('Opens', 'פתיחות', it.opens),
          ev('Open rate', 'שיעור פתיחה', pct(openRate)),
          ev('Intent', 'כוונה', `${it.favorites} ♥ · ${it.salesUnits} sold`),
        ],
        {
          en: 'Guests are interested but not committing — review the image, description, or price.',
          he: 'האורחים מתעניינים אך לא ממירים — בדקו תמונה, תיאור או מחיר.',
        },
        it.opens,
      );
    } else if (it.impressions > 0 && it.impressions <= medImpr && openRate >= 0.5 && it.position >= items.length / 2) {
      // 2) Low visibility + high engagement (buried but loved) → move it up. Uses POSITION.
      add(
        it,
        'promote_position',
        [
          ev('Menu position', 'מיקום בתפריט', `#${it.position + 1}`),
          ev('Seen by', 'נראה ע״י', `${it.impressions} ${it.impressions === 1 ? 'session' : 'sessions'}`),
          ev('Open rate when seen', 'שיעור פתיחה כשנראה', pct(openRate)),
        ],
        {
          en: 'High interest but few guests see it — move it higher in the menu.',
          he: 'עניין גבוה אך מעטים רואים אותו — העלו אותו במיקום בתפריט.',
        },
        it.impressions,
      );
    }

    // 3) High sharing + low sales → promote more aggressively.
    if (it.shares >= 2 && shareRate >= 0.1 && it.salesUnits === 0) {
      add(
        it,
        'promote_marketing',
        [
          ev('Shares', 'שיתופים', it.shares),
          ev('Share rate', 'שיעור שיתוף', pct(shareRate)),
          ev('Sales', 'מכירות', it.salesUnits),
        ],
        {
          en: 'Strong word-of-mouth but weak sales — promote it more aggressively.',
          he: 'מפה לאוזן חזק אך מכירות חלשות — קדמו אותו אגרסיבית יותר.',
        },
        it.shares,
      );
    }

    // 4) Strong engagement from returning visitors → promotion candidate.
    if (it.returningOpens >= 3 && intentRate < 0.2) {
      add(
        it,
        'promotion_candidate',
        [
          ev('Returning-visitor opens', 'פתיחות מבקרים חוזרים', it.returningOpens),
          ev('Intent', 'כוונה', pct(intentRate)),
        ],
        {
          en: 'Returning guests keep engaging with it — a strong candidate for a promotion.',
          he: 'אורחים חוזרים ממשיכים להתעניין — מועמד חזק למבצע.',
        },
        it.returningOpens,
      );
    }

    // 5) Returning without committing → re-engage.
    if (it.repeatNoCommit >= 2) {
      add(
        it,
        'reengage_returning',
        [ev('Returning, never ordered', 'חוזרים, לא הזמינו', it.repeatNoCommit)],
        {
          en: 'Some guests return to this drink repeatedly without ordering — nudge them (a limited-time offer or a bartender note).',
          he: 'יש אורחים שחוזרים למשקה הזה שוב ושוב בלי להזמין — תנו דחיפה (מבצע לזמן מוגבל או הערת ברמן).',
        },
        it.repeatNoCommit,
      );
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

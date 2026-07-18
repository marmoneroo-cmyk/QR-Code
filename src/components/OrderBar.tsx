'use client';

import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { track } from '@/lib/tracking/track';
import { useExperiment } from '@/lib/experiments/useExperiment';
import type { Lang } from '@/data/cocktail';

/**
 * PicksBar — the in-app *intent* surface. NOT an ordering system (no POS, no
 * kitchen, no fulfilment). The diner adds drinks they want to "My Picks" — a
 * list to show the waiter. We capture purchase INTENT and never claim a sale.
 *
 * Fires: add_to_order_clicked (intent), order_started (first pick), order_completed
 * (picks confirmed). The captured price/cost is INTENT value — relabelled as
 * "potential / intent revenue" in the analytics layer, never "actual sales"
 * (real sales arrive later via read-only POS ingestion). Honest by design:
 * no "sent to kitchen", no "waiter on the way".
 */

interface OrderBarProps {
  cocktailSlug: string;
  accent: string;
  lang: Lang;
  /** Menu price in ILS — captured into the intent event as potential revenue. */
  priceILS?: number;
  /** Pour cost in ILS — captured at pick time so historical intent profit is immutable. */
  costILS?: number;
}

export function OrderBar({ cocktailSlug, accent, lang, priceILS, costILS }: OrderBarProps) {
  const isHebrew = lang === 'he';
  const [count, setCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  // A/B: the pick CTA label is under experiment (see lib/experiments/config).
  const ctaVariant = useExperiment('order-cta');
  const addLabel = ctaVariant ? ctaVariant.value[lang] : isHebrew ? 'הוסף לבחירות שלי' : 'Add to my picks';

  const labelFont = 'var(--font-inter, sans-serif)';

  const handleAdd = () => {
    setConfirmed(false);
    setCount((c) => {
      const next = c + 1;
      track({ event: 'add_to_order_clicked', cocktailSlug, value: next });
      if (c === 0) track({ event: 'order_started', cocktailSlug });
      return next;
    });
  };

  const handleConfirm = () => {
    if (count === 0) return;
    // Snapshot BOTH price and cost as INTENT value (not a real sale) so the
    // intended revenue/profit stay historically accurate even if the menu price
    // or recipe cost changes later. Labelled as intent in the analytics layer.
    const meta: Record<string, number> = {};
    if (priceILS != null) {
      meta.priceAtOrder = priceILS;
      meta.revenue = count * priceILS;
    }
    if (costILS != null) meta.costAtOrder = costILS;
    if (priceILS != null && costILS != null) meta.profit = count * (priceILS - costILS);
    track({
      event: 'order_completed',
      cocktailSlug,
      value: count,
      metadata: Object.keys(meta).length > 0 ? meta : undefined,
    });
    setConfirmed(true);
    setCount(0);
  };

  return (
    <motion.div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-2 rounded-full border border-amber-200/25 bg-black/55 backdrop-blur-md"
      style={{ ['--accent' as string]: accent } as CSSProperties}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      {/* Add to my picks / show waiter */}
      {count === 0 ? (
        <button
          type="button"
          onClick={handleAdd}
          className="px-5 py-2 rounded-full text-10 tracking-[0.25em] uppercase text-black transition-transform hover:scale-[1.03]"
          style={{ fontFamily: labelFont, backgroundColor: accent }}
        >
          {confirmed ? (isHebrew ? 'בבחירות שלך ✓' : 'In your picks ✓') : addLabel}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAdd}
            className="w-8 h-8 rounded-full border border-amber-200/40 text-amber-100 text-sm leading-none hover:border-amber-200/80 transition-colors"
            aria-label={isHebrew ? 'הוסף עוד' : 'Add another'}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-full text-10 tracking-[0.25em] uppercase text-black transition-transform hover:scale-[1.03]"
            style={{ fontFamily: labelFont, backgroundColor: accent }}
          >
            {isHebrew ? `הראה למלצר · ${count}` : `Show waiter · ${count}`}
          </button>
        </div>
      )}
    </motion.div>
  );
}

/**
 * A/B experiment definitions (code-defined). Each experiment splits sessions
 * across variants; the diner app renders the assigned variant and fires an
 * `experiment_exposure` event, and conversion is measured from later events.
 */

export interface ExperimentVariant {
  id: string;
  /** Bilingual human label for the dashboard. */
  label: { en: string; he: string };
  /** Variant-specific copy the app renders (here: the ingredients CTA label). */
  value: { en: string; he: string };
}

export interface Experiment {
  id: string;
  attribute: { en: string; he: string };
  /** First variant is treated as the control/baseline. */
  variants: ExperimentVariant[];
  /**
   * The funnel event that counts as a conversion for this experiment. Only
   * PASSIVE, interest-based signals belong here — this product has no ordering
   * layer, so an order-based conversion could never fill (see git history:
   * the order-cta experiment was repointed to `ingredients_opened`).
   */
  conversionEvent: 'ingredients_opened' | 'cocktail_shared' | 'ar_opened' | 'cocktail_video_opened';
  status: 'running' | 'paused';
}

export const EXPERIMENTS: ReadonlyArray<Experiment> = [
  {
    // Does a curiosity question beat the plain noun at getting guests to open the
    // breakdown? Measured by `ingredients_opened`, which the CTA already fires —
    // a real signal the main guest page actually produces (unlike the removed order flow).
    id: 'ingredients-cta',
    attribute: { en: 'Ingredients button label', he: 'תווית כפתור המרכיבים' },
    conversionEvent: 'ingredients_opened',
    status: 'running',
    variants: [
      { id: 'A', label: { en: 'Ingredients', he: 'מרכיבים' }, value: { en: 'Ingredients', he: 'מרכיבים' } },
      { id: 'B', label: { en: "What's inside?", he: 'מה יש בפנים?' }, value: { en: "What's inside?", he: 'מה יש בפנים?' } },
    ],
  },
];

export function getExperiment(id: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}

/**
 * A/B experiment definitions (code-defined). Each experiment splits sessions
 * across variants; the diner app renders the assigned variant and fires an
 * `experiment_exposure` event, and conversion is measured from later events.
 */

export interface ExperimentVariant {
  id: string;
  /** Bilingual human label for the dashboard. */
  label: { en: string; he: string };
  /** Variant-specific copy the app renders (here: the order CTA). */
  value: { en: string; he: string };
}

export interface Experiment {
  id: string;
  attribute: { en: string; he: string };
  /** First variant is treated as the control/baseline. */
  variants: ExperimentVariant[];
  /** The funnel event that counts as a conversion for this experiment. */
  conversionEvent: 'order_completed' | 'add_to_order_clicked' | 'call_waiter_clicked';
  status: 'running' | 'paused';
}

export const EXPERIMENTS: ReadonlyArray<Experiment> = [
  {
    id: 'order-cta',
    attribute: { en: 'Order button label', he: 'תווית כפתור ההזמנה' },
    conversionEvent: 'order_completed',
    status: 'running',
    variants: [
      { id: 'A', label: { en: 'Add to order', he: 'הוסף להזמנה' }, value: { en: 'Add to order', he: 'הוסף להזמנה' } },
      { id: 'B', label: { en: 'Order now', he: 'הזמן עכשיו' }, value: { en: 'Order now', he: 'הזמן עכשיו' } },
    ],
  },
];

export function getExperiment(id: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}

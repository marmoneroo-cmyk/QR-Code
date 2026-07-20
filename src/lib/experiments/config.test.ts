import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, getExperiment } from './config';

// Passive, interest-based signals the main guest page actually produces. This
// product has NO ordering layer, so an order-based conversion event could never
// fill the dashboard — that mismatch is exactly what this repoint fixed.
const PASSIVE_CONVERSIONS = new Set([
  'ingredients_opened',
  'cocktail_shared',
  'ar_opened',
  'cocktail_video_opened',
]);

describe('experiment config', () => {
  it('every experiment measures a passive signal, never an order event', () => {
    for (const exp of EXPERIMENTS) {
      expect(PASSIVE_CONVERSIONS.has(exp.conversionEvent)).toBe(true);
      expect(['order_completed', 'add_to_order_clicked', 'call_waiter_clicked']).not.toContain(
        exp.conversionEvent,
      );
    }
  });

  it('defines the ingredients-cta experiment against ingredients_opened', () => {
    const exp = getExperiment('ingredients-cta');
    expect(exp).toBeDefined();
    expect(exp!.conversionEvent).toBe('ingredients_opened');
    expect(exp!.status).toBe('running');
  });

  it('gives each experiment a control baseline and at least one challenger', () => {
    for (const exp of EXPERIMENTS) {
      expect(exp.variants.length).toBeGreaterThanOrEqual(2);
      // The results computation treats variants[0] as the control.
      expect(exp.variants[0]!.id).toBeTruthy();
    }
  });

  it('gives every variant bilingual label + rendered value', () => {
    for (const exp of EXPERIMENTS) {
      for (const v of exp.variants) {
        expect(v.label.en.length).toBeGreaterThan(0);
        expect(v.label.he.length).toBeGreaterThan(0);
        expect(v.value.en.length).toBeGreaterThan(0);
        expect(v.value.he.length).toBeGreaterThan(0);
      }
    }
  });

  it('has no order-cta experiment left behind', () => {
    expect(getExperiment('order-cta')).toBeUndefined();
  });
});

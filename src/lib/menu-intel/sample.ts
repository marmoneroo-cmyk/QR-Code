/**
 * Shared sample-confidence primitive — part of the Business Brain. Answers "how much
 * should a sample of `n` observations be trusted?" as a saturating weight in [0, 1):
 * ~0.45 @ 50, ~0.83 @ 300, ~0.97 @ 2000. Both the funnel DIAGNOSIS confidence
 * (`menu-intel/funnel.ts`) and the owner-facing ACTION confidence (`value/actions.ts`)
 * read from this ONE curve, so tuning it can never let the two surfaces drift apart.
 */

/** Saturation half-constant: the sample size at which trust reaches 0.5. */
export const SAMPLE_SATURATION = 60;

/** Saturating sample-confidence weight in [0, 1). 0 for a non-positive sample. */
export function sampleConfidence(n: number): number {
  return n <= 0 ? 0 : n / (n + SAMPLE_SATURATION);
}

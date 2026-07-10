import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { EXPERIMENTS } from './config';
import type { ExperimentResult, ExperimentsResponse, VariantResult } from './results-types';

const TENANT_SLUG = 'diner';

/** Standard normal CDF via an Abramowitz-Stegun erf approximation. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Two-proportion z-test → confidence (%) that the two rates differ. */
function twoProportionConfidence(c1: number, n1: number, c2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0;
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pooled = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  const z = (p2 - p1) / se;
  const twoSidedP = 2 * (1 - normalCdf(Math.abs(z)));
  return Math.max(0, Math.min(100, (1 - twoSidedP) * 100));
}

/**
 * Compute A/B results from events: exposures are distinct sessions that fired
 * `experiment_exposure` for a variant; conversions are those sessions that also
 * fired the experiment's conversion event. Includes uplift vs control + a
 * two-proportion confidence on the leading variant.
 */
export async function getExperimentResults(
  restaurantSlug: string = TENANT_SLUG,
): Promise<ExperimentsResponse> {
  const fallback: ExperimentsResponse = {
    experiments: EXPERIMENTS.map((e) => ({
      id: e.id,
      attribute: e.attribute,
      status: e.status,
      variants: e.variants.map((v, i) => ({
        id: v.id,
        label: v.label,
        exposures: 0,
        conversions: 0,
        conversionPct: 0,
        upliftPct: 0,
        isControl: i === 0,
        isWinner: false,
      })),
      confidencePct: 0,
      significant: false,
      hasData: false,
    })),
  };

  try {
    const supabase = createAdminSupabase();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .maybeSingle();
    if (!restaurant?.id) return fallback;

    const { data } = await supabase
      .from('events')
      .select('event_name, session_id, metadata')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(50000);
    if (!data) return fallback;

    const experiments: ExperimentResult[] = EXPERIMENTS.map((experiment) => {
      // session_id -> variant it was exposed to (first exposure wins)
      const sessionVariant = new Map<string, string>();
      const converters = new Set<string>();

      for (const e of data) {
        const sid = e.session_id;
        if (!sid) continue;
        const meta = (e.metadata ?? {}) as { experimentId?: string; variant?: string };
        if (e.event_name === 'experiment_exposure' && meta.experimentId === experiment.id && meta.variant) {
          if (!sessionVariant.has(sid)) sessionVariant.set(sid, meta.variant);
        }
        if (e.event_name === experiment.conversionEvent) {
          converters.add(sid);
        }
      }

      const exposures = new Map<string, number>();
      const conversions = new Map<string, number>();
      for (const v of experiment.variants) {
        exposures.set(v.id, 0);
        conversions.set(v.id, 0);
      }
      for (const [sid, variantId] of sessionVariant) {
        if (!exposures.has(variantId)) continue;
        exposures.set(variantId, (exposures.get(variantId) ?? 0) + 1);
        if (converters.has(sid)) conversions.set(variantId, (conversions.get(variantId) ?? 0) + 1);
      }

      const controlId = experiment.variants[0]?.id;
      const controlExp = exposures.get(controlId) ?? 0;
      const controlConv = conversions.get(controlId) ?? 0;
      const controlRate = controlExp > 0 ? controlConv / controlExp : 0;

      const variants: VariantResult[] = experiment.variants.map((v, i) => {
        const exp = exposures.get(v.id) ?? 0;
        const conv = conversions.get(v.id) ?? 0;
        const rate = exp > 0 ? conv / exp : 0;
        const upliftPct = i === 0 ? 0 : controlRate > 0 ? ((rate - controlRate) / controlRate) * 100 : 0;
        return {
          id: v.id,
          label: v.label,
          exposures: exp,
          conversions: conv,
          conversionPct: rate * 100,
          upliftPct,
          isControl: i === 0,
          isWinner: false,
        };
      });

      // Leading non-control variant by conversion rate
      const challenger = variants
        .filter((v) => !v.isControl)
        .sort((a, b) => b.conversionPct - a.conversionPct)[0];
      let confidencePct = 0;
      if (challenger) {
        confidencePct = twoProportionConfidence(
          controlConv,
          controlExp,
          challenger.conversions,
          challenger.exposures,
        );
      }
      const totalExposures = variants.reduce((s, v) => s + v.exposures, 0);
      const significant = confidencePct >= 95 && variants.every((v) => v.exposures > 0);

      // Mark winner only when significant; else just the current leader (visual)
      const leader = [...variants].sort((a, b) => b.conversionPct - a.conversionPct)[0];
      if (leader && totalExposures > 0) {
        leader.isWinner = significant;
      }

      return {
        id: experiment.id,
        attribute: experiment.attribute,
        status: experiment.status,
        variants,
        confidencePct,
        significant,
        hasData: totalExposures > 0,
      };
    });

    return { experiments };
  } catch {
    return fallback;
  }
}

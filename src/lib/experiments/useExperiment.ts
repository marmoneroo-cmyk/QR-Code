'use client';

import { useEffect, useMemo } from 'react';
import { track } from '@/lib/tracking/track';
import { getSessionId } from '@/lib/tracking/session';
import { getExperiment, type ExperimentVariant } from './config';

/** Stable 32-bit hash so a given session always lands in the same variant. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const EXPOSED_KEY = 'cocktail-demo:exposed';

function markExposedOnce(experimentId: string, variantId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `${experimentId}:${variantId}`;
    const raw = window.sessionStorage.getItem(EXPOSED_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(key)) return false;
    seen.push(key);
    window.sessionStorage.setItem(EXPOSED_KEY, JSON.stringify(seen));
    return true;
  } catch {
    return true;
  }
}

/**
 * Assign the current session to a variant of `experimentId` (stable per
 * session) and fire a single `experiment_exposure` event. Returns the variant
 * so the caller can render its value; falls back to the control if unknown.
 */
export function useExperiment(experimentId: string): ExperimentVariant | null {
  const experiment = getExperiment(experimentId);

  const variant = useMemo<ExperimentVariant | null>(() => {
    if (!experiment || experiment.status !== 'running' || experiment.variants.length === 0) {
      return experiment?.variants[0] ?? null;
    }
    const sessionId = getSessionId();
    const index = hashString(`${experimentId}:${sessionId}`) % experiment.variants.length;
    return experiment.variants[index];
  }, [experiment, experimentId]);

  useEffect(() => {
    if (!experiment || !variant) return;
    if (markExposedOnce(experimentId, variant.id)) {
      track({
        event: 'experiment_exposure',
        metadata: { experimentId, variant: variant.id },
      });
    }
  }, [experiment, experimentId, variant]);

  return variant;
}

import { describe, it } from 'vitest';
import { loadEnvConfig } from '@next/env';

// Load .env.local exactly like Next does, BEFORE importing anything that builds a client.
loadEnvConfig(process.cwd());

/**
 * OPT-IN live diagnostic — NOT a hermetic unit test. It drives every owner-side read
 * function against the REAL database to prove they work on real data.
 *
 * Most of these functions swallow errors and return an empty fallback, so "did not
 * throw" proves nothing. With real events in the table, an EMPTY result is the actual
 * smell worth chasing (verify the source data exists before calling it a bug).
 *
 * It is SKIPPED unless explicitly requested, so it never touches a database during a
 * normal or CI test run. To run it:
 *
 *   LIVECHECK=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run \
 *     src/lib/analytics/livecheck.test.ts
 *
 * Results land in livecheck-report.txt (gitignored) because vitest captures stdout.
 */

const LIVE = process.env.LIVECHECK === '1';
const SLUG = 'diner';

const size = (v: unknown): number => {
  if (v == null) return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // sum the lengths of any array fields — a decent "did it produce anything" metric
    const arrays = Object.values(o).filter(Array.isArray) as unknown[][];
    if (arrays.length) return arrays.reduce((n, a) => n + a.length, 0);
    return Object.keys(o).length;
  }
  return 1;
};

describe.skipIf(!LIVE)('LIVE read-path check against the real database', () => {
  it('runs every owner-side aggregation and reports what it produced', async () => {
    const [
      queries, crm, heatmap, journeys, menuSignals, recommendations,
      signals, tables, insights, experiments, closedloop,
      promotionsRepo, changesRepo, experienceRepo, salesRepo,
    ] = await Promise.all([
      import('./queries'), import('./crm'), import('./heatmap'), import('./journeys'),
      import('./menu-signals'), import('./recommendations'), import('./signals'),
      import('./tables'), import('./insights'), import('../experiments/results'),
      import('../closedloop/server'), import('../promotions/repository'),
      import('../changes/repository'), import('../experience/repository'),
      import('../sales/repository'),
    ]);

    const probes: { name: string; run: () => Promise<unknown> }[] = [
      { name: 'getCocktailFunnels', run: () => queries.getCocktailFunnels(SLUG) },
      { name: 'getAnalyticsOverview', run: () => queries.getAnalyticsOverview(SLUG) },
      { name: 'getMenuEngineering', run: () => queries.getMenuEngineering(SLUG) },
      { name: 'getIntegrityReport', run: () => queries.getIntegrityReport(SLUG) },
      { name: 'getRawEvents', run: () => queries.getRawEvents({ limit: 50 }, SLUG) },
      { name: 'getCrmSignals', run: () => crm.getCrmSignals(SLUG) },
      { name: 'getAttentionHeatmap', run: () => heatmap.getAttentionHeatmap(SLUG) },
      { name: 'getSessionJourneys', run: () => journeys.getSessionJourneys(40, SLUG) },
      { name: 'getMenuSignals', run: () => menuSignals.getMenuSignals(SLUG) },
      { name: 'getCoViews', run: () => recommendations.getCoViews(SLUG) },
      { name: 'getSignalVerification', run: () => signals.getSignalVerification(SLUG) },
      { name: 'getTableIntelligence', run: () => tables.getTableIntelligence(SLUG) },
      { name: 'getExecutiveSummary', run: () => insights.getExecutiveSummary(SLUG) },
      { name: 'getExperimentResults', run: () => experiments.getExperimentResults(SLUG) },
      { name: 'getClosedLoop', run: () => closedloop.getClosedLoop(SLUG) },
      { name: 'listPromotions', run: () => promotionsRepo.listPromotions(SLUG) },
      { name: 'listPromotions(activeOnly)', run: () => promotionsRepo.listPromotions(SLUG, { activeOnly: true }) },
      { name: 'listChanges', run: () => changesRepo.listChanges(SLUG) },
      { name: 'listExperience', run: () => experienceRepo.listExperience(SLUG) },
      { name: 'listSalesByItem', run: () => salesRepo.listSalesByItem(SLUG) },
    ];

    const lines: string[] = [];
    for (const p of probes) {
      const started = Date.now();
      try {
        const result = await p.run();
        const ms = Date.now() - started;
        lines.push(`${size(result) === 0 ? 'EMPTY ' : 'ok    '} ${p.name.padEnd(28)} size=${String(size(result)).padEnd(6)} ${ms}ms`);
      } catch (err: unknown) {
        lines.push(`THREW  ${p.name.padEnd(28)} ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const fs = await import('node:fs');
    const header = [
      `SUPABASE_URL present : ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}`,
      `SERVICE_ROLE present : ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      `RLS_ENFORCED_READS   : ${process.env.RLS_ENFORCED_READS ?? '(unset)'}`,
      '',
    ];
    fs.writeFileSync('livecheck-report.txt', header.concat(lines).join('\n'), 'utf8');
  }, 180000);
});

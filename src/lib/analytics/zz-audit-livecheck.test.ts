import { describe, it } from 'vitest';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const LIVE = process.env.LIVECHECK === '1';
const SLUG = 'diner';

describe.skipIf(!LIVE)('AUDIT: cross-screen metric coherence', () => {
  it('dumps every shared metric', async () => {
    const [queries, menuSignals, oppBuild, closedloop, salesRepo, insights, recs, changesRepo, potential] =
      await Promise.all([
        import('./queries'),
        import('./menu-signals'),
        import('../opportunities/build'),
        import('../closedloop/server'),
        import('../sales/repository'),
        import('./insights'),
        import('./recommendations'),
        import('../changes/repository'),
        import('../value/potential'),
      ]);

    const out: string[] = [];
    const p = (s: string) => out.push(s);

    const ov = await queries.getAnalyticsOverview(SLUG);
    p('=== getAnalyticsOverview (Home / Revenue / Executive / Analytics) ===');
    p(JSON.stringify({
      totalViews: ov.totalViews, totalOrders: ov.totalOrders, totalUnits: ov.totalUnits,
      conversionPct: ov.conversionPct, totalRevenue: ov.totalRevenue, totalProfit: ov.totalProfit,
      topItemSlug: ov.topItemSlug, hasData: ov.hasData,
      viewsByDaySum: ov.viewsByDay.reduce((a, b) => a + b, 0),
      ordersByDaySum: ov.ordersByDay.reduce((a, b) => a + b, 0),
      viewsByDay: ov.viewsByDay, ordersByDay: ov.ordersByDay,
    }));
    p('topItems: ' + JSON.stringify(ov.topItems));

    const me = await queries.getMenuEngineering(SLUG);
    p('');
    p('=== getMenuEngineering (Menu Engineering / Optimize / Home / Executive / Coach / Actions / Recs / Opportunities) ===');
    p(JSON.stringify({ medianDemand: me.medianDemand, medianMargin: me.medianMargin, hasData: me.hasData }));
    p('unitsSum=' + me.items.reduce((a, b) => a + b.units, 0));
    p('revenueSum(units*price)=' + me.items.reduce((a, b) => a + b.units * b.price, 0));
    p('profitSum(units*margin)=' + me.items.reduce((a, b) => a + b.units * b.margin, 0));
    for (const i of me.items) {
      p(`  ${i.slug.padEnd(24)} views=${String(i.views).padEnd(4)} orders=${String(i.orders).padEnd(4)} units=${String(i.units).padEnd(5)} price=${i.price} cost=${i.cost} margin=${i.margin} conv=${i.conversionPct.toFixed(1)} attn=${i.attentionScore} klass=${i.klass} hiLo=${i.highInterestLowConversion}`);
    }

    p('');
    p('=== totalPotential (Home MoneyHero + Executive) ===');
    p(JSON.stringify(potential.totalPotential(me.items)));
    p('benchmark=' + JSON.stringify(potential.buildMenuBenchmark(me.items)));

    const sig = await menuSignals.getMenuSignals(SLUG);
    p('');
    p('=== getMenuSignals ===');
    p(JSON.stringify({ totalSessions: (sig as unknown as { totalSessions?: number }).totalSessions, itemCount: sig.items.length }));
    for (const i of sig.items) {
      p(`  ${JSON.stringify(i)}`);
    }

    const opps = oppBuild.buildOpportunities(sig);
    p('');
    p('=== buildOpportunities (Home / Opportunities / Actions / Coach / Today) ===');
    p('count=' + opps.length);
    for (const o of opps) p(`  ${o.type.padEnd(22)} ${o.slug.padEnd(24)} conf=${(o as unknown as {confidence?:string}).confidence ?? ''} ${JSON.stringify(o.action)}`);

    const loop = await closedloop.getClosedLoop(SLUG);
    p('');
    p('=== getClosedLoop (Home / Results / Wins / Closed-loop / Revenue) ===');
    p(JSON.stringify({
      timeline: loop.timeline.length,
      measured: loop.measured.length,
      pending: (loop as unknown as { pending?: unknown[] }).pending?.length,
      keys: Object.keys(loop),
    }));
    p('timeline: ' + JSON.stringify(loop.timeline.slice(0, 12)));
    p('measured: ' + JSON.stringify(loop.measured.map((m) => ({ id: m.change.id, type: m.change.type, entityId: m.change.entityId, summary: m.change.summary, status: m.result.status, deltaPct: m.result.deltaPct, days: m.observationDays }))));

    const sales = await salesRepo.listSalesByItem(SLUG);
    p('');
    p('=== listSalesByItem (Sales / Optimize) ===');
    p(JSON.stringify(sales));

    const exec = await insights.getExecutiveSummary(SLUG);
    p('');
    p('=== getExecutiveSummary ===');
    p(JSON.stringify(exec));

    const co = await recs.getCoViews(SLUG);
    p('');
    p('=== getCoViews (Recommendations / guest AlsoViewed) ===');
    p(JSON.stringify(co));

    const changes = await changesRepo.listChanges(SLUG);
    p('');
    p('=== listChanges ===');
    p(JSON.stringify(changes));

    const fs = await import('node:fs');
    fs.writeFileSync(
      'C:/Users/shlom/AppData/Local/Temp/claude/C--Users-shlom-Desktop-Qr-Code-cocktail-demo/863cfba6-3fbc-44be-a19e-ca0befc42724/scratchpad/audit-dump.txt',
      out.join('\n'),
      'utf8',
    );
  }, 300000);
});

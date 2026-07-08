// Live negative-path proof for Epic A+B. With NO auth cookie:
//   - every guarded admin route must 401
//   - every PUBLIC path (diner menu reads, also-viewed, track) must still 200
// No DB writes (track is posted with an empty events array → inserted:0, nothing stored).
const BASE = process.env.BASE || 'http://localhost:3100';

const CHECKS = [
  // Guarded (members-only data or writes) → must be 401 without a session
  { method: 'GET', path: '/api/sales', expect: 401, note: 'members-only data' },
  { method: 'GET', path: '/api/analytics/overview', expect: 401, note: 'admin analytics' },
  { method: 'GET', path: '/api/analytics/executive', expect: 401, note: 'admin analytics' },
  { method: 'GET', path: '/api/analytics/funnel', expect: 401, note: 'admin analytics (session-scoped)' },
  { method: 'GET', path: '/api/closed-loop', expect: 401, note: 'admin (session-scoped)' },
  { method: 'GET', path: '/api/events/raw', expect: 401, note: 'members-only events' },
  { method: 'GET', path: '/api/experiments/results', expect: 401, note: 'admin' },
  { method: 'GET', path: '/api/signals/verify', expect: 401, note: 'admin' },
  { method: 'POST', path: '/api/scrape-restaurant', expect: 401, note: 'admin write', body: { url: 'https://example.com' } },
  // Public (public-read data the diner menu needs, + telemetry) → must stay 200
  { method: 'GET', path: '/api/promotions?restaurant=diner&activeOnly=true', expect: 200, note: 'PUBLIC menu promos' },
  { method: 'GET', path: '/api/experience?restaurant=diner', expect: 200, note: 'PUBLIC menu experience' },
  { method: 'GET', path: '/api/analytics/recommendations', expect: 200, note: 'PUBLIC also-viewed' },
  { method: 'POST', path: '/api/track', expect: 200, note: 'PUBLIC telemetry', body: { restaurantSlug: 'diner', events: [] } },
];

async function once(c) {
  const res = await fetch(BASE + c.path, {
    method: c.method,
    headers: c.body ? { 'Content-Type': 'application/json' } : {},
    body: c.body ? JSON.stringify(c.body) : undefined,
  });
  return res.status;
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { await fetch(BASE + '/api/promotions?restaurant=diner&activeOnly=true'); return true; }
    catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  return false;
}

(async () => {
  if (!(await waitReady())) { console.log('SERVER NOT READY'); process.exit(1); }
  let pass = 0, fail = 0;
  for (const c of CHECKS) {
    let status;
    try { status = await once(c); } catch (e) { status = 'ERR ' + e.message; }
    const ok = status === c.expect;
    if (ok) pass++; else fail++;
    const tag = c.expect === 401 ? 'GATED' : 'PUBLIC';
    console.log(`${ok ? 'PASS' : 'FAIL'} [${tag}] ${c.method} ${c.path} -> ${status} (want ${c.expect}) — ${c.note}`);
  }
  console.log(`\n${pass}/${CHECKS.length} passed${fail ? ` — ${fail} FAILED` : ' — auth boundary verified ✅'}`);
})().catch((e) => console.log('ERR', e.message));

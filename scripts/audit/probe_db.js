// Read-only feasibility probe: is Supabase reachable, and is it production data?
// Prints NO secrets — only counts and table shape.
const fs = require('fs');
function env(name) {
  for (const f of ['.env.local', '.env']) {
    try { const m = fs.readFileSync(f, 'utf8').match(new RegExp('^' + name + '=(.*)$', 'm')); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); } catch {}
  }
  return undefined;
}
const url = env('NEXT_PUBLIC_SUPABASE_URL');
const svc = env('SUPABASE_SERVICE_ROLE_KEY');
const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
console.log('SUPABASE_URL present:', !!url, url ? '(host ' + url.replace(/^https?:\/\//, '').slice(0, 18) + '…)' : '');
console.log('SERVICE_ROLE present:', !!svc, '| ANON present:', !!anon);
if (!url || !svc) { console.log('CANNOT CONNECT (missing url/service key)'); process.exit(0); }

(async () => {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(url, svc, { auth: { persistSession: false } });
  const r = await sb.from('restaurants').select('id,slug,name').limit(50);
  console.log('restaurants:', r.error ? 'ERR ' + r.error.message : JSON.stringify(r.data));
  const c = await sb.from('events').select('id', { count: 'exact', head: true });
  console.log('events total count:', c.error ? 'ERR ' + c.error.message : c.count);
  const one = await sb.from('events').select('*').order('id', { ascending: false }).limit(1);
  if (!one.error && one.data && one.data[0]) console.log('events columns:', Object.keys(one.data[0]).join(','));
  // per-restaurant event counts
  for (const rest of (r.data || [])) {
    const cc = await sb.from('events').select('id', { count: 'exact', head: true }).eq('restaurant_id', rest.id);
    console.log(`  events for ${rest.slug}:`, cc.count);
  }
})().catch((e) => console.log('PROBE ERR', e.message));

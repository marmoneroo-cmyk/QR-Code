// Definitive C3 check: prove the events.event_id UNIQUE index from migration 0008 is live
// in production. Inserts 3 rows with the SAME event_id via the exact upsert the route uses
// (onConflict:'event_id', ignoreDuplicates:true). Index live ⇒ 1 row. Index missing ⇒ upsert
// throws "no unique/exclusion constraint matching ON CONFLICT". Cleanup matches the single
// test event_id (surgical — cannot touch real data).
const fs = require('fs');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth:{persistSession:false} });

(async () => {
  const eid = 'verify-0008-' + Date.now();
  const diner = (await sb.from('restaurants').select('id').eq('slug','diner').single()).data.id;
  const row = { restaurant_id: diner, event_id: eid, event_name: 'menu_opened', session_id: 'verify-0008-sess', occurred_at: new Date().toISOString(), metadata: { probe: 'verify-0008' } };
  const { error } = await sb.from('events').upsert([row, row, row], { onConflict: 'event_id', ignoreDuplicates: true });
  if (error) { console.log('INDEX NOT ACTIVE — upsert error:', error.message); return; }
  const { data } = await sb.from('events').select('id').eq('event_id', eid);
  const n = (data || []).length;
  console.log(`3 identical event_id upserted -> ${n} row(s) stored  => dedupe ${n === 1 ? 'ACTIVE ✅ (C3 PASS)' : 'NOT active (got '+n+')'}`);
  const del = await sb.from('events').delete({ count: 'exact' }).eq('event_id', eid);
  console.log(`cleanup: deleted ${del.count} test row(s) by event_id (diner untouched)`);
})().catch(e => console.log('ERR', e.message));

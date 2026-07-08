// Live check: event_id / eventVersion / eventSource stamping + forward-compat.
// POSTs the SAME eventId twice (simulating a retry). Pre-migration 0008 → 2 rows
// (graceful fallback, no loss); after 0008 → 1 row (idempotent). Cleans up by session.
const fs = require('fs');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth:{persistSession:false} });

(async () => {
  const sid = 'idem-test-' + Date.now();
  const eid = 'evt-' + Date.now() + '-fixed';
  const ev = { event:'cocktail_opened', eventId:eid, eventVersion:1, eventSource:'qr_table', sessionId:sid, cocktailSlug:'diner-negroni', occurredAt:Date.now() };
  const post = () => fetch('http://localhost:4321/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ restaurantSlug:'diner', events:[ev] }) }).then(r=>r.json());
  console.log('POST#1', await post());
  console.log('POST#2 (same eventId)', await post());
  await new Promise(s=>setTimeout(s,600));
  const diner = (await sb.from('restaurants').select('id').eq('slug','diner').single()).data.id;
  const rows = await sb.from('events').select('metadata').eq('restaurant_id',diner).eq('session_id',sid);
  console.log('rows stored for session:', (rows.data||[]).length, '(2 = pre-0008 fallback)');
  for (const r of (rows.data||[])) { const m = r.metadata||{}; console.log(`  eventVersion=${m.eventVersion} eventSource=${m.eventSource} restaurantType=${m.restaurantType} menuCategory=${m.menuCategory}`); }
  const del = await sb.from('events').delete({count:'exact'}).eq('restaurant_id',diner).eq('session_id',sid);
  console.log(`cleanup: deleted ${del.count} (diner restored). 2 rows = pre-0008 fallback; after applying 0008 → 1 row.`);
})().catch(e=>console.log('ERR', e.message));

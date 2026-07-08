// Live check: does /api/track now stamp restaurantType + menuCategory onto events?
// Writes ONE test event to diner under a unique session, inspects it, then deletes
// exactly that session (precise cleanup — diner not polluted).
const fs = require('fs');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth:{persistSession:false} });

(async () => {
  const sid = 'seg-test-' + Date.now();
  // a drink (negroni → cocktail) and a food item (truffle-burger → burger)
  const events = [
    { event:'cocktail_opened', sessionId:sid, cocktailSlug:'diner-negroni', occurredAt:Date.now() },
    { event:'cocktail_opened', sessionId:sid, cocktailSlug:'truffle-burger', occurredAt:Date.now() },
    { event:'menu_opened', sessionId:sid, occurredAt:Date.now() },
  ];
  const r = await fetch('http://localhost:4321/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ restaurantSlug:'diner', events }) });
  console.log('POST status', r.status, await r.json().catch(()=>null));
  await new Promise(s=>setTimeout(s,500));
  const diner = (await sb.from('restaurants').select('id').eq('slug','diner').single()).data.id;
  const rows = await sb.from('events').select('event_name,cocktail_slug,metadata').eq('restaurant_id',diner).eq('session_id',sid).order('event_name');
  for (const row of (rows.data||[])) {
    const m = row.metadata || {};
    console.log(`  ${row.event_name} [${row.cocktail_slug||'-'}] → restaurantType=${m.restaurantType} menuCategory=${m.menuCategory}`);
  }
  const del = await sb.from('events').delete({count:'exact'}).eq('restaurant_id',diner).eq('session_id',sid);
  console.log('cleanup: deleted', del.count, 'test rows for session', sid, '(diner restored)');
})().catch(e=>console.log('ERR', e.message));

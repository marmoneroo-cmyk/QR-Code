// Read-only: confirm the prod state Epic A+B depends on before writing any code.
// Checks restaurant_members exists, whether the owner row is already seeded, member count,
// and the restaurants present. NO writes.
const fs = require('fs');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth:{persistSession:false} });
const OWNER = '34dc7f5e-9da9-4772-9a7f-71826938bea1';

(async () => {
  const rest = await sb.from('restaurants').select('id,slug,name,restaurant_type');
  console.log('restaurants:', rest.error ? 'ERR '+rest.error.message : JSON.stringify(rest.data));
  const mem = await sb.from('restaurant_members').select('restaurant_id,user_id,role');
  if (mem.error) { console.log('restaurant_members: ERR', mem.error.message, '(table may not exist in prod)'); }
  else {
    console.log('restaurant_members count:', mem.data.length);
    for (const m of mem.data) console.log('  member:', m.user_id, 'role=', m.role, 'rest=', m.restaurant_id);
    const ownerRow = mem.data.find(m => m.user_id === OWNER);
    const diner = (rest.data||[]).find(r => r.slug === 'diner');
    console.log('owner-row-seeded?', ownerRow ? `YES (role=${ownerRow.role}, matches diner=${diner && ownerRow.restaurant_id===diner.id})` : 'NO — migration 0011 must seed it');
  }
})().catch(e => console.log('ERR', e.message));

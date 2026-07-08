// Diagnose the /admin/login "Failed to fetch". Tests the SAME path the browser uses
// (anon key + signInWithPassword) from Node, plus service-role connectivity + user state.
// Masks all secrets. No writes.
const fs = require('fs');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const mask = (s)=> !s ? '(MISSING)' : `${s.slice(0,6)}…${s.slice(-4)} [len ${s.length}]`;
const { createClient } = require('@supabase/supabase-js');

const URL = env('NEXT_PUBLIC_SUPABASE_URL');
const ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SVC = env('SUPABASE_SERVICE_ROLE_KEY');
const OWNER = '34dc7f5e-9da9-4772-9a7f-71826938bea1';

(async () => {
  console.log('URL :', URL || '(MISSING)');
  console.log('ANON:', mask(ANON));
  console.log('SVC :', mask(SVC));
  if (!URL || !ANON) { console.log('\n>> NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing → browser client cannot reach Supabase.'); return; }

  // 1) service-role connectivity (proves project reachable + key valid)
  try {
    const svc = createClient(URL, SVC, { auth: { persistSession: false } });
    const r = await svc.from('restaurants').select('slug').limit(1);
    console.log('\n[service_role] restaurants query:', r.error ? 'ERR '+r.error.message : 'OK '+JSON.stringify(r.data));
    const u = await svc.auth.admin.getUserById(OWNER);
    console.log('[service_role] owner user:', u.error ? 'ERR '+u.error.message : `email=${u.data.user?.email} confirmed=${!!u.data.user?.email_confirmed_at} banned=${u.data.user?.banned_until||'no'}`);
  } catch (e) { console.log('[service_role] EXCEPTION', e.message); }

  // 2) ANON auth path (exactly what the browser login does) with a deliberately-wrong password.
  //    Reachable + valid anon key -> "Invalid login credentials". Otherwise the error reveals the real cause.
  try {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await anon.auth.signInWithPassword({ email: 'shlomi.cohen44@gmail.com', password: 'deliberately-wrong-'+Date.now() });
    console.log('\n[anon] signInWithPassword(wrong pw) ->', error ? `${error.name}: ${error.message} (status ${error.status})` : 'UNEXPECTED success');
    console.log('  interpretation: "Invalid login credentials" = endpoint+anon OK (only the real password is unknown); a fetch/network error = URL/key/project problem.');
  } catch (e) { console.log('[anon] EXCEPTION (network):', e.message); }
})().catch(e=>console.log('FATAL', e.message));

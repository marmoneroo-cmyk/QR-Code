// One-off: set a TEMP password for the owner user via the Supabase admin API
// (service_role). Prints it once. Change it after logging in. No other writes.
const fs = require('fs');
const crypto = require('crypto');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const { createClient } = require('@supabase/supabase-js');

const URL = env('NEXT_PUBLIC_SUPABASE_URL');
const SVC = env('SUPABASE_SERVICE_ROLE_KEY');
const OWNER = '34dc7f5e-9da9-4772-9a7f-71826938bea1';
// Strong, typeable temp password.
const pw = 'Diner-' + crypto.randomBytes(6).toString('base64url').replace(/[-_]/g,'') + '-' + crypto.randomInt(10,99);

(async () => {
  const sb = createClient(URL, SVC, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.admin.updateUserById(OWNER, { password: pw });
  if (error) { console.log('ERR', error.message); return; }
  console.log('OK — temp password set for', data.user.email);
  console.log('EMAIL    :', data.user.email);
  console.log('PASSWORD :', pw);
})().catch(e => console.log('FATAL', e.message));

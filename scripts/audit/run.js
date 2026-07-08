/* Validation-audit runner. Subcommands: setup | t1 t2 t3 t4 t5 t6 t7 t8 t9 | cleanup
   Isolated tenants audit-a / audit-b only. NEVER writes to 'diner'. */
const fs = require('fs');
function env(n){ for(const f of ['.env.local','.env']){ try{const m=fs.readFileSync(f,'utf8').match(new RegExp('^'+n+'=(.*)$','m')); if(m) return m[1].trim().replace(/^["']|["']$/g,'');}catch{} } }
const URL_=env('NEXT_PUBLIC_SUPABASE_URL'), SVC=env('SUPABASE_SERVICE_ROLE_KEY'), ANON=env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(URL_, SVC, { auth:{persistSession:false} });
const anonSb = createClient(URL_, ANON, { auth:{persistSession:false} });
const BASE='http://localhost:4321';
const DAY=86400000;
const A='audit-a', B='audit-b';

const log=(...a)=>console.log(...a);
async function tid(slug){ const {data}=await sb.from('restaurants').select('id').eq('slug',slug).maybeSingle(); return data?data.id:null; }
async function ensure(slug,name){ let id=await tid(slug); if(id) return id; const {data,error}=await sb.from('restaurants').insert({slug,name}).select('id').single(); if(error) throw new Error(error.message); return data.id; }
function ev(restId,{slug,name,sid,vid,t,value,metadata,device,lang}){ const iso=new Date(t).toISOString(); return {restaurant_id:restId,cocktail_slug:slug??null,event_name:name,session_id:sid,visitor_id:vid??null,table_id:null,device_type:device??'mobile',language:lang??'he',referrer:null,value_num:(value===undefined?null:value),metadata:metadata??null,occurred_at:iso,created_at:iso}; }
async function ins(rows){ for(let i=0;i<rows.length;i+=500){ const {error}=await sb.from('events').insert(rows.slice(i,i+500)); if(error) throw new Error(error.message);} return rows.length; }
async function clearTenant(slug){ const id=await tid(slug); if(!id) return; await sb.from('events').delete().eq('restaurant_id',id); await sb.from('changes').delete().eq('restaurant_id',id); }
async function countEv(restId,filter={}){ let q=sb.from('events').select('id',{count:'exact',head:true}).eq('restaurant_id',restId); for(const[k,v]of Object.entries(filter)) q=q.eq(k,v); const {count}=await q; return count; }
async function post(path,body,headers){ const r=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',...(headers||{})},body:JSON.stringify(body)}); let j; try{j=await r.json()}catch{j=null} return {status:r.status,json:j}; }
async function getJSON(path){ const r=await fetch(BASE+path); let j; try{j=await r.json()}catch{j=null} return {status:r.status,json:j}; }
async function audit(fn,rest){ return getJSON(`/api/auditx?fn=${fn}&restaurant=${rest}`); }

async function setup(){ const a=await ensure(A,'Audit A'); const b=await ensure(B,'Audit B'); await clearTenant(A); await clearTenant(B); const diner=await tid('diner'); log('SETUP audit-a=',a,'audit-b=',b,'diner=',diner,'(diner untouched)'); }
async function cleanup(){ await clearTenant(A); await clearTenant(B); for(const s of [A,B]){ const id=await tid(s); if(id){ await sb.from('restaurants').delete().eq('id',id);} } log('CLEANUP done — audit-a/b events+changes+restaurants deleted. diner untouched.'); }

// ---- TEST 1: Event duplication via real /api/track (idempotency) ----
async function t1(){ const a=await tid(A); const sid='dup-'+Date.now();
  const batch={restaurantSlug:A,events:[{event:'order_completed',sessionId:sid,cocktailSlug:'diner-negroni',value:2,metadata:{revenue:100,profit:60},occurredAt:Date.now()}]};
  const r1=await post('/api/track',batch); const r2=await post('/api/track',batch); // identical re-delivery
  const r3=await post('/api/track',batch); // third
  await new Promise(s=>setTimeout(s,400));
  const rows=await sb.from('events').select('value_num,metadata').eq('restaurant_id',a).eq('session_id',sid).eq('event_name','order_completed');
  const n=rows.data?rows.data.length:0; const sumQty=(rows.data||[]).reduce((s,r)=>s+(r.value_num||0),0); const sumRev=(rows.data||[]).reduce((s,r)=>s+((r.metadata&&r.metadata.revenue)||0),0);
  log('T1 duplication: 3 identical POSTs of ONE order →',JSON.stringify({insertedResponses:[r1.json,r2.json,r3.json].map(x=>x&&x.inserted),rowsInDB:n,summedUnits:sumQty,summedRevenue:sumRev}));
  log('  VERDICT:',n===3?'CONFIRMED — no idempotency, 3 rows, revenue inflated 100→'+sumRev:'rows='+n); }

// ---- TEST 9: no-auth + client-trusted revenue + occurred_at skew ----
async function t9(){ const a=await tid(A);
  const sid='spoof-'+Date.now();
  const r=await post('/api/track',{restaurantSlug:A,events:[{event:'order_completed',sessionId:sid,cocktailSlug:'diner-negroni',value:999,metadata:{revenue:1000000000,profit:999999999},occurredAt:Date.now()}]}); // NO auth header
  await new Promise(s=>setTimeout(s,300));
  const row=await sb.from('events').select('value_num,metadata,occurred_at').eq('restaurant_id',a).eq('session_id',sid).maybeSingle();
  // occurred_at skew tests
  const back=Date.now()-12*3600*1000, far=Date.now()-5*DAY;
  const sB='skewB-'+Date.now(); await post('/api/track',{restaurantSlug:A,events:[{event:'cocktail_opened',sessionId:sB,cocktailSlug:'diner-negroni',occurredAt:back}]});
  const sF='skewF-'+Date.now(); await post('/api/track',{restaurantSlug:A,events:[{event:'cocktail_opened',sessionId:sF,cocktailSlug:'diner-negroni',occurredAt:far}]});
  await new Promise(s=>setTimeout(s,300));
  const rB=await sb.from('events').select('occurred_at').eq('restaurant_id',a).eq('session_id',sB).maybeSingle();
  const rF=await sb.from('events').select('occurred_at').eq('restaurant_id',a).eq('session_id',sF).maybeSingle();
  log('T9 no-auth/client-trust: POST with NO auth, revenue=1e9 units=999 →',JSON.stringify({httpStatus:r.status,resp:r.json,storedValue:row.data&&row.data.value_num,storedRevenue:row.data&&row.data.metadata&&row.data.metadata.revenue}));
  log('  occurred_at skew: requested -12h stored=',rB.data&&rB.data.occurred_at,' | requested -5d (out of ±1d) stored=',rF.data&&rF.data.occurred_at,'(clamped to ~now)');
  log('  VERDICT:',(row.data&&row.data.metadata&&row.data.metadata.revenue===1000000000)?'CONFIRMED — unauthenticated client revenue stored verbatim':'check'); }

// ---- TEST 8: tenant isolation (aggregation) + cross-tenant access (authz) ----
async function t8(){ const a=await tid(A), b=await tid(B);
  // generate events in A only
  const rows=[]; for(let i=0;i<20;i++) rows.push(ev(a,{slug:'diner-negroni',name:'cocktail_opened',sid:'iso-'+i,t:Date.now()-3600000}));
  await ins(rows);
  const ovA=await audit('overview',A), ovB=await audit('overview',B);
  const oA=ovA.json&&ovA.json.data, oB=ovB.json&&ovB.json.data;
  // cross-tenant READ with no auth via /api/changes (param-driven)
  await sb.from('changes').insert({restaurant_id:a,change_type:'experience.image',entity_type:'cocktail',entity_id:'diner-negroni',summary:'AUDIT-A secret change',source:'manual'});
  const chgLeak=await getJSON('/api/changes?restaurant='+A); // no auth
  // anon-key direct read of A events (RLS test)
  const anonRead=await anonSb.from('events').select('id',{count:'exact',head:true}).eq('restaurant_id',a);
  log('T8 isolation: A has 20 opens. Overview A.totalViews=',oA&&(oA.totalViews??oA.views),' B.totalViews=',oB&&(oB.totalViews??oB.views),'(B should be ~0)');
  log('  cross-tenant /api/changes?restaurant=audit-a (NO auth) → status',chgLeak.status,'returned',(chgLeak.json&&chgLeak.json.data?chgLeak.json.data.length:chgLeak.json&&chgLeak.json.length)||0,'rows incl "AUDIT-A secret change"');
  log('  anon-key direct events read for audit-a → count=',anonRead.count,'error=',anonRead.error?anonRead.error.message:'none');
  log('  VERDICT(aggregation):',(oB&&((oB.totalViews??oB.views)||0)===0)?'ISOLATED (queries filter by restaurant_id)':'LEAK', '| VERDICT(authz): cross-tenant read', chgLeak.status===200?'CONFIRMED LEAK (no auth on ?restaurant=)':'blocked'); }

// ---- TEST 5: false wins (zero-baseline + decline-as-win) ----
async function t5(){ const a=await tid(A); const now=Date.now();
  // Scenario ZB: change 3d ago on diner-negroni (experience→opens), 0 before, 8 after
  const bd=now-3*DAY;
  await sb.from('changes').insert({restaurant_id:a,change_type:'experience.image',entity_type:'cocktail',entity_id:'diner-negroni',summary:'ZB test',source:'manual',created_at:new Date(bd).toISOString()});
  const zb=[]; for(let i=0;i<8;i++) zb.push(ev(a,{slug:'diner-negroni',name:'cocktail_opened',sid:'zb-after-'+i,t:bd+DAY*(0.2+i*0.3)})); await ins(zb); // all after, within 3d
  // Scenario DECLINE: change 3d ago on diner-aperol-spritz, before=14 distinct, after=10 distinct → +67% but total fell
  await sb.from('changes').insert({restaurant_id:a,change_type:'experience.image',entity_type:'cocktail',entity_id:'diner-aperol-spritz',summary:'DECLINE test',source:'manual',created_at:new Date(bd).toISOString()});
  const dec=[]; for(let i=0;i<14;i++) dec.push(ev(a,{slug:'diner-aperol-spritz',name:'cocktail_opened',sid:'dec-before-'+i,t:bd-DAY*(0.5+i*0.4)})); // before window (within 7d before bd)
  for(let i=0;i<10;i++) dec.push(ev(a,{slug:'diner-aperol-spritz',name:'cocktail_opened',sid:'dec-after-'+i,t:bd+DAY*(0.2+i*0.25)})); await ins(dec);
  await new Promise(s=>setTimeout(s,400));
  const cl=await audit('closedloop',A); const items=(cl.json&&cl.json.data&&cl.json.data.measured)||[];
  const zbi=items.find(x=>x.change.entityId==='diner-negroni');
  const deci=items.find(x=>x.change.entityId==='diner-aperol-spritz');
  log('T5 false wins:');
  log('  ZERO-BASELINE (0 before, 8 after): status=',zbi&&zbi.result.status,'deltaPct=',zbi&&zbi.result.deltaPct,'→',(zbi&&zbi.result.status==='success')?'CONFIRMED false win (success with no baseline)':'?');
  log('  DECLINE-AS-WIN (14 distinct before → 10 after, total FELL 29%): status=',deci&&deci.result.status,'deltaPct=',deci&&deci.result.deltaPct,'→',(deci&&deci.result.status==='success'&&deci.result.deltaPct>0)?'CONFIRMED — a 29% volume DROP reported as +'+deci.result.deltaPct+'% win':'?'); }

// ---- TEST 4: closed-loop lifecycle (no state, non-monotonic, stuck) ----
async function t4(){ const a=await tid(A);
  // re-measure twice (live recompute) — show no persisted state column
  const c1=await audit('closedloop',A); const c2=await audit('closedloop',A);
  const m1=(c1.json&&c1.json.data&&c1.json.data.measured)||[];
  const sampleChange=await sb.from('changes').select('*').eq('restaurant_id',a).limit(1).maybeSingle();
  const cols=sampleChange.data?Object.keys(sampleChange.data):[];
  // stuck demo: change 1 day ago → too_early forever until time passes
  const bd=Date.now()-1*DAY; await sb.from('changes').insert({restaurant_id:a,change_type:'experience.image',entity_type:'cocktail',entity_id:'diner-pinky',summary:'STUCK too_early',source:'manual',created_at:new Date(bd).toISOString()});
  await ins([ev(a,{slug:'diner-pinky',name:'cocktail_opened',sid:'stk-1',t:bd+3600000})]);
  await new Promise(s=>setTimeout(s,300));
  const c3=await audit('closedloop',A); const pin=((c3.json&&c3.json.data&&c3.json.data.measured)||[]).find(x=>x.change.entityId==='diner-pinky');
  log('T4 lifecycle: changes table columns =',cols.join(','),'→ has status/state column?',cols.includes('status')||cols.includes('state'));
  log('  two GETs both recompute live (measured count run1=',m1.length,'run2=',((c2.json&&c2.json.data&&c2.json.data.measured)||[]).length,')');
  log('  change <2 days old (diner-pinky): status=',pin&&pin.result.status,'→',(pin&&pin.result.status==='too_early')?'CONFIRMED — no scheduler; sits too_early until someone loads it later':'?'); }

// ---- TEST 6: analytics counting accuracy ----
async function t6(){ const a=await tid(A); const t=Date.now()-3600000; const rows=[];
  // 100 sessions seen; 25 opened; 10 video; 5 ar — on diner-margarita
  for(let i=0;i<100;i++) rows.push(ev(a,{slug:'diner-margarita',name:'cocktail_impression',sid:'v6-'+i,t}));
  for(let i=0;i<25;i++) rows.push(ev(a,{slug:'diner-margarita',name:'cocktail_opened',sid:'v6-'+i,t:t+1000}));
  for(let i=0;i<10;i++) rows.push(ev(a,{slug:'diner-margarita',name:'cocktail_video_opened',sid:'v6-'+i,t:t+2000}));
  for(let i=0;i<5;i++) rows.push(ev(a,{slug:'diner-margarita',name:'ar_opened',sid:'v6-'+i,t:t+3000}));
  await ins(rows); await new Promise(s=>setTimeout(s,400));
  const f=await audit('funnels',A); const rowsF=(f.json&&f.json.data)||[]; const mar=rowsF.find(x=>x.slug==='diner-margarita'||x.cocktailSlug==='diner-margarita');
  log('T6 accuracy: injected seen=100 opened=25 video=10 ar=5 (distinct sessions).');
  log('  funnel row for margarita =',JSON.stringify(mar));
  log('  → compare displayed vs injected; error% per stage.'); }

// ---- TEST 7: recommendation engine (high views, low conversion) ----
async function t7(){ const a=await tid(A); const t=Date.now()-3600000; const rows=[];
  for(let i=0;i<60;i++){ rows.push(ev(a,{slug:'diner-green-garden',name:'cocktail_impression',sid:'r7-'+i,t})); rows.push(ev(a,{slug:'diner-green-garden',name:'cocktail_opened',sid:'r7-'+i,t:t+1000})); }
  // zero intent/order for green-garden → high interest, no conversion
  await ins(rows); await new Promise(s=>setTimeout(s,400));
  const o=await audit('opportunities',A); const opps=(o.json&&o.json.data)||[];
  const me=await audit('menueng',A); const meItems=(me.json&&me.json.data&&(me.json.data.items||me.json.data))||[];
  log('T7 recommendations: green-garden has 60 opens, 0 conversion.');
  log('  opportunities returned:',JSON.stringify(opps.slice(0,6)));
  log('  menu-eng green-garden:',JSON.stringify((Array.isArray(meItems)?meItems:[]).find(x=>x.slug==='diner-green-garden'))); }

const cmd=process.argv[2];
const map={setup,cleanup,t1,t2:async()=>log('T2 run in browser step'),t3:async()=>log('T3 run in browser step'),t4,t5,t6,t7,t8,t9};
(async()=>{ if(!map[cmd]){ log('usage: node run.js <setup|t1..t9|cleanup>'); return;} await map[cmd](); })().catch(e=>{console.log('RUN ERR',e.message); process.exit(1);});

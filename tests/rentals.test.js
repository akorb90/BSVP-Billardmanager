import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/server.js';
import {rentalPrice,hourlyRate} from '../public/rental-pricing.js';

test('Minutengenaue Cent-Abrechnung und Prozentpreise einschließlich Grenzwerte',()=>{
  for(const [ms,rate,minutes,cents] of [[3600000,900,60,900],[1800000,900,30,450],[1801000,900,31,465],[1800000,720,30,360],[0,900,0,0],[1,900,1,15],[60000,900,1,15],[60001,900,2,30],[60000,100,1,2]]) {
    assert.deepEqual(rentalPrice(1000,1000+ms,rate),{duration_ms:ms,billed_minutes:minutes,total_cents:cents});
  }
  assert.equal(hourlyRate(900,'percent',-20),720);
  assert.equal(hourlyRate(900,'percent',10),990);
  assert.equal(hourlyRate(900,'percent',-100),0);
  assert.equal(hourlyRate(900,'direct',7.25),725);
  for(const value of [-1,Infinity,NaN,0.001,10001,'9']) assert.throws(()=>hourlyRate(900,'direct',value));
  assert.throws(()=>hourlyRate(900,'percent',-101));
  assert.throws(()=>rentalPrice(10,9,900));
});

test('Vermietung: Rechte, Konflikte, Persistenz, Abschluss, Korrektur und Audit',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-rentals-')),dbPath=join(dir,'db.sqlite');
  const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let server,base,cookie,csrf,token='';
  async function start(){server=createApp({dbPath,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
  async function call(path,data,admin=true,headers={}){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(admin?{Cookie:cookie||'','X-CSRF-Token':csrf||''}:{Authorization:'Bearer '+token}),...headers},body:data?JSON.stringify(data):undefined});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};}
  async function login(){const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}
  const state=async()=>(await call('/api/admin')).body;
  try {
    await start(); await login();
    await call('/api/events',{name:'Test',kind:'Liga',date:'2026-10-27'});
    await call('/api/matches',{event_id:1,player_a:'A',player_b:'B',discipline:'8-Ball',target:1,pin:'012345'});
    await call('/api/matches/1/start',{table_no:8,version:0});
    token=(await call('/api/tables/8/login',{pin:'012345'},false)).body.token;
    for(const [path,data] of [['/api/rentals',{table_no:1}],['/api/rentals/settings',{base_euros:12}],['/api/rentals/1/finish',{version:0}],['/api/rentals/1/edit',{version:0}]]) assert.equal((await call(path,data,false)).status,401);
    assert.equal((await call('/api/admin',undefined,false)).status,401);
    assert.equal((await call('/api/rentals',{table_no:1,settings_version:0},true,{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await call('/api/rentals',{table_no:8,settings_version:0})).status,409);
    const attempts=await Promise.all([call('/api/rentals',{table_no:1,settings_version:0}),call('/api/rentals',{table_no:1,settings_version:0})]);
    assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
    for(const discount of [-1,101,'20',null,0.001]) assert.equal((await call('/api/rentals',{table_no:7,settings_version:0,discount})).status,400);
    const first=attempts.find(r=>r.status===201).body;
    assert.equal(first.hourly_cents,900);
    assert.equal((await call('/api/rentals',{table_no:2,settings_version:0,mode:'percent',value:-20})).body.hourly_cents,720);
    await call('/api/matches',{event_id:1,player_a:'C',player_b:'D',discipline:'8-Ball',target:1,pin:'012345'});
    assert.equal((await call('/api/matches/2/start',{table_no:1,version:0})).status,409);
    const match=(await state()).matches.find(m=>m.id===2);
    assert.equal((await call('/api/matches/2/edit',{...match,status:'live',table_no:1})).status,409);
    assert.equal((await call('/api/rentals/settings',{version:0,base_euros:12,action:'rental:settings',confirmation:'GRUNDPREIS ÄNDERN'})).status,200);
    assert.equal((await call('/api/rentals',{table_no:3,settings_version:0})).status,409);
    assert.equal((await call('/api/rentals',{table_no:3,settings_version:1})).body.hourly_cents,1200);
    await new Promise(r=>server.close(r)); await start(); await login();
    const saved=(await state()).rentals.find(r=>r.id===first.id);
    assert.equal(saved.started_at,first.started_at); assert.equal(saved.hourly_cents,900);
    const finish={version:0,ended_at:Date.now(),action:'rental:finish'};
    assert.equal((await call('/api/rentals/1/finish',{...finish,action:'other'})).status,400);
    assert.equal((await call('/api/rentals/1/finish',{...finish,ended_at:first.started_at-1})).status,400);
    assert.equal((await call('/api/rentals/1/finish',{...finish,ended_at:Date.now()+60000})).status,400);
    const end=(await call('/api/rentals/1/finish',finish)).body;
    assert.equal(end.ended_at,finish.ended_at);
    assert.equal(end.total_cents,rentalPrice(first.started_at,finish.ended_at,900).total_cents);
    assert.equal(end.status,'finished'); assert.deepEqual(await call('/api/rentals/1/finish',finish).then(r=>r.body),end);
    assert.equal((await call('/api/rentals',{table_no:1,settings_version:1,mode:'direct',value:8})).status,201);
    const ended_at=Date.now()-60000, started_at=ended_at-1801000;
    const correction={version:end.version,started_at,ended_at,mode:'direct',value:9,action:'rental:edit',confirmation:'BUCHUNG ÄNDERN'};
    for(const confirmation of ['', 'BUCHUNG', 'BUCHUNG ÄNDERN ']) assert.equal((await call('/api/rentals/1/edit',{...correction,confirmation})).status,400);
    assert.equal((await call('/api/rentals/1/edit',{...correction,action:'other'})).status,400);
    assert.equal((await call('/api/rentals/1/edit',{...correction,ended_at:started_at-1})).status,400);
    assert.equal((await call('/api/rentals/1/edit',{...correction,version:0})).status,409);
    assert.equal((await call('/api/rentals/2/edit',{...correction,version:0})).status,409);
    const corrected=(await call('/api/rentals/1/edit',correction)).body;
    assert.equal(corrected.billed_minutes,31); assert.equal(corrected.total_cents,465); assert.equal(corrected.status,'finished');
    assert.equal((await call('/api/rentals/1/edit',correction)).status,409);
    assert.equal((await state()).rentals.filter(r=>r.table_no===1&&r.status==='active').length,1);
    const discounted=(await call('/api/rentals/1/edit',{...correction,version:corrected.version,started_at:ended_at-1800000,mode:'percent',value:-20})).body;
    assert.equal(discounted.total_cents,360); assert.equal(discounted.base_cents,900);
    assert.equal((await call('/api/rentals/1/finish',finish)).status,409);
    for(const id of [1,2]) {
      const item=(await state()).rentals.find(r=>r.id===id);
      const deletion={version:item.version,action:'rental:delete',confirmation:'BUCHUNG LÖSCHEN'};
      assert.equal((await call(`/api/rentals/${id}/delete`,deletion,false)).status,401);
      for(const confirmation of ['', 'BUCHUNG', 'buchung löschen', 'BUCHUNG LÖSCHEN ']) assert.equal((await call(`/api/rentals/${id}/delete`,{...deletion,confirmation})).status,400);
      assert.equal((await call(`/api/rentals/${id}/delete`,{...deletion,action:'rental:edit'})).status,400);
      assert.equal((await call(`/api/rentals/${id}/delete`,{...deletion,version:-1})).status,409);
      assert.equal((await call(`/api/rentals/${id}/delete`,deletion)).status,200);
    }
    // Removing the highest ID must not let an old dialog target a new booking.
    const highest=(await state()).rentals[0];
    await call(`/api/rentals/${highest.id}/delete`,{version:highest.version,action:'rental:delete',confirmation:'BUCHUNG LÖSCHEN'});
    const replacement=(await call('/api/rentals',{table_no:2,settings_version:1})).body;
    assert.ok(replacement.id>highest.id);
    for(const confirmation of ['', 'GRUNDPREIS', 'GRUNDPREIS ÄNDERN ']) assert.equal((await call('/api/rentals/settings',{version:1,base_euros:10,action:'rental:settings',confirmation})).status,400);
    assert.equal((await call('/api/rentals/settings',{version:0,base_euros:10,action:'rental:settings',confirmation:'GRUNDPREIS ÄNDERN'})).status,409);
    const discountedStart=await call('/api/rentals',{table_no:7,settings_version:1,discount:20});
    assert.equal(discountedStart.body.hourly_cents,960);assert.equal(discountedStart.body.adjustment_percent,-20);
    const db=new DatabaseSync(dbPath);
    assert.equal(db.prepare("SELECT count(*) AS n FROM audit WHERE action='rental:finish'").get().n,1);
    const audit=JSON.parse(db.prepare("SELECT detail FROM audit WHERE action='rental:edit' ORDER BY id LIMIT 1").get().detail);
    assert.deepEqual(audit.before,end); assert.deepEqual(audit.after,corrected);
    const deleted=db.prepare("SELECT detail FROM audit WHERE action='rental:delete' ORDER BY id").all().map(r=>JSON.parse(r.detail));
    assert.deepEqual(deleted[0].before,discounted);assert.equal(deleted[1].before.status,'active');db.close();
  } finally {if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

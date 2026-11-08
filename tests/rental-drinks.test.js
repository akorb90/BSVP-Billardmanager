import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,randomUUID,createHash} from 'node:crypto';
import {createApp,openTestDatabase} from './helpers/database.js';
import {berlinMidnight,inventoryReport} from '../src/inventory-report.js';

test('FR-014.3–5: atomic rental drinks, checked corrections, complete restore and rejected invalid backups',async()=>{
  const dbKey=randomUUID(),config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  const server=await createApp({dbKey,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
  const call=async(path,body,authenticated=true)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(authenticated?{Cookie:cookie,'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
  };
  const ok=async(path,body)=>{const r=await call(path,body);assert.ok(r.status<300,JSON.stringify(r));return r.body;};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
  const rentals=async()=>(await ok('/api/admin')).rentals;
  const rental=async id=>(await rentals()).find(r=>r.id===id);
  const inv=async()=>await ok('/api/inventory');
  const drink=async()=> (await inv()).drinks[0];
  const change=async(quantity)=>{const d=await drink();return {kind:'drink',operation_id:randomUUID(),drink_id:d.id,drink_version:d.version,quantity};};
  const resign=b=>{b.checksum=createHash('sha256').update(JSON.stringify(b.data)).digest('hex');return b;};
  let db;
  try {
    await login();
    for(const comment of [undefined,null,'','   ','x'.repeat(201)])assert.equal((await call('/api/rentals',{table_no:1,settings_version:0,comment})).status,400);
    const r=await ok('/api/rentals',{table_no:1,settings_version:0,comment:'  Anna  ',discount:20});assert.equal(r.comment,'Anna');
    assert.equal((await call('/api/rentals/1/drink',{version:0,change:{}},false)).status,401);
    const d=await ok('/api/inventory',{action:'drink',operation_id:randomUUID(),name:'Wasser',size_ml:500,sale_cents:250,purchase_cents:null,minimum:5,active:1});
    await ok('/api/inventory',{action:'movement',operation_id:randomUUID(),drink_id:d.id,version:0,kind:'receipt',packages:0,singles:10,purchase_cents:100});
    const request={version:0,change:await change(2)};
    const results=await Promise.all([call('/api/rentals/1/drink',request),call('/api/rentals/1/drink',request)]);assert.deepEqual(results.map(x=>x.status),[200,200]);
    assert.equal((await rental(1)).drink_cents,500);assert.equal((await drink()).stock,8);
    assert.equal((await call('/api/rentals/1/drink',{...request,change:{...request.change,quantity:3}})).status,409);
    assert.equal((await call('/api/rentals/1/drink',{version:0,change:await change(1)})).status,409);
    assert.equal((await call('/api/rentals/1/drink',{version:1,change:await change(100)})).status,409);
    assert.equal((await rental(1)).version,1);assert.equal((await drink()).stock,8);
    let current=await drink();await ok('/api/inventory',{action:'drink',operation_id:randomUUID(),...current,sale_cents:300});
    assert.equal((await rental(1)).drink_cents,500);
    const preview=await ok('/api/rentals/1/preview',{});
    const finish={version:1,action:'rental:finish',preview,checked:preview.summary.positions};
    assert.equal((await call('/api/rentals/1/finish',{...finish,checked:['rent']})).status,400);
    assert.equal((await call('/api/rentals/1/finish',{version:1,action:'rental:finish'})).status,400);
    const forged=structuredClone(finish);forged.preview.summary.drink_cents=1;assert.equal((await call('/api/rentals/1/finish',forged)).status,409);
    await ok('/api/rentals/1/comment',{version:1,comment:'Anna und Ben'});
    assert.equal((await call('/api/rentals/1/finish',{...finish,version:2})).status,409);
    const fresh=await ok('/api/rentals/1/preview',{}),closing={version:2,action:'rental:finish',preview:fresh,checked:fresh.summary.positions};
    const ended=await ok('/api/rentals/1/finish',closing);assert.equal(ended.ended_at,fresh.summary.ended_at);assert.equal(ended.total_cents,fresh.summary.rent_cents);
    assert.deepEqual(await ok('/api/rentals/1/finish',closing),ended);
    assert.equal((await call('/api/rentals/1/delete',{version:3,action:'rental:delete',confirmation:'BUCHUNG LÖSCHEN'})).status,409);
    const position=(await rental(1)).drink_positions[0];
    current=await drink();assert.equal((await call('/api/inventory',{action:'movement',operation_id:randomUUID(),drink_id:d.id,version:current.version,kind:'reversal',reverses:position.movement_id,reason:'Umgehung'})).status,409);
    const correction={version:3,change:{kind:'cancel',operation_id:randomUUID(),position_id:position.id,reason:'Nicht ausgegeben',returned:true}};
    assert.equal((await call('/api/rentals/1/drink',correction)).status,409);
    const cp=await ok('/api/rentals/1/preview',{change:correction.change});correction.preview=cp;correction.checked=cp.summary.positions;
    await ok('/api/rentals/1/drink',correction);assert.equal((await drink()).stock,10);assert.equal((await rental(1)).drink_cents,0);
    assert.equal((await call('/api/rentals/1/drink',correction)).status,200);assert.equal((await drink()).stock,10);
    const add={version:4,change:await change(1)};const ap=await ok('/api/rentals/1/preview',{change:add.change});add.preview=ap;add.checked=ap.summary.positions;await ok('/api/rentals/1/drink',add);
    assert.equal((await rental(1)).drink_cents,300);
    const edit={version:5,action:'rental:edit',confirmation:'BUCHUNG ÄNDERN',started_at:r.started_at-1800000,ended_at:ended.ended_at,mode:'direct',value:9};
    assert.equal((await call('/api/rentals/1/edit',edit)).status,409);
    const ep=await ok('/api/rentals/1/preview',{edit:{started_at:edit.started_at,ended_at:edit.ended_at,hourly_cents:900}});edit.preview=ep;edit.checked=ep.summary.positions;await ok('/api/rentals/1/edit',edit);
    const p2=(await rental(1)).drink_positions.find(p=>p.cancelled_at===null),cancel={version:6,change:{kind:'cancel',operation_id:randomUUID(),position_id:p2.id,reason:'Verbraucht, Kulanz',returned:false}};
    const np=await ok('/api/rentals/1/preview',{change:cancel.change});cancel.preview=np;cancel.checked=np.summary.positions;await ok('/api/rentals/1/drink',cancel);assert.equal((await drink()).stock,9);
    const commentChange={version:7,comment:'Anna – geprüft'};
    assert.equal((await call('/api/rentals/1/comment',commentChange)).status,409);
    const commentPreview=await ok('/api/rentals/1/preview',{comment:commentChange.comment});commentChange.preview=commentPreview;commentChange.checked=commentPreview.summary.positions;
    await ok('/api/rentals/1/comment',commentChange);assert.equal((await call('/api/rentals/1/comment',commentChange)).status,200);
    // Parallel distinct requests from one version admit one booking only.
    const r2=await ok('/api/rentals',{table_no:2,settings_version:0,comment:'Parallel'}),c1=await change(1),c2=await change(1);
    assert.deepEqual((await Promise.all([call('/api/rentals/2/drink',{version:0,change:c1}),call('/api/rentals/2/drink',{version:0,change:c2})])).map(r=>r.status).sort(),[200,409]);
    const backup=await ok('/api/backups/export');assert.equal(backup.schema,16);assert.equal(backup.data.rental_checks.length,6);
    for(const mutate of [b=>{b.data.rental_drinks[0].rental_id=999;},b=>{b.data.rental_checks=[];},b=>{b.data.rentals[0].comment=' ';},b=>{b.data.rental_drinks.find(p=>p.returned===1).reversal_id=null;},b=>{const c=b.data.rental_checks.at(-1),s=JSON.parse(c.snapshot);s.drink_cents++;c.snapshot=JSON.stringify(s);}]) {
      const bad=structuredClone(backup);mutate(bad);resign(bad);assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);assert.deepEqual((await ok('/api/backups/export')).data,backup.data);
    }
    await ok('/api/backups/preview',{backup});await ok('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});await login();
    const restored=await ok('/api/backups/export');for(const table of ['rental_drinks','rental_checks','rental_operations','inventory_movements','rentals'])assert.deepEqual(restored.data[table],backup.data[table]);
    const target=await createApp({dbKey:randomUUID(),config});await new Promise(r=>target.listen(0,'127.0.0.1',r));
    try {
      const url='http://127.0.0.1:'+target.address().port;
      const loginResponse=await fetch(url+'/api/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({password:'password'})});
      const targetCookie=loginResponse.headers.get('set-cookie').split(';')[0],targetCsrf=(await loginResponse.json()).csrf;
      const request=async(path,body,headers={})=>{const response=await fetch(url+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:targetCookie,'X-CSRF-Token':targetCsrf,...headers},body:body?JSON.stringify(body):undefined});assert.equal(response.status,200);return response;};
      await request('/api/backups/preview',{backup});await request('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
      const freshLogin=await fetch(url+'/api/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({password:'password'})});
      const exported=await (await request('/api/backups/export',undefined,{Cookie:freshLogin.headers.get('set-cookie').split(';')[0]})).json();
      for(const table of Object.keys(backup.data).filter(t=>t!=='audit'))assert.deepEqual(exported.data[table],backup.data[table],table);
      assert.deepEqual(exported.data.audit.slice(0,-1),backup.data.audit);
    }finally{await new Promise(r=>target.close(r));}
    assert.equal((await rental(1)).drink_cents,0);assert.equal((await rental(r2.id)).drink_cents,300);
    const report=await ok('/api/inventory/report?from=2020-01-01&to=2030-12-31');assert.equal(report.drink_cents,0);assert.equal(report.open.length,1);assert.equal(report.rows[0].stock,8);assert.equal(report.rows[0].consumption,2);assert.equal(report.rows[0].purchase_cents,1000);assert.ok(report.corrections.length>=3);
    // Legacy active rentals require a comment before booking or finishing.
    db=await openTestDatabase(dbKey);await db.prepare('UPDATE rentals SET comment=NULL WHERE id=?').run(r2.id);
    assert.equal((await call('/api/rentals/2/preview',{})).status,400);assert.equal((await call('/api/rentals/2/drink',{version:1,change:await change(1)})).status,400);
    await ok('/api/rentals/2/comment',{version:1,comment:'Altbestand ergänzt'});
  }finally{if(db)await db.close();await new Promise(r=>server.close(r));}
});

test('FR-014: schema-15 migration preserves rentals and legacy backup receives empty drink/check tables',async()=>{
  const dbKey=randomUUID(),config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex')};
  const {openDatabase}=await import('./helpers/database.js');let db=await openDatabase({dbKey,config});
  await db.exec("INSERT INTO rentals(id,table_no,started_at,hourly_cents,base_cents) VALUES(1,1,1000,900,900);UPDATE entity_ids SET value=1 WHERE name='rentals';DROP TABLE rental_operations,rental_checks,rental_drinks;ALTER TABLE rentals DROP COLUMN comment;UPDATE _schema SET version=15;");
  await db.close();db=await openDatabase({dbKey,config});
  try{assert.equal((await db.prepare('SELECT version FROM _schema').get()).version,16);assert.equal((await db.prepare('SELECT * FROM rentals').get()).comment,null);assert.deepEqual(await db.prepare('SELECT * FROM rental_drinks').all(),[]);}finally{await db.close();}
});

test('FR-014.5: Berlin month/DST boundaries, receipt EK gaps and reversal booking dates',async()=>{
  assert.equal(new Date(berlinMidnight('2026-03-29')).toISOString(),'2026-03-28T23:00:00.000Z');
  assert.equal(new Date(berlinMidnight('2026-03-30')).toISOString(),'2026-03-29T22:00:00.000Z');
  assert.equal(new Date(berlinMidnight('2026-10-26')).toISOString(),'2026-10-25T23:00:00.000Z');
  assert.throws(()=>berlinMidnight('2026-02-30'));
  const snapshot=JSON.stringify({purchase_cents:null});
  const data={inventory_drinks:[{id:'d',name:'Wasser',minimum:3}],inventory_movements:[
    {id:1,drink_id:'d',kind:'receipt',quantity:10,created_at:'2026-10-31T22:59:59Z',snapshot:JSON.stringify({purchase_cents:100})},
    {id:2,drink_id:'d',kind:'receipt',quantity:5,created_at:'2026-10-31T23:00:00Z',snapshot},
    {id:3,drink_id:'d',kind:'consumption',quantity:-2,created_at:'2026-11-30T22:59:59Z',snapshot},
    {id:4,drink_id:'d',kind:'reversal',quantity:2,reverses:3,created_at:'2026-11-30T23:00:00Z',snapshot}
  ],rentals:[],rental_drinks:[],audit:[]};
  const db={prepare:sql=>({all:async()=>sql.includes('JOIN inventory_movements')?[]:data[Object.keys(data).find(k=>sql.includes('FROM '+k))]})};
  const november=await inventoryReport(db,'2026-11-01','2026-11-30');assert.equal(november.rows[0].receipts,5);assert.equal(november.rows[0].consumption,2);assert.equal(november.rows[0].unknown_purchase,5);assert.equal(november.rows[0].purchase_cents,0);assert.equal(november.rows[0].stock,15);
  const december=await inventoryReport(db,'2026-12-01','2026-12-31');assert.equal(december.rows[0].consumption,-2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,randomUUID,createHash} from 'node:crypto';
import {createApp,openDatabase} from './helpers/database.js';

test('FR-014.2: atomare Sammelbuchungen, Vorlagen, Inventur und vollständiger Restore',async()=>{
 const config={adminHash:'salt:'+scryptSync('batch-password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
 let server,base,cookie='',csrf='';
 const start=async dbKey=>{server=await createApp({dbKey,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;cookie='';csrf='';};
 const stop=()=>new Promise(r=>server.close(r));
 const call=async(path,data,headers={})=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 const login=async()=>{const r=await call('/api/login',{password:'batch-password'});assert.equal(r.status,200);cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
 const ok=async(path,body)=>{const r=await call(path,body);assert.ok(r.status<300,JSON.stringify(r.body));return r.body;};
 const post=body=>ok('/api/inventory',{operation_id:randomUUID(),...body});
 const state=()=>ok('/api/inventory');
 const exportBackup=()=>ok('/api/backups/export');
 const restore=backup=>call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
 const resign=b=>{b.checksum=createHash('sha256').update(JSON.stringify(b.data)).digest('hex');return b;};
 try{
  await start('batch-source');assert.equal((await call('/api/inventory/preview',{kind:'receipt',lines:[]})).status,401);await login();
  assert.equal((await call('/api/inventory/preview',{},{'X-CSRF-Token':'bad'})).status,403);
  const drinks=[];for(const name of ['Wasser','Cola'])drinks.push(await post({action:'drink',name,size_ml:500,sale_cents:250,purchase_cents:null,minimum:50,active:1}));
  const packs=[];for(const [i,d] of drinks.entries())packs.push(await post({action:'package',drink_id:d.id,version:0,name:i?'24er':'20er',bottles:i?24:20}));
  const current=async id=>(await state()).drinks.find(d=>d.id===id);
  await post({action:'movement',kind:'receipt',drink_id:drinks[1].id,version:(await current(drinks[1].id)).version,packages:0,singles:1});
  const legacy=await exportBackup();legacy.schema=14;delete legacy.data.rental_drinks;delete legacy.data.rental_checks;delete legacy.data.rental_operations;for(const r of legacy.data.rentals)delete r.comment;delete legacy.data.inventory_templates;delete legacy.data.inventory_batches;resign(legacy);
  const receiptLines=async()=>Promise.all(drinks.map(async(d,i)=>({drink_id:d.id,version:(await current(d.id)).version,package_id:packs[i].id,packages:i?1:2,singles:i?0:3,purchase_cents:i?null:60})));
  let lines=await receiptLines();const before=(await state()).drinks;
  const preview=await ok('/api/inventory/preview',{kind:'receipt',lines});assert.equal(preview.lines[0].quantity,43);assert.equal(preview.lines[1].quantity,24);
  assert.deepEqual((await state()).drinks,before);
  for(const change of [x=>x[1].singles=-1,x=>x[1].package_id=packs[0].id,x=>x[1].purchase_cents='',x=>x.push(x[0])]){const bad=structuredClone(lines);change(bad);assert.equal((await call('/api/inventory/preview',{kind:'receipt',lines:bad})).status,400);}
  const template=await post({action:'template',name:'Standardlieferung',lines});assert.equal(JSON.parse(template.lines)[1].purchase_cents,null);assert.deepEqual((await state()).drinks,before);
  assert.equal((await call('/api/inventory',{action:'batch',operation_id:randomUUID(),kind:'receipt',lines,preview:'forged'})).status,409);
  // A stale second row prevents the first row from being written.
  await post({action:'movement',kind:'receipt',drink_id:drinks[1].id,version:(await current(drinks[1].id)).version,packages:0,singles:1});
  assert.equal((await call('/api/inventory',{action:'batch',operation_id:randomUUID(),kind:'receipt',lines,preview:preview.token})).status,409);assert.equal((await current(drinks[0].id)).stock,0);
  lines=await receiptLines();const fresh=await ok('/api/inventory/preview',{kind:'receipt',lines});
  // Force a failure only after the first child movement has been written: all child writes must roll back.
  const blockedId=randomUUID(),blockedChild='batch-line-'+createHash('sha256').update(blockedId+':1').digest('hex').slice(0,40);
  await post({operation_id:blockedChild,action:'drink',name:'Isolierter Konfliktdatensatz',size_ml:500,sale_cents:0,purchase_cents:null,minimum:0,active:0});
  const atomicBefore=(await exportBackup()).data;
  assert.equal((await call('/api/inventory',{action:'batch',operation_id:blockedId,kind:'receipt',lines,preview:fresh.token})).status,409);
  assert.deepEqual((await exportBackup()).data,atomicBefore);
  const confirmed={action:'batch',operation_id:randomUUID(),kind:'receipt',lines,preview:fresh.token};
  const [a,b]=await Promise.all([call('/api/inventory',confirmed),call('/api/inventory',confirmed)]);assert.equal(a.status,200);assert.deepEqual(a.body,b.body);
  assert.equal((await current(drinks[0].id)).stock,43);assert.equal((await current(drinks[1].id)).stock,26);assert.equal((await state()).batches.length,1);
  assert.equal((await call('/api/inventory',{...confirmed,lines:[]})).status,409);
  const updated=await post({action:'template',id:template.id,version:0,name:'Lieferung neu',lines:await receiptLines()});assert.equal(updated.version,1);
  assert.equal((await call('/api/inventory',{action:'template',operation_id:randomUUID(),id:template.id,version:0,name:'Veraltet',lines:await receiptLines()})).status,409);
  const countLines=async()=>Promise.all(drinks.map(async(d,i)=>({drink_id:d.id,version:(await current(d.id)).version,counted:i?(await current(d.id)).stock:40,reason:i?'':'Drei Flaschen Inventurdifferenz'})));
  let counted=await countLines();const invalid=structuredClone(counted);invalid[0].reason='  ';assert.equal((await call('/api/inventory/preview',{kind:'inventory',lines:invalid})).status,400);
  const countPreview=await ok('/api/inventory/preview',{kind:'inventory',lines:counted});assert.equal(countPreview.lines[0].quantity,-3);assert.equal(countPreview.lines[1].quantity,0);
  await post({action:'movement',kind:'receipt',drink_id:drinks[1].id,version:(await current(drinks[1].id)).version,packages:0,singles:1});
  assert.equal((await call('/api/inventory',{action:'batch',operation_id:randomUUID(),kind:'inventory',lines:counted,preview:countPreview.token})).status,409);assert.equal((await current(drinks[0].id)).stock,43);
  counted=await countLines();const countFresh=await ok('/api/inventory/preview',{kind:'inventory',lines:counted});
  const countBody={action:'batch',operation_id:randomUUID(),kind:'inventory',lines:counted,preview:countFresh.token};
  const countResult=await post(countBody);assert.equal(JSON.parse(countResult.lines)[1].movement_id,null);assert.equal((await current(drinks[0].id)).stock,40);
  assert.deepEqual((await post(countBody)),countResult);
  const toArchive=await current(drinks[1].id);await post({...toArchive,action:'drink',active:0});
  const staleTemplateLines=JSON.parse(updated.lines).map(l=>({...l,version:0}));for(const l of staleTemplateLines)l.version=(await current(l.drink_id)).version;
  assert.equal((await call('/api/inventory/preview',{kind:'receipt',lines:staleTemplateLines})).status,409);
  assert.ok((await ok('/api/inventory/preview',{kind:'receipt',lines:staleTemplateLines.slice(0,1)})).token);
  const backup=await exportBackup();await stop();await start('batch-target');await login();const untouched=(await exportBackup()).data;
  for(const mutate of [
   b=>{const t=b.data.inventory_templates[0];const x=JSON.parse(t.lines);x[0].drink_id='missing';t.lines=JSON.stringify(x);},
   b=>{const t=b.data.inventory_templates[0];const x=JSON.parse(t.lines);x[0].purchase_cents='';t.lines=JSON.stringify(x);},
   b=>{const t=b.data.inventory_batches[0];const x=JSON.parse(t.lines);x[0].quantity++;t.lines=JSON.stringify(x);},
   b=>{const t=b.data.inventory_batches[0];const x=JSON.parse(t.lines);x[0].movement_id=999999;t.lines=JSON.stringify(x);},
   b=>{const t=b.data.inventory_batches[0];const x=JSON.parse(t.lines);x[0].last_movement_id=999999;t.lines=JSON.stringify(x);}
  ]){const bad=structuredClone(backup);mutate(bad);for(const batch of bad.data.inventory_batches)bad.data.inventory_operations.find(o=>o.id===batch.id).result=JSON.stringify(batch);resign(bad);assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);assert.equal((await restore(bad)).status,400);assert.deepEqual((await exportBackup()).data,untouched);}
  assert.equal((await call('/api/backups/preview',{backup})).status,200);assert.equal((await restore(backup)).status,200);await login();
  const restored=(await exportBackup()).data;for(const table of Object.keys(backup.data))if(table!=='audit')assert.deepEqual(restored[table],backup.data[table]);
  assert.deepEqual((await post(confirmed)),a.body); // Replay survives restore and new preview-signing key.
  assert.equal((await call('/api/backups/preview',{backup:legacy})).status,200);assert.equal((await restore(legacy)).status,200);await login();
  const old=await state();assert.equal(old.templates.length,0);assert.equal(old.batches.length,0);assert.equal(old.drinks.find(d=>d.id===drinks[1].id).stock,1);
 }finally{if(server?.listening)await stop();}
});

test('FR-014.2: PostgreSQL 14 migriert auf 15 ohne bestehende Lagerdaten zu ändern',async()=>{
 const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex')};let db=await openDatabase({dbKey:'batch-upgrade',config});
 await db.exec("INSERT INTO inventory_drinks VALUES('existing','Bestand',500,250,NULL,10,1,0);DROP TABLE rental_operations,rental_checks,rental_drinks;ALTER TABLE rentals DROP COLUMN comment;DROP TABLE inventory_batches,inventory_templates;UPDATE _schema SET version=14;");
 await db.close();db=await openDatabase({dbKey:'batch-upgrade',config});
 try{assert.equal((await db.prepare('SELECT version FROM _schema').get()).version,16);assert.equal((await db.prepare('SELECT name FROM inventory_drinks').get()).name,'Bestand');assert.deepEqual(await db.prepare('SELECT * FROM inventory_templates').all(),[]);}finally{await db.close();}
});

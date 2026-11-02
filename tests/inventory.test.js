import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,randomUUID,createHash} from 'node:crypto';
import {createApp,openDatabase} from './helpers/database.js';

test('FR-014.1: Lager, Parallelzugriff, Historie, Rechte und vollständiger Restore',async()=>{
  const config={adminHash:'salt:'+scryptSync('inventory-password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let server,base,cookie='',csrf='';
  const start=async dbKey=>{server=await createApp({dbKey,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;cookie='';csrf='';};
  const stop=()=>new Promise(r=>server.close(r));
  const call=async(path,data,headers={})=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
  const login=async()=>{const r=await call('/api/login',{password:'inventory-password'});assert.equal(r.status,200);cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
  const post=(body,headers)=>call('/api/inventory',{operation_id:randomUUID(),...body},headers);
  const state=async()=>(await call('/api/inventory')).body;
  const resign=b=>{b.checksum=createHash('sha256').update(JSON.stringify(b.data)).digest('hex');return b;};
  const restore=backup=>call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
  try {
    await start('inventory-source');
    assert.equal((await call('/api/inventory')).status,401);
    assert.equal((await post({action:'drink'})).status,401);await login();
    const input={action:'drink',name:'Mineralwasser',size_ml:500,sale_cents:250,purchase_cents:null,minimum:10,active:1};
    for(const change of [{sale_cents:undefined},{sale_cents:null},{sale_cents:1.5},{purchase_cents:''},{minimum:-1},{size_ml:0},{name:'  '}])assert.equal((await post({...input,...change})).status,400);
    assert.equal((await post(input,{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await post(input,{Origin:'https://evil.invalid'})).status,403);
    const create={...input,operation_id:randomUUID()};
    const d=(await post(create)).body;assert.ok(d.id);
    assert.deepEqual((await post(create)).body,d);
    assert.equal((await post({...create,name:'Anders'})).status,409);
    let version=0;
    const pack=(await post({action:'package',drink_id:d.id,version:version++,name:'20er-Kasten',bottles:20})).body;
    const pack24=(await post({action:'package',drink_id:d.id,version:version++,name:'24er-Kasten',bottles:24})).body;
    assert.equal(pack24.bottles,24);
    const move=(extra={})=>({action:'movement',drink_id:d.id,version,kind:'receipt',packages:0,singles:1,...extra});
    for(const change of [{singles:0},{singles:-1},{singles:1.1},{singles:'2'},{singles:null},{singles:Number.MAX_SAFE_INTEGER},{packages:1},{kind:'breakage',reason:''}])assert.equal((await post(move(change))).status,400);
    const initial={...move({kind:'initial',packages:2,package_id:pack.id,singles:3}),operation_id:randomUUID()};
    const [first,repeated]=await Promise.all([post(initial),post(initial)]);assert.equal(first.status,200);assert.deepEqual(repeated.body,first.body);version++;
    assert.equal((await state()).drinks[0].stock,43);
    assert.deepEqual((await post(initial)).body,first.body);
    assert.equal((await post(move({kind:'initial'}))).status,409);
    const concurrent=await Promise.all([post(move({kind:'consumption',singles:2})),post(move({kind:'consumption',singles:2}))]);
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);version++;
    assert.equal((await state()).drinks[0].stock,41);
    assert.equal((await post(move({kind:'consumption',singles:42}))).status,409);
    // Historical package/name/prices remain unchanged after editing master data.
    assert.equal((await post({action:'package',id:pack.id,drink_id:d.id,version:version++,name:'18er-Kasten',bottles:18})).status,200);
    assert.equal((await post({...input,id:d.id,version:version++,name:'Neuer Name',sale_cents:300,purchase_cents:90})).status,200);
    const old=JSON.parse((await state()).movements.find(m=>m.id===first.body.id).snapshot);
    assert.equal(old.bottles,20);assert.equal(old.name,'Mineralwasser');assert.equal(old.sale_cents,250);assert.equal(old.purchase_cents,null);
    assert.equal((await post(move({kind:'adjustment',direction:-1,singles:1,reason:'Gezählt'}))).status,200);version++;
    const broken=await post(move({kind:'breakage',singles:1,reason:'Flasche zerbrochen'}));assert.equal(broken.status,200);version++;
    assert.equal((await post(move({kind:'own_use',singles:1,reason:'Vereinsabend'}))).status,200);version++;
    assert.equal((await post(move({kind:'reversal',reverses:first.body.id,reason:'Fehler'}))).status,409); // Already consumed stock.
    assert.equal((await post({...input,id:d.id,version:version++,active:0})).status,200);
    assert.equal((await post(move())).status,409);
    const reversal=await post(move({kind:'reversal',reverses:broken.body.id,reason:'Fehlerhafte Bruchmeldung'}));assert.equal(reversal.status,200);version++;
    assert.equal((await post(move({kind:'reversal',reverses:broken.body.id,reason:'Nochmals'}))).status,409);
    assert.equal((await post(move({kind:'reversal',reverses:reversal.body.id,reason:'Nochmals'}))).status,409);
    // A tablet token grants no inventory access.
    await call('/api/events',{name:'Rechte',kind:'Liga',date:'2026-11-02'});await call('/api/events/1/start',{version:0});
    await call('/api/matches',{event_id:1,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:1,pin:'012345'});
    await call('/api/matches/1/start',{table_no:1,version:0,lag_winner:'a',first:'a'});
    const tablet=await call('/api/tables/1/login',{pin:'012345'},{Cookie:''});assert.equal(tablet.status,200);
    assert.equal((await call('/api/inventory',undefined,{Cookie:'',Authorization:'Bearer '+tablet.body.token})).status,401);
    assert.equal((await post(input,{Cookie:'',Authorization:'Bearer '+tablet.body.token})).status,401);
    const backup=(await call('/api/backups/export')).body;
    await stop();await start('inventory-target');await login();
    const before=(await call('/api/backups/export')).body.data;
    for(const mutate of [b=>b.data.inventory_movements[0].quantity=-43,b=>b.data.inventory_movements[0].snapshot='{}',b=>b.data.inventory_movements[0].drink_id='missing',b=>b.data.inventory_drinks[0].sale_cents=-1,b=>b.data.inventory_movements.at(-1).reverses=99999,b=>b.data.inventory_movements[0].operation_id='missing']){
      const bad=structuredClone(backup);mutate(bad);resign(bad);
      assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
      assert.equal((await restore(bad)).status,400);
      assert.deepEqual((await call('/api/backups/export')).body.data,before);
    }
    assert.equal((await call('/api/backups/preview',{backup})).status,200);assert.equal((await restore(backup)).status,200);await login();
    const actual=(await call('/api/backups/export')).body.data;
    for(const table of Object.keys(backup.data))if(table!=='audit')assert.deepEqual(actual[table],backup.data[table]);
    assert.deepEqual(actual.audit.slice(0,-1),backup.data.audit);
    assert.deepEqual((await post(initial)).body,first.body); // Idempotency survives restore.
    const legacy=structuredClone(backup);legacy.schema=13;
    for(const key of Object.keys(legacy.data))if(key.startsWith('inventory_'))delete legacy.data[key];resign(legacy);
    assert.equal((await call('/api/backups/preview',{backup:legacy})).status,200);assert.equal((await restore(legacy)).status,200);await login();
    assert.deepEqual((await state()).drinks,[]);assert.deepEqual((await state()).movements,[]);
  } finally {if(server?.listening)await stop();}
});

test('FR-014.1: Schema-13-Upgrade erhält Vereinsdaten und startet mit leerem Lager',async()=>{
  const key='inventory-migration',config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex')};
  let db=await openDatabase({dbKey:key,config});
  await db.exec("UPDATE branding SET club_name='Bestandsverein';DROP TABLE inventory_batches,inventory_templates,inventory_movements,inventory_packages,inventory_operations,inventory_drinks;UPDATE _schema SET version=13;");
  await db.close();db=await openDatabase({dbKey:key,config});
  try {assert.equal((await db.prepare('SELECT version FROM _schema').get()).version,15);assert.equal((await db.prepare('SELECT club_name FROM branding').get()).club_name,'Bestandsverein');assert.deepEqual(await db.prepare('SELECT * FROM inventory_drinks').all(),[]);}finally{await db.close();}
});

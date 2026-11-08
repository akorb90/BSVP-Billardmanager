import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {createApp} from './helpers/database.js';

test('AP3: semantic import validation rejects each inconsistent field atomically and preserves valid and legacy backups',async t=>{
  const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let server,base,cookie='',csrf='';
  const stop=()=>new Promise(r=>server.close(r));
  t.after(async()=>{if(server?.listening)await stop();});
  async function start(){server=await createApp({config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;cookie='';csrf='';await login();}
  async function call(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
  async function ok(path,body){const r=await call(path,body);assert.ok([200,201].includes(r.status),path+': '+JSON.stringify(r.data));return r.data;}
  async function login(){const r=await call('/api/login',{password:'password'});assert.equal(r.status,200);cookie=r.cookie.split(';')[0];csrf=r.data.csrf;}
  const restore=backup=>call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
  const resign=b=>{b.checksum=createHash('sha256').update(JSON.stringify(b.data)).digest('hex');return b;};
  await start();
  await ok('/api/events',{name:'Source',kind:'Liga',date:'2026-11-01'});await ok('/api/events/1/start',{version:0});
  await ok('/api/matches',{event_id:1,player_a:'A',player_b:'B',discipline:'9-Ball',target:3,pin:'123456'});
  await ok('/api/matches/1/start',{version:0,table_no:1});
  for(const [table,mode,value] of [[2,'percent',12.34],[3,'direct',12.34],[4,'percent',-100]]) {
    const rental=await ok('/api/rentals',{comment:'Testvermietung',table_no:table,settings_version:0,mode,value});
    const preview=await ok(`/api/rentals/${rental.id}/preview`,{ended_at:rental.started_at});
    const ended=await ok(`/api/rentals/${rental.id}/finish`,{version:0,ended_at:rental.started_at,action:'rental:finish',preview,checked:['rent']});
    if(table!==4)await ok(`/api/rentals/${rental.id}/edit`,{version:ended.version,started_at:rental.started_at-60001,ended_at:rental.started_at,mode,value,action:'rental:edit',confirmation:'BUCHUNG ÄNDERN'});
  }
  await ok('/api/rentals',{comment:'Testvermietung',table_no:5,settings_version:0,discount:20});
  const backup=await ok('/api/backups/export');
  await stop();await start();
  await ok('/api/events',{name:'Target must remain',kind:'Liga',date:'2026-11-01'});
  const before=(await ok('/api/backups/export')).data;
  const finished=b=>b.data.rentals.find(r=>r.status==='finished'&&r.adjustment_percent===12.34);
  const active=b=>b.data.rentals.find(r=>r.status==='active');
  const changes=[
    ['missing finish time',b=>finished(b).ended_at=null],
    ['end before start',b=>finished(b).ended_at=finished(b).started_at-1],
    ...['duration_ms','billed_minutes','total_cents'].flatMap(key=>[
      ['negative '+key,b=>finished(b)[key]=-1],
      ['mismatching '+key,b=>finished(b)[key]++],
      ['missing '+key,b=>finished(b)[key]=null]
    ]),
    ...['ended_at','duration_ms','billed_minutes','total_cents'].map(key=>['active has '+key,b=>active(b)[key]=key==='ended_at'?active(b).started_at:0]),
    ['negative start',b=>active(b).started_at=-1],
    ['excessive base rate',b=>active(b).base_cents=1000001],
    ['excessive hourly rate',b=>active(b).hourly_cents=1000001],
    ['negative hourly rate',b=>active(b).hourly_cents=-1],
    ['mismatching percentage rate',b=>active(b).hourly_cents++],
    ['invalid percentage',b=>active(b).adjustment_percent=-101],
    ['excessive percentage',b=>active(b).adjustment_percent=1001],
    ['percentage precision',b=>active(b).adjustment_percent=12.345],
    ...['','invalid','salt:abcd','salt:'+ 'g'.repeat(128),'salt:'+ 'a'.repeat(128)+':extra',':'+ 'a'.repeat(128)].map(value=>['invalid PIN hash '+value.slice(0,12),b=>b.data.matches[0].pin_hash=value]),
    ['invalid admin hash',b=>b.data.admin_credentials[0].password_hash='invalid']
  ];
  for(const [name,change] of changes)await t.test(name,async()=>{
    const invalid=structuredClone(backup);change(invalid);resign(invalid);
    assert.equal((await call('/api/backups/preview',{backup:invalid})).status,400);
    assert.equal((await restore(invalid)).status,400);
    assert.deepEqual((await ok('/api/backups/export')).data,before,'preview and restore preserve every target table');
    assert.deepEqual(backup.data.matches[0].pin_hash.includes(':'),true,'source backup is not repaired in place');
  });
  assert.equal((await call('/api/backups/preview',{backup})).status,200);
  assert.deepEqual((await ok('/api/backups/export')).data,before,'valid preview also rolls back');
  assert.equal((await restore(backup)).status,200);await login();
  const imported=(await ok('/api/backups/export')).data;
  for(const table of Object.keys(backup.data))if(table!=='audit')assert.deepEqual(imported[table],backup.data[table]);
  assert.equal((await call('/api/tables/1/login',{pin:'123456'})).status,200,'valid imported PIN still authenticates');
  const legacy=resign(structuredClone(backup));legacy.schema=6;delete legacy.data.rental_drinks;delete legacy.data.rental_checks;delete legacy.data.rental_operations;for(const r of legacy.data.rentals)delete r.comment;for(const key of Object.keys(legacy.data))if(key.startsWith("inventory_"))delete legacy.data[key];legacy.data.matches[0].pin_hash=null;
  for(const table of ['branding','table_settings','players','teams','team_players','event_players','event_teams','nuliga_entities','nuliga_sync','event_planning','nuliga_schedule_sync','event_match_slots'])delete legacy.data[table];
  for(const m of legacy.data.matches)for(const key of ['player_a_id','player_b_id','team_a_id','team_b_id','team_a_name','team_b_name'])delete m[key];
  resign(legacy);
  assert.equal((await call('/api/backups/preview',{backup:legacy})).status,200);
  assert.equal((await restore(legacy)).status,200);await login();
  const legacyImported=(await ok('/api/backups/export')).data;
  assert.equal(legacyImported.matches[0].pin_hash,null);
  assert.deepEqual(legacyImported.rentals,backup.data.rentals.map(r=>({...r,comment:null})));
  assert.equal((await call('/api/tables/1/login',{pin:'123456'})).status,401,'legacy null means no PIN instead of a server error');
});

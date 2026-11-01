import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {createApp} from '../src/server.js';

async function fixture(t) {
  const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  const server=await createApp({dbPath:':memory:',config});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
  async function call(path,body) {
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:body?JSON.stringify(body):undefined});
    const data=await response.json();
    if(path==='/api/login'){cookie=response.headers.get('set-cookie').split(';')[0];csrf=data.csrf;}
    return {status:response.status,data};
  }
  async function ok(path,body){const r=await call(path,body);assert.ok([200,201].includes(r.status),path+': '+JSON.stringify(r.data));return r.data;}
  const state=()=>ok('/api/admin');
  await ok('/api/login',{password:'password'});
  const ids=[];for(let i=0;i<6;i++)ids.push((await ok('/api/players',{first_name:'Player',last_name:String(i)})).id);
  const home=(await ok('/api/teams',{name:'Home',player_ids:ids.slice(0,3)})).id;
  const away=(await ok('/api/teams',{name:'Away',player_ids:ids.slice(3)})).id;
  async function prepare(type,a=ids[1],b=ids[5]) {
    const event=(await ok('/api/events',{name:type,kind:type==='tournament'?'Turnier':'Liga',date:'2026-11-01'})).id;
    let id;
    if(type==='tournament') {
      await ok(`/api/events/${event}/tournament/preview`,{version:0,mode:'ko',discipline:'9-Ball',target:1,rules:'difference',player_ids:[a,b]});
      await ok(`/api/events/${event}/tournament/confirm`,{version:1,pin:'123456'});
      id=(await state()).matches.find(m=>m.event_id===event).id;
    } else {
      await ok(`/api/events/${event}/start`,{version:0});
      await ok(`/api/events/${event}/participants`,{version:1,team_ids:[home,away],player_ids:ids,assignments:Object.fromEntries(ids.map((id,i)=>[id,i<3?home:away]))});
      if(type==='manual')id=(await ok('/api/matches',{event_id:event,player_a_id:a,player_b_id:b,discipline:'9-Ball',target:1,pin:'123456'})).id;
    }
    return {
      event,
      async match(){return (await state()).matches.find(m=>m.id===id);},
      async start(table) {
        if(type==='single'||type==='double') {
          const r=await call(`/api/events/${event}/slots/${type==='double'?5:1}`,{version:0,player_a_id:type==='double'?ids[0]:a,player_b_id:type==='double'?ids[3]:b,...(type==='double'?{player_a2_id:ids[1],player_b2_id:ids[4]}:{}),table_no:table,target:1,start:true,pin:'123456'});
          if(r.status===200)id=r.data.match_id;return r;
        }
        return call(`/api/matches/${id}/start`,{version:0,table_no:table});
      }
    };
  }
  async function edit(match,changes) {
    const snapshot=await state();
    return call(`/api/matches/${match.id}/edit`,{...match,...changes,event_version:snapshot.events.find(e=>e.id===match.event_id).version,action:'match:edit',confirmation:'SPIEL ÄNDERN'});
  }
  return {ids,prepare,state,edit};
}

test('AP2: manual, league singles/doubles and tournaments share occupancy checks in both directions',async t=>{
  for(const first of ['manual','single','double','tournament'])for(const second of ['manual','single','double','tournament'])await t.test(first+' blocks '+second,async t=>{
    const f=await fixture(t),a=await f.prepare(first),b=await f.prepare(second);
    assert.equal((await a.start(1)).status,200);
    assert.equal((await b.start(2)).status,409);
    assert.equal((await f.state()).matches.filter(m=>m.status==='live').length,1);
  });
});

test('AP2: edits protect live participants and reactivation, but allow free players and historical corrections',async t=>{
  const f=await fixture(t),blocker=await f.prepare('manual'),free=await f.prepare('manual',f.ids[0],f.ids[3]);
  assert.equal((await blocker.start(1)).status,200);assert.equal((await free.start(2)).status,200);
  let m=await free.match();
  assert.equal((await f.edit(m,{player_a_id:f.ids[1]})).status,409);
  assert.equal((await free.match()).version,m.version);assert.equal((await free.match()).player_a_id,f.ids[0]);
  assert.equal((await f.edit(m,{player_a:'Corrected display name'})).status,200,'a match does not conflict with itself');
  const planned=await f.prepare('manual');m=await planned.match();
  assert.equal((await f.edit(m,{status:'live',table_no:3})).status,409,'planned-to-live edit is protected');
  assert.equal((await planned.match()).status,'planned');
  assert.equal((await f.edit(m,{status:'finished',a:1,b:0})).status,200,'historical results do not reserve players');
  m=await planned.match();
  assert.equal((await f.edit(m,{player_a:'Historical correction'})).status,200);
  m=await planned.match();assert.equal((await f.edit(m,{status:'live',table_no:3})).status,409,'finished-to-live edit is protected');
});

test('AP2: reactivating a double includes its secondary partners',async t=>{
  const f=await fixture(t),double=await f.prepare('double');assert.equal((await double.start(1)).status,200);
  assert.equal((await f.edit(await double.match(),{status:'finished',a:1,b:0})).status,200);
  const blocker=await f.prepare('manual');assert.equal((await blocker.start(2)).status,200);
  assert.equal((await f.edit(await double.match(),{status:'live',table_no:3})).status,409);
  assert.equal((await double.match()).status,'finished');
});

test('AP2: simultaneous starts on different tables admit only one shared participant',async t=>{
  const f=await fixture(t),a=await f.prepare('manual'),b=await f.prepare('double');
  const results=await Promise.all([a.start(1),b.start(2)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await f.state()).matches.filter(m=>m.status==='live').length,1);
});

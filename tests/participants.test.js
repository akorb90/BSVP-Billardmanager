import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';

test('FR-007-Fix: atomic start, event-only guests, lineup, restart and complete separate restore',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'participants-')),config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('k'.repeat(40))};
  let server,base,cookie,csrf;
  const call=async(path,data)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie||'','X-CSRF-Token':csrf||''},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
  const ok=async(path,data)=>{const r=await call(path,data);assert.ok([200,201].includes(r.status),JSON.stringify(r.body));return r.body;};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
  const start=async file=>{server=await createApp({dbPath:join(dir,file),config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;await login();};
  try{
    await start('source.sqlite');
    const p=(await ok('/api/players',{first_name:'Anna',last_name:'Heim'})).id;
    const home=(await ok('/api/teams',{name:'Heim',player_ids:[p]})).id,away=(await ok('/api/teams',{name:'Gast',player_ids:[]})).id;
    const event=(await ok('/api/events',{name:'Liga',kind:'Liga',date:'2026-10-28'})).id;
    const payload={version:0,start:true,team_ids:[home,away],player_ids:[p],assignments:{[p]:home},guests:[{team_id:away,name:'Ben Ersatz'}]};
    assert.equal((await call('/api/events/'+event+'/participants',{...payload,guests:[...payload.guests,{team_id:'missing',name:'Rollback Test'}]})).status,400);
    let state=await ok('/api/admin');assert.equal(state.players.length,1);assert.equal(state.events[0].phase,'planned');
    await ok('/api/events/'+event+'/participants',payload);
    assert.equal((await call('/api/events/'+event+'/participants',payload)).status,409);
    state=await ok('/api/admin');const guest=state.players.find(p=>p.event_id===event);
    assert.ok(guest);assert.equal(state.players.length,2);assert.equal(state.event_match_slots.length,10);assert.equal(state.matches.length,0);
    assert.equal(state.event_players.find(p=>p.player_id===guest.id).team_id,away);
    assert.equal((await call('/api/teams',{name:'Cannot adopt',player_ids:[guest.id]})).status,400);
    const other=(await ok('/api/events',{name:'Anderer Spieltag',kind:'Liga',date:'2026-10-29'})).id;
    assert.equal((await call('/api/events/'+other+'/participants',{...payload,guests:[],player_ids:[guest.id],assignments:{[guest.id]:away}})).status,400);
    await ok('/api/events/'+event+'/slots/1',{version:0,player_a_id:p,player_b_id:guest.id,table_no:2,target:3,start:true,pin:'012345'});
    state=await ok('/api/admin');assert.equal(state.matches[0].player_b,'Ben Ersatz');assert.equal(state.matches[0].table_no,2);
    const backup=await ok('/api/backups/export');
    const bad=structuredClone(backup);bad.data.players.find(p=>p.id===guest.id).event_id=other;bad.checksum=createHash('sha256').update(JSON.stringify(bad.data)).digest('hex');
    assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
    await new Promise(r=>server.close(r));await start('source.sqlite');assert.equal((await ok('/api/admin')).players.find(p=>p.id===guest.id).event_id,event);
    await new Promise(r=>server.close(r));await start('restore.sqlite');
    await ok('/api/backups/preview',{backup});await ok('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});await login();
    const restored=await ok('/api/backups/export');for(const table of Object.keys(backup.data))if(table!=='audit')assert.deepEqual(restored.data[table],backup.data[table]);
    const old=structuredClone(backup);old.schema=12;old.data.players.forEach(p=>delete p.event_id);old.checksum=createHash('sha256').update(JSON.stringify(old.data)).digest('hex');await ok('/api/backups/preview',{backup:old});
  }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true,maxRetries:5});}
});

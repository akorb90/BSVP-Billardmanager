import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';
import {drawTournament,makeBracket,standings,validateOptions} from '../src/tournaments.js';

const people=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'Spieler '+i}));
const options={mode:'groups-ko',discipline:'9-Ball',target:1,groupCount:2,qualifiers:1,rules:'difference'};
test('FR-006: complete round robin, balanced random groups, unique KO seeds and explicit byes for 2–64 players',()=>{
  for(let n=2;n<=64;n++){
    const rounds=makeBracket(people(n).map(p=>p.id)),size=2**Math.ceil(Math.log2(n));
    assert.equal(rounds.length,Math.log2(size));
    assert.equal(new Set(rounds[0].flatMap(g=>[g.a,g.b]).filter(Boolean)).size,n);
    assert.equal(rounds[0].filter(g=>!g.b).length,size-n);
    const t=drawTournament({...options,groupCount:Math.min(3,Math.floor(n/2)),mode:'groups'},people(n));
    assert.equal(new Set(t.groups.flatMap(g=>g.players)).size,n);
    assert.ok(Math.max(...t.groups.map(g=>g.players.length))-Math.min(...t.groups.map(g=>g.players.length))<=1);
    for(const g of t.groups)assert.equal(new Set(g.games.map(m=>[m.a,m.b].sort().join('/'))).size,g.players.length*(g.players.length-1)/2);
  }
  assert.throws(()=>validateOptions({...options,players:people(3)}),/zwei Teilnehmer/);
  assert.throws(()=>validateOptions({...options,groupCount:1,qualifiers:4,players:people(3)}),/Qualifikanten/);
});

test('FR-006: groups, ties, qualification, tablet, correction locks, restart and separate complete backup restore',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'tournaments-')),config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('k'.repeat(40))};
  let server,base,cookie,csrf;
  const call=async(path,data,auth={})=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie||'','X-CSRF-Token':csrf||'',...auth},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
  const ok=async(path,data,auth)=>{const r=await call(path,data,auth);assert.ok([200,201].includes(r.status),path+': '+JSON.stringify(r.body));return r.body;};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
  const start=async file=>{server=await createApp({dbPath:join(dir,file),config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;await login();};
  const state=()=>ok('/api/admin');
  const event=async id=>(await state()).events.find(e=>e.id===id);
  const action=async(id,action,data={})=>ok('/api/events/'+id+'/tournament/'+action,{version:(await event(id)).version,...data});
  const match=async id=>(await state()).matches.find(m=>m.id===id);
  async function finish(id,side='a',tablet=false){
    let m=await match(id);await ok('/api/matches/'+id+'/start',{version:m.version,table_no:1});m=await match(id);
    let auth;
    if(tablet){const result=await ok('/api/tables/1/login',{pin:'123456'},{Cookie:''});auth={Cookie:'',Authorization:'Bearer '+result.token};}
    await ok('/api/matches/'+id+'/begin',{version:m.version,lag_winner:'a',first:'a'},auth);m=await match(id);
    await ok('/api/matches/'+id+'/score',{version:m.version,side,delta:1},auth);m=await match(id);
    await ok('/api/matches/'+id+'/finish',{version:m.version,action:'match:finish',confirmation:'SPIEL ABSCHLIESSEN'},auth);
  }
  try{
    await start('source.sqlite');const ids=[];
    for(let i=0;i<6;i++)ids.push((await ok('/api/players',{first_name:'Spieler',last_name:String(i)})).id);
    const id=(await ok('/api/events',{name:'Gruppen und KO',kind:'Turnier',date:'2026-10-29'})).id;
    const data={...options,player_ids:ids};
    assert.equal((await call('/api/events/'+id+'/tournament/preview',{...data,version:0,player_ids:[ids[0],ids[0]]})).status,400);
    await action(id,'preview',data);assert.equal((await state()).matches.length,0);
    const preview=(await event(id)).tournamentPreview;assert.equal(preview.groups.length,2);
    const backupPreview=await ok('/api/backups/export');await ok('/api/backups/preview',{backup:backupPreview});
    await action(id,'confirm',{pin:'123456'});
    assert.equal((await state()).matches.length,6);
    assert.deepEqual((await event(id)).tournament.groups.map(g=>g.players),preview.groups.map(g=>g.players));
    assert.equal((await call('/api/events/'+id+'/participants',{version:(await event(id)).version,player_ids:ids,team_ids:[]})).status,409);
    assert.equal((await call('/api/events/'+id+'/close',{version:(await event(id)).version,action:'event:close',confirmation:'EVENT ABSCHLIESSEN'})).status,409);
    const groups=(await event(id)).tournament.groups;
    for(const g of groups)for(let i=0;i<g.games.length;i++)await finish(g.games[i].match,i===1?'b':'a',i===0);
    let t=(await event(id)).tournament;
    assert.ok(t.tables.every(s=>s.complete&&s.tied));assert.equal(t.rounds.length,0);
    assert.equal((await call('/api/events/'+id+'/tournament/preview',{...data,version:(await event(id)).version})).status,409);
    assert.equal((await call('/api/events/'+id+'/tournament/resolve',{version:(await event(id)).version,group:0,order:Array(3).fill(ids[0]),reason:'Test'})).status,400);
    for(let i=0;i<2;i++)await action(id,'resolve',{group:i,order:groups[i].players,reason:'Entscheidungsspiel der punktgleichen Teilnehmer'});
    t=(await event(id)).tournament;assert.equal(t.rounds.length,1);assert.ok(t.rounds[0][0].match);
    const previous=await match(groups[0].games[0].match);
    assert.equal((await call('/api/matches/'+previous.id+'/edit',{...previous,event_version:(await event(id)).version,a:0,b:1,action:'match:edit',confirmation:'SPIEL ÄNDERN'})).status,409);
    await finish(t.rounds[0][0].match);
    t=(await event(id)).tournament;assert.ok(t.complete);assert.equal(t.champion,groups[0].players[0]);
    const backup=await ok('/api/backups/export');await ok('/api/backups/preview',{backup});
    for(const corrupt of [t=>t.rounds[0][0].a=ids[5],t=>t.groups[0].games.pop(),t=>t.resolutions[0].order=[ids[0]],t=>t.champion='missing']){
      const bad=structuredClone(backup),p=bad.data.event_planning.find(p=>p.event_id===id),meta=JSON.parse(p.metadata);corrupt(meta.tournament);p.metadata=JSON.stringify(meta);bad.checksum=createHash('sha256').update(JSON.stringify(bad.data)).digest('hex');assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
    }
    await new Promise(r=>server.close(r));await start('source.sqlite');assert.deepEqual((await event(id)).tournament,t);
    await new Promise(r=>server.close(r));await start('restore.sqlite');
    await ok('/api/backups/preview',{backup});await ok('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});await login();
    const restored=await ok('/api/backups/export');for(const table of Object.keys(backup.data))if(table!=='audit')assert.deepEqual(restored.data[table],backup.data[table]);
    await ok('/api/events/'+id+'/close',{version:(await event(id)).version,action:'event:close',confirmation:'EVENT ABSCHLIESSEN'});
    // Pure KO: persist preview with byes, redraw before play, then advance every round.
    const ko=(await ok('/api/events',{name:'KO mit Freilos',kind:'Turnier',date:'2026-10-29'})).id;
    await action(ko,'preview',{...options,mode:'ko',player_ids:ids.slice(0,5)});
    await ok('/api/backups/preview',{backup:await ok('/api/backups/export')});
    await action(ko,'confirm',{pin:'123456'});
    const accepted=(await event(ko)).tournament;
    await action(ko,'preview',{...options,mode:'ko',player_ids:ids.slice(0,3)});
    assert.deepEqual((await event(ko)).tournament,accepted);
    await action(ko,'confirm',{pin:'123456'});
    assert.equal((await state()).matches.filter(m=>m.event_id===ko).length,1);
    while(!(await event(ko)).tournament.complete){const next=(await state()).matches.find(m=>m.event_id===ko&&m.status==='planned');assert.ok(next);await finish(next.id);}
    assert.equal((await state()).matches.filter(m=>m.event_id===ko).length,2);
    await ok('/api/backups/preview',{backup:await ok('/api/backups/export')});
    // Group-only event can resolve a tie without generating KO matches.
    const group=(await ok('/api/events',{name:'Gruppen',kind:'Turnier',date:'2026-10-29'})).id;
    await action(group,'preview',{...options,mode:'groups',groupCount:1,player_ids:ids.slice(0,3)});await action(group,'confirm',{pin:'123456'});
    const g=(await event(group)).tournament.groups[0];for(let i=0;i<g.games.length;i++)await finish(g.games[i].match,i===1?'b':'a');
    await action(group,'resolve',{group:0,order:g.players,reason:'Losentscheidung laut vereinbarter Spielleitungsentscheidung'});
    assert.equal((await event(group)).tournament.complete,true);assert.equal((await event(group)).tournament.rounds.length,0);
    await ok('/api/backups/preview',{backup:await ok('/api/backups/export')});
  }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true,maxRetries:5});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from './helpers/database.js';
import {swissRoundCount,swissStandings,swissPairings} from '../src/swiss.js';
import {drawTournament,makeBracket,standings,validateOptions,roundRobin} from '../src/tournaments.js';

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

test('Swiss: 2–64 entrants play complete rounds without repeat opponents or repeat byes',()=>{
  for(let n=2;n<=64;n++)for(let variant=0;variant<4;variant++){
    const t=drawTournament({...options,mode:'swiss'},people(n)),matches=[],pairs=new Set(),byes=new Set();
    for(let r=0;r<swissRoundCount(n);r++){
      if(r)t.rounds.push(swissPairings(t,matches));
      const round=t.rounds[r];assert.equal(round.length,Math.ceil(n/2));
      assert.equal(new Set(round.flatMap(g=>[g.a,g.b]).filter(Boolean)).size,n);
      for(const game of round){
        if(!game.b){assert.ok(!byes.has(game.a));byes.add(game.a);continue;}
        const pair=[game.a,game.b].sort().join('/');assert.ok(!pairs.has(pair));pairs.add(pair);
        game.match=matches.length+1;
        const win=(matches.length+variant+r)%3!==0;
        matches.push({id:game.match,status:'finished',a:win?1:0,b:win?0:1});
      }
    }
    const table=swissStandings(t,matches);assert.equal(table.complete,true);
    assert.equal(table.rows.reduce((sum,r)=>sum+r.wins,0),swissRoundCount(n)*Math.ceil(n/2));
    assert.equal(byes.size,n%2?swissRoundCount(n):0);
  }
});

test('Swiss: score groups, Buchholz and explicit final tie decisions',()=>{
  const t={players:people(4),rounds:[[{a:'p0',b:'p1',match:1},{a:'p2',b:'p3',match:2}]],resolutions:{},rules:'wins'};
  const matches=[{id:1,status:'finished',a:1,b:0},{id:2,status:'finished',a:1,b:0}];
  const next=swissPairings(t,matches);
  assert.deepEqual(new Set(next.map(g=>[g.a,g.b].sort().join('/'))),new Set(['p0/p2','p1/p3']));
  next.forEach((g,i)=>{g.match=i+3;matches.push({id:g.match,status:'finished',a:1,b:0});});t.rounds.push(next);
  const tab=swissStandings(t,matches);assert.equal(tab.complete,true);
  const wins=Object.fromEntries(tab.rows.map(r=>[r.id,r.wins]));
  for(const row of tab.rows)assert.equal(row.buchholz,t.rounds.flat().filter(g=>[g.a,g.b].includes(row.id)).reduce((sum,g)=>sum+wins[g.a===row.id?g.b:g.a],0));
  assert.equal(tab.tied,true);{t.resolutions[0]={order:tab.rows.map(r=>r.id).reverse(),reason:'Entscheidungsspiel'};assert.equal(swissStandings(t,matches).tied,false);}
});

test('FR-006: groups, ties, qualification, tablet, correction locks, restart and separate complete backup restore',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'tournaments-')),config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('k'.repeat(40))};
  let server,base,cookie,csrf;
  const call=async(path,data,auth={})=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie||'','X-CSRF-Token':csrf||'',...auth},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
  const ok=async(path,data,auth)=>{const r=await call(path,data,auth);assert.ok([200,201].includes(r.status),path+': '+JSON.stringify(r.body));return r.body;};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
  const start=async file=>{server=await createApp({dbKey:join(dir,file),config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;await login();};
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
    await start('source');const ids=[];
    for(let i=0;i<6;i++)ids.push((await ok('/api/players',{first_name:'Spieler',last_name:String(i)})).id);
    const id=(await ok('/api/events',{name:'Gruppen und KO',kind:'Turnier',date:'2026-10-29'})).id;
    const data={...options,player_ids:ids,assignment:'manual',groupAssignments:Object.fromEntries(ids.map((id,i)=>[id,i<3?1:2]))};
    assert.equal((await call('/api/events/'+id+'/tournament/preview',{...data,version:0,player_ids:[ids[0],ids[0]]})).status,400);
    await action(id,'preview',data);assert.equal((await state()).matches.length,0);
    const preview=(await event(id)).tournamentPreview;assert.equal(preview.groups.length,2);assert.deepEqual(preview.groups.map(g=>g.players),[ids.slice(0,3),ids.slice(3)]);
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
    await new Promise(r=>server.close(r));await start('source');assert.deepEqual((await event(id)).tournament,t);
    await new Promise(r=>server.close(r));await start('restore');
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
    // Swiss rounds, backup validation, correction locks and separate restoration.
    const swiss=(await ok('/api/events',{name:'Schweizer System',kind:'Turnier',date:'2026-11-01'})).id;
    await action(swiss,'preview',{...options,mode:'swiss',player_ids:ids.slice(0,5)});
    assert.equal((await event(swiss)).tournamentPreview.rounds.length,1);
    await ok('/api/backups/preview',{backup:await ok('/api/backups/export')});
    await action(swiss,'confirm',{pin:'123456'});
    let firstSwiss;
    for(let r=0;r<3;r++){
      const draw=(await event(swiss)).tournament;assert.equal(draw.rounds.length,r+1);
      const games=draw.rounds[r].filter(g=>g.b);
      assert.equal(draw.rounds[r].filter(g=>!g.b).length,1);
      for(let i=0;i<games.length;i++){
        await finish(games[i].match,i%2?'b':'a');
        if(r===0&&i===0)firstSwiss=await match(games[i].match);
        if(i<games.length-1)assert.equal((await event(swiss)).tournament.rounds.length,r+1);
      }
      if(r===0)assert.equal((await call('/api/matches/'+firstSwiss.id+'/edit',{...firstSwiss,event_version:(await event(swiss)).version,a:0,b:1,action:'match:edit',confirmation:'SPIEL ÄNDERN'})).status,409);
      await ok('/api/backups/preview',{backup:await ok('/api/backups/export')});
    }
    let swissDraw=(await event(swiss)).tournament;
    if(swissDraw.tables[0].tied)await action(swiss,'resolve',{group:0,order:swissDraw.tables[0].rows.map(r=>r.id),reason:'Entscheidungsspiel'});
    swissDraw=(await event(swiss)).tournament;assert.equal(swissDraw.complete,true);assert.ok(swissDraw.champion);
    const swissBackup=await ok('/api/backups/export');
    for(const corrupt of [t=>t.rounds[1][0].a=t.rounds[1][0].b||'missing',t=>t.rounds.pop(),t=>t.complete=false,t=>t.champion='missing']){
      const bad=structuredClone(swissBackup),plan=bad.data.event_planning.find(p=>p.event_id===swiss),meta=JSON.parse(plan.metadata);corrupt(meta.tournament);plan.metadata=JSON.stringify(meta);bad.checksum=createHash('sha256').update(JSON.stringify(bad.data)).digest('hex');
      assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
    }
    await new Promise(r=>server.close(r));await start('swiss-restore');
    await ok('/api/backups/preview',{backup:swissBackup});
    await ok('/api/backups/restore',{backup:swissBackup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});await login();
    assert.deepEqual((await event(swiss)).tournament,swissDraw);
    const swissRestored=await ok('/api/backups/export');for(const table of Object.keys(swissBackup.data))if(table!=='audit')assert.deepEqual(swissRestored.data[table],swissBackup.data[table]);
    await ok('/api/events/'+swiss+'/close',{version:(await event(swiss)).version,action:'event:close',confirmation:'EVENT ABSCHLIESSEN'});
  }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true,maxRetries:5});}
});

test('FR-006 adjustments: manual assignment validation and fair complete rounds',()=>{
  const players=people(6),groupAssignments={p0:1,p1:1,p2:1,p3:2,p4:2,p5:2};
  const t=drawTournament({...options,assignment:'manual',groupAssignments},players);
  assert.deepEqual(t.groups.map(g=>g.players),[['p0','p1','p2'],['p3','p4','p5']]);
  for(const bad of [{},{...groupAssignments,p0:3},{...groupAssignments,p0:2,p1:2}])assert.throws(()=>drawTournament({...options,assignment:'manual',groupAssignments:bad},players));
  for(let n=2;n<=64;n++){
    const games=roundRobin(people(n).map(p=>p.id)),perRound=Math.floor(n/2);
    assert.equal(new Set(games.map(g=>[g.a,g.b].sort().join('/'))).size,n*(n-1)/2);
    for(let i=0;i<games.length;i+=perRound)assert.equal(new Set(games.slice(i,i+perRound).flatMap(g=>[g.a,g.b])).size,2*perRound);
  }
});

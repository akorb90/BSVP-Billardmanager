import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync,createHash } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectNuLiga } from '../src/nuliga.js';
import { createApp } from '../src/server.js';

test('nuLiga follows current leagues, all teams and registered rosters, rejects incomplete sources',async()=>{
  const a=(url,name)=>`<a href="${url}">${name}</a>`;
  const pages={
    clubTeams:'<h2>BBV Pool 2026/27</h2>'+a('groupPage?championship=BBV+Pool+26%2F27&group=1','Liga'),
    groupPage:a('teamPortrait?teamtable=11','BSV Pfaffenhofen')+a('teamPortrait?teamtable=22','Gegner'),
    teamPortrait:'<h1>Verein 1. Liga-Kombi Erw</h1>'+a('clubInfoDisplay?club=402','BSV'),
    clubPools:'<tr><td><h2>Pool 2026/27</h2></td></tr><tr><td>'+a('clubPools?pool=1&club=402','Vorrunde')+'</td></tr><tr><td><h2>Pool 2025/26</h2></td></tr><tr><td>'+a('clubPools?pool=2&club=402','Alt')+'</td></tr>',
    roster:'<tr><td>1.1</td><td>-</td><td>'+a('playerPortrait?person=1','Müller, Anna Maria')+'</td></tr><tr><td>2.1</td><td>-</td><td>'+a('playerPortrait?person=2','Andere, Person')+'</td></tr>'
  };
  const fetchPage=async href=>{const u=new URL(href);return '<div id="content">'+pages[u.searchParams.has('pool')?'roster':u.pathname.split('/').pop()];};
  const result=await collectNuLiga({fetchPage});assert.equal(result.teams.length,2);assert.equal(result.players.length,1);assert.equal(result.players[0].first_name,'Anna Maria');assert.deepEqual(result.teams[1].player_ids,['1']);
  pages.roster='Keine Daten';await assert.rejects(collectNuLiga({fetchPage}),/Keine gemeldeten/);
});

test('nuLiga sync is authenticated, repeatable, preserves edits and history, overwrites on request, backs up and restores identities',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'nuliga-'));
  const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('k'.repeat(40))};
  let data={players:[{source_id:'1',first_name:'Anna',second_name:'',last_name:'Müller'},{source_id:'2',first_name:'Ben',second_name:'',last_name:'Gegner'}],teams:[{source_id:'11',name:'BSV Pfaffenhofen',player_ids:['1']},{source_id:'22',name:'Gegner I',player_ids:['2']}],leagues:[{name:'Liga',championship:'BBV Pool 26/27',url:'https://bbv-billard.liga.nu/'}]};
  let server,base,cookie,csrf,broken=false;
  const start=async file=>{server=await createApp({dbPath:join(dir,file),config,collectNuLiga:async()=>{if(broken)throw Error('Abruf fehlgeschlagen');return structuredClone(data);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
  const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(auth?{Cookie:cookie||'','X-CSRF-Token':csrf||''}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.data.csrf;};
  const ok=async(path,body)=>{const r=await call(path,body);assert.ok([200,201].includes(r.status),JSON.stringify(r.data));return r.data;};
  try {
    await start('source.sqlite');await login();assert.equal((await call('/api/settings/nuliga',{},false)).status,401);
    assert.equal((await ok('/api/settings/nuliga',{})).created,4);
    assert.equal((await ok('/api/settings/nuliga',{})).created,0);
    let state=await ok('/api/admin'),a=state.players.find(p=>p.first_name==='Anna'),b=state.players.find(p=>p.first_name==='Ben'),home=state.teams.find(t=>t.name==='BSV Pfaffenhofen'),away=state.teams.find(t=>t.name==='Gegner I');
    assert.match(home.nuliga_profile,/teamtable=11$/);assert.match(away.nuliga_profile,/teamtable=22$/);assert.equal(a.is_bsv,true);assert.equal(b.is_bsv,false);assert.match(a.nuliga_profile,/person=1$/);assert.match(b.nuliga_profile,/person=2$/);
    const e=await ok('/api/events',{name:'Ligatest',kind:'Liga',date:'2026-10-28'});await ok('/api/events/'+e.id+'/start',{version:0});
    await ok(`/api/events/${e.id}/participants`,{version:1,team_ids:[home.id,away.id],player_ids:[a.id,b.id],assignments:{[a.id]:home.id,[b.id]:away.id}});
    const match=await ok('/api/matches',{event_id:e.id,player_a_id:a.id,player_b_id:b.id,discipline:'9-Ball',target:5,pin:'012345'});
    await ok('/api/players',{...a,first_name:'Lokal'});
    await ok('/api/teams',{...away,name:'Lokaler Gegner',player_ids:[a.id,b.id]});
    const manual=await ok('/api/players',{first_name:'Zusatz',last_name:'Manuell'});
    data.players[0].first_name='Quelle';
    let result=await ok('/api/settings/nuliga',{});assert.equal(result.created,0);assert.ok(result.preserved>=3);
    state=await ok('/api/admin');assert.equal(state.players.find(p=>p.id===a.id).first_name,'Lokal');assert.equal(state.teams.find(t=>t.id===away.id).name,'Lokaler Gegner');
    await ok('/api/settings/nuliga',{overwrite:true});state=await ok('/api/admin');assert.equal(state.players.find(p=>p.id===a.id).first_name,'Quelle');assert.equal(state.teams.find(t=>t.id===away.id).name,'Gegner I');assert.ok(state.players.some(p=>p.id===manual.id));
    assert.equal(state.matches.find(m=>m.id===match.id).team_b_name,'Gegner I');assert.equal(state.matches.find(m=>m.id===match.id).player_a,'Anna Müller');
    const backup=await ok('/api/backups/export');assert.equal(backup.data.nuliga_entities.length,4);assert.equal(backup.data.nuliga_sync.length,1);
    broken=true;assert.equal((await call('/api/settings/nuliga',{})).status,502);assert.deepEqual((await ok('/api/backups/export')).data,backup.data);broken=false;
    const invalid=structuredClone(backup);invalid.data.nuliga_entities[0].local_id='missing';invalid.checksum=createHash('sha256').update(JSON.stringify(invalid.data)).digest('hex');assert.equal((await call('/api/backups/preview',{backup:invalid})).status,400);
    await new Promise(r=>server.close(r));await start('target.sqlite');await login();
    await ok('/api/backups/preview',{backup});await ok('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});await login();
    const restoredState=await ok('/api/admin');assert.equal(restoredState.players.find(p=>p.id===a.id).nuliga_profile,a.nuliga_profile);assert.equal(restoredState.players.find(p=>p.id===a.id).is_bsv,true);
    const restored=await ok('/api/backups/export');for(const t of Object.keys(backup.data))if(t!=='audit')assert.deepEqual(restored.data[t],backup.data[t]);
    assert.equal((await ok('/api/settings/nuliga',{})).created,0);
    const old=structuredClone(backup);delete old.data.event_match_slots;delete old.data.event_planning;delete old.data.nuliga_schedule_sync;old.schema=9;delete old.data.nuliga_entities;delete old.data.nuliga_sync;old.checksum=createHash('sha256').update(JSON.stringify(old.data)).digest('hex');await ok('/api/backups/preview',{backup:old});
  } finally {if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

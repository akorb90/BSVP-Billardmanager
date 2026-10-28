import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';

test('FR-007: identities, explicit participants, history, archive, restart and separate restore',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'players-')),config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('k'.repeat(40))};
  let server,base,cookie='',csrf='';
  const start=async file=>{server=await createApp({dbPath:join(dir,file),config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;cookie='';csrf='';};
  const call=async(path,data,auth=true)=>{const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(auth?{Cookie:cookie,'X-CSRF-Token':csrf}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;};
  const state=async()=>(await call('/api/admin')).body;
  const save=async(path,data)=>{const r=await call(path,data);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.id;};
  try {
    await start('source.sqlite');await login();
    const person={first_name:'Anna',second_name:'Maria',last_name:'Müller'};
    assert.equal((await call('/api/players',person,false)).status,401);
    assert.equal((await call('/api/players',{...person,last_name:''})).status,400);
    const a=await save('/api/players',person);
    assert.equal((await call('/api/players',person)).status,409);
    const b=await save('/api/players',{...person,allow_duplicate:true});assert.notEqual(a,b);
    const team=await save('/api/teams',{name:'BSV I',player_ids:[a]});
    const event=(await call('/api/events',{name:'Liga',kind:'Liga',date:'2026-10-28'})).body.id;await call('/api/events/'+event+'/start',{version:0});
    assert.equal((await call(`/api/events/${event}/participants`,{version:1,player_ids:[a,a],team_ids:[team]})).status,400);
    await save(`/api/events/${event}/participants`,{version:1,player_ids:[a,b],team_ids:[team],assignments:{[a]:team}});
    const fields={event_id:event,player_a:'Freier Name',player_b:'Gegner',discipline:'9-Ball',target:3,pin:'012345'};
    assert.equal((await call('/api/matches',{...fields,player_a_id:a,player_b_id:a})).status,400);
    const mid=(await call('/api/matches',{...fields,player_a_id:a,player_b_id:b})).body.id;
    let snapshot=await state(),m=snapshot.matches.find(m=>m.id===mid);
    assert.equal(m.player_a,'Anna Maria Müller');assert.equal(m.team_a_name,'BSV I');
    assert.equal((await call(`/api/matches/${mid}/edit`,{...m,status:'finished',a:3,b:1,event_version:snapshot.events[0].version,action:'match:edit',confirmation:'SPIEL ÄNDERN'})).status,200);
    await save('/api/players',{...person,id:a,version:0,first_name:'Umbenannt',active:0});
    await save('/api/teams',{id:team,version:0,name:'BSV II',player_ids:[b],active:0});
    snapshot=await state();m=snapshot.matches.find(m=>m.id===mid);
    assert.equal(m.player_a,'Anna Maria Müller');assert.equal(m.team_a_name,'BSV I');assert.equal(m.a,3);
    assert.equal((await call('/api/matches',{...fields,player_a_id:a,player_b_id:b})).status,400);
    const legacy=(await call('/api/matches',{...fields,player_a:'Anna Maria Müller',player_b:'Frei'})).body.id;
    assert.equal((await state()).matches.find(m=>m.id===legacy).player_a_id,null,'same names never auto-link');
    snapshot=await state();const unlinked=snapshot.matches.find(m=>m.id===legacy);
    assert.equal((await call('/api/matches/'+legacy+'/edit',{...unlinked,player_a_id:b,event_version:snapshot.events[0].version})).status,200);
    assert.equal((await state()).matches.find(m=>m.id===legacy).player_a_id,b,'explicit later association is supported');
    const backup=(await call('/api/backups/export')).body;
    assert.equal(backup.data.event_players.length,2);assert.equal(backup.data.team_players[0].player_id,b);
    const bad=structuredClone(backup);bad.data.matches[0].player_a_id='missing';bad.checksum=createHash('sha256').update(JSON.stringify(bad.data)).digest('hex');
    assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
    await new Promise(r=>server.close(r));await start('source.sqlite');await login();
    assert.equal((await state()).matches.find(m=>m.id===mid).team_a_id,team);
    await new Promise(r=>server.close(r));await start('target.sqlite');await login();
    assert.equal((await call('/api/backups/preview',{backup})).status,200);
    assert.equal((await call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'})).status,200);await login();
    const restored=(await call('/api/backups/export')).body;
    for(const name of Object.keys(backup.data))if(name!=='audit')assert.deepEqual(restored.data[name],backup.data[name]);
    const old=structuredClone(backup);delete old.data.event_match_slots;delete old.data.event_planning;delete old.data.nuliga_schedule_sync;delete old.data.nuliga_entities;delete old.data.nuliga_sync;old.schema=8;
    for(const name of ['players','teams','team_players','event_players','event_teams'])delete old.data[name];
    for(const m of old.data.matches)for(const key of ['player_a_id','player_b_id','team_a_id','team_b_id','team_a_name','team_b_name'])delete m[key];
    old.checksum=createHash('sha256').update(JSON.stringify(old.data)).digest('hex');
    assert.equal((await call('/api/backups/preview',{backup:old})).status,200);
  } finally {if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true,maxRetries:5});}
});

test('FR-007: statistics count only finished results and filter historical team, date and discipline',()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const block=source.slice(source.indexOf('function playersDashboard()'),source.indexOf('let registryDialog;'));
  const state={players:[{id:'p',first_name:'Anna',last_name:'Neu',active:1}],teams:[{id:'old',name:'Altes Team'}],team_players:[],events:[{id:1,date:'2026-10-28'},{id:2,date:'2025-01-01'}],matches:[
    {event_id:1,player_a_id:'p',team_a_id:'old',status:'finished',a:5,b:2,discipline:'9-Ball'},
    {event_id:1,player_a_id:'p',team_a_id:'old',status:'live',a:5,b:0,discipline:'9-Ball'},
    {event_id:1,player_a_id:'p',team_a_id:'old',status:'planned',a:0,b:0,discipline:'9-Ball'},
    {event_id:2,player_b_id:'p',team_b_id:'old',status:'finished',a:5,b:1,discipline:'8-Ball'}]};
  const root={innerHTML:''},filter={kind:'players',id:'p',from:'',to:'',discipline:''};
  const ctx=vm.createContext({root,state,view:'spieler',playerSearch:'',statsFilter:filter,esc:String,fullName:p=>p.first_name+' '+p.last_name,paginate:items=>({items,controls:''}),selectField:()=>'',matchRows:()=>''});
  vm.runInContext(block+';playersDashboard();',ctx);
  assert.match(root.innerHTML,/2 Ergebnisse · 1 Siege · 1 Niederlagen · Racks 6 : 7/);
  filter.from='2026-01-01';filter.discipline='9-Ball';vm.runInContext('playersDashboard()',ctx);
  assert.match(root.innerHTML,/1 Ergebnisse · 1 Siege · 0 Niederlagen · Racks 5 : 2/);
  filter.kind='teams';filter.id='old';vm.runInContext('playersDashboard()',ctx);
  assert.match(root.innerHTML,/1 Ergebnisse · 1 Siege · 0 Niederlagen · Racks 5 : 2/);
});

test('Separate registry lists show teams beside players and choose BSV statistics or nuLiga profiles',()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const block=source.slice(source.indexOf('function playersDashboard()'),source.indexOf('let registryDialog;'));
  const state={players:[{id:'own',first_name:'Anna',last_name:'BSV',active:1,is_bsv:true,nuliga_profile:'https://bbv-billard.liga.nu/profile?person=1'},{id:'away',first_name:'Ben',last_name:'Gast',active:1,is_bsv:false,nuliga_profile:'https://bbv-billard.liga.nu/profile?person=2'},{id:'manual',first_name:'Neu',last_name:'Manuell',active:1,is_bsv:false,nuliga_profile:null}],teams:[{id:'t1',name:'BSV Pfaffenhofen II',nuliga_profile:'https://bbv-billard.liga.nu/teamPortrait?teamtable=11'},{id:'t2',name:'Gegner I'}],team_players:[{team_id:'t1',player_id:'own'},{team_id:'t2',player_id:'away'}],events:[],matches:[]};
  const root={innerHTML:''};
  const ctx=vm.createContext({root,state,view:'spieler',playerSearch:'',statsFilter:{kind:'players',id:'',from:'',to:'',discipline:''},esc:String,fullName:p=>p.first_name+' '+p.last_name,paginate:items=>({items,controls:''}),selectField:()=>'',matchRows:()=>''});
  vm.runInContext(block+';playersDashboard();',ctx);
  assert.match(root.innerHTML,/<h1>Spieler<\/h1>/);
  assert.doesNotMatch(root.innerHTML,/Mannschaft anlegen/);
  assert.match(root.innerHTML,/<th scope="row">Anna BSV<\/th><td>BSV Pfaffenhofen II<\/td>/);
  assert.match(root.innerHTML,/data-stat="players" data-id="own"/);
  assert.doesNotMatch(root.innerHTML,/data-stat="players" data-id="away"/);
  assert.match(root.innerHTML,/href="https:\/\/bbv-billard.liga.nu\/profile\?person=1" target="_blank"/);
  assert.match(root.innerHTML,/href="https:\/\/bbv-billard.liga.nu\/profile\?person=2" target="_blank"/);
  assert.match(root.innerHTML,/Kein nuLiga-Profil zugeordnet/);
  ctx.playerSearch='Gegner I';vm.runInContext('playersDashboard()',ctx);
  assert.match(root.innerHTML,/<th scope="row">Ben Gast/);assert.doesNotMatch(root.innerHTML,/<th scope="row">Anna BSV/);
  ctx.view='mannschaften';vm.runInContext('playersDashboard()',ctx);
  assert.match(root.innerHTML,/href="https:\/\/bbv-billard.liga.nu\/teamPortrait\?teamtable=11"/);assert.doesNotMatch(root.innerHTML,/data-stat="teams"|Partien &amp; Statistik|id="stats-filter"/);
  assert.match(root.innerHTML,/<h1>Mannschaften<\/h1>/);assert.match(root.innerHTML,/Mannschaft anlegen/);assert.doesNotMatch(root.innerHTML,/Spieler anlegen|id="player-search"/);
});

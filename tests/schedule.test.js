import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/server.js';
import {collectNuLigaSchedule} from '../src/schedule.js';

test('Complete nuLiga schedule uses carried dates, filters results, past dates and other clubs',async()=>{
  const link=(url,name)=>`<a href="${url}">${name}</a>`;
  let rows='<tr><th>Tag</th><th>Datum</th><th>Zeit</th><th>Nr.</th><th>Heimmannschaft</th><th>Gastmannschaft</th><th>Partien</th></tr>';
  const row=(date,number,home,away,result='')=>'<tr>'+['Sa',date,'14:00',number,home,away,result].map(v=>'<td>'+v+'</td>').join('')+'</tr>';
  rows+=row('24.10.2026','1','BSV Pfaffenhofen','Gegner');
  rows+=row('07.11.2026','2','BSV Pfaffenhofen','Gegner');
  rows+=row('','3','Gegner','BSV Pfaffenhofen');
  rows+=row('','4','Gegner','Anderer');
  rows+=row('','5','BSV Pfaffenhofen','Gegner','6:4');
  const fetchPage=async href=>{const u=new URL(href);return '<div id="content">'+(u.pathname.endsWith('clubTeams')?link('groupPage?group=1&championship=BBV+Pool+26%2F27','Liga'):u.searchParams.has('displayDetail')?'<table>'+rows+'</table>':link('teamPortrait?teamtable=11','BSV Pfaffenhofen')+link('teamPortrait?teamtable=22','Gegner'));};
  const data=await collectNuLigaSchedule({today:'2026-10-28',fetchPage});assert.equal(data.length,1);assert.equal(data[0].date,'2026-11-07');assert.equal(data[0].home_source_id,'11');
  rows='<tr><td>Unerwartetes Format</td></tr>';await assert.rejects(collectNuLigaSchedule({fetchPage}),/Spielplan fehlt/);
});

test('Scheduled events require explicit start; sync deduplicates and preserves active days; complete restore retains planning',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'schedule-'));
  const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  const registry={players:[{source_id:'1',first_name:'Anna',second_name:'',last_name:'BSV'},{source_id:'2',first_name:'Ben',second_name:'',last_name:'Gast'}],teams:[{source_id:'11',name:'BSV Pfaffenhofen',player_ids:['1']},{source_id:'22',name:'Gegner',player_ids:['2']}],leagues:[]};
  const fixture={source_id:'group:123',name:'BSV Pfaffenhofen – Gegner',date:'2026-11-07',time:'14:00',home:'BSV Pfaffenhofen',away:'Gegner',home_source_id:'11',away_source_id:'22',league:'Testliga',number:'123',url:'https://bbv-billard.liga.nu/'};
  let records=[{...fixture}],broken=false,server,base,cookie='',csrf='';
  const start=async file=>{server=await createApp({dbPath:join(directory,file),config,collectNuLiga:async()=>registry,collectNuLigaSchedule:async()=>{if(broken)throw Error('Abruf fehlgeschlagen');return records;}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
  const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(auth?{Cookie:cookie,'X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};
  const ok=async(path,body)=>{const r=await call(path,body);assert.ok([200,201].includes(r.status),JSON.stringify(r.data));return r.data;};
  const login=async()=>{const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.data.csrf;};
  const state=()=>ok('/api/admin');
  try {
    await start('source.sqlite');await login();
    assert.equal((await call('/api/settings/nuliga-schedule',{},false)).status,401);
    assert.equal((await call('/api/settings/nuliga-schedule',{})).status,409,'Missing registry aborts import atomically');assert.equal((await state()).events.length,0);
    await ok('/api/settings/nuliga',{});
    assert.equal((await ok('/api/settings/nuliga-schedule',{})).created,1);
    let snapshot=await state(),event=snapshot.events[0];assert.equal(event.phase,'planned');assert.equal(snapshot.matches.length,0);assert.equal(snapshot.event_teams.length,2);assert.equal(snapshot.event_players.length,2);
    const fields={event_id:event.id,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:3,pin:'012345'};
    assert.equal((await call('/api/matches',fields)).status,409);
    assert.equal((await call('/api/events/'+event.id+'/start',{version:0},false)).status,401);
    records=[{...fixture,date:'2026-11-08'}];assert.equal((await ok('/api/settings/nuliga-schedule',{})).created,0);event=(await state()).events[0];assert.equal(event.date,'2026-11-08');
    assert.equal((await call('/api/events/'+event.id+'/start',{version:0})).status,409);
    await ok('/api/events/'+event.id+'/start',{version:event.version});assert.equal((await state()).events[0].phase,'started');assert.equal((await state()).matches.length,0);
    assert.equal((await call('/api/events/'+event.id+'/start',{version:event.version+1})).status,409);
    await ok('/api/matches',fields);
    records=[{...fixture,date:'2026-12-01'},{...fixture,source_id:'group:124',date:'2026-12-02'}];const result=await ok('/api/settings/nuliga-schedule',{});assert.equal(result.created,1);assert.equal(result.preserved,1);assert.equal((await state()).events.find(e=>e.id===event.id).date,'2026-11-08');
    const manual=await ok('/api/events',{name:'Manuell',kind:'Turnier',date:'2026-12-03'});assert.equal((await state()).events.find(e=>e.id===manual.id).phase,'planned');
    const obsolete=await ok('/api/events',{name:'Auswärtsimport',kind:'Liga',date:'2026-12-04'});
    const raw=new DatabaseSync(join(directory,'source.sqlite'));raw.prepare('UPDATE event_planning SET source_id=?,started=1,metadata=? WHERE event_id=?').run('old:away',JSON.stringify({source:{...fixture,home:'Gegner',away:'BSV Pfaffenhofen'}}),obsolete.id);raw.close();
    assert.equal((await ok('/api/settings/nuliga-schedule',{})).removed,1);assert.ok(!(await state()).events.some(e=>e.id===obsolete.id));
    const backup=await ok('/api/backups/export');assert.equal(backup.data.nuliga_schedule_sync.length,1);assert.equal(backup.data.event_planning.length,3);
    broken=true;assert.equal((await call('/api/settings/nuliga-schedule',{})).status,502);assert.deepEqual((await ok('/api/backups/export')).data,backup.data);broken=false;
    await new Promise(r=>server.close(r));await start('target.sqlite');await login();await ok('/api/backups/preview',{backup});await ok('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});await login();
    const restored=await ok('/api/backups/export');for(const table of Object.keys(backup.data))if(table!=='audit')assert.deepEqual(restored.data[table],backup.data[table]);
    assert.equal((await state()).events.filter(e=>e.phase==='planned').length,2);
    assert.equal((await ok('/api/settings/nuliga-schedule',{})).created,0);
    const old=structuredClone(backup);delete old.data.event_match_slots;old.schema=10;delete old.data.event_planning;delete old.data.nuliga_schedule_sync;old.checksum=createHash('sha256').update(JSON.stringify(old.data)).digest('hex');await ok('/api/backups/preview',{backup:old});
  } finally {if(server?.listening)await new Promise(r=>server.close(r));rmSync(directory,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {createApp} from './helpers/database.js';
import {openDatabase} from './helpers/database.js';

test('AP6: authenticated bounded views, complete doubles/14-1 statistics and independent live state',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'admin-pages-')),dbKey=join(dir,'test');
  const config={adminHash:'test:'+scryptSync('test-only','test',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let db,server;
  try {
    db=await openDatabase({dbKey,config});
    await db.exec(`INSERT INTO players(id,first_name,last_name) VALUES('a','Anna','A'),('b','Ben','B'),('double','Dora','D');
      INSERT INTO teams(id,name) VALUES('home','Heim'),('away','Gast');
      INSERT INTO events(id,name,kind,date,status) VALUES(1,'Archiv','Liga','2026-11-01','closed'),(2,'Live','Liga','2026-11-02','open'),(3,'Plan','Liga','2026-11-03','open');
      INSERT INTO event_planning(event_id,started,metadata) VALUES(1,1,'{}'),(2,1,'{}'),(3,0,'{}');
      INSERT INTO event_players(event_id,player_id,team_id) VALUES(1,'a','home'),(2,'b','away');`);
    const insert=db.prepare(`INSERT INTO matches(id,event_id,player_a,player_b,player_a_id,player_b_id,team_a_id,team_b_id,discipline,target,first,a,b,status) VALUES(?,1,'Anna','Ben','a','b','home','away','14/1',125,'a',114,69,'finished')`);
    for(let id=1;id<=35;id++)await insert.run(id);
    await db.exec(`INSERT INTO event_match_slots(event_id,slot,match_id,player_a_id,player_a2_id,player_b_id) VALUES(1,5,1,'a','double','b');
      INSERT INTO matches(id,event_id,player_a,player_b,discipline,target,first,status,table_no) VALUES(36,2,'Live A','Live B','9-Ball',5,'a','live',1);`);
    server=await createApp({dbKey,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+server.address().port;
    const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({password:'test-only'})});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const get=async(path,auth=true)=>{const response=await fetch(base+path,{headers:auth?{Cookie:cookie}:{}});return {status:response.status,body:await response.json()};};
    for(const path of ['/api/admin/live','/api/admin/view?view=ergebnisse'])assert.equal((await get(path,false)).status,401);
    const live=(await get('/api/admin/live')).body;
    assert.deepEqual(live.matches.map(m=>m.id),[36]);assert.equal(live.matches[0].event_name,'Live');
    assert.ok(!('pin_hash' in live.matches[0]));assert.ok(Buffer.byteLength(JSON.stringify(live))<256*1024);
    let state=(await get('/api/admin/view?view=ergebnisse&matches-ergebnisse-page=2')).body;
    assert.equal(state.pages['matches-ergebnisse'].total,35);assert.equal(state.matches.length,15);assert.equal(state.matches[0].id,15);
    assert.equal(state.events[0].match_count,35);assert.equal(state.events[0].pending_count,0);
    state=(await get('/api/admin/view?view=ergebnisse&matches-ergebnisse-page=999')).body;assert.equal(state.pages['matches-ergebnisse'].page,2);
    for(const query of ['view=unknown','view=ergebnisse&matches-ergebnisse-size=999','view=ergebnisse&matches-ergebnisse-page=-1','view=spieler&from=2026-02-30','view=spieler&kind=arbitrary','view=spieler&discipline=invalid'])assert.equal((await get('/api/admin/view?'+query)).status,400,query);
    state=(await get('/api/admin/view?view=spieler&kind=players&id=a&discipline=14%2F1&player-matches-size=10&player-matches-page=2')).body;
    assert.equal(state.matches.length,10);assert.equal(state.pages['player-matches'].total,35);
    assert.deepEqual(state.statistics,{count:35,wins:35,losses:0,won:385,lost:210});assert.equal(state.event_players.length,0);
    const doubles=(await get('/api/admin/view?view=spieler&kind=players&id=double')).body;assert.deepEqual(doubles.statistics,{count:1,wins:1,losses:0,won:11,lost:6});
    const away=(await get('/api/admin/view?view=spieler&kind=teams&id=away')).body;assert.deepEqual(away.statistics,{count:35,wins:0,losses:35,won:210,lost:385});
    const empty=(await get('/api/admin/view?view=spieler&kind=players&id=a&from=2026-11-02')).body;assert.equal(empty.statistics.count,0);
    const selected=(await get('/api/admin/view?view=spieltage&event=1')).body;assert.equal(selected.matches.length,35);assert.equal(selected.event_match_slots.length,1);assert.equal(selected.event_players.length,2,'selected archive and editable destination rosters');
    const overview=(await get('/api/admin/view?view=spieltage')).body;
    assert.deepEqual(overview.pages.events.items.map(e=>e.id),[2,3]);assert.deepEqual(overview.matches,[]);assert.ok(!overview.pages['matches-spieltage']);
    for(const [filter,expected] of [['planned',[3]],['running',[2]],['closed',[1]],['all',[2,3,1]]]){
      const filtered=(await get('/api/admin/view?view=spieltage&status='+filter)).body;
      assert.deepEqual(filtered.pages.events.items.map(e=>e.id),expected);
    }
    assert.equal((await get('/api/admin/view?view=spieltage&status=invalid')).status,400);
    const planned=(await get('/api/admin/view?view=planung')).body;assert.deepEqual(planned.pages['planned-events'].items.map(e=>e.id),[3]);
    assert.equal((await get('/api/admin/view?view=spieltage&event=999')).status,404);
    await db.prepare('DELETE FROM matches WHERE id<=?').run(30);
    state=(await get('/api/admin/view?view=ergebnisse&matches-ergebnisse-page=2')).body;assert.equal(state.pages['matches-ergebnisse'].page,1);assert.equal(state.matches.length,5);
    assert.deepEqual((await get('/api/admin/live')).body.matches.map(m=>m.id),[36]);
  } finally {
    if(server?.listening)await new Promise(r=>server.close(r));if(db)await db.close();rmSync(dir,{recursive:true,force:true});
  }
});

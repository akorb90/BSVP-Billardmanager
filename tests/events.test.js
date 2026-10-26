import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {scryptSync} from 'node:crypto';
import {createApp} from '../src/server.js';

const config={adminHash:`salt:${scryptSync('password','salt',64).toString('hex')}`,tables:Array.from({length:8},(_,i)=>String(i).repeat(40))};
test('Veranstaltungen bleiben bis zum Gesamtabschluss editierbar und löschbar',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-events-')), path=join(dir,'db.sqlite');
  let server,base,cookie,csrf;
  async function start(){server=createApp({dbPath:path,config}); await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
  async function request(path,data,admin=true){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(admin?{Cookie:cookie||'','X-CSRF-Token':csrf||''}:{Authorization:`Bearer ${config.tables[0]}`})},body:data?JSON.stringify(data):undefined});const body=await r.json();return{status:r.status,body,cookie:r.headers.get('set-cookie')};}
  async function login(){const r=await request('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}
  const state=async()=>(await request('/api/admin')).body;
  const event=async id=>(await state()).events.find(e=>e.id===id);
  const match=async id=>(await state()).matches.find(m=>m.id===id);
  const createEvent=async name=>(await request('/api/events',{name,kind:'Liga',date:'2026-10-26'})).body.id;
  const createMatch=async id=>(await request('/api/matches',{event_id:id,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:1,first:'a'})).body.id;
  try{
    await start(); await login();
    const eid=await createEvent('Offener Spieltag'), mid=await createMatch(eid);
    let e=await event(eid),m=await match(mid);
    assert.equal((await request(`/api/events/${eid}/close`,{version:e.version})).status,409);
    assert.equal((await request(`/api/events/${eid}/edit`,{...e,name:'Umbenannt'},false)).status,401);
    assert.equal((await request(`/api/matches/${mid}/edit`,{...m},false)).status,401);
    assert.equal((await request(`/api/events/${eid}/edit`,{...e,name:'Umbenannt'})).status,200);
    await request(`/api/matches/${mid}/start`,{version:m.version,table_no:1});
    await request(`/api/matches/${mid}/score`,{version:1,side:'a',delta:1},false);
    await request(`/api/matches/${mid}/finish`,{version:2},false);
    m=await match(mid);
    assert.equal((await request(`/api/matches/${mid}/edit`,{...m,a:0,b:1,player_b:'Berta'})).status,200);
    assert.equal((await match(mid)).player_b,'Berta');
    assert.equal((await request(`/api/matches/${mid}/edit`,{...m,a:0,b:1})).status,409);
    m=await match(mid);
    assert.equal((await request(`/api/matches/${mid}/edit`,{...m,a:1,b:1})).status,400);
    // Reopen a finished match and move its table; all tablet versions become stale.
    assert.equal((await request(`/api/matches/${mid}/edit`,{...m,status:'live',a:0,b:0,table_no:1,target:2})).status,200);
    const second=await createMatch(eid);
    let other=await match(second);
    assert.equal((await request(`/api/matches/${second}/edit`,{...other,status:'live',table_no:1})).status,409);
    assert.equal((await request(`/api/matches/${second}/edit`,{...other,a:-1})).status,400);
    const staleEvent=await event(eid);
    m=await match(mid);
    assert.equal((await request(`/api/matches/${mid}/edit`,{...m,a:2,b:1,status:'finished',discipline:'10-Ball',first:'b'})).status,200);
    assert.equal((await request(`/api/events/${eid}/delete`,{version:staleEvent.version})).status,409);
    assert.equal((await request(`/api/matches/${second}/delete`,{version:other.version},false)).status,401);
    assert.equal((await request(`/api/matches/${second}/delete`,{version:other.version})).status,200);
    // IDs never get reused after deletion, preventing stale tablets from targeting a new match.
    const third=await createMatch(eid); assert.ok(third>second);
    other=await match(third); await request(`/api/matches/${third}/delete`,{version:other.version});
    e=await event(eid); m=await match(mid);
    assert.equal((await request(`/api/events/${eid}/close`,{version:e.version},false)).status,401);
    assert.equal((await request(`/api/events/${eid}/close`,{version:e.version})).status,200);
    for(const action of ['edit','delete','close'])assert.equal((await request(`/api/events/${eid}/${action}`,{...e,name:'Gesperrt'})).status,409);
    for(const action of ['edit','delete','start','score','finish'])assert.equal((await request(`/api/matches/${mid}/${action}`,{...m,side:'a',delta:-1})).status,409);
    assert.equal((await request('/api/matches',{event_id:eid,player_a:'A',player_b:'B',discipline:'8-Ball',target:2,first:'a'})).status,409);
    assert.equal((await request(`/api/matches/${mid}/score`,{version:m.version,side:'a',delta:-1},false)).status,409);
    const open=await createEvent('Verschieben'), movable=await createMatch(open);
    other=await match(movable);
    assert.equal((await request(`/api/matches/${movable}/edit`,{...other,event_id:eid})).status,409);
    const destination=await createEvent('Ziel');
    assert.equal((await request(`/api/matches/${movable}/edit`,{...other,event_id:destination})).status,200);
    other=await match(movable); await request(`/api/matches/${movable}/start`,{version:other.version,table_no:1});
    const doomed=await event(destination);
    assert.equal((await request(`/api/events/${destination}/delete`,{version:doomed.version})).status,200);
    assert.equal((await request('/api/tables/1',undefined,false)).body.match,null);
    assert.equal((await request(`/api/matches/${movable}/score`,{version:1,side:'a',delta:1},false)).status,404);
    const newEvent=await createEvent('Neue ID');assert.ok(newEvent>destination);
    await new Promise(r=>server.close(r)); await start(); await login();
    assert.equal((await event(eid)).status,'closed');
    assert.equal((await match(mid)).b,1);
    const db=new DatabaseSync(path);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);
    const deleted=db.prepare("SELECT detail FROM audit WHERE action='event:delete'").get();
    assert.equal(JSON.parse(deleted.detail).matches[0].id,movable);
    db.close();
  }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

test('Migration übernimmt bestehende Version-1-Daten und ist wiederholbar',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-migration-')),path=join(dir,'legacy.sqlite');
  try{
    const legacy=new DatabaseSync(path);
    legacy.exec(`CREATE TABLE events(id INTEGER PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,date TEXT NOT NULL);
      CREATE TABLE matches(id INTEGER PRIMARY KEY,event_id INTEGER NOT NULL REFERENCES events(id),player_a TEXT NOT NULL,player_b TEXT NOT NULL,discipline TEXT NOT NULL,target INTEGER NOT NULL,first TEXT NOT NULL,table_no INTEGER,a INTEGER DEFAULT 0,b INTEGER DEFAULT 0,status TEXT DEFAULT 'planned',version INTEGER DEFAULT 0);
      INSERT INTO events VALUES(7,'Altbestand','Liga','2026-10-26');
      INSERT INTO matches VALUES(9,7,'Alt A','Alt B','8-Ball',5,'a',1,5,3,'finished',12);
      PRAGMA user_version=1;`); legacy.close();
    for(let i=0;i<2;i++){
      const server=createApp({dbPath:path,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>server.close(r));
    }
    const db=new DatabaseSync(path);
    assert.equal(db.prepare('SELECT status FROM events WHERE id=7').get().status,'open');
    assert.deepEqual({...db.prepare('SELECT a,b,version FROM matches WHERE id=9').get()},{a:5,b:3,version:12});
    assert.equal(db.prepare("SELECT value FROM entity_ids WHERE name='matches'").get().value,9);db.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scryptSync, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.js';

test('FR-011: Migration, 1–20 Tische, Belegungsschutz, Tablet, Historie und vollständiger Restore', async () => {
  const dir=mkdtempSync(join(tmpdir(),'billard-tables-'));
  const config={adminHash:'salt:'+scryptSync('test-password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let server,base,cookie='',csrf='';
  async function start(name='source.sqlite') { server=await createApp({dbPath:join(dir,name),config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;cookie='';csrf=''; }
  const stop=()=>new Promise(r=>server.close(r));
  async function call(path,data,headers={}) { const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,body:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text(),cookie:r.headers.get('set-cookie')}; }
  async function login(){const r=await call('/api/login',{password:'test-password'});assert.equal(r.status,200);cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}
  const endpoint='/api/settings/tables';
  const save=(table_count,version)=>call(endpoint,{table_count,version});
  const resign=b=>{b.checksum=createHash('sha256').update(JSON.stringify(b.data)).digest('hex');return b;};
  const restore=backup=>call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
  try {
    await start();await login();
    await call('/api/events',{name:'Bestand',kind:'Liga',date:'2026-10-28'});
    await call('/api/matches',{event_id:1,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:1,pin:'012345'});
    await call('/api/matches/1/start',{table_no:8,version:0,lag_winner:'a',first:'a'});
    await call('/api/rentals',{table_no:7,settings_version:0});
    const original=(await call('/api/backups/export')).body;
    // Recreate the installed schema-7 CHECK constraints and a populated older database.
    await stop();
    const db=new DatabaseSync(join(dir,'source.sqlite'));
    try {
      db.exec('BEGIN');
      for(const name of ['matches','rentals']) {
        const sql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql;
        const indexes=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL").all(name);
        db.exec(sql.replace(/CREATE TABLE\s+"?\w+"?/i,`CREATE TABLE ${name}_old`).replace('BETWEEN 1 AND 20','BETWEEN 1 AND 8'));
        db.exec(`INSERT INTO ${name}_old SELECT * FROM ${name};DROP TABLE ${name};ALTER TABLE ${name}_old RENAME TO ${name};`);
        for(const row of indexes)db.exec(row.sql);
      }
      db.exec('DROP TABLE players;DROP TABLE teams;DROP TABLE team_players;DROP TABLE event_players;DROP TABLE event_teams;ALTER TABLE matches DROP COLUMN player_a_id;ALTER TABLE matches DROP COLUMN player_b_id;ALTER TABLE matches DROP COLUMN team_a_id;ALTER TABLE matches DROP COLUMN team_b_id;ALTER TABLE matches DROP COLUMN team_a_name;ALTER TABLE matches DROP COLUMN team_b_name;DROP TABLE table_settings;PRAGMA user_version=7;COMMIT');
    } finally {db.close();}
    await start();
    assert.equal((await save(20,0)).status,401);await login();
    const migrated=(await call('/api/backups/export')).body;
    for(const key of Object.keys(original.data)) assert.deepEqual(migrated.data[key],original.data[key]);
    assert.equal((await call(endpoint,{table_count:20,version:0},{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await call(endpoint,{table_count:20,version:0},{Origin:'https://evil.invalid'})).status,403);
    for(const value of [0,21,-1,1.5,'20',null])assert.equal((await save(value,0)).status,400);
    assert.equal((await save(7,0)).status,409); // live match on table 8
    await call('/api/matches/1/score',{side:'a',delta:1,version:1});
    await call('/api/matches/1/finish',{version:2,action:'match:finish',confirmation:'SPIEL ABSCHLIESSEN'});
    assert.equal((await save(6,0)).status,409); // active rental on table 7
    assert.equal((await save(20,0)).status,200);
    assert.equal((await save(1,0)).status,409); // stale form
    assert.equal((await call('/api/rentals',{table_no:20,settings_version:0})).status,201);
    assert.equal((await call('/api/rentals',{table_no:21,settings_version:0})).status,400);
    await call('/api/matches',{event_id:1,player_a:'C',player_b:'D',discipline:'8-Ball',target:1,pin:'123456'});
    assert.equal((await call('/api/matches/2/start',{table_no:19,version:0,lag_winner:'b',first:'a'})).status,200);
    assert.equal((await call('/tisch/19')).status,200);assert.equal((await call('/tisch/20')).status,200);assert.equal((await call('/tisch/21')).status,404);
    const tablet=await call('/api/tables/19/login',{pin:'123456'},{Cookie:''});assert.equal(tablet.status,200);
    assert.equal((await call('/api/tables/19',undefined,{Cookie:'',Authorization:'Bearer '+tablet.body.token})).body.match.table_no,19);
    const backup=(await call('/api/backups/export')).body;
    assert.equal(backup.schema,9);assert.equal(backup.data.table_settings[0].table_count,20);
    assert.equal(backup.data.audit.at(-1).action,'start');assert.ok(backup.data.audit.some(a=>a.action==='settings:tables'));
    await stop();await start('target.sqlite');await login();
    for(const change of [b=>b.data.table_settings=[],b=>b.data.table_settings[0].table_count=21,b=>b.data.table_settings[0].table_count=1,b=>delete b.data.table_settings]) {
      const bad=structuredClone(backup);change(bad);resign(bad);assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
    }
    assert.equal((await call('/api/backups/preview',{backup})).status,200);assert.equal((await restore(backup)).status,200);await login();
    const imported=(await call('/api/backups/export')).body;
    for(const key of Object.keys(backup.data))if(key!=='audit')assert.deepEqual(imported.data[key],backup.data[key]);
    await stop();await start('target.sqlite');await login();assert.equal((await call('/api/admin')).body.table_settings.table_count,20);
    // Remove only the isolated test rental/match, then reduce to the lower boundary.
    for(const r of backup.data.rentals)await call(`/api/rentals/${r.id}/delete`,{version:r.version,action:'rental:delete',confirmation:'BUCHUNG LÖSCHEN'});
    const m=(await call('/api/admin')).body.matches.find(m=>m.id===2);
    const event=(await call('/api/admin')).body.events[0];
    assert.equal((await call('/api/matches/2/delete',{version:m.version,event_version:event.version,action:'match:delete',confirmation:'SPIEL LÖSCHEN'})).status,200);
    assert.equal((await save(1,1)).status,200);
    assert.equal((await call('/api/admin')).body.matches[0].table_no,8); // finished history preserved
    const historical=(await call('/api/admin')).body;
    const edit={...historical.matches[0],player_a:'Korrigierte Anna',event_version:historical.events[0].version,action:'match:edit',confirmation:'SPIEL ÄNDERN'};
    assert.equal((await call('/api/matches/1/edit',edit)).status,200);
    const edited=(await call('/api/admin')).body;
    assert.equal(edited.matches[0].table_no,8);
    assert.equal((await call('/api/matches/1/edit',{...edit,version:edited.matches[0].version,event_version:edited.events[0].version,status:'live'})).status,400);
    assert.equal((await call('/api/rentals',{table_no:2,settings_version:0})).status,400);
    assert.equal((await call('/api/tables/2')).status,400);assert.equal((await call('/tisch/2')).status,400);
    assert.equal((await call('/api/tables/2/login',{pin:'123456'})).status,400);
    const legacy=structuredClone(original);legacy.schema=7;for(const t of ['players','teams','team_players','event_players','event_teams'])delete legacy.data[t];for(const m of legacy.data.matches)for(const k of ['player_a_id','player_b_id','team_a_id','team_b_id','team_a_name','team_b_name'])delete m[k];delete legacy.data.table_settings;resign(legacy);
    assert.equal((await call('/api/backups/preview',{backup:legacy})).status,200);assert.equal((await restore(legacy)).status,200);await login();
    assert.equal((await call('/api/admin')).body.table_settings.table_count,8);
  } finally {if(server?.listening)await stop();rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});

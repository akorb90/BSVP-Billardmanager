import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scryptSync, createHash } from 'node:crypto';
import { createApp } from '../src/server.js';

test('FR-005: vollständiger Export/Import, Prüfung, Konflikte, Sitzungssperre und Neustart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'billard-backup-'));
  const config = { adminHash: 'salt:'+scryptSync('original-password','salt',64).toString('hex'), tables:Array(8).fill('x'.repeat(40)) };
  let server, base, cookie='', csrf='';
  const start = async name => { server=await createApp({dbPath:join(dir,name),config}); await new Promise(r=>server.listen(0,'127.0.0.1',r)); base=`http://127.0.0.1:${server.address().port}`; };
  const stop = () => new Promise(r=>server.close(r));
  async function call(path, data, headers={}) {
    const res=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});
    return { status:res.status, body:await res.json(), cookie:res.headers.get('set-cookie'), disposition:res.headers.get('content-disposition') };
  }
  async function login(password='original-password') { const res=await call('/api/login',{password}); if(res.status===200){cookie=res.cookie.split(';')[0];csrf=res.body.csrf;} return res; }
  const restore = backup => call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
  const resign = backup => { backup.checksum=createHash('sha256').update(JSON.stringify(backup.data)).digest('hex');return backup; };
  try {
    await start('source.sqlite');
    assert.equal((await call('/api/backups/export')).status,401);
    assert.equal((await call('/api/backups/preview',{backup:{}})).status,401);
    await login();
    await call('/api/events',{name:'Vollständige Sicherung äöü 🎱',kind:'Liga',date:'2026-10-28'});await call('/api/events/1/start',{version:0});
    await call('/api/matches',{event_id:1,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:3,pin:'012345'});
    await call('/api/matches/1/start',{lag_winner:'a',first:'a',table_no:1,version:0});
    await call('/api/matches/1/score',{side:'a',delta:1,version:1});
    await call('/api/rentals/settings',{base_euros:12,version:0,action:'rental:settings',confirmation:'GRUNDPREIS ÄNDERN'});
    await call('/api/rentals',{table_no:2,settings_version:1,discount:20});
    await call('/api/settings/password',{current_password:'original-password',new_password:'backup-password-2026',repeat_password:'backup-password-2026'});
    await login('backup-password-2026');
    const exported=await call('/api/backups/export'), backup=exported.body;
    assert.equal(exported.status,200);assert.match(exported.disposition,/attachment/);
    assert.equal(backup.data.matches[0].a,1);assert.equal(backup.data.rentals[0].hourly_cents,960);
    assert.ok(backup.data.audit.length);assert.ok(backup.data.matches[0].pin_hash);
    assert.equal(JSON.stringify(backup).includes('backup-password-2026'),false);
    assert.equal((await call('/api/backups/preview',{backup},{'X-CSRF-Token':'wrong'})).status,403);
    assert.equal((await call('/api/backups/preview',{backup},{Origin:'https://evil.invalid'})).status,403);
    const before=(await call('/api/backups/export')).body.data;
    for (const change of [b=>b.schema++,b=>b.version++,b=>b.data.events[0].name='damaged',b=>{delete b.data.audit;resign(b);},b=>{b.data.matches[0].event_id=999;resign(b);},b=>{b.data.admin_credentials=[];resign(b);},b=>{b.data.matches[0].table_no=9;resign(b);},b=>{b.data.entity_ids.find(r=>r.name==='matches').value=0;resign(b);}]) {
      const invalid=structuredClone(backup);change(invalid);
      assert.equal((await call('/api/backups/preview',{backup:invalid})).status,400);
      assert.equal((await restore(invalid)).status,400);
      assert.deepEqual((await call('/api/backups/export')).body.data,before);
    }
    assert.equal((await restore(backup)).status,409);
    assert.equal((await call('/api/backups/preview',{backup})).body.active,2);
    assert.equal((await call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'wrong'})).status,400);
    await call('/api/events',{name:'Zwischenzeitliche Änderung',kind:'Turnier',date:'2026-10-29'});
    assert.equal((await restore(backup)).status,409);
    // A fresh installation gets every application table, including the changed password.
    await stop();await start('target.sqlite');cookie='';csrf='';await login();
    await call('/api/events',{name:'Zu ersetzen',kind:'Liga',date:'2026-10-28'});
    const preview=await call('/api/backups/preview',{backup});assert.equal(preview.status,200);assert.equal(preview.body.events,1);
    const oldCookie=cookie,oldCsrf=csrf;
    assert.equal((await restore(backup)).status,200);
    assert.equal((await call('/api/admin',undefined,{Cookie:oldCookie,'X-CSRF-Token':oldCsrf})).status,401);
    cookie='';csrf='';assert.equal((await login()).status,401);assert.equal((await login('backup-password-2026')).status,200);
    const result=(await call('/api/backups/export')).body;
    for(const name of Object.keys(backup.data)) if(name!=='audit') assert.deepEqual(result.data[name],backup.data[name]);
    assert.equal(result.data.audit.at(-1).action,'backup:restore');
    assert.equal(result.data.audit.length,backup.data.audit.length+1);
    const tablet=await call('/api/tables/1/login',{pin:'012345'});assert.equal(tablet.status,200);
    assert.equal((await call('/api/tables/1',undefined,{Cookie:'',Authorization:'Bearer '+tablet.body.token})).body.match.a,1);
    await call('/api/backups/preview',{backup});assert.equal((await restore(backup)).status,200);
    assert.equal((await call('/api/tables/1',undefined,{Cookie:'',Authorization:'Bearer '+tablet.body.token})).status,401);
    await stop();await start('target.sqlite');cookie='';csrf='';
    assert.equal((await login('backup-password-2026')).status,200);
    assert.equal((await call('/api/admin')).body.rental_settings.base_cents,1200);
    assert.equal((await call('/api/events',{name:'Nach Import',kind:'Liga',date:'2026-10-28'})).body.id,2);
    // Uploads beyond the ordinary request limit preserve multibyte names too.
    const large=(await call('/api/backups/export')).body;
    large.data.audit.push({id:999,at:'2026-10-28',actor:'admin',action:'test',match_id:null,detail:'🎱'.repeat(6000)});resign(large);
    assert.equal((await call('/api/backups/preview',{backup:large})).status,200);
  } finally { if(server?.listening)await stop();rmSync(dir,{recursive:true,force:true}); }
});

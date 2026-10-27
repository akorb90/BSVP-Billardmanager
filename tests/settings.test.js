import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/server.js';

test('Passwortwechsel prüft Berechtigung und Eingaben, widerruft Sitzungen und bleibt nach Neustart erhalten',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-settings-')),dbPath=join(dir,'db.sqlite');
  const config={adminHash:'salt:'+scryptSync('old-password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let server,base,cookie='',csrf='';
  async function start(){server=createApp({dbPath,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
  async function call(path,data,headers={}){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};}
  async function login(password){const r=await call('/api/login',{password});if(r.status===200){cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}return r;}
  const data={current_password:'old-password',new_password:'new-password-2026',repeat_password:'new-password-2026'};
  try {
    await start();
    assert.equal((await call('/api/settings/password',data)).status,401);
    await login('old-password');const oldCookie=cookie,oldCsrf=csrf;
    cookie='';await login('old-password');
    assert.equal((await call('/api/settings/password',data,{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await call('/api/settings/password',data,{Origin:'https://evil.invalid'})).status,403);
    for(const change of [{current_password:'wrong'},{new_password:'short',repeat_password:'short'},{repeat_password:'different'},{new_password:'x'.repeat(129),repeat_password:'x'.repeat(129)}])assert.equal((await call('/api/settings/password',{...data,...change})).status,400);
    assert.equal((await call('/api/settings/password',data)).status,200);
    assert.equal((await call('/api/admin')).status,401);
    assert.equal((await call('/api/admin',undefined,{Cookie:oldCookie,'X-CSRF-Token':oldCsrf})).status,401);
    assert.equal((await login('old-password')).status,401);
    assert.equal((await login(data.new_password)).status,200);
    await new Promise(r=>server.close(r));await start();cookie='';csrf='';
    assert.equal((await login('old-password')).status,401);
    assert.equal((await login(data.new_password)).status,200);
    const db=new DatabaseSync(dbPath);
    const audit=db.prepare("SELECT detail FROM audit WHERE action='admin:password'").all();
    assert.deepEqual(audit.map(r=>JSON.parse(r.detail)),[{changed:true}]);
    const encoded=db.prepare('SELECT password_hash FROM admin_credentials').get().password_hash;
    assert.notEqual(encoded,config.adminHash);assert.ok(!encoded.includes(data.new_password));db.close();
    for(let i=0;i<10;i++)assert.equal((await call('/api/settings/password',{...data,current_password:'wrong'})).status,400);
    assert.equal((await call('/api/settings/password',{...data,current_password:'wrong'})).status,429);
  } finally {if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

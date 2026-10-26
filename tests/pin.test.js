import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/server.js';

test('PIN schützt Partien, widerruft Sitzungen und begrenzt Versuche persistent',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-pin-')),dbPath=join(dir,'db.sqlite');
  const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('old-key'.repeat(8))};
  let server,base,cookie,csrf;
  async function start(){server=createApp({dbPath,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
  async function call(path,data,token){const response=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(token===undefined?{Cookie:cookie||'','X-CSRF-Token':csrf||''}:{Authorization:'Bearer '+token})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};}
  async function login(){const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}
  const getMatch=async id=>(await call('/api/admin')).body.matches.find(m=>m.id===id);
  const unlock=async pin=>(await call('/api/tables/1/login',{pin},'')).body.token;
  const fields={event_id:1,player_a:'A',player_b:'B',discipline:'8-Ball',target:2,first:'a'};
  try{
    await start(); await login();
    await call('/api/events',{name:'PIN-Test',date:'2026-10-26',kind:'Liga'});
    for(const pin of [undefined,123456,'12345','1234567','abcdef','１２３４５６']) assert.equal((await call('/api/matches',{...fields,pin})).status,400);
    assert.equal((await call('/api/matches',{...fields,pin:'012345'})).status,201);
    await call('/api/matches',{...fields,pin:'654321'});
    await call('/api/matches/1/start',{table_no:1,version:0});
    await call('/api/matches/2/start',{table_no:2,version:0});
    for(const token of ['',config.tables[0]]) {
      assert.equal((await call('/api/tables/1',undefined,token)).status,401);
      assert.equal((await call('/api/matches/1/score',{version:1,side:'a',delta:1},token)).status,403);
    }
    assert.equal((await call('/api/tables/1/login',{pin:'999999'},'')).status,401);
    let token=await unlock('012345');assert.ok(token);
    assert.equal((await call('/api/tables/2',undefined,token)).status,401);
    assert.equal((await call('/api/matches/2/score',{version:1,side:'a',delta:1},token)).status,403);
    const publicData=await call('/api/tables/1',undefined,token);
    assert.equal(publicData.status,200);assert.equal(publicData.body.match.pin_hash,undefined);
    assert.equal((await getMatch(1)).pin_hash,undefined);
    assert.equal((await call('/api/matches/1/score',{version:1,side:'a',delta:1},token)).status,200);
    let m=await getMatch(1);
    assert.equal((await call('/api/matches/1/edit',{...m,pin:'234567'})).status,200);
    assert.equal((await call('/api/tables/1',undefined,token)).status,401);
    assert.equal((await call('/api/tables/1/login',{pin:'012345'},'')).status,401);
    token=await unlock('234567');assert.ok(token);
    m=await getMatch(1);
    await call('/api/matches/1/edit',{...m,table_no:3});
    assert.equal((await call('/api/tables/3',undefined,token)).status,401);
    token=(await call('/api/tables/3/login',{pin:'234567'},'')).body.token;
    m=await getMatch(1);
    await call('/api/matches/1/edit',{...m,a:2,status:'finished'});
    assert.equal((await call('/api/matches/1/score',{version:m.version+1,side:'a',delta:-1},token)).status,403);
    m=await getMatch(1);
    await call('/api/matches/1/edit',{...m,a:0,status:'live'});
    assert.equal((await call('/api/tables/3',undefined,token)).status,401);
    for(let i=0;i<5;i++) assert.equal((await call('/api/tables/2/login',{pin:'111111'},'')).status,401);
    assert.equal((await call('/api/tables/2/login',{pin:'654321'},'')).status,429);
    await new Promise(r=>server.close(r)); await start(); await login();
    assert.equal((await call('/api/tables/2/login',{pin:'654321'},'')).status,429);
    // Lockout is per table; other tables can still authenticate.
    assert.equal((await call('/api/tables/3/login',{pin:'234567'},'')).status,200);
    const db=new DatabaseSync(dbPath);
    const encoded=db.prepare('SELECT pin_hash FROM matches WHERE id=1').get().pin_hash;
    assert.match(encoded,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    const audit=JSON.stringify(db.prepare('SELECT detail FROM audit').all());
    assert.ok(!audit.includes('234567'));assert.ok(!audit.includes('pin_hash'));assert.ok(!audit.includes(encoded));
    db.prepare('UPDATE pin_attempts SET until=0 WHERE table_no=2').run();db.close();
    assert.equal((await call('/api/tables/2/login',{pin:'654321'},'')).status,200);
  }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

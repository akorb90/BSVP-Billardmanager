import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scryptSync } from 'node:crypto';
import { createApp } from '../src/server.js';
import { changeScore, breaker } from '../src/domain.js';

test('Wechselbreak folgt der Rackzahl, einschließlich Korrekturen', () => {
  const initial = { a:0, b:0, first:'b',pin:'012345', target:2, status:'live' };
  assert.equal(breaker(initial), 'b');
  const next = changeScore(initial,'a',1);
  assert.equal(breaker(next), 'a');
  assert.equal(breaker(changeScore(next,'a',-1)), 'b');
  assert.throws(() => changeScore(initial,'a',-1));
  assert.throws(() => changeScore({...initial,a:2},'b',1));
  assert.throws(() => changeScore({...initial,status:'finished'},'a',1));
});

test('Spieltag, Tischrechte, Konflikte, Abschluss und Persistenz', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'billard-test-'));
  const config = { adminHash:`salt:${scryptSync('test-password','salt',64).toString('hex')}`, tables:Array.from({length:8},(_,i) => `table-${i}-` + 'x'.repeat(40)) };
  let server, base, cookie='', csrf='';
  const start = async () => {
    server = createApp({ dbPath:join(dir,'test.sqlite'),config,origin:'http://localhost:3000' });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); base = `http://127.0.0.1:${server.address().port}`;
  };
  const request = async (path, data, { admin=true, key, origin='http://localhost:3000', csrfValue=csrf }={}) => {
    const headers = { Origin:origin, 'Content-Type':'application/json', 'X-CSRF-Token':csrfValue };
    if (admin && cookie) headers.Cookie = cookie;
    if (key) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(base+path,{method:data ? 'POST':'GET',headers,body:data ? JSON.stringify(data):undefined});
    return { status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie'), headers:response.headers };
  };
  try {
    await start();
    assert.equal((await request('/api/admin')).status,401);
    assert.equal((await request('/api/login',{password:'bad'})).status,401);
    const login = await request('/api/login',{password:'test-password'});
    assert.equal(login.status,200); cookie=login.cookie.split(';')[0]; csrf=login.body.csrf;
    assert.match(login.cookie,/HttpOnly/); assert.match(login.cookie,/SameSite=Strict/);
    assert.equal((await request('/api/events',{name:'Liga',kind:'Liga',date:'2026-10-26'},{csrfValue:'wrong'})).status,403);
    assert.equal((await request('/api/events',{name:'Liga',kind:'Liga',date:'2026-10-26'},{origin:'https://evil.test'})).status,403);
    assert.equal((await request('/api/events',{name:'Liga',kind:'Liga',date:'2026-99-99'})).status,400);
    assert.equal((await request('/api/events',{name:'Liga',kind:'Liga',date:'2026-02-30'})).status,400);
    assert.equal((await request('/api/events',{name:'Liga',kind:'Liga',date:'2026-10-26'})).status,201);
    for (let i=0;i<2;i++) assert.equal((await request('/api/matches',{event_id:1,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:2,first:'b',pin:'012345'})).status,201);
    assert.equal((await request('/api/matches/1/start',{lag_winner:'a',first:'b',table_no:1,version:0})).status,200);
    assert.equal((await request('/api/matches/2/start',{lag_winner:'a',first:'b',table_no:1,version:0})).status,409);
    assert.equal((await request('/api/tables/1',undefined,{admin:false})).status,401);
    assert.equal((await request('/api/tables/2',undefined,{admin:false,key:config.tables[0]})).status,200);
    const kiosk = { admin:false,key:(await request('/api/tables/1/login',{pin:'012345'},{admin:false})).body.token };
    assert.equal((await request('/api/tables/1',undefined,kiosk)).body.match.breaker,'b');
    assert.equal((await request('/api/matches/1/score',{side:'a',delta:1,version:1},{admin:false,key:config.tables[1]})).status,403);
    const simultaneous = await Promise.all([request('/api/matches/1/score',{side:'a',delta:1,version:1},kiosk),request('/api/matches/1/score',{side:'b',delta:1,version:1},kiosk)]);
    assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
    const match = (await request('/api/tables/1',undefined,kiosk)).body.match;
    assert.equal(match.a+match.b,1); assert.equal(match.breaker,'a');
    assert.equal((await request('/api/matches/1/finish',{version:2})).status,409);
    const side = match.a ? 'a':'b';
    assert.equal((await request('/api/matches/1/score',{side,delta:1,version:2},kiosk)).status,200);
    assert.equal((await request('/api/matches/1/score',{side,delta:1,version:3},kiosk)).status,400);
    assert.equal((await request('/api/matches/1/finish',{version:3},{admin:false})).status,403);
    assert.equal((await request('/api/matches/1/finish',{version:3},{admin:false,key:config.tables[1]})).status,403);
    assert.equal((await request('/api/matches/1/finish',{version:2},kiosk)).status,409);
    assert.equal((await request('/api/matches/1/finish',{version:3},kiosk)).status,200);
    assert.equal((await request('/api/matches/1/finish',{version:3})).status,409);
    assert.equal((await request('/api/matches/1/score',{side,delta:-1,version:4},kiosk)).status,403);
    assert.equal((await request('/api/tables/1',undefined,kiosk)).body.match,null);
    assert.equal((await request('/api/matches/2/start',{lag_winner:'a',first:'b',table_no:1,version:0})).status,200);
    await new Promise(resolve=>server.close(resolve));
    await start(); cookie='';
    assert.equal((await request('/api/tables/1',undefined,kiosk)).status,401);
    kiosk.key=(await request('/api/tables/1/login',{pin:'012345'},{admin:false})).body.token;
    assert.equal((await request('/api/tables/1',undefined,kiosk)).body.match.id,2);
    assert.equal((await request('/api/admin')).status,401);
    const relogin = await request('/api/login',{password:'test-password'});
    cookie=relogin.cookie.split(';')[0]; csrf=relogin.body.csrf;
    assert.equal((await request('/api/matches/2/finish',{version:1},kiosk)).status,409);
    assert.equal((await request('/api/matches/2/score',{side:'b',delta:1,version:1},kiosk)).status,200);
    assert.equal((await request('/api/matches/2/score',{side:'b',delta:1,version:2},kiosk)).status,200);
    assert.equal((await request('/api/matches/2/finish',{version:3})).status,200);
    const results=(await request('/api/admin')).body.matches;
    assert.equal(results.filter(m=>m.status==='finished').length,2);
    assert.match((await request('/health')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
  } finally { if (server?.listening) await new Promise(resolve=>server.close(resolve)); rmSync(dir,{recursive:true,force:true}); }
});

test('Login-Versuche sind begrenzt', async () => {
  const config={adminHash:`salt:${scryptSync('password','salt',64).toString('hex')}`,tables:Array(8).fill('a'.repeat(40))};
  const server=createApp({dbPath:':memory:',config});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    for(let i=0;i<11;i++) {
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/login`,{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})});
      assert.equal(response.status,i===10?429:401); await response.text();
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('CORS erlaubt nur explizite Origins und behält CSRF-Schutz bei', async () => {
  const config = { adminHash:`salt:${scryptSync('password','salt',64).toString('hex')}`, tables:Array(8).fill('x'.repeat(40)) };
  const server = createApp({ dbPath:':memory:', config, origin:'https://localhost' });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const preflight = origin => fetch(base+'/api/login', { method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type, x-csrf-token, authorization'} });
  try {
    for (const origin of ['https://localhost','https://127.0.0.1']) {
      const response = await preflight(origin);
      assert.equal(response.status,204);
      assert.equal(response.headers.get('access-control-allow-origin'),origin);
      assert.equal(response.headers.get('access-control-allow-credentials'),'true');
      assert.equal(response.headers.get('vary'),'Origin');
    }
    for (const origin of ['https://evil.test','https://127.0.0.1.evil.test','https://127.0.0.1:444','http://127.0.0.1','null']) {
      const response = await preflight(origin);
      assert.equal(response.status,403);
      assert.equal(response.headers.get('access-control-allow-origin'),null);
    }
    const login = await fetch(base+'/api/login',{method:'POST',headers:{Origin:'https://127.0.0.1','Content-Type':'application/json'},body:JSON.stringify({password:'password'})});
    assert.equal(login.status,200);
    assert.equal(login.headers.get('access-control-allow-origin'),'https://127.0.0.1');
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const response = await fetch(base+'/api/events',{method:'POST',headers:{Origin:'https://127.0.0.1','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({name:'Test',kind:'Liga',date:'2026-10-26'})});
    assert.equal(response.status,403);
    const logo = await fetch(base+'/assets/bsv-logo.png');
    assert.equal(logo.status,200);
    assert.equal(logo.headers.get('content-type'),'image/png');
    assert.deepEqual([...new Uint8Array(await logo.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/server.js';
test('Vorbereitung ist Pflicht, Timer bleiben erhalten und stoppen beim Abschluss',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'billard-time-')),dbPath=join(dir,'db.sqlite');
 const config={adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
 let server,base,cookie,csrf,token='';
 async function start(){server=createApp({dbPath,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 async function call(path,data,admin=true){
    if(data && /\/matches\/\d+\/edit$/.test(path)) {const snapshot=(await call('/api/admin')).body;const m=snapshot.matches.find(m=>m.id===Number(path.split('/')[3]));data={...data,event_version:snapshot.events.find(e=>e.id===m.event_id).version,action:'match:edit',confirmation:'SPIEL ÄNDERN'};}
const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(admin?{Cookie:cookie||'','X-CSRF-Token':csrf||''}:{Authorization:'Bearer '+token})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};}
 async function login(){const r=await call('/api/login',{password:'password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}
 try{
 await start();await login();await call('/api/events',{name:'Test',kind:'Liga',date:'2026-10-26'});
 assert.equal((await call('/api/matches',{event_id:1,player_a:'A',player_b:'B',discipline:'8-Ball',target:2,pin:'012345'})).status,201);
 let r=await call('/api/matches/1/start',{table_no:1,version:0});assert.equal(r.status,200);assert.equal(r.body.started_at,null);
 assert.equal((await call('/api/matches/1/begin',{lag_winner:'a',first:'b',version:1},false)).status,403);
 token=(await call('/api/tables/1/login',{pin:'012345'},false)).body.token;
 assert.equal((await call('/api/matches/1/score',{version:1,side:'a',delta:1},false)).status,409);
 assert.equal((await call('/api/matches/1/begin',{lag_winner:'a',version:1},false)).status,400);
 r=await call('/api/matches/1/begin',{lag_winner:'a',first:'b',version:1},false);
 assert.equal(r.status,200);assert.equal(r.body.breaker,'b');assert.equal(r.body.lag_winner,'a');assert.ok(r.body.started_at>0);
 assert.equal((await call('/api/matches/1/begin',{lag_winner:'b',first:'a',version:2},false)).status,409);
 const db=new DatabaseSync(dbPath),earlier=Date.now()-61000;
 db.prepare('UPDATE matches SET running_since=?,started_at=?,rack_since=? WHERE id=1').run(earlier,earlier,earlier+57000);db.close();
 await new Promise(r=>server.close(r));await start();await login();
 token=(await call('/api/tables/1/login',{pin:'012345'},false)).body.token;
 let m=(await call('/api/tables/1',undefined,false)).body.match;assert.equal(m.started_at,earlier);assert.equal(m.running_since,earlier);
 r=await call('/api/matches/1/score',{version:2,side:'a',delta:1},false);assert.equal(r.body.running_since,earlier);assert.ok(r.body.rack_since>earlier+57000);
 r=await call('/api/matches/1/score',{version:3,side:'a',delta:1},false);assert.equal(r.body.rack_since,null);
 r=await call('/api/matches/1/finish',{action:'match:finish',confirmation:'SPIEL ABSCHLIESSEN',version:4},false);assert.equal(r.status,200);assert.ok(r.body.elapsed_ms>=61000);assert.equal(r.body.running_since,null);
 const elapsed=r.body.elapsed_ms;
 m=(await call('/api/admin')).body.matches[0];
 r=await call('/api/matches/1/edit',{...m,status:'live',a:1});assert.equal(r.status,200);assert.equal(r.body.elapsed_ms,elapsed);assert.ok(r.body.running_since>=earlier+61000);
 r=await call('/api/matches/1/edit',{...r.body,status:'planned',table_no:null,a:0,b:0});assert.equal(r.status,200);assert.equal(r.body.setup_done,0);assert.equal(r.body.started_at,null);assert.equal(r.body.elapsed_ms,0);
 const html=await (await fetch(base)).text();assert.ok(!html.includes('Punkteübersicht'));
 }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

// Opt in through ADMIN_BENCHMARK=1 node scripts/docker-smoke.js.
// Runs inside that disposable Compose project, never against application data.
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {createHash,scryptSync} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {openDatabase} from './src/database.js';
import {createApp} from './src/server.js';

assert.match(process.env.ADMIN_BENCHMARK_PROJECT||'',/^bsvp-smoke-[a-f0-9]{12}$/,'only the disposable smoke project may run this benchmark');
const project=process.env.ADMIN_BENCHMARK_PROJECT,database='admin_benchmark_'+Date.now();
const connection=new URL(process.env.DATABASE_URL);
connection.password=createHash('sha256').update(readFileSync(process.env.DATABASE_PASSWORD_CONFIG)).digest('hex');
const admin=new pg.Client({connectionString:connection.toString()});await admin.connect();
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+database;
const config={adminHash:'benchmark:'+scryptSync('benchmark-only','benchmark',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
let db,server,queryCount=0,matchReads=0;
const originalQuery=pg.Client.prototype.query;
pg.Client.prototype.query=function(sql,...args){queryCount++;if(/\bFROM matches\b/i.test(typeof sql==='string'?sql:sql.text))matchReads++;return originalQuery.call(this,sql,...args);};
const results=[];
const clientCode=`const {parentPort,workerData}=require('node:worker_threads');const {performance}=require('node:perf_hooks');
parentPort.on('message',async({clients,cycles})=>{try{const samples=[];for(let cycle=0;cycle<cycles;cycle++){const began=performance.now();samples.push(...await Promise.all(Array.from({length:clients},async()=>{const start=performance.now();const r=await fetch(workerData.base+'/api/admin/live',{headers:{Cookie:workerData.cookie}});if(r.status!==200)throw Error('HTTP '+r.status);const body=await r.arrayBuffer();return{ms:performance.now()-start,bytes:body.byteLength};})));if(cycle+1<cycles)await new Promise(r=>setTimeout(r,Math.max(0,3000-(performance.now()-began))));}parentPort.postMessage({samples});}catch(e){parentPort.postMessage({error:e.message});}});`;
let worker;
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  db=await openDatabase({databaseUrl:url.toString(),config});
  const tick=Date.now();
  await db.exec(`INSERT INTO players(id,first_name,last_name) SELECT 'p'||n,'Test','Player '||n FROM generate_series(1,100) n;
    INSERT INTO teams(id,name) SELECT 't'||n,'Test team '||n FROM generate_series(1,10) n;
    INSERT INTO team_players(team_id,player_id) SELECT CASE WHEN n<=50 THEN 't1' ELSE 't2' END,'p'||n FROM generate_series(1,100) n;`);
  server=await createApp({databaseUrl:url.toString(),config});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({password:'benchmark-only'})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  worker=new Worker(clientCode,{eval:true,execArgv:[],workerData:{base,cookie}});
  const measure=(clients,cycles)=>new Promise((resolve,reject)=>{worker.once('message',message=>{worker.off('error',reject);message.error?reject(Error(message.error)):resolve(message.samples);});worker.once('error',reject);worker.postMessage({clients,cycles});});
  for(const matches of [100,1000,10000]) {
    const events=Math.ceil(matches/20);
    await db.transaction(async()=>{
      await db.exec(`DELETE FROM event_match_slots;DELETE FROM matches;DELETE FROM event_players;DELETE FROM event_teams;DELETE FROM event_planning;DELETE FROM events;
        INSERT INTO events(id,name,kind,date,status,version) SELECT n,'Archived league '||n,'Liga','2026-10-01','closed',0 FROM generate_series(1,${events}) n;
        INSERT INTO event_planning(event_id,started,source_id,metadata) SELECT id,1,NULL,'{}' FROM events;
        INSERT INTO matches(id,event_id,player_a,player_b,player_a_id,player_b_id,discipline,target,first,a,b,status,setup_done,started_at,elapsed_ms)
        SELECT n,1+(n-1)/20,'Test A','Test B','p'||(1+(n-1)%50),'p'||(51+(n-1)%50),'9-Ball',5,'a',5,2,'finished',1,${tick},600000 FROM generate_series(1,${matches}) n;
        INSERT INTO event_teams(event_id,team_id) SELECT id,team FROM events CROSS JOIN (VALUES('t1'),('t2')) AS teams(team);
        INSERT INTO event_players(event_id,player_id,team_id) SELECT DISTINCT m.event_id,p.id,tp.team_id FROM matches m JOIN players p ON p.id=m.player_a_id OR p.id=m.player_b_id JOIN team_players tp ON tp.player_id=p.id;
        INSERT INTO event_match_slots(event_id,slot) SELECT id,n FROM events CROSS JOIN generate_series(1,10) n;
        UPDATE entity_ids SET value=CASE name WHEN 'events' THEN ${events} WHEN 'matches' THEN ${matches} ELSE value END;`);
    });
    await db.exec(`INSERT INTO events(id,name,kind,date,status) VALUES(${events+1},'Live league','Liga','2026-11-01','open');
      INSERT INTO matches(id,event_id,player_a,player_b,discipline,target,first,status,table_no) SELECT ${matches}+n,${events+1},'Live A','Live B','9-Ball',5,'a','live',n FROM generate_series(1,8) n;`);
    const get=async path=>{const r=await fetch(base+path,{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
    const live=await get('/api/admin/live');assert.equal(live.matches.length,8);
    const archive=await get('/api/admin/view?view=ergebnisse');assert.equal(archive.matches.length,20);assert.equal(archive.pages['matches-ergebnisse'].total,matches);
    const stats=await get('/api/admin/view?view=spieler&kind=players&id=p1');assert.equal(stats.statistics.count,matches/50);assert.equal(stats.pages['player-matches'].total,matches/50);
    const eventPage=await get('/api/admin/view?view=spieltage');assert.ok(eventPage.pages.events.items.length<=20);
    const detail=await get('/api/admin/view?view=spieltage&event=1');assert.equal(detail.matches.length,20);
    for(const clients of [1,5,10]) {
      await measure(clients,1);queryCount=0;matchReads=0;
      const began=performance.now(),samples=await measure(clients,3),elapsedMs=performance.now()-began;
      const times=samples.map(s=>s.ms).sort((a,b)=>a-b),percentile=p=>times[Math.ceil(times.length*p)-1];
      assert.ok(samples.every(s=>s.bytes<=256*1024),'live response exceeds 256 KiB');
      if(matches===10000&&clients===10)assert.ok(percentile(.95)<=500,'live p95 exceeds 500 ms');
      results.push({matches,events,liveMatches:8,endpoint:'/api/admin/live',players:100,teams:10,clients,cycles:3,pollIntervalMs:3000,requests:samples.length,bytesPerResponse:samples[0].bytes,queriesPerRequest:queryCount/samples.length,matchReadsPerRequest:matchReads/samples.length,medianMs:percentile(.5),p95Ms:percentile(.95),maxMs:times.at(-1),elapsedMs,estimatedMiBPerMinute:samples[0].bytes*clients*20/1024/1024,serverHeapMiB:process.memoryUsage().heapUsed/1024/1024});
    }
  }
  console.log('ADMIN_BENCHMARK_RESULT '+JSON.stringify({project,node:process.version,database:'PostgreSQL 17',transport:'HTTP loopback inside disposable app container; clients in worker thread',budgets:{maxLiveBytes:262144,maxP95MsAt10000ArchiveAnd10Clients:500,passed:true},workload:'finished league archive plus 8 live matches, 100 players, 10 teams; excludes tournament metadata, real device rendering and WLAN/TLS overhead',results}));
} finally {
  if(worker)await worker.terminate();
  if(server?.listening)await new Promise(r=>server.close(r));
  if(db)await db.close();
  pg.Client.prototype.query=originalQuery;
  try{await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);}finally{await admin.end();}
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Windows/Docker Desktop smoke check. Each run owns a unique Compose project.
const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, 'data'), { recursive: true });
const directory = mkdtempSync(join(root, 'data', 'docker-test-'));
const project = `bsvp-smoke-${randomBytes(6).toString('hex')}`;
const port = Number(process.env.DOCKER_TEST_PORT || 18443);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const origin = `https://localhost:${port}`;
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
const config = {
  adminHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`,
  tables: Array.from({ length: 8 }, () => randomBytes(32).toString('hex')),
};
writeFileSync(join(directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
writeFileSync(join(directory, 'compose.yaml'), `services:
  app:
    environment:
      APP_ORIGIN: ${origin}
    volumes:
      - type: bind
        source: ${JSON.stringify(join(directory, 'config.json').replaceAll('\\', '/'))}
        target: /run/secrets/app_config
        read_only: true
        bind:
          create_host_path: false
  proxy:
    environment:
      BILLARD_HOST: localhost
    ports: !override
      - "127.0.0.1:${port}:443"
`);
const composeArgs = ['compose', '--project-name', project, '--env-file', join(root, '.env.example'), '-f', join(root, 'compose.yaml'), '-f', join(directory, 'compose.yaml')];
function docker(args, capture = false) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn('docker', args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; if (!capture) process.stdout.write(data); });
    child.stderr.on('data', data => { if (!capture) process.stderr.write(data); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveCommand(output.trim()) : reject(new Error(`Docker ${args[0]} exited with ${code}`)));
  });
}
const compose = (args, capture = false) => docker([...composeArgs, ...args], capture);
let ca, cookie = '', csrf = '';
function request(path, data, { admin = true, key, requestOrigin = origin, csrfValue = csrf, hostname = 'localhost' } = {}) {
  return new Promise((resolveRequest, reject) => {
    const headers = { Origin: requestOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfValue };
    if (admin && cookie) headers.Cookie = cookie;
    if (key) headers.Authorization = `Bearer ${key}`;
    const req = https.request({ hostname: '127.0.0.1', servername: hostname === 'localhost' ? 'localhost' : '', port, path, ca, rejectUnauthorized: true, method: data ? 'POST' : 'GET', headers: { ...headers, Host: `${hostname}:${port}` } }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolveRequest({ status: res.statusCode, headers: res.headers, body: res.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : raw }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('HTTPS request timeout')));
    req.end(data ? JSON.stringify(data) : undefined);
  });
}
async function ready() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await request('/health')).status === 200) return; } catch { /* startup */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 1000));
  }
  throw new Error('HTTPS health endpoint did not become ready');
}
async function login() {
  const result = await request('/api/login', { password });
  assert.equal(result.status, 200);
  const header = result.headers['set-cookie'][0];
  assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); assert.match(header, /; Secure/);
  cookie = header.split(';')[0]; csrf = result.body.csrf;
}
try {
  console.log(`Building isolated Docker test stack ${project}`);
  await compose(['up', '-d', '--build', '--wait', '--wait-timeout', '120']);
  await compose(['cp', 'proxy:/data/caddy/pki/authorities/local/root.crt', join(directory, 'root.crt')]);
  ca = readFileSync(join(directory, 'root.crt'));
  await ready();
  assert.equal((await request('/health', undefined, {hostname:'127.0.0.1'})).status,200);
  const ipLogin = await request('/api/login', {password}, {hostname:'127.0.0.1',requestOrigin:`https://127.0.0.1:${port}`});
  assert.equal(ipLogin.status,200);
  assert.equal(ipLogin.headers['access-control-allow-origin'],`https://127.0.0.1:${port}`);
  console.log('PASS: 127.0.0.1 HTTPS certificate, login and CORS origin');
  const page = await request('/tisch/1');
  assert.equal(page.status, 200); assert.match(page.body, /Billardmanager/);
  assert.match(page.headers['strict-transport-security'], /max-age=/);
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
  for (const asset of ['/app.js', '/rental-pricing.js', '/style.css']) assert.equal((await request(asset)).status, 200);
  assert.equal((await request('/api/admin')).status, 401);
  await login();
  const brand=(await request('/api/branding',undefined,{admin:false})).body;
  const logo='data:image/png;base64,'+readFileSync(join(root,'public','assets','bsv-logo.png')).toString('base64');
  assert.equal((await request('/api/settings/branding',{...brand,club_name:'Docker Testverein',primary:'#8b3624',logo},{admin:false})).status,401);
  assert.equal((await request('/api/settings/branding',{...brand,club_name:'Docker Testverein',primary:'#8b3624',logo})).status,200);
  assert.equal((await request('/api/branding',undefined,{admin:false})).body.club_name,'Docker Testverein');
  assert.match((await request('/branding.css',undefined,{admin:false})).body,/--primary:#8b3624/);
  assert.equal((await request('/api/branding/logo',undefined,{admin:false})).headers['content-type'],'image/png');
  console.log('PASS: HTTPS club name, color scheme and authenticated logo upload');
  const event = { name: 'Docker Testspieltag', kind: 'Liga', date: '2026-10-26' };
  assert.equal((await request('/api/events', event, { csrfValue: 'invalid' })).status, 403);
  assert.equal((await request('/api/events', event, { requestOrigin: 'https://example.invalid' })).status, 403);
  assert.equal((await request('/api/events', event)).status, 201);
  assert.equal((await request('/api/matches', { event_id: 1, player_a: 'Test A', player_b: 'Test B', discipline: '9-Ball', target: 2, first: 'a',pin:'012345' })).status, 201);
  assert.equal((await request('/api/matches/1/start',{lag_winner:'a',first:'a', table_no: 1, version: 0 })).status, 200);
  const kiosk = { admin:false,key:(await request('/api/tables/1/login',{pin:'012345'},{admin:false})).body.token };
  assert.equal((await request('/api/tables/2', undefined, kiosk)).status, 200);
  const scored = await request('/api/matches/1/score', { side: 'a', delta: 1, version: 1 }, kiosk);
  assert.equal(scored.status, 200); assert.equal(scored.body.a, 1); assert.equal(scored.body.breaker, 'b');
  assert.equal((await request('/api/matches/1/score', { side: 'a', delta: 1, version: 1 }, kiosk)).status, 409);
  console.log('PASS: verified TLS chain, frontend, secure login, CSRF/origin, table isolation, scoring and break');

  const rental=await request('/api/rentals',{table_no:2,settings_version:0,mode:'percent',value:-20});
  assert.equal(rental.status,201); assert.equal(rental.body.hourly_cents,720);
  assert.equal((await request('/api/rentals',{table_no:2,settings_version:0})).status,409);
  assert.equal((await request('/api/rentals/1/finish',{version:0},kiosk)).status,401);
  const container = await compose(['ps', '-q', 'app'], true);
  const [inspection] = JSON.parse(await docker(['inspect', container], true));
  assert.equal(inspection.Config.User, 'node');
  assert.equal(inspection.HostConfig.ReadonlyRootfs, true);
  assert.ok(inspection.HostConfig.CapDrop.some(value => value.toUpperCase() === 'ALL'));
  assert.ok(inspection.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
  assert.ok(Object.values(inspection.NetworkSettings.Ports || {}).every(value => value === null));
  assert.equal(await compose(['exec', '-T', 'app', 'id', '-u'], true), '1000');
  console.log('PASS: non-root app, read-only root filesystem, dropped capabilities, no public app port');

  await compose(['restart', 'app']);
  await ready();
  assert.equal((await request('/api/admin')).status, 401);
  assert.equal((await request('/api/tables/1',undefined,kiosk)).status,401);
  kiosk.key=(await request('/api/tables/1/login',{pin:'012345'},{admin:false})).body.token;
  assert.equal((await request('/api/tables/1', undefined, kiosk)).body.match.a, 1);
  console.log('PASS: score survives restart; previous admin session is invalid');
  await compose(['up', '-d', '--force-recreate', '--no-deps', '--wait', 'app']);
  await ready();
  assert.equal((await request('/api/tables/1',undefined,kiosk)).status,401);
  kiosk.key=(await request('/api/tables/1/login',{pin:'012345'},{admin:false})).body.token;
  assert.equal((await request('/api/tables/1', undefined, kiosk)).body.match.a, 1);
  await login();
  const restored=(await request('/api/admin')).body.rentals.find(r=>r.id===rental.body.id);
  assert.equal(restored.started_at,rental.body.started_at); assert.equal(restored.hourly_cents,720);
  const rentalFinish={version:0,ended_at:Date.now(),action:'rental:finish'};
  const finished=(await request('/api/rentals/1/finish',rentalFinish)).body;
  assert.equal(finished.status,'finished');
  assert.deepEqual((await request('/api/rentals/1/finish',rentalFinish)).body,finished);
  const end=Date.now()-1000;
  const correction={version:finished.version,started_at:end-1801000,ended_at:end,mode:'direct',value:9,action:'rental:edit',confirmation:'BUCHUNG ÄNDERN'};
  assert.equal((await request('/api/rentals/1/edit',{...correction,confirmation:''})).status,400);
  const corrected=await request('/api/rentals/1/edit',correction);
  assert.equal(corrected.status,200); assert.equal(corrected.body.total_cents,465);
  assert.equal((await request('/api/rentals/1/edit',correction)).status,409);
  const removeRental={version:corrected.body.version,action:'rental:delete',confirmation:'BUCHUNG LÖSCHEN'};
  assert.equal((await request('/api/rentals/1/delete',{...removeRental,confirmation:''})).status,400);
  assert.equal((await request('/api/rentals/1/delete',removeRental)).status,200);
  assert.equal((await request('/api/admin')).body.rentals.length,0);
  console.log('PASS: rental price, double booking, tablet denial, restart persistence, finish and confirmed correction');
  assert.equal((await request('/api/admin')).body.events[0].name, event.name);
  assert.equal((await request('/api/matches/1/score', { side: 'a', delta: 1, version: 2 }, kiosk)).status, 200);
  assert.equal((await request('/api/matches/1/finish', { version: 3, action:'match:finish', confirmation:'SPIEL ABSCHLIESSEN' }, kiosk)).status, 200);
  assert.equal((await request('/api/tables/1', undefined, kiosk)).body.match, null);
  const completed=(await request('/api/admin')).body.matches[0];
  assert.equal((await request('/api/matches/1/edit',{...completed,a:0,b:2,player_b:'Korrigierter Spieler',event_version:(await request('/api/admin')).body.events[0].version,action:'match:edit',confirmation:'SPIEL ÄNDERN'})).status,200);
  const eventState=(await request('/api/admin')).body.events[0];
  assert.equal((await request('/api/events/1/close',{version:eventState.version,action:'event:close',confirmation:'EVENT ABSCHLIESSEN'})).status,200);
  assert.equal((await request('/api/matches/1/delete',{version:completed.version+1})).status,409);
  const closedState=(await request('/api/admin')).body;
  const correctionAfterClose={...closedState.matches[0],player_a:'Korrektur nach Gesamtabschluss',event_version:closedState.events[0].version,action:'match:edit',confirmation:'SPIEL ÄNDERN'};
  assert.equal((await request('/api/matches/1/edit',correctionAfterClose)).status,200);
  const deletionState=(await request('/api/admin')).body;
  const deletion={version:deletionState.events[0].version,action:'event:delete',confirmation:'EVENT LÖSCHEN'};
  assert.equal((await request('/api/events/1/delete',{...deletion,confirmation:''})).status,400);
  assert.equal((await request('/api/events/1/delete',deletion)).status,200);
  assert.equal((await request('/api/admin')).body.matches.length,0);
  console.log('PASS: confirmed correction and cascading deletion after event closure; missing confirmation denied');
  console.log('PASS: volume survives container replacement; match finishes and table becomes available');
  const backup = await request('/api/backups/export');
  assert.equal(backup.status,200); assert.match(backup.headers['content-disposition'],/attachment/);
  assert.equal(backup.body.data.events.length,0);
  assert.equal((await request('/api/backups/export',undefined,{admin:false})).status,401);
  assert.equal((await request('/api/backups/preview',{backup:backup.body},{csrfValue:'bad'})).status,403);
  assert.equal((await request('/api/backups/preview',{backup:backup.body})).status,200);
  assert.equal((await request('/api/backups/restore',{backup:backup.body,action:'backup:restore',confirmation:'wrong'})).status,400);
  assert.equal((await request('/api/backups/restore',{backup:backup.body,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'})).status,200);
  assert.equal((await request('/api/admin')).status,401);
  await login();
  const imported=await request('/api/backups/export');
  for(const name of Object.keys(backup.body.data)) if(name!=='audit') assert.deepEqual(imported.body.data[name],backup.body.data[name]);
  assert.equal(imported.body.data.audit.at(-1).action,'backup:restore');
  console.log('PASS: HTTPS backup download, upload preview, confirmed atomic restore and session revocation');
  writeFileSync(join(directory, 'result.json'), JSON.stringify({ project, passed: true, testedAt: new Date().toISOString(), image: inspection.Image }, null, 2));
  console.log('All Docker smoke checks passed.');
} catch (error) {
  await compose(['logs', '--no-color', '--tail', '50']).catch(() => {});
  throw error;
} finally {
  // This random project was created by this run; only its disposable volumes are removed.
  assert.match(project, /^bsvp-smoke-[a-f0-9]{12}$/);
  await compose(['down', '--volumes', '--remove-orphans']);
  console.log(`Removed disposable test containers and volumes. Local report: ${resolve(directory)}`);
}

import { playerService } from './players.js';
import http from 'node:http';
import { tableService } from './tables.js';
import { backupService, BACKUP_LIMIT } from './backup.js';
import { loadConfig } from './config.js';
import { rentalService } from './rentals.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { openDatabase } from './database.js';
import { fileURLToPath } from 'node:url';
import { changeScore, breaker } from './domain.js';
import { brandingService, LOGO_LIMIT } from './branding.js';

export async function createApp({ dbPath, databaseUrl, legacyPath, config, origin = 'http://localhost:3000' }) {
  const allowedOrigins = new Set([new URL(origin).origin]);
  const localOrigin = new URL(origin);
  for (const hostname of ['localhost', '127.0.0.1']) {
    localOrigin.hostname = hostname;
    allowedOrigins.add(localOrigin.origin);
  }
  if (!config.adminHash || config.tables?.length !== 8 || config.tables.some(k => typeof k !== 'string' || k.length < 32)) throw new Error('Ungültige Sicherheitskonfiguration; npm run setup ausführen.');
  const db = await openDatabase({dbPath, databaseUrl, legacyPath, config});
  const adminHash = async () => (await db.prepare('SELECT password_hash FROM admin_credentials WHERE id=1').get()).password_hash;
  const sessions = new Map(), attempts = new Map(), tabletSessions = new Map();
  const hash = s => createHash('sha256').update(s).digest('hex');
  const equal = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const text = (v, max = 100) => { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw fail(400, 'Bitte gültige Texte eingeben.'); return v.trim(); };
  const integer = (v, min, max) => { if (!Number.isInteger(v) || v < min || v > max) throw fail(400, 'Ungültiger Zahlenwert.'); return v; };
  const log = async (actor, action, id, detail) => await db.prepare('INSERT INTO audit(actor,action,match_id,detail) VALUES(?,?,?,?)').run(actor, action, id, JSON.stringify(detail, (key,value) => ['pin','pin_hash'].includes(key) ? undefined : value));
  const transaction = fn => db.transaction(fn);
  const tables = tableService({db, transaction, fail, integer, log});
  const rentals = await rentalService({db, transaction, fail, integer, log, activeTable:tables.activeNumber});
  const branding = brandingService({db, transaction, fail, log});
  const backups = await backupService({db, transaction, fail, log});
  const nextId = async name => (await db.prepare('UPDATE entity_ids SET value=value+1 WHERE name=? RETURNING value').get(name)).value;
  const getEvent = async id => {
    const event = await db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if (!event) throw fail(404, 'Veranstaltung nicht gefunden.');
    return event;
  };
  const openEvent = async id => {
    const event = await getEvent(id);
    if (event.status !== 'open') throw fail(409, 'Diese Veranstaltung ist endgültig abgeschlossen.');
    return event;
  };
  const touchEvent = async id => await db.prepare('UPDATE events SET version=version+1 WHERE id=?').run(id);
  const confirm = (body, action, phrase) => {
    if (body.action !== action || body.confirmation !== phrase) throw fail(400, 'Die Aktion muss mit dem angezeigten Text exakt bestätigt werden.');
  };
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin'}).format(new Date());
  const players=playerService({db,transaction,fail,text,log,openEvent,touchEvent});
  const eventFields = body => {
    const name = text(body.name), kind = text(body.kind), date = text(body.date), parsed = new Date(date);
    if (!['Liga','Turnier'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw fail(400, 'Ungültige Veranstaltung.');
    return {name,kind,date};
  };
  const publicMatch = m => { if (!m) return m; const {pin_hash,auth_version,...safe}=m; return {...safe,pin_set:!!pin_hash,breaker:breaker(m),server_now:Date.now()}; };
  const encodePin = pin => {
    if (typeof pin !== 'string' || !/^[0-9]{6}$/.test(pin)) throw fail(400,'Die PIN muss genau sechs Ziffern enthalten.');
    const salt=randomBytes(16).toString('hex');
    return salt+':'+scryptSync(pin,salt,64).toString('hex');
  };
  const authorizedTablet = (auth,m) => auth && m && m.status==='live' && auth.id===m.id && auth.table===m.table_no && auth.revision===m.auth_version;
  const liveAt = async number => await db.prepare("SELECT m.*, e.name AS event_name FROM matches m JOIN events e ON e.id=m.event_id WHERE m.table_no=? AND m.status='live'").get(number);
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Cache-Control', 'no-store');
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
    for (const [key,value] of tabletSessions) if(value.expires < now) tabletSessions.delete(key);
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    try {
      const url = new URL(req.url, origin);
      const requestOrigin = req.headers.origin;
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('Vary', 'Origin');
        if (allowedOrigins.has(requestOrigin)) {
          res.setHeader('Access-Control-Allow-Origin', requestOrigin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        if (req.method === 'OPTIONS') {
          const requestedHeaders = (req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
          if (!allowedOrigins.has(requestOrigin) || !['GET', 'POST'].includes(req.headers['access-control-request-method']) || requestedHeaders.some(h => !['content-type', 'authorization', 'x-csrf-token'].includes(h))) throw fail(403, 'Ursprung, Methode oder Header nicht erlaubt.');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
          res.writeHead(204); return res.end();
        }
      }
      const sid = /(?:^|; )session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
      const session = sid && sessions.get(hash(sid));
      let table = 0;
      const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
      const tabletAuth = tabletSessions.get(hash(token));
      if (tabletAuth) table = tabletAuth.table;
      const admin = () => { if (!session) throw fail(401, 'Bitte anmelden.'); };
      let body = {};
      if (req.method === 'POST') {
        if (!allowedOrigins.has(requestOrigin)) throw fail(403, 'Ungültiger Ursprung.');
        if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON erforderlich.');
        const backupUpload = ['/api/backups/preview', '/api/backups/restore'].includes(url.pathname);
        const participantUpload=/^\/api\/events\/\d+\/participants$/.test(url.pathname);
        const brandingUpload = url.pathname === '/api/settings/branding';
        if (backupUpload || brandingUpload) { admin(); if (req.headers['x-csrf-token'] !== session.csrf) throw fail(403, 'Ungültiger CSRF-Schutz.'); }
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > (backupUpload ? BACKUP_LIMIT : brandingUpload ? Math.ceil(LOGO_LIMIT/3)*4+8192 : participantUpload ? 128*1024 : 8192)) throw fail(413, 'Anfrage zu groß.'); chunks.push(chunk); }
        const raw = Buffer.concat(chunks).toString('utf8');
        try { body = JSON.parse(raw); } catch { throw fail(400, 'Ungültiges JSON.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Ungültige Anfrage.');
        if (session && url.pathname !== '/api/login' && req.headers['x-csrf-token'] !== session.csrf) throw fail(403, 'Ungültiger CSRF-Schutz.');
      }
      if (req.method === 'GET' && url.pathname === '/health') { await db.prepare('SELECT 1').get(); return json(res, 200, { ok: true }); }
      if (req.method === 'POST' && url.pathname === '/api/settings/tables') { admin(); return json(res,200,await tables.save(body)); }
      if (req.method === 'GET' && url.pathname === '/api/branding') return json(res,200,await branding.publicState());
      if (req.method === 'POST' && url.pathname === '/api/settings/branding') {admin();return json(res,200,await branding.save(body));}
      if (req.method === 'GET' && url.pathname === '/api/branding/logo') {
        const logo=(await branding.get()).logo;
        res.setHeader('Content-Type',logo?.startsWith('data:image/jpeg;')?'image/jpeg':'image/png');
        return res.end(logo?Buffer.from(logo.split(',')[1],'base64'):readFileSync(new URL('../public/assets/bsv-logo.png',import.meta.url)));
      }
      if (req.method === 'GET' && url.pathname === '/branding.css') {
        const b=await branding.get();
        const rgb=b.primary.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
        const light=rgb.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)>.179;
        res.setHeader('Content-Type','text/css; charset=utf-8');
        return res.end(`:root{--primary:${b.primary};--background:${b.background};--surface:${b.surface};--text:${b.text};--on-primary:${light?'#000000':'#ffffff'};color-scheme:${parseInt(b.background.slice(1,3),16)>150?'light':'dark'}}`);
      }
      if (req.method === 'GET' && url.pathname === '/api/backups/export') {
        admin();
        const backup = await backups.export();
        res.setHeader('Content-Disposition', `attachment; filename="bsvp-sicherung-${backup.created_at.slice(0,10)}.json"`);
        return json(res, 200, backup);
      }
      if (req.method === 'POST' && url.pathname === '/api/backups/preview') { admin(); return json(res, 200, await backups.preview(body.backup, session)); }
      if (req.method === 'POST' && url.pathname === '/api/backups/restore') {
        admin(); const result = await backups.restore(body, session);
        sessions.clear(); tabletSessions.clear(); attempts.clear();
        res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return json(res, 200, result);
      }
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const key = req.socket.remoteAddress; const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
        if (attempt.count >= 10) throw fail(429, 'Zu viele Versuche. Bitte 15 Minuten warten.');
        attempt.count++; attempts.set(key, attempt);
        const [salt, expected] = (await adminHash()).split(':');
        const actual = scryptSync(typeof body.password === 'string' ? body.password : '', salt, 64).toString('hex');
        if (!equal(actual, expected)) throw fail(401, 'Anmeldung fehlgeschlagen.');
        attempts.delete(key); if (sid) sessions.delete(hash(sid));
        const id = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex');
        sessions.set(hash(id), { csrf, expires: now + 8 * 3600_000 });
        res.setHeader('Set-Cookie', `session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`);
        return json(res, 200, { csrf });
      }
      if (req.method === 'POST' && url.pathname === '/api/settings/password') {
        admin();
        const key='password:'+req.socket.remoteAddress;
        const attempt=attempts.get(key) || {count:0,until:now+15*60_000};
        if(attempt.count>=10) throw fail(429,'Zu viele Versuche. Bitte 15 Minuten warten.');
        attempt.count++; attempts.set(key,attempt);
        const [salt,expected]=(await adminHash()).split(':');
        const actual=scryptSync(typeof body.current_password==='string'?body.current_password:'',salt,64).toString('hex');
        if(!equal(actual,expected)) throw fail(400,'Das aktuelle Passwort ist nicht korrekt.');
        const password=body.new_password;
        if(typeof password!=='string' || password.length<12 || password.length>128 || !password.trim()) throw fail(400,'Das neue Passwort muss 12 bis 128 Zeichen enthalten.');
        if(password!==body.repeat_password) throw fail(400,'Die neuen Passwörter stimmen nicht überein.');
        if(password===body.current_password) throw fail(400,'Bitte ein anderes neues Passwort wählen.');
        const nextSalt=randomBytes(16).toString('hex'), encoded=nextSalt+':'+scryptSync(password,nextSalt,64).toString('hex');
        await transaction(async ()=>{
          await db.prepare('UPDATE admin_credentials SET password_hash=? WHERE id=1').run(encoded);
          await log('admin','admin:password',null,{changed:true});
        });
        sessions.clear(); attempts.delete(key);
        res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return json(res,200,{ok:true});
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') { admin(); sessions.delete(hash(sid)); res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res, 200, {}); }
      if (req.method === 'GET' && url.pathname === '/api/admin') { admin(); return json(res, 200, { ...await players.state(), table_settings:await tables.get(), ...await rentals.state(), csrf: session.csrf, events: await db.prepare('SELECT * FROM events ORDER BY date DESC,id DESC').all(), matches: (await db.prepare('SELECT * FROM matches ORDER BY id DESC').all()).map(publicMatch) }); }
      if (req.method === 'POST' && (url.pathname === '/api/rentals' || url.pathname.startsWith('/api/rentals/'))) {
        admin(); return json(res, url.pathname === '/api/rentals' ? 201 : 200, await rentals.handle(url.pathname,body));
      }
      if(req.method==='POST' && ['/api/players','/api/teams'].includes(url.pathname)) {admin();return json(res,200,await players.save(url.pathname==='/api/players'?'player':'team',body));}
      const participantRoute=/^\/api\/events\/(\d+)\/participants$/.exec(url.pathname);
      if(req.method==='POST' && participantRoute) {admin();return json(res,200,await players.participants(Number(participantRoute[1]),body));}
      const pinRoute = /^\/api\/tables\/([1-9]|1[0-9]|20)\/login$/.exec(url.pathname);
      if (req.method==='POST' && pinRoute) {
        const number=await tables.activeNumber(Number(pinRoute[1]));
        const m=await transaction(async () => {
          const attempt=await db.prepare('SELECT * FROM pin_attempts WHERE table_no=?').get(number);
          if(attempt && attempt.until>now && attempt.count>=5) throw fail(429,'Zu viele PIN-Versuche. Bitte 15 Minuten warten.');
          const count=attempt && attempt.until>now ? attempt.count+1 : 1, until=attempt && attempt.until>now ? attempt.until : now+15*60_000;
          await db.prepare('INSERT INTO pin_attempts VALUES(?,?,?) ON CONFLICT(table_no) DO UPDATE SET count=excluded.count,until=excluded.until').run(number,count,until);
          return liveAt(number);
        });
        const [salt,expected]=(m?.pin_hash || 'missing:invalid').split(':');
        const actual=scryptSync(typeof body.pin==='string' && /^[0-9]{6}$/.test(body.pin) ? body.pin : '',salt,64).toString('hex');
        if(!m?.pin_hash || !equal(actual,expected)) throw fail(401,'PIN ungültig oder keine Partie mit PIN gestartet.');
        await db.prepare('DELETE FROM pin_attempts WHERE table_no=?').run(number);
        // Bound memory usage even if an authorized client repeatedly logs in.
        const existing=[...tabletSessions].filter(([,v])=>v.table===number);
        if(existing.length>=16) tabletSessions.delete(existing[0][0]);
        const token=randomBytes(32).toString('hex');
        tabletSessions.set(hash(token),{id:m.id,table:number,revision:m.auth_version,expires:now+8*3600_000});
        return json(res,200,{token});
      }
      const tableRoute = /^\/api\/tables\/([1-9]|1[0-9]|20)$/.exec(url.pathname);
      if (req.method === 'GET' && tableRoute) {
        const number=await tables.activeNumber(Number(tableRoute[1])), m=await liveAt(number);
        if(m && !session && !authorizedTablet(tabletAuth,m)) throw fail(401,'Bitte die sechsstellige PIN der Partie eingeben.');
        return json(res,200,{match:publicMatch(m)||null});
      }
      if (req.method === 'POST' && url.pathname === '/api/events') {
        admin(); const {name,kind,date} = eventFields(body);
        const id = await transaction(async () => { const id=await nextId('events'); await db.prepare('INSERT INTO events(id,name,kind,date) VALUES(?,?,?,?)').run(id,name,kind,date); return id; });
        return json(res, 201, { id });
      }
      const eventRoute = /^\/api\/events\/(\d+)\/(edit|delete|close)$/.exec(url.pathname);
      if (req.method === 'POST' && eventRoute) {
        admin(); const id=Number(eventRoute[1]), action=eventRoute[2];
        await transaction(async () => {
          const event=await getEvent(id);
          if (body.version !== event.version) throw fail(409, 'Die Veranstaltung oder ihre Partien wurden geändert. Bitte neu prüfen.');
          if (action !== 'edit' || event.status === 'closed' || event.date < today()) confirm(body, 'event:'+action, {edit:'EVENT ÄNDERN',delete:'EVENT LÖSCHEN',close:'EVENT ABSCHLIESSEN'}[action]);
          const matches=await db.prepare('SELECT * FROM matches WHERE event_id=? ORDER BY id').all(id);
          if (action === 'edit') {
            const {name,kind,date}=eventFields(body);
            await db.prepare('UPDATE events SET name=?,kind=?,date=?,version=version+1 WHERE id=?').run(name,kind,date,id);
          } else if (action === 'close') {
            if (event.status === 'closed') throw fail(409, 'Die Veranstaltung ist bereits abgeschlossen.');
            if (matches.some(m=>m.status !== 'finished')) throw fail(409, 'Zuerst alle Partien abschließen oder nicht gespielte Partien löschen.');
            await db.prepare("UPDATE events SET status='closed',version=version+1 WHERE id=?").run(id);
          } else {
            await db.prepare('DELETE FROM matches WHERE event_id=?').run(id);
            await db.prepare('DELETE FROM event_players WHERE event_id=?').run(id);
            await db.prepare('DELETE FROM event_teams WHERE event_id=?').run(id);
            await db.prepare('DELETE FROM events WHERE id=?').run(id);
          }
          await log('admin','event:'+action,null,{before:event,matches:action==='edit'?undefined:matches,after:action==='edit'?eventFields(body):undefined});
        });
        return json(res,200,{ok:true});
      }
      if (req.method === 'POST' && url.pathname === '/api/matches') {
        admin(); const event = integer(body.event_id, 1, 1e9), target = integer(body.target, 1, 99);
        if (!['8-Ball','9-Ball','10-Ball'].includes(body.discipline) || (body.first!==undefined && !['a','b'].includes(body.first))) throw fail(400, 'Ungültige Spielregel.');
        const id=await transaction(async () => {
          await openEvent(event); const pinHash=encodePin(body.pin); const id=await nextId('matches');
          await db.prepare('INSERT INTO matches(id,event_id,player_a,player_b,discipline,target,first,pin_hash) VALUES(?,?,?,?,?,?,?,?)').run(id,event,text(body.player_a || 'Teilnehmer',302),text(body.player_b || 'Teilnehmer',302),body.discipline,target,body.first || 'a',pinHash);
          const links=await players.resolve(event,body);
          await db.prepare('UPDATE matches SET player_a=?,player_b=?,player_a_id=?,player_b_id=?,team_a_id=?,team_b_id=?,team_a_name=?,team_b_name=? WHERE id=?').run(links.player_a,links.player_b,links.player_a_id,links.player_b_id,links.team_a_id,links.team_b_id,links.team_a_name,links.team_b_name,id);
          await touchEvent(event); return id;
        });
        return json(res, 201, { id });
      }
      const matchRoute = /^\/api\/matches\/(\d+)\/(start|begin|score|finish|edit|delete)$/.exec(url.pathname);
      if (req.method === 'POST' && matchRoute) {
        const id = Number(matchRoute[1]), action = matchRoute[2];
        const result = await transaction(async () => {
          const m = await db.prepare('SELECT * FROM matches WHERE id=?').get(id);
          if (!m) throw fail(404, 'Begegnung nicht gefunden.');
          if (['start','edit','delete'].includes(action)) admin(); else if (!session && !authorizedTablet(tabletAuth,m)) throw fail(403, 'Keine Berechtigung für diesen Tisch.');
          const parent=await getEvent(m.event_id);
          if (!['edit','delete'].includes(action)) await openEvent(m.event_id);
          if (body.version !== m.version) throw fail(409, 'Der Spielstand wurde zwischenzeitlich geändert. Anzeige aktualisiert; bitte erneut prüfen.');
          if (['edit','delete'].includes(action)) {
            if (body.event_version !== parent.version) throw fail(409, 'Die Veranstaltung wurde zwischenzeitlich geändert. Bitte erneut prüfen.');
            if (action === 'delete' || m.status === 'finished' || parent.status === 'closed') confirm(body, 'match:'+action, action === 'delete' ? 'SPIEL LÖSCHEN' : 'SPIEL ÄNDERN');
          }
          const tick=Date.now();
          if (action === 'delete') {
            await db.prepare('DELETE FROM matches WHERE id=?').run(id);
          } else if (action === 'edit') {
            const event=integer(body.event_id,1,Number.MAX_SAFE_INTEGER);
            if (parent.status === 'closed') {
              if (event !== m.event_id || body.status !== 'finished') throw fail(409, 'Korrekturen erhalten den Gesamtabschluss. Verschieben oder Wiederaufnehmen ist nicht möglich.');
            } else await openEvent(event);
            if (event !== m.event_id && body.destination_version !== (await getEvent(event)).version) throw fail(409, 'Die Zielveranstaltung wurde geändert. Bitte erneut prüfen.');
            const target=integer(body.target,1,99), a=integer(body.a,0,target), b=integer(body.b,0,target);
            const status=body.status, number=body.table_no === null ? null : integer(body.table_no,1,20);
            if (!['planned','live','finished'].includes(status) || !['8-Ball','9-Ball','10-Ball'].includes(body.discipline) || !['a','b'].includes(body.first)) throw fail(400,'Ungültige Spielregel oder Status.');
            if ((a===target && b===target) || (status==='finished' && Math.max(a,b)!==target) || (status==='planned' && (a!==0 || b!==0 || number!==null)) || (status==='live' && number===null)) throw fail(400,'Punkte, Tisch und Status passen nicht zusammen. Geplant: 0:0 ohne Tisch. Laufend: Tisch nötig. Beendet: genau ein Gewinner am Spielziel.');
            if (status==='live') await tables.activeNumber(number);
            if (status==='live' && ((await rentals.occupied(number)) || (await db.prepare("SELECT id FROM matches WHERE table_no=? AND status='live' AND id<>?").get(number,id)))) throw fail(409,'Dieser Tisch ist belegt.');
            await db.prepare('UPDATE matches SET event_id=?,player_a=?,player_b=?,discipline=?,target=?,first=?,a=?,b=?,status=?,table_no=?,version=version+1 WHERE id=?').run(event,text(body.player_a,302),text(body.player_b,302),body.discipline,target,body.first,a,b,status,number,id);
            const links=await players.resolve(event,body,m);
            await db.prepare('UPDATE matches SET player_a=?,player_b=?,player_a_id=?,player_b_id=?,team_a_id=?,team_b_id=?,team_a_name=?,team_b_name=? WHERE id=?').run(links.player_a,links.player_b,links.player_a_id,links.player_b_id,links.team_a_id,links.team_b_id,links.team_a_name,links.team_b_name,id);
            if(body.pin !== undefined && body.pin !== '') await db.prepare('UPDATE matches SET pin_hash=? WHERE id=?').run(encodePin(body.pin),id);
            await db.prepare('UPDATE matches SET auth_version=auth_version+1 WHERE id=?').run(id);
            const lag=body.lag_winner === undefined ? m.lag_winner : body.lag_winner;
            if(lag!==null && !['a','b'].includes(lag)) throw fail(400,'Ungültiger Gewinner des Ausstoßens.');
            await db.prepare('UPDATE matches SET lag_winner=? WHERE id=?').run(lag,id);
            if(status==='planned') await db.prepare('UPDATE matches SET setup_done=0,lag_winner=NULL,started_at=NULL,running_since=NULL,rack_since=NULL,elapsed_ms=0 WHERE id=?').run(id);
            else if(status==='finished' && m.running_since!==null) await db.prepare('UPDATE matches SET elapsed_ms=?,running_since=NULL,rack_since=NULL WHERE id=?').run(m.elapsed_ms+Math.max(0,tick-m.running_since),id);
            else if(status==='live' && m.status==='finished' && m.setup_done) await db.prepare('UPDATE matches SET running_since=?,rack_since=?,started_at=COALESCE(started_at,?) WHERE id=?').run(tick,tick,tick,id);
            else if(status==='live' && m.running_since!==null && (a!==m.a || b!==m.b)) await db.prepare('UPDATE matches SET rack_since=? WHERE id=?').run(tick,id);
            if(event!==m.event_id) await touchEvent(event);
          } else if (action === 'start') {
            if (m.status !== 'planned') throw fail(409, 'Begegnung ist bereits gestartet.');
            const number = await tables.activeNumber(body.table_no);
            if ((await rentals.occupied(number)) || (await db.prepare("SELECT id FROM matches WHERE table_no=? AND status='live'").get(number))) throw fail(409, 'Dieser Tisch ist belegt.');
            await db.prepare("UPDATE matches SET table_no=?,status='live',version=version+1 WHERE id=?").run(number, id);
            if(body.lag_winner!==undefined || body.first!==undefined) {
              if(!['a','b'].includes(body.lag_winner) || !['a','b'].includes(body.first)) throw fail(400,'Ausstoßen und erstes Break auswählen.');
              await db.prepare('UPDATE matches SET lag_winner=?,first=?,setup_done=1,started_at=?,running_since=?,rack_since=? WHERE id=?').run(body.lag_winner,body.first,tick,tick,tick,id);
            }
          } else if (action === 'begin') {
            if(m.status!=='live' || m.setup_done) throw fail(409,'Die Partie ist bereits gestartet oder keinem Tisch zugewiesen.');
            if(!['a','b'].includes(body.lag_winner) || !['a','b'].includes(body.first)) throw fail(400,'Ausstoßen und erstes Break auswählen.');
            await db.prepare('UPDATE matches SET lag_winner=?,first=?,setup_done=1,started_at=?,running_since=?,rack_since=?,version=version+1 WHERE id=?').run(body.lag_winner,body.first,tick,tick,tick,id);
          } else if (action === 'score') {
            if(!m.setup_done) throw fail(409,'Zuerst Ausstoßen und erstes Break bestätigen.');
            let next; try { next = changeScore(m, body.side, body.delta); } catch(e) { throw fail(400, e.message); }
            await db.prepare('UPDATE matches SET a=?,b=?,rack_since=?,running_since=COALESCE(running_since,?),started_at=COALESCE(started_at,?),version=version+1 WHERE id=?').run(next.a,next.b,Math.max(next.a,next.b)===m.target?null:tick,tick,tick,id);
          } else {
            if (!m.setup_done || m.status !== 'live' || Math.max(m.a,m.b) !== m.target) throw fail(409, 'Das Spielziel muss erreicht sein.');
            confirm(body, 'match:finish', 'SPIEL ABSCHLIESSEN');
            await db.prepare("UPDATE matches SET status='finished',elapsed_ms=?,running_since=NULL,rack_since=NULL,version=version+1 WHERE id=?").run(m.elapsed_ms+(m.running_since===null?0:Math.max(0,tick-m.running_since)),id);
          }
          await touchEvent(m.event_id);
          await log(session ? 'admin' : `table:${table}`, action, id, {before:m,request:body});
          return publicMatch(await db.prepare('SELECT * FROM matches WHERE id=?').get(id)) || {ok:true};
        });
        return json(res, 200, result);
      }
      if (req.method === 'GET' && ['/', '/admin', '/app.js', '/rental-pricing.js', '/style.css'].includes(url.pathname) || req.method === 'GET' && /^\/tisch\/([1-9]|1[0-9]|20)$/.test(url.pathname)) {
        if (url.pathname.startsWith('/tisch/')) await tables.activeNumber(Number(url.pathname.split('/').pop()));
        const asset = url.pathname === '/rental-pricing.js' ? 'rental-pricing.js' : url.pathname === '/app.js' ? 'app.js' : url.pathname === '/style.css' ? 'style.css' : 'index.html';
        res.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript; charset=utf-8' : asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
        let content=readFileSync(new URL(`../public/${asset}`, import.meta.url));
        if(asset==='index.html') {
          const b=await branding.publicState(), escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          const name=escape(b.club_name);
          content=content.toString()
            .replace('<title>BSVP · Billardmanager</title>',()=>`<title>${name} · Billardmanager</title>`)
            .replace('<span id="club-name">BSV PFAFFENHOFEN</span>',()=>`<span id="club-name">${name}</span>`)
            .replace('<span id="footer-club">BSV Pfaffenhofen · Billardmanager</span>',()=>`<span id="footer-club">${name} · Billardmanager</span>`)
            .replace('alt="Logo des BSV Pfaffenhofen"',()=>`alt="${name} · Vereinslogo"`);
        }
        return res.end(content);
      }
      if (req.method === 'GET' && url.pathname === '/assets/bsv-logo.png') {
        res.setHeader('Content-Type', 'image/png');
        return res.end(readFileSync(new URL('../public/assets/bsv-logo.png', import.meta.url)));
      }
      throw fail(404, 'Nicht gefunden.');
    } catch (e) { if (!e.status) console.error('Request failed:', e.code || e.name); json(res, e.status || 500, { error: e.status ? e.message : 'Interner Fehler.' }); }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000;
  server.on('close', () => db.close());
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(process.env.DATA_DIR || 'data', { recursive: true });
  const config = loadConfig(process.env.CONFIG_FILE || 'secrets/config.json');
  const server = await createApp({ databaseUrl: process.env.DATABASE_URL, legacyPath: `${process.env.DATA_DIR || 'data'}/billard.sqlite`, config, origin: process.env.APP_ORIGIN || 'http://localhost:3000' });
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Billardmanager hört auf Port ' + (process.env.PORT || 3000)));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close());
}

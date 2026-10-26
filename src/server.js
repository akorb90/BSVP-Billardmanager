import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { changeScore, breaker } from './domain.js';

export function createApp({ dbPath, config, origin = 'http://localhost:3000' }) {
  const allowedOrigins = new Set([new URL(origin).origin]);
  const localOrigin = new URL(origin);
  for (const hostname of ['localhost', '127.0.0.1']) {
    localOrigin.hostname = hostname;
    allowedOrigins.add(localOrigin.origin);
  }
  if (!config.adminHash || config.tables?.length !== 8 || config.tables.some(k => typeof k !== 'string' || k.length < 32)) throw new Error('Ungültige Sicherheitskonfiguration; npm run setup ausführen.');
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('Liga','Turnier')), date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id), player_a TEXT NOT NULL, player_b TEXT NOT NULL, discipline TEXT NOT NULL, target INTEGER NOT NULL CHECK(target BETWEEN 1 AND 99), first TEXT NOT NULL CHECK(first IN ('a','b')), table_no INTEGER CHECK(table_no BETWEEN 1 AND 8), a INTEGER NOT NULL DEFAULT 0, b INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','live','finished')), version INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS occupied_table ON matches(table_no) WHERE status='live';
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, actor TEXT NOT NULL, action TEXT NOT NULL, match_id INTEGER, detail TEXT NOT NULL);
    PRAGMA user_version=1;`);
  const sessions = new Map(), attempts = new Map();
  const hash = s => createHash('sha256').update(s).digest('hex');
  const equal = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const text = (v, max = 100) => { if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw fail(400, 'Bitte gültige Texte eingeben.'); return v.trim(); };
  const integer = (v, min, max) => { if (!Number.isInteger(v) || v < min || v > max) throw fail(400, 'Ungültiger Zahlenwert.'); return v; };
  const log = (actor, action, id, detail) => db.prepare('INSERT INTO audit(actor,action,match_id,detail) VALUES(?,?,?,?)').run(actor, action, id, JSON.stringify(detail));
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const publicMatch = m => m && ({ ...m, breaker: breaker(m) });
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Cache-Control', 'no-store');
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
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
      if (token) table = config.tables.findIndex(k => equal(k, token)) + 1;
      const admin = () => { if (!session) throw fail(401, 'Bitte anmelden.'); };
      let body = {};
      if (req.method === 'POST') {
        if (!allowedOrigins.has(requestOrigin)) throw fail(403, 'Ungültiger Ursprung.');
        if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON erforderlich.');
        let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) throw fail(413, 'Anfrage zu groß.'); }
        try { body = JSON.parse(raw); } catch { throw fail(400, 'Ungültiges JSON.'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Ungültige Anfrage.');
        if (session && url.pathname !== '/api/login' && req.headers['x-csrf-token'] !== session.csrf) throw fail(403, 'Ungültiger CSRF-Schutz.');
      }
      if (req.method === 'GET' && url.pathname === '/health') { db.prepare('SELECT 1').get(); return json(res, 200, { ok: true }); }
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const key = req.socket.remoteAddress; const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60_000 };
        if (attempt.count >= 10) throw fail(429, 'Zu viele Versuche. Bitte 15 Minuten warten.');
        attempt.count++; attempts.set(key, attempt);
        const [salt, expected] = config.adminHash.split(':');
        const actual = scryptSync(typeof body.password === 'string' ? body.password : '', salt, 64).toString('hex');
        if (!equal(actual, expected)) throw fail(401, 'Anmeldung fehlgeschlagen.');
        attempts.delete(key); if (sid) sessions.delete(hash(sid));
        const id = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex');
        sessions.set(hash(id), { csrf, expires: now + 8 * 3600_000 });
        res.setHeader('Set-Cookie', `session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:') ? '; Secure' : ''}`);
        return json(res, 200, { csrf });
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') { admin(); sessions.delete(hash(sid)); res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res, 200, {}); }
      if (req.method === 'GET' && url.pathname === '/api/admin') { admin(); return json(res, 200, { csrf: session.csrf, events: db.prepare('SELECT * FROM events ORDER BY date DESC,id DESC').all(), matches: db.prepare('SELECT * FROM matches ORDER BY id DESC').all().map(publicMatch) }); }
      const tableRoute = /^\/api\/tables\/([1-8])$/.exec(url.pathname);
      if (req.method === 'GET' && tableRoute) {
        const number = Number(tableRoute[1]); if (!session && table !== number) throw fail(401, 'Tischschlüssel fehlt oder ist ungültig.');
        return json(res, 200, { match: publicMatch(db.prepare("SELECT m.*, e.name AS event_name FROM matches m JOIN events e ON e.id=m.event_id WHERE table_no=? AND status='live'").get(number)) || null });
      }
      if (req.method === 'POST' && url.pathname === '/api/events') {
        admin(); const name = text(body.name), kind = text(body.kind), date = text(body.date);
        const parsedDate = new Date(date);
        if (!['Liga', 'Turnier'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) throw fail(400, 'Ungültige Veranstaltung.');
        db.prepare('INSERT INTO events(name,kind,date) VALUES(?,?,?)').run(name, kind, date); return json(res, 201, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/matches') {
        admin(); const event = integer(body.event_id, 1, 1e9), target = integer(body.target, 1, 99);
        if (!db.prepare('SELECT id FROM events WHERE id=?').get(event)) throw fail(400, 'Veranstaltung nicht gefunden.');
        if (!['8-Ball','9-Ball','10-Ball'].includes(body.discipline) || !['a','b'].includes(body.first)) throw fail(400, 'Ungültige Spielregel.');
        db.prepare('INSERT INTO matches(event_id,player_a,player_b,discipline,target,first) VALUES(?,?,?,?,?,?)').run(event,text(body.player_a),text(body.player_b),body.discipline,target,body.first);
        return json(res, 201, { ok: true });
      }
      const matchRoute = /^\/api\/matches\/(\d+)\/(start|score|finish)$/.exec(url.pathname);
      if (req.method === 'POST' && matchRoute) {
        const id = Number(matchRoute[1]), action = matchRoute[2];
        const result = transaction(() => {
          const m = db.prepare('SELECT * FROM matches WHERE id=?').get(id);
          if (!m) throw fail(404, 'Begegnung nicht gefunden.');
          if (action === 'start') admin(); else if (!session && (!table || table !== m.table_no)) throw fail(403, 'Keine Berechtigung für diesen Tisch.');
          if (body.version !== m.version) throw fail(409, 'Der Spielstand wurde zwischenzeitlich geändert. Anzeige aktualisiert; bitte erneut prüfen.');
          if (action === 'start') {
            if (m.status !== 'planned') throw fail(409, 'Begegnung ist bereits gestartet.');
            const number = integer(body.table_no, 1, 8);
            if (db.prepare("SELECT id FROM matches WHERE table_no=? AND status='live'").get(number)) throw fail(409, 'Dieser Tisch ist belegt.');
            db.prepare("UPDATE matches SET table_no=?,status='live',version=version+1 WHERE id=?").run(number, id);
          } else if (action === 'score') {
            let next; try { next = changeScore(m, body.side, body.delta); } catch(e) { throw fail(400, e.message); }
            db.prepare('UPDATE matches SET a=?,b=?,version=version+1 WHERE id=?').run(next.a,next.b,id);
          } else {
            if (m.status !== 'live' || Math.max(m.a,m.b) !== m.target) throw fail(409, 'Das Spielziel muss erreicht sein.');
            db.prepare("UPDATE matches SET status='finished',version=version+1 WHERE id=?").run(id);
          }
          log(session ? 'admin' : `table:${table}`, action, id, body);
          return publicMatch(db.prepare('SELECT * FROM matches WHERE id=?').get(id));
        });
        return json(res, 200, result);
      }
      if (req.method === 'GET' && ['/', '/admin', '/app.js', '/style.css'].includes(url.pathname) || req.method === 'GET' && /^\/tisch\/[1-8]$/.test(url.pathname)) {
        const asset = url.pathname === '/app.js' ? 'app.js' : url.pathname === '/style.css' ? 'style.css' : 'index.html';
        res.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript; charset=utf-8' : asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
        return res.end(readFileSync(new URL(`../public/${asset}`, import.meta.url)));
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
  const config = JSON.parse(readFileSync(process.env.CONFIG_FILE || 'secrets/config.json', 'utf8'));
  const server = createApp({ dbPath: `${process.env.DATA_DIR || 'data'}/billard.sqlite`, config, origin: process.env.APP_ORIGIN || 'http://localhost:3000' });
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Billardmanager hört auf Port ' + (process.env.PORT || 3000)));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close());
}

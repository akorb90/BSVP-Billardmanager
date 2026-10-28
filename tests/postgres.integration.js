// Executed only inside the randomly named, disposable Docker smoke project.
import assert from 'node:assert/strict';
import pg from 'pg';
import { createHash, scryptSync } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './src/database.js';
import { backupService } from './src/backup.js';

const config = { adminHash: 'salt:' + scryptSync('integration-password', 'salt', 64).toString('hex'), tables: Array(8).fill('k'.repeat(40)) };
const password = createHash('sha256').update(readFileSync(process.env.DATABASE_PASSWORD_CONFIG)).digest('hex');
const adminUrl = new URL(process.env.DATABASE_URL); adminUrl.password = password;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const prefix = 'fr012_' + Date.now();
const names = ['source', 'target', 'invalid', 'upgrade'].map(n => prefix + '_' + n);
const url = name => { const u = new URL(process.env.DATABASE_URL); u.pathname = '/' + name; return u.toString(); };
const dir = mkdtempSync(join(tmpdir(), 'fr012-'));
const handles = new Set();
const open = async options => { const db = await openDatabase({ config, ...options }); handles.add(db); return db; };
const close = async db => { await db.close(); handles.delete(db); };
const service = db => backupService({ db, transaction: fn => db.transaction(fn), fail: (status, message) => Object.assign(new Error(message), { status }), log: (...args) => db.prepare('INSERT INTO audit(actor,action,match_id,detail) VALUES(?,?,?,?)').run(args[0], args[1], args[2], JSON.stringify(args[3])) });
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
try {
  for (const name of names) await admin.query(`CREATE DATABASE "${name}"`);
  const path = join(dir, 'legacy.sqlite');
  const sqlite = await open({ dbPath: path });
  await sqlite.exec(`INSERT INTO events VALUES(7,'Migration äöü 🎱','Liga','2026-10-28','open',12);
    INSERT INTO matches(id,event_id,player_a,player_b,discipline,target,first,table_no,a,b,status,version,pin_hash,auth_version,lag_winner,setup_done,started_at,running_since,rack_since,elapsed_ms)
    VALUES(9,7,'Anna','Ben','9-Ball',5,'b',12,2,1,'live',4,'${config.adminHash}',3,'a',1,1793000000000,1793000010000,1793000020000,12345);
    UPDATE table_settings SET table_count=20,version=2;
    UPDATE entity_ids SET value=CASE name WHEN 'events' THEN 7 WHEN 'matches' THEN 9 ELSE 3 END;
    UPDATE rental_settings SET base_cents=1234,version=3;
    INSERT INTO rentals VALUES(3,20,1793000000000,NULL,987,1234,-20,NULL,NULL,NULL,'active',2);
    INSERT INTO pin_attempts VALUES(12,4,1793999999999);
    INSERT INTO audit VALUES(45,'2026-10-28 12:34:56','admin','fixture',9,'{"preserved":true}');
    UPDATE branding SET club_name='Migration Verein',primary_color='#147eb7',version=5;`);
  await sqlite.prepare('UPDATE branding SET logo=?').run('data:image/png;base64,' + readFileSync('./public/assets/bsv-logo.png').toString('base64'));
  await sqlite.exec(`INSERT INTO players VALUES('p1','Anna','Maria','Altname',1,0),('p2','Ben','','Gegner',1,0);
    INSERT INTO teams VALUES('t1','BSV I',1,0);
    INSERT INTO team_players VALUES('t1','p1');
    INSERT INTO event_teams VALUES(7,'t1');
    INSERT INTO event_players VALUES(7,'p1','t1'),(7,'p2',NULL);
    UPDATE matches SET player_a_id='p1',player_b_id='p2',team_a_id='t1',team_a_name='Historisches Team' WHERE id=9;`);
  const expected = JSON.parse(JSON.stringify(await (await service(sqlite)).export()));
  await close(sqlite);
  const original = readFileSync(path);
  let source = await open({ databaseUrl: url(names[0]), legacyPath: path });
  let backups = await service(source);
  assert.deepEqual((await backups.export()).data, expected.data);
  assert.deepEqual(readFileSync(path), original, 'legacy database remains unchanged');
  await source.prepare("INSERT INTO events VALUES(8,'Postgres only','Turnier','2026-10-29','open',0)").run();
  await source.prepare("UPDATE entity_ids SET value=8 WHERE name='events'").run();
  await close(source);
  source = await open({ databaseUrl: url(names[0]), legacyPath: path });
  backups = await service(source);
  assert.equal((await backups.export()).data.events.length, 2, 'restart never reimports legacy data');
  const target = await open({ databaseUrl: url(names[1]) });
  const targetBackups = await service(target), session = {};
  await targetBackups.preview(expected, session);
  await targetBackups.restore({ backup: expected, action: 'backup:restore', confirmation: 'DATEN WIEDERHERSTELLEN' }, session);
  const restored = (await targetBackups.export()).data;
  for (const name of Object.keys(expected.data)) if (name !== 'audit') assert.deepEqual(restored[name], expected.data[name]);
  assert.equal(restored.audit.at(-1).id, 46, 'audit identity advances after restore');
  const before = await targetBackups.export();
  for (const change of [b => b.data.matches[0].event_id=999, b => b.data.matches[0].table_no=21, b => b.data.admin_credentials=[], b => delete b.data.branding, b => b.data.matches[0].a=9]) {
    const invalid = structuredClone(expected); change(invalid); invalid.checksum = digest(invalid.data);
    await assert.rejects(targetBackups.preview(invalid, {}), e => e.status === 400);
    assert.deepEqual((await targetBackups.export()).data, before.data, 'invalid preview leaves all data unchanged');
  }
  // Future application tables are discovered automatically and cannot be silently omitted.
  await target.exec('CREATE TABLE future_settings(id BIGINT PRIMARY KEY,value TEXT NOT NULL)');
  await target.prepare('INSERT INTO future_settings VALUES(1,?)').run('must survive');
  const futureBackups = await service(target), future = await futureBackups.export();
  assert.equal(future.data.future_settings[0].value, 'must survive');
  await futureBackups.preview(future, session);
  await futureBackups.restore({ backup: future, action: 'backup:restore', confirmation: 'DATEN WIEDERHERSTELLEN' }, session);
  assert.deepEqual((await futureBackups.export()).data.future_settings, future.data.future_settings);
  // Upgrade an existing populated PostgreSQL v8 database without changing results.
  let upgrade=await open({databaseUrl:url(names[3])});
  await upgrade.exec(`INSERT INTO events VALUES(1,'Bestand','Liga','2026-10-28','open',0);
    INSERT INTO matches(id,event_id,player_a,player_b,discipline,target,first) VALUES(1,1,'Alt A','Alt B','9-Ball',5,'a');
    SET CONSTRAINTS ALL IMMEDIATE;
    DROP TABLE players,teams,team_players,event_players,event_teams;
    ALTER TABLE matches DROP COLUMN player_a_id,DROP COLUMN player_b_id,DROP COLUMN team_a_id,DROP COLUMN team_b_id,DROP COLUMN team_a_name,DROP COLUMN team_b_name;
    UPDATE _schema SET version=8;`);
  await close(upgrade);upgrade=await open({databaseUrl:url(names[3])});
  assert.equal((await upgrade.prepare('SELECT * FROM matches WHERE id=1').get()).player_a,'Alt A');
  assert.equal((await upgrade.prepare('SELECT * FROM matches WHERE id=1').get()).player_a_id,null);
  assert.equal((await upgrade.prepare('SELECT version FROM _schema WHERE id=1').get()).version,9);
  assert.deepEqual(await upgrade.prepare('SELECT * FROM players').all(),[]);
  await close(upgrade);
  // An incompatible source must roll back schema creation and must not mark migration complete.
  const badPath = join(dir, 'bad.sqlite'), bad = await open({ dbPath: badPath });
  await bad.exec('CREATE TABLE incompatible(id INTEGER PRIMARY KEY, value BLOB); INSERT INTO incompatible VALUES(1,zeroblob(3))');
  await close(bad);
  await assert.rejects(open({ databaseUrl: url(names[2]), legacyPath: badPath }));
  const recovered = await open({ databaseUrl: url(names[2]) });
  assert.equal((await (await service(recovered)).export()).data.events.length, 0);
  console.log('PASS: full SQLite migration, unchanged source, restart, separate-database restore, validation rollback, identity, future tables and failed-migration rollback');
} finally {
  for (const db of handles) await db.close();
  for (const name of names) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
  rmSync(dir, { recursive: true, force: true });
}

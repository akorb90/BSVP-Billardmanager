import { playerSchema } from './players.js';
// SQLite is retained only for legacy migration and isolated compatibility tests.
import { DatabaseSync } from 'node:sqlite';
import { migrateTables } from './tables.js';
import { migrateRentals } from './rentals.js';
import { DEFAULT_BRANDING } from './branding.js';
export function openLegacyDatabase(dbPath, config) {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('Liga','Turnier')), date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id), player_a TEXT NOT NULL, player_b TEXT NOT NULL, discipline TEXT NOT NULL, target INTEGER NOT NULL CHECK(target BETWEEN 1 AND 99), first TEXT NOT NULL CHECK(first IN ('a','b')), table_no INTEGER CHECK(table_no BETWEEN 1 AND 8), a INTEGER NOT NULL DEFAULT 0, b INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','live','finished')), version INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS occupied_table ON matches(table_no) WHERE status='live';
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, actor TEXT NOT NULL, action TEXT NOT NULL, match_id INTEGER, detail TEXT NOT NULL);
    `);
  const schema = db.prepare('PRAGMA user_version').get().user_version;
  if (schema > 9) throw new Error('Die Datenbank benötigt eine neuere App-Version.');
  if (schema < 2) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'));
      ALTER TABLE events ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE entity_ids(name TEXT PRIMARY KEY, value INTEGER NOT NULL);
      INSERT INTO entity_ids VALUES('events', (SELECT COALESCE(MAX(id),0) FROM events));
      INSERT INTO entity_ids VALUES('matches', (SELECT COALESCE(MAX(id),0) FROM matches));
      PRAGMA user_version=2; COMMIT;`);
  }
  if (schema < 3) db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE matches ADD COLUMN pin_hash TEXT;
    ALTER TABLE matches ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE pin_attempts(table_no INTEGER PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    PRAGMA user_version=3; COMMIT;`);
  if (schema < 4) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE matches ADD COLUMN lag_winner TEXT CHECK(lag_winner IN ('a','b'));
      ALTER TABLE matches ADD COLUMN setup_done INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE matches ADD COLUMN started_at INTEGER;
      ALTER TABLE matches ADD COLUMN running_since INTEGER;
      ALTER TABLE matches ADD COLUMN rack_since INTEGER;
      ALTER TABLE matches ADD COLUMN elapsed_ms INTEGER NOT NULL DEFAULT 0;
      UPDATE matches SET setup_done=1 WHERE status<>'planned';
      UPDATE matches SET started_at=CAST(unixepoch('subsec')*1000 AS INTEGER),running_since=CAST(unixepoch('subsec')*1000 AS INTEGER),rack_since=CAST(unixepoch('subsec')*1000 AS INTEGER) WHERE status='live';
      PRAGMA user_version=4; COMMIT;`);
  }
  if (schema < 5) migrateRentals(db);
  if (schema < 6) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('CREATE TABLE admin_credentials(id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL)');
      db.prepare('INSERT INTO admin_credentials VALUES(1,?)').run(config.adminHash);
      db.exec('PRAGMA user_version=6; COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
  }
  if (schema < 7) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('CREATE TABLE branding(id INTEGER PRIMARY KEY CHECK(id=1),club_name TEXT NOT NULL,primary_color TEXT NOT NULL,background TEXT NOT NULL,surface TEXT NOT NULL,text TEXT NOT NULL,logo TEXT,version INTEGER NOT NULL CHECK(version>=0))');
      const b=DEFAULT_BRANDING;
      db.prepare('INSERT INTO branding VALUES(1,?,?,?,?,?,?,0)').run(b.club_name,b.primary,b.background,b.surface,b.text,b.logo);
      db.exec('PRAGMA user_version=7; COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  if (schema < 8) migrateTables(db);
  db.prepare("INSERT OR IGNORE INTO entity_ids(name,value) VALUES('rentals',(SELECT COALESCE(MAX(id),0) FROM rentals))").run();
  if (schema < 9) db.exec('BEGIN IMMEDIATE;'+playerSchema+'PRAGMA user_version=9; COMMIT;');
  return db;
}

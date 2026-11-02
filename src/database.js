import {inventoryBatchSchema} from './inventory-batch-schema.js';
import { inventorySchema } from './inventory-schema.js';
import { playerSchema } from './players.js';
import {leagueSchema} from './league.js';
import {scheduleSchema} from './schedule-schema.js';
import { nuligaSchema } from './nuliga-schema.js';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULT_BRANDING } from './branding.js';

export const SCHEMA_VERSION = 15; // Logical JSON schema is shared with versioned backups.
export const quote = name => '"' + name.replaceAll('"', '""') + '"';
const lock = 12012026;
const numeric = value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds the supported range');
  return n;
};
const types = { getTypeParser: (oid, format) => oid === 20 ? numeric : pg.types.getTypeParser(oid, format) };

export async function openDatabase({ databaseUrl, config }) {
  if (!databaseUrl) throw new Error('DATABASE_URL fehlt. Bitte den PostgreSQL-Compose-Stack verwenden.');
  const context = new AsyncLocalStorage();
  const password = process.env.DATABASE_PASSWORD_CONFIG
    ? createHash('sha256').update(readFileSync(process.env.DATABASE_PASSWORD_CONFIG)).digest('hex')
    : undefined;
  const connection = new URL(databaseUrl);
  if (password) connection.password = password;
  const pool = new pg.Pool({ connectionString: connection.toString(), types, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  pool.on('error', error => console.error('PostgreSQL connection failed:', error.code || error.name));
  const query = (sql, values) => (context.getStore() || pool).query(sql, values);
  const db = {
    prepare(sql) {
      let i = 0;
      const text = sql.replaceAll('?', () => '$' + (++i));
      const run = (...values) => query(text, values);
      return { get: async (...values) => (await run(...values)).rows[0], all: async (...values) => (await run(...values)).rows, run };
    },
    exec: sql => query(sql), close: () => pool.end(),
    tables: async () => (await query("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename<>'_schema' ORDER BY tablename")).rows.map(r => r.name),
    columns: async name => (await query(`SELECT column_name AS name, CASE WHEN data_type='bigint' THEN 'INTEGER' WHEN data_type='double precision' THEN 'REAL' ELSE 'TEXT' END AS type,
      CASE WHEN is_nullable='NO' THEN 1 ELSE 0 END AS notnull, 0 AS pk FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [name])).rows,
    async transaction(fn) {
      if (context.getStore()) throw new Error('Nested database transaction');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Preserve read/check/write atomicity across app processes, including cross-table occupancy.
        await client.query('SELECT pg_advisory_xact_lock($1)', [lock]);
        const result = await context.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    defer: () => query('SET CONSTRAINTS ALL DEFERRED'),
    async resetIdentity() {
      const { next } = (await query('SELECT COALESCE(MAX(id),0)+1 AS next FROM audit')).rows[0];
      // ALTER SEQUENCE RESTART rolls back with the restore, unlike setval().
      await query(`ALTER SEQUENCE audit_id_seq RESTART WITH ${next}`);
    },
  };
  try {
    await db.transaction(async () => {
      const installed = await db.prepare("SELECT to_regclass('public._schema') AS name").get();
      if (installed.name) {
        const installedVersion=(await db.prepare('SELECT version FROM _schema WHERE id=1').get())?.version;
        if(installedVersion===8) await db.exec(playerSchema.replace(/\bINTEGER\b/g,'BIGINT'));
        if([8,9].includes(installedVersion)) {await db.exec(nuligaSchema.replace(/\bINTEGER\b/g,'BIGINT'));}
        if([8,9,10].includes(installedVersion)){await db.exec(scheduleSchema.replace(/\bINTEGER\b/g,'BIGINT'));}
        if([8,9,10,11].includes(installedVersion)){await db.exec(leagueSchema.replace(/\bINTEGER\b/g,'BIGINT'));await db.exec('ALTER TABLE matches DROP CONSTRAINT matches_target_check;ALTER TABLE matches ADD CONSTRAINT matches_target_check CHECK(target BETWEEN 1 AND 999);UPDATE _schema SET version=12 WHERE id=1');}
        if([8,9,10,11,12].includes(installedVersion))await db.exec('ALTER TABLE players ADD COLUMN event_id BIGINT;UPDATE _schema SET version=13 WHERE id=1');
        if([8,9,10,11,12,13].includes(installedVersion))await db.exec(inventorySchema+'UPDATE _schema SET version=14 WHERE id=1');
        if([8,9,10,11,12,13,14].includes(installedVersion))await db.exec(inventoryBatchSchema+'UPDATE _schema SET version=15 WHERE id=1');
        else if (installedVersion !== SCHEMA_VERSION) throw new Error('Die Datenbank benötigt eine passende App-Version.');
        return;
      }
      if ((await db.tables()).length) throw new Error('PostgreSQL enthält unbekannte Tabellen; Initialisierung abgebrochen.');
      await db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
      await db.exec(inventorySchema+inventoryBatchSchema);
      await db.prepare('INSERT INTO admin_credentials VALUES(1,?)').run(config.adminHash);
      const b = DEFAULT_BRANDING;
      await db.prepare('INSERT INTO branding VALUES(1,?,?,?,?,?,?,0)').run(b.club_name,b.primary,b.background,b.surface,b.text,b.logo);
      await db.exec(`INSERT INTO entity_ids VALUES('events',0),('matches',0),('rentals',0);
        INSERT INTO rental_settings(id) VALUES(1);
        INSERT INTO table_settings VALUES(1,8,0);
        CREATE TABLE _schema(id BIGINT PRIMARY KEY CHECK(id=1),version BIGINT NOT NULL);
        INSERT INTO _schema VALUES(1,${SCHEMA_VERSION});`);
      console.log('PostgreSQL initialisiert.');
    });
    return db;
  } catch (error) { await pool.end(); throw error; }
}

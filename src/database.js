import { playerSchema } from './players.js';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openLegacyDatabase } from './legacy-db.js';

export const SCHEMA_VERSION = 9; // Logical JSON schema is shared with legacy migration and versioned backups.
export const quote = name => '"' + name.replaceAll('"', '""') + '"';
const lock = 12012026;
const numeric = value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds the supported range');
  return n;
};
const types = { getTypeParser: (oid, format) => oid === 20 ? numeric : pg.types.getTypeParser(oid, format) };

export async function openDatabase({ dbPath, databaseUrl, legacyPath, config }) {
  // Explicit file paths are used by compatibility tests, never by the server entrypoint.
  if (dbPath) {
    const raw = openLegacyDatabase(dbPath, config);
    let tail = Promise.resolve();
    const db = {
      dialect: 'sqlite', prepare: sql => raw.prepare(sql), exec: sql => raw.exec(sql), close: () => raw.close(),
      tables: () => raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name),
      columns: name => raw.prepare(`PRAGMA table_info(${quote(name)})`).all(),
      async transaction(fn) {
        const previous = tail;
        let release;
        tail = new Promise(r => { release = r; });
        await previous;
        raw.exec('BEGIN IMMEDIATE');
        try { const result = await fn(); raw.exec('COMMIT'); return result; }
        catch (error) { raw.exec('ROLLBACK'); throw error; }
        finally { release(); }
      },
      defer: () => raw.exec('PRAGMA defer_foreign_keys=ON'),
      resetIdentity: () => {},
    };
    return db;
  }
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
    dialect: 'postgres',
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
        if(installedVersion===8) {await db.exec(playerSchema.replace(/\bINTEGER\b/g,'BIGINT'));await db.exec('UPDATE _schema SET version=9 WHERE id=1');}
        else if (installedVersion !== SCHEMA_VERSION) throw new Error('Die Datenbank benötigt eine passende App-Version.');
        return;
      }
      if ((await db.tables()).length) throw new Error('PostgreSQL enthält unbekannte Tabellen; automatische Übernahme abgebrochen.');
      let directory, source, legacy;
      try {
        if (legacyPath && existsSync(legacyPath)) {
          directory = mkdtempSync(join(tmpdir(), 'billard-migration-'));
          source = new DatabaseSync(legacyPath, { readOnly: true });
          await backup(source, join(directory, 'legacy.sqlite'));
          source.close(); source = null;
          legacy = openLegacyDatabase(join(directory, 'legacy.sqlite'), config);
        } else legacy = openLegacyDatabase(':memory:', config);
        const schema = legacy.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC,name").all();
        // SQLite's final schema is also the authoritative input for legacy validation.
        for (const item of schema) {
          let sql = item.sql.replace(/\bINTEGER\b/g, 'BIGINT').replace(/\bREAL\b/g, 'DOUBLE PRECISION')
            .replace(/DEFAULT CURRENT_TIMESTAMP/g, "DEFAULT (to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'))")
            .replace(/REFERENCES events\(id\)/g, 'REFERENCES events(id) DEFERRABLE INITIALLY DEFERRED');
          if (item.name === 'audit') sql = sql.replace(/id BIGINT PRIMARY KEY/i, 'id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY');
          await db.exec(sql);
        }
        const names = legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
        for (const name of names) {
          const columns = legacy.prepare(`PRAGMA table_info(${quote(name)})`).all().map(r => r.name);
          const rows = legacy.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${columns.map(quote).join(',')}`).all();
          const insert = db.prepare(`INSERT INTO ${quote(name)} (${columns.map(quote)}) VALUES (${columns.map(() => '?')})`);
          for (const row of rows) await insert.run(...columns.map(c => row[c]));
          const copied = await db.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${columns.map(quote).join(',')}`).all();
          if (JSON.stringify(copied) !== JSON.stringify(rows)) throw new Error(`Übernahmeprüfung fehlgeschlagen: ${name}`);
        }
        await db.resetIdentity();
        await db.exec(`CREATE TABLE _schema(id BIGINT PRIMARY KEY CHECK(id=1),version BIGINT NOT NULL); INSERT INTO _schema VALUES(1,${SCHEMA_VERSION})`);
        console.log(legacyPath && existsSync(legacyPath) ? 'SQLite-Daten vollständig nach PostgreSQL übernommen und geprüft.' : 'PostgreSQL initialisiert.');
      } finally { source?.close(); legacy?.close(); if (directory) rmSync(directory, { recursive: true, force: true }); }
    });
    return db;
  } catch (error) { await pool.end(); throw error; }
}

import { after } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp as app } from '../../src/server.js';
import { openDatabase as open } from '../../src/database.js';

const databases = new Map();
async function databaseUrl(key = randomUUID()) {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Isoliertes Test-PostgreSQL fehlt: npm test bzw. node scripts/test.js tests/<name>.test.js verwenden.');
  if (!databases.has(key)) {
    const name = 'test_' + process.pid + '_' + createHash('sha256').update(key).digest('hex').slice(0, 24);
    const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    try { await client.query(`CREATE DATABASE "${name}"`); } finally { await client.end(); }
    const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = '/' + name;
    databases.set(key, { name, url: url.toString() });
  }
  return databases.get(key).url;
}

export async function createApp({ dbKey, ...options }) {
  return app({ ...options, databaseUrl: await databaseUrl(dbKey) });
}
export async function openDatabase({ dbKey, ...options }) {
  return open({ ...options, databaseUrl: await databaseUrl(dbKey) });
}
export const openTestDatabase = dbKey => openDatabase({ dbKey });

after(async () => {
  if (!databases.size) return;
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    for (const { name } of databases.values()) await client.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  } finally { await client.end(); }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';

const setup = fileURLToPath(new URL('../scripts/setup.js', import.meta.url));
function fixture(t) {
  const base = fileURLToPath(new URL('../data/', import.meta.url));
  mkdirSync(base, { recursive: true });
  const cwd = mkdtempSync(join(base, 'billard-setup-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, 'secrets'));
  return { cwd, path: join(cwd, 'secrets/config.json'), run: () => spawnSync(process.execPath, [setup], { cwd, encoding: 'utf8' }) };
}
test('fresh setup creates valid credentials; rerun preserves them', t => {
  const f = fixture(t);
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  const original = readFileSync(f.path, 'utf8');
  const config = loadConfig(f.path);
  assert.match(config.adminHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(config.tables.length, 8);
  assert.ok(config.tables.every(key => key.length >= 32));
  const rerun = f.run();
  assert.equal(rerun.status, 1);
  assert.doesNotMatch(rerun.stdout, /Admin-Passwort/);
  assert.equal(readFileSync(f.path, 'utf8'), original);
});
test('setup preserves and repairs an empty Docker-created directory', t => {
  const f = fixture(t);
  mkdirSync(f.path);
  mkdirSync(`${f.path}.directory-backup`);
  writeFileSync(`${f.path}.directory-backup/keep`, 'keep');
  const repair = f.run();
  assert.equal(repair.status, 0, repair.stderr);
  assert.equal(loadConfig(f.path).tables.length, 8);
  assert.deepEqual(readdirSync(`${f.path}.directory-backup-1`), []);
  assert.equal(readFileSync(`${f.path}.directory-backup/keep`, 'utf8'), 'keep');
});
test('setup refuses non-empty directories without changing their contents', t => {
  const f = fixture(t);
  mkdirSync(f.path);
  writeFileSync(join(f.path, 'keep'), 'keep');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /nicht leerer Ordner/);
  assert.equal(readFileSync(join(f.path, 'keep'), 'utf8'), 'keep');
});
test('configuration failures give actionable diagnostics without exposing contents', t => {
  const f = fixture(t);
  assert.throws(() => loadConfig(f.path), /npm run setup/);
  mkdirSync(f.path);
  assert.throws(() => loadConfig(f.path), /keine lesbare reguläre Datei/);
  const other = join(f.cwd, 'invalid.json');
  writeFileSync(other, 'PRIVATE-INVALID-CONFIG');
  assert.throws(() => loadConfig(other), error => {
    assert.match(error.message, /npm run setup/);
    assert.doesNotMatch(error.message, /PRIVATE-INVALID-CONFIG/);
    return true;
  });
});

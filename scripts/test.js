import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Own exactly one disposable PostgreSQL container; never use the application stack.
const name = 'billard-tests-' + randomBytes(8).toString('hex');
const password = randomBytes(24).toString('hex');
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Docker failed');
  return result.stdout.trim();
}
let started = false;
try {
  docker(['run', '--detach', '--rm', '--name', name, '-e', 'POSTGRES_USER=billard_test', '-e', `POSTGRES_PASSWORD=${password}`, '-p', '127.0.0.1::5432', 'postgres:17-alpine']);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const probe = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'billard_test'], { windowsHide: true, stdio: 'ignore' });
    if (probe.status === 0) { ready = true; break; }
    await setTimeout(500);
  }
  if (!ready) throw new Error('Test-PostgreSQL wurde nicht bereit.');
  const port = docker(['port', name, '5432/tcp']).split(':').at(-1);
  const code = await new Promise((resolve, reject) => {
    const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(new URL('../tests/', import.meta.url)).filter(name => name.endsWith('.test.js')).map(name => fileURLToPath(new URL('../tests/' + name, import.meta.url)));
    const child = spawn(process.execPath, ['--test', '--test-concurrency=4', ...files], {
      stdio: 'inherit', windowsHide: true,
      env: { ...process.env, DATABASE_PASSWORD_CONFIG: '', TEST_DATABASE_URL: `postgres://billard_test:${password}@127.0.0.1:${port}/postgres` },
    });
    child.on('error', reject); child.on('exit', code => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  if (started) docker(['stop', name]);
}

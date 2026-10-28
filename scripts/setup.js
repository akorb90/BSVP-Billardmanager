import { chownSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
mkdirSync('secrets', { recursive: true });
// Docker Desktop can create a directory here when started before setup.
// Preserve it instead of deleting anything, and never touch non-empty directories.
if (existsSync('secrets/config.json')) {
  if (!lstatSync('secrets/config.json').isDirectory()) {
    console.error('secrets/config.json ist bereits vorhanden und bleibt unverändert.');
    process.exit(1);
  }
  if (readdirSync('secrets/config.json').length) {
    console.error('secrets/config.json ist ein nicht leerer Ordner. Inhalt sichern und den Ordner manuell umbenennen; danach npm run setup ausführen.');
    process.exit(1);
  }
  let backup = 'secrets/config.json.directory-backup';
  for (let n = 1; existsSync(backup); n++) backup = `secrets/config.json.directory-backup-${n}`;
  renameSync('secrets/config.json', backup);
  console.log(`Leeren Docker-Ordner nach ${backup} verschoben.`);
}
const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16).toString('hex');
const config = { adminHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`, tables: Array.from({ length: 8 }, () => randomBytes(32).toString('base64url')) };
writeFileSync('secrets/config.json', JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
// The one-shot setup container runs as root; only the app user may read the file.
if (process.getuid?.() === 0) chownSync('secrets/config.json', 1000, 1000);
console.log(`Admin-Passwort (sicher im Passwortmanager speichern): ${password}\nDie Tischschlüssel liegen in secrets/config.json. Vorhandene Konfigurationen werden niemals überschrieben.`);

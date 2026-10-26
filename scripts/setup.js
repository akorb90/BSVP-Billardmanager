import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
mkdirSync('secrets', { recursive: true });
const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16).toString('hex');
const config = { adminHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`, tables: Array.from({ length: 8 }, () => randomBytes(32).toString('base64url')) };
writeFileSync('secrets/config.json', JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Admin-Passwort (sicher im Passwortmanager speichern): ${password}\nDie Tischschlüssel liegen in secrets/config.json. Vorhandene Konfigurationen werden niemals überschrieben.`);

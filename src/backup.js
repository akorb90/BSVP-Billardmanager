import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { DEFAULT_BRANDING, validateBranding } from './branding.js';

export const BACKUP_LIMIT = 50 * 1024 * 1024;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quote = name => '"' + name.replaceAll('"', '""') + '"';

// Table names and SQL always come from our installed schema, never from the upload.
export function backupService({ db, transaction, fail, log }) {
  const schema = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC,name").all();
  const tables = schema.filter(item => item.type === 'table').map(item => item.name);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const read = () => Object.fromEntries(tables.map(name => [name, db.prepare(`SELECT * FROM ${quote(name)} ORDER BY rowid`).all()]));
  const revision = () => digest(read());
  const upgrade = backup => {
    if (!backup?.data || typeof backup.data!=='object' || backup?.schema!==6 || version!==7 || backup.checksum!==digest(backup.data) || Object.hasOwn(backup.data,'branding')) return backup;
    const {primary,...defaults}=DEFAULT_BRANDING;
    const data={...backup.data,branding:[{id:1,...defaults,primary_color:primary}]};
    return {...backup,schema:7,data,checksum:digest(data)};
  };
  const validate = backup => {
    backup=upgrade(backup);
    if (!backup || backup.format !== 'bsvp-billardmanager' || backup.version !== 1 || backup.schema !== version || typeof backup.created_at !== 'string' || !Number.isFinite(Date.parse(backup.created_at)) || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data) || Object.keys(backup.data).sort().join() !== [...tables].sort().join() || backup.checksum !== digest(backup.data)) throw fail(400, 'Ungültige, beschädigte oder nicht kompatible Sicherung. Bitte die passende App-Version verwenden.');
    const check = new DatabaseSync(':memory:');
    try {
      for (const item of schema) check.exec(item.sql);
      for (const name of tables) {
        const fields = check.prepare(`PRAGMA table_info(${quote(name)})`).all();
        const columns = fields.map(c => c.name);
        const rows = backup.data[name];
        if (!Array.isArray(rows)) throw new Error('rows');
        const insert = check.prepare(`INSERT INTO ${quote(name)} (${columns.map(quote)}) VALUES (${columns.map(() => '?')})`);
        for (const row of rows) {
          if (!row || Object.keys(row).sort().join() !== [...columns].sort().join() || Object.values(row).some(v => v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)))) throw new Error('row');
          for (const field of fields) {
            const value = row[field.name];
            if (value === null) { if(field.notnull || field.pk) throw new Error('null'); }
            else if (field.type === 'INTEGER' ? !Number.isSafeInteger(value) : field.type === 'TEXT' ? typeof value !== 'string' : typeof value !== 'number') throw new Error('type');
          }
          insert.run(...columns.map(c => row[c]));
        }
      }
      if (check.prepare('PRAGMA foreign_key_check').all().length || check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('integrity');
      const credentials = check.prepare('SELECT * FROM admin_credentials').all();
      const brand=check.prepare('SELECT *,primary_color AS "primary" FROM branding').all();
      if(brand.length!==1) throw new Error('branding');
      validateBranding(brand[0]);
      if (credentials.length !== 1 || !/^[a-zA-Z0-9]+:[a-f0-9]{128}$/.test(credentials[0].password_hash) || check.prepare('SELECT * FROM rental_settings').all().length !== 1) throw new Error('settings');
      for (const name of ['events', 'matches', 'rentals']) {
        const counter = check.prepare('SELECT value FROM entity_ids WHERE name=?').get(name)?.value;
        if (!Number.isSafeInteger(counter) || counter < check.prepare(`SELECT COALESCE(MAX(id),0) AS max FROM ${quote(name)}`).get().max) throw new Error('counter');
      }
      if (check.prepare("SELECT 1 FROM matches m JOIN rentals r ON m.table_no=r.table_no WHERE m.status='live' AND r.status='active'").get()) throw new Error('occupied');
      if (check.prepare("SELECT 1 FROM matches WHERE a<0 OR b<0 OR a>target OR b>target OR (a=target AND b=target) OR version<0 OR auth_version<0 OR elapsed_ms<0 OR (status='live' AND table_no IS NULL) OR (status='finished' AND MAX(a,b)<>target)").get()) throw new Error('score');
      if (check.prepare('SELECT 1 FROM rental_settings WHERE base_cents<0 OR base_cents>1000000 OR version<0').get() || check.prepare('SELECT 1 FROM rentals WHERE hourly_cents<0 OR base_cents<0 OR started_at<0 OR version<0 OR (ended_at IS NOT NULL AND ended_at<started_at)').get()) throw new Error('rental');
      return { created_at: backup.created_at, events: backup.data.events.length, matches: backup.data.matches.length, rentals: backup.data.rentals.length, active: backup.data.matches.filter(m => m.status === 'live').length + backup.data.rentals.filter(r => r.status === 'active').length };
    } catch { throw fail(400, 'Die Sicherung enthält ungültige oder widersprüchliche Daten. Es wurden keine Daten geändert.'); }
    finally { check.close(); }
  };
  return {
    export: () => transaction(() => {
      const data = read();
      const backup = { format: 'bsvp-billardmanager', version: 1, schema: version, created_at: new Date().toISOString(), data, checksum: digest(data) };
      if (Buffer.byteLength(JSON.stringify(backup)) > BACKUP_LIMIT - 4096) throw fail(413, 'Sicherung überschreitet 50 MiB. Bitte die dokumentierte Volume-Sicherung verwenden.');
      return backup;
    }),
    preview(backup, session) {
      const summary = validate(backup);
      session.restore = { checksum: digest(backup), revision: revision(), expires: Date.now() + 10 * 60_000 };
      return summary;
    },
    restore(body, session) {
      if (body.action !== 'backup:restore' || body.confirmation !== 'DATEN WIEDERHERSTELLEN') throw fail(400, 'Bitte DATEN WIEDERHERSTELLEN eingeben.');
      const summary = validate(body.backup), pending = session.restore, upgraded = upgrade(body.backup);
      transaction(() => {
        if (!pending || pending.expires < Date.now() || pending.checksum !== digest(body.backup) || pending.revision !== revision()) throw fail(409, 'Die Vorschau ist abgelaufen oder Daten wurden geändert. Bitte die Sicherung erneut prüfen.');
        db.exec('PRAGMA defer_foreign_keys=ON');
        for (const name of tables) db.exec(`DELETE FROM ${quote(name)}`);
        for (const name of tables) {
          const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(c => c.name);
          const insert = db.prepare(`INSERT INTO ${quote(name)} (${columns.map(quote)}) VALUES (${columns.map(() => '?')})`);
          for (const row of upgraded.data[name]) insert.run(...columns.map(c => row[c]));
        }
        log('admin', 'backup:restore', null, summary);
      });
      return { ok: true };
    }
  };
}

import {validateTournamentBackup} from './tournaments.js';
import { SCHEMA_VERSION, quote } from './database.js';
import { createHash } from 'node:crypto';
import { DEFAULT_BRANDING, validateBranding } from './branding.js';

export const BACKUP_LIMIT = 50 * 1024 * 1024;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Table names and SQL always come from our installed schema, never from the upload.
export async function backupService({ db, transaction, fail, log }) {
  const version = SCHEMA_VERSION;
  const tables = await db.tables();
  const fields = Object.fromEntries(await Promise.all(tables.map(async name => [name, await db.columns(name)])));
  const read = async () => {
    const result = {};
    for (const name of tables) result[name] = await db.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${fields[name].map(c => quote(c.name)).join(',')}`).all();
    return result;
  };
  const revision = async () => digest(await read());
  const replace = async data => {
    await db.defer();
    for (const name of [...tables].reverse()) await db.exec(`DELETE FROM ${quote(name)}`);
    for (const name of tables) {
      const columns = fields[name].map(c => c.name);
      const insert = db.prepare(`INSERT INTO ${quote(name)} (${columns.map(quote)}) VALUES (${columns.map(() => '?')})`);
      for (const row of data[name]) await insert.run(...columns.map(c => row[c]));
    }
  };
  const upgrade = backup => {
    if (!backup?.data || typeof backup.data!=='object' || ![6,7,8,9,10,11,12].includes(backup.schema) || version!==13 || backup.checksum!==digest(backup.data)) return backup;
    let data={...backup.data};
    if (backup.schema===6) {
      if (Object.hasOwn(data,'branding')) return backup;
      const {primary,...defaults}=DEFAULT_BRANDING;
      data.branding=[{id:1,...defaults,primary_color:primary}];
    }
    if(backup.schema<8) {
      if (Object.hasOwn(data,'table_settings')) return backup;
      data.table_settings=[{id:1,table_count:8,version:0}];
    }
    if(backup.schema<9) {
    for(const name of ['players','teams','team_players','event_players','event_teams']) {if(Object.hasOwn(data,name))return backup;data[name]=[];}
    if(!Array.isArray(data.matches) || data.matches.some(m=>!m || typeof m!=='object' || ['player_a_id','player_b_id','team_a_id','team_b_id','team_a_name','team_b_name'].some(k=>Object.hasOwn(m,k))))return backup;
    data.matches=data.matches.map(m=>({...m,player_a_id:null,player_b_id:null,team_a_id:null,team_b_id:null,team_a_name:null,team_b_name:null}));
    }
    if(backup.schema<10)for(const name of ['nuliga_entities','nuliga_sync']) {if(Object.hasOwn(data,name))return backup;data[name]=[];}
    if(backup.schema<11){
    if(Object.hasOwn(data,'event_planning')||Object.hasOwn(data,'nuliga_schedule_sync'))return backup;
    data.event_planning=data.events.map(e=>({event_id:e.id,started:1,source_id:null,metadata:'{}'}));data.nuliga_schedule_sync=[];
    }
    if(backup.schema<12){if(Object.hasOwn(data,'event_match_slots')||!Array.isArray(data.events))return backup;data.event_match_slots=data.events.flatMap(e=>Array.from({length:10},(_,i)=>({event_id:e.id,slot:i+1,match_id:null,player_a_id:null,player_a2_id:null,player_b_id:null,player_b2_id:null,table_no:null,target:null,version:0})));}
    if(!Array.isArray(data.players))return backup;
    data.players=data.players.map(p=>({...p,event_id:p.event_id??null}));
    return {...backup,schema:13,data,checksum:digest(data)};
  };
  const validate = async backup => {
    backup=upgrade(backup);
    if (!backup || backup.format !== 'bsvp-billardmanager' || backup.version !== 1 || backup.schema !== version || typeof backup.created_at !== 'string' || !Number.isFinite(Date.parse(backup.created_at)) || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data) || Object.keys(backup.data).sort().join() !== [...tables].sort().join() || backup.checksum !== digest(backup.data)) throw fail(400, 'Ungültige, beschädigte oder nicht kompatible Sicherung. Bitte die passende App-Version verwenden.');
    return await transaction(async () => {
      await db.exec('SAVEPOINT validate_backup');
      const check = db;
      try {
        for (const name of tables) {
          const columns = fields[name].map(c => c.name), rows = backup.data[name];
          if (!Array.isArray(rows)) throw new Error('rows');
          for (const row of rows) {
            if (!row || Object.keys(row).sort().join() !== [...columns].sort().join()) throw new Error('columns');
            for (const field of fields[name]) {
              const value = row[field.name];
              if (value === null) { if (field.notnull || field.pk) throw new Error('null'); }
              else if (field.type === 'INTEGER' ? !Number.isSafeInteger(value) : field.type === 'TEXT' ? typeof value !== 'string' : typeof value !== 'number' || !Number.isFinite(value)) throw new Error('type');
            }
          }
        }
        const data=backup.data, has=(table,id)=>data[table].some(r=>r.id===id);
        for(const p of data.players)if(p.event_id!==null&&(!Number.isSafeInteger(p.event_id)||!has('events',p.event_id)))throw new Error('guest event');
        for(const r of data.team_players)if(!has('teams',r.team_id)||!has('players',r.player_id)||data.players.find(p=>p.id===r.player_id).event_id!==null)throw new Error('team member');
        for(const r of data.event_players)if(data.players.some(p=>p.id===r.player_id&&p.event_id!==null&&p.event_id!==r.event_id))throw new Error('guest participant');
        for(const m of [...data.matches,...data.event_match_slots])for(const key of ['player_a_id','player_b_id','player_a2_id','player_b2_id'])if(data.players.some(p=>p.id===m[key]&&p.event_id!==null&&p.event_id!==m.event_id))throw new Error('guest match');
        for(const r of data.event_teams)if(!has('events',r.event_id)||!has('teams',r.team_id))throw new Error('event team');
        for(const r of data.event_players)if(!has('events',r.event_id)||!has('players',r.player_id)||(r.team_id && !data.event_teams.some(t=>t.event_id===r.event_id&&t.team_id===r.team_id)))throw new Error('participant');
        for(const m of data.matches) {
          if(m.player_a_id && m.player_a_id===m.player_b_id)throw new Error('self match');
          for(const side of ['a','b']) {
            const p=m['player_'+side+'_id'],t=m['team_'+side+'_id'],n=m['team_'+side+'_name'];
            if((p && !has('players',p))||(t && (!p||!has('teams',t)||typeof n!=='string'||!n.trim()))||(!t && n!==null))throw new Error('match association');
          }
        }
        for(const r of data.nuliga_entities) {
          if(!has(r.kind==='player'?'players':'teams',r.local_id)||!/^\d+$/.test(r.source_id))throw new Error('nuliga identity');
          const snapshot=JSON.parse(r.snapshot);
          if(!snapshot || snapshot.active!==1 || (r.kind==='player' ? typeof snapshot.first_name!=='string'||typeof snapshot.second_name!=='string'||typeof snapshot.last_name!=='string' : typeof snapshot.name!=='string'||!Array.isArray(snapshot.player_ids)||snapshot.player_ids.some(id=>!has('players',id))))throw new Error('nuliga snapshot');
        }
        for(const r of data.nuliga_sync) {const summary=JSON.parse(r.summary);if(!Number.isFinite(Date.parse(r.synced_at))||!Number.isSafeInteger(summary.players)||!Number.isSafeInteger(summary.teams)||!Array.isArray(summary.leagues))throw new Error('nuliga sync');}
        for(const slot of data.event_match_slots){
          if(!has('events',slot.event_id))throw Error('slot event');
          const ids=['player_a_id','player_a2_id','player_b_id','player_b2_id'].map(k=>slot[k]).filter(Boolean);
          if(new Set(ids).size!==ids.length||ids.some(id=>!has('players',id))||(![5,6].includes(slot.slot)&&(slot.player_a2_id||slot.player_b2_id)))throw Error('slot participants');
          if(slot.match_id){const m=data.matches.find(m=>m.id===slot.match_id);if(!m||m.event_id!==slot.event_id||m.player_a_id!==slot.player_a_id||m.player_b_id!==slot.player_b_id||m.discipline!==['8-Ball','9-Ball','10-Ball','14/1','9-Ball','10-Ball','8-Ball','9-Ball','10-Ball','14/1'][slot.slot-1]||([5,6].includes(slot.slot)&&(!slot.player_a2_id||!slot.player_b2_id)))throw Error('slot match');}
        }
        for(const e of data.events)if(!data.event_planning.some(p=>p.event_id===e.id))throw Error('missing planning state');
        for(const p of data.event_planning){if(!has('events',p.event_id))throw Error('planned event');const meta=JSON.parse(p.metadata);if(!meta||typeof meta!=='object'||Array.isArray(meta))throw Error('planning metadata');if(!p.started&&(data.matches.some(m=>m.event_id===p.event_id)||data.events.some(e=>e.id===p.event_id&&e.status==='closed')))throw Error('unstarted matches');}
        for(const r of data.nuliga_schedule_sync){const summary=JSON.parse(r.summary);if(!Number.isFinite(Date.parse(r.synced_at))||!summary||!Number.isSafeInteger(summary.found))throw Error('schedule sync');}
        validateTournamentBackup(data);
        await replace(backup.data);
        if (db.dialect === 'postgres') await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
        else if ((await db.prepare('PRAGMA foreign_key_check').all()).length) throw new Error('foreign key');
        const tableSettings=await check.prepare('SELECT * FROM table_settings').all();
        if (tableSettings.length!==1) throw new Error('table settings');
        const count=tableSettings[0].table_count;
        if (await check.prepare("SELECT 1 FROM matches WHERE status='live' AND table_no>? UNION ALL SELECT 1 FROM rentals WHERE status='active' AND table_no>?").get(count,count)) throw new Error('inactive table');
        const credentials = await check.prepare('SELECT * FROM admin_credentials').all();
        const brand=await check.prepare('SELECT *,primary_color AS "primary" FROM branding').all();
        if(brand.length!==1) throw new Error('branding');
        validateBranding(brand[0]);
        if (credentials.length !== 1 || !/^[a-zA-Z0-9]+:[a-f0-9]{128}$/.test(credentials[0].password_hash) || (await check.prepare('SELECT * FROM rental_settings').all()).length !== 1) throw new Error('settings');
        for (const name of ['events', 'matches', 'rentals']) {
          const counter = (await check.prepare('SELECT value FROM entity_ids WHERE name=?').get(name))?.value;
          if (!Number.isSafeInteger(counter) || counter < (await check.prepare(`SELECT COALESCE(MAX(id),0) AS max FROM ${quote(name)}`).get()).max) throw new Error(`counter: ${name}`);
        }
        if (await check.prepare("SELECT 1 FROM matches m JOIN rentals r ON m.table_no=r.table_no WHERE m.status='live' AND r.status='active'").get()) throw new Error('occupied');
        if (await check.prepare("SELECT 1 FROM matches WHERE a<0 OR b<0 OR a>target OR b>target OR (a=target AND b=target) OR version<0 OR auth_version<0 OR elapsed_ms<0 OR (status='live' AND table_no IS NULL) OR (status='finished' AND CASE WHEN a>b THEN a ELSE b END<>target)").get()) throw new Error('score');
        if ((await check.prepare('SELECT 1 FROM rental_settings WHERE base_cents<0 OR base_cents>1000000 OR version<0').get()) || (await check.prepare('SELECT 1 FROM rentals WHERE hourly_cents<0 OR base_cents<0 OR started_at<0 OR version<0 OR (ended_at IS NOT NULL AND ended_at<started_at)').get())) throw new Error('rental');
        return { created_at: backup.created_at, events: backup.data.events.length, matches: backup.data.matches.length, rentals: backup.data.rentals.length, active: backup.data.matches.filter(m => m.status === 'live').length + backup.data.rentals.filter(r => r.status === 'active').length };
      } catch (error) { console.error('Backup validation failed:', error.code || error.message); throw fail(400, 'Die Sicherung enthält ungültige oder widersprüchliche Daten. Es wurden keine Daten geändert.'); }
      finally { await db.exec('ROLLBACK TO SAVEPOINT validate_backup'); await db.exec('RELEASE SAVEPOINT validate_backup'); }
    });
  };
  return {
    export: async () => await transaction(async () => {
      const data = await read();
      const backup = { format: 'bsvp-billardmanager', version: 1, schema: version, created_at: new Date().toISOString(), data, checksum: digest(data) };
      if (Buffer.byteLength(JSON.stringify(backup)) > BACKUP_LIMIT - 4096) throw fail(413, 'Sicherung überschreitet 50 MiB. Bitte die dokumentierte Volume-Sicherung verwenden.');
      return backup;
    }),
    async preview(backup, session) {
      const summary = await validate(backup);
      session.restore = { checksum: digest(backup), revision: await transaction(revision), expires: Date.now() + 10 * 60_000 };
      return summary;
    },
    async restore(body, session) {
      if (body.action !== 'backup:restore' || body.confirmation !== 'DATEN WIEDERHERSTELLEN') throw fail(400, 'Bitte DATEN WIEDERHERSTELLEN eingeben.');
      const summary = await validate(body.backup), pending = session.restore, upgraded = upgrade(body.backup);
      await transaction(async () => {
        if (!pending || pending.expires < Date.now() || pending.checksum !== digest(body.backup) || pending.revision !== (await revision())) throw fail(409, 'Die Vorschau ist abgelaufen oder Daten wurden geändert. Bitte die Sicherung erneut prüfen.');
        await replace(upgraded.data);
        await db.resetIdentity();
        await log('admin', 'backup:restore', null, summary);
      });
      return { ok: true };
    }
  };
}

import { randomUUID } from 'node:crypto';

export const playerSchema = `
CREATE TABLE players(id TEXT PRIMARY KEY,first_name TEXT NOT NULL CHECK(length(trim(first_name)) BETWEEN 1 AND 100),second_name TEXT NOT NULL DEFAULT '' CHECK(length(second_name)<=100),last_name TEXT NOT NULL CHECK(length(trim(last_name)) BETWEEN 1 AND 100),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0));
CREATE TABLE teams(id TEXT PRIMARY KEY,name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0));
CREATE TABLE team_players(team_id TEXT NOT NULL,player_id TEXT NOT NULL,PRIMARY KEY(team_id,player_id));
CREATE TABLE event_teams(event_id INTEGER NOT NULL,team_id TEXT NOT NULL,PRIMARY KEY(event_id,team_id));
CREATE TABLE event_players(event_id INTEGER NOT NULL,player_id TEXT NOT NULL,team_id TEXT,PRIMARY KEY(event_id,player_id));
ALTER TABLE matches ADD COLUMN player_a_id TEXT;
ALTER TABLE matches ADD COLUMN player_b_id TEXT;
ALTER TABLE matches ADD COLUMN team_a_id TEXT;
ALTER TABLE matches ADD COLUMN team_b_id TEXT;
ALTER TABLE matches ADD COLUMN team_a_name TEXT;
ALTER TABLE matches ADD COLUMN team_b_name TEXT;
`;
export const playerName = p => [p.first_name,p.second_name,p.last_name].filter(Boolean).join(' ');

export function playerService({db,transaction,fail,text,log,openEvent,touchEvent}) {
  const all = name => db.prepare(`SELECT * FROM ${name}`).all();
  const get = async (table,id) => {const row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!row)throw fail(400,'Spieler oder Mannschaft nicht gefunden.');return row;};
  const ids = value => {if(!Array.isArray(value)||value.length>200||value.some(v=>typeof v!=='string')||new Set(value).size!==value.length)throw fail(400,'Bitte eindeutige Einträge auswählen (maximal 200).');return value;};
  return {
    async state() {return {players:await all('players'),teams:await all('teams'),team_players:await all('team_players'),event_players:await all('event_players'),event_teams:await all('event_teams')};},
    async save(kind,body) {return transaction(async()=>{
      const table=kind==='player'?'players':'teams', before=body.id?await get(table,body.id):null;
      if(before && before.version!==body.version)throw fail(409,'Eintrag wurde geändert. Bitte neu öffnen.');
      const id=before?.id || randomUUID(), active=body.active===undefined?1:body.active;
      if(![0,1].includes(active))throw fail(400,'Ungültiger Auswahlstatus.');
      if(kind==='player') {
        const first=text(body.first_name), last=text(body.last_name), second=body.second_name===''||body.second_name===undefined?'':text(body.second_name);
        const duplicates=(await all('players')).filter(p=>p.id!==id && playerName(p).toLocaleLowerCase('de')===playerName({first_name:first,second_name:second,last_name:last}).toLocaleLowerCase('de'));
        if(!before && duplicates.length && body.allow_duplicate!==true)throw fail(409,'Möglicher Doppeleintrag: '+duplicates.map(p=>playerName(p)+' · ID '+p.id).join(', ')+'. Bitte ausdrücklich als andere Person bestätigen.');
        if(before)await db.prepare('UPDATE players SET first_name=?,second_name=?,last_name=?,active=?,version=version+1 WHERE id=?').run(first,second,last,active,id);
        else await db.prepare('INSERT INTO players(id,first_name,second_name,last_name,active) VALUES(?,?,?,?,?)').run(id,first,second,last,active);
      } else {
        const name=text(body.name), members=ids(body.player_ids);
        for(const pid of members)await get('players',pid);
        if(before)await db.prepare('UPDATE teams SET name=?,active=?,version=version+1 WHERE id=?').run(name,active,id);
        else await db.prepare('INSERT INTO teams(id,name,active) VALUES(?,?,?)').run(id,name,active);
        await db.prepare('DELETE FROM team_players WHERE team_id=?').run(id);
        for(const pid of members)await db.prepare('INSERT INTO team_players VALUES(?,?)').run(id,pid);
      }
      await log('admin',kind+':save',null,{before,after:await get(table,id)});return {id};
    });},
    async participants(eventId,body) {return transaction(async()=>{
      const event=await openEvent(eventId);
      if(event.version!==body.version)throw fail(409,'Spieltag wurde geändert. Bitte neu öffnen.');
      const players=ids(body.player_ids), teams=ids(body.team_ids);
      if(event.kind!=='Liga' && teams.length)throw fail(400,'Mannschaften sind für Liga-Spieltage vorgesehen.');
      for(const id of players)if(!(await get('players',id)).active)throw fail(400,'Archivierte Spieler sind nicht mehr auswählbar.');
      for(const id of teams)if(!(await get('teams',id)).active)throw fail(400,'Archivierte Mannschaften sind nicht mehr auswählbar.');
      const assignments=body.assignments || {};
      await db.prepare('DELETE FROM event_players WHERE event_id=?').run(eventId);
      await db.prepare('DELETE FROM event_teams WHERE event_id=?').run(eventId);
      for(const id of teams)await db.prepare('INSERT INTO event_teams VALUES(?,?)').run(eventId,id);
      for(const id of players) {
        const team=assignments[id] || null;
        if(team && (!teams.includes(team)||!await db.prepare('SELECT 1 FROM team_players WHERE team_id=? AND player_id=?').get(team,id)))throw fail(400,'Mannschaft und Spielerzuordnung passen nicht zusammen.');
        await db.prepare('INSERT INTO event_players VALUES(?,?,?)').run(eventId,id,team);
      }
      await touchEvent(eventId);await log('admin','event:participants',null,{event_id:eventId,players,teams,assignments});return {ok:true};
    });},
    async resolve(eventId,body,previous={}) {
      const result={};
      for(const side of ['a','b']) {
        const key='player_'+side+'_id', id=Object.hasOwn(body,key)?body[key]||null:previous[key]||null;
        result[key]=id;
        if(id && id===previous[key]) {result['player_'+side]=text(body['player_'+side]??previous['player_'+side],302);result['team_'+side+'_id']=previous['team_'+side+'_id'];result['team_'+side+'_name']=previous['team_'+side+'_name'];continue;}
        if(id) {
          const p=await get('players',id), participation=await db.prepare('SELECT * FROM event_players WHERE event_id=? AND player_id=?').get(eventId,id);
          if(!p.active || !participation)throw fail(400,'Bitte einen aktiven Teilnehmer dieses Spieltags auswählen.');
          const team=participation.team_id?await get('teams',participation.team_id):null;
          result['player_'+side]=playerName(p); result['team_'+side+'_id']=team?.id??null; result['team_'+side+'_name']=team?.name??null;
        } else {result['player_'+side]=text(body['player_'+side],302);result['team_'+side+'_id']=null;result['team_'+side+'_name']=null;}
      }
      if(result.player_a_id && result.player_a_id===result.player_b_id)throw fail(400,'Dieselbe Person darf nicht gegen sich selbst spielen.');
      return result;
    }
  };
}

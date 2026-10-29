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

export function playerService({db,transaction,fail,text,log,openEvent,getEvent,touchEvent}) {
  const all = name => db.prepare(`SELECT * FROM ${name}`).all();
  const get = async (table,id) => {const row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!row)throw fail(400,'Spieler oder Mannschaft nicht gefunden.');return row;};
  const ids = value => {if(!Array.isArray(value)||value.length>200||value.some(v=>typeof v!=='string')||new Set(value).size!==value.length)throw fail(400,'Bitte eindeutige Einträge auswählen (maximal 200).');return value;};
  return {
    async state() {
      const teams=await all('teams'),members=await all('team_players'),sources=await all('nuliga_entities');
      const teamSources=new Map(sources.filter(s=>s.kind==='team').map(s=>[s.local_id,JSON.parse(s.snapshot)]));
      const ownTeams=new Set(teams.filter(t=>/^BSV Pfaffenhofen(?:\s+[IVX]+)?$/i.test(teamSources.get(t.id)?.name||t.name)).map(t=>t.id));
      const profiles=new Map(sources.filter(s=>s.kind==='player').map(s=>[s.local_id,'https://bbv-billard.liga.nu/cgi-bin/WebObjects/nuLigaBILLARDDE.woa/wa/playerPortrait?federation=BBV&person='+encodeURIComponent(s.source_id)]));
      const players=(await all('players')).map(p=>({...p,is_bsv:members.some(m=>m.player_id===p.id&&ownTeams.has(m.team_id)),nuliga_profile:profiles.get(p.id)||null}));
      const teamProfiles=new Map(sources.filter(s=>s.kind==='team').map(s=>[s.local_id,'https://bbv-billard.liga.nu/cgi-bin/WebObjects/nuLigaBILLARDDE.woa/wa/teamPortrait?teamtable='+encodeURIComponent(s.source_id)]));
      return {players,teams:teams.map(t=>({...t,nuliga_profile:teamProfiles.get(t.id)||null})),team_players:members,event_players:await all('event_players'),event_teams:await all('event_teams')};
    },
    async save(kind,body) {return transaction(async()=>{
      const table=kind==='player'?'players':'teams', before=body.id?await get(table,body.id):null;
      if(before?.event_id)throw fail(400,'Gastspieler können nur in ihrem Spieltag verwendet werden.');
      if(before && before.version!==body.version)throw fail(409,'Eintrag wurde geändert. Bitte neu öffnen.');
      const id=before?.id || randomUUID(), active=body.active===undefined?1:body.active;
      if(![0,1].includes(active))throw fail(400,'Ungültiger Auswahlstatus.');
      if(kind==='player') {
        const first=text(body.first_name), last=text(body.last_name), second=body.second_name===''||body.second_name===undefined?'':text(body.second_name);
        const duplicates=(await all('players')).filter(p=>!p.event_id && p.id!==id && playerName(p).toLocaleLowerCase('de')===playerName({first_name:first,second_name:second,last_name:last}).toLocaleLowerCase('de'));
        if(!before && duplicates.length && body.allow_duplicate!==true)throw fail(409,'Möglicher Doppeleintrag: '+duplicates.map(p=>playerName(p)+' · ID '+p.id).join(', ')+'. Bitte ausdrücklich als andere Person bestätigen.');
        if(before)await db.prepare('UPDATE players SET first_name=?,second_name=?,last_name=?,active=?,version=version+1 WHERE id=?').run(first,second,last,active,id);
        else await db.prepare('INSERT INTO players(id,first_name,second_name,last_name,active) VALUES(?,?,?,?,?)').run(id,first,second,last,active);
      } else {
        const name=text(body.name), members=ids(body.player_ids);
        for(const pid of members)if((await get('players',pid)).event_id)throw fail(400,'Gastspieler gehören nur zu ihrem Spieltag.');
        if(before)await db.prepare('UPDATE teams SET name=?,active=?,version=version+1 WHERE id=?').run(name,active,id);
        else await db.prepare('INSERT INTO teams(id,name,active) VALUES(?,?,?)').run(id,name,active);
        await db.prepare('DELETE FROM team_players WHERE team_id=?').run(id);
        for(const pid of members)await db.prepare('INSERT INTO team_players VALUES(?,?)').run(id,pid);
      }
      await log('admin',kind+':save',null,{before,after:await get(table,id)});return {id};
    });},
    async participants(eventId,body) {return transaction(async()=>{
      const event=body.start===true?await getEvent(eventId):await openEvent(eventId);
      const tournamentPlan=await db.prepare('SELECT metadata FROM event_planning WHERE event_id=?').get(eventId);
      const tournamentMeta=JSON.parse(tournamentPlan?.metadata||'{}');
      if(tournamentMeta.tournament||tournamentMeta.tournamentPreview)throw fail(409,'Turnierteilnehmer bitte über die Auslosung verwalten.');
      if(event.version!==body.version)throw fail(409,'Spieltag wurde geändert. Bitte neu öffnen.');
      if(body.start===true){
        const plan=await db.prepare('SELECT * FROM event_planning WHERE event_id=?').get(eventId);
        if(event.status!=='open'||!plan||plan.started)throw fail(409,'Spieltag wurde bereits gestartet oder abgeschlossen.');
      }
      const players=ids(body.player_ids), teams=ids(body.team_ids);
      if(event.kind==='Liga'&&body.start===true&&teams.length!==2)throw fail(400,'Bitte zwei unterschiedliche Mannschaften auswählen.');
      if(event.kind!=='Liga' && teams.length)throw fail(400,'Mannschaften sind für Liga-Spieltage vorgesehen.');
      for(const id of players){const p=await get('players',id);if(!p.active||(p.event_id&&p.event_id!==eventId))throw fail(400,'Bitte aktive Spieler dieses Spieltags auswählen.');}
      for(const id of teams)if(!(await get('teams',id)).active)throw fail(400,'Archivierte Mannschaften sind nicht mehr auswählbar.');
      const assignments=body.assignments || {};
      const guests=body.guests??[];
      if(!Array.isArray(guests)||guests.length>20)throw fail(400,'Maximal 20 Gastspieler pro Vorgang.');
      for(const guest of guests){
        if(!guest||!teams.includes(guest.team_id))throw fail(400,'Gastspieler einer ausgewählten Mannschaft zuordnen.');
        const name=text(guest.name,100),parts=name.split(/\s+/),first=parts.shift(),last=parts.join(' ')||'Gast';
        const id=randomUUID();
        await db.prepare('INSERT INTO players(id,first_name,last_name,event_id) VALUES(?,?,?,?)').run(id,first,last,eventId);
        players.push(id);assignments[id]=guest.team_id;
      }
      const slots=await db.prepare('SELECT * FROM event_match_slots WHERE event_id=?').all(eventId);
      for(const slot of slots)for(const key of ['player_a_id','player_a2_id','player_b_id','player_b2_id'])if(slot[key]&&!players.includes(slot[key]))throw fail(409,'Spieler ist bereits einer Partie zugeordnet. Zuerst die Aufstellung anpassen.');
      await db.prepare('DELETE FROM event_players WHERE event_id=?').run(eventId);
      await db.prepare('DELETE FROM event_teams WHERE event_id=?').run(eventId);
      for(const id of teams)await db.prepare('INSERT INTO event_teams VALUES(?,?)').run(eventId,id);
      for(const id of players) {
        const team=assignments[id] || null;
        if(team && (!teams.includes(team)||((await get('players',id)).event_id!==eventId&&!await db.prepare('SELECT 1 FROM team_players WHERE team_id=? AND player_id=?').get(team,id))))throw fail(400,'Mannschaft und Spielerzuordnung passen nicht zusammen.');
        await db.prepare('INSERT INTO event_players VALUES(?,?,?)').run(eventId,id,team);
      }
      if(body.start===true){
        await db.prepare('UPDATE event_planning SET started=1 WHERE event_id=?').run(eventId);
        for(let slot=1;slot<=10;slot++)await db.prepare('INSERT INTO event_match_slots(event_id,slot) VALUES(?,?) ON CONFLICT(event_id,slot) DO NOTHING').run(eventId,slot);
      }
      await touchEvent(eventId);await log('admin','event:participants',null,{event_id:eventId,players,teams,assignments,guests,start:body.start===true});return {ok:true};
    });},
    async resolve(eventId,body,previous={}) {
      const result={};
      for(const side of ['a','b']) {
        const key='player_'+side+'_id', id=Object.hasOwn(body,key)?body[key]||null:previous[key]||null;
        result[key]=id;
        if(id){const p=await get('players',id);if(p.event_id&&p.event_id!==eventId)throw fail(400,'Gastspieler gehören nur zu ihrem Spieltag.');}
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

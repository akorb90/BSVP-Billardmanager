import {playerName} from './players.js';

export const LEAGUE_SLOTS=['8-Ball','9-Ball','10-Ball','14/1','9-Ball','10-Ball','8-Ball','9-Ball','10-Ball','14/1'].map((discipline,i)=>({slot:i+1,discipline,doubles:i===4||i===5,round:i<4?1:i<6?2:3}));
export const leagueSchema=`CREATE TABLE event_match_slots(event_id INTEGER NOT NULL,slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 10),match_id INTEGER UNIQUE,player_a_id TEXT,player_a2_id TEXT,player_b_id TEXT,player_b2_id TEXT,table_no INTEGER CHECK(table_no BETWEEN 1 AND 20),target INTEGER CHECK(target BETWEEN 1 AND 999),version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),PRIMARY KEY(event_id,slot));
INSERT INTO event_match_slots(event_id,slot) SELECT e.id,s.slot FROM events e CROSS JOIN (SELECT 1 AS slot UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10) s;`;

export function migrateLeague(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const sql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='matches'").get().sql;
    const indexes=db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='matches' AND sql IS NOT NULL").all();
    db.exec(sql.replace(/CREATE TABLE\s+"?matches"?/i,'CREATE TABLE matches_expanded').replace(/target BETWEEN 1 AND 99\b/,'target BETWEEN 1 AND 999'));
    db.exec('INSERT INTO matches_expanded SELECT * FROM matches;DROP TABLE matches;ALTER TABLE matches_expanded RENAME TO matches;');
    for(const index of indexes)db.exec(index.sql);
    db.exec(leagueSchema+'PRAGMA user_version=12;COMMIT;');
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function leagueService({db,transaction,fail,log,nextId,openEvent,touchEvent,tables,rentals,encodePin}) {
  return {
    state:()=>db.prepare('SELECT * FROM event_match_slots ORDER BY event_id,slot').all(),
    async initialize(eventId){for(const s of LEAGUE_SLOTS)await db.prepare('INSERT INTO event_match_slots(event_id,slot) VALUES(?,?) ON CONFLICT(event_id,slot) DO NOTHING').run(eventId,s.slot);},
    async save(eventId,number,body){return transaction(async()=>{
      const event=await openEvent(eventId),spec=LEAGUE_SLOTS.find(s=>s.slot===number);
      if(!spec)throw fail(400,'Ungültige Partie.');
      const before=await db.prepare('SELECT * FROM event_match_slots WHERE event_id=? AND slot=?').get(eventId,number);
      if((before?.version||0)!==body.version)throw fail(409,'Aufstellung wurde geändert. Bitte neu laden.');
      if(before?.match_id)throw fail(409,'Die Partie ist bereits gestartet. Aufstellung ist gesperrt.');
      const fields=spec.doubles?['player_a_id','player_a2_id','player_b_id','player_b2_id']:['player_a_id','player_b_id'];
      const ids=fields.map(k=>body[k]||null),people={};
      if(new Set(ids.filter(Boolean)).size!==ids.filter(Boolean).length)throw fail(400,'Jeder Spieler darf in dieser Partie nur einmal ausgewählt werden.');
      for(let i=0;i<fields.length;i++)if(ids[i]) {
        const p=await db.prepare('SELECT p.*,ep.team_id FROM players p JOIN event_players ep ON ep.player_id=p.id WHERE ep.event_id=? AND p.id=? AND p.active=1').get(eventId,ids[i]);
        if(!p)throw fail(400,'Bitte Teilnehmer dieses Spieltags auswählen.');people[fields[i]]=p;
      }
      if(spec.doubles)for(const side of ['a','b'])if(people['player_'+side+'_id']&&people['player_'+side+'2_id']&&people['player_'+side+'_id'].team_id!==people['player_'+side+'2_id'].team_id)throw fail(400,'Ein Doppel muss aus Spielern derselben Mannschaft bestehen.');
      const a=people.player_a_id,b=people.player_b_id;
      if(a?.team_id&&a.team_id===b?.team_id)throw fail(400,'Bitte unterschiedliche Mannschaften auswählen.');
      const table=body.table_no===''||body.table_no===null||body.table_no===undefined?null:await tables.activeNumber(body.table_no);
      const target=body.target===''||body.target===null||body.target===undefined?null:body.target;
      if(target!==null&&(!Number.isInteger(target)||target<1||target>(spec.discipline==='14/1'?999:99)))throw fail(400,'Ungültiges Spielziel.');
      let matchId=null;
      if(body.start===true) {
        if(ids.some(id=>!id)||table===null||target===null)throw fail(400,'Vor dem Start alle Spieler, Tisch und Spielziel auswählen.');
        const pin=encodePin(body.pin);
        if(await rentals.occupied(table)||await db.prepare("SELECT 1 FROM matches WHERE status='live' AND table_no=?").get(table))throw fail(409,'Dieser Tisch ist belegt.');
        const live=await db.prepare("SELECT * FROM matches WHERE status='live'").all();
        const slots=await db.prepare('SELECT * FROM event_match_slots WHERE match_id IS NOT NULL').all();
        if(live.some(m=>{const slot=slots.find(s=>s.match_id===m.id);return ids.some(id=>[m.player_a_id,m.player_b_id,slot?.player_a2_id,slot?.player_b2_id].includes(id));}))throw fail(409,'Ein ausgewählter Spieler ist bereits an einer laufenden Partie beteiligt.');
        const teamA=a.team_id?await db.prepare('SELECT * FROM teams WHERE id=?').get(a.team_id):null;
        const teamB=b.team_id?await db.prepare('SELECT * FROM teams WHERE id=?').get(b.team_id):null;
        const name=side=>[people['player_'+side+'_id'],...(spec.doubles?[people['player_'+side+'2_id']]:[])].map(playerName).join(' / ');
        matchId=await nextId('matches');
        await db.prepare("INSERT INTO matches(id,event_id,player_a,player_b,discipline,target,first,pin_hash,player_a_id,player_b_id,team_a_id,team_b_id,team_a_name,team_b_name,table_no,status) VALUES(?,?,?,?,?,?,'a',?,?,?,?,?,?,?,?,'live')").run(matchId,eventId,name('a'),name('b'),spec.discipline,target,pin,a.id,b.id,teamA?.id||null,teamB?.id||null,teamA?.name||null,teamB?.name||null,table);
      }
      await db.prepare('INSERT INTO event_match_slots(event_id,slot) VALUES(?,?) ON CONFLICT(event_id,slot) DO NOTHING').run(eventId,number);
      await db.prepare('UPDATE event_match_slots SET player_a_id=?,player_a2_id=?,player_b_id=?,player_b2_id=?,table_no=?,target=?,match_id=?,version=version+1 WHERE event_id=? AND slot=?').run(body.player_a_id||null,spec.doubles?body.player_a2_id||null:null,body.player_b_id||null,spec.doubles?body.player_b2_id||null:null,table,target,matchId,eventId,number);
      await touchEvent(eventId);await log('admin',body.start?'league:start':'league:lineup',matchId,{before,event_id:event.id,slot:number,player_ids:ids,table_no:table,target});return {ok:true,match_id:matchId};
    });}
  };
}

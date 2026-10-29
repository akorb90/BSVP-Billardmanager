import {randomInt} from 'node:crypto';
import {playerName} from './players.js';

export const TOURNAMENT_RULES = {
  difference: 'Siege, dann Rack-/Punktedifferenz, dann erzielte Racks/Punkte. Verbleibende Gleichstände entscheidet die Spielleitung ausdrücklich mit Begründung.',
  wins: 'Siege. Gleichstände entscheidet die Spielleitung ausdrücklich mit Begründung.'
};
const error = message => Object.assign(new Error(message), {status:400});
export function validateOptions(t) {
  const ids=t.players?.map(p=>p.id);
  if(!ids || ids.length<2 || ids.length>64 || new Set(ids).size!==ids.length)throw error('Bitte 2 bis 64 unterschiedliche Spieler auswählen.');
  if(!['groups','ko','groups-ko'].includes(t.mode)||!['8-Ball','9-Ball','10-Ball','14/1'].includes(t.discipline)||!Number.isInteger(t.target)||t.target<1||t.target>(t.discipline==='14/1'?999:99)||!Object.hasOwn(TOURNAMENT_RULES,t.rules))throw error('Bitte Modus, Disziplin, gültiges Spielziel und Rangfolgeregel auswählen.');
  if(t.mode!=='ko' && (!Number.isInteger(t.groupCount)||t.groupCount<1||t.groupCount>Math.floor(ids.length/2)))throw error('Jede Gruppe benötigt mindestens zwei Teilnehmer.');
  if(t.mode==='groups-ko' && (!Number.isInteger(t.qualifiers)||t.qualifiers<1||t.qualifiers>Math.floor(ids.length/t.groupCount)||t.qualifiers*t.groupCount<2))throw error('Die Qualifikanten müssen in jede Gruppe passen und zusammen mindestens zwei Spieler ergeben.');
}
export function drawTournament(options,players) {
  const t={...options,players,groups:[],rounds:[],resolutions:{},confirmed:false,version:1};validateOptions(t);
  const ids=players.map(p=>p.id);
  for(let i=ids.length-1;i>0;i--){const j=randomInt(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
  if(t.mode==='ko')t.rounds=makeBracket(ids);
  else {t.groups=Array.from({length:t.groupCount},()=>({players:[],games:[]}));ids.forEach((id,i)=>t.groups[i%t.groupCount].players.push(id));for(const g of t.groups)for(let i=0;i<g.players.length;i++)for(let j=i+1;j<g.players.length;j++)g.games.push({a:g.players[i],b:g.players[j],match:null});}
  return t;
}
export function makeBracket(ids) {
  const size=2**Math.ceil(Math.log2(ids.length)),byes=size-ids.length,first=[];
  let index=0;
  for(let i=0;i<size/2;i++)first.push({a:ids[index++],b:i<byes?null:ids[index++],match:null});
  const rounds=[first];for(let n=size/4;n>=1;n/=2)rounds.push(Array.from({length:n},()=>({a:null,b:null,match:null})));
  if(rounds[1])for(let i=0;i<rounds[1].length;i++){rounds[1][i].a=first[2*i].b?null:first[2*i].a;rounds[1][i].b=first[2*i+1].b?null:first[2*i+1].a;}
  return rounds;
}
export function standings(t,g,matches) {
  const rows=g.players.map(id=>({id,played:0,wins:0,for:0,against:0,difference:0}));
  for(const game of g.games){const m=matches.find(m=>m.id===game.match);if(m?.status!=='finished')continue;const a=rows.find(p=>p.id===game.a),b=rows.find(p=>p.id===game.b);a.played++;b.played++;a.for+=m.a;a.against+=m.b;b.for+=m.b;b.against+=m.a;(m.a>m.b?a:b).wins++;}
  rows.forEach(r=>r.difference=r.for-r.against);
  const compare=(a,b)=>b.wins-a.wins||(t.rules==='difference'?(b.difference-a.difference||b.for-a.for):0);
  rows.sort(compare);
  const tied=rows.some((r,i)=>i&&compare(rows[i-1],r)===0);
  const order=t.resolutions[t.groups.indexOf(g)]?.order;
  if(order)rows.sort((a,b)=>compare(a,b)||order.indexOf(a.id)-order.indexOf(b.id));
  return {rows,tied:tied&&!order,complete:g.games.every(g=>matches.find(m=>m.id===g.match)?.status==='finished')};
}
const allGames=t=>[...t.groups.flatMap(g=>g.games),...t.rounds.flat()];
export function tournamentService({db,transaction,fail,getEvent,nextId,touchEvent,log,encodePin}) {
  const load=async id=>{const row=await db.prepare('SELECT * FROM event_planning WHERE event_id=?').get(id);const meta=JSON.parse(row?.metadata||'{}');return {row,meta,t:meta.tournament};};
  const save=async(id,meta)=>db.prepare('UPDATE event_planning SET metadata=? WHERE event_id=?').run(JSON.stringify(meta),id);
  const matches=async id=>db.prepare('SELECT * FROM matches WHERE event_id=?').all(id);
  async function progress(id,meta,pin) {
    const t=meta.tournament,ms=await matches(id);
    const create=async game=>{
      if(game.match||!game.a||!game.b)return;
      const a=t.players.find(p=>p.id===game.a),b=t.players.find(p=>p.id===game.b);
      game.match=await nextId('matches');
      await db.prepare("INSERT INTO matches(id,event_id,player_a,player_b,player_a_id,player_b_id,discipline,target,first,pin_hash) VALUES(?,?,?,?,?,?,?,?,'a',?)").run(game.match,id,a.name,b.name,a.id,b.id,t.discipline,t.target,pin||ms[0]?.pin_hash||null);
    };
    for(const g of t.groups)for(const game of g.games)await create(game);
    const tables=t.groups.map(g=>standings(t,g,ms));
    if(t.mode==='groups-ko'&&!t.rounds.length&&tables.every(s=>s.complete&&!s.tied)) {
      const qualifiers=[];for(let rank=0;rank<t.qualifiers;rank++)for(const s of (rank%2?[...tables].reverse():tables))qualifiers.push(s.rows[rank].id);
      t.rounds=makeBracket(qualifiers);
    }
    const winner=(game,round)=>{
      if(round===0&&game.a&&!game.b)return game.a;
      const m=ms.find(m=>m.id===game.match);return m?.status==='finished'?(m.a>m.b?game.a:game.b):null;
    };
    for(let r=0;r<t.rounds.length;r++)for(let i=0;i<t.rounds[r].length;i++){
      const game=t.rounds[r][i];if(r){game.a=winner(t.rounds[r-1][2*i],r-1);game.b=winner(t.rounds[r-1][2*i+1],r-1);}await create(game);
    }
    t.champion=t.rounds.length?winner(t.rounds.at(-1)[0],t.rounds.length-1):null;
    t.complete=t.mode==='groups'?tables.every(s=>s.complete&&!s.tied):!!t.champion;
    await save(id,meta);
  }
  return {
    async action(id,action,body){return transaction(async()=>{
      const e=await getEvent(id),{meta,t}=await load(id);
      if(e.kind!=='Turnier'||e.status!=='open')throw fail(409,'Bitte ein offenes Turnier auswählen.');
      if(body.version!==e.version)throw fail(409,'Turnier wurde geändert. Bitte neu laden und prüfen.');
      const ms=await matches(id);
      if(action==='preview'){
        if(ms.some(m=>m.status!=='planned'))throw fail(409,'Das Turnier hat begonnen. Eine neue Auslosung ist gesperrt.');
        if(ms.length&&!t?.confirmed)throw fail(409,'Vor der Auslosung vorhandene manuelle Partien entfernen.');
        const ids=body.player_ids;
        if(!Array.isArray(ids)||ids.length>64||new Set(ids).size!==ids.length)throw fail(400,'Teilnehmer dürfen nicht doppelt vorkommen (höchstens 64).');
        const people=[];for(const pid of ids){const p=await db.prepare('SELECT * FROM players WHERE id=?').get(pid);if(!p||!p.active||p.event_id!==null)throw fail(400,'Bitte aktive Spieler aus den Stammdaten auswählen.');people.push({id:p.id,name:playerName(p)});}
        const candidate=drawTournament({mode:body.mode,discipline:body.discipline,target:body.target,groupCount:body.groupCount,qualifiers:body.qualifiers,rules:body.rules},people);
        // Preview never changes the accepted draw or its matches.
        meta.tournamentPreview=candidate;
      }else if(action==='confirm'){
        if(!meta.tournamentPreview)throw fail(409,'Zuerst eine Auslosung als Vorschau erstellen.');
        if(ms.some(m=>m.status!=='planned'))throw fail(409,'Das Turnier hat begonnen; Auslosung kann nicht ersetzt werden.');
        const pin=encodePin(body.pin);
        for(const p of meta.tournamentPreview.players){const active=await db.prepare('SELECT active FROM players WHERE id=?').get(p.id);if(!active?.active)throw fail(409,'Teilnehmer wurde archiviert. Bitte erneut auslosen.');}
        await db.prepare('DELETE FROM matches WHERE event_id=?').run(id);
        await db.prepare('DELETE FROM event_players WHERE event_id=?').run(id);
        for(const p of meta.tournamentPreview.players)await db.prepare('INSERT INTO event_players VALUES(?,?,NULL)').run(id,p.id);
        meta.tournament=meta.tournamentPreview;delete meta.tournamentPreview;meta.tournament.confirmed=true;
        await db.prepare('UPDATE event_planning SET started=1 WHERE event_id=?').run(id);
        await progress(id,meta,pin);
      }else if(action==='resolve'){
        if(!t||t.rounds.length||!t.groups[body.group])throw fail(409,'Diese Gruppenentscheidung ist nicht mehr möglich.');
        const g=t.groups[body.group],s=standings(t,g,ms),order=body.order;
        if(!s.complete||!s.tied||!Array.isArray(order)||order.length!==g.players.length||new Set(order).size!==order.length||order.some(p=>!g.players.includes(p))||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500)throw fail(400,'Abgeschlossene Gruppe, eindeutige Reihenfolge aller Teilnehmer und Begründung erforderlich.');
        t.resolutions[body.group]={order,reason:body.reason.trim()};await progress(id,meta);
      }else throw fail(404,'Unbekannte Turnieraktion.');
      await save(id,meta);await touchEvent(id);await log('admin','tournament:'+action,null,{event_id:id,group:body.group,order:body.order,reason:body.reason,draw:['preview','confirm'].includes(action)?meta.tournamentPreview||meta.tournament:undefined});return {ok:true};
    });},
    async guardEvent(id,action,body){const {t,meta}=await load(id);if(!t&&!meta.tournamentPreview)return;
      if(action==='start'&&!t)throw fail(409,'Bitte zuerst die Auslosung verbindlich bestätigen.');
      if(['participants','manual','slot'].includes(action))throw fail(409,'Turnierteilnehmer und Partien werden über die Auslosung verwaltet.');
      if(action==='edit'&&body.kind!=='Turnier')throw fail(409,'Ein ausgelostes Turnier kann nicht in Liga umgewandelt werden.');
      if(action==='close'&&!t?.complete)throw fail(409,'Zuerst alle Turnierpartien und Gleichstände abschließen.');
    },
    async guardMatch(m,action,body){const {t}=await load(m.event_id);if(!t)return;const game=allGames(t).find(g=>g.match===m.id);if(!game)return;
      if(action==='delete')throw fail(409,'Generierte Turnierpartien können nicht einzeln gelöscht werden. Vor Beginn neu auslosen.');
      if(action==='start'){
        const live=await db.prepare("SELECT * FROM matches WHERE status='live'").all();
        if(live.some(x=>[x.player_a_id,x.player_b_id].some(p=>p===game.a||p===game.b)))throw fail(409,'Ein Teilnehmer spielt bereits an einem anderen Tisch.');
      }
      if(action==='edit'){
        if(body.event_id!==m.event_id||body.player_a_id!==game.a||body.player_b_id!==game.b||body.discipline!==t.discipline||body.target!==t.target||body.status!==m.status)throw fail(409,'Teilnehmer, Disziplin, Spielziel und Status generierter Partien sind gesperrt.');
        if(m.status==='finished'&&(body.a!==m.a||body.b!==m.b)){
          const r=t.rounds.findIndex(round=>round.includes(game));
          if(r<0&&(await getEvent(m.event_id)).status==='closed')throw fail(409,'Das Gruppenturnier ist endgültig abgeschlossen. Eine Korrektur könnte neue Gleichstandsentscheidungen erfordern und ist gesperrt.');
          if(r<0?t.rounds.length>0:t.rounds.slice(r+1).flat().some(g=>g.match))throw fail(409,'Folgepartien wurden bereits erzeugt. Diese Ergebniskorrektur würde die KO-Zuordnung verändern und ist gesperrt.');
          t.resolutions={};
          const {meta}=await load(m.event_id);meta.tournament=t;await save(m.event_id,meta);
        }
      }
    },
    async progress(id){const {meta,t}=await load(id);if(t)await progress(id,meta);}
  };
}

// Validate structured event metadata as well as the relational backup tables.
export function validateTournamentBackup(data) {
  for(const plan of data.event_planning){
    const meta=JSON.parse(plan.metadata);
    for(const key of ['tournament','tournamentPreview']){
      const t=meta[key];if(t===undefined)continue;
      validateOptions(t);
      const preview=key==='tournamentPreview',event=data.events.find(e=>e.id===plan.event_id);
      if(t.version!==1||event?.kind!=='Turnier'||t.confirmed!==!preview||!Array.isArray(t.groups)||!Array.isArray(t.rounds)||!t.resolutions||typeof t.resolutions!=='object'||Array.isArray(t.resolutions))throw Error('tournament metadata');
      const ids=t.players.map(p=>p.id),ms=data.matches.filter(m=>m.event_id===plan.event_id);
      for(const p of t.players)if(typeof p.name!=='string'||!p.name.trim()||p.name.length>302||!data.players.some(r=>r.id===p.id&&r.event_id===null))throw Error('tournament player');
      if(!preview&&(!plan.started||ids.some(id=>!data.event_players.some(p=>p.event_id===plan.event_id&&p.player_id===id))))throw Error('tournament participation');
      if(t.mode==='ko'?(t.groups.length!==0):(t.groups.length!==t.groupCount))throw Error('tournament groups');
      const grouped=t.groups.flatMap(g=>g.players);
      if(t.mode!=='ko'&&(grouped.length!==ids.length||new Set(grouped).size!==ids.length||grouped.some(id=>!ids.includes(id))))throw Error('group members');
      const matchIds=[];
      const checkGame=game=>{
        if(!game||!Object.hasOwn(game,'a')||!Object.hasOwn(game,'b')||!Object.hasOwn(game,'match')||[game.a,game.b].some(p=>p!==null&&!ids.includes(p))||game.a&&game.a===game.b)throw Error('tournament pairing');
        if(game.match!==null){
          if(preview||!game.a||!game.b||!Number.isSafeInteger(game.match)||matchIds.includes(game.match))throw Error('tournament match');
          const m=ms.find(m=>m.id===game.match);
          if(!m||m.player_a_id!==game.a||m.player_b_id!==game.b||m.target!==t.target||m.discipline!==t.discipline)throw Error('tournament match reference');
          matchIds.push(game.match);
        }else if(!preview&&game.a&&game.b)throw Error('missing tournament match');
      };
      for(const g of t.groups){
        if(g.players.length<2||!Array.isArray(g.games)||g.games.length!==g.players.length*(g.players.length-1)/2)throw Error('round robin');
        const pairs=new Set();for(const game of g.games){checkGame(game);if(!g.players.includes(game.a)||!g.players.includes(game.b))throw Error('group opponent');pairs.add([game.a,game.b].sort().join('/'));}
        if(pairs.size!==g.games.length)throw Error('duplicate pairing');
      }
      for(const [index,res] of Object.entries(t.resolutions)){
        const g=t.groups[index];if(!g||!Array.isArray(res.order)||res.order.length!==g.players.length||new Set(res.order).size!==g.players.length||res.order.some(id=>!g.players.includes(id))||typeof res.reason!=='string'||!res.reason.trim()||res.reason.length>500||!standings(t,g,ms).complete||preview)throw Error('tie resolution');
      }
      if(t.mode==='groups'&&t.rounds.length)throw Error('unexpected KO');
      if(t.mode==='ko'&&!t.rounds.length)throw Error('missing KO');
      let koIds=ids;
      const tables=t.groups.map(g=>standings(t,g,ms));
      if(t.mode==='groups-ko'&&t.rounds.length){
        if(tables.some(s=>!s.complete||s.tied)||preview)throw Error('unresolved qualification');
        koIds=tables.flatMap(s=>s.rows.slice(0,t.qualifiers).map(p=>p.id));
      }
      if(t.rounds.length){
        const size=2**Math.ceil(Math.log2(koIds.length));
        if(t.rounds.length!==Math.log2(size))throw Error('KO rounds');
        const seeded=t.rounds[0].flatMap(g=>[g.a,g.b]).filter(Boolean);
        if(seeded.length!==koIds.length||new Set(seeded).size!==koIds.length||seeded.some(id=>!koIds.includes(id)))throw Error('KO seeding');
        for(let r=0;r<t.rounds.length;r++){
          if(!Array.isArray(t.rounds[r])||t.rounds[r].length!==size/2**(r+1))throw Error('KO size');
          for(let i=0;i<t.rounds[r].length;i++){
            const game=t.rounds[r][i];checkGame(game);
            if(!r&&!game.a)throw Error('empty KO pairing');
            if(r)for(const [offset,side] of [[0,'a'],[1,'b']]){
              const prev=t.rounds[r-1][2*i+offset],m=ms.find(m=>m.id===prev.match);
              const expected=r===1&&!prev.b?prev.a:m?.status==='finished'?(m.a>m.b?prev.a:prev.b):null;
              if(game[side]!==expected)throw Error('KO progression');
            }
          }
        }
        const last=t.rounds.at(-1)[0],final=ms.find(m=>m.id===last.match),champion=final?.status==='finished'?(final.a>final.b?last.a:last.b):null;
        if((t.champion??null)!==champion)throw Error('tournament champion');
      }
      if(!preview){
        if(ms.some(m=>!matchIds.includes(m.id)))throw Error('untracked tournament match');
        const complete=t.mode==='groups'?tables.every(s=>s.complete&&!s.tied):!!t.champion;
        if(t.complete!==complete)throw Error('tournament completion');
      }
    }
  }
}

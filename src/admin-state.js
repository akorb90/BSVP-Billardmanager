import {standings,swissStandings} from './tournaments.js';

// Archive reads are explicitly requested and bounded; the live poll never reads them.
export function adminStateService({db,fail,publicMatch,players,tables,nuliga,schedule,rentals}) {
  const all=(sql,args=[])=>db.prepare(sql).all(...args);
  const one=(sql,args=[])=>db.prepare(sql).get(...args);
  const readNumber=(params,key,fallback)=>{
    const raw=params.get(key);if(raw===null)return fallback;
    if(!/^\d{1,9}$/.test(raw)||Number(raw)<1)throw fail(400,'Ungültige Seitenauswahl.');return Number(raw);
  };
  async function page(params,key,from,where='1=1',args=[],order='id DESC',columns='*') {
    const size=readNumber(params,key+'-size',20);
    if(![10,20,50,100].includes(size))throw fail(400,'Ungültige Seitengröße.');
    const total=Number((await one(`SELECT COUNT(*) AS total FROM ${from} WHERE ${where}`,args)).total);
    const number=Math.min(readNumber(params,key+'-page',1),Math.max(1,Math.ceil(total/size)));
    const items=await all(`SELECT ${columns} FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,[...args,size,(number-1)*size]);
    return {page:number,size,total,items};
  }
  async function events(rows,detail=false,matches=[]) {
    if(!rows.length)return [];
    const ids=rows.map(e=>e.id),marks=ids.map(()=>'?').join(',');
    const plans=await all(`SELECT * FROM event_planning WHERE event_id IN (${marks})`,ids);
    const counts=await all(`SELECT event_id,COUNT(*) AS total,SUM(CASE WHEN status<>'finished' THEN 1 ELSE 0 END) AS pending FROM matches WHERE event_id IN (${marks}) GROUP BY event_id`,ids);
    return rows.map(e=>{
      const p=plans.find(p=>p.event_id===e.id),meta=JSON.parse(p?.metadata||'{}'),count=counts.find(c=>c.event_id===e.id);
      const tournament=detail?meta.tournament:null;
      if(tournament)tournament.tables=tournament.mode==='swiss'?[swissStandings(tournament,matches)]:tournament.groups.map(g=>standings(tournament,g,matches));
      return {...e,match_count:Number(count?.total||0),pending_count:Number(count?.pending||0),phase:e.status==='closed'?'closed':p&&!p.started?'planned':'started',schedule:meta.source||null,tournament:tournament||null,tournamentPreview:detail?meta.tournamentPreview||null:null};
    });
  }
  async function live() {
    return {matches:(await all("SELECT m.*,e.name AS event_name FROM matches m JOIN events e ON e.id=m.event_id WHERE m.status='live' ORDER BY m.id DESC")).map(publicMatch),events:await all("SELECT * FROM events e WHERE EXISTS(SELECT 1 FROM matches m WHERE m.event_id=e.id AND m.status='live')"),rentals:await rentals.enrich(await all("SELECT * FROM rentals WHERE status='active' ORDER BY id DESC")),table_settings:await tables.get(),rental_settings:await one('SELECT * FROM rental_settings WHERE id=1'),server_now:Date.now()};
  }
  async function view(params) {
    const name=params.get('view');
    if(!['uebersicht','planung','spieltage','ergebnisse','spieler','mannschaften','vermietung','einstellungen'].includes(name))throw fail(400,'Unbekannte Ansicht.');
    const result={matches:[],events:[],players:[],teams:[],team_players:[],event_players:[],event_teams:[],event_match_slots:[],pages:{}};
    const addPage=async(key,...args)=>result.pages[key]=await page(params,key,...args);
    if(name==='einstellungen'){result.nuliga=await nuliga.state();result.nuliga_schedule=await schedule.state();}
    if(['spieler','mannschaften','planung','spieltage'].includes(name)) {
      const eventId=params.get('event');
      if(eventId!==null&&!/^\d{1,9}$/.test(eventId))throw fail(400,'Ungültige Veranstaltung.');
      if(name==='spieler'||name==='mannschaften')Object.assign(result,await players.state([]));
    }
    if(name==='vermietung') {
      const p=await addPage('rentals','rentals');p.items=await rentals.enrich(p.items);result.rentals=p.items;
    }
    if(name==='planung'||name==='spieltage') {
      const id=Number(params.get('event'))||0;
      if(id) {
        const event=await one('SELECT * FROM events WHERE id=?',[id]);if(!event)throw fail(404,'Veranstaltung nicht gefunden.');
        const matches=await all('SELECT * FROM matches WHERE event_id=? ORDER BY id',[id]);
        result.matches=matches.map(publicMatch);result.events=await events([event],true,matches);
        result.event_match_slots=await all('SELECT * FROM event_match_slots WHERE event_id=? ORDER BY slot',[id]);
        // Only editable destinations are needed by the correction dialog.
        const destinations=await all("SELECT * FROM events WHERE status='open' AND id<>? ORDER BY date DESC,id DESC",[id]);
        result.events.push(...await events(destinations));
      } else {
        const legacy=name==='planung',status=params.get('status')||(legacy?'planned':'active');
        if(!['active','running','planned','closed','all'].includes(status))throw fail(400,'Ungültiger Veranstaltungsfilter.');
        const conditions={active:"e.status='open'",running:"e.status='open' AND (p.started=1 OR p.event_id IS NULL)",planned:"e.status='open' AND p.started=0",closed:"e.status='closed'",all:'1=1'};
        const order="CASE WHEN e.status='closed' THEN 2 WHEN p.started=0 THEN 1 ELSE 0 END,e.date,e.id";
        const p=await addPage(legacy?'planned-events':'events','events e LEFT JOIN event_planning p ON p.event_id=e.id',conditions[status],[],order,'e.*');
        p.items=await events(p.items);result.events=p.items;
      }
    }
    if(name==='ergebnisse') {
      const p=await addPage('matches-ergebnisse','matches',"status='finished'");p.items=p.items.map(publicMatch);result.matches=p.items;
    }
    if(name==='spieler'||name==='mannschaften') {
      const kind=params.get('kind')||'players',id=params.get('id')||'';
      if(!['players','teams'].includes(kind)||id.length>100)throw fail(400,'Ungültiger Statistikfilter.');
      const filters=[],args=[];
      for(const [key,op] of [['from','>='],['to','<=']])if(params.get(key)){
        const date=params.get(key);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw fail(400,'Ungültiges Datum.');filters.push(`e.date${op}?`);args.push(date);
      }
      if(params.get('discipline')){if(!['8-Ball','9-Ball','10-Ball','14/1'].includes(params.get('discipline')))throw fail(400,'Ungültige Disziplin.');filters.push('m.discipline=?');args.push(params.get('discipline'));}
      const belongs=side=>kind==='teams'?`m.team_${side}_id=?`:`(m.player_${side}_id=? OR s.player_${side}2_id=?)`;
      const sideArgs=()=>kind==='teams'?[id]:[id,id];
      const from='matches m JOIN events e ON e.id=m.event_id LEFT JOIN event_match_slots s ON s.match_id=m.id';
      const where=[id?`(${belongs('a')} OR ${belongs('b')})`:'1=0',...filters].join(' AND ');
      const allArgs=id?[...sideArgs(),...sideArgs(),...args]:args;
      const p=await addPage('player-matches',from,where,allArgs,'m.id DESC','m.*');p.items=p.items.map(publicMatch);result.matches=p.items;
      // One row per associated side; doubles and teams use the same historical identities.
      const parts=[];const aggregateArgs=[];
      for(const side of ['a','b']){
        const other=side==='a'?'b':'a';
        parts.push(`SELECT m.${side} AS own,m.${other} AS opponent,CASE WHEN m.discipline='14/1' THEN CAST(m.${side}/10 AS INTEGER) ELSE m.${side} END AS won,CASE WHEN m.discipline='14/1' THEN CAST(m.${other}/10 AS INTEGER) ELSE m.${other} END AS lost FROM ${from} WHERE ${id?belongs(side):'1=0'} AND m.status='finished'${filters.length?' AND '+filters.join(' AND '):''}`);
        aggregateArgs.push(...(id?sideArgs():[]),...args);
      }
      result.statistics=await one(`SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN own>opponent THEN 1 ELSE 0 END),0) AS wins,COALESCE(SUM(CASE WHEN own<opponent THEN 1 ELSE 0 END),0) AS losses,CAST(COALESCE(SUM(won),0) AS BIGINT) AS won,CAST(COALESCE(SUM(lost),0) AS BIGINT) AS lost FROM (${parts.join(' UNION ALL ')}) sides`,aggregateArgs);
    }
    if(name==='planung'||name==='spieltage')Object.assign(result,await players.state(result.events.filter(e=>e.id===Number(params.get('event'))||e.status==='open').map(e=>e.id)));
    const missing=[...new Set(result.matches.map(m=>m.event_id))].filter(id=>!result.events.some(e=>e.id===id));
    if(missing.length)result.events.push(...await events(await all(`SELECT * FROM events WHERE id IN (${missing.map(()=>'?').join(',')})`,missing)));
    return result;
  }
  return {live,view};
}

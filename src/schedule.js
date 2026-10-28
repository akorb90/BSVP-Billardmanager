import {nuLigaHtml as h} from './nuliga.js';

export const berlinDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
const isBsvHome=name=>/^BSV Pfaffenhofen(?:\s+[IVX]+)?$/.test(name||'');

export async function collectNuLigaSchedule({today=berlinDate(),fetchPage=async url=>{
  const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!r.ok)throw Error('nuLiga HTTP '+r.status);
  const html=await r.text();if(html.length>4_000_000)throw Error('Spielplan zu groß.');return html;
}}={}) {
  const read=async url=>{url=new URL(url,h.base);if(url.origin!==new URL(h.base).origin||!url.pathname.startsWith(new URL(h.base).pathname))throw Error('Unerwarteter nuLiga-Link.');return h.content(await fetchPage(url.href));};
  const groups=h.unique(h.links(await read('clubTeams?club=402')).filter(l=>h.action(l,'groupPage')),l=>l.url.searchParams.get('group'));
  if(!groups.length)throw Error('Keine aktuellen BSV-Ligen gefunden.');
  const events=[];
  for(const group of groups) {
    const u=new URL(group.url);u.searchParams.set('displayTyp','vorrunde');u.searchParams.set('displayDetail','meetings');
    const html=await read(u);
    // Team IDs come from the league table; the complete schedule page may omit that table.
    const table=await read(group.url);
    const teamLinks=h.links(table).filter(l=>h.action(l,'teamPortrait'));
    const teamId=name=>teamLinks.find(t=>t.name===name)?.url.searchParams.get('teamtable');
    let found=false,rows=0;
    for(const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      const headings=[...match[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>h.plain(m[1]));
      if(!headings.includes('Heimmannschaft')||!headings.includes('Gastmannschaft'))continue;
      found=true;let date='',time='';
      for(const row of match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const c=h.cells(row[1]).map(h.plain);if(!c.length)continue;
        const at=label=>c[headings.indexOf(label)]||'';
        const raw=at('Datum');
        if(raw) {const m=raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(!m)throw Error('Spieldatum nicht lesbar.');date=`${m[3]}-${m[2]}-${m[1]}`;}
        if(at('Zeit'))time=at('Zeit');
        const home=at('Heimmannschaft'),away=at('Gastmannschaft'),number=at('Nr.');
        if(!home||!away||!number||!date)throw Error('Unvollständige Spielplanzeile: '+group.name);
        rows++;
        if(!isBsvHome(home))continue;
        if(date<today)continue;
        // Results and cancelled fixtures are not upcoming matches.
        if(at('Partien')||/zurückgezogen|abgesagt|spielfrei/i.test(home+' '+away+' '+time))continue;
        if(!teamId(home)||!teamId(away))throw Error('Mannschaft fehlt in Ligatabelle.');
        events.push({source_id:group.url.searchParams.get('championship')+':'+group.url.searchParams.get('group')+':'+number,date,time,home,away,home_source_id:teamId(home),away_source_id:teamId(away),league:group.name,number,url:u.href,name:(home+' – '+away).slice(0,100)});
      }
    }
    if(!found||!rows)throw Error('Vollständiger Spielplan fehlt: '+group.name);
  }
  return h.unique(events,e=>e.source_id);
}

export function scheduleService({db,transaction,fail,log,nextId,collect=collectNuLigaSchedule}) {
  let running=false;
  return {
    async state(){const r=await db.prepare('SELECT * FROM nuliga_schedule_sync WHERE id=1').get();return r?{synced_at:r.synced_at,...JSON.parse(r.summary)}:null;},
    async sync(){
      if(running)throw fail(409,'Spieltags-Synchronisierung läuft bereits.');running=true;
      try {
        let records;try{records=(await collect()).filter(item=>isBsvHome(item.home));}catch(e){throw fail(502,'Spieltags-Import abgebrochen: '+e.message);}
        return await transaction(async()=>{
          const summary={found:records.length,created:0,updated:0,preserved:0,removed:0};
          const currentIds=new Set(records.map(r=>r.source_id));
          for(const plan of await db.prepare('SELECT * FROM event_planning WHERE source_id IS NOT NULL').all()) {
            const source=JSON.parse(plan.metadata).source;
            if(!source?.home||isBsvHome(source.home)||currentIds.has(plan.source_id))continue;
            // Remove obsolete away fixtures, including opened days without any actual games.
            // Historical results remain protected on subsequent synchronizations.
            if(await db.prepare('SELECT 1 FROM matches WHERE event_id=?').get(plan.event_id)){summary.preserved++;continue;}
            await log('admin','nuliga:remove-away',null,{planning:plan,event:await db.prepare('SELECT * FROM events WHERE id=?').get(plan.event_id),slots:await db.prepare('SELECT * FROM event_match_slots WHERE event_id=?').all(plan.event_id)});
            for(const table of ['event_match_slots','event_players','event_teams','event_planning'])await db.prepare(`DELETE FROM ${table} WHERE event_id=?`).run(plan.event_id);
            await db.prepare('DELETE FROM events WHERE id=?').run(plan.event_id);
            summary.removed++;
          }
          for(const item of records) {
            const plan=await db.prepare('SELECT * FROM event_planning WHERE source_id=?').get(item.source_id);
            const event=plan?await db.prepare('SELECT * FROM events WHERE id=?').get(plan.event_id):null;
            if(plan&&!event)throw fail(409,'Ungültige Spieltagszuordnung.');
            if(plan&&(plan.started||event.status==='closed')){summary.preserved++;continue;}
            const teamIds=[];
            for(const source of [item.home_source_id,item.away_source_id]) {
              const link=await db.prepare("SELECT local_id FROM nuliga_entities WHERE kind='team' AND source_id=?").get(source);
              if(!link)throw fail(409,'Zuerst Spieler und Mannschaften synchronisieren.');teamIds.push(link.local_id);
            }
            const id=event?.id||await nextId('events');
            const previous=plan?JSON.parse(plan.metadata):{};
            const name=event&&event.name!==previous.last?.name?event.name:item.name;
            const date=event&&event.date!==previous.last?.date?event.date:item.date;
            if(!event) {
              await db.prepare("INSERT INTO events(id,name,kind,date) VALUES(?,?,'Liga',?)").run(id,name,date);
              await db.prepare('INSERT INTO event_planning VALUES(?,0,?,?)').run(id,item.source_id,JSON.stringify({source:item,last:{name:item.name,date:item.date}}));
              summary.created++;
            } else {
              await db.prepare('UPDATE events SET name=?,date=?,version=version+1 WHERE id=?').run(name,date,id);
              await db.prepare('UPDATE event_planning SET metadata=? WHERE event_id=?').run(JSON.stringify({source:item,last:{name:item.name,date:item.date}}),id);
              summary.updated++;
            }
            // Only unstarted days reach here. Refresh their proposed roster as well.
            await db.prepare('DELETE FROM event_players WHERE event_id=?').run(id);
            await db.prepare('DELETE FROM event_teams WHERE event_id=?').run(id);
            for(const team of teamIds) {
              await db.prepare('INSERT INTO event_teams VALUES(?,?)').run(id,team);
              for(const member of await db.prepare('SELECT p.id FROM players p JOIN team_players tp ON tp.player_id=p.id WHERE tp.team_id=? AND p.active=1').all(team)) {
                if(!await db.prepare('SELECT 1 FROM event_players WHERE event_id=? AND player_id=?').get(id,member.id))await db.prepare('INSERT INTO event_players VALUES(?,?,?)').run(id,member.id,team);
              }
            }
          }
          const synced_at=new Date().toISOString();await db.prepare('DELETE FROM nuliga_schedule_sync WHERE id=1').run();await db.prepare('INSERT INTO nuliga_schedule_sync VALUES(1,?,?)').run(synced_at,JSON.stringify(summary));
          await log('admin','nuliga:schedule',null,summary);return {synced_at,...summary};
        });
      }finally{running=false;}
    }
  };
}

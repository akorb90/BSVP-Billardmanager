import { randomUUID } from 'node:crypto';

const base = 'https://bbv-billard.liga.nu/cgi-bin/WebObjects/nuLigaBILLARDDE.woa/wa/';
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|nbsp|lt|gt|auml|ouml|uuml|Auml|Ouml|Uuml|szlig);/gi, (m,k) => k[0]==='#' ? String.fromCodePoint(k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1))) : ({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß'}[k]??m));
const plain = s => decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const links = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(decode(m[1]),base),name:plain(m[2])}));
const action = (link,name) => link.url.pathname===new URL(base+name).pathname;
const unique = (items,key) => [...new Map(items.map(i=>[key(i),i])).values()];
const content = html => html.slice(html.indexOf('<div id="content"'));
const cells = row => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
export const nuLigaHtml={base,plain,links,action,unique,content,cells};

// Only public pages from this one host are requested, never caller-provided URLs.
export async function collectNuLiga({fetchPage=async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)throw new Error('nuLiga antwortet mit HTTP '+response.status);
  const html=await response.text();
  if(html.length>4_000_000)throw new Error('nuLiga-Seite zu groß.');
  return html;
}}={}) {
  const cache=new Map(); let requests=0;
  const read=async url=>{
    url=new URL(url,base);
    if(url.origin!==new URL(base).origin || !url.pathname.startsWith(new URL(base).pathname))throw new Error('Unerwarteter nuLiga-Link.');
    if(!cache.has(url.href)) {if(++requests>200)throw new Error('Zu viele nuLiga-Seiten.');cache.set(url.href,await fetchPage(url.href));}
    return cache.get(url.href);
  };
  const club=content(await read('clubTeams?club=402'));
  const groups=unique(links(club).filter(l=>action(l,'groupPage')),l=>l.url.searchParams.get('group'));
  if(!groups.length)throw new Error('Keine aktuellen BSV-Ligen gefunden. Es wurden keine Daten geändert.');
  const teams=[],players=new Map(),leagues=[];
  for(const group of groups) {
    const championship=group.url.searchParams.get('championship');
    leagues.push({name:group.name,championship,url:group.url.href});
    const entries=unique(links(content(await read(group.url))).filter(l=>action(l,'teamPortrait')),l=>l.url.searchParams.get('teamtable'));
    if(!entries.length)throw new Error('Mannschaftsliste fehlt: '+group.name);
    let home=false;
    for(const entry of entries) {
      const portrait=content(await read(entry.url));
      const clubLink=links(portrait).find(l=>action(l,'clubInfoDisplay'));
      const clubId=clubLink?.url.searchParams.get('club');
      const heading=plain(portrait.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
      const number=heading.match(/(?:^|\s)(\d+)\.\s*Liga-/)?.[1];
      if(!clubId || !number)throw new Error('Mannschaftszuordnung nicht lesbar: '+entry.name);
      if(clubId==='402')home=true;
      const poolIndex=content(await read('clubPools?club='+clubId));
      const season=championship.replace(/^BBV /,'').replace(/(\d{2})\/(\d{2})$/,'20$1/$2');
      const sections=[...poolIndex.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
      let matching=false,pool;
      for(const section of sections) {
        if(/<h2\b/i.test(section[1]))matching=plain(section[1]).includes(season);
        if(matching)pool ||= links(section[1]).find(l=>action(l,'clubPools')&&l.url.searchParams.has('pool'));
      }
      if(!pool)throw new Error('Aktuelle Namensmeldung fehlt: '+entry.name+' · '+season);
      const roster=content(await read(pool.url)),members=[];
      for(const row of roster.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const c=cells(row[1]);const person=links(row[1]).find(l=>action(l,'playerPortrait'));
        if(!person)continue;
        const rank=plain(c[0]||'').match(/^(\d+)\.\d+$/);
        if(!rank)throw new Error('Meldereihenfolge nicht lesbar: '+entry.name);
        if(rank[1]!==number)continue;
        const id=person.url.searchParams.get('person'),split=person.name.indexOf(',');
        if(!id||split<1)throw new Error('Spielername nicht lesbar.');
        const p={source_id:id,first_name:person.name.slice(split+1).trim(),second_name:'',last_name:person.name.slice(0,split).trim()};
        if(!p.first_name||p.first_name.length>100||p.last_name.length>100)throw new Error('Ungültiger Spielername.');
        players.set(id,p);members.push(id);
      }
      if(!members.length)throw new Error('Keine gemeldeten Spieler gefunden: '+entry.name);
      teams.push({source_id:entry.url.searchParams.get('teamtable'),name:entry.name,player_ids:members,league:group.name,championship,club_id:clubId});
    }
    if(!home)throw new Error('BSV fehlt in der Liga: '+group.name);
  }
  return {teams:unique(teams,t=>t.source_id),players:[...players.values()],leagues};
}

export function nuLigaService({db,transaction,log,fail,collect=collectNuLiga}) {
  let running=false;
  return {
    async state(){const row=await db.prepare('SELECT * FROM nuliga_sync WHERE id=1').get();return row?{synced_at:row.synced_at,...JSON.parse(row.summary)}:null;},
    async sync({overwrite=false}={}) {
      if(typeof overwrite!=='boolean')throw fail(400,'Ungültiger Sync-Modus.');
      if(running)throw fail(409,'Eine Synchronisierung läuft bereits.');
      running=true;
      try {
        let data;try{data=await collect();}catch(e){throw fail(502,'nuLiga-Import abgebrochen: '+e.message);}
        return await transaction(async()=>{
          const summary={players:data.players.length,teams:data.teams.length,leagues:data.leagues,created:0,updated:0,preserved:0,overwrite};
          const ids=new Map();
          for(const kind of ['player','team'])for(const item of data[kind==='player'?'players':'teams']) {
            const link=await db.prepare('SELECT * FROM nuliga_entities WHERE kind=? AND source_id=?').get(kind,item.source_id);
            const table=kind==='player'?'players':'teams',id=link?.local_id||randomUUID();
            const old=link?await db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id):null;
            if(link&&!old)throw fail(409,'Importzuordnung beschädigt.');
            const next=kind==='player'?{first_name:item.first_name,second_name:item.second_name,last_name:item.last_name,active:1}:{name:item.name,active:1,player_ids:item.player_ids.map(pid=>ids.get(pid)).sort()};
            const current=old?(kind==='player'?{first_name:old.first_name,second_name:old.second_name,last_name:old.last_name,active:old.active}:{name:old.name,active:old.active,player_ids:(await db.prepare('SELECT player_id FROM team_players WHERE team_id=?').all(id)).map(p=>p.player_id).sort()}):null;
            const previous=link?JSON.parse(link.snapshot):null;
            const saved={...next};
            if(current&&!overwrite)for(const key of Object.keys(next))if(JSON.stringify(current[key])!==JSON.stringify(previous[key])){saved[key]=current[key];summary.preserved++;}
            if(!old){
              if(kind==='player')await db.prepare('INSERT INTO players VALUES(?,?,?,?,?,0)').run(id,saved.first_name,saved.second_name,saved.last_name,saved.active);
              else await db.prepare('INSERT INTO teams VALUES(?,?,?,0)').run(id,saved.name,saved.active);
              summary.created++;
            } else if(JSON.stringify(current)!==JSON.stringify(saved)) {
              if(kind==='player')await db.prepare('UPDATE players SET first_name=?,second_name=?,last_name=?,active=?,version=version+1 WHERE id=?').run(saved.first_name,saved.second_name,saved.last_name,saved.active,id);
              else await db.prepare('UPDATE teams SET name=?,active=?,version=version+1 WHERE id=?').run(saved.name,saved.active,id);
              summary.updated++;
            }
            if(kind==='team') {
              await db.prepare('DELETE FROM team_players WHERE team_id=?').run(id);
              for(const pid of saved.player_ids)await db.prepare('INSERT INTO team_players VALUES(?,?)').run(id,pid);
            } else ids.set(item.source_id,id);
            if(link)await db.prepare('UPDATE nuliga_entities SET snapshot=? WHERE kind=? AND source_id=?').run(JSON.stringify(next),kind,item.source_id);
            else await db.prepare('INSERT INTO nuliga_entities VALUES(?,?,?,?)').run(kind,item.source_id,id,JSON.stringify(next));
          }
          const synced_at=new Date().toISOString();
          await db.prepare('DELETE FROM nuliga_sync WHERE id=1').run();
          await db.prepare('INSERT INTO nuliga_sync VALUES(1,?,?)').run(synced_at,JSON.stringify(summary));
          await log('admin','nuliga:sync',null,summary);
          return {synced_at,...summary};
        });
      } finally {running=false;}
    }
  };
}

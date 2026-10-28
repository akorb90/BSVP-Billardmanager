import { rentalPrice, hourlyRate } from '../public/rental-pricing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

// Run the actual frontend with a small DOM/API fixture; no production data is used.
async function frontend(path, { admin = true, match = null, tablet = false, events = [], matches = [], rentals = [], players=[],teams=[],team_players=[],event_players=[],event_teams=[], table_settings = {table_count:8,version:0}, rental_settings = {base_cents:900,version:0} } = {}) {
  const posts=[];
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, innerHTML: '', listeners: {}, handlers: {}, attributes: {},
      addEventListener(type, callback) { this.listeners[type] = callback; (this.handlers[type]??=[]).push(callback); },
      dispatch(type,event) { return Promise.all((this.handlers[type]||[]).map(fn=>fn(event))); },
      showModal() { this.open=true; }, close() { this.open=false; this.listeners.close?.(); }, focus() {},
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      querySelectorAll() { return []; }, querySelector() { return null; }, contains() { return false; },
    });
    return elements.get(id);
  };
  const links = [...html.matchAll(/href="(\/#(?:uebersicht|spieltage|ergebnisse|vermietung|einstellungen))"/g)].map(([_, href]) => {
    const link = element(href); link.href = href; link.hash = new URL(href, 'https://localhost').hash; return link;
  });
  element('#admin-nav').querySelectorAll = () => links;
  const location = new URL(path, 'https://localhost');
  const window = element('window');
  const context = vm.createContext({
    rentalPrice, hourlyRate,
    document: { querySelector: element, querySelectorAll: () => [], createElement(){const dialog=element('#registry-dialog');dialog.querySelector=element;return dialog;}, body: { append(){}, classList: { add() {} } } },
    window, location, history: { replaceState(_, __, path) { location.href = new URL(path, location).href; } },
    sessionStorage: { getItem: () => tablet ? 'tablet-token' : null, removeItem() {}, setItem() {} },
    FormData: class { constructor(form) { this.entries=form?.entries || [['password', 'test']]; } [Symbol.iterator](){return this.entries[Symbol.iterator]();} getAll(name){return this.entries.filter(e=>e[0]===name).map(e=>e[1]);} },
    AbortSignal, setInterval() {},
    fetch: async (path,options) => {
      if(options?.body)posts.push({path,data:JSON.parse(options.body)});
      let status = 200, body;
      if (path === '/api/branding') { body={club_name:'BSV Pfaffenhofen',primary:'#147eb7',background:'#080c12',surface:'#121e2b',text:'#f1f6fc',version:0}; }
      else if (path === '/api/login') { admin = true; body = { csrf: 'csrf' }; }
      else if (path === '/api/backups/preview') { body = {created_at:'2026-10-28T12:00:00Z',events:2,matches:3,rentals:4,active:1}; }
      else if (path === '/api/backups/restore') { admin=false; body={ok:true}; }
      else if (/^\/api\/events\/\d+\/start$/.test(path)) {const event=events.find(e=>e.id===Number(path.split('/')[3]));event.phase='started';event.version++;body={ok:true};}
      else if (/^\/api\/events\/\d+\/participants$/.test(path)) {const event=events.find(e=>e.id===Number(path.split('/')[3]));event.phase='started';event.version++;body={ok:true};}
      else if (path === '/api/admin') { status = admin ? 200 : 401; body = admin ? { csrf: 'csrf', events, matches, rentals, players,teams,team_players,event_players,event_teams, rental_settings, table_settings } : { error: 'Bitte anmelden.' }; }
      else { status = admin || tablet || !match ? 200 : 401; body = { match }; }
      return { ok: status === 200, status, json: async () => body };
    },
  });
  const app = await vm.runInContext(`(async () => { ${source}\n return { refresh }; })()`, context);
  return { ...app, element, links, location, window, posts, setAdmin(value) { admin = value; } };
}

async function pageClick(app, key, step) {
  const button = { id: key + (step === 1 ? '-next' : '-previous'), dataset: { pageList: key, pageStep: String(step) } };
  await app.element('#app').dispatch('click', { target: { closest: selector => selector === 'button[data-page-list]' ? button : null } });
}
async function pageSize(app, key, size) {
  await app.element('#app').dispatch('change', { target: { id: key + '-size', dataset: { pageSize: key }, value: String(size) } });
}
function listFixtures(count = 105) {
  return {
    events: Array.from({ length: count }, (_, i) => ({ id: i + 1, name: 'Spieltag ' + (i + 1), status: 'closed' })),
    matches: Array.from({ length: count }, (_, i) => ({ id: i + 1, event_id: i + 1, status: 'finished', player_a: 'Anna ' + (i + 1), player_b: 'Ben', a: 5, b: 2, target: 5 })),
    rentals: Array.from({ length: count }, (_, i) => ({ id: i + 1, table_no: 1, status: 'finished', started_at: 1000, ended_at: 61000, duration_ms: 60000, billed_minutes: 1, hourly_cents: 900, base_cents: 900, total_cents: 15, adjustment_percent: 0 }))
  };
}
test('FR-004: alle Listen begrenzen Einträge, blättern und erlauben jede Seitengröße', async () => {
  for (const [view, key, row] of [
    ['ergebnisse', 'matches-ergebnisse', /class="match-row"/g],
    ['spieltage', 'matches-spieltage', /class="match-row"/g],
    ['spieltage', 'events', /class="event-card"/g],
    ['vermietung', 'rentals', /<tr><td>/g],
  ]) {
    const fixtures = listFixtures();
    const app = await frontend('/#' + view, fixtures);
    const markup = () => app.element('#app').innerHTML;
    const count = () => [...markup().matchAll(row)].length;
    assert.equal(count(), 20);
    assert.match(markup(), /1–20 von 105 · Seite 1 von 6/);
    assert.match(markup(), new RegExp(`id="${key}-previous"[^>]*disabled`));
    await pageClick(app, key, 1);
    assert.match(markup(), /21–40 von 105 · Seite 2 von 6/);
    await app.refresh(true);
    assert.match(markup(), /21–40 von 105 · Seite 2 von 6/);
    await pageClick(app, key, -1);
    assert.match(markup(), /1–20 von 105 · Seite 1 von 6/);
    for (const size of [10, 20, 50, 100]) {
      await pageSize(app, key, size);
      assert.equal(count(), size);
      assert.match(markup(), new RegExp(`id="${key}-size"[^]*?<option value="${size}" selected`));
    }
    await pageClick(app, key, 1);
    assert.equal(count(), 5);
    assert.match(markup(), /101–105 von 105 · Seite 2 von 2/);
    assert.match(markup(), new RegExp(`id="${key}-next"[^>]*disabled`));
    await pageSize(app, key, 7);
    assert.equal(count(), 5);
    // Deletion during polling clamps an obsolete last page; empty lists stay usable.
    fixtures.events.splice(0); fixtures.matches.splice(0); fixtures.rentals.splice(0);
    await app.refresh(true);
    assert.equal(count(), 0);
    assert.match(markup(), /0–0 von 0 · Seite 1 von 1/);
    assert.equal(app.posts.length, 0);
  }
});
test('FR-004: Veranstaltungen und Begegnungen behalten unabhängige Seiten beim Ansichtswechsel', async () => {
  const fixtures = listFixtures(25);
  fixtures.matches.unshift({ ...fixtures.matches[0], id: 1000, status: 'live' });
  const app = await frontend('/#spieltage', fixtures);
  await pageClick(app, 'events', 1);
  assert.match(app.element('#app').innerHTML, /21–25 von 25 · Seite 2 von 2/);
  assert.match(app.element('#app').innerHTML, /1–20 von 26 · Seite 1 von 2/);
  app.location.hash = '#ergebnisse'; await app.window.dispatch('hashchange');
  assert.equal([...app.element('#app').innerHTML.matchAll(/class="match-row"/g)].length, 20);
  assert.match(app.element('#app').innerHTML, /1–20 von 25/);
  app.location.hash = '#spieltage'; await app.window.dispatch('hashchange');
  assert.match(app.element('#app').innerHTML, /21–25 von 25 · Seite 2 von 2/);
  app.location.hash = '#uebersicht'; await app.window.dispatch('hashchange');
  assert.equal([...app.element('#app').innerHTML.matchAll(/class="match-row"/g)].length, 1);
  assert.match(app.element('#app').innerHTML, /1–1 von 1 · Seite 1 von 1/);
});

test('Mietabschluss ohne Texteingabe; Löschung und Grundpreis mit exakter Bestätigung',async()=>{
  const rentals=[{id:1,table_no:2,status:'active',version:0,started_at:Date.now()-61000,hourly_cents:900}];
  const app=await frontend('/#vermietung',{rentals});
  const click=async dataset=>app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button[data-entity]'?null:{dataset,hasAttribute:()=>false}}});
  await click({rentalFinish:'1'});
  assert.equal(app.element('#warning-entry').hidden,true);
  assert.equal(app.element('#warning-save').disabled,false);
  assert.equal(app.element('#warning-save').textContent,'Vermietung abschließen');
  assert.match(app.element('#warning-summary').innerHTML,/Gesamtbetrag/);
  assert.equal(app.posts.length,0);
  app.element('#warning-cancel').listeners.click();assert.equal(app.posts.length,0);
  await click({rentalFinish:'1'});await app.element('#warning-save').listeners.click();
  assert.equal(app.posts.length,1);assert.equal(app.posts[0].data.action,'rental:finish');
  assert.equal(app.posts[0].data.confirmation,undefined);assert.ok(app.posts[0].data.ended_at>=rentals[0].started_at);
  await click({rentalDelete:'1'});
  assert.equal(app.element('#warning-entry').hidden,false);assert.equal(app.element('#warning-save').disabled,true);
  assert.match(app.element('#warning-summary').innerHTML,/Tisch 2/);
  const input=app.element('#warning-input');input.value='BUCHUNG LÖSCHEN';input.listeners.input();
  await app.element('#warning-save').listeners.click();assert.equal(app.posts[1].data.action,'rental:delete');
  await app.element('#app').listeners.submit({preventDefault(){},target:{id:'rental-settings',dataset:{version:'0'},entries:[['base_euros','12']],reset(){}}});
  assert.equal(app.element('#warning-phrase').textContent,'GRUNDPREIS ÄNDERN');assert.equal(input.value,'');
  assert.match(app.element('#warning-summary').innerHTML,/12,00/);
  input.value='GRUNDPREIS ÄNDERN';input.listeners.input();await app.element('#warning-save').listeners.click();
  assert.equal(app.posts[2].data.base_euros,12);assert.equal(app.posts[2].data.action,'rental:settings');
  await click({rentalFinish:'1'});rentals[0]={...rentals[0],version:1};await app.refresh(true);
  assert.equal(app.element('#warning-save').disabled,true);await app.element('#warning-save').listeners.click();assert.equal(app.posts.length,3);
});

test('Admin-Formulare zeigen Änderungen und binden Warnungen an die konkrete Aktion',async()=>{
  for(const [entity,action,phrase] of [['event','edit','EVENT ÄNDERN'],['event','delete','EVENT LÖSCHEN'],['event','close','EVENT ABSCHLIESSEN'],['match','edit','SPIEL ÄNDERN'],['match','delete','SPIEL LÖSCHEN']]) {
    const events=[{id:1,name:'Alter Spieltag',kind:'Liga',date:'2000-01-01',status:action==='close'?'open':'closed',version:7}];
    const matches=[{id:2,event_id:1,player_a:'Anna',player_b:'Ben',status:'finished',discipline:'9-Ball',a:1,b:0,target:1,table_no:1,first:'a',lag_winner:'a',version:3}];
    const app=await frontend('/#spieltage',{events,matches});
    const button={dataset:{entity,action,id:entity==='event'?'1':'2'},hasAttribute:()=>false};
    await app.element('#app').dispatch('click',{target:{closest:()=>button}});
    assert.equal(app.element('#admin-dialog').open,true);
    const values=action!=='edit'?{}:entity==='event'?{name:'Neuer Spieltag',kind:'Liga',date:'2000-01-01'}:{...matches[0],player_b:'Berta',pin:''};
    if(entity==='match')for(const key of ['id','version'])delete values[key];
    await app.element('#admin-edit-form').listeners.submit({preventDefault(){},target:{entries:Object.entries(values)}});
    assert.equal(app.posts.length,0);assert.equal(app.element('#warning-dialog').open,true);
    assert.equal(app.element('#warning-phrase').textContent,phrase);
    if(action==='edit')assert.match(app.element('#warning-summary').innerHTML,entity==='event'?/Alter Spieltag → Neuer Spieltag/:/Ben → Berta/);
    if(action==='delete'&&entity==='event')assert.match(app.element('#warning-summary').innerHTML,/Alle 1 zugehörigen Partien einschließlich ihrer Ergebnisse/);
    const input=app.element('#warning-input');input.value=phrase;input.listeners.input();
    assert.equal(app.element('#warning-save').disabled,false);
    await app.element('#warning-save').listeners.click();
    assert.equal(app.posts.length,1);assert.equal(app.posts[0].data.action,entity+':'+action);
    assert.equal(app.posts[0].data.confirmation,phrase);assert.equal(app.posts[0].data.version,entity==='event'?7:3);
    if(entity==='match')assert.equal(app.posts[0].data.event_version,7);
  }
});

function navigation(app, active = 'uebersicht') {
  assert.equal(app.element('#admin-nav').hidden, false);
  assert.equal(app.element('#logout').hidden, false);
  assert.equal(app.links.length, 5);
  assert.deepEqual(app.links.filter(link => link.attributes['aria-current'] === 'page').map(link => link.hash), ['#' + active]);
}

test('Admin-Startseiten, Ansichten und Logo führen zur richtigen Navigation', async () => {
  for (const path of ['/', '/admin', '/#uebersicht', '/#spieltage', '/#ergebnisse', '/#vermietung', '/#einstellungen']) {
    const app = await frontend(path);
    navigation(app, app.location.hash.slice(1) || 'uebersicht');
    await app.refresh(true);
    navigation(app, app.location.hash.slice(1) || 'uebersicht');
  }
  assert.match(html, /<a href="\/" class="brand">/);
});

test('Admin-Menü bleibt an freien, vorbereiteten und laufenden Tischen sichtbar', async () => {
  for (const match of [null, { id: 1, setup_done: false }, { id: 1, setup_done: true, a: 0, b: 0, target: 5 }]) {
    const app = await frontend('/tisch/1', { match });
    navigation(app);
    await app.refresh();
    navigation(app);
    for (const link of app.links) assert.equal(new URL(link.href, app.location).pathname, '/');
  }
});

test('PIN-Sitzung erhält kein Admin-Menü; Sitzungswechsel wirkt auch bei unveränderter Partie', async () => {
  const app = await frontend('/tisch/1', { admin: false, tablet: true, match: { id: 1, setup_done: false } });
  assert.equal(app.element('#admin-nav').hidden, true);
  app.setAdmin(true);
  await app.refresh(); navigation(app);
  app.setAdmin(false);
  await app.refresh();
  assert.equal(app.element('#admin-nav').hidden, true);
  assert.equal(app.element('#logout').hidden, true);
  assert.ok(app.links.every(link => !link.attributes['aria-current']));
});

test('Erfolgreiche Anmeldung setzt einen vorherigen Ergebnis-Link auf die Tischübersicht zurück', async () => {
  const app = await frontend('/admin#ergebnisse', { admin: false });
  assert.equal(app.element('#admin-nav').hidden, true);
  app.element('#app').listeners.submit({ preventDefault() {}, target: { id: 'login', classList: { contains: () => false } } });
  // The DOM event starts the async mutation and its subsequent refresh.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.location.pathname, '/');
  assert.equal(app.location.hash, '#uebersicht');
  navigation(app);
});


test('Rabattfeld und Einstellungen ersetzen Preisauswahl und Grundpreis im Vermietungsmenü',async()=>{
  const rental=await frontend('/#vermietung');
  const rentalHtml=rental.element('#app').innerHTML;
  assert.match(rentalHtml,/Rabatt in %/);assert.doesNotMatch(rentalHtml,/Preis festlegen|id="rental-settings"/);
  await rental.element('#app').listeners.submit({preventDefault(){},target:{id:'rental-start',dataset:{version:'0'},entries:[['table_no','1'],['discount','20']],reset(){}}});
  await new Promise(r=>setImmediate(r));
  assert.equal(rental.posts[0].data.discount,20);
  const settings=await frontend('/#einstellungen');
  assert.match(settings.element('#app').innerHTML,/id="rental-settings"/);
  assert.match(settings.element('#app').innerHTML,/Aktuelles Passwort/);
  assert.match(settings.element('#app').innerHTML,/Neues Passwort wiederholen/);
  await settings.element('#app').listeners.submit({preventDefault(){},target:{id:'admin-password',entries:[['new_password','a'],['repeat_password','b']]}});
  assert.equal(settings.posts.length,0);
});

test('FR-005: Dateiprüfung, Vorschau, Abbruch und ausdrückliche Wiederherstellung im Frontend',async()=>{
  const app=await frontend('/#einstellungen');
  assert.match(app.element('#app').innerHTML,/href="\/api\/backups\/export" download/);
  assert.match(app.element('#app').innerHTML,/id="backup-file"/);
  const choose=async file=>app.element('#app').dispatch('change',{target:{id:'backup-file',dataset:{},files:[file]}});
  await choose({size:51*1024*1024});assert.equal(app.posts.length,0);
  assert.match(app.element('#message').textContent,/50 MiB/);
  await choose({size:3,text:async()=>'{no'});assert.equal(app.posts.length,0);
  assert.match(app.element('#message').textContent,/gültiges JSON/);
  const file={name:'<sicherung>.json',size:200,text:async()=>JSON.stringify({format:'bsvp-billardmanager'})};
  await choose(file);assert.equal(app.posts.length,1);assert.equal(app.posts[0].path,'/api/backups/preview');
  assert.match(app.element('#warning-summary').innerHTML,/2 Spieltage, 3 Partien, 4 Vermietungen/);
  assert.match(app.element('#warning-summary').innerHTML,/&lt;sicherung&gt;/);
  assert.equal(app.element('#warning-save').disabled,true);
  app.element('#warning-cancel').listeners.click();assert.equal(app.posts.length,1);
  await choose(file);await app.element('#warning-save').listeners.click();assert.equal(app.posts.length,2);
  const input=app.element('#warning-input');input.value='DATEN WIEDERHERSTELLEN';input.listeners.input();
  await app.element('#warning-save').listeners.click();assert.equal(app.posts.length,3);
  assert.equal(app.posts[2].path,'/api/backups/restore');assert.equal(app.posts[2].data.confirmation,'DATEN WIEDERHERSTELLEN');
  assert.equal(app.element('#admin-nav').hidden,true);
  assert.match(app.element('#message').textContent,/Admin-Passwort aus der Sicherung/);
});


test('Farbcodes stehen unter den Farbwählern und synchronisieren in beide Richtungen',async()=>{
  const app=await frontend('/#einstellungen');
  const markup=app.element('#app').innerHTML;
  for(const key of ['primary','background','surface','text']) {
    assert.ok(markup.indexOf('name="'+key+'_picker"')<markup.indexOf('name="'+key+'"'));
    assert.ok(markup.includes('data-branding-hex="'+key+'"'));
    const fields=new Map([[key,{value:'#147eb7'}],[key+'_picker',{value:'#147eb7'}]]);
    const form={elements:{namedItem:name=>fields.get(name)}};
    const input=(dataset,value)=>app.element('#app').dispatch('input',{target:{dataset,value,closest:()=>form}});
    await input({brandingHex:key},'#Ab12Cd');assert.equal(fields.get(key+'_picker').value,'#ab12cd');
    await input({brandingHex:key},'#12');assert.equal(fields.get(key+'_picker').value,'#ab12cd');
    await input({brandingColor:key},'#987654');assert.equal(fields.get(key).value,'#987654');
  }
});


test('FR-011: Tischanzahl steuert Übersicht, Auswahl, Vermietung, Einstellungen und zweistellige Tablet-Adressen', async()=>{
  for(const count of [1,20]) {
    const options={table_settings:{table_count:count,version:4},events:[{id:1,status:'open'}],matches:[{id:1,event_id:1,status:'planned',player_a:'A',player_b:'B',target:5,a:0,b:0}]};
    const overview=await frontend('/#uebersicht',options), html=overview.element('#app').innerHTML;
    assert.equal((html.match(/class="table-card/g)||[]).length,count);
    assert.match(html,new RegExp('0 / '+count+' Tische belegt'));
    const planning=await frontend('/#spieltage',options);
    assert.match(planning.element('#app').innerHTML,new RegExp('option value="'+count+'">Tisch '+count));
    assert.doesNotMatch(planning.element('#app').innerHTML,new RegExp('option value="'+(count+1)+'">Tisch '+(count+1)));
    const rental=await frontend('/#vermietung',options), rentalHtml=rental.element('#app').innerHTML;
    assert.equal((rentalHtml.match(/class="table-card/g)||[]).length,count);
    assert.match(rentalHtml,new RegExp(count+' / '+count+' Tische frei'));
    const settings=await frontend('/#einstellungen',options);
    assert.match(settings.element('#app').innerHTML,/id="table-settings" data-version="4"/);
    assert.match(settings.element('#app').innerHTML,/min="1" max="20" step="1" required/);
    await settings.element('#app').listeners.submit({preventDefault(){},target:{id:'table-settings',dataset:{version:'4'},entries:[['table_count','20'],['version','4']],remove(){}}});
    assert.equal(settings.posts[0].path,'/api/settings/tables');assert.equal(settings.posts[0].data.table_count,20);assert.equal(settings.posts[0].data.version,4);
  }
  const tablet=await frontend('/tisch/20',{admin:false,tablet:true});
  assert.match(tablet.element('#app').innerHTML,/TISCH 20/);
});

test('Spieltagsplanung starts a day explicitly and opens only that day for match creation',async()=>{
  const events=[{id:1,name:'Kommender Spieltag',kind:'Liga',date:'2026-11-07',status:'open',phase:'planned',version:0},{id:2,name:'Anderer Spieltag',kind:'Liga',date:'2026-11-08',status:'open',phase:'started',version:0}];
  events[0].schedule={home:'BSV Pfaffenhofen',home_source_id:'11'};
  const app=await frontend('/#planung',{events,players:[{id:'p1',first_name:'Anna',last_name:'BSV',active:1}],teams:[{id:'away',name:'Gegner'},{id:'home',name:'BSV Pfaffenhofen',nuliga_profile:'https://bbv-billard.liga.nu/teamPortrait?teamtable=11'}],event_teams:[{event_id:1,team_id:'away'},{event_id:1,team_id:'home'}]});
  assert.match(app.element('#app').innerHTML,/Spieltag anlegen|Spieltage synchronisieren/);
  assert.match(app.element('#app').innerHTML,/data-event-start="1"/);
  assert.doesNotMatch(app.element('#app').innerHTML,/id="match"|Tisch zuweisen/);
  const button={dataset:{eventStart:'1'},hasAttribute:()=>false};
  await app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button'?button:null}});
  assert.equal(app.posts.length,0,'Opening the roster does not start the day');
  const dialog=app.element('#registry-dialog');
  assert.match(dialog.innerHTML,/Mannschaft 1 · BSV Pfaffenhofen/);
  assert.match(dialog.innerHTML,/Zusätzlicher Spieler nur für diesen Spieltag/);
  dialog.onsubmit({preventDefault(){},target:{id:'registry-participants',dataset:{start:'true'},entries:[['event_id','1'],['version','0'],['team_ids','home'],['team_ids','away']],querySelectorAll:()=>[]}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.posts[0].path,'/api/events/1/participants');
  assert.equal(app.posts[0].data.start,true);
  await app.refresh(true);
  assert.equal(app.location.hash,'#spieltage/1');
  assert.match(app.element('#app').innerHTML,/<h1>Kommender Spieltag<\/h1>/);
  assert.equal([...app.element('#app').innerHTML.matchAll(/class="panel league-partie"/g)].length,10);assert.match(app.element('#app').innerHTML,/14\/1/);assert.equal([...app.element('#app').innerHTML.matchAll(/name="player_a2_id"/g)].length,2);
  assert.match(app.element('#app').innerHTML,/data-participants="1"/);
  assert.doesNotMatch(app.element('#app').innerHTML,/Anderer Spieltag/);
  assert.ok(app.element('#app').innerHTML.indexOf('<h5>Heim · BSV Pfaffenhofen')<app.element('#app').innerHTML.indexOf('<h5>Gast · Gegner'));
  const form={id:'league-slot-1-1',elements:{}};
  await app.element('#app').dispatch('change',{target:{dataset:{},name:'player_a_id',value:'p1',closest:()=>form}});
});

test('FR-007-Fix settings keep both nuLiga forms adjacent in one ordered column',async()=>{
  const app=await frontend('/#einstellungen'),markup=app.element('#app').innerHTML;
  const ids=['club-branding','table-settings','rental-settings','nuliga-sync','nuliga-schedule-sync','admin-password','backup-file'];
  let previous=-1;
  for(const id of ids){const index=markup.indexOf('id="'+id+'"');assert.ok(index>previous,id+' follows the previous section');previous=index;}
  assert.match(markup,/class="settings-stack"/);assert.doesNotMatch(markup,/class="planning"/);
});

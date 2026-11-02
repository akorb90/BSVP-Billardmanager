import { rentalPrice, hourlyRate } from '../public/rental-pricing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

// Run the actual frontend with a small DOM/API fixture; no production data is used.
async function frontend(path, { admin = true, match = null, tablet = false, events = [], matches = [], rentals = [], players=[],teams=[],team_players=[],event_players=[],event_teams=[],event_match_slots=[], serverPages=false, responseHook, inventory={drinks:[],packages:[],movements:[]}, table_settings = {table_count:8,version:0}, rental_settings = {base_cents:900,version:0} } = {}) {
  const posts=[],gets=[];
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
  const links = [...html.matchAll(/href="(\/#(?:uebersicht|spieltage|ergebnisse|vermietung|lager|einstellungen))"/g)].map(([_, href]) => {
    const link = element(href); link.href = href; link.hash = new URL(href, 'https://localhost').hash; return link;
  });
  element('#admin-nav').querySelectorAll = () => links;
  const location = new URL(path, 'https://localhost');
  const window = element('window');
  const context = vm.createContext({
    rentalPrice, hourlyRate, crypto:{randomUUID},
    document: { querySelector:selector=>selector==='dialog[open]'?[...elements.values()].find(e=>e.open)||null:element(selector), getElementById:id=>elements.get('#'+id), querySelectorAll: () => [], createElement(){const dialog=element('#registry-dialog');dialog.querySelector=element;return dialog;}, body: { append(){}, classList: { add() {} } } },
    window, location, history: { replaceState(_, __, path) { location.href = new URL(path, location).href; } },
    sessionStorage: { getItem: () => tablet ? 'tablet-token' : null, removeItem() {}, setItem() {} },
    FormData: class { constructor(form) { this.entries=form?.entries || [['password', 'test']]; } [Symbol.iterator](){return this.entries[Symbol.iterator]();} getAll(name){return this.entries.filter(e=>e[0]===name).map(e=>e[1]);} },
    AbortSignal, URLSearchParams, setInterval() {},
    fetch: async (path,options) => {
      if(!options?.body)gets.push(path);
      if(options?.body)posts.push({path,data:JSON.parse(options.body)});
      let status = 200, body;
      if (path === '/api/branding') { body={club_name:'BSV Pfaffenhofen',primary:'#147eb7',background:'#080c12',surface:'#121e2b',text:'#f1f6fc',version:0}; }
      else if (path === '/api/inventory') {status=admin?200:401;body=admin?inventory:{error:'Bitte anmelden.'};}
      else if (path === '/api/login') { admin = true; body = { csrf: 'csrf' }; }
      else if (path === '/api/backups/preview') { body = {created_at:'2026-10-28T12:00:00Z',events:2,matches:3,rentals:4,active:1}; }
      else if (path === '/api/backups/restore') { admin=false; body={ok:true}; }
      else if (/^\/api\/events\/\d+\/start$/.test(path)) {const event=events.find(e=>e.id===Number(path.split('/')[3]));event.phase='started';event.version++;body={ok:true};}
      else if (/^\/api\/events\/\d+\/participants$/.test(path)) {const event=events.find(e=>e.id===Number(path.split('/')[3]));event.phase='started';event.version++;body={ok:true};}
      else if ((path === '/api/admin/live'||path.startsWith('/api/admin/view?'))) { status = admin ? 200 : 401; body = admin ? { csrf: 'csrf', events, matches, rentals, players,teams,team_players,event_players,event_teams,event_match_slots, rental_settings, table_settings } : { error: 'Bitte anmelden.' }; }
      else { status = admin || tablet || !match ? 200 : 401; body = { match }; }
      if(serverPages&&status===200&&path==='/api/admin/live')body={csrf:'csrf',matches:matches.filter(m=>m.status==='live'),events:[],rentals:[],rental_settings,table_settings};
      if(serverPages&&status===200&&path.startsWith('/api/admin/view?')){
        const params=new URLSearchParams(path.split('?')[1]),key='matches-ergebnisse',size=Number(params.get(key+'-size')||20),total=matches.length,page=Math.min(Number(params.get(key+'-page')||1),Math.max(1,Math.ceil(total/size))),items=matches.slice((page-1)*size,page*size);
        body={...body,matches:items,pages:{[key]:{page,size,total,items}}};
      }
      if(responseHook)await responseHook(path,body);
      return { ok: status === 200, status, json: async () => body };
    },
  });
  const app = await vm.runInContext(`(async () => { ${source}\n return { refresh, updateTournamentSelection, saveDrafts, restoreDrafts, updateMatchLimits, captureFocus, restoreFocus, quantity, drafts }; })()`, context);
  return { ...app, document:context.document, element, links, location, window, posts, gets, setAdmin(value) { admin = value; } };
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
    events: Array.from({ length: count }, (_, i) => ({ id: i + 1, name: 'Spieltag ' + (i + 1), status: 'open',phase:'started',date:'2026-11-01' })),
    matches: Array.from({ length: count }, (_, i) => ({ id: i + 1, event_id: i + 1, status: 'finished', player_a: 'Anna ' + (i + 1), player_b: 'Ben', a: 5, b: 2, target: 5 })),
    rentals: Array.from({ length: count }, (_, i) => ({ id: i + 1, table_no: 1, status: 'finished', started_at: 1000, ended_at: 61000, duration_ms: 60000, billed_minutes: 1, hourly_cents: 900, base_cents: 900, total_cents: 15, adjustment_percent: 0 }))
  };
}
test('FR-004: alle Listen begrenzen Einträge, blättern und erlauben jede Seitengröße', async () => {
  for (const [view, key, row] of [
    ['ergebnisse', 'matches-ergebnisse', /class="match-row"/g],
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
  assert.doesNotMatch(app.element('#app').innerHTML, /class="match-row"/);
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
    if(action==='delete'&&entity==='event')assert.match(app.element('#warning-summary').innerHTML,/Sämtliche zugehörigen Partien und Ergebnisse werden ebenfalls gelöscht \(1 Partie\)/);
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
  assert.equal(app.links.length, 6);
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

test('Deleting an open event returns to the overview with success and never reloads the deleted detail',async()=>{
  for(const kind of ['Turnier','Liga']) {
    const events=[{id:1,name:'Löschtest',kind,date:'2026-11-01',phase:'planned',status:'open',version:2},{id:2,name:'Bleibt erhalten',kind:'Turnier',date:'2026-11-02',phase:'planned',status:'open',version:1}];
    let deleted=false;
    const app=await frontend('/#spieltage/1',{events,responseHook:async path=>{
      if(path==='/api/events/1/delete'){deleted=true;events.splice(0,1);}
      if(deleted&&path.startsWith('/api/admin/view?')&&new URLSearchParams(path.split('?')[1]).get('event')==='1')throw Error('Veranstaltung nicht gefunden.');
    }});
    const button={dataset:{entity:'event',action:'delete',id:'1'},hasAttribute:()=>false};
    await app.element('#app').dispatch('click',{target:{closest:()=>button}});
    await app.element('#admin-edit-form').listeners.submit({preventDefault(){},target:{entries:[]}});
    assert.equal(app.location.hash,'#spieltage/1');assert.equal(app.posts.length,0);
    const input=app.element('#warning-input');input.value='EVENT LÖSCHEN';input.listeners.input();
    await app.element('#warning-save').listeners.click();
    assert.equal(app.location.hash,'#spieltage');assert.equal(app.element('#warning-dialog').open,false);
    assert.ok(app.element('#app').innerHTML.includes('<h1>Veranstaltungsübersicht</h1>'));
    assert.ok(app.element('#app').innerHTML.includes('Bleibt erhalten'));
    assert.equal(app.element('#message').textContent,(kind==='Turnier'?'Turnier':'Veranstaltung')+' „Löschtest“ wurde gelöscht.');
    assert.equal(app.element('#connection').textContent,'● Verbunden');
    await app.refresh(true);assert.equal(app.location.hash,'#spieltage');
  }
});

test('Failed event deletion retains its detail and displays the error without a success message',async()=>{
  const event={id:1,name:'Bleibt',kind:'Turnier',date:'2026-11-01',phase:'planned',status:'open',version:2};
  const app=await frontend('/#spieltage/1',{events:[event],responseHook:async path=>{if(path==='/api/events/1/delete')throw Error('Löschen fehlgeschlagen.');}});
  const button={dataset:{entity:'event',action:'delete',id:'1'},hasAttribute:()=>false};
  await app.element('#app').dispatch('click',{target:{closest:()=>button}});
  await app.element('#admin-edit-form').listeners.submit({preventDefault(){},target:{entries:[]}});
  const input=app.element('#warning-input');input.value='EVENT LÖSCHEN';input.listeners.input();await app.element('#warning-save').listeners.click();
  assert.equal(app.location.hash,'#spieltage/1');assert.equal(app.element('#warning-dialog').open,true);
  assert.ok(app.element('#warning-error').textContent.includes('Löschen fehlgeschlagen.'));
  assert.ok(!app.element('#message').textContent?.includes('wurde gelöscht'));
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
    const options={table_settings:{table_count:count,version:4},events:[{id:1,status:'open',kind:'Turnier',tournament:{mode:'ko',discipline:'9-Ball',target:5,rules:'difference',players:[],groups:[],rounds:[],resolutions:{}}}],matches:[{id:1,event_id:1,status:'planned',player_a:'A',player_b:'B',target:5,a:0,b:0}]};
    const overview=await frontend('/#uebersicht',options), html=overview.element('#app').innerHTML;
    assert.equal((html.match(/class="table-card/g)||[]).length,count);
    assert.match(html,new RegExp('0 / '+count+' Tische belegt'));
    const planning=await frontend('/#spieltage/1',options);
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
  assert.match(app.element('#app').innerHTML,/Veranstaltung anlegen/);
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

test('AP1: league drafts keep their original version across polling and reload explicitly discards them',async()=>{
  const events=[{id:1,name:'Parallel',kind:'Liga',date:'2026-11-01',status:'open',phase:'started',version:1}];
  const slots=[{event_id:1,slot:1,version:1,player_a_id:'anna',target:3,table_no:1}];
  const app=await frontend('/#spieltage/1',{events,event_match_slots:slots});
  const form=app.element('#league-slot-1-1');
  const fields={player_a_id:{value:'anna'},target:{value:'4'},table_no:{value:'1'}};
  Object.assign(form,{id:'league-slot-1-1',dataset:{event:'1',slot:'1',version:'1'},elements:{namedItem:name=>fields[name]}});
  Object.defineProperty(form,'entries',{get:()=>Object.entries(fields).map(([name,field])=>[name,field.value])});
  app.element('#app').querySelectorAll=selector=>selector==='form'?[form]:[];
  await app.element('#app').dispatch('input',{target:{name:'target',dataset:{},closest:()=>form}});
  app.saveDrafts();
  Object.assign(slots[0],{version:2,player_a_id:'ada',target:5});
  await app.refresh(true);
  assert.match(app.element('#app').innerHTML,/Diese Aufstellung wurde zwischenzeitlich geändert/);
  // Model the new controls created from the server response, then restore the local draft.
  form.dataset.version='2';fields.player_a_id.value='ada';fields.target.value='5';
  app.restoreDrafts();
  assert.equal(form.dataset.version,'1');assert.equal(fields.player_a_id.value,'anna');assert.equal(fields.target.value,'4');
  await app.element('#app').dispatch('change',{target:{name:'target',dataset:{},closest:()=>form}});
  await app.refresh(true);assert.equal(form.dataset.version,'1','repeated polling cannot rebase the draft');
  const reload={dataset:{leagueReload:form.id}};
  await app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button[data-league-reload]'?reload:null}});
  assert.doesNotMatch(app.element('#app').innerHTML,/Diese Aufstellung wurde zwischenzeitlich geändert/);
  form.dataset.version='2';fields.player_a_id.value='ada';fields.target.value='5';
  await app.element('#app').dispatch('submit',{preventDefault(){},target:form,submitter:{value:'save'}});
  assert.equal(app.posts.at(-1).data.version,2);assert.equal(app.posts.at(-1).data.player_a_id,'ada');assert.equal(app.posts.at(-1).data.target,5);
});

test('AP1: untouched league forms do not overlay newer server values with drafts',async()=>{
  const app=await frontend('/#uebersicht');
  const form=app.element('#league-slot-1-1'),fields={target:{value:'3'}};
  Object.assign(form,{id:'league-slot-1-1',dataset:{version:'1'},entries:[['target','3']],elements:{namedItem:name=>fields[name]}});
  app.element('#app').querySelectorAll=selector=>selector==='form'?[form]:[];
  app.saveDrafts();form.dataset.version='2';fields.target.value='5';app.restoreDrafts();
  assert.equal(fields.target.value,'5');assert.equal(form.dataset.version,'2');
});

test('AP1: a submit racing with a server change sends the original draft version',async()=>{
  const app=await frontend('/#uebersicht');
  const form={id:'league-slot-1-1',dataset:{event:'1',slot:'1',version:'1'},entries:[['player_a_id','anna'],['target','4'],['table_no','1']]};
  await app.element('#app').dispatch('input',{target:{name:'target',dataset:{},closest:()=>form}});
  form.dataset.version='2';
  await app.element('#app').dispatch('submit',{preventDefault(){},target:form,submitter:{value:'save'}});
  assert.equal(app.posts[0].data.version,1,'the backend can reject the stale write');
});

test('AP1: menu changes tolerate forms whose id property is shadowed by a named field',async()=>{
  const app=await frontend('/#spieler');
  const fields={id:{value:'anna'}};
  const form=app.element('#stats-filter');
  Object.assign(form,{id:fields.id,getAttribute:()=> 'stats-filter',entries:[['id','anna']],elements:{namedItem:name=>fields[name]}});
  app.element('#app').querySelectorAll=selector=>selector==='form'?[form]:[];
  app.saveDrafts();fields.id.value='ada';app.restoreDrafts();
  assert.equal(fields.id.value,'anna');
});

test('AP2: match correction limits support 14/1 scores and follow target/discipline changes',async()=>{
  const event={id:1,name:'14/1',kind:'Liga',date:'2026-11-01',status:'open',version:1};
  const match={id:1,event_id:1,player_a:'A',player_b:'B',status:'finished',discipline:'14/1',a:125,b:80,target:125,table_no:null,first:'a',version:1};
  const app=await frontend('/#ergebnisse',{events:[event],matches:[match]});
  const button={dataset:{entity:'match',action:'edit',id:'1'}};
  await app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button[data-entity]'?button:null}});
  const content=app.element('#admin-dialog-content').innerHTML;
  assert.match(content,/name="a"[^>]*value="125"[^>]*max="125"/);
  assert.match(content,/name="b"[^>]*value="80"[^>]*max="125"/);
  assert.match(content,/name="target"[^>]*max="999"/);
  const fields={discipline:{value:'14/1'},target:{value:'125'},a:{value:'125'},b:{value:'79'}};
  const form={elements:{namedItem:name=>fields[name]}};
  app.updateMatchLimits(form);assert.equal(fields.a.max,'125');assert.equal(fields.b.max,'125');
  fields.target.value='150';
  await app.element('#admin-edit-form').dispatch('input',{target:{name:'target'},currentTarget:form});
  assert.equal(fields.a.max,'150');assert.equal(fields.target.max,'999');
  fields.discipline.value='9-Ball';
  await app.element('#admin-edit-form').dispatch('change',{target:{name:'discipline'},currentTarget:form});
  assert.equal(fields.target.max,'99');assert.equal(fields.a.max,'99');
  fields.target.value='7';app.updateMatchLimits(form);assert.equal(fields.b.max,'7');
  assert.equal(fields.a.value,'125','changing limits never silently changes recorded points');
});

test('AP4: 14/1 statistics round each match before aggregation and preserve original winners and point scores',async()=>{
  const events=[{id:1,name:'Current',date:'2026-11-01',kind:'Liga',status:'open'},{id:2,name:'Earlier',date:'2026-10-31',kind:'Liga',status:'open'}];
  const players=[{id:'p',first_name:'Anna',last_name:'Test',active:1},{id:'q',first_name:'Ben',last_name:'Test',active:1}];
  const base={event_id:1,status:'finished',discipline:'14/1',player_a_id:'p',player_b_id:'q',player_a:'Anna',player_b:'Ben',a:114,b:69,target:114};
  const matches=[{...base,id:1},{...base,id:2,a:19,b:11,target:19},{...base,id:3,a:19,b:10,target:19},
    {...base,id:4,discipline:'9-Ball',a:5,b:2,target:5},{...base,id:5,status:'live',a:999,b:0,target:999},{...base,id:6,status:'planned',a:0,b:0},
    {...base,id:7,event_id:2,a:125,b:80,target:125},{...base,id:8,event_id:2,discipline:'9-Ball',a:5,b:2,target:5}];
  const before=JSON.stringify(matches);
  const app=await frontend('/#spieler',{events,players,matches});
  async function filter(discipline='',from='2026-11-01',to=from){
    // Native HTMLFormElement.id is shadowed by the select named id.
    const form={id:{value:'p'},getAttribute:()=> 'stats-filter',entries:Object.entries({kind:'players',id:'p',from,to,discipline})};
    await app.element('#app').dispatch('submit',{preventDefault(){},target:form});
    return app.element('#app').innerHTML;
  }
  let markup=await filter();
  assert.match(markup,/4 Ergebnisse · 4 Siege · 0 Niederlagen · Racks 18 : 10/);
  assert.match(markup,/<strong class="result">11 : 6 Racks<\/strong>/);
  assert.match(markup,/<p>114 : 69 Punkte<\/p>/);
  assert.match(markup,/<option value="14\/1"/);
  markup=await filter('14/1');
  assert.match(markup,/3 Ergebnisse · 3 Siege · 0 Niederlagen · Racks 13 : 8/,'19:11 and 19:10 still count as wins despite equal converted racks');
  assert.doesNotMatch(markup,/Ziel 5<\/p>/,'discipline filter removes the 9-Ball match');
  markup=await filter('9-Ball');assert.match(markup,/1 Ergebnis · 1 Sieg · 0 Niederlagen · Racks 5 : 2/);
  markup=await filter('','2026-10-31');assert.match(markup,/2 Ergebnisse · 2 Siege · 0 Niederlagen · Racks 17 : 10/,'125 points plus 5 racks equals 17 racks');
  markup=await filter('14/1','2027-01-01');assert.match(markup,/0 Ergebnisse · 0 Siege · 0 Niederlagen · Racks 0 : 0/);
  assert.equal(JSON.stringify(matches),before,'statistics never rewrite stored point scores');
  app.location.hash='#ergebnisse';await app.window.dispatch('hashchange',{});
  assert.match(app.element('#app').innerHTML,/<strong class="result">114 : 69<\/strong>/,'regular result archive retains the actual point score');
});

test('AP4: secondary doubles players, team sides and loss counts use the same rack conversion',async()=>{
  const players=[{id:'p',first_name:'Anna',last_name:'Test',active:1},{id:'r',first_name:'Ada',last_name:'Test',active:1},{id:'q',first_name:'Ben',last_name:'Test',active:1}];
  const matches=[{id:1,event_id:1,status:'finished',discipline:'14/1',player_a_id:'r',player_b_id:'q',team_a_id:'home',team_b_id:'away',player_a:'Ada / Anna',player_b:'Ben',a:19,b:11,target:19},
    {id:2,event_id:1,status:'finished',discipline:'14/1',player_a_id:'r',player_b_id:'q',team_a_id:'home',team_b_id:'away',player_a:'Ada / Anna',player_b:'Ben',a:19,b:10,target:19}];
  const app=await frontend('/#spieler',{players,matches,teams:[{id:'home',name:'Home'},{id:'away',name:'Away'}],events:[{id:1,name:'Doubles',date:'2026-11-01',kind:'Liga',status:'open'}],event_match_slots:[{match_id:1,player_a2_id:'p'},{match_id:2,player_a2_id:'p'}]});
  for(const [kind,id,summary] of [['players','p','2 Ergebnisse · 2 Siege · 0 Niederlagen · Racks 2 : 2'],['teams','home','2 Ergebnisse · 2 Siege · 0 Niederlagen · Racks 2 : 2'],['teams','away','2 Ergebnisse · 0 Siege · 2 Niederlagen · Racks 2 : 2']]){
    await app.element('#app').dispatch('submit',{preventDefault(){},target:{id:{},getAttribute:()=> 'stats-filter',entries:Object.entries({kind,id,from:'',to:'',discipline:'14/1'})}});
    assert.ok(app.element('#app').innerHTML.includes(summary),summary);
  }
  await app.element('#app').dispatch('change',{target:{name:'kind',value:'players',dataset:{},form:{id:{},getAttribute:()=> 'stats-filter'}}});
  assert.match(app.element('#app').innerHTML,/0 Ergebnisse · 0 Siege · 0 Niederlagen · Racks 0 : 0/,'switching entity kind clears the previous selection');
});

test('AP5: focus identities distinguish repeated actions and fall back when the action disappears',async()=>{
  const app=await frontend('/#spieler');const root=app.element('#app');let focused;
  function button(id,disabled=false){const attributes=[{name:'data-registry',value:'player'},{name:'data-id',value:id},{name:'disabled',value:''}];return{tagName:'BUTTON',attributes,textContent:'Bearbeiten',disabled,getAttribute:name=>attributes.find(a=>a.name===name)?.value??null,closest:()=>null,focus(){focused=id;}};}
  const original=button('p1');app.document.activeElement=original;root.contains=el=>el===original;
  const saved=app.captureFocus();
  root.querySelectorAll=()=>[button('p2'),button('p1')];app.restoreFocus(saved);assert.equal(focused,'p1');
  const heading=app.element('heading');heading.focus=()=>{focused='heading';};root.querySelector=()=>heading;
  root.querySelectorAll=()=>[button('p2'),button('p1',true)];app.restoreFocus(saved);assert.equal(focused,'heading');assert.equal(heading.attributes.tabindex,'-1');
});

test('AP5: open named registry dialogs keep their trigger DOM intact during refresh',async()=>{
  const players=[{id:'p',first_name:'Anna',last_name:'Test',active:1}];const app=await frontend('/#spieler',{players});
  const button={dataset:{registry:'player'},hasAttribute:()=>false};
  await app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button'?button:null}});
  const dialog=app.element('#registry-dialog');assert.equal(dialog.attributes['aria-labelledby'],'registry-title');assert.match(dialog.innerHTML,/<h2 id="registry-title">Spieler verwalten<\/h2>/);
  const before=app.element('#app').innerHTML;players.push({id:'q',first_name:'Ben',last_name:'New',active:1});
  await app.refresh(true);assert.equal(app.element('#app').innerHTML,before,'modal polling updates state without replacing the trigger');
  dialog.close();await app.refresh(true);assert.match(app.element('#app').innerHTML,/Ben New/);
});

test('AP5: fallback heading focus continues receiving live updates',async()=>{
  const players=[];const app=await frontend('/#spieler',{players}),root=app.element('#app');
  const heading={tagName:'H1',attributes:[],textContent:'Spieler',closest:()=>null,setAttribute(name,value){this[name]=value;},focus(){app.document.activeElement=this;}};
  app.document.activeElement=heading;root.contains=el=>el===heading;root.querySelectorAll=selector=>selector==='h1'?[heading]:[];
  players.push({id:'p',first_name:'New',last_name:'Arrival',active:1});
  await app.refresh();assert.match(root.innerHTML,/New Arrival/);assert.equal(app.document.activeElement,heading);assert.equal(heading.tabindex,'-1');
});

test('AP5: quantities use singular at one and plural at zero or two in rendered lists',async()=>{
  const app=await frontend('/#ergebnisse',{events:[{id:1,name:'Test',date:'2026-11-01',status:'open'}],matches:[{id:1,event_id:1,player_a:'A',player_b:'B',status:'finished',a:1,b:0,target:1}]});
  assert.match(app.element('#app').innerHTML,/>1 Partie<\/span>/);
  for(const [n,text] of [[0,'0 Minuten'],[1,'1 Minute'],[2,'2 Minuten']])assert.equal(app.quantity(n,'Minute','Minuten'),text);
  const rentals=await frontend('/#vermietung',{rentals:[{id:1,table_no:1,status:'finished',started_at:0,ended_at:60000,duration_ms:60000,billed_minutes:1,total_cents:15,hourly_cents:900,base_cents:900,adjustment_percent:null,version:1}]});
  assert.match(rentals.element('#app').innerHTML,/1 Minute<\/td>/);assert.doesNotMatch(rentals.element('#app').innerHTML,/1 Minuten/);
});

test('FR-007-Fix settings keep both nuLiga forms adjacent in one ordered column',async()=>{
  const app=await frontend('/#einstellungen'),markup=app.element('#app').innerHTML;
  const ids=['club-branding','table-settings','rental-settings','nuliga-sync','nuliga-schedule-sync','admin-password','backup-file'];
  let previous=-1;
  for(const id of ids){const index=markup.indexOf('id="'+id+'"');assert.ok(index>previous,id+' follows the previous section');previous=index;}
  assert.match(markup,/class="settings-stack"/);assert.doesNotMatch(markup,/class="planning"/);
});

test('FR-006: planned tournament deep links, preview confirmation and checkbox payload',async()=>{
  const players=['a','b','c'].map(id=>({id,first_name:'Spieler',second_name:'',last_name:id,active:1,event_id:null}));
  const event={id:1,name:'Testturnier',kind:'Turnier',date:'2026-10-29',status:'open',phase:'planned',version:3};
  const app=await frontend('/#spieltage/1',{events:[event],players});
  assert.match(app.element('#app').innerHTML,/Turnierverwaltung/);
  assert.match(app.element('#app').innerHTML,/Auslosung als Vorschau/);
  assert.doesNotMatch(app.element('#app').innerHTML,/Spielplan · 10 Partien/);
  const form={id:'tournament-preview-1',dataset:{event:'1',action:'preview',version:'3'},entries:[['mode','ko'],['discipline','9-Ball'],['target','5'],['groupCount','2'],['qualifiers','1'],['rules','difference'],['player_ids','a'],['player_ids','b']],remove(){},closest(){return null;}};
  await app.element('#app').dispatch('submit',{preventDefault(){},target:form});
  assert.deepEqual(app.posts[0],{path:'/api/events/1/tournament/preview',data:{mode:'ko',discipline:'9-Ball',target:5,groupCount:2,qualifiers:1,rules:'difference',player_ids:['a','b'],version:3}});
  event.tournamentPreview={mode:'ko',discipline:'9-Ball',target:5,rules:'difference',players:players.map(p=>({id:p.id,name:'Spieler '+p.id})),groups:[],rounds:[[{a:'a',b:null,match:null},{a:'b',b:'c',match:null}],[{a:'a',b:null,match:null}]],resolutions:{}};
  await app.refresh(true);
  assert.match(app.element('#app').innerHTML,/noch nicht übernommen/);
  assert.match(app.element('#app').innerHTML,/Freilos → weiter/);
  assert.match(app.element('#app').innerHTML,/Diese Auslosung verbindlich übernehmen/);
  app.location.hash='#spieltage/1';await app.window.dispatch('hashchange',{});
  assert.match(app.element('#app').innerHTML,/Turnierverwaltung/);
});

test('FR-006 adjustments: sorted players, filters, free tables and live links',async()=>{
  const event={id:1,name:'Turnier',kind:'Turnier',date:'2026-10-29',status:'open',phase:'planned',version:0};
  const players=[{id:'z',first_name:'Zoe',last_name:'Z',active:1,is_bsv:false},{id:'a',first_name:'Anna',last_name:'A',active:1,is_bsv:true}];
  const app=await frontend('/#spieltage/1',{events:[event],players});
  const html=app.element('#app').innerHTML;
  assert.ok(html.indexOf('Anna A')<html.indexOf('Zoe Z'));
  for(const text of ['BSV-Mitglieder','Externe Spieler','Spieler manuell anlegen','Gruppenzuweisung','group:a'])assert.ok(html.includes(text));
  const matches=[{id:1,event_id:1,status:'planned',player_a:'A',player_b:'B',a:0,b:0,target:5},{id:2,event_id:1,status:'live',table_no:1,player_a:'C',player_b:'D',a:0,b:0,target:5}];
  const live=await frontend('/#spieltage/1',{events:[{...event,tournament:{mode:'ko',discipline:'9-Ball',target:5,rules:'difference',players:[],groups:[],rounds:[],resolutions:{}}}],matches,rentals:[{table_no:2,status:'active'}],table_settings:{table_count:3}});
  const output=live.element('#app').innerHTML;
  assert.match(output,/<option value="3">Tisch 3/);
  assert.doesNotMatch(output,/<option value="[12]">Tisch/);
  assert.ok(output.includes('href="/tisch/1"'));
});

test('Unified event overview includes creation, status filters, planned links and no cross-event matches',async()=>{
  const events=[{id:1,name:'Plan',kind:'Turnier',status:'open',phase:'planned',date:'2026-11-02'},{id:2,name:'Live',kind:'Liga',status:'open',phase:'started',date:'2026-11-03'},{id:3,name:'Archiv',kind:'Turnier',status:'closed',date:'2026-10-01'}];
  const app=await frontend('/#spieltage',{events,matches:[{id:1,event_id:2,status:'planned'}]});
  const markup=()=>app.element('#app').innerHTML;
  assert.ok(markup().includes('<h1>Veranstaltungsübersicht</h1>'));
  assert.ok(markup().includes('data-event-creation'));assert.ok(markup().includes('id="event"'));
  assert.ok(markup().indexOf('href="/#spieltage/2"')<markup().indexOf('href="/#spieltage/1"'));
  assert.ok(!markup().includes('href="/#spieltage/3"'));assert.ok(!markup().includes('class="match-row"'));
  await app.element('#app').dispatch('change',{target:{id:'event-status',value:'closed',dataset:{}}});
  assert.ok(markup().includes('href="/#spieltage/3"'));assert.ok(!markup().includes('href="/#spieltage/1"'));
  assert.ok(app.gets.some(url=>url.includes('status=closed')));
  const legacy=await frontend('/#planung',{events});assert.ok(legacy.element('#app').innerHTML.includes('Veranstaltungsübersicht'));
  assert.ok(!html.includes('href="/#planung"'));assert.ok(html.includes('>Veranstaltungen</a>'));
});

test('Tournament manages its own matches, table assignment and persistent sections',async()=>{
  const tournament={mode:'ko',discipline:'9-Ball',target:5,rules:'difference',players:[{id:'a',name:'Anna'},{id:'b',name:'Ben'}],groups:[],rounds:[[{a:'a',b:'b',match:41}]],resolutions:{}};
  const event={id:1,name:'Vereinsturnier',kind:'Turnier',date:'2026-11-01',status:'open',phase:'started',version:2,tournament};
  const match={id:41,event_id:1,status:'planned',version:3,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:5,a:0,b:0,pin_set:true};
  const app=await frontend('/#spieltage/1',{events:[event],matches:[match,{...match,id:42,event_id:2,player_a:'Fremde Partie'}]});
  const markup=()=>app.element('#app').innerHTML;
  assert.ok(markup().includes('data-tournament-section="matches" aria-pressed="true"'));
  assert.ok(markup().includes('Tisch zuweisen'));assert.ok(!markup().includes('Fremde Partie'));assert.ok(!markup().includes('Weitere Partien'));
  assert.equal([...markup().matchAll(/class="start"/g)].length,1);
  const button={dataset:{tournamentSection:'ranking'}};
  await app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button'?button:null}});
  await app.refresh(true);assert.ok(markup().includes('data-tournament-section="ranking" aria-pressed="true"'));
  await app.element('#app').dispatch('submit',{preventDefault(){},target:{id:'',dataset:{id:'41'},entries:[['table_no','2']],classList:{contains:name=>name==='start'}}});
  assert.deepEqual(app.posts[0],{path:'/api/matches/41/start',data:{table_no:2,version:3}});
  match.status='live';match.table_no=2;await app.refresh(true);assert.ok(markup().includes('href="/tisch/2"'));
});

test('Tournament participant menu contains manual creation and an optional live name search',async()=>{
  const event={id:1,name:'Turnier',kind:'Turnier',date:'2026-11-01',status:'open',phase:'planned',version:0};
  const app=await frontend('/#spieltage/1',{events:[event]});
  const html=app.element('#app').innerHTML;
  const menu=html.slice(html.indexOf('<fieldset><legend>Teilnehmer'),html.indexOf('</fieldset>',html.indexOf('<fieldset><legend>Teilnehmer')));
  assert.match(menu,/<summary>Spieler manuell anlegen<\/summary>/);
  for(const name of ['first_name','last_name'])assert.match(menu,new RegExp('name="'+name+'"[^>]*form="tournament-player-1"'));
  assert.match(menu,/<button type="submit" form="tournament-player-1">/);
  assert.match(menu,/<input name="participant_search"[^>]*>/);
  assert.doesNotMatch(menu.match(/<input name="participant_search"[^>]*>/)[0],/required/);
  assert.match(html,/<span data-tournament-target-label>Gewinnspiele<\/span>/);

  const rows=['Anna Müller','Anne Gast','Ben Gast'].map((name,i)=>({dataset:{name,membership:i?'external':'bsv'},hidden:false,checkbox:{checked:i===0},group:{},input:{},querySelector(selector){return selector==='[data-group-choice]'?this.group:selector==='[data-group-choice] input'?this.input:this.checkbox;}}));
  const fields={participant_filter:{value:'all'},participant_search:{value:''},discipline:{value:'9-Ball'},mode:{value:'groups'}};
  const label={textContent:''};
  const form={dataset:{action:'preview'},elements:{namedItem:name=>fields[name]},querySelector:()=>label,querySelectorAll:()=>rows};
  const search=async value=>{fields.participant_search.value=value;await app.element('#app').dispatch('input',{target:{name:'participant_search',form,dataset:{}}});};
  await search('a');assert.deepEqual(rows.map(r=>r.hidden),[false,false,false]);
  await search('an');assert.deepEqual(rows.map(r=>r.hidden),[false,false,true]);
  await search('ann');assert.deepEqual(rows.map(r=>r.hidden),[false,false,true]);
  await search('ANNA');assert.deepEqual(rows.map(r=>r.hidden),[false,true,true]);
  await search('ann');assert.deepEqual(rows.map(r=>r.hidden),[false,false,true]);
  fields.participant_filter.value='external';
  await app.element('#app').dispatch('change',{target:{name:'participant_filter',dataset:{},closest:()=>form}});
  assert.deepEqual(rows.map(r=>r.hidden),[true,false,true]);assert.equal(rows[0].checkbox.checked,true);
  await search('');assert.deepEqual(rows.map(r=>r.hidden),[true,false,false]);
  fields.participant_filter.value='all';await search(' müLL ');assert.deepEqual(rows.map(r=>r.hidden),[false,true,true]);
  for(const discipline of ['14/1','8-Ball','10-Ball','9-Ball']){
    fields.discipline.value=discipline;
    await app.element('#app').dispatch('change',{target:{name:'discipline',dataset:{},closest:()=>form}});
    assert.equal(label.textContent,discipline==='14/1'?'Punkte':'Gewinnspiele');
  }
});

test('Tournament refresh preserves participant scroll and the manual creation panel',async()=>{
  const event={id:1,name:'Turnier',kind:'Turnier',date:'2026-11-01',status:'open',phase:'planned',version:0};
  const app=await frontend('/#spieltage/1',{events:[event]});
  const root=app.element('#app'),list={dataset:{tournamentScroll:'1'},scrollTop:480},panel={dataset:{tournamentManual:'1'},open:true};
  let markup=root.innerHTML;
  Object.defineProperty(root,'innerHTML',{get:()=>markup,set:value=>{markup=value;list.scrollTop=0;panel.open=false;}});
  root.querySelectorAll=selector=>selector==='[data-tournament-scroll]'?[list]:selector==='[data-tournament-manual]'?[panel]:[];
  await app.refresh(true);assert.equal(list.scrollTop,480);assert.equal(panel.open,true);
  list.scrollTop=720;panel.open=false;
  await app.refresh(true);assert.equal(list.scrollTop,720);assert.equal(panel.open,false);
  const planning=await frontend('/#planung',{events:[event,{...event,id:2,kind:'Liga'}]});
  assert.ok(planning.element('#app').innerHTML.includes('>Turnier löschen</button>'));
  assert.ok(planning.element('#app').innerHTML.includes('>Spieltag löschen</button>'));
  assert.match(markup,/<option value="swiss"[^>]*>Schweizer System/);
});

test('Tournament group field follows selected players and assignment mode',async()=>{
  const app=await frontend('/#planung');
  const checkbox={checked:false},label={hidden:true},input={disabled:true};
  const row={dataset:{membership:'bsv'},querySelector(selector){return selector==='[data-group-choice]'?label:selector==='[data-group-choice] input'?input:checkbox;}};
  const fields={participant_filter:{value:'all'},assignment:{value:'manual'},mode:{value:'groups'}};
  const form={elements:{namedItem(name){return fields[name];}},querySelectorAll(){return [row];}};
  app.updateTournamentSelection(form);assert.equal(label.hidden,true);assert.equal(input.disabled,true);
  checkbox.checked=true;app.updateTournamentSelection(form);assert.equal(label.hidden,false);assert.equal(input.disabled,false);
  checkbox.checked=false;app.updateTournamentSelection(form);assert.equal(label.hidden,true);assert.equal(input.disabled,true);
  checkbox.checked=true;fields.assignment.value='random';app.updateTournamentSelection(form);assert.equal(label.hidden,false);assert.equal(input.disabled,false);
  form.dataset={action:'preview'};
  await app.element('#app').dispatch('change',{target:{name:'group:a',dataset:{},closest(){return form;}}});
  assert.equal(fields.assignment.value,'manual');
  fields.assignment.value='manual';fields.mode.value='ko';app.updateTournamentSelection(form);assert.equal(label.hidden,true);
});


test('AP6: server pages retain global totals, clamp after deletion and never fetch the full admin archive',async()=>{
  const fixtures=listFixtures(105),app=await frontend('/#ergebnisse',{...fixtures,serverPages:true});
  const markup=()=>app.element('#app').innerHTML;
  assert.match(markup(),/1–20 von 105/);assert.match(markup(),/105 Partien/);assert.equal([...markup().matchAll(/class="match-row"/g)].length,20);
  await pageClick(app,'matches-ergebnisse',1);assert.match(markup(),/21–40 von 105/);
  await pageSize(app,'matches-ergebnisse',100);assert.match(markup(),/1–100 von 105/);
  await pageClick(app,'matches-ergebnisse',1);assert.match(markup(),/101–105 von 105/);
  fixtures.matches.splice(5);await app.refresh(true);assert.match(markup(),/1–5 von 5/);
  assert.ok(app.gets.some(path=>path.includes('matches-ergebnisse-page=2')));
  assert.ok(app.gets.every(path=>path!=='/api/admin'));
});

test('AP6: delayed previous view responses cannot replace the current navigation',async()=>{
  let release,hold=false;const started=new Promise(resolve=>release=resolve);let unblock;
  const gate=new Promise(resolve=>unblock=resolve);
  const app=await frontend('/#ergebnisse',{...listFixtures(25),serverPages:true,responseHook:async path=>{if(hold&&path.startsWith('/api/admin/view?')){hold=false;release();await gate;}}});
  hold=true;const stale=app.refresh();await started;
  app.location.hash='#vermietung';await app.window.dispatch('hashchange',{});
  assert.match(app.element('#app').innerHTML,/Tischvermietung/);
  unblock();await stale;assert.match(app.element('#app').innerHTML,/Tischvermietung/);
  assert.doesNotMatch(app.element('#app').innerHTML,/Abgeschlossene Partien/);
});

test('AP6: delayed authentication failures from a previous view cannot log out a newer view',async()=>{
  let release,hold=false;const started=new Promise(resolve=>release=resolve);let unblock;
  const gate=new Promise(resolve=>unblock=resolve);
  const app=await frontend('/#ergebnisse',{...listFixtures(25),serverPages:true,responseHook:async path=>{if(hold&&path.startsWith('/api/admin/view?')){hold=false;release();await gate;throw Object.assign(Error('old unauthorized response'),{status:401});}}});
  hold=true;const stale=app.refresh();await started;
  app.location.hash='#vermietung';await app.window.dispatch('hashchange',{});
  assert.match(app.element('#app').innerHTML,/Tischvermietung/);
  unblock();await stale;assert.match(app.element('#app').innerHTML,/Tischvermietung/);
  assert.doesNotMatch(app.element('#app').innerHTML,/Abgeschlossene Partien/);
});


test('AP6: explicit statistics selection cannot be overwritten by the previous form draft',async()=>{
  const app=await frontend('/#spieler',{players:[{id:'p',first_name:'Anna',last_name:'Audit',active:1}]});
  const form={getAttribute:()=> 'stats-filter',entries:[['kind','players'],['id','']],elements:{namedItem(){return null;}}};
  app.element('#app').querySelectorAll=selector=>selector==='form'?[form]:[];
  app.saveDrafts();assert.ok(app.drafts.has('stats-filter'));
  const button={dataset:{stat:'players',id:'p'},hasAttribute:()=>false};
  await app.element('#app').dispatch('click',{target:{closest:selector=>selector==='button'?button:null}});
  assert.equal(app.drafts.has('stats-filter'),false);
  assert.match(app.element('#app').innerHTML,/<option value="p" selected>/);
});

function inventoryFixtures() {
  return {drinks:[{id:'water',name:'Wasser <b>',size_ml:500,sale_cents:250,purchase_cents:null,minimum:45,active:1,stock:41,version:3},{id:'cola',name:'TEST Cola',size_ml:330,sale_cents:300,purchase_cents:80,minimum:12,active:1,stock:6,version:2},{id:'juice',name:'Saft',size_ml:500,sale_cents:0,purchase_cents:0,minimum:6,active:1,stock:0,version:1},{id:'old',name:'Alt',size_ml:330,sale_cents:0,purchase_cents:0,minimum:0,active:0,stock:0,version:1}],packages:[{id:'case',drink_id:'water',name:'20er-Kasten',bottles:20,version:0}],movements:[{id:1,drink_id:'water',kind:'initial',quantity:43,created_at:'2026-11-02T10:00:00Z',reason:'<script>test</script>',reverses:null,snapshot:JSON.stringify({name:'Historisches Wasser',size_ml:500,sale_cents:250,purchase_cents:null,bottles:20,package_name:'20er-Kasten'})}]};
}
async function inventoryClick(app,button,dialog=false) {
  button.hasAttribute??=()=>false;
  await app.element(dialog?'#inventory-dialog':'#app').dispatch('click',{target:{closest:()=>button}});
}
async function inventoryFilter(app,key,value) {
  await app.element('#app').dispatch(key==='name'?'input':'change',{target:{dataset:{inventoryFilter:key},value}});
  return app.element('#inventory-stock-rows').innerHTML;
}
test('Lager: Tabelle ist die zentrale Ansicht; acht Spaltenfilter und sichere Klartextausgabe',async()=>{
  const app=await frontend('/#lager',{inventory:inventoryFixtures()});
  const markup=app.element('#app').innerHTML;
  assert.match(markup,/<h2 id="inventory-stock-title">Lagerbestand<\/h2>/);
  assert.match(markup,/3 aktive Getränke · <strong>47 Flaschen insgesamt<\/strong> · 3 unter Mindestbestand/);
  assert.match(markup,/data-inventory-open="water"/);assert.match(markup,/Wasser &lt;b&gt;/);
  assert.equal([...markup.matchAll(/data-inventory-filter=/g)].length,8);
  assert.match(markup,/Unter Mindestbestand/);assert.match(markup,/Unbekannt/);assert.match(markup,/330 ml/);
  assert.doesNotMatch(markup,/<form|inventory-reverse|Historisches Wasser|<script>/);
  assert.ok(app.gets.includes('/api/inventory'));assert.equal(app.posts.length,0);
});
test('Lager: alle Spaltenfilter wirken kombiniert und bleiben über Aktualisierung und Untermenü erhalten',async()=>{
  const app=await frontend('/#lager',{inventory:inventoryFixtures()});
  let rows=await inventoryFilter(app,'name','TEST');assert.match(rows,/TEST Cola/);assert.doesNotMatch(rows,/Wasser|Saft/);
  rows=await inventoryFilter(app,'size','500');assert.match(rows,/Keine Getränke/);
  await inventoryFilter(app,'name','');rows=await inventoryFilter(app,'purchase','unknown');assert.match(rows,/Wasser/);assert.doesNotMatch(rows,/Saft/);
  rows=await inventoryFilter(app,'sale','over-250');assert.match(rows,/Keine Getränke/);
  await inventoryClick(app,{id:'inventory-filter-reset',dataset:{}});
  rows=await inventoryFilter(app,'stock','zero');assert.match(rows,/Saft/);assert.match(rows,/Alt/);assert.doesNotMatch(rows,/TEST Cola/);
  rows=await inventoryFilter(app,'status','active');assert.match(rows,/Saft/);assert.doesNotMatch(rows,/>Alt</);
  rows=await inventoryFilter(app,'minimum','positive');assert.match(rows,/Saft/);
  rows=await inventoryFilter(app,'missing','7+');assert.match(rows,/Keine Getränke/);
  rows=await inventoryFilter(app,'missing','1-6');assert.match(rows,/Saft/);
  assert.equal(app.element('#inventory-filter-count').textContent,'1 von 4 Getränken');
  await app.refresh(true);assert.match(app.element('#app').innerHTML,/value="1-6" selected/);
  await inventoryClick(app,{dataset:{inventorySection:'movements'}});await inventoryClick(app,{dataset:{inventorySection:'stock'}});
  assert.match(app.element('#app').innerHTML,/value="1-6" selected/);
  await inventoryClick(app,{id:'inventory-filter-reset',dataset:{}});assert.match(app.element('#app').innerHTML,/4 von 4 Getränken/);
});
test('Lager: Zeilen öffnen Bestands-, Stammdaten- und Gebindebearbeitung im Overlay',async()=>{
  const app=await frontend('/#lager',{inventory:inventoryFixtures()});
  await inventoryClick(app,{dataset:{inventoryOpen:'water'}});
  assert.equal(app.element('#inventory-dialog').open,true);
  assert.equal(app.element('#inventory-dialog-title').textContent,'Wasser <b> · 500 ml');
  const content=app.element('#inventory-dialog-content').innerHTML;
  assert.match(content,/inventory-drink-water/);assert.match(content,/inventory-move-water/);assert.match(content,/data-inventory-package-open="case"/);
  assert.match(content,/20er-Kasten \(20 Flaschen\)/);assert.match(content,/4 Flaschen fehlen/);
  assert.match(content,/name="version" value="3"/);assert.match(content,/name="operation_id"/);
  for(const input of content.match(/<input[^>]*name="purchase_euros"[^>]*>/g))assert.doesNotMatch(input,/\brequired\b/);
  assert.doesNotMatch(content.match(/<input[^>]*name="reason"[^>]*>/)[0],/\brequired\b/);
  assert.match(content,/aria-label="Gebinde"/);
  const panels=['stock','drink','packages'].map(name=>({dataset:{inventoryEditorPanel:name}}));
  app.element('#inventory-dialog').querySelectorAll=selector=>selector==='[data-inventory-editor-panel]'?panels:[];
  await inventoryClick(app,{dataset:{inventoryEditor:'drink'}},true);
  assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
  await inventoryClick(app,{id:'inventory-dialog-close',dataset:{}},true);assert.equal(app.element('#inventory-dialog').open,false);
  await inventoryClick(app,{dataset:{inventoryOpen:'old'}});
  assert.doesNotMatch(app.element('#inventory-dialog-content').innerHTML,/inventory-move-old|inventory-pack-old/);
  assert.match(app.element('#inventory-dialog-content').innerHTML,/inventory-drink-old/);
});
test('Lager: Bewegungshistorie und Gegenbuchung erscheinen ausschließlich im Untermenü',async()=>{
  const app=await frontend('/#lager',{inventory:inventoryFixtures()});
  await inventoryClick(app,{dataset:{inventorySection:'movements'}});
  const markup=app.element('#app').innerHTML;
  assert.match(markup,/Historisches Wasser/);assert.match(markup,/inventory-reverse/);assert.match(markup,/&lt;script&gt;/);assert.doesNotMatch(markup,/<script>/);
  assert.doesNotMatch(markup,/inventory-stock-title/);
  await app.refresh(true);assert.match(app.element('#app').innerHTML,/Historisches Wasser/);
  await inventoryClick(app,{dataset:{inventorySection:'stock'}});assert.doesNotMatch(app.element('#app').innerHTML,/Historisches Wasser|inventory-reverse/);
});
test('Lager: leeres Lager, Neuanlage im Overlay und Anmeldeschutz',async()=>{
  const empty=await frontend('/#lager');assert.match(empty.element('#app').innerHTML,/Getränk anlegen/);
  assert.match(empty.element('#app').innerHTML,/0 Flaschen insgesamt/);assert.match(empty.element('#app').innerHTML,/den Anfangsbestand erfassen/);
  await inventoryClick(empty,{id:'inventory-new-button',dataset:{}});assert.equal(empty.element('#inventory-dialog').open,true);
  assert.match(empty.element('#inventory-dialog-content').innerHTML,/id="inventory-new"/);
  const loggedOut=await frontend('/#lager',{admin:false});assert.match(loggedOut.element('#app').innerHTML,/Anmelden/);assert.ok(!loggedOut.gets.includes('/api/inventory'));
});

test('FR-014.1: Stammdatenformular übermittelt Centwerte, unbekannten EK und ursprüngliche Version',async()=>{
  const app=await frontend('/#lager',{inventory:inventoryFixtures()});
  await inventoryClick(app,{dataset:{inventoryOpen:'water'}});
  const key='operation-browser-1234';let removed=false;
  const form={id:{value:'water'},getAttribute:()=> 'inventory-drink-water',entries:Object.entries({operation_id:key,action:'drink',id:'water',version:'7',name:'Wasser',size_ml:'500',sale_euros:'0.00',purchase_euros:'',minimum:'4',active:'1'}),querySelector:()=>({}),elements:{operation_id:{value:key}},remove(){removed=true;}};
  await app.element('#inventory-dialog').dispatch('submit',{preventDefault(){},target:form});
  await app.refresh(true);
  const post=app.posts.find(p=>p.path==='/api/inventory');assert.ok(post);
  assert.equal(post.data.version,7);assert.equal(post.data.sale_cents,0);assert.equal(post.data.purchase_cents,null);
  assert.equal(post.data.operation_id,key);assert.equal(post.data.id,'water');assert.equal(removed,true);assert.equal(app.element('#inventory-dialog').open,false);
});

test('Lager: fehlgeschlagenes Speichern erhält Overlay, Eingaben und Vorgangskennung zur Wiederholung',async()=>{
  let requests=0,removed=false;
  const app=await frontend('/#lager',{inventory:inventoryFixtures(),responseHook:async path=>{if(path==='/api/inventory'&&++requests===2)throw Error('Daten wurden zwischenzeitlich geändert.');}});
  await inventoryClick(app,{dataset:{inventoryOpen:'water'}});
  const key='browser-retry-operation-1234';
  const form={getAttribute:()=> 'inventory-drink-water',entries:Object.entries({operation_id:key,action:'drink',id:'water',version:'3',name:'Wasser',size_ml:'500',sale_euros:'2.50',purchase_euros:'',minimum:'45',active:'1'}),remove(){removed=true;}};
  await app.element('#inventory-dialog').dispatch('submit',{preventDefault(){},target:form});await app.refresh(true);
  assert.equal(removed,false);assert.equal(app.element('#inventory-dialog').open,true);assert.match(app.element('#inventory-dialog-error').textContent,/zwischenzeitlich/);
  await app.element('#inventory-dialog').dispatch('submit',{preventDefault(){},target:form});await app.refresh(true);
  const posts=app.posts.filter(p=>p.path==='/api/inventory');assert.equal(posts.length,2);assert.equal(posts[0].data.operation_id,key);assert.deepEqual(posts[0].data,posts[1].data);
  assert.equal(removed,true);assert.equal(app.element('#inventory-dialog').open,false);
});

test('Lager: Leer hat Vorrang vor Mindestbestand; Statusfilter entsprechen den farbigen Kennzeichnungen',async()=>{
  const inventory=inventoryFixtures();inventory.drinks.find(d=>d.id==='water').minimum=20;inventory.drinks.find(d=>d.id==='juice').minimum=0;
  const app=await frontend('/#lager',{inventory});
  const markup=app.element('#app').innerHTML;
  assert.match(markup,/inventory-status-sufficient">Ausreichend/);
  assert.match(markup,/inventory-status-low">Nachbestellen/);
  assert.match(markup,/inventory-status-empty">Leer/);
  assert.match(markup,/inventory-status-archived">Archiviert/);
  assert.match(markup,/<option value="empty"[^>]*>Leer/);
  let rows=await inventoryFilter(app,'status','empty');assert.match(rows,/Saft/);assert.doesNotMatch(rows,/TEST Cola|Wasser|>Alt</);
  rows=await inventoryFilter(app,'status','low');assert.match(rows,/TEST Cola/);assert.doesNotMatch(rows,/Saft|Wasser|>Alt</);
  rows=await inventoryFilter(app,'status','sufficient');assert.match(rows,/Wasser/);assert.doesNotMatch(rows,/Saft|TEST Cola|>Alt</);
  rows=await inventoryFilter(app,'status','empty-low');assert.match(rows,/Saft/);assert.match(rows,/TEST Cola/);assert.doesNotMatch(rows,/Wasser|>Alt</);
  await app.refresh(true);assert.match(app.element('#app').innerHTML,/<option value="empty-low" selected>Leer \+ Nachbestellen/);
  rows=await inventoryFilter(app,'status','archived');assert.match(rows,/>Alt</);assert.doesNotMatch(rows,/inventory-status-empty/);
});

test('Gebinde: zentrale Tabelle, gezielte Bearbeitung per Namensklick und separate Neuanlage',async()=>{
  const inventory=inventoryFixtures();inventory.packages.push({id:'case24',drink_id:'water',name:'24er <Kasten>',bottles:24,version:0});
  const app=await frontend('/#lager',{inventory});await inventoryClick(app,{dataset:{inventoryOpen:'water'}});
  const content=app.element('#inventory-dialog-content').innerHTML;
  assert.match(content,/class="inventory-packages-table"/);assert.match(content,/Gebindeübersicht<\/caption>/);
  assert.match(content,/data-inventory-package-open="case"/);assert.match(content,/data-inventory-package-open="case24"/);
  assert.match(content,/24er &lt;Kasten&gt;/);assert.doesNotMatch(content,/<Kasten>/);
  assert.match(content,/20 Flaschen<\/td>/);assert.match(content,/24 Flaschen<\/td>/);
  assert.doesNotMatch(content,/id="inventory-pack-case"/);
  // Polling may update state, but editing must still use the version and values shown in this open overlay.
  inventory.drinks.find(d=>d.id==='water').version=99;inventory.packages[0].bottles=18;await app.refresh(true);
  await inventoryClick(app,{dataset:{inventoryPackageOpen:'case'}},true);
  const editor=app.element('#inventory-package-editor');assert.equal(editor.hidden,false);assert.equal(app.element('#inventory-package-list').hidden,true);
  assert.match(editor.innerHTML,/id="inventory-pack-case"/);assert.match(editor.innerHTML,/name="version" value="3"/);
  assert.match(editor.innerHTML,/name="bottles"[^>]*value="20"/);assert.doesNotMatch(editor.innerHTML,/value="99"/);
  await inventoryClick(app,{dataset:{inventoryPackageBack:'case'}},true);assert.equal(editor.hidden,true);assert.equal(app.element('#inventory-package-list').hidden,false);
  await inventoryClick(app,{dataset:{inventoryPackageOpen:'new'}},true);assert.match(editor.innerHTML,/Gebinde anlegen/);
  assert.match(editor.innerHTML,/name="id" value=""/);assert.match(editor.innerHTML,/name="name"[^>]*value=""/);
  assert.equal(app.posts.length,0);
});

test('Gebinde: Namens- und Größenfilter kombinieren, zurücksetzen und bei Bearbeitungsrückkehr erhalten',async()=>{
  const inventory=inventoryFixtures();inventory.packages.push({id:'case24',drink_id:'water',name:'24er-Kasten',bottles:24,version:0});
  const app=await frontend('/#lager',{inventory});await inventoryClick(app,{dataset:{inventoryOpen:'water'}});
  const filter=async(key,value)=>app.element('#inventory-dialog').dispatch('input',{target:{dataset:{inventoryPackageFilter:key},value}});
  await filter('name','24er');let rows=app.element('#inventory-package-rows').innerHTML;assert.match(rows,/24er-Kasten/);assert.doesNotMatch(rows,/20er-Kasten/);
  await filter('bottles','20');assert.match(app.element('#inventory-package-rows').innerHTML,/Keine Gebinde/);
  await filter('bottles','24');assert.equal(app.element('#inventory-package-count').textContent,'1 von 2 Gebinden');
  await inventoryClick(app,{dataset:{inventoryPackageOpen:'case24'}},true);await inventoryClick(app,{dataset:{inventoryPackageBack:'case24'}},true);
  assert.match(app.element('#inventory-package-rows').innerHTML,/24er-Kasten/);assert.doesNotMatch(app.element('#inventory-package-rows').innerHTML,/20er-Kasten/);
  await inventoryClick(app,{dataset:{inventoryPackageReset:'true'}},true);rows=app.element('#inventory-package-rows').innerHTML;
  assert.match(rows,/20er-Kasten/);assert.match(rows,/24er-Kasten/);assert.equal(app.element('#inventory-package-count').textContent,'2 von 2 Gebinden');
});

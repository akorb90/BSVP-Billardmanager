import { rentalPrice, hourlyRate } from '../public/rental-pricing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

// Run the actual frontend with a small DOM/API fixture; no production data is used.
async function frontend(path, { admin = true, match = null, tablet = false, events = [], matches = [], rentals = [], rental_settings = {base_cents:900,version:0} } = {}) {
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
  const links = [...html.matchAll(/href="(\/#(?:uebersicht|spieltage|ergebnisse|vermietung))"/g)].map(([_, href]) => {
    const link = element(href); link.href = href; link.hash = new URL(href, 'https://localhost').hash; return link;
  });
  element('#admin-nav').querySelectorAll = () => links;
  const location = new URL(path, 'https://localhost');
  const window = element('window');
  const context = vm.createContext({
    rentalPrice, hourlyRate,
    document: { querySelector: element, querySelectorAll: () => [], body: { classList: { add() {} } } },
    window, location, history: { replaceState(_, __, path) { location.href = new URL(path, location).href; } },
    sessionStorage: { getItem: () => tablet ? 'tablet-token' : null, removeItem() {}, setItem() {} },
    FormData: class { constructor(form) { return (form?.entries || [['password', 'test']])[Symbol.iterator](); } },
    AbortSignal, setInterval() {},
    fetch: async (path,options) => {
      if(options?.body)posts.push({path,data:JSON.parse(options.body)});
      let status = 200, body;
      if (path === '/api/login') { admin = true; body = { csrf: 'csrf' }; }
      else if (path === '/api/admin') { status = admin ? 200 : 401; body = admin ? { csrf: 'csrf', events, matches, rentals, rental_settings } : { error: 'Bitte anmelden.' }; }
      else { status = admin || tablet || !match ? 200 : 401; body = { match }; }
      return { ok: status === 200, status, json: async () => body };
    },
  });
  const app = await vm.runInContext(`(async () => { ${source}\n return { refresh }; })()`, context);
  return { ...app, element, links, location, window, posts, setAdmin(value) { admin = value; } };
}

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
  assert.equal(app.links.length, 4);
  assert.deepEqual(app.links.filter(link => link.attributes['aria-current'] === 'page').map(link => link.hash), ['#' + active]);
}

test('Admin-Startseiten, Ansichten und Logo führen zur richtigen Navigation', async () => {
  for (const path of ['/', '/admin', '/#uebersicht', '/#spieltage', '/#ergebnisse', '/#vermietung']) {
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

import { rentalPrice, hourlyRate } from '../public/rental-pricing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

// Run the actual frontend with a small DOM/API fixture; no production data is used.
async function frontend(path, { admin = true, match = null, tablet = false } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, innerHTML: '', listeners: {}, attributes: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
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
    FormData: class { constructor() { return [['password', 'test']][Symbol.iterator](); } },
    AbortSignal, setInterval() {},
    fetch: async path => {
      let status = 200, body;
      if (path === '/api/login') { admin = true; body = { csrf: 'csrf' }; }
      else if (path === '/api/admin') { status = admin ? 200 : 401; body = admin ? { csrf: 'csrf', events: [], matches: [] } : { error: 'Bitte anmelden.' }; }
      else { status = admin || tablet || !match ? 200 : 401; body = { match }; }
      return { ok: status === 200, status, json: async () => body };
    },
  });
  const app = await vm.runInContext(`(async () => { ${source}\n return { refresh }; })()`, context);
  return { ...app, element, links, location, window, setAdmin(value) { admin = value; } };
}

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

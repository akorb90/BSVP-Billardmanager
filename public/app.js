import { rentalPrice, hourlyRate } from './rental-pricing.js';
const root = document.querySelector('#app'), connection = document.querySelector('#connection');
const table = Number(/^\/tisch\/([1-8])$/.exec(location.pathname)?.[1]);
if (table) document.body.classList.add('kiosk');
if (table && location.hash) history.replaceState(null, '', location.pathname);
let setupChoice, clockOffset=0;
let csrf = '', state, current, busy = false;
const navigation = document.querySelector('#admin-nav');

const views = { einstellungen: ['Einstellungen', 'Grundpreis und Admin-Passwort verwalten.'], vermietung: ['Tischvermietung', 'Tische vermieten, minutengenau abrechnen und Buchungen prüfen.'], uebersicht: ['Tischübersicht', 'Alle acht Tische und laufenden Partien im Blick.'], spieltage: ['Spieltagsverwaltung', 'Veranstaltungen anlegen, Begegnungen planen und Tische zuweisen.'], ergebnisse: ['Ergebnisse', 'Abgeschlossene Partien und ihre gespeicherten Endstände.'] };
let view = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'uebersicht';
const drafts = new Map();
const listPages = new Map();
function paginate(items, key, label) {
  const paging = listPages.get(key) || { page: 1, size: 20 };
  const pages = Math.max(1, Math.ceil(items.length / paging.size));
  paging.page = Math.min(paging.page, pages);
  listPages.set(key, paging);
  const start = (paging.page - 1) * paging.size;
  return {
    items: items.slice(start, start + paging.size),
    controls: `<nav class="pagination" aria-label="${label}: Seitennavigation"><div><label for="${key}-size">Einträge pro Seite</label><select id="${key}-size" data-page-size="${key}">${[10,20,50,100].map(size => `<option value="${size}" ${size === paging.size ? 'selected' : ''}>${size}</option>`).join('')}</select></div><span role="status">${items.length ? start + 1 : 0}–${Math.min(start + paging.size, items.length)} von ${items.length} · Seite ${paging.page} von ${pages}</span><div class="pagination-buttons"><button type="button" id="${key}-previous" data-page-list="${key}" data-page-step="-1" ${paging.page === 1 ? 'disabled' : ''} aria-label="${label}: Vorherige Seite">← Zurück</button><button type="button" id="${key}-next" data-page-list="${key}" data-page-step="1" ${paging.page === pages ? 'disabled' : ''} aria-label="${label}: Nächste Seite">Weiter →</button></div></nav>`
  };
}
function renderPageChange(focusId) {
  saveDrafts(); dashboard(); restoreDrafts(); updateRentalPreview();
  const control = root.querySelector('#' + focusId);
  if (control?.disabled) root.querySelector(`[data-page-size="${control.dataset.pageList}"]`)?.focus();
  else control?.focus();
}
root.addEventListener('change', e => {
  const key = e.target.dataset.pageSize, size = Number(e.target.value);
  if (!state || busy || !listPages.has(key) || ![10,20,50,100].includes(size)) return;
  listPages.set(key, { page: 1, size });
  renderPageChange(e.target.id);
});
root.addEventListener('click', e => {
  const button = e.target.closest('button[data-page-list]');
  if (!button || button.disabled || busy || !state) return;
  const paging = listPages.get(button.dataset.pageList);
  if (!paging) return;
  paging.page = Math.max(1, paging.page + Number(button.dataset.pageStep));
  renderPageChange(button.id);
});
function adminNavigation(authenticated) {
  navigation.hidden = !authenticated;
  document.querySelector('#logout').hidden = !authenticated;
  for (const link of navigation.querySelectorAll('a')) {
    if (authenticated && link.hash === '#' + (table ? 'uebersicht' : view)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
function saveDrafts() { for (const form of root.querySelectorAll('form')) if (form.id && !['login','tablet-login','admin-password'].includes(form.id)) drafts.set(form.id, [...new FormData(form)]); }
function restoreDrafts() { for (const [id, entries] of drafts) for (const [name, value] of entries) { const field = document.getElementById(id)?.elements.namedItem(name); if (field) field.value = value; } }
function finishButton(m) { return '<button data-finish="' + m.id + '" ' + (Math.max(m.a,m.b) < m.target ? 'disabled title="Spielziel noch nicht erreicht"' : 'class="primary"') + '>Spiel abschließen</button>'; }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { planned:'Geplant', live:'Am Tisch', finished:'Abgeschlossen' };
function message(value) { const el = document.querySelector('#message'); el.textContent = value; el.hidden = !value; }
async function api(path, data) {
  const headers = {};
  if (table) headers.Authorization = `Bearer ${sessionStorage.getItem(`tablet-session:${table}`) || ''}`;
  if (data) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf; }
  const res = await fetch(path, { method: data ? 'POST' : 'GET', headers, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(8000) });
  const result = await res.json();
  if (!res.ok) { const error = new Error(result.error); error.status = res.status; throw error; }
  if(result.server_now) clockOffset=result.server_now-Date.now();
  if(result.match?.server_now) clockOffset=result.match.server_now-Date.now();
  if(result.matches?.[0]?.server_now) clockOffset=result.matches[0].server_now-Date.now();
  return result;
}
function login() {
  state = undefined; adminNavigation(false);
  root.innerHTML = `<section class="login"><div class="login-copy"><p class="eyebrow">WILLKOMMEN IM VEREIN</p><h1>Der nächste Stoß.<br>Alles im Blick.</h1><p>Spieltage organisieren. Begegnungen starten.<br>Spielstände direkt am Tisch erfassen.</p><form id="login"><label>Administrator-Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Anmelden →</button></form><small>Die Tablets öffnen ihre eigene Tisch-Adresse.</small></div><div class="login-badge"><img src="/assets/bsv-logo.png" alt="BSV Pfaffenhofen · Vereinslogo seit 1995"></div></section>`;
  connection.textContent = 'Vereinsverwaltung'; connection.className = ''; document.querySelector('#logout').hidden = true;
}
function dashboard() {
  if(view==='einstellungen') { adminNavigation(true); settingsDashboard(); return; }
  if(view==='vermietung') { adminNavigation(true); rentalDashboard(); return; }
  const live = state.matches.filter(m => m.status === 'live');
  adminNavigation(true);
  const visibleMatches = state.matches.filter(m => view === 'ergebnisse' ? m.status === 'finished' : view === 'spieltage' ? true : m.status === 'live');
  const matchPage = paginate(visibleMatches, 'matches-' + view, views[view][0]);
  const eventPage = view === 'spieltage' ? paginate(state.events, 'events', 'Veranstaltungen') : null;
  root.innerHTML = `<div class="page-title"><div><p class="eyebrow">SPIELBETRIEB</p><h1>${views[view][0]}</h1><p>${views[view][1]}</p></div><span class="pill">${live.length + (state.rentals || []).filter(r=>r.status==='active').length} / 8 Tische belegt</span></div>
    <section ${view === 'uebersicht' ? '' : 'hidden'}><div class="section-title"><h2>Unsere Tische</h2><span>Live-Spielstände · alle 3 Sekunden</span></div><section class="tables">${Array.from({length:8}, (_,i) => {
      const m = live.find(m => m.table_no === i + 1);
      const r = (state.rentals || []).find(r=>r.table_no===i+1 && r.status==='active');
      if(r) return `<a href="/#vermietung" class="table-card occupied"><strong>TISCH ${i+1}</strong><h3>Vermietet</h3>${rentalRunning(r)}<small>Zur Tischvermietung ↗</small></a>`;
      return `<a href="/tisch/${i+1}" class="table-card ${m ? 'occupied' : ''}"><div><strong>TISCH ${String(i+1).padStart(2,'0')}</strong><span class="dot ${m ? 'active' : ''}"></span></div>${m ? `<p>${esc(m.discipline)} · Race to ${m.target}</p><div class="mini-score"><span>${esc(m.player_a)}</span><b>${m.a}</b></div><div class="mini-score"><span>${esc(m.player_b)}</span><b>${m.b}</b></div>${timers(m)}<small>● Break: ${m.setup_done ? esc(m[m.breaker === 'a' ? 'player_a' : 'player_b']) : 'Noch offen'}</small>` : '<div class="free">Bereit für die nächste Partie</div><small>Frei verfügbar ↗</small>'}</a>`;
    }).join('')}</section></section>
    <section class="planning" ${view === 'spieltage' ? '' : 'hidden'}><div class="panel"><p class="eyebrow">01 · VERANSTALTUNG</p><h2>Spieltag anlegen</h2><form id="event"><label>Name<input name="name" maxlength="100" placeholder="z. B. Bezirksliga · 3. Spieltag" required></label><div class="form-row"><label>Format<select name="kind"><option>Liga</option><option>Turnier</option></select></label><label>Datum<input name="date" type="date" required></label></div><button class="primary">Veranstaltung anlegen</button></form></div>
    <div class="panel"><p class="eyebrow">02 · BEGEGNUNG</p><h2>Die nächste Partie</h2><form id="match"><label>Veranstaltung<select name="event_id" required><option value="">Bitte auswählen</option>${state.events.filter(e=>e.status === 'open').map(e => `<option value="${e.id}">${esc(e.date)} · ${esc(e.name)} (${esc(e.kind)})</option>`).join('')}</select></label><div class="form-row"><label>Spieler A<input name="player_a" maxlength="100" required></label><label>Spieler B<input name="player_b" maxlength="100" required></label></div><div class="form-row"><label>Disziplin<select name="discipline"><option>8-Ball</option><option>9-Ball</option><option>10-Ball</option></select></label><label>Gewinnspiele<input name="target" type="number" value="5" min="1" max="99" required></label></div><label>Tablet-PIN (6 Ziffern)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><button class="primary" ${state.events.some(e=>e.status === 'open') ? '' : 'disabled'}>Begegnung planen</button></form></div></section>
    <section ${view === 'spieltage' ? '' : 'hidden'}><div class="section-title"><h2>Veranstaltungen</h2></div>${eventPage?.controls || ''}<div class="event-list">${eventPage ? eventPage.items.map(eventCard).join('') || '<p>Noch keine Veranstaltungen angelegt.</p>' : ''}</div></section><div class="section-title"><h2>${view === 'ergebnisse' ? 'Abgeschlossene Partien' : view === 'spieltage' ? 'Alle Begegnungen' : 'Laufende Partien'}</h2><span>${visibleMatches.length} Partien</span></div>${matchPage.controls}<section id="matches">${matchRows(matchPage.items)}</section>`;
}
function matchRows(matches) {
  return matches.map(m => `<article class="match-row"><div><span class="pill ${m.status === 'live' ? 'green' : ''}">${labels[m.status]}</span><h3>${esc(m.player_a)} <span class="muted">vs.</span> ${esc(m.player_b)}</h3><p>${esc(state.events.find(e => e.id === m.event_id)?.name)} · ${esc(m.discipline)} · Ziel ${m.target}${m.table_no ? ' · Tisch ' + m.table_no : ''}</p></div><strong class="result">${m.a} : ${m.b}</strong>${m.status === 'planned' ? `<form class="start" data-id="${m.id}"><label>Tisch<select name="table_no">${Array.from({length:8},(_,i) => `<option value="${i+1}">Tisch ${i+1}</option>`).join('')}</select></label><button>Tisch zuweisen ↗</button></form>` : m.status === 'live' ? `<div class="match-actions"><a href="/tisch/${m.table_no}">Punkte bearbeiten ↗</a>${finishButton(m)}${Math.max(m.a,m.b) < m.target ? '<small>Abschluss ab Erreichen des Spielziels</small>' : '<small>Spielziel erreicht · bereit zum Abschluss</small>'}</div>` : ''}${m.pin_set ? '' : '<small>Tablet-PIN fehlt · bitte Partie bearbeiten</small>'}${timers(m)}${matchAdminActions(m)}</article>`).join('') || '<div class="empty">Keine Partien in dieser Ansicht.</div>';
}
function tabletLogin() {
  current=undefined; adminNavigation(false);
  if(root.querySelector('#tablet-login')) { root.querySelector('button').disabled=false; return; }
  root.innerHTML=`<section class="panel"><p class="eyebrow">TISCH ${table}</p><h1>Partie freischalten</h1><p>Die sechsstellige PIN erhaltet ihr von der Spielleitung.</p><form id="tablet-login"><label>Partie-PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><button class="primary">Tisch freischalten</button></form></section>`;
}
function duration(ms) { const seconds=Math.max(0,Math.floor(ms/1000)); return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':'); }
function timers(m) {
  if(!m.setup_done) return '<p>Wartet auf Ausstoßen und erstes Break</p>';
  if(!m.started_at) return '<p>Spielzeit noch nicht erfasst (Bestand)</p>';
  return '<p class="match-timers">Partie: <strong data-time-base="'+m.elapsed_ms+'" data-time-since="'+(m.running_since??'')+'">'+duration(m.elapsed_ms+(m.running_since===null?0:Date.now()+clockOffset-m.running_since))+'</strong>'+(m.rack_since!==null?' · Runde: <strong data-time-base="0" data-time-since="'+m.rack_since+'">'+duration(Date.now()+clockOffset-m.rack_since)+'</strong>':'')+'</p>';
}
function tickTimers() { tickRentals(); for(const el of document.querySelectorAll('[data-time-base]')) el.textContent=duration(Number(el.dataset.timeBase)+(el.dataset.timeSince===''?0:Date.now()+clockOffset-Number(el.dataset.timeSince))); }
function preparation(m) {
  if(setupChoice?.id!==m.id || setupChoice?.version!==m.version) setupChoice={id:m.id,version:m.version};
  const lag=setupChoice.lag;
  root.innerHTML=`<section class="panel"><p class="eyebrow">TISCH ${table} · SPIELVORBEREITUNG</p><h1>${lag?'Wer hat das erste Break?':'Wer hat das Ausstoßen (Lag) gewonnen?'}</h1><p>${esc(m.player_a)} gegen ${esc(m.player_b)}</p>${lag?'<p>Ausstoßen gewonnen: '+esc(m[lag==='a'?'player_a':'player_b'])+'</p>':''}<div class="dialog-actions">${['a','b'].map(side=>'<button class="primary" data-'+(lag?'begin':'lag')+'="'+side+'">'+esc(m[side==='a'?'player_a':'player_b'])+'</button>').join('')}</div>${lag?'<button data-setup-back>Zurück zum Ausstoßen</button>':''}<p>Die Zeitmessung beginnt mit der Bestätigung des ersten Breaks.</p></section>`;
}
function kiosk() {
  if (!current) { root.innerHTML = `<div class="waiting"><p class="eyebrow">TISCH ${String(table).padStart(2,'0')}</p><img class="waiting-logo" src="/assets/bsv-logo.png" alt="BSV Pfaffenhofen"><h1>Bereit, wenn ihr es seid.</h1><p>Die nächste Begegnung erscheint hier automatisch,<br>sobald sie in der Verwaltung gestartet wird.</p></div>`; return; }
  if(!current.setup_done) { preparation(current); return; }
  const m = current, done = Math.max(m.a,m.b) === m.target;
  root.innerHTML = `<div class="score-heading"><span class="pill">TISCH ${String(table).padStart(2,'0')}</span><p>${esc(m.event_name)}</p><h2>${esc(m.discipline)} <span class="muted">/</span> Race to ${m.target}</h2>${timers(m)}</div><section class="scoreboard">${['a','b'].map(side => `<article class="player ${m.breaker === side && !done ? 'breaking' : ''}"><div class="break-label">${m.breaker === side && !done ? '● NÄCHSTES BREAK' : '&nbsp;'}</div><h1>${esc(m[side === 'a' ? 'player_a' : 'player_b'])}</h1><div class="points">${m[side]}</div><div class="score-controls"><button data-side="${side}" data-delta="-1" aria-label="Punkt bei Spieler ${side.toUpperCase()} zurücknehmen" ${m[side] === 0 || busy ? 'disabled' : ''}>−</button><button class="primary" data-side="${side}" data-delta="1" ${done || busy ? 'disabled' : ''}>+ Punkt</button></div></article>`).join('')}</section><p class="score-note">${done ? 'Spielziel erreicht · Endstand prüfen und Spiel abschließen.' : 'Wechselbreak · Nach jedem abgeschlossenen Rack wechselt das Anstoßrecht.'}</p><div class="finish-bar">${finishButton(m)}${!done ? '<small>Verfügbar, sobald das Spielziel erreicht ist.</small>' : ''}</div>`;
}
async function refresh(initial = false) {
  try {
    if (table) {
      // A logged-in administrator can also open the table view.
      try { const admin = await api('/api/admin'); csrf = admin.csrf; adminNavigation(true); }
      catch(e) { if (e.status !== 401) throw e; csrf = ''; adminNavigation(false); }
      const data = await api(`/api/tables/${table}`);
      if(data.match) delete data.match.server_now; // Clock sync must not replace focused controls.
      if (initial || JSON.stringify(current) !== JSON.stringify(data.match)) { current = data.match; kiosk(); }
    } else {
      state = await api('/api/admin'); csrf = state.csrf;
      if (initial || !root.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') {
        saveDrafts(); dashboard(); restoreDrafts(); updateRentalPreview();
      }
    }
    checkWarning();
    connection.textContent = '● Verbunden'; connection.className = 'online';
  } catch(e) {
    connection.textContent = '● Nicht verbunden'; connection.className = 'offline';
    if (table && e.status === 401) { sessionStorage.removeItem(`tablet-session:${table}`); tabletLogin(); connection.textContent='PIN erforderlich'; }
    else if (!table && e.status === 401) login();
    else { message(e.message || 'Verbindung unterbrochen. Änderungen werden nicht offline gespeichert.'); root.querySelectorAll('[data-side], [data-finish]').forEach(b => b.disabled = true); if (table) current = undefined; }
  }
}
async function mutate(fn) {
  if (busy) return; busy = true; message(''); root.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await fn(); } catch(e) { message(e.message || 'Verbindung fehlgeschlagen. Bitte den aktuellen Spielstand prüfen.'); }
  finally { busy = false; await refresh(true); }
}
root.addEventListener('submit', e => {
  e.preventDefault(); if(handlePasswordSubmit(e.target)) return; if(handleRentalSubmit(e.target)) return; const form = e.target, data = Object.fromEntries(new FormData(form));
  mutate(async () => {
    if (form.id === 'tablet-login') { const result=await api(`/api/tables/${table}/login`,data); sessionStorage.setItem(`tablet-session:${table}`,result.token); form.reset(); }
    if (form.id === 'login') {
      const result = await api('/api/login', data); csrf = result.csrf;
      view = 'uebersicht'; history.replaceState(null, '', '/#uebersicht');
    }
    if (form.id === 'event') { await api('/api/events', data); form.reset(); drafts.delete('event'); }
    if (form.id === 'match') { await api('/api/matches', { ...data, event_id:Number(data.event_id), target:Number(data.target) }); form.reset(); drafts.delete('match'); }
    if (form.classList.contains('start')) { const m = state.matches.find(m => m.id === Number(form.dataset.id)); await api(`/api/matches/${m.id}/start`, { table_no:Number(data.table_no), version:m.version }); }
  });
});
root.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  if(button.dataset.lag && current && !busy) { setupChoice={id:current.id,version:current.version,lag:button.dataset.lag}; preparation(current); }
  if(button.hasAttribute('data-setup-back') && current && !busy) { setupChoice=undefined; preparation(current); }
  if(button.dataset.begin && current && setupChoice?.lag && !busy) { const m=current; mutate(()=>api(`/api/matches/${m.id}/begin`,{lag_winner:setupChoice.lag,first:button.dataset.begin,version:m.version})); }
  if (button.dataset.side && current) { const m = current; mutate(() => api(`/api/matches/${m.id}/score`, { side:button.dataset.side, delta:Number(button.dataset.delta), version:m.version })); }
  if (button.dataset.finish && !busy) {
    const m = table ? current : state.matches.find(m => m.id === Number(button.dataset.finish));
    if (!m) return;
    showWarning({phrase:'SPIEL ABSCHLIESSEN', label:'Spiel abschließen', summary:'<p>'+esc(m.player_a)+' '+m.a+' : '+m.b+' '+esc(m.player_b)+'</p><p>Der Endstand wird gespeichert und der Tisch freigegeben.</p>', valid:()=> (table?current:state.matches.find(v=>v.id===m.id))?.version===m.version, run:()=>api('/api/matches/'+m.id+'/finish',{version:m.version,action:'match:finish',confirmation:'SPIEL ABSCHLIESSEN'})});
  }
});
window.addEventListener('hashchange', () => {
  if (table) return;
  saveDrafts(); view = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'uebersicht';
  if (state) { dashboard(); restoreDrafts(); }
});
document.querySelector('#logout').addEventListener('click', () => mutate(() => api('/api/logout', {})));


const adminDialog = document.querySelector('#admin-dialog');
let pendingAdmin;
function eventCard(event) {
  const matches=state.matches.filter(m=>m.event_id===event.id), closed=event.status==='closed';
  return `<article class="event-card"><span class="pill">${esc(event.kind)} · ${closed?'Gesamtabschluss':'Offen'}</span><h3>${esc(event.name)}</h3><p>${esc(event.date)} · ${matches.length} Partien</p>${`<div class="entity-actions"><button data-entity="event" data-action="edit" data-id="${event.id}">Veranstaltung bearbeiten</button><button data-entity="event" data-action="delete" data-id="${event.id}">Veranstaltung löschen</button>${closed?'':`<button class="primary" data-entity="event" data-action="close" data-id="${event.id}">Veranstaltung abschließen</button>`}</div><small>${matches.filter(m=>m.status!=='finished').length} Partien noch nicht abgeschlossen</small>`}</article>`;
}
function matchAdminActions(m) {
  return `<div class="entity-actions"><button data-entity="match" data-action="edit" data-id="${m.id}">Partie bearbeiten</button><button data-entity="match" data-action="delete" data-id="${m.id}">Partie löschen</button></div>`;
}
function field(label,name,value,type='text',extra='') {
  return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+' required></label>';
}
function selectField(label,name,value,options) {
  return '<label>'+label+'<select name="'+name+'">'+options.map(([v,l])=>'<option value="'+esc(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
}
root.addEventListener('click',e=>{
  const button=e.target.closest('button[data-entity]'); if(!button||busy||table)return;
  const entity=button.dataset.entity, action=button.dataset.action;
  const item=(entity==='event'?state.events:state.matches).find(v=>v.id===Number(button.dataset.id));
  if(!item)return;
  pendingAdmin={entity,action,item:{...item},eventVersion:entity==='match'?state.events.find(e=>e.id===item.event_id)?.version:undefined};
  const title=(entity==='event'?'Veranstaltung':'Partie')+' '+({edit:'bearbeiten',delete:'löschen',close:'abschließen'}[action]);
  document.querySelector('#admin-dialog-title').textContent=title;
  document.querySelector('#admin-dialog-error').textContent='';
  document.querySelector('#admin-dialog-save').textContent=action==='edit'?'Änderungen speichern':action==='delete'?(entity==='event'?'Veranstaltung löschen':'Spiel löschen'):'Veranstaltung abschließen';
  let content='';
  if(action==='edit'&&entity==='event') {
    content=field('Name','name',item.name,'text','maxlength="100"')+selectField('Format','kind',item.kind,[['Liga','Liga'],['Turnier','Turnier']])+field('Datum','date',item.date,'date');
  } else if(action==='edit') {
    content='<p>Abgeschlossene Partien sind nach Warnbestätigung korrigierbar. Nach Gesamtabschluss bleiben Status und Veranstaltungszuordnung erhalten.</p>'+selectField('Veranstaltung','event_id',item.event_id,state.events.filter(e=>e.id===item.event_id || (state.events.find(v=>v.id===item.event_id)?.status==='open' && e.status==='open')).map(e=>[e.id,e.name]))+
      '<div class="form-row">'+field('Spieler A','player_a',item.player_a,'text','maxlength="100"')+field('Spieler B','player_b',item.player_b,'text','maxlength="100"')+'</div>'+
      '<div class="form-row">'+selectField('Disziplin','discipline',item.discipline,['8-Ball','9-Ball','10-Ball'].map(v=>[v,v]))+selectField('Gewinner Ausstoßen','lag_winner',item.lag_winner??'',[['','Noch nicht erfasst'],['a',item.player_a],['b',item.player_b]])+field('Gewinnspiele','target',item.target,'number','min="1" max="99"')+selectField('Erstes Break','first',item.first,[['a','Spieler A'],['b','Spieler B']])+'</div>'+
      '<div class="form-row">'+field('Punkte A','a',item.a,'number','min="0" max="99"')+field('Punkte B','b',item.b,'number','min="0" max="99"')+'</div>'+
      '<div class="form-row">'+selectField('Status','status',item.status,state.events.find(e=>e.id===item.event_id)?.status==='closed'?[['finished','Abgeschlossen']]:Object.entries(labels))+selectField('Tisch','table_no',item.table_no??'',[['','Kein Tisch'],...Array.from({length:8},(_,i)=>[i+1,'Tisch '+(i+1)])])+'</div>'+
      '<label>'+ (item.pin_set ? 'Neue Tablet-PIN (leer lassen zum Beibehalten)' : 'Tablet-PIN nachtragen') +'<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off"></label>'+
      '<small>Geplant: 0:0 und kein Tisch. Am Tisch: freier Tisch erforderlich. Abgeschlossen: genau ein Spieler hat das Spielziel erreicht.</small>';
  } else {
    const name=entity==='event'?item.name:item.player_a+' / '+item.player_b;
    content='<p><strong>'+esc(name)+'</strong></p>';
    if(action==='delete')content+='<p>Dieser Eintrag wird gelöscht.'+(entity==='event'?' Alle '+state.matches.filter(m=>m.event_id===item.id).length+' zugehörigen Partien einschließlich ihrer Ergebnisse werden ebenfalls gelöscht.':'')+' Belegte Tische werden freigegeben. Diese Aktion kann in der Oberfläche nicht rückgängig gemacht werden.</p>';
    else content+='<p>Der Spielbetrieb wird abgeschlossen. Spätere Korrekturen und Löschungen erfordern eine erneute Warnbestätigung. Alle Partien müssen zuvor abgeschlossen oder gelöscht sein. Bitte die Ergebnisse vorher prüfen.</p>';
  }
  document.querySelector('#admin-dialog-content').innerHTML=content;
  adminDialog.showModal();
});
adminDialog.addEventListener('close',()=>{pendingAdmin=undefined;});
document.querySelector('#admin-dialog-cancel').addEventListener('click',()=>adminDialog.close());
document.querySelector('#admin-edit-form').addEventListener('submit',async e=>{
  e.preventDefault(); if(!pendingAdmin||busy)return;
  const {entity,action,item}=pendingAdmin, data=Object.fromEntries(new FormData(e.target));
  if(entity==='match'&&action==='edit') {
    for(const key of ['event_id','target','a','b'])data[key]=Number(data[key]);
    data.lag_winner=data.lag_winner || null;
    data.table_no=data.table_no===''?null:Number(data.table_no);
  }
  const parent=entity==='match'?state.events.find(e=>e.id===item.event_id):null;
  const payload={...data,version:item.version,event_version:pendingAdmin.eventVersion};
  if(entity==='match' && data.event_id!==item.event_id) payload.destination_version=state.events.find(e=>e.id===data.event_id)?.version;
  const valid=()=>{
    const latest=(entity==='event'?state.events:state.matches).find(v=>v.id===item.id);
    return latest?.version===item.version && (entity==='event' || state.events.find(e=>e.id===item.event_id)?.version===payload.event_version) && (payload.destination_version===undefined || state.events.find(e=>e.id===data.event_id)?.version===payload.destination_version);
  };
  if(!valid()) {document.querySelector('#admin-dialog-error').textContent='Daten geändert. Bitte abbrechen und erneut öffnen.';return;}
  const run=async()=>{await api('/api/'+(entity==='event'?'events':'matches')+'/'+item.id+'/'+action,payload);adminDialog.close();};
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  if(action!=='edit' || (entity==='event'?(item.status==='closed'||item.date<today):(item.status==='finished'||parent?.status==='closed'))) {
    const phrase=entity==='event'?{edit:'EVENT ÄNDERN',delete:'EVENT LÖSCHEN',close:'EVENT ABSCHLIESSEN'}[action]:{edit:'SPIEL ÄNDERN',delete:'SPIEL LÖSCHEN'}[action];
    payload.action=entity+':'+action; payload.confirmation=phrase;
    const name=entity==='event'?item.name:item.player_a+' / '+item.player_b;
    const summary='<p><strong>'+esc(name)+' · #'+item.id+'</strong></p>'+(action==='edit'?changeSummary(item,data):document.querySelector('#admin-dialog-content').innerHTML);
    showWarning({phrase,label:document.querySelector('#admin-dialog-save').textContent,summary,valid,run});
  } else {
    busy=true;
    try {await run();}catch(error){document.querySelector('#admin-dialog-error').textContent=error.message;}
    finally {busy=false;await refresh(true);}
  }
});


const euro = cents => (cents/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const rentalDate = value => value === null ? 'Läuft' : new Date(value).toLocaleString('de-DE');
function rentalRunning(r) {
  return '<p class="rental-clock" data-rental-start="'+r.started_at+'" data-rental-rate="'+r.hourly_cents+'"></p><p>'+euro(r.hourly_cents)+'/h</p>';
}
function tickRentals() {
  for(const el of document.querySelectorAll('[data-rental-start]')) {
    const start=Number(el.dataset.rentalStart), end=Math.max(start,Date.now()+clockOffset);
    const price=rentalPrice(start,end,Number(el.dataset.rentalRate));
    el.textContent=duration(price.duration_ms)+' · '+price.billed_minutes+' Min. · '+euro(price.total_cents);
  }
}

function settingsDashboard() {
  const settings=state.rental_settings;
  root.innerHTML='<div class="page-title"><div><h1>Einstellungen</h1><p>Grundpreis und Admin-Passwort verwalten.</p></div></div><section class="planning"><div class="panel"><h2>Grundpreis</h2><form id="rental-settings" data-version="'+settings.version+'">'+field('Grundpreis in €/h','base_euros',settings.base_cents/100,'number','min="0" max="10000" step="0.01"')+'<p>Gilt für neue Buchungen. Bestehende Buchungen behalten ihren vereinbarten Preis.</p><button>Grundpreis speichern</button></form></div><div class="panel"><h2>Admin-Passwort ändern</h2><form id="admin-password">'+field('Aktuelles Passwort','current_password','','password','autocomplete="current-password"')+field('Neues Passwort','new_password','','password','autocomplete="new-password" minlength="12" maxlength="128"')+field('Neues Passwort wiederholen','repeat_password','','password','autocomplete="new-password" minlength="12" maxlength="128"')+'<p>12 bis 128 Zeichen. Nach dem Wechsel werden alle Admin-Sitzungen abgemeldet. Bitte anschließend mit dem neuen Passwort anmelden.</p><button>Passwort ändern</button></form></div></section>';
}
function handlePasswordSubmit(form) {
  if(form.id!=='admin-password')return false;
  const data=Object.fromEntries(new FormData(form));
  if(data.new_password!==data.repeat_password) {message('Die neuen Passwörter stimmen nicht überein.');return true;}
  mutate(async()=>{await api('/api/settings/password',data);form.reset();drafts.clear();csrf='';message('Passwort geändert. Bitte mit dem neuen Passwort anmelden.');});
  return true;
}

function rentalDashboard() {
  const rentals=state.rentals || [], settings=state.rental_settings || {base_cents:900,version:0};
  const rentalPage = paginate(rentals, 'rentals', 'Buchungshistorie');
  const free=Array.from({length:8},(_,i)=>i+1).filter(n=>!rentals.some(r=>r.table_no===n&&r.status==='active')&&!state.matches.some(m=>m.table_no===n&&m.status==='live'));
  root.innerHTML='<div class="page-title"><div><p class="eyebrow">TISCHVERMIETUNG</p><h1>Tischvermietung</h1><p>Angefangene Minuten werden aufgerundet. Vereinbarte Preise bleiben gespeichert.</p></div><span class="pill">'+free.length+' / 8 Tische frei</span></div>'+
    '<section class="tables">'+Array.from({length:8},(_,i)=>{
      const n=i+1,r=rentals.find(r=>r.table_no===n&&r.status==='active'), m=state.matches.find(m=>m.table_no===n&&m.status==='live');
      return '<article class="table-card '+(r||m?'occupied':'')+'"><strong>TISCH '+n+'</strong><h3>'+(r?'Vermietet':m?'Partie am Tisch':'Frei')+'</h3>'+(r?rentalRunning(r)+'<button data-rental-finish="'+r.id+'" data-version="'+r.version+'">Vermietung abschließen</button>':m?'<p>'+esc(m.player_a)+' / '+esc(m.player_b)+'</p>':'<p>Für eine neue Vermietung verfügbar</p>')+'</article>';
    }).join('')+'</section><section class="planning"><div class="panel"><h2>Vermietung starten</h2><form id="rental-start" data-version="'+settings.version+'" data-base="'+settings.base_cents+'">'+
    selectField('Tisch','table_no',free[0]??'',free.map(n=>[n,'Tisch '+n]))+field('Rabatt in %','discount',0,'number','min="0" max="100" step="0.01"')+'<p>Grundpreis: '+euro(settings.base_cents)+'/h</p><p id="rental-preview" aria-live="polite"></p><button class="primary" '+(free.length?'':'disabled')+'>Vermietung starten</button></form></div>'+
    '</section>'+
    '<h2>Buchungshistorie</h2>'+rentalPage.controls+'<div class="rental-history"><table><thead><tr><th>Buchung / Tisch</th><th>Start / Ende</th><th>Dauer / Abrechnung</th><th>Preisvereinbarung</th><th>Gesamt / Status</th><th>Aktionen</th></tr></thead><tbody>'+rentalPage.items.map(r=>'<tr><td>#'+r.id+' · Tisch '+r.table_no+'</td><td>'+rentalDate(r.started_at)+'<br>'+rentalDate(r.ended_at)+'</td><td>'+(r.status==='active'?rentalRunning(r):duration(r.duration_ms)+'<br>'+r.billed_minutes+' Minuten')+'</td><td>'+euro(r.hourly_cents)+'/h<br>Grundpreis '+euro(r.base_cents)+'/h<br>'+(r.adjustment_percent===null?'Direktpreis':esc(r.adjustment_percent)+' %')+'</td><td>'+(r.status==='active'?'Laufend':euro(r.total_cents)+'<br>Abgeschlossen')+'</td><td>'+(r.status==='finished'?'<button data-rental-edit="'+r.id+'">Buchung korrigieren</button>':'')+'<button data-rental-delete="'+r.id+'">Buchung löschen</button></td></tr>').join('')+'</tbody></table>'+(rentals.length?'':'<p>Noch keine Buchungen vorhanden.</p>')+'</div>';
  tickRentals(); updateRentalPreview();
}
function updateRentalPreview() {
  const form=root.querySelector('#rental-start'); if(!form)return;
  try { root.querySelector('#rental-preview').textContent='Vereinbarter Stundenpreis: '+euro(hourlyRate(Number(form.dataset.base),'percent',-Number(form.elements.discount.value)))+'/h'; }
  catch(e) { root.querySelector('#rental-preview').textContent=e.message; }
}
root.addEventListener('input',updateRentalPreview);
function handleRentalSubmit(form) {
  if(!['rental-start','rental-settings'].includes(form.id)) return false;
  const data=Object.fromEntries(new FormData(form));
  if(form.id==='rental-settings') {
    const before={...state.rental_settings}, version=Number(form.dataset.version), base_euros=Number(data.base_euros);
    try {
      const rate=hourlyRate(900,'direct',base_euros);
      showWarning({phrase:'GRUNDPREIS ÄNDERN',label:'Grundpreis speichern',summary:'<p>Grundpreis für neue Vermietungen: '+euro(before.base_cents)+' → <strong>'+euro(rate)+'/h</strong></p><p>Bestehende Buchungen behalten ihren vereinbarten Preis.</p>',valid:()=>state.rental_settings.version===version,run:async()=>{await api('/api/rentals/settings',{base_euros,version,action:'rental:settings',confirmation:'GRUNDPREIS ÄNDERN'});drafts.delete(form.id);form.reset();}});
    } catch(error) {message(error.message);}
  } else mutate(async()=>{
    await api('/api/rentals',{table_no:Number(data.table_no),discount:Number(data.discount),settings_version:Number(form.dataset.version)});
    drafts.delete(form.id); form.reset();
  });
  return true;
}
const rentalDialog=document.querySelector('#rental-dialog'), rentalEdit=document.querySelector('#rental-edit'), rentalWarning=document.querySelector('#rental-warning'), rentalConfirmation=document.querySelector('#rental-confirmation'), rentalSave=document.querySelector('#rental-save');
let pendingRental, rentalCorrection;
function localDateInput(time) {
  const date=new Date(time); return new Date(time-date.getTimezoneOffset()*60000).toISOString().slice(0,23);
}
root.addEventListener('click',e=>{
  const button=e.target.closest('button'); if(!button || busy || table)return;
  if(button.dataset.rentalFinish || button.dataset.rentalDelete) {
    const r=state.rentals.find(r=>r.id===Number(button.dataset.rentalFinish || button.dataset.rentalDelete));if(!r)return;
    const snapshot={...r}, valid=()=>state.rentals.find(v=>v.id===snapshot.id)?.version===snapshot.version;
    const identity='<p><strong>Buchung #'+r.id+' · Tisch '+r.table_no+'</strong></p><p>Start: '+rentalDate(r.started_at)+' · Stundenpreis: '+euro(r.hourly_cents)+'</p>';
    if(button.dataset.rentalDelete) {
      showWarning({phrase:'BUCHUNG LÖSCHEN',label:'Buchung löschen',summary:identity+'<p>Diese Buchung einschließlich ihrer Abrechnungsdaten wird aus der Historie gelöscht. '+(r.status==='active'?'Die laufende Vermietung wird entfernt und der Tisch freigegeben.':'Gespeicherter Gesamtbetrag: '+euro(r.total_cents)+'.')+' Die Löschung kann in der Oberfläche nicht rückgängig gemacht werden.</p>',valid,run:()=>api('/api/rentals/'+r.id+'/delete',{version:r.version,action:'rental:delete',confirmation:'BUCHUNG LÖSCHEN'})});
    } else {
      const ended_at=Math.max(r.started_at,Date.now()+clockOffset), price=rentalPrice(r.started_at,ended_at,r.hourly_cents);
      showWarning({phrase:null,label:'Vermietung abschließen',summary:identity+'<p>Endzeitpunkt: '+rentalDate(ended_at)+'<br>Dauer: '+duration(price.duration_ms)+'<br>Abrechnung: '+price.billed_minutes+' Minuten<br>Gesamtbetrag: <strong>'+euro(price.total_cents)+'</strong></p><p>Dieser Endzeitpunkt und Betrag werden gespeichert; der Tisch wird freigegeben. Abbrechen lässt die Vermietung weiterlaufen.</p>',valid,run:()=>api('/api/rentals/'+r.id+'/finish',{version:r.version,ended_at,action:'rental:finish'})});
    }
  }
  if(button.dataset.rentalEdit) {
    const r=state.rentals.find(r=>r.id===Number(button.dataset.rentalEdit)); if(!r)return;
    pendingRental={...r}; rentalCorrection=undefined;
    rentalEdit.hidden=false; rentalWarning.hidden=true; rentalConfirmation.value=''; rentalSave.disabled=true;
    document.querySelector('#rental-error').textContent='';
    document.querySelector('#rental-fields').innerHTML='<p>Buchung #'+r.id+' · Tisch '+r.table_no+'</p>'+field('Startzeit','started_at',localDateInput(r.started_at),'datetime-local','step="0.001"')+field('Endzeit','ended_at',localDateInput(r.ended_at),'datetime-local','step="0.001"')+field('Stundenpreis in €/h','value',r.hourly_cents/100,'number','min="0" max="10000" step="0.01"')+'<label>Rabatt in % (optional)<input name="discount" type="number" min="0" max="100" step="0.01" value="'+(r.adjustment_percent!==null && r.adjustment_percent<=0?-r.adjustment_percent:'')+'"></label>'+'<p>Gespeicherter Grundpreis: '+euro(r.base_cents)+'/h</p>';
    rentalDialog.showModal();
  }
});
rentalEdit.addEventListener('input',e=>{
  const form=rentalEdit;
  if(e.target.name==='value') form.elements.discount.value='';
  if(e.target.name==='discount' && e.target.value!=='' && pendingRental) {
    try {form.elements.value.value=(hourlyRate(pendingRental.base_cents,'percent',-Number(e.target.value))/100).toFixed(2);} catch {}
  }
});
rentalEdit.addEventListener('submit',e=>{
  e.preventDefault(); if(!pendingRental || busy)return;
  try {
    const values=Object.fromEntries(new FormData(rentalEdit)), r=pendingRental;
    const started_at=new Date(values.started_at).getTime(), ended_at=new Date(values.ended_at).getTime();
    if(started_at<0 || ended_at>Date.now()+clockOffset) throw new Error('Zeitangaben dürfen nicht in der Zukunft liegen.');
    values.mode=values.discount===''?'direct':'percent';
    values.value=values.discount===''?Number(values.value):-Number(values.discount);
    const rate=hourlyRate(r.base_cents,values.mode,Number(values.value)), price=rentalPrice(started_at,ended_at,rate);
    rentalCorrection={started_at,ended_at,mode:values.mode,value:Number(values.value),version:r.version,action:'rental:edit'};
    document.querySelector('#rental-summary').innerHTML='<p><strong>Buchung #'+r.id+' · Tisch '+r.table_no+'</strong></p><p>Start: '+rentalDate(r.started_at)+' → '+rentalDate(started_at)+'<br>Ende: '+rentalDate(r.ended_at)+' → '+rentalDate(ended_at)+'<br>Stundenpreis: '+euro(r.hourly_cents)+' → '+euro(rate)+'<br>Anpassung: '+(r.adjustment_percent===null?'Direktpreis':r.adjustment_percent+' %')+' → '+(values.mode==='percent'?esc(values.value)+' %':'Direktpreis')+'<br>Dauer: '+duration(r.duration_ms)+' → '+duration(price.duration_ms)+'<br>Abgerechnete Minuten: '+r.billed_minutes+' → '+price.billed_minutes+'<br>Gesamtpreis: '+euro(r.total_cents)+' → <strong>'+euro(price.total_cents)+'</strong></p>';
    rentalEdit.hidden=true; rentalWarning.hidden=false; rentalConfirmation.value=''; rentalSave.disabled=true;
    document.querySelector('#rental-error').textContent=''; rentalConfirmation.focus();
  }catch(error){document.querySelector('#rental-error').textContent=error.message;}
});
guardConfirmation(rentalConfirmation,()=>{rentalSave.disabled=busy||!rentalCorrection||rentalConfirmation.value!=='BUCHUNG ÄNDERN';});
document.querySelector('#rental-cancel').addEventListener('click',()=>rentalDialog.close());
rentalDialog.addEventListener('close',()=>{pendingRental=undefined;rentalCorrection=undefined;rentalConfirmation.value='';rentalSave.disabled=true;});
rentalSave.addEventListener('click',async()=>{
  if(busy||!pendingRental||!rentalCorrection||rentalConfirmation.value!=='BUCHUNG ÄNDERN')return;
  const id=pendingRental.id, data={...rentalCorrection,confirmation:rentalConfirmation.value};
  busy=true; rentalSave.disabled=true;
  try { await api('/api/rentals/'+id+'/edit',data); rentalDialog.close(); message('Buchung korrigiert und protokolliert.'); }
  catch(error) { document.querySelector('#rental-error').textContent=error.message+' Bitte abbrechen und die Buchung erneut öffnen.'; rentalCorrection=undefined; rentalConfirmation.value=''; }
  finally { busy=false; await refresh(true); }
});


// One immutable action snapshot per warning. Enter never executes an action.
const warningDialog=document.querySelector('#warning-dialog'), warningInput=document.querySelector('#warning-input'), warningSave=document.querySelector('#warning-save');
let pendingWarning;
function guardConfirmation(input, changed) {
  for(const type of ['paste','drop','contextmenu']) input.addEventListener(type,e=>e.preventDefault());
  input.addEventListener('beforeinput',e=>{if(['insertFromPaste','insertFromDrop','insertReplacementText'].includes(e.inputType))e.preventDefault();});
  input.addEventListener('keydown',e=>{if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v')||(e.shiftKey&&e.key==='Insert')||e.key==='Enter')e.preventDefault();});
  input.addEventListener('input',changed);
}
function changeSummary(item,data) {
  const names={name:'Name',kind:'Format',date:'Datum',event_id:'Veranstaltung',player_a:'Spieler A',player_b:'Spieler B',discipline:'Disziplin',target:'Spielziel',first:'Erstes Break',lag_winner:'Ausstoßen',a:'Punkte A',b:'Punkte B',status:'Status',table_no:'Tisch',pin:'Tablet-PIN'};
  const display=(key,value)=>key==='event_id'?state.events.find(e=>e.id===Number(value))?.name??value:key==='status'?labels[value]:value??'–';
  const changes=Object.entries(data).filter(([key,value])=>key==='pin'?value!=='':String(item[key]??'')!==String(value??''));
  return '<p>Folgende Änderungen werden gespeichert:</p><ul>'+changes.map(([key,value])=>'<li>'+esc(names[key]||key)+': '+(key==='pin'?'wird ersetzt':esc(display(key,item[key]))+' → '+esc(display(key,value)))+'</li>').join('')+'</ul>'+(changes.length?'':'<p>Keine Feldänderungen.</p>');
}
function showWarning(pending) {
  pendingWarning=pending; warningInput.value='';warningSave.disabled=!!pending.phrase;
  document.querySelector('#warning-entry').hidden=!pending.phrase;
  warningSave.textContent=pending.label;
  document.querySelector('#warning-summary').innerHTML=pending.summary;
  document.querySelector('#warning-phrase').textContent=pending.phrase || '';
  document.querySelector('#warning-error').textContent='';
  warningDialog.showModal();if(pending.phrase)warningInput.focus();else document.querySelector('#warning-cancel').focus();
}
function checkWarning() {
  if(rentalCorrection && state?.rentals.find(r=>r.id===pendingRental.id)?.version!==pendingRental.version) {
    rentalCorrection=undefined;rentalConfirmation.value='';rentalSave.disabled=true;
    document.querySelector('#rental-error').textContent='Buchung geändert. Bitte abbrechen und erneut öffnen.';
  }
  if(pendingWarning && !pendingWarning.valid()) {
    pendingWarning=undefined;warningInput.value='';warningSave.disabled=true;
    document.querySelector('#warning-error').textContent='Daten wurden geändert. Bitte abbrechen, den aktualisierten Eintrag öffnen und erneut prüfen.';
  }
}
guardConfirmation(warningInput,()=>{checkWarning();warningSave.disabled=busy||!pendingWarning||(pendingWarning.phrase && warningInput.value!==pendingWarning.phrase);});
document.querySelector('#warning-cancel').addEventListener('click',()=>warningDialog.close());
warningDialog.addEventListener('close',()=>{pendingWarning=undefined;warningInput.value='';warningSave.disabled=true;});
warningSave.addEventListener('click',async()=>{
  checkWarning();if(busy||!pendingWarning||(pendingWarning.phrase && warningInput.value!==pendingWarning.phrase))return;
  const pending=pendingWarning;busy=true;warningSave.disabled=true;
  try {await pending.run();warningDialog.close();message('Aktion gespeichert und protokolliert.');}
  catch(error){pendingWarning=undefined;warningInput.value='';document.querySelector('#warning-error').textContent=error.message+' Bitte abbrechen und erneut öffnen.';}
  finally{busy=false;await refresh(true);}
});

await refresh(true);
setInterval(() => { if (!busy) refresh(); }, 3000);

setInterval(tickTimers,1000);

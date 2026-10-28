import { rentalPrice, hourlyRate } from './rental-pricing.js';
const root = document.querySelector('#app'), connection = document.querySelector('#connection');
const table = Number(/^\/tisch\/([1-9]|1[0-9]|20)$/.exec(location.pathname)?.[1]);
if (table) document.body.classList.add('kiosk');
if (table && location.hash) history.replaceState(null, '', location.pathname);
let setupChoice, clockOffset=0;
let csrf = '', state, current, busy = false;
let branding = {club_name:'BSV Pfaffenhofen',primary:'#147eb7',background:'#080c12',surface:'#121e2b',text:'#f1f6fc',version:0}, brandingRevision, pendingLogo;
function applyBranding() {
  document.title=branding.club_name+' · Billardmanager';
  document.querySelector('#club-name').textContent=branding.club_name;
  document.querySelector('#footer-club').textContent=branding.club_name+' · Billardmanager';
  for(const img of document.querySelectorAll('.club-logo,.login-badge img,.waiting-logo')) {
    const source='/api/branding/logo?v='+encodeURIComponent(brandingRevision);
    if(img.getAttribute('src')!==source)img.src=source;
    img.alt=branding.club_name+' · Vereinslogo';
  }
}
const navigation = document.querySelector('#admin-nav');

const views = { planung:['Spieltage planen','Spieltage anlegen und synchronisieren'], spieler: ['Spieler', 'Spieler pflegen und nuLiga-Profile öffnen'], mannschaften: ['Mannschaften', 'Mannschaften und Kader pflegen'], einstellungen: ['Einstellungen', 'Tischanzahl, Vereinsgestaltung, Grundpreis und Admin-Passwort verwalten.'], vermietung: ['Tischvermietung', 'Tische vermieten, minutengenau abrechnen und Buchungen prüfen.'], uebersicht: ['Tischübersicht', 'Alle Tische und laufenden Partien im Blick.'], spieltage: ['Spieltagsverwaltung', 'Veranstaltungen anlegen, Begegnungen planen und Tische zuweisen.'], ergebnisse: ['Ergebnisse', 'Abgeschlossene Partien und ihre gespeicherten Endstände.'] };
let view = Object.hasOwn(views, location.hash.slice(1).split('/')[0]) ? location.hash.slice(1) : 'uebersicht';
let selectedEventId=Number(location.hash.split('/')[1])||null;
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
function saveDrafts() { for (const form of root.querySelectorAll('form')) if (form.id && !['login','tablet-login','admin-password'].includes(form.id)) drafts.set(form.id, [...new FormData(form)].filter(([name])=>!['logo_file','logo_reset'].includes(name))); }
function restoreDrafts() { for (const [id, entries] of drafts) for (const [name, value] of entries) { const field = document.getElementById(id)?.elements.namedItem(name); if (field) field.value = value; } const form=root.querySelector('#match');if(form)updateParticipantOptions(form); }
function finishButton(m) { return '<button data-finish="' + m.id + '" ' + (Math.max(m.a,m.b) < m.target ? 'disabled title="Spielziel noch nicht erreicht"' : 'class="primary"') + '>Spiel abschließen</button>'; }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { planned:'Geplant', live:'Am Tisch', finished:'Abgeschlossen' };
function message(value) { const el = document.querySelector('#message'); el.textContent = value; el.hidden = !value; }
async function api(path, data) {
  const headers = {};
  if (table) headers.Authorization = `Bearer ${sessionStorage.getItem(`tablet-session:${table}`) || ''}`;
  if (data) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf; }
  const res = await fetch(path, { method: data ? 'POST' : 'GET', headers, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(path.startsWith('/api/settings/nuliga')?180000:8000) });
  const result = await res.json();
  if (!res.ok) { const error = new Error(result.error); error.status = res.status; throw error; }
  if(result.server_now) clockOffset=result.server_now-Date.now();
  if(result.match?.server_now) clockOffset=result.match.server_now-Date.now();
  if(result.matches?.[0]?.server_now) clockOffset=result.matches[0].server_now-Date.now();
  return result;
}
function login() {
  state = undefined; adminNavigation(false);
  root.innerHTML = `<section class="login"><div class="login-copy"><p class="eyebrow">WILLKOMMEN IM VEREIN</p><h1>Der nächste Stoß.<br>Alles im Blick.</h1><p>Spieltage organisieren. Begegnungen starten.<br>Spielstände direkt am Tisch erfassen.</p><form id="login"><label>Administrator-Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Anmelden →</button></form><small>Die Tablets öffnen ihre eigene Tisch-Adresse.</small></div><div class="login-badge"><img src="/api/branding/logo" alt="BSV Pfaffenhofen · Vereinslogo seit 1995"></div></section>`;
  connection.textContent = 'Vereinsverwaltung'; connection.className = ''; document.querySelector('#logout').hidden = true;
}
function dashboard() {
  if(view==='planung'){adminNavigation(true);planningDashboard();return;}
  if(view==='spieltage'){adminNavigation(true);matchdayDashboard();return;}
  if(['spieler','mannschaften'].includes(view)) {adminNavigation(true);playersDashboard();return;}
  if(view==='einstellungen') { adminNavigation(true); settingsDashboard(); return; }
  if(view==='vermietung') { adminNavigation(true); rentalDashboard(); return; }
  const live = state.matches.filter(m => m.status === 'live');
  adminNavigation(true);
  const visibleMatches = state.matches.filter(m => view === 'ergebnisse' ? m.status === 'finished' : view === 'spieltage' ? true : m.status === 'live');
  const matchPage = paginate(visibleMatches, 'matches-' + view, views[view][0]);
  const eventPage = view === 'spieltage' ? paginate(state.events, 'events', 'Veranstaltungen') : null;
  root.innerHTML = `<div class="page-title"><div><p class="eyebrow">SPIELBETRIEB</p><h1>${views[view][0]}</h1><p>${views[view][1]}</p></div><span class="pill">${live.length + (state.rentals || []).filter(r=>r.status==='active').length} / ${tableCount()} Tische belegt</span></div>
    <section ${view === 'uebersicht' ? '' : 'hidden'}><div class="section-title"><h2>Unsere Tische</h2><span>Live-Spielstände · alle 3 Sekunden</span></div><section class="tables">${Array.from({length:tableCount()}, (_,i) => {
      const m = live.find(m => m.table_no === i + 1);
      const r = (state.rentals || []).find(r=>r.table_no===i+1 && r.status==='active');
      if(r) return `<a href="/#vermietung" class="table-card occupied"><strong>TISCH ${i+1}</strong><h3>Vermietet</h3>${rentalRunning(r)}<small>Zur Tischvermietung ↗</small></a>`;
      return `<a href="/tisch/${i+1}" class="table-card ${m ? 'occupied' : ''}"><div><strong>TISCH ${String(i+1).padStart(2,'0')}</strong><span class="dot ${m ? 'active' : ''}"></span></div>${m ? `<p>${esc(m.discipline)} · ${m.discipline==='14/1'?'Spielziel':'Race to'} ${m.target}${m.discipline==='14/1'?' Punkte':''}</p><div class="mini-score"><span>${esc(m.player_a)}</span><b>${m.a}</b></div><div class="mini-score"><span>${esc(m.player_b)}</span><b>${m.b}</b></div>${timers(m)}<small>● Break: ${m.discipline==='14/1'?'14/1 Punktewertung':m.setup_done ? esc(m[m.breaker === 'a' ? 'player_a' : 'player_b']) : 'Noch offen'}</small>` : '<div class="free">Bereit für die nächste Partie</div><small>Frei verfügbar ↗</small>'}</a>`;
    }).join('')}</section></section>
    <section class="planning" ${view === 'spieltage' ? '' : 'hidden'}><div class="panel"><p class="eyebrow">01 · VERANSTALTUNG</p><h2>Spieltag anlegen</h2><form id="event"><label>Name<input name="name" maxlength="100" placeholder="z. B. Bezirksliga · 3. Spieltag" required></label><div class="form-row"><label>Format<select name="kind"><option>Liga</option><option>Turnier</option></select></label><label>Datum<input name="date" type="date" required></label></div><button class="primary">Veranstaltung anlegen</button></form></div>
    <div class="panel"><p class="eyebrow">02 · BEGEGNUNG</p><h2>Die nächste Partie</h2><form id="match"><label>Veranstaltung<select name="event_id" required><option value="">Bitte auswählen</option>${state.events.filter(e=>e.status === 'open').map(e => `<option value="${e.id}">${esc(e.date)} · ${esc(e.name)} (${esc(e.kind)})</option>`).join('')}</select></label>${participantSelectors(null)}<div class="form-row"><label>Spieler A<input name="player_a" maxlength="302" required></label><label>Spieler B<input name="player_b" maxlength="302" required></label></div><div class="form-row"><label>Disziplin<select name="discipline"><option>8-Ball</option><option>9-Ball</option><option>10-Ball</option></select></label><label>Gewinnspiele<input name="target" type="number" value="5" min="1" max="999" required></label></div><label>Tablet-PIN (6 Ziffern)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><button class="primary" ${state.events.some(e=>e.status === 'open') ? '' : 'disabled'}>Begegnung planen</button></form></div></section>
    <section ${view === 'spieltage' ? '' : 'hidden'}><div class="section-title"><h2>Veranstaltungen</h2></div>${eventPage?.controls || ''}<div class="event-list">${eventPage ? eventPage.items.map(eventCard).join('') || '<p>Noch keine Veranstaltungen angelegt.</p>' : ''}</div></section><div class="section-title"><h2>${view === 'ergebnisse' ? 'Abgeschlossene Partien' : view === 'spieltage' ? 'Alle Begegnungen' : 'Laufende Partien'}</h2><span>${visibleMatches.length} Partien</span></div>${matchPage.controls}<section id="matches">${matchRows(matchPage.items)}</section>`;
}
function matchRows(matches) {
  return matches.map(m => `<article class="match-row"><div><span class="pill ${m.status === 'live' ? 'green' : ''}">${labels[m.status]}</span><h3>${esc(m.player_a)} <span class="muted">vs.</span> ${esc(m.player_b)}</h3><p>${esc(state.events.find(e => e.id === m.event_id)?.name)} · ${esc(m.discipline)} · Ziel ${m.target}${m.table_no ? ' · Tisch ' + m.table_no : ''}</p></div><strong class="result">${m.a} : ${m.b}</strong>${m.status === 'planned' ? `<form class="start" data-id="${m.id}"><label>Tisch<select name="table_no">${Array.from({length:tableCount()},(_,i) => `<option value="${i+1}">Tisch ${i+1}</option>`).join('')}</select></label><button>Tisch zuweisen ↗</button></form>` : m.status === 'live' ? `<div class="match-actions"><a href="/tisch/${m.table_no}">Punkte bearbeiten ↗</a>${finishButton(m)}${Math.max(m.a,m.b) < m.target ? '<small>Abschluss ab Erreichen des Spielziels</small>' : '<small>Spielziel erreicht · bereit zum Abschluss</small>'}</div>` : ''}${m.pin_set ? '' : '<small>Tablet-PIN fehlt · bitte Partie bearbeiten</small>'}<p>${esc(m.team_a_name||'Ohne Mannschaft')} / ${esc(m.team_b_name||'Ohne Mannschaft')}</p>${timers(m)}${matchAdminActions(m)}</article>`).join('') || '<div class="empty">Keine Partien in dieser Ansicht.</div>';
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
  if (!current) { root.innerHTML = `<div class="waiting"><p class="eyebrow">TISCH ${String(table).padStart(2,'0')}</p><img class="waiting-logo" src="/api/branding/logo" alt="BSV Pfaffenhofen"><h1>Bereit, wenn ihr es seid.</h1><p>Die nächste Begegnung erscheint hier automatisch,<br>sobald sie in der Verwaltung gestartet wird.</p></div>`; return; }
  if(!current.setup_done) { preparation(current); return; }
  const m = current, done = Math.max(m.a,m.b) === m.target;
  root.innerHTML = `<div class="score-heading"><span class="pill">TISCH ${String(table).padStart(2,'0')}</span><p>${esc(m.event_name)}</p><h2>${esc(m.discipline)} <span class="muted">/</span> Race to ${m.target}</h2>${timers(m)}</div><section class="scoreboard">${['a','b'].map(side => `<article class="player ${m.breaker === side && !done ? 'breaking' : ''}"><div class="break-label">${m.breaker === side && !done ? '● NÄCHSTES BREAK' : '&nbsp;'}</div><h1>${esc(m[side === 'a' ? 'player_a' : 'player_b'])}</h1><div class="points">${m[side]}</div><div class="score-controls"><button data-side="${side}" data-delta="-1" aria-label="Punkt bei Spieler ${side.toUpperCase()} zurücknehmen" ${m[side] === 0 || busy ? 'disabled' : ''}>−</button><button class="primary" data-side="${side}" data-delta="1" ${done || busy ? 'disabled' : ''}>+ Punkt</button></div></article>`).join('')}</section><p class="score-note">${done ? 'Spielziel erreicht · Endstand prüfen und Spiel abschließen.' : m.discipline==='14/1'?'14/1 · Punktewertung bis zum eingestellten Spielziel.':'Wechselbreak · Nach jedem abgeschlossenen Rack wechselt das Anstoßrecht.'}</p><div class="finish-bar">${finishButton(m)}${!done ? '<small>Verfügbar, sobald das Spielziel erreicht ist.</small>' : ''}</div>`;
}
async function refresh(initial = false) {
  try {
    const nextBranding=await api('/api/branding');
    const revision=JSON.stringify(nextBranding);
    if(revision!==brandingRevision) {
      branding=nextBranding;brandingRevision=revision;
      document.querySelector('#branding-style').href='/branding.css?v='+encodeURIComponent(revision);
      applyBranding();
    }
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
  applyBranding();
}
async function mutate(fn) {
  if (busy) return; busy = true; message(''); root.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await fn(); } catch(e) { message(e.message || 'Verbindung fehlgeschlagen. Bitte den aktuellen Spielstand prüfen.'); }
  finally { busy = false; await refresh(true); }
}
root.addEventListener('submit', e => {
  e.preventDefault(); if(handlePlayersSubmit(e.target))return; if(handleBrandingSubmit(e.target)) return; if(handlePasswordSubmit(e.target)) return; if(handleRentalSubmit(e.target)) return; const form = e.target, data = Object.fromEntries(new FormData(form));
  mutate(async () => {
    if(form.id.startsWith('league-slot-')){const payload={...data,version:Number(form.dataset.version),table_no:data.table_no?Number(data.table_no):null,target:data.target?Number(data.target):null,start:e.submitter?.value==='start'};await api('/api/events/'+form.dataset.event+'/slots/'+form.dataset.slot,payload);drafts.delete(form.id);message(payload.start?'Partie dem Tisch zugewiesen.':'Aufstellung gespeichert.');}
    if(form.id==='nuliga-schedule-sync'){message('Spieltage werden abgerufen …');const result=await api('/api/settings/nuliga-schedule',{});message(result.created+' Spieltage neu angelegt, '+result.updated+' aktualisiert, '+result.removed+' Auswärtsspieltage entfernt. Alle neuen Spieltage sind geplant.');}
    if (form.id === 'nuliga-sync') { message('nuLiga wird abgerufen …'); const result=await api('/api/settings/nuliga',{overwrite:data.overwrite==='yes'}); drafts.delete(form.id); message('Synchronisiert: '+result.teams+' Mannschaften und '+result.players+' Spieler. '+result.created+' neu, '+result.updated+' aktualisiert; '+result.preserved+' lokale Anpassungen erhalten.'); }
    if (form.id === 'table-settings') { await api('/api/settings/tables',{table_count:Number(data.table_count),version:Number(data.version)}); drafts.delete(form.id); form.remove(); message('Tischanzahl gespeichert.'); }
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
  if(button.dataset.eventStart&&!busy){const event=state.events.find(e=>e.id===Number(button.dataset.eventStart));if(event.kind==='Liga'){openParticipants(event,true);return;}mutate(async()=>{await api('/api/events/'+event.id+'/start',{version:event.version});selectedEventId=event.id;drafts.delete('match');view='spieltage';history.replaceState(null,'','/#spieltage/'+event.id);});return;}
  if(button.id==='table-settings-reload') { mutate(async()=>{drafts.delete('table-settings');root.querySelector('#table-settings')?.remove();}); return; }
  if(button.dataset.lag && current && !busy) { setupChoice={id:current.id,version:current.version,lag:button.dataset.lag}; preparation(current); }
  if(button.hasAttribute('data-setup-back') && current && !busy) { setupChoice=undefined; preparation(current); }
  if(button.dataset.begin && current && setupChoice?.lag && !busy) { const m=current; mutate(()=>api(`/api/matches/${m.id}/begin`,{lag_winner:setupChoice.lag,first:button.dataset.begin,version:m.version})); }
  if (button.dataset.side && current) { const m = current; mutate(() => api(`/api/matches/${m.id}/score`, { side:button.dataset.side, delta:Number(button.dataset.delta), version:m.version })); }
  if (button.dataset.finish && !busy) {
    const m = table ? current : state.matches.find(m => m.id === Number(button.dataset.finish));
    if (!m) return;
    showWarning({phrase:null, label:'OK', delayMs:5000, summary:'<p>'+esc(m.player_a)+' '+m.a+' : '+m.b+' '+esc(m.player_b)+'</p><p>Der Endstand wird gespeichert und der Tisch freigegeben. Bitte prüfen: OK wird nach fünf Sekunden freigegeben.</p>', valid:()=> (table?current:state.matches.find(v=>v.id===m.id))?.version===m.version, run:()=>api('/api/matches/'+m.id+'/finish',{version:m.version,action:'match:finish',confirmation:'SPIEL ABSCHLIESSEN'})});
  }
});
window.addEventListener('hashchange', () => {
  if (table) return;
  saveDrafts(); const previousEventId=selectedEventId; view = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'uebersicht';
  selectedEventId=Number(location.hash.split('/')[1])||null;
  if(previousEventId!==selectedEventId)drafts.delete('match');
  if (state) { dashboard(); restoreDrafts(); }
});
document.querySelector('#logout').addEventListener('click', () => mutate(() => api('/api/logout', {})));


const adminDialog = document.querySelector('#admin-dialog');
let pendingAdmin;
function scheduleSyncForm() {
  const sync=state.nuliga_schedule;
  return '<h2>nuLiga-Spieltage synchronisieren</h2><p>Übernimmt kommende Heimspiele der BSV-Mannschaften als geplante Spieltage. Einzelpartien und Tische werden erst nach dem manuellen Start zugewiesen.</p><p>'+(sync?'Letzter Abgleich: '+esc(new Date(sync.synced_at).toLocaleString('de-DE'))+' · '+sync.found+' kommende Spieltage.':'Noch kein Spieltagsabgleich.')+'</p><form id="nuliga-schedule-sync"><button>Jetzt Spieltage synchronisieren</button></form>';
}
function planningDashboard() {
  const planned=state.events.filter(e=>e.phase==='planned').sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  const page=paginate(planned,'planned-events','Geplante Spieltage');
  root.innerHTML='<div class="page-title"><h1>Spieltage planen</h1></div><section class="planning"><div class="panel"><h2>Spieltag anlegen</h2><form id="event">'+field('Name','name','','text','maxlength="100"')+selectField('Format','kind','Liga',[['Liga','Liga'],['Turnier','Turnier']])+field('Datum','date','','date')+'<p>Der Spieltag bleibt bis zum manuellen Start geplant.</p><button class="primary">Spieltag anlegen</button></form></div><div class="panel"><h2>nuLiga-Import</h2><p>Spieler, Mannschaften und Heimspieltage unter <a href="/#einstellungen">Einstellungen · nuLiga</a> synchronisieren.</p></div></section><section><h2>Geplante Spieltage</h2>'+page.controls+page.items.map(eventCard).join('')+'</section>';
}
function matchdayDashboard() {
  const events=state.events.filter(e=>e.phase!=='planned');
  const selected=events.find(e=>e.id===selectedEventId);
  const eventPage=paginate(events,'events','Spieltage');
  const matches=state.matches.filter(m=>!selected||m.event_id===selected.id);
  const page=paginate(matches,'matches-spieltage','Partien');
  root.innerHTML='<div class="page-title"><div><h1>'+(selected?esc(selected.name):'Spieltagsübersicht')+'</h1><p>'+(selected?esc(selected.date):'Gestarteten Spieltag öffnen oder einen Spieltag unter „Spieltage planen“ anlegen und starten.')+'</p></div></div>';
  if(!selected) {root.innerHTML+='<section><h2>Spieltage</h2>'+eventPage.controls+eventPage.items.map(eventCard).join('')+'</section>';}
  else {
    root.innerHTML+='<p><a href="/#spieltage">Alle Spieltage</a></p>'+eventCard(selected);
    root.innerHTML+=leagueBoard(selected);
  }
  const linked=new Set((state.event_match_slots||[]).filter(s=>s.event_id===selected?.id).map(s=>s.match_id));
  const additional=matches.filter(m=>!linked.has(m.id));
  if(!selected||additional.length)root.innerHTML+='<section><h2>'+(selected?'Weitere Partien':'Partien')+'</h2>'+(!selected?page.controls:'')+matchRows(selected?additional:page.items)+'</section>';
}
function leagueBoard(event) {
  const format=['8-Ball','9-Ball','10-Ball','14/1','9-Ball','10-Ball','8-Ball','9-Ball','10-Ball','14/1'];
  const teams=state.event_teams.filter(t=>t.event_id===event.id).map(t=>state.teams.find(team=>team.id===t.team_id)).filter(Boolean);
  const participants=state.event_players.filter(p=>p.event_id===event.id);
  const existing=(state.event_match_slots||[]).find(s=>s.event_id===event.id&&s.player_a_id);
  const firstTeam=teams.find(t=>event.schedule?.home_source_id&&t.nuliga_profile?.endsWith('teamtable='+event.schedule.home_source_id))?.id||teams.find(t=>t.name===event.schedule?.home)?.id||participants.find(p=>p.player_id===existing?.player_a_id)?.team_id;
  teams.sort((a,b)=>Number(b.id===firstTeam)-Number(a.id===firstTeam)||Number(/^BSV Pfaffenhofen/.test(b.name))-Number(/^BSV Pfaffenhofen/.test(a.name)));
  const choose=(label,name,id,side)=>selectField(label,name,id||'',[['','Spieler auswählen'],...state.players.filter(p=>participants.some(ep=>ep.player_id===p.id&&(!teams[side]||ep.team_id===teams[side].id))&&(p.active||p.id===id)).map(p=>[p.id,fullName(p)])]);
  let html='<section class="league-board"><h2>Spielplan · 10 Partien</h2><p>Aufstellungen und Tischwünsche speichern. „Partie starten“ belegt den Tisch; die Zeitmessung beginnt nach der Vorbereitung am Tablet. Spielziele vor dem Start eintragen.</p>';
  for(const [round,title] of [[1,'1. Runde · Vier Einzel'],[2,'2. Runde · Zwei Doppel'],[3,'3. Runde · Vier Einzel']]) {
    html+='<section class="league-round"><h3>'+title+'</h3>';
    for(let i=0;i<10;i++) {
      const doubles=i===4||i===5;if((i<4?1:i<6?2:3)!==round)continue;
      const slot=(state.event_match_slots||[]).find(s=>s.event_id===event.id&&s.slot===i+1)||{version:0};
      const match=state.matches.find(m=>m.id===slot.match_id),locked=!!match||event.status==='closed';
      const occupied=n=>state.matches.some(m=>m.status==='live'&&m.table_no===n&&m.id!==slot.match_id)||(state.rentals||[]).some(r=>r.status==='active'&&r.table_no===n);
      html+='<article class="panel league-partie"><div class="section-title"><h4>'+(i+1)+'. '+(doubles?'Doppel':'Einzel')+' · '+format[i]+'</h4><span class="pill">'+(match?labels[match.status]:'Aufstellung offen')+'</span></div><form id="league-slot-'+event.id+'-'+(i+1)+'" data-event="'+event.id+'" data-slot="'+(i+1)+'" data-version="'+slot.version+'"><fieldset '+(locked?'disabled':'')+'><div class="league-lineup"><div><h5>'+'Heim · '+esc(teams[0]?.name||'Mannschaft 1')+'</h5>'+choose('Spieler 1','player_a_id',slot.player_a_id,0)+(doubles?choose('Spieler 2','player_a2_id',slot.player_a2_id,0):'')+'</div><div><h5>'+'Gast · '+esc(teams[1]?.name||'Mannschaft 2')+'</h5>'+choose('Spieler 1','player_b_id',slot.player_b_id,1)+(doubles?choose('Spieler 2','player_b2_id',slot.player_b2_id,1):'')+'</div><div>'+selectField('Tisch','table_no',slot.table_no??'',[['','Tisch auswählen'],...Array.from({length:tableCount()},(_,n)=>[n+1,'Tisch '+(n+1)+(occupied(n+1)?' · belegt':'')])])+'<label>Spielziel ('+(format[i]==='14/1'?'Punkte':'Gewinnspiele')+')<input name="target" type="number" min="1" max="'+(format[i]==='14/1'?999:99)+'" value="'+(slot.target??'')+'"></label>'+(locked?'':'<label>Tablet-PIN zum Starten<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off"></label>')+'</div></div></fieldset>'+(locked?'':'<div class="dialog-actions"><button type="submit" value="save">Aufstellung speichern</button><button type="submit" value="start" class="primary">Partie starten</button></div>')+'</form>';
      if(match)html+='<p class="league-score">'+esc(match.player_a)+' <strong>'+match.a+' : '+match.b+'</strong> '+esc(match.player_b)+'</p>'+timers(match)+(match.status==='live'?'<a class="button" href="/tisch/'+match.table_no+'">Tisch öffnen ↗</a>'+finishButton(match):'')+matchAdminActions(match);
      html+='</article>';
    }
    html+='</section>';
  }
  return html+'</section>';
}
function eventCard(event) {
  const matches=state.matches.filter(m=>m.event_id===event.id), closed=event.status==='closed';
  if(event.phase==='planned')return '<article class="event-card"><span class="pill">Geplant · '+esc(event.kind)+'</span><h3>'+esc(event.name)+'</h3><p>'+esc(event.date)+(event.schedule?' · '+esc(event.schedule.time)+' · '+esc(event.schedule.league):'')+'</p><div class="entity-actions"><button class="primary" data-event-start="'+event.id+'">Spieltag starten</button><button data-entity="event" data-action="edit" data-id="'+event.id+'">Spieltag bearbeiten</button><button data-entity="event" data-action="delete" data-id="'+event.id+'">Spieltag löschen</button></div></article>';
  return `<article class="event-card"><span class="pill">${esc(event.kind)} · ${closed?'Gesamtabschluss':'Offen'}</span><h3><a href="/#spieltage/${event.id}">${esc(event.name)}</a></h3><p>${esc(event.date)}${event.schedule?' · '+esc(event.schedule.time)+' · '+esc(event.schedule.league):''} · ${matches.length} Partien</p>${`<div class="entity-actions"><button data-entity="event" data-action="edit" data-id="${event.id}">Veranstaltung bearbeiten</button><button data-entity="event" data-action="delete" data-id="${event.id}">Veranstaltung löschen</button>${closed?'':`<button class="primary" data-entity="event" data-action="close" data-id="${event.id}">Veranstaltung abschließen</button>`}</div>${closed?'':'<button data-participants="'+event.id+'">Teilnehmer & Mannschaften</button>'}<small>${matches.filter(m=>m.status!=='finished').length} Partien noch nicht abgeschlossen</small>`}</article>`;
}
function matchAdminActions(m) {
  return `<div class="entity-actions"><button data-entity="match" data-action="edit" data-id="${m.id}">Partie bearbeiten</button><button data-entity="match" data-action="delete" data-id="${m.id}">Partie löschen</button></div>`;
}
function field(label,name,value,type='text',extra='') {
  return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+' required></label>';
}
function selectField(label,name,value,options) {
  return '<label>'+label+'<select name="'+esc(name)+'">'+options.map(([v,l])=>'<option value="'+esc(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
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
    content=participantSelectors(item)+'<p>Abgeschlossene Partien sind nach Warnbestätigung korrigierbar. Nach Gesamtabschluss bleiben Status und Veranstaltungszuordnung erhalten.</p>'+selectField('Veranstaltung','event_id',item.event_id,state.events.filter(e=>e.id===item.event_id || (state.events.find(v=>v.id===item.event_id)?.status==='open' && e.status==='open')).map(e=>[e.id,e.name]))+
      '<div class="form-row">'+field('Spieler A','player_a',item.player_a,'text','maxlength="302"')+field('Spieler B','player_b',item.player_b,'text','maxlength="302"')+'</div>'+
      '<div class="form-row">'+selectField('Disziplin','discipline',item.discipline,['8-Ball','9-Ball','10-Ball','14/1'].map(v=>[v,v]))+selectField('Gewinner Ausstoßen','lag_winner',item.lag_winner??'',[['','Noch nicht erfasst'],['a',item.player_a],['b',item.player_b]])+field(item.discipline==='14/1'?'Spielziel (Punkte)':'Gewinnspiele','target',item.target,'number','min="1" max="999"')+selectField('Erstes Break','first',item.first,[['a','Spieler A'],['b','Spieler B']])+'</div>'+
      '<div class="form-row">'+field('Punkte A','a',item.a,'number','min="0" max="99"')+field('Punkte B','b',item.b,'number','min="0" max="99"')+'</div>'+
      '<div class="form-row">'+selectField('Status','status',item.status,state.events.find(e=>e.id===item.event_id)?.status==='closed'?[['finished','Abgeschlossen']]:Object.entries(labels))+selectField('Tisch','table_no',item.table_no??'',[['','Kein Tisch'],...Array.from({length:Math.max(tableCount(),item.table_no || 0)},(_,i)=>[i+1,'Tisch '+(i+1)])])+'</div>'+
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

root.addEventListener('input',e=>{
  const key=e.target.dataset.brandingColor || e.target.dataset.brandingHex;
  if(!['primary','background','surface','text'].includes(key))return;
  const form=e.target.closest('#club-branding');if(!form)return;
  if(e.target.dataset.brandingColor)form.elements.namedItem(key).value=e.target.value;
  else if(/^#[0-9a-f]{6}$/i.test(e.target.value))form.elements.namedItem(key+'_picker').value=e.target.value.toLowerCase();
});
function brandingForm() {
  return '<section class="panel branding-panel"><h2>Vereinsgestaltung</h2><p>Vereinsname, Logo und Farben gelten für Anmeldung, Verwaltung und alle Tisch-Tablets.</p><form id="club-branding" data-version="'+branding.version+'"><input type="hidden" name="version" value="'+branding.version+'">'+field('Vereinsname','club_name',branding.club_name,'text','maxlength="80" required')+'<div class="branding-colors">'+[['primary','Akzentfarbe'],['background','Hintergrund'],['surface','Flächen'],['text','Textfarbe']].map(([key,label])=>'<div class="branding-color">'+field(label,key+'_picker',branding[key],'color','data-branding-color="'+key+'"')+field(label+' (Hex-Code)',key,branding[key],'text','data-branding-hex="'+key+'" pattern="#[0-9a-fA-F]{6}" minlength="7" maxlength="7" placeholder="#147eb7" title="Hex-Farbcode mit # und sechs Ziffern oder Buchstaben A–F, zum Beispiel #147eb7" autocomplete="off" spellcheck="false" required')+'</div>').join('')+'</div><p>Text benötigt mindestens 4,5:1 Kontrast zu Hintergrund und Flächen.</p><img class="branding-logo" src="/api/branding/logo" alt="Aktuelles Vereinslogo"><label>Neues Logo (PNG oder JPEG, maximal 1 MiB)<input name="logo_file" id="club-logo-file" type="file" accept="image/png,image/jpeg"></label><p id="logo-selection">'+(pendingLogo===null?'Standardlogo wird wiederhergestellt.':pendingLogo?'Neues Logo ausgewählt. Zum Übernehmen speichern.':'Ohne neue Auswahl bleibt das aktuelle Logo erhalten.')+'</p><button type="button" id="club-logo-reset">Standardlogo verwenden</button><p>Das Standardlogo gehört dem BSV Pfaffenhofen. Für einen anderen Verein bitte ein eigenes Logo hochladen.</p><button class="primary">Vereinsgestaltung speichern</button> <button type="button" id="club-branding-reload">Änderungen verwerfen / Neu laden</button></form></section>';
}
root.addEventListener('change',async e=>{
  if(e.target.id!=='club-logo-file' || busy)return;
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>1024*1024 || !['image/png','image/jpeg'].includes(file.type)) {message('Bitte PNG oder JPEG bis maximal 1 MiB auswählen.');e.target.value='';return;}
  busy=true;
  try {
    pendingLogo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Das Logo konnte nicht gelesen werden.'));reader.readAsDataURL(file);});
    document.querySelector('#logo-selection').textContent=file.name+' ausgewählt. Zum Übernehmen speichern.';
  } catch(error) {message(error.message);} finally {busy=false;}
});
root.addEventListener('click',e=>{
  if(e.target.id==='club-branding-reload' && !busy) {pendingLogo=undefined;drafts.delete('club-branding');e.target.closest('form').remove();refresh(true);return;}
  if(e.target.id!=='club-logo-reset' || busy)return;
  pendingLogo=null;document.querySelector('#club-logo-file').value='';
  document.querySelector('#logo-selection').textContent='Standardlogo wird beim Speichern wiederhergestellt.';
});
function handleBrandingSubmit(form) {
  if(form.id!=='club-branding')return false;
  const data=Object.fromEntries(new FormData(form));delete data.logo_file;
  for(const key of ['primary','background','surface','text'])delete data[key+'_picker'];
  mutate(async()=>{
    await api('/api/settings/branding',{...data,version:Number(data.version),...(pendingLogo===undefined?{}:{logo:pendingLogo})});
    pendingLogo=undefined;drafts.delete(form.id);form.remove();message('Vereinsgestaltung gespeichert.');
  });
  return true;
}
function tableCount() { return state?.table_settings?.table_count ?? 8; }
function settingsDashboard() {
  const settings=state.rental_settings, tables=state.table_settings||{table_count:8,version:0},sync=state.nuliga;
  let html='<div class="page-title"><div><h1>Einstellungen</h1><p>Verein, Spielbetrieb, nuLiga, Sicherheit und Datensicherung verwalten.</p></div></div>';
  html += '<section class="settings-stack">'+brandingForm();
  html += '<section class="panel"><h2>Tischanzahl</h2><form id="table-settings" data-version="'+tables.version+'"><input type="hidden" name="version" value="'+tables.version+'">'+field('Anzahl der Tische','table_count',tables.table_count,'number','min="1" max="20" step="1" required')+'<p>1 bis 20 Tische. Belegte Tische müssen vor einer Verringerung abgeschlossen werden. Historische Partien und Buchungen bleiben erhalten.</p><button>Tischanzahl speichern</button> <button type="button" id="table-settings-reload">Änderungen verwerfen / Neu laden</button></form></section>';
  html += '<div class="panel"><h2>Grundpreis</h2><form id="rental-settings" data-version="'+settings.version+'">'+field('Grundpreis in €/h','base_euros',settings.base_cents/100,'number','min="0" max="10000" step="0.01"')+'<p>Gilt für neue Buchungen. Bestehende Buchungen behalten ihren vereinbarten Preis.</p><button>Grundpreis speichern</button></form></div>';
  html += '<section class="panel"><h2>nuLiga · Spieler und Mannschaften</h2><p>Importiert alle aktuellen Mannschaften des BSV Pfaffenhofen sowie alle Mannschaften und gemeldeten Spieler ihrer Ligen von <a href="https://bbv-billard.liga.nu/" target="_blank" rel="noopener">nuLiga Bayern</a>.</p><p>'+ (sync?'Letzter erfolgreicher Abgleich: '+esc(new Date(sync.synced_at).toLocaleString('de-DE'))+' · '+sync.teams+' Mannschaften · '+sync.players+' Spieler.<br>'+sync.leagues.map(l=>esc(l.championship+' · '+l.name)).join('<br>'):'Noch kein Abgleich durchgeführt.')+'</p><form id="nuliga-sync">'+selectField('Umgang mit lokalen Änderungen','overwrite','no',[['no','Lokale Änderungen erhalten'],['yes','Importierte Namen und Kader mit nuLiga überschreiben']])+'<p>Manuell angelegte Einträge bleiben erhalten. Importierte Spieler und Mannschaften können in den Listen Spieler und Mannschaften bearbeitet werden. Gespeicherte Partien behalten ihre Namen und Zuordnungen. Nicht mehr gelieferte Einträge bleiben erhalten. Der Abruf kann einige Minuten dauern.</p><button class="primary">Jetzt synchronisieren</button></form></section>';
  html += '<section class="panel">'+scheduleSyncForm()+'</section>';
  html += '<div class="panel"><h2>Admin-Passwort ändern</h2><form id="admin-password">'+field('Aktuelles Passwort','current_password','','password','autocomplete="current-password"')+field('Neues Passwort','new_password','','password','autocomplete="new-password" minlength="12" maxlength="128"')+field('Neues Passwort wiederholen','repeat_password','','password','autocomplete="new-password" minlength="12" maxlength="128"')+'<p>12 bis 128 Zeichen. Nach dem Wechsel werden alle Admin-Sitzungen abgemeldet. Bitte anschließend mit dem neuen Passwort anmelden.</p><button>Passwort ändern</button></form></div>';
  html += '<section class="panel"><h2>Datensicherung</h2><p>Alle Spieltage, Partien, Spielstände, Vermietungen, Einstellungen und das Änderungsprotokoll als JSON-Datei sichern. Enthält auch Passwort- und PIN-Hashes: Die Datei vertraulich und außerhalb dieses Rechners aufbewahren.</p><p><a class="button" href="/api/backups/export" download>Sicherung herunterladen</a></p><h3>Sicherung wiederherstellen</h3><p>Ersetzt sämtliche vorhandenen Anwendungsdaten. Zuerst eine aktuelle Sicherung herunterladen. Anschließend gilt das Admin-Passwort aus der Sicherung; alle Admin- und Tablet-Sitzungen werden abgemeldet. Laufende Zeitmessungen werden ab ihrem gespeicherten Start weitergerechnet.</p><label>Sicherungsdatei auswählen (maximal 50 MiB)<input id="backup-file" type="file" accept=".json,application/json"></label><p>Die Datei wird zuerst geprüft. Erst die anschließende Bestätigung ersetzt Daten. Serveradresse, HTTPS-Zertifikate und Installationsdateien werden separat gesichert; Hinweise stehen in der README.</p></section>';
  html += '</section>';
  root.innerHTML=html;
}
root.addEventListener('change', async e => {
  if(e.target.id !== 'backup-file' || busy) return;
  const file = e.target.files?.[0]; if(!file) return;
  busy = true;
  try {
    if(file.size > 50*1024*1024) throw new Error('Die Sicherungsdatei darf höchstens 50 MiB groß sein.');
    const backup = JSON.parse(await file.text());
    const summary = await api('/api/backups/preview', {backup});
    showWarning({phrase:'DATEN WIEDERHERSTELLEN',label:'Vorhandene Daten ersetzen',success:'Sicherung wiederhergestellt. Bitte mit dem Admin-Passwort aus der Sicherung anmelden.',summary:'<p><strong>Alle vorhandenen Anwendungsdaten werden ersetzt.</strong></p><p>Datei: '+esc(file.name)+' · Sicherungsstand: '+esc(new Date(summary.created_at).toLocaleString('de-DE'))+'</p><p>'+summary.events+' Spieltage, '+summary.matches+' Partien, '+summary.rentals+' Vermietungen; davon '+summary.active+' laufende Partien/Vermietungen.</p><p>Das damalige Admin-Passwort gilt wieder. Alle Sitzungen werden abgemeldet. Laufende Zeitmessungen rechnen die Zeit seit dem gespeicherten Start mit.</p>',valid:()=>true,run:async()=>{
      await api('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'});
      drafts.clear();listPages.clear();csrf='';state=undefined;
    }});
  } catch(error) { message(error instanceof SyntaxError ? 'Die Datei enthält kein gültiges JSON.' : error.message); }
  finally {busy=false;e.target.value='';}
});
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
  const free=Array.from({length:tableCount()},(_,i)=>i+1).filter(n=>!rentals.some(r=>r.table_no===n&&r.status==='active')&&!state.matches.some(m=>m.table_no===n&&m.status==='live'));
  root.innerHTML='<div class="page-title"><div><p class="eyebrow">TISCHVERMIETUNG</p><h1>Tischvermietung</h1><p>Angefangene Minuten werden aufgerundet. Vereinbarte Preise bleiben gespeichert.</p></div><span class="pill">'+free.length+' / '+tableCount()+' Tische frei</span></div>'+
    '<section class="tables">'+Array.from({length:tableCount()},(_,i)=>{
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



function fullName(p) {return [p.first_name,p.second_name,p.last_name].filter(Boolean).join(' ');}
function multiSelect(label,name,items,selected=[]) {return '<label>'+label+'<select multiple size="6" name="'+name+'">'+items.map(([id,title])=>'<option value="'+esc(id)+'" '+(selected.includes(id)?'selected':'')+'>'+esc(title)+'</option>').join('')+'</select></label>';}
function participantLabel(p,eventId) { const ep=state.event_players.find(ep=>ep.player_id===p.id&&ep.event_id===eventId); const team=state.teams.find(t=>t.id===ep?.team_id); return fullName(p)+(team?' · '+team.name:''); }
function participantSelectors(m) {
  return '<p>Stammdatenzuordnung ausdrücklich auswählen. Ohne Zuordnung bleiben freie Namen möglich.</p><div class="form-row">'+['a','b'].map(side=>selectField('Teilnehmer '+side.toUpperCase(),'player_'+side+'_id',m?.['player_'+side+'_id']??'',[['','Ohne Stammdatenzuordnung'],...(state.players||[]).filter(p=>p.id===m?.['player_'+side+'_id'] || (p.active && (state.event_players||[]).some(ep=>ep.player_id===p.id && (!m || ep.event_id===m.event_id)))).map(p=>[p.id,participantLabel(p,m?.event_id)])])).join('')+'</div>';
}
function updateParticipantOptions(form) {
  const eventId=Number(form.elements.event_id.value);
  for(const side of ['a','b']) {
    const select=form.elements['player_'+side+'_id'];if(!select)continue;
    const previous=select.value;
    select.innerHTML='<option value="">Ohne Stammdatenzuordnung</option>'+(state.players||[]).filter(p=>p.active && state.event_players.some(ep=>ep.player_id===p.id&&ep.event_id===eventId)).map(p=>'<option value="'+esc(p.id)+'">'+esc(participantLabel(p,eventId))+'</option>').join('');
    select.value=[...select.options].some(o=>o.value===previous)?previous:'';
  }
}
root.addEventListener('change',e=>{
  const form=e.target.closest?.('form');if(!form)return;
  if(form.id==='match' && e.target.name==='event_id')updateParticipantOptions(form);
  if(/^player_[ab]_id$/.test(e.target.name) && e.target.value) {
    const p=state.players.find(p=>p.id===e.target.value),nameField=form.elements[e.target.name.replace('_id','')];if(nameField)nameField.value=fullName(p);
  }
});
let playerSearch='',statsFilter={kind:'players',id:'',from:'',to:'',discipline:''};
function playersDashboard() {
  const players=(state.players||[]).filter(p=>!p.event_id), teams=state.teams||[], q=playerSearch.toLocaleLowerCase('de');
  const page=paginate(players.filter(p=>(fullName(p)+' '+p.id+' '+state.team_players.filter(tp=>tp.player_id===p.id).map(tp=>teams.find(t=>t.id===tp.team_id)?.name||'').join(' ')).toLocaleLowerCase('de').includes(q)).sort((a,b)=>fullName(a).localeCompare(fullName(b),'de')),'players','Spieler');
  const teamPage=paginate([...teams].sort((a,b)=>a.name.localeCompare(b.name,'de')),'teams','Mannschaften');
  const f=statsFilter, entity=(f.kind==='players'?players:teams).find(x=>x.id===f.id);
  const belongs=(m,side)=>f.kind==='players'?[m['player_'+side+'_id'],(state.event_match_slots||[]).find(s=>s.match_id===m.id)?.['player_'+side+'2_id']].includes(f.id):m['team_'+side+'_id']===f.id;
  const matches=state.matches.filter(m=>f.id&&['a','b'].some(side=>belongs(m,side)));
  const filtered=matches.filter(m=>{const date=state.events.find(e=>e.id===m.event_id)?.date;return (!f.from||date>=f.from)&&(!f.to||date<=f.to)&&(!f.discipline||m.discipline===f.discipline);});
  let wins=0,losses=0,won=0,lost=0,count=0;
  for(const m of filtered.filter(m=>m.status==='finished'))for(const side of ['a','b'])if(belongs(m,side)){const other=side==='a'?'b':'a';count++;wins+=Number(m[side]>m[other]);losses+=Number(m[side]<m[other]);won+=m[side];lost+=m[other];}
  const mp=paginate(filtered,'player-matches','Zugeordnete Partien');
  const teamView=view==='mannschaften';
  const playerRows=page.items.map(p=>{
    const memberships=state.team_players.filter(tp=>tp.player_id===p.id).map(tp=>teams.find(t=>t.id===tp.team_id)?.name).filter(Boolean);
    const profile=p.nuliga_profile?'<a class="button" href="'+esc(p.nuliga_profile)+'" target="_blank" rel="noopener noreferrer">nuLiga-Profil ↗</a>':'<span class="muted">Kein nuLiga-Profil zugeordnet</span>';
    return '<tr><th scope="row">'+esc(fullName(p))+'</th><td>'+memberships.map(esc).join(', ')+'</td><td>'+(p.active?'Aktiv':'Archiviert')+'</td><td class="registry-actions"><button data-registry="player" data-id="'+esc(p.id)+'">Bearbeiten</button> '+(p.is_bsv?'<button data-stat="players" data-id="'+esc(p.id)+'">Partien &amp; Statistik</button> ':'')+profile+'</td></tr>';
  }).join('');
  const teamRows=teamPage.items.map(t=>'<tr><th scope="row">'+esc(t.name)+'</th><td>'+state.team_players.filter(tp=>tp.team_id===t.id).map(tp=>esc(fullName(players.find(p=>p.id===tp.player_id)))).join(', ')+'</td><td>'+(t.active?'Aktiv':'Archiviert')+'</td><td class="registry-actions"><button data-registry="team" data-id="'+esc(t.id)+'">Bearbeiten</button> '+(t.nuliga_profile?'<a class="button" href="'+esc(t.nuliga_profile)+'" target="_blank" rel="noopener noreferrer">nuLiga-Mannschaft ↗</a>':'<span class="muted">Kein nuLiga-Profil zugeordnet</span>')+'</td></tr>').join('');
  root.innerHTML='<div class="page-title"><h1>'+(teamView?'Mannschaften':'Spieler')+'</h1></div><section class="panel"><button data-registry="'+(teamView?'team':'player')+'">'+(teamView?'Mannschaft':'Spieler')+' anlegen</button>'+(teamView?'':'<form id="player-search"><label>Spieler suchen (Name, Mannschaft oder ID)<input name="q" value="'+esc(playerSearch)+'"></label><button>Suchen</button></form>')+(teamView?teamPage.controls:page.controls)+'<div class="registry-list"><table><thead><tr><th>'+(teamView?'Mannschaft':'Spieler')+'</th><th>'+(teamView?'Spieler':'Mannschaft')+'</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>'+(teamView?teamRows:playerRows)+'</tbody></table></div></section>';
  if(!teamView)root.innerHTML += '<section class="panel"><h2>Partien &amp; Statistik'+(entity?' · '+esc(entity.name||fullName(entity)):'')+'</h2><p>Zeitraum nach Spieltagsdatum. Nur abgeschlossene Partien zählen als Ergebnisse. Mannschaftswerte zählen die zugeordneten Spielerseiten der Einzelpartien.</p><form id="stats-filter">'+selectField('Übersicht','kind',f.kind,[['players','Spieler'],['teams','Mannschaften']])+selectField('Eintrag','id',f.id,[['','Bitte auswählen'],...(f.kind==='players'?players:teams).map(p=>[p.id,(p.name||fullName(p))+' · ID '+p.id])])+'<div class="form-row"><label>Von<input type="date" name="from" value="'+esc(f.from)+'"></label><label>Bis<input type="date" name="to" value="'+esc(f.to)+'"></label></div>'+selectField('Disziplin','discipline',f.discipline,[['','Alle'],...['8-Ball','9-Ball','10-Ball'].map(d=>[d,d])])+'<button>Auswerten</button></form><p><strong>'+count+' Ergebnisse · '+wins+' Siege · '+losses+' Niederlagen · Racks '+won+' : '+lost+'</strong></p>'+mp.controls+matchRows(mp.items)+'</section>';
}
let registryDialog;
function openRegistry(title,content) {
  if(!registryDialog){registryDialog=document.createElement('dialog');registryDialog.id='registry-dialog';document.body.append(registryDialog);}
  registryDialog.innerHTML='<h2>'+esc(title)+'</h2>'+content+'<p id="registry-error" role="alert"></p><button type="button" id="registry-cancel">Abbrechen</button>';
  registryDialog.querySelector('#registry-cancel').onclick=()=>registryDialog.close();
  registryDialog.onchange=e=>{
    if(e.target.matches('[data-roster-side]')) {
      const form=e.target.form,side=e.target.dataset.rosterSide,event=state.events.find(e=>e.id===Number(form.elements.event_id.value));
      form.querySelector('[data-roster="'+side+'"]').innerHTML=participantRoster(event,e.target.value,Number(side));
    }
  };
  registryDialog.oninput=()=>{
    const form=registryDialog.querySelector('#registry-player');if(!form)return;
    const data=Object.fromEntries(new FormData(form)), name=fullName(data).toLocaleLowerCase('de');
    const duplicates=state.players.filter(p=>p.id!==data.id&&fullName(p).toLocaleLowerCase('de')===name);
    registryDialog.querySelector('#duplicate-warning').textContent=duplicates.length?'Möglicher Doppeleintrag: '+duplicates.map(p=>fullName(p)+' · ID '+p.id).join(', '):'';
  };
  registryDialog.onsubmit=e=>{e.preventDefault();handlePlayersSubmit(e.target);};registryDialog.showModal();
}
root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||busy)return;
  if(b.dataset.stat){statsFilter={...statsFilter,kind:b.dataset.stat,id:b.dataset.id};drafts.delete('stats-filter');playersDashboard();}
  if(b.dataset.registry) {
    const kind=b.dataset.registry, item=(kind==='player'?state.players:state.teams).find(p=>p.id===b.dataset.id);
    const identity='<input type="hidden" name="id" value="'+esc(item?.id||'')+'"><input type="hidden" name="version" value="'+(item?.version??0)+'">';
    let fields=kind==='player'?field('Vorname','first_name',item?.first_name||'','text','maxlength="100"')+'<label>Zweiter Name (optional)<input name="second_name" maxlength="100" value="'+esc(item?.second_name||'')+'"></label>'+field('Nachname','last_name',item?.last_name||'','text','maxlength="100"')+'<p id="duplicate-warning" role="status"></p>'+(!item?selectField('Bei gleichem Namen','allow_duplicate','no',[['no','Doppeleintrag verhindern'],['yes','Ausdrücklich als andere Person anlegen']]):''):field('Mannschaftsname','name',item?.name||'','text','maxlength="100"')+multiSelect('Spielerzuordnung (Mehrfachauswahl mit Strg/Cmd)','player_ids',state.players.filter(p=>!p.event_id).map(p=>[p.id,fullName(p)+' · ID '+p.id]),state.team_players.filter(tp=>tp.team_id===item?.id).map(tp=>tp.player_id));
    openRegistry(kind==='player'?'Spieler verwalten':'Mannschaft verwalten','<form id="registry-'+kind+'">'+identity+fields+selectField('Künftige Vorauswahl','active',item?.active??1,[[1,'Aktiv'],[0,'Archiviert']])+'<p>Historische Namen, Zuordnungen und Ergebnisse bleiben erhalten.</p><button>Speichern</button></form>');
  }
  if(b.dataset.participants) {
    openParticipants(state.events.find(e=>e.id===Number(b.dataset.participants)));
  }
});
function participantRoster(event,teamId,side) {
  const team=state.teams.find(t=>t.id===teamId);
  if(!team)return '<p>Bitte Mannschaft '+(side+1)+' auswählen.</p>';
  const selected=state.event_players.filter(ep=>ep.event_id===event.id);
  const wasSelected=state.event_teams.some(t=>t.event_id===event.id&&t.team_id===teamId);
  const members=state.players.filter(p=>p.active&&((!p.event_id&&state.team_players.some(tp=>tp.team_id===teamId&&tp.player_id===p.id))||(p.event_id===event.id&&selected.some(ep=>ep.player_id===p.id&&ep.team_id===teamId))));
  return '<h3>Mannschaft '+(side+1)+' · '+esc(team.name)+'</h3><div class="roster-list">'+members.map(p=>'<label class="roster-player"><input type="checkbox" name="assignment:'+esc(p.id)+'" value="'+esc(teamId)+'" '+(!wasSelected||selected.some(ep=>ep.player_id===p.id&&ep.team_id===teamId)?'checked':'')+'>'+esc(fullName(p))+(p.event_id?' · nur dieser Spieltag':'')+'</label>').join('')+'</div>'+(members.length?'':'<p>Keine gemeldeten Spieler vorhanden.</p>')+'<label>Zusätzlicher Spieler nur für diesen Spieltag<input data-guest-team="'+esc(teamId)+'" maxlength="100" placeholder="Vor- und Nachname"></label>';
}
function openParticipants(event,start=false) {
  const selected=state.event_teams.filter(t=>t.event_id===event.id).map(t=>t.team_id);
  const home=state.teams.find(t=>t.nuliga_profile?.endsWith('teamtable='+event.schedule?.home_source_id))?.id;
  if(home&&selected.includes(home))selected.sort((a,b)=>Number(b===home)-Number(a===home));
  const identity='<input type="hidden" name="event_id" value="'+event.id+'"><input type="hidden" name="version" value="'+event.version+'">';
  let content;
  if(event.kind==='Liga') {
    const options=[['','Mannschaft auswählen'],...state.teams.filter(t=>t.active).map(t=>[t.id,t.name])];
    content=[0,1].map(side=>selectField('Mannschaft '+(side+1),'team_ids',selected[side]||'',options).replace('<select ','<select data-roster-side="'+side+'" ')).join('')+
      '<p>1. Teilnehmer bestätigen · 2. Erste Runde und Tische zuweisen. Gemeldete Spieler sind vorausgewählt; abwesende Spieler abwählen.</p>'+
      [0,1].map(side=>'<section class="participant-roster" data-roster="'+side+'">'+participantRoster(event,selected[side],side)+'</section>').join('');
  } else content=state.players.filter(p=>p.active&&!p.event_id).map(p=>'<label class="roster-player"><input type="checkbox" name="assignment:'+esc(p.id)+'" value="none" '+(state.event_players.some(ep=>ep.event_id===event.id&&ep.player_id===p.id)?'checked':'')+'>'+esc(fullName(p))+'</label>').join('');
  openRegistry('Teilnehmer · '+event.name,'<form id="registry-participants" data-start="'+start+'">'+identity+content+'<button class="primary">Teilnehmer bestätigen · Weiter zur Aufstellung</button></form>');
}
function handlePlayersSubmit(form) {
  if(form.id==='player-search'){playerSearch=form.elements.q.value;listPages.delete('players');playersDashboard();return true;}
  if(form.id==='stats-filter'){statsFilter=Object.fromEntries(new FormData(form));listPages.delete('player-matches');playersDashboard();return true;}
  if(!form.id.startsWith('registry-'))return false;
  if(busy)return true;
  const data=Object.fromEntries(new FormData(form));data.version=Number(data.version);
  if(form.id==='registry-participants') {
    data.team_ids=new FormData(form).getAll('team_ids').filter(Boolean);data.player_ids=[];data.assignments={};data.start=form.dataset.start==='true';data.guests=[];
    for(const input of form.querySelectorAll('[data-guest-team]'))if(input.value.trim())data.guests.push({name:input.value.trim(),team_id:input.dataset.guestTeam});
    for(const [key,value] of new FormData(form))if(key.startsWith('assignment:')&&value!=='exclude'){const id=key.slice(11);data.player_ids.push(id);if(value!=='none')data.assignments[id]=value;}
  } else {data.active=Number(data.active);data.allow_duplicate=data.allow_duplicate==='yes';data.player_ids=new FormData(form).getAll('player_ids');}
  busy=true;
  api(form.id==='registry-participants'?'/api/events/'+data.event_id+'/participants':form.id==='registry-player'?'/api/players':'/api/teams',data).then(()=>{registryDialog.close();if(form.id==='registry-participants'){selectedEventId=Number(data.event_id);view='spieltage';history.replaceState(null,'','/#spieltage/'+data.event_id);message('Teilnehmer bestätigt. Jetzt Spieler und Tische für die erste Runde zuweisen.');}else message('Gespeichert.');}).catch(error=>{registryDialog.querySelector('#registry-error').textContent=error.message;}).finally(async()=>{busy=false;await refresh(true);});
  return true;
}
root.addEventListener('change',e=>{if(e.target.form?.id==='stats-filter' && e.target.name==='kind'){statsFilter={...statsFilter,kind:e.target.value,id:''};drafts.delete('stats-filter');playersDashboard();}});

// One immutable action snapshot per warning. Enter never executes an action.
const warningDialog=document.querySelector('#warning-dialog'), warningInput=document.querySelector('#warning-input'), warningSave=document.querySelector('#warning-save');
let pendingWarning, warningTimer;
function stopWarningTimer() {
  if(warningTimer!==undefined){clearInterval(warningTimer);warningTimer=undefined;}
}
function updateWarningButton() {
  const remaining=pendingWarning?.readyAt?Math.max(0,pendingWarning.readyAt-Date.now()):0;
  warningSave.disabled=busy||!pendingWarning||remaining>0||!!(pendingWarning.phrase&&warningInput.value!==pendingWarning.phrase);
  if(pendingWarning)warningSave.textContent=pendingWarning.label+(remaining>0?' ('+Math.ceil(remaining/1000)+' s)':'');
  if(!remaining)stopWarningTimer();
}
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
  stopWarningTimer();
  pendingWarning={...pending,readyAt:pending.delayMs?Date.now()+pending.delayMs:0}; warningInput.value='';
  document.querySelector('#warning-entry').hidden=!pending.phrase;
  warningSave.textContent=pending.label;
  document.querySelector('#warning-summary').innerHTML=pending.summary;
  document.querySelector('#warning-phrase').textContent=pending.phrase || '';
  document.querySelector('#warning-error').textContent='';
  warningDialog.showModal();if(pending.phrase)warningInput.focus();else document.querySelector('#warning-cancel').focus();
  updateWarningButton();
  if(pending.delayMs)warningTimer=setInterval(()=>{checkWarning();updateWarningButton();},100);
}
function checkWarning() {
  if(rentalCorrection && state?.rentals.find(r=>r.id===pendingRental.id)?.version!==pendingRental.version) {
    rentalCorrection=undefined;rentalConfirmation.value='';rentalSave.disabled=true;
    document.querySelector('#rental-error').textContent='Buchung geändert. Bitte abbrechen und erneut öffnen.';
  }
  if(pendingWarning && !pendingWarning.valid()) {
    stopWarningTimer();
    pendingWarning=undefined;warningInput.value='';warningSave.disabled=true;
    document.querySelector('#warning-error').textContent='Daten wurden geändert. Bitte abbrechen, den aktualisierten Eintrag öffnen und erneut prüfen.';
  }
}
guardConfirmation(warningInput,()=>{checkWarning();updateWarningButton();});
document.querySelector('#warning-cancel').addEventListener('click',()=>warningDialog.close());
warningDialog.addEventListener('close',()=>{stopWarningTimer();pendingWarning=undefined;warningInput.value='';warningSave.disabled=true;});
warningSave.addEventListener('click',async()=>{
  checkWarning();updateWarningButton();if(warningSave.disabled)return;
  const pending=pendingWarning;busy=true;warningSave.disabled=true;
  try {await pending.run();warningDialog.close();message(pending.success || 'Aktion gespeichert und protokolliert.');}
  catch(error){pendingWarning=undefined;warningInput.value='';document.querySelector('#warning-error').textContent=error.message+' Bitte abbrechen und erneut öffnen.';}
  finally{busy=false;await refresh(true);}
});


await refresh(true);
setInterval(() => { if (!busy) refresh(); }, 3000);

setInterval(tickTimers,1000);

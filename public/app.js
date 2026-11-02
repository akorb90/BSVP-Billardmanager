import { rentalPrice, hourlyRate } from './rental-pricing.js';
const root = document.querySelector('#app'), connection = document.querySelector('#connection');
const table = Number(/^\/tisch\/([1-9]|1[0-9]|20)$/.exec(location.pathname)?.[1]);
if (table) document.body.classList.add('kiosk');
if (table && location.hash) history.replaceState(null, '', location.pathname);
let setupChoice, clockOffset=0;
let csrf = '', state, current, busy = false, refreshGeneration=0;
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

const views = { lager:['Lagerverwaltung','Getränke, Gebinde und Lagerbewegungen verwalten.'], planung:['Veranstaltungsübersicht','Veranstaltungen planen und verwalten'], spieler: ['Spieler', 'Spieler pflegen und nuLiga-Profile öffnen'], mannschaften: ['Mannschaften', 'Mannschaften und Kader pflegen'], einstellungen: ['Einstellungen', 'Tischanzahl, Vereinsgestaltung, Grundpreis und Admin-Passwort verwalten.'], vermietung: ['Tischvermietung', 'Tische vermieten, minutengenau abrechnen und Buchungen prüfen.'], uebersicht: ['Tischübersicht', 'Alle Tische und laufenden Partien im Blick.'], spieltage: ['Veranstaltungsübersicht', 'Veranstaltungen anlegen, Begegnungen planen und Tische zuweisen.'], ergebnisse: ['Ergebnisse', 'Abgeschlossene Partien und ihre gespeicherten Endstände.'] };
let view = Object.hasOwn(views, location.hash.slice(1).split('/')[0]) ? location.hash.slice(1).split('/')[0] : 'uebersicht';
let selectedEventId=Number(location.hash.split('/')[1])||null;
const inventoryKinds={initial:'Anfangsbestand',receipt:'Wareneingang',consumption:'Verbrauch',breakage:'Bruch',own_use:'Eigenverbrauch',adjustment:'Inventurdifferenz',reversal:'Gegenbuchung'};
const drafts = new Map();
const inventoryDialog=document.querySelector('#inventory-dialog');
let inventorySection='stock',inventoryFilters={},inventoryEditId=null;
const leagueDraftVersions = new Map();
const tournamentPanels = new Map(), tournamentSections = new Map();
let eventStatus='active',eventCreationOpen=false;
const listPages = new Map();
let resetStatsDraft=false;
const quantity = (count,singular,plural) => count+' '+(count===1?singular:plural);
function captureFocus() {
  const active=document.activeElement;
  if(!active || !root.contains(active))return null;
  const attributes=[...active.attributes].filter(a=>['id','name','type','href','aria-label'].includes(a.name) || (a.name==='value'&&active.tagName==='BUTTON') || (a.name.startsWith('data-')&&a.name!=='data-version')).map(a=>[a.name,a.value]);
  return {tag:active.tagName.toLowerCase(),form:active.closest('form')?.getAttribute('id'),attributes,text:active.textContent};
}
function restoreFocus(saved) {
  if(!saved)return;
  const scope=saved.form?document.getElementById(saved.form):root;
  const candidates=[...(scope?.querySelectorAll(saved.tag)||[])].filter(el=>!el.disabled&&!el.closest('[hidden]')&&saved.attributes.every(([name,value])=>el.getAttribute(name)===value));
  const exact=candidates.filter(el=>el.textContent===saved.text);
  const target=exact.length===1?exact[0]:candidates.length===1?candidates[0]:null;
  if(target){if(saved.tag==='h1')target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
  else {const heading=root.querySelector('h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}}
}
function paginate(items, key, label) {
  const remote=state?.pages?.[key];
  const paging = remote?{page:remote.page,size:remote.size}:listPages.get(key) || { page: 1, size: 20 };
  const total=remote?.total??items.length;
  const pages = Math.max(1, Math.ceil(total / paging.size));
  paging.page = Math.min(paging.page, pages);
  listPages.set(key, paging);
  const start = (paging.page - 1) * paging.size;
  return {
    items: remote?remote.items:items.slice(start, start + paging.size),
    controls: `<nav class="pagination" aria-label="${label}: Seitennavigation"><div><label for="${key}-size">Einträge pro Seite</label><select id="${key}-size" data-page-size="${key}">${[10,20,50,100].map(size => `<option value="${size}" ${size === paging.size ? 'selected' : ''}>${size}</option>`).join('')}</select></div><span role="status">${total ? start + 1 : 0}–${Math.min(start + paging.size, total)} von ${total} · Seite ${paging.page} von ${pages}</span><div class="pagination-buttons"><button type="button" id="${key}-previous" data-page-list="${key}" data-page-step="-1" ${paging.page === 1 ? 'disabled' : ''} aria-label="${label}: Vorherige Seite">← Zurück</button><button type="button" id="${key}-next" data-page-list="${key}" data-page-step="1" ${paging.page === pages ? 'disabled' : ''} aria-label="${label}: Nächste Seite">Weiter →</button></div></nav>`
  };
}
async function renderPageChange(focusId) {
  if(state?.pages)await refresh(true);
  saveDrafts(); dashboard(); restoreDrafts(); updateRentalPreview();
  const control = root.querySelector('#' + focusId);
  if (control?.disabled) root.querySelector(`[data-page-size="${control.dataset.pageList}"]`)?.focus();
  else control?.focus();
}
root.addEventListener('change', async e => {
  const key = e.target.dataset.pageSize, size = Number(e.target.value);
  if (!state || busy || !listPages.has(key) || ![10,20,50,100].includes(size)) return;
  listPages.set(key, { page: 1, size });
  await renderPageChange(e.target.id);
});
root.addEventListener('click', async e => {
  const button = e.target.closest('button[data-page-list]');
  if (!button || button.disabled || busy || !state) return;
  const paging = listPages.get(button.dataset.pageList);
  if (!paging) return;
  paging.page = Math.max(1, paging.page + Number(button.dataset.pageStep));
  await renderPageChange(button.id);
});
function adminNavigation(authenticated) {
  navigation.hidden = !authenticated;
  document.querySelector('#logout').hidden = !authenticated;
  for (const link of navigation.querySelectorAll('a')) {
    if (authenticated && link.hash === '#' + (table ? 'uebersicht' : view==='planung'?'spieltage':view)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
function markLeagueDraft(e) {
  const form=e.target.closest?.('form[id^="league-slot-"]');
  if(form?.id?.startsWith('league-slot-') && form.dataset?.version!==undefined && e.target.name && !leagueDraftVersions.has(form.id)) leagueDraftVersions.set(form.id,Number(form.dataset.version));
}
root.addEventListener('input',markLeagueDraft);
root.addEventListener('change',markLeagueDraft);
root.addEventListener('click',e=>{
  const button=e.target.closest('button[data-league-reload]');
  if(!button || !button.dataset.leagueReload || busy)return;
  const id=button.dataset.leagueReload;
  return mutate(async()=>{drafts.delete(id);leagueDraftVersions.delete(id);message('Entwurf verworfen. Aktuelle Aufstellung geladen.');});
});
const tournamentScrolls=new Map(),tournamentManualPanels=new Map();
function saveDrafts() {
  const creation=root.querySelector('[data-event-creation]');if(creation)eventCreationOpen=creation.open;
  for(const list of root.querySelectorAll('[data-tournament-scroll]'))tournamentScrolls.set(list.dataset.tournamentScroll,list.scrollTop);
  for(const panel of root.querySelectorAll('[data-tournament-manual]'))tournamentManualPanels.set(panel.dataset.tournamentManual,panel.open);
  for(const panel of root.querySelectorAll('details[data-tournament-panel]'))tournamentPanels.set(Number(panel.dataset.tournamentPanel),panel.open);
  for(const form of root.querySelectorAll('form')) {
    const id=form.getAttribute?.('id')??form.id;
    if(!id || ['login','tablet-login','admin-password'].includes(id))continue;
    if(id==='stats-filter'&&resetStatsDraft){drafts.delete(id);continue;}
    if(id.startsWith('league-slot-') && !leagueDraftVersions.has(id)){drafts.delete(id);continue;}
    drafts.set(id,[...new FormData(form)].filter(([name])=>!['logo_file','logo_reset'].includes(name)));
  }
}
function restoreDrafts() { for (const [id, entries] of drafts) {
  const form=document.getElementById(id);if(!form)continue;
  if(leagueDraftVersions.has(id))form.dataset.version=String(leagueDraftVersions.get(id));
  if(id.startsWith('tournament-')) {
    const positions={};for(const field of form.elements){if(!field.name)continue;const values=entries.filter(([name])=>name===field.name).map(([,value])=>value);
      if(field.type==='checkbox')field.checked=values.includes(field.value);
      else if(values.length){const index=positions[field.name]||0;field.value=values[index]??values[0];positions[field.name]=index+1;}
    }
  }else for(const [name,value] of entries){const field=form.elements.namedItem(name);if(field)field.value=value;}
} for(const form of root.querySelectorAll('form[data-action="preview"]'))updateTournamentSelection(form); for(const list of root.querySelectorAll('[data-tournament-scroll]'))list.scrollTop=tournamentScrolls.get(list.dataset.tournamentScroll)||0; for(const panel of root.querySelectorAll('[data-tournament-manual]'))panel.open=tournamentManualPanels.get(panel.dataset.tournamentManual)||false; const creation=root.querySelector('[data-event-creation]');if(creation)creation.open=eventCreationOpen; const form=root.querySelector('#match');if(form)updateParticipantOptions(form); }
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
  if(view==='planung'){adminNavigation(true);matchdayDashboard();return;}
  if(view==='spieltage'){adminNavigation(true);matchdayDashboard();return;}
  if(['spieler','mannschaften'].includes(view)) {adminNavigation(true);playersDashboard();return;}
  if(view==='einstellungen') { adminNavigation(true); settingsDashboard(); return; }
  if(view==='lager') { adminNavigation(true); inventoryDashboard(); return; }
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
    <section class="planning" ${view === 'spieltage' ? '' : 'hidden'}><div class="panel"><p class="eyebrow">01 · VERANSTALTUNG</p><h2>Veranstaltung anlegen</h2><form id="event"><label>Name<input name="name" maxlength="100" placeholder="z. B. Bezirksliga · 3. Spieltag" required></label><div class="form-row"><label>Format<select name="kind"><option>Liga</option><option>Turnier</option></select></label><label>Datum<input name="date" type="date" required></label></div><button class="primary">Veranstaltung anlegen</button></form></div>
    <div class="panel"><p class="eyebrow">02 · BEGEGNUNG</p><h2>Die nächste Partie</h2><form id="match"><label>Veranstaltung<select name="event_id" required><option value="">Bitte auswählen</option>${state.events.filter(e=>e.status === 'open').map(e => `<option value="${e.id}">${esc(e.date)} · ${esc(e.name)} (${esc(e.kind)})</option>`).join('')}</select></label>${participantSelectors(null)}<div class="form-row"><label>Spieler A<input name="player_a" maxlength="302" required></label><label>Spieler B<input name="player_b" maxlength="302" required></label></div><div class="form-row"><label>Disziplin<select name="discipline"><option>8-Ball</option><option>9-Ball</option><option>10-Ball</option></select></label><label>Gewinnspiele<input name="target" type="number" value="5" min="1" max="999" required></label></div><label>Tablet-PIN (6 Ziffern)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><button class="primary" ${state.events.some(e=>e.status === 'open') ? '' : 'disabled'}>Begegnung planen</button></form></div></section>
    <section ${view === 'spieltage' ? '' : 'hidden'}><div class="section-title"><h2>Veranstaltungen</h2></div>${eventPage?.controls || ''}<div class="event-list">${eventPage ? eventPage.items.map(eventCard).join('') || '<p>Noch keine Veranstaltungen angelegt.</p>' : ''}</div></section><div class="section-title"><h2>${view === 'ergebnisse' ? 'Abgeschlossene Partien' : view === 'spieltage' ? 'Alle Begegnungen' : 'Laufende Partien'}</h2><span>${quantity(state.pages?.['matches-'+view]?.total??visibleMatches.length,'Partie','Partien')}</span></div>${matchPage.controls}<section id="matches">${matchRows(matchPage.items)}</section>`;
}
const racks = (match,side) => match.discipline==='14/1'?Math.floor(match[side]/10):match[side];
function matchRows(matches,asRacks=false) {
  return matches.map(m => `<article class="match-row"><div><span class="pill ${m.status === 'live' ? 'green' : ''}">${labels[m.status]}</span><h3>${esc(m.player_a)} <span class="muted">vs.</span> ${esc(m.player_b)}</h3><p>${esc(state.events.find(e => e.id === m.event_id)?.name||m.event_name)} · ${esc(m.discipline)} · Ziel ${m.target}${m.table_no ? ' · Tisch ' + m.table_no : ''}</p>${asRacks&&m.discipline==='14/1'?'<p>'+m.a+' : '+m.b+' Punkte</p>':''}</div><strong class="result">${asRacks?racks(m,'a'):m.a} : ${asRacks?racks(m,'b'):m.b}${asRacks?' Racks':''}</strong>${m.status === 'planned' ? `<form class="start" data-id="${m.id}"><label>Tisch<select name="table_no">${freeTables().map(n => `<option value="${n}">Tisch ${n}</option>`).join('')}</select></label><button ${freeTables().length?'':'disabled'}>${freeTables().length?'Tisch zuweisen ↗':'Kein freier Tisch'}</button></form>` : m.status === 'live' ? `<div class="match-actions"><a href="/tisch/${m.table_no}">Punkte bearbeiten ↗</a>${finishButton(m)}${Math.max(m.a,m.b) < m.target ? '<small>Abschluss ab Erreichen des Spielziels</small>' : '<small>Spielziel erreicht · bereit zum Abschluss</small>'}</div>` : ''}${m.pin_set ? '' : '<small>Tablet-PIN fehlt · bitte Partie bearbeiten</small>'}<p>${esc(m.team_a_name||'Ohne Mannschaft')} / ${esc(m.team_b_name||'Ohne Mannschaft')}</p>${timers(m)}${matchAdminActions(m)}</article>`).join('') || '<div class="empty">Keine Partien in dieser Ansicht.</div>';
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
  const requestedView=view,requestedEvent=selectedEventId;
  const generation=++refreshGeneration;
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
      try { const admin = await api('/api/admin/live'); csrf = admin.csrf; adminNavigation(true); }
      catch(e) { if (e.status !== 401) throw e; csrf = ''; adminNavigation(false); }
      const data = await api(`/api/tables/${table}`);
      if(data.match) delete data.match.server_now; // Clock sync must not replace focused controls.
      if (initial || JSON.stringify(current) !== JSON.stringify(data.match)) { const focus=captureFocus();current = data.match;kiosk();restoreFocus(focus); }
    } else {
      const params=new URLSearchParams({view:view==='planung'?'spieltage':view});
      if(['planung','spieltage'].includes(view))params.set('status',eventStatus);
      if(selectedEventId)params.set('event',selectedEventId);
      for(const [key,paging] of listPages){params.set(key+'-page',paging.page);params.set(key+'-size',paging.size);}
      for(const [key,value] of Object.entries(statsFilter))if(value)params.set(key,value);
      const live=await api('/api/admin/live');
      const scoped=view==='lager'?{inventory:await api('/api/inventory'),matches:[],events:[],pages:{}}:view==='uebersicht'?{matches:[],events:[],pages:{}}:await api('/api/admin/view?'+params);
      if(generation!==refreshGeneration||requestedView!==view||requestedEvent!==selectedEventId)return;
      const merge=(left=[],right=[])=>[...new Map([...left,...right].map(row=>[row.id,row])).values()];
      state={...scoped,...live,matches:merge(scoped.matches,live.matches),rentals:merge(scoped.rentals,live.rentals),events:merge(live.events,scoped.events)};csrf=live.csrf;
      if (!document.querySelector('dialog[open]') && (initial || !root.contains(document.activeElement) || ['BUTTON','H1'].includes(document.activeElement.tagName))) {
        const focus=captureFocus();saveDrafts(); dashboard(); restoreDrafts(); updateRentalPreview();restoreFocus(focus);resetStatsDraft=false;
      }
    }
    checkWarning();
    connection.textContent = '● Verbunden'; connection.className = 'online';
  } catch(e) {
    if(generation!==refreshGeneration)return;
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
  e.preventDefault(); if(handleInventorySubmit(e.target))return; const handled=handlePlayersSubmit(e.target);if(handled)return handled; if(handleBrandingSubmit(e.target)) return; if(handlePasswordSubmit(e.target)) return; if(handleRentalSubmit(e.target)) return; const form = e.target, data = Object.fromEntries(new FormData(form));
  return mutate(async () => {
    if(form.id.startsWith('tournament-player-')) {
      const result=await api('/api/players',data);
      const preview=document.getElementById('tournament-preview-'+form.dataset.event);
      if(preview){const entries=[...new FormData(preview)];entries.push(['player_ids',result.id]);drafts.set(preview.id,entries.map(([k,v])=>[k,k==='participant_filter'?'all':k==='participant_search'?'':v]));preview.remove();}
      drafts.delete(form.id);form.reset();message('Spieler angelegt und ausgewählt.');return;
    }
    if(form.id.startsWith('tournament-')) {
      const action=form.dataset.action,payload={...data,version:Number(data.version??form.dataset.version)};
      if(action==='preview'){if(data.assignment==='manual')payload.groupAssignments=Object.fromEntries([...new FormData(form)].filter(([k])=>k.startsWith('group:')).map(([k,v])=>[k.slice(6),Number(v)]));payload.player_ids=new FormData(form).getAll('player_ids');for(const k of ['target','groupCount','qualifiers'])payload[k]=Number(data[k]);}
      if(action==='resolve'){payload.group=Number(data.group);payload.order=new FormData(form).getAll('order');}
      await api('/api/events/'+form.dataset.event+'/tournament/'+action,payload);drafts.delete(form.id);if(action==='preview'){const panel=form.closest('details');if(panel)panel.open=false;tournamentSections.set(Number(form.dataset.event),'settings');}if(action==='confirm')tournamentSections.set(Number(form.dataset.event),'matches');form.remove();message(action==='preview'?'Auslosung als Vorschau gespeichert. Bitte prüfen und bestätigen.':action==='confirm'?'Auslosung übernommen. Partien können Tischen zugewiesen werden.':'Gleichstand entschieden.');
    }
    if(form.id.startsWith('league-slot-')){const payload={...data,version:leagueDraftVersions.get(form.id)??Number(form.dataset.version),table_no:data.table_no?Number(data.table_no):null,target:data.target?Number(data.target):null,start:e.submitter?.value==='start'};await api('/api/events/'+form.dataset.event+'/slots/'+form.dataset.slot,payload);drafts.delete(form.id);leagueDraftVersions.delete(form.id);message(payload.start?'Partie dem Tisch zugewiesen.':'Aufstellung gespeichert.');}
    if(form.id==='nuliga-schedule-sync'){message('Spieltage werden abgerufen …');const result=await api('/api/settings/nuliga-schedule',{});message(result.created+' Spieltage neu angelegt, '+result.updated+' aktualisiert, '+result.removed+' Auswärtsspieltage entfernt. Alle neuen Spieltage sind geplant.');}
    if (form.id === 'nuliga-sync') { message('nuLiga wird abgerufen …'); const result=await api('/api/settings/nuliga',{overwrite:data.overwrite==='yes'}); drafts.delete(form.id); message('Synchronisiert: '+result.teams+' Mannschaften und '+result.players+' Spieler. '+result.created+' neu, '+result.updated+' aktualisiert; '+result.preserved+' lokale Anpassungen erhalten.'); }
    if (form.id === 'table-settings') { await api('/api/settings/tables',{table_count:Number(data.table_count),version:Number(data.version)}); drafts.delete(form.id); form.remove(); message('Tischanzahl gespeichert.'); }
    if (form.id === 'tablet-login') { const result=await api(`/api/tables/${table}/login`,data); sessionStorage.setItem(`tablet-session:${table}`,result.token); form.reset(); }
    if (form.id === 'login') {
      const result = await api('/api/login', data); csrf = result.csrf;
      view = 'uebersicht'; history.replaceState(null, '', '/#uebersicht');
    }
    if (form.id === 'event') { await api('/api/events', data); form.reset(); drafts.delete('event');eventCreationOpen=false;const creation=form.closest?.('[data-event-creation]');if(creation)creation.open=false; }
    if (form.id === 'match') { await api('/api/matches', { ...data, event_id:Number(data.event_id), target:Number(data.target) }); form.reset(); drafts.delete('match'); }
    if (form.classList.contains('start')) { const m = state.matches.find(m => m.id === Number(form.dataset.id)); await api(`/api/matches/${m.id}/start`, { table_no:Number(data.table_no), version:m.version }); }
  });
});
root.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  if(button.dataset.tournamentSection){saveDrafts();tournamentSections.set(selectedEventId,button.dataset.tournamentSection);dashboard();restoreDrafts();return;}
  if(button.dataset.tournamentOpen){selectedEventId=Number(button.dataset.tournamentOpen);view='spieltage';history.replaceState(null,'','/#spieltage/'+selectedEventId);return refresh(true);}
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
window.addEventListener('hashchange', async () => {
  if (table) return;
  saveDrafts(); const previousEventId=selectedEventId; view = Object.hasOwn(views, location.hash.slice(1).split('/')[0]) ? location.hash.slice(1).split('/')[0] : 'uebersicht';
  selectedEventId=Number(location.hash.split('/')[1])||null;
  if(previousEventId!==selectedEventId)drafts.delete('match');
  if (state) { await refresh(true); }
});
document.querySelector('#logout').addEventListener('click', () => mutate(() => api('/api/logout', {})));


const adminDialog = document.querySelector('#admin-dialog');
let pendingAdmin;
function scheduleSyncForm() {
  const sync=state.nuliga_schedule;
  return '<h2>nuLiga-Spieltage synchronisieren</h2><p>Übernimmt kommende Heimspiele der BSV-Mannschaften als geplante Spieltage. Einzelpartien und Tische werden erst nach dem manuellen Start zugewiesen.</p><p>'+(sync?'Letzter Abgleich: '+esc(new Date(sync.synced_at).toLocaleString('de-DE'))+' · '+sync.found+' kommende Spieltage.':'Noch kein Spieltagsabgleich.')+'</p><form id="nuliga-schedule-sync"><button>Jetzt Spieltage synchronisieren</button></form>';
}
function eventMatchesStatus(event) {
  return eventStatus==='all'||(eventStatus==='active'?event.status!=='closed':eventStatus==='closed'?event.status==='closed':event.status!=='closed'&&(eventStatus==='planned'?event.phase==='planned':event.phase!=='planned'));
}
root.addEventListener('change',e=>{
  if(e.target.id!=='event-status'||busy)return;
  eventStatus=e.target.value;listPages.delete('events');return refresh(true);
});
function matchdayDashboard() {
  const selected=state.events.find(e=>e.id===selectedEventId);
  root.innerHTML='<div class="page-title"><div><h1>'+(selected?esc(selected.name):'Veranstaltungsübersicht')+'</h1><p>'+(selected?esc(selected.date):'Veranstaltungen anlegen, öffnen und verwalten.')+'</p></div></div>';
  if(!selected) {
    const page=paginate(state.events.filter(eventMatchesStatus).sort((a,b)=>{
      const rank=e=>e.status==='closed'?2:e.phase==='planned'?1:0;
      return rank(a)-rank(b)||(a.date||'').localeCompare(b.date||'')||a.id-b.id;
    }),'events','Veranstaltungen');
    root.innerHTML+='<details class="panel" data-event-creation '+(eventCreationOpen?'open':'')+'><summary>Veranstaltung anlegen</summary><form id="event">'+field('Name','name','','text','maxlength="100"')+selectField('Format','kind','Liga',[['Liga','Liga'],['Turnier','Turnier']])+field('Datum','date','','date')+'<p>Die Veranstaltung bleibt bis zum manuellen Start geplant.</p><button class="primary">Veranstaltung anlegen</button></form></details><p>nuLiga-Abgleiche unter <a href="/#einstellungen">Einstellungen · nuLiga</a>.</p>'+selectField('Veranstaltungen anzeigen','event_status',eventStatus,[['active','Laufende und geplante'],['running','Laufende'],['planned','Geplante'],['closed','Abgeschlossene'],['all','Alle']]).replace('<select name="event_status"','<select id="event-status" name="event_status"')+'<section><h2>Veranstaltungen</h2>'+page.controls+page.items.map(eventCard).join('')+(page.items.length?'':'<p>Keine Veranstaltungen in dieser Ansicht.</p>')+'</section>';
    return;
  }
  root.innerHTML+='<p><a href="/#spieltage">Alle Veranstaltungen</a></p>'+eventCard(selected);
  if(selected.kind==='Turnier'){root.innerHTML+=tournamentBoard(selected);return;}
  if(selected.phase==='planned'){root.innerHTML+='<p>Zuerst „Spieltag starten“ wählen und die Teilnehmer bestätigen. Anschließend hier Aufstellung und Partien verwalten.</p>';return;}
  root.innerHTML+=leagueBoard(selected);
  const linked=new Set((state.event_match_slots||[]).filter(s=>s.event_id===selected.id).map(s=>s.match_id));
  const additional=state.matches.filter(m=>m.event_id===selected.id&&!linked.has(m.id)).sort((a,b)=>a.id-b.id);
  if(additional.length)root.innerHTML+='<section><h2>Weitere Partien</h2>'+matchRows(additional)+'</section>';
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
      const formId='league-slot-'+event.id+'-'+(i+1),conflict=leagueDraftVersions.has(formId)&&leagueDraftVersions.get(formId)!==slot.version;
      const occupied=n=>state.matches.some(m=>m.status==='live'&&m.table_no===n&&m.id!==slot.match_id)||(state.rentals||[]).some(r=>r.status==='active'&&r.table_no===n);
      html+='<article class="panel league-partie"><div class="section-title"><h4>'+(i+1)+'. '+(doubles?'Doppel':'Einzel')+' · '+format[i]+'</h4><span class="pill">'+(match?labels[match.status]:'Aufstellung offen')+'</span></div><form id="league-slot-'+event.id+'-'+(i+1)+'" data-event="'+event.id+'" data-slot="'+(i+1)+'" data-version="'+slot.version+'"><fieldset '+(locked?'disabled':'')+'><div class="league-lineup"><div><h5>'+'Heim · '+esc(teams[0]?.name||'Mannschaft 1')+'</h5>'+choose('Spieler 1','player_a_id',slot.player_a_id,0)+(doubles?choose('Spieler 2','player_a2_id',slot.player_a2_id,0):'')+'</div><div><h5>'+'Gast · '+esc(teams[1]?.name||'Mannschaft 2')+'</h5>'+choose('Spieler 1','player_b_id',slot.player_b_id,1)+(doubles?choose('Spieler 2','player_b2_id',slot.player_b2_id,1):'')+'</div><div>'+selectField('Tisch','table_no',slot.table_no??'',[['','Tisch auswählen'],...Array.from({length:tableCount()},(_,n)=>[n+1,'Tisch '+(n+1)+(occupied(n+1)?' · belegt':'')])])+'<label>Spielziel ('+(format[i]==='14/1'?'Punkte':'Gewinnspiele')+')<input name="target" type="number" min="1" max="'+(format[i]==='14/1'?999:99)+'" value="'+(slot.target??'')+'"></label>'+(locked?'':'<label>Tablet-PIN zum Starten<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off"></label>')+'</div></div></fieldset>'+(locked?'':'<div class="dialog-actions"><button type="submit" value="save">Aufstellung speichern</button><button type="submit" value="start" class="primary">Partie starten</button></div>')+'</form>';
      if(conflict)html+='<p role="status">Diese Aufstellung wurde zwischenzeitlich geändert. Dein Entwurf wurde nicht gespeichert. Lade den Serverstand, bevor du die Aufstellung erneut bearbeitest.</p><button type="button" data-league-reload="'+formId+'">Entwurf verwerfen / Serverstand laden</button>';
      if(match)html+='<p class="league-score">'+esc(match.player_a)+' <strong>'+match.a+' : '+match.b+'</strong> '+esc(match.player_b)+'</p>'+timers(match)+(match.status==='live'?'<a class="button" href="/tisch/'+match.table_no+'">Tisch öffnen ↗</a>'+finishButton(match):'')+matchAdminActions(match);
      html+='</article>';
    }
    html+='</section>';
  }
  return html+'</section>';
}
function eventCard(event) {
  const matches=state.matches.filter(m=>m.event_id===event.id), closed=event.status==='closed';
  if(event.phase==='planned')return '<article class="event-card"><span class="pill">Geplant · '+esc(event.kind)+'</span><h3><a href="/#spieltage/'+event.id+'">'+esc(event.name)+'</a></h3><p>'+esc(event.date)+(event.schedule?' · '+esc(event.schedule.time)+' · '+esc(event.schedule.league):'')+'</p><div class="entity-actions">'+(event.kind==='Turnier'?'<button class="primary" data-tournament-open="'+event.id+'">Turnier vorbereiten</button>':'<button class="primary" data-event-start="'+event.id+'">Spieltag starten</button>')+'<button data-entity="event" data-action="edit" data-id="'+event.id+'">Veranstaltung bearbeiten</button><button data-entity="event" data-action="delete" data-id="'+event.id+'">'+(event.kind==='Turnier'?'Turnier löschen':'Spieltag löschen')+'</button></div></article>';
  return `<article class="event-card"><span class="pill">${esc(event.kind)} · ${closed?'Gesamtabschluss':'Offen'}</span><h3><a href="/#spieltage/${event.id}">${esc(event.name)}</a></h3><p>${esc(event.date)}${event.schedule?' · '+esc(event.schedule.time)+' · '+esc(event.schedule.league):''} · ${quantity(event.match_count??matches.length,'Partie','Partien')}</p>${`<div class="entity-actions"><button data-entity="event" data-action="edit" data-id="${event.id}">Veranstaltung bearbeiten</button><button data-entity="event" data-action="delete" data-id="${event.id}">${event.kind==='Turnier'?'Turnier löschen':'Veranstaltung löschen'}</button>${closed?'':`<button class="primary" data-entity="event" data-action="close" data-id="${event.id}">Veranstaltung abschließen</button>`}</div>${closed||event.kind==='Turnier'?'':'<button data-participants="'+event.id+'">Teilnehmer & Mannschaften</button>'}<small>${quantity(event.pending_count??matches.filter(m=>m.status!=='finished').length,'Partie','Partien')} noch nicht abgeschlossen</small>`}</article>`;
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
function updateMatchLimits(form) {
  const discipline=form?.elements?.namedItem?.('discipline'),target=form?.elements?.namedItem?.('target');
  if(!discipline || !target)return;
  const limit=discipline.value==='14/1'?999:99;
  target.max=String(limit);
  const scoreLimit=String(Math.min(limit,Math.max(1,Number(target.value)||limit)));
  for(const name of ['a','b']){const field=form.elements.namedItem(name);if(field)field.max=scoreLimit;}
}
for(const type of ['input','change'])document.querySelector('#admin-edit-form').addEventListener(type,e=>{
  if(['discipline','target'].includes(e.target.name))updateMatchLimits(e.currentTarget);
});
root.addEventListener('click',async e=>{
  const button=e.target.closest('button[data-entity]'); if(!button||busy||table)return;
  const entity=button.dataset.entity, action=button.dataset.action;
  let item=(entity==='event'?state.events:state.matches).find(v=>v.id===Number(button.dataset.id));
  if(!item)return;
  if(state.pages) {
    const requestedView=view,requestedEvent=selectedEventId;busy=true;const generation=++refreshGeneration;
    try {
      const detail=await api('/api/admin/view?view=spieltage&event='+(entity==='event'?item.id:item.event_id));
      if(generation!==refreshGeneration||requestedView!==view||requestedEvent!==selectedEventId)return;
      for(const key of ['players','teams','team_players','event_players','event_teams','event_match_slots'])state[key]=detail[key];
      for(const key of ['events','matches'])state[key]=[...new Map([...state[key],...detail[key]].map(row=>[row.id,row])).values()];
      item=state[entity==='event'?'events':'matches'].find(row=>row.id===item.id);
    }catch(error){message(error.message);return;}finally{busy=false;}
  }
  pendingAdmin={entity,action,item:{...item},eventVersion:entity==='match'?state.events.find(e=>e.id===item.event_id)?.version:undefined};
  const title=(entity==='event'?(item.kind==='Turnier'?'Turnier':'Veranstaltung'):'Partie')+' '+({edit:'bearbeiten',delete:'löschen',close:'abschließen'}[action]);
  document.querySelector('#admin-dialog-title').textContent=title;
  document.querySelector('#admin-dialog-error').textContent='';
  document.querySelector('#admin-dialog-save').textContent=action==='edit'?'Änderungen speichern':action==='delete'?(entity==='event'?(item.kind==='Turnier'?'Turnier löschen':'Veranstaltung löschen'):'Spiel löschen'):'Veranstaltung abschließen';
  let content='';
  if(action==='edit'&&entity==='event') {
    content=field('Name','name',item.name,'text','maxlength="100"')+selectField('Format','kind',item.kind,[['Liga','Liga'],['Turnier','Turnier']])+field('Datum','date',item.date,'date');
  } else if(action==='edit') {
    content=participantSelectors(item)+'<p>Abgeschlossene Partien sind nach Warnbestätigung korrigierbar. Nach Gesamtabschluss bleiben Status und Veranstaltungszuordnung erhalten.</p>'+selectField('Veranstaltung','event_id',item.event_id,state.events.filter(e=>e.id===item.event_id || (state.events.find(v=>v.id===item.event_id)?.status==='open' && e.status==='open')).map(e=>[e.id,e.name]))+
      '<div class="form-row">'+field('Spieler A','player_a',item.player_a,'text','maxlength="302"')+field('Spieler B','player_b',item.player_b,'text','maxlength="302"')+'</div>'+
      '<div class="form-row">'+selectField('Disziplin','discipline',item.discipline,['8-Ball','9-Ball','10-Ball','14/1'].map(v=>[v,v]))+selectField('Gewinner Ausstoßen','lag_winner',item.lag_winner??'',[['','Noch nicht erfasst'],['a',item.player_a],['b',item.player_b]])+field(item.discipline==='14/1'?'Spielziel (Punkte)':'Gewinnspiele','target',item.target,'number','min="1" max="'+(item.discipline==='14/1'?999:99)+'"')+selectField('Erstes Break','first',item.first,[['a','Spieler A'],['b','Spieler B']])+'</div>'+
      '<div class="form-row">'+field('Punkte A','a',item.a,'number','min="0" max="'+item.target+'"')+field('Punkte B','b',item.b,'number','min="0" max="'+item.target+'"')+'</div>'+
      '<div class="form-row">'+selectField('Status','status',item.status,state.events.find(e=>e.id===item.event_id)?.status==='closed'?[['finished','Abgeschlossen']]:Object.entries(labels))+selectField('Tisch','table_no',item.table_no??'',[['','Kein Tisch'],...Array.from({length:Math.max(tableCount(),item.table_no || 0)},(_,i)=>[i+1,'Tisch '+(i+1)])])+'</div>'+
      '<label>'+ (item.pin_set ? 'Neue Tablet-PIN (leer lassen zum Beibehalten)' : 'Tablet-PIN nachtragen') +'<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off"></label>'+
      '<small>Geplant: 0:0 und kein Tisch. Am Tisch: freier Tisch erforderlich. Abgeschlossen: genau ein Spieler hat das Spielziel erreicht.</small>';
  } else {
    const name=entity==='event'?item.name:item.player_a+' / '+item.player_b;
    content='<p><strong>'+esc(name)+'</strong></p>';
    if(action==='delete')content+='<p>Dieser Eintrag wird gelöscht.'+(entity==='event'?' Sämtliche zugehörigen Partien und Ergebnisse werden ebenfalls gelöscht ('+quantity(item.match_count??state.matches.filter(m=>m.event_id===item.id).length,'Partie','Partien')+').':'')+' Belegte Tische werden freigegeben. Diese Aktion kann in der Oberfläche nicht rückgängig gemacht werden.</p>';
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
  const run=async()=>{
    await api('/api/'+(entity==='event'?'events':'matches')+'/'+item.id+'/'+action,payload);
    if(entity==='event'&&action==='delete') {
      selectedEventId=null;view='spieltage';history.replaceState(null,'','/#spieltage');
      drafts.delete('match');tournamentPanels.delete(item.id);tournamentSections.delete(item.id);
      tournamentScrolls.delete(String(item.id));tournamentManualPanels.delete(String(item.id));
      for(const id of drafts.keys())if(id.startsWith('tournament-')&&id.endsWith('-'+item.id))drafts.delete(id);
    }
    adminDialog.close();
  };
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  if(action!=='edit' || (entity==='event'?(item.status==='closed'||item.date<today):(item.status==='finished'||parent?.status==='closed'))) {
    const phrase=entity==='event'?{edit:'EVENT ÄNDERN',delete:'EVENT LÖSCHEN',close:'EVENT ABSCHLIESSEN'}[action]:{edit:'SPIEL ÄNDERN',delete:'SPIEL LÖSCHEN'}[action];
    payload.action=entity+':'+action; payload.confirmation=phrase;
    const name=entity==='event'?item.name:item.player_a+' / '+item.player_b;
    const summary='<p><strong>'+esc(name)+' · #'+item.id+'</strong></p>'+(action==='edit'?changeSummary(item,data):document.querySelector('#admin-dialog-content').innerHTML);
    showWarning({phrase,label:document.querySelector('#admin-dialog-save').textContent,summary,valid,run,success:entity==='event'&&action==='delete'?(item.kind==='Turnier'?'Turnier':'Veranstaltung')+' „'+item.name+'“ wurde gelöscht.':undefined});
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
    '<h2>Buchungshistorie</h2>'+rentalPage.controls+'<div class="rental-history"><table><thead><tr><th>Buchung / Tisch</th><th>Start / Ende</th><th>Dauer / Abrechnung</th><th>Preisvereinbarung</th><th>Gesamt / Status</th><th>Aktionen</th></tr></thead><tbody>'+rentalPage.items.map(r=>'<tr><td>#'+r.id+' · Tisch '+r.table_no+'</td><td>'+rentalDate(r.started_at)+'<br>'+rentalDate(r.ended_at)+'</td><td>'+(r.status==='active'?rentalRunning(r):duration(r.duration_ms)+'<br>'+quantity(r.billed_minutes,'Minute','Minuten'))+'</td><td>'+euro(r.hourly_cents)+'/h<br>Grundpreis '+euro(r.base_cents)+'/h<br>'+(r.adjustment_percent===null?'Direktpreis':esc(r.adjustment_percent)+' %')+'</td><td>'+(r.status==='active'?'Laufend':euro(r.total_cents)+'<br>Abgeschlossen')+'</td><td>'+(r.status==='finished'?'<button data-rental-edit="'+r.id+'">Buchung korrigieren</button>':'')+'<button data-rental-delete="'+r.id+'">Buchung löschen</button></td></tr>').join('')+'</tbody></table>'+(rentals.length?'':'<p>Noch keine Buchungen vorhanden.</p>')+'</div>';
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
      showWarning({phrase:null,label:'Vermietung abschließen',summary:identity+'<p>Endzeitpunkt: '+rentalDate(ended_at)+'<br>Dauer: '+duration(price.duration_ms)+'<br>Abrechnung: '+quantity(price.billed_minutes,'Minute','Minuten')+'<br>Gesamtbetrag: <strong>'+euro(price.total_cents)+'</strong></p><p>Dieser Endzeitpunkt und Betrag werden gespeichert; der Tisch wird freigegeben. Abbrechen lässt die Vermietung weiterlaufen.</p>',valid,run:()=>api('/api/rentals/'+r.id+'/finish',{version:r.version,ended_at,action:'rental:finish'})});
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
  for(const m of filtered.filter(m=>m.status==='finished'))for(const side of ['a','b'])if(belongs(m,side)){const other=side==='a'?'b':'a';count++;wins+=Number(m[side]>m[other]);losses+=Number(m[side]<m[other]);won+=racks(m,side);lost+=racks(m,other);}
  if(state.statistics)({count,wins,losses,won,lost}=state.statistics);
  const mp=paginate(filtered,'player-matches','Zugeordnete Partien');
  const teamView=view==='mannschaften';
  const playerRows=page.items.map(p=>{
    const memberships=state.team_players.filter(tp=>tp.player_id===p.id).map(tp=>teams.find(t=>t.id===tp.team_id)?.name).filter(Boolean);
    const profile=p.nuliga_profile?'<a class="button" href="'+esc(p.nuliga_profile)+'" target="_blank" rel="noopener noreferrer">nuLiga-Profil ↗</a>':'<span class="muted">Kein nuLiga-Profil zugeordnet</span>';
    return '<tr><th scope="row">'+esc(fullName(p))+'</th><td>'+memberships.map(esc).join(', ')+'</td><td>'+(p.active?'Aktiv':'Archiviert')+'</td><td class="registry-actions"><button data-registry="player" data-id="'+esc(p.id)+'">Bearbeiten</button> '+(p.is_bsv?'<button data-stat="players" data-id="'+esc(p.id)+'">Partien &amp; Statistik</button> ':'')+profile+'</td></tr>';
  }).join('');
  const teamRows=teamPage.items.map(t=>'<tr><th scope="row">'+esc(t.name)+'</th><td>'+state.team_players.filter(tp=>tp.team_id===t.id).map(tp=>esc(fullName(players.find(p=>p.id===tp.player_id)))).join(', ')+'</td><td>'+(t.active?'Aktiv':'Archiviert')+'</td><td class="registry-actions"><button data-registry="team" data-id="'+esc(t.id)+'">Bearbeiten</button> '+(t.nuliga_profile?'<a class="button" href="'+esc(t.nuliga_profile)+'" target="_blank" rel="noopener noreferrer">nuLiga-Mannschaft ↗</a>':'<span class="muted">Kein nuLiga-Profil zugeordnet</span>')+'</td></tr>').join('');
  root.innerHTML='<div class="page-title"><h1>'+(teamView?'Mannschaften':'Spieler')+'</h1></div><section class="panel"><button data-registry="'+(teamView?'team':'player')+'">'+(teamView?'Mannschaft':'Spieler')+' anlegen</button>'+(teamView?'':'<form id="player-search"><label>Spieler suchen (Name, Mannschaft oder ID)<input name="q" value="'+esc(playerSearch)+'"></label><button>Suchen</button></form>')+(teamView?teamPage.controls:page.controls)+'<div class="registry-list"><table><thead><tr><th>'+(teamView?'Mannschaft':'Spieler')+'</th><th>'+(teamView?'Spieler':'Mannschaft')+'</th><th>Status</th><th>Aktionen</th></tr></thead><tbody>'+(teamView?teamRows:playerRows)+'</tbody></table></div></section>';
  if(!teamView)root.innerHTML += '<section class="panel"><h2>Partien &amp; Statistik'+(entity?' · '+esc(entity.name||fullName(entity)):'')+'</h2><p>Zeitraum nach Spieltagsdatum. Nur abgeschlossene Partien zählen als Ergebnisse. Mannschaftswerte zählen die zugeordneten Spielerseiten der Einzelpartien.</p><form id="stats-filter">'+selectField('Übersicht','kind',f.kind,[['players','Spieler'],['teams','Mannschaften']])+selectField('Eintrag','id',f.id,[['','Bitte auswählen'],...(f.kind==='players'?players:teams).map(p=>[p.id,(p.name||fullName(p))+' · ID '+p.id])])+'<div class="form-row"><label>Von<input type="date" name="from" value="'+esc(f.from)+'"></label><label>Bis<input type="date" name="to" value="'+esc(f.to)+'"></label></div>'+selectField('Disziplin','discipline',f.discipline,[['','Alle'],...['8-Ball','9-Ball','10-Ball','14/1'].map(d=>[d,d])])+'<button>Auswerten</button></form><p><strong>'+quantity(count,'Ergebnis','Ergebnisse')+' · '+quantity(wins,'Sieg','Siege')+' · '+quantity(losses,'Niederlage','Niederlagen')+' · Racks '+won+' : '+lost+'</strong></p><p>14/1: Je 10 gelochte Kugeln zählen als 1 Rack; Restpunkte werden je Partie abgerundet.</p>'+mp.controls+matchRows(mp.items,true)+'</section>';
}
let registryDialog;
function openRegistry(title,content) {
  if(!registryDialog){registryDialog=document.createElement('dialog');registryDialog.id='registry-dialog';registryDialog.setAttribute('aria-labelledby','registry-title');document.body.append(registryDialog);}
  registryDialog.innerHTML='<h2 id="registry-title">'+esc(title)+'</h2>'+content+'<p id="registry-error" role="alert"></p><button type="button" id="registry-cancel">Abbrechen</button>';
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
  if(b.dataset.stat){statsFilter={...statsFilter,kind:b.dataset.stat,id:b.dataset.id};resetStatsDraft=true;drafts.delete('stats-filter');listPages.delete('player-matches');return refresh(true);}
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
  const formId=form.getAttribute?.('id')??form.id;
  if(formId==='player-search'){playerSearch=form.elements.q.value;listPages.delete('players');playersDashboard();return true;}
  if(formId==='stats-filter'){statsFilter=Object.fromEntries(new FormData(form));resetStatsDraft=true;listPages.delete('player-matches');return refresh(true);}
  if(!formId.startsWith('registry-'))return false;
  if(busy)return true;
  const data=Object.fromEntries(new FormData(form));data.version=Number(data.version);
  if(formId==='registry-participants') {
    data.team_ids=new FormData(form).getAll('team_ids').filter(Boolean);data.player_ids=[];data.assignments={};data.start=form.dataset.start==='true';data.guests=[];
    for(const input of form.querySelectorAll('[data-guest-team]'))if(input.value.trim())data.guests.push({name:input.value.trim(),team_id:input.dataset.guestTeam});
    for(const [key,value] of new FormData(form))if(key.startsWith('assignment:')&&value!=='exclude'){const id=key.slice(11);data.player_ids.push(id);if(value!=='none')data.assignments[id]=value;}
  } else {data.active=Number(data.active);data.allow_duplicate=data.allow_duplicate==='yes';data.player_ids=new FormData(form).getAll('player_ids');}
  busy=true;
  api(formId==='registry-participants'?'/api/events/'+data.event_id+'/participants':formId==='registry-player'?'/api/players':'/api/teams',data).then(()=>{registryDialog.close();if(formId==='registry-participants'){selectedEventId=Number(data.event_id);view='spieltage';history.replaceState(null,'','/#spieltage/'+data.event_id);message('Teilnehmer bestätigt. Jetzt Spieler und Tische für die erste Runde zuweisen.');}else message('Gespeichert.');}).catch(error=>{registryDialog.querySelector('#registry-error').textContent=error.message;}).finally(async()=>{busy=false;await refresh(true);});
  return true;
}
root.addEventListener('change',e=>{if((e.target.form?.getAttribute?.('id')??e.target.form?.id)==='stats-filter' && e.target.name==='kind'){statsFilter={...statsFilter,kind:e.target.value,id:''};resetStatsDraft=true;drafts.delete('stats-filter');listPages.delete('player-matches');return refresh(true);}});

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

function freeTables() {
  return Array.from({length:tableCount()},(_,i)=>i+1).filter(n=>!state.matches.some(m=>m.status==='live'&&m.table_no===n)&&!(state.rentals||[]).some(r=>r.status==='active'&&r.table_no===n));
}
function tournamentTableLink(m) {return m?.status==='live'?' · <a href="/tisch/'+m.table_no+'">Tisch '+m.table_no+' öffnen ↗</a>':'';}
function updateTournamentSelection(form) {
  if(!form)return;
  const targetLabel=form.querySelector?.('[data-tournament-target-label]');
  if(targetLabel)targetLabel.textContent=form.elements.namedItem('discipline')?.value==='14/1'?'Punkte':'Gewinnspiele';
  const filter=form.elements.namedItem('participant_filter')?.value||'all';
  const search=(form.elements.namedItem('participant_search')?.value||'').trim().toLocaleLowerCase('de');
  const mode=form.elements.namedItem('mode')?.value,hasGroups=!['ko','swiss'].includes(mode);
  for(const key of ['groupCount','qualifiers','assignment']) {
    const control=form.elements.namedItem(key);if(!control)continue;
    const visible=key==='qualifiers'?mode==='groups-ko':hasGroups;
    control.disabled=!visible;const label=control.closest?.('label');if(label)label.hidden=!visible;
  }
  for(const row of form.querySelectorAll('[data-tournament-player]')) {
    row.hidden=(filter!=='all'&&row.dataset.membership!==filter)||!(row.dataset.name||'').toLocaleLowerCase('de').includes(search);
    const showGroup=hasGroups&&row.querySelector('input[name="player_ids"]').checked;
    row.querySelector('[data-group-choice]').hidden=!showGroup;
    row.querySelector('[data-group-choice] input').disabled=!showGroup;
  }
}
root.addEventListener('input',e=>{if(e.target.name==='participant_search')updateTournamentSelection(e.target.form);});
root.addEventListener('change',e=>{const form=e.target.closest?.('form[data-action="preview"]');if(form?.dataset?.action==='preview'){if(e.target.name?.startsWith('group:'))form.elements.namedItem('assignment').value='manual';updateTournamentSelection(form);}});
function tournamentBoard(event) {
  const t=event.tournament,p=event.tournamentPreview,config=p||t;
  const ms=state.matches.filter(m=>m.event_id===event.id),canDraw=event.status==='open'&&!ms.some(m=>m.status!=='planned');
  const rules={difference:'Siege → Rack-/Punktedifferenz → erzielte Racks/Punkte → Entscheidung der Spielleitung mit Begründung',wins:'Siege → Entscheidung der Spielleitung mit Begründung'};
  const form=(action)=>'id="tournament-'+action+'-'+event.id+'" data-action="'+action+'" data-event="'+event.id+'" data-version="'+event.version+'"';
  const versionField='<input type="hidden" name="version" value="'+event.version+'">';
  const name=(draw,id)=>id?esc(draw.players.find(p=>p.id===id)?.name||id):'Noch offen';
  function drawView(draw,preview=false) {
    let out='<p>'+esc(({groups:'Gruppenphase',ko:'Einfach-KO','groups-ko':'Gruppenphase + KO',swiss:'Schweizer System'})[draw.mode])+' · '+esc(draw.discipline)+' · Spielziel '+draw.target+'</p><p><strong>Rangfolge:</strong> '+(draw.mode==='swiss'?'Siege → Buchholz → '+(draw.rules==='difference'?'Rack-/Punktedifferenz → erzielte Racks/Punkte → ':'')+'Entscheidung der Spielleitung mit Begründung':rules[draw.rules])+'.'+(draw.mode==='groups-ko'?' Die ersten '+draw.qualifiers+' je Gruppe qualifizieren sich. KO-Setzung: Rang für Rang, Gruppen abwechselnd vorwärts/rückwärts; Freilose zuerst.':'')+'</p>';
    if(draw.mode==='swiss') {
      out+='<p>'+Math.ceil(Math.log2(draw.players.length))+' Runden. Die nächste Runde entsteht nach allen bestätigten Ergebnissen der Vorrunde. Paarungen bevorzugen ähnliche Siegzahlen; keine wiederholten Gegner oder Freilose. Ein Freilos zählt als Sieg ohne Racks/Punkte. Rangfolge: Siege → Buchholz (Summe der Siege gespielter Gegner) → vereinbarte Feinwertung → begründete Entscheidung der Spielleitung.</p>';
      if(!preview) {
        const tab=draw.tables[0];
        out+='<h3>Gesamtrangliste</h3><div class="tournament-scroll"><table><thead><tr><th>Rang</th><th>Spieler</th><th>Spiele</th><th>Siege</th><th>Buchholz</th><th>Freilose</th><th>Racks/Punkte</th><th>Differenz</th></tr></thead><tbody>'+tab.rows.map((r,n)=>'<tr><td>'+(n+1)+(tab.tied?' *':'')+'</td><td>'+name(draw,r.id)+'</td><td>'+r.played+'</td><td>'+r.wins+'</td><td>'+r.buchholz+'</td><td>'+r.byes+'</td><td>'+r.for+':'+r.against+'</td><td>'+r.difference+'</td></tr>').join('')+'</tbody></table></div>';
        if(tab.complete&&tab.tied&&event.status==='open')out+='<form '+form('resolve')+'>'+versionField+'<input type="hidden" name="group" value="0"><p>Reihenfolge für verbleibende Gleichstände festlegen. Die sportlichen Kriterien haben Vorrang.</p>'+tab.rows.map((r,n)=>selectField('Entscheidungsrang '+(n+1),'order',r.id,tab.rows.map(x=>[x.id,draw.players.find(p=>p.id===x.id).name]))).join('')+field('Begründung','reason','','text','maxlength="500"')+'<button>Gleichstand verbindlich entscheiden</button></form>';
        if(draw.resolutions[0])out+='<p>Entscheidung: '+esc(draw.resolutions[0].reason)+'</p>';
      }
    }
    draw.groups.forEach((g,i)=>{
      out+='<section class="panel"><h3>Gruppe '+(i+1)+'</h3>';
      if(preview)out+='<p>'+g.players.map(id=>name(draw,id)).join(' · ')+'</p><ul>'+g.games.map(game=>'<li>'+name(draw,game.a)+' – '+name(draw,game.b)+'</li>').join('')+'</ul>';
      else {
        const tab=draw.tables[i];out+='<div class="tournament-scroll"><table><thead><tr><th>Rang</th><th>Spieler</th><th>Spiele</th><th>Siege</th><th>Racks/Punkte</th><th>Differenz</th><th>Qualifikation</th></tr></thead><tbody>'+tab.rows.map((r,n)=>'<tr><td>'+(n+1)+(tab.tied?' *':'')+'</td><td>'+name(draw,r.id)+'</td><td>'+r.played+'</td><td>'+r.wins+'</td><td>'+r.for+':'+r.against+'</td><td>'+r.difference+'</td><td>'+(draw.mode==='groups-ko'&&n<draw.qualifiers?(tab.complete&&!tab.tied?'Qualifiziert':'Vorläufig'):'–')+'</td></tr>').join('')+'</tbody></table></div>';
        out+='<ul>'+g.games.map(game=>{const m=ms.find(m=>m.id===game.match);return '<li>Partie #'+game.match+': '+name(draw,game.a)+' – '+name(draw,game.b)+' · '+(m?m.a+':'+m.b+' ('+labels[m.status]+')':'Ausstehend')+tournamentTableLink(m)+'</li>';}).join('')+'</ul>';
        if(tab.tied)out+='<p>* Punktgleiche Ränge sind vorläufig. Vor der Qualifikation muss die Spielleitung verbleibende Gleichstände auflösen.</p>';
        if(tab.complete&&tab.tied&&!draw.rounds.length&&event.status==='open')out+='<form '+form('resolve').replace('id="tournament-resolve-','id="tournament-resolve-'+i+'-')+'>'+versionField+'<input type="hidden" name="group" value="'+i+'"><p>Reihenfolge für Gleichstände festlegen. Die gewählte Rangfolgeregel hat weiterhin Vorrang.</p>'+tab.rows.map((r,n)=>selectField('Entscheidungsrang '+(n+1),'order',r.id,tab.rows.map(x=>[x.id,draw.players.find(p=>p.id===x.id).name]))).join('')+field('Begründung (z. B. Entscheidungsspiel)','reason','','text','maxlength="500"')+'<button>Gleichstand verbindlich entscheiden</button></form>';
        if(draw.resolutions[i])out+='<p>Entscheidung: '+esc(draw.resolutions[i].reason)+' · '+draw.resolutions[i].order.map(id=>name(draw,id)).join(' → ')+'</p>';
      }
      out+='</section>';
    });
    if(draw.rounds.length)out+='<h3>'+(draw.mode==='swiss'?'Schweizer Runden':'KO-Baum')+'</h3><div class="tournament-bracket">'+draw.rounds.map((round,r)=>'<section><h4>'+(draw.mode!=='swiss'&&r===draw.rounds.length-1?'Finale':'Runde '+(r+1))+'</h4>'+round.map((game,i)=>{const m=ms.find(m=>m.id===game.match);return '<article class="panel"><small>Paarung '+(i+1)+(r&&draw.mode!=='swiss'?' · Sieger aus '+(2*i+1)+' / '+(2*i+2)+' der Vorrunde':'')+'</small><p>'+name(draw,game.a)+'<br>'+(!game.b?(draw.mode==='swiss'?'Freilos · 1 Sieg':'Freilos → weiter'):name(draw,game.b))+'</p>'+(m?'<strong>'+m.a+' : '+m.b+'</strong><p>Partie #'+m.id+' · '+labels[m.status]+tournamentTableLink(m)+'</p>':'')+'</article>';}).join('')+'</section>').join('')+'</div>';
    if(draw.champion)out+='<p class="pill">Turniersieger: '+name(draw,draw.champion)+'</p>';
    if(draw.complete)out+='<p>Sportlicher Turnierablauf abgeschlossen. Gesamtabschluss oben bestätigen.</p>';
    return out;
  }
  let html='';
  if(canDraw){const chosen=new Set(config?.players.map(p=>p.id)||state.event_players.filter(p=>p.event_id===event.id).map(p=>p.player_id));
    html+='<details data-tournament-panel="'+event.id+'" '+((tournamentPanels.get(event.id)??!config)?'open':'')+'><summary>Teilnehmer und Regeln · neue Auslosung</summary><form id="tournament-player-'+event.id+'" data-event="'+event.id+'"></form><form '+form('preview')+'>'+versionField+'<div class="form-row">'+selectField('Modus','mode',config?.mode||'groups-ko',[['groups-ko','Gruppen + KO'],['groups','Nur Gruppen'],['ko','Nur KO'],['swiss','Schweizer System']])+selectField('Disziplin','discipline',config?.discipline||'9-Ball',['8-Ball','9-Ball','10-Ball','14/1'].map(x=>[x,x]))+field('<span data-tournament-target-label>'+((config?.discipline||'9-Ball')==='14/1'?'Punkte':'Gewinnspiele')+'</span>','target',config?.target||5,'number','min="1" max="999"')+'</div><div class="form-row">'+field('Gruppenanzahl (bei Gruppen)','groupCount',config?.groupCount||2,'number','min="1" max="32"')+field('Qualifikanten je Gruppe (bei Gruppen + KO)','qualifiers',config?.qualifiers||2,'number','min="1" max="64"')+'</div>'+selectField('Rangfolge und Gleichstand','rules',config?.rules||'difference',Object.entries(rules))+'<p>Jeder gegen jeden innerhalb einer Gruppe. Restgleichstände werden nach Abschluss der Gruppen ausdrücklich mit Begründung entschieden. Maximal 64 Teilnehmer; jede Gruppe mindestens zwei.</p>'+selectField('Gruppenzuweisung','assignment','random',[['random','Zufällig'],['manual','Manuell']])+'<p>Bei ausgewählten Spielern erscheint das Gruppenfeld. Das Ändern einer Gruppennummer aktiviert die manuelle Zuweisung für alle Teilnehmer. Bei „Zufällig“ werden die eingegebenen Nummern nicht verwendet. Nur KO wird zufällig ausgelost.</p><fieldset><legend>Teilnehmer aus den Spieler-Stammdaten</legend><details data-tournament-manual="'+event.id+'"><summary>Spieler manuell anlegen</summary><p>Wird als externer Stammdatenspieler gespeichert und für dieses Turnier ausgewählt.</p>'+field('Vorname','first_name','','text','maxlength="100" form="tournament-player-'+event.id+'"')+field('Nachname','last_name','','text','maxlength="100" form="tournament-player-'+event.id+'"')+'<button type="submit" form="tournament-player-'+event.id+'">Spieler anlegen und auswählen</button></details>'+selectField('Teilnehmer filtern','participant_filter','all',[['all','Alle'],['bsv','BSV-Mitglieder'],['external','Externe Spieler']])+'<label>Teilnehmer suchen<input name="participant_search" type="search" placeholder="Name suchen" autocomplete="off"></label>'+'<div class="tournament-players" data-tournament-scroll="'+event.id+'">'+state.players.filter(p=>p.active&&!p.event_id).sort((a,b)=>fullName(a).localeCompare(fullName(b),'de')).map(p=>'<div data-tournament-player data-name="'+esc(fullName(p))+'" data-membership="'+(p.is_bsv?'bsv':'external')+'"><label><input type="checkbox" name="player_ids" value="'+esc(p.id)+'" '+(chosen.has(p.id)?'checked':'')+'>'+esc(fullName(p))+'</label><label data-group-choice hidden>Gruppe: <input aria-label="Gruppe für '+esc(fullName(p))+'" type="number" name="group:'+esc(p.id)+'" min="1" max="32" value="'+((config?.groups.findIndex(g=>g.players.includes(p.id))??-1)+1||1)+'" disabled></label></div>').join('')+'</div></fieldset><button class="primary">Auslosung als Vorschau</button></form></details>';
  }
  if(p&&canDraw)html+='<section class="panel"><h3>Auslosungsvorschau · noch nicht übernommen</h3>'+drawView(p,true)+'<form '+form('confirm')+'>'+versionField+'<label>Tablet-PIN für Turnierpartien<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required autocomplete="off"></label><p>Bestätigung ersetzt eine bisherige Auslosung und ihre noch nicht gestarteten Partien. Danach unter „Partien &amp; Tische“ die Tische zuweisen.</p><button class="primary">Diese Auslosung verbindlich übernehmen</button></form></section>';
  if(!canDraw&&t)html+='<h3>Teilnehmer und Regeln</h3><p>'+esc(t.discipline)+' · '+(t.discipline==='14/1'?'Punkte':'Gewinnspiele')+': '+t.target+'</p><p>Teilnehmer und Regeln sind nach Turnierbeginn festgelegt. Die Rangfolge steht unter „Rangliste“.</p><ul>'+[...t.players].sort((a,b)=>a.name.localeCompare(b.name,'de')).map(p=>'<li>'+esc(p.name)+'</li>').join('')+'</ul>';
  const active=tournamentSections.get(event.id)||(t&&!p?'matches':'settings');
  const tabs=[['matches','Partien & Tische'],['ranking','Rangliste'],['settings','Teilnehmer & Regeln']];
  const sections={matches:'<h3>Partien & Tische</h3>'+(t?matchRows(ms.sort((a,b)=>a.id-b.id)):'<p>Zuerst die Auslosung unter „Teilnehmer & Regeln“ erstellen und verbindlich übernehmen. Danach hier die Partien Tischen zuweisen.</p>'),ranking:t?drawView(t):'<p>Die Rangliste erscheint nach Übernahme der Auslosung.</p>',settings:html||'<p>Teilnehmer und Regeln sind nach Turnierbeginn festgelegt.</p>'};
  return '<section class="tournament"><h2>Turnierverwaltung</h2><nav class="event-sections" aria-label="Turnierbereiche">'+tabs.map(([key,label])=>'<button type="button" data-tournament-section="'+key+'" aria-pressed="'+(active===key)+'">'+label+'</button>').join('')+'</nav>'+tabs.map(([key,label])=>'<section data-event-section="'+key+'" aria-label="'+label+'" '+(active===key?'':'hidden')+'>'+sections[key]+'</section>').join('')+'</section>';

}

function inventoryHidden(name,value) { return '<input type="hidden" name="'+name+'" value="'+esc(value)+'">'; }
function inventoryMetadata(d,action) { return inventoryHidden('action',action)+inventoryHidden('version',d.version)+inventoryHidden('drink_id',d.id)+inventoryHidden('operation_id',crypto.randomUUID()); }
function inventoryField(label,name,value,type="text",extra="") { return field(label,name,value,type,extra).replace("<input ",'<input aria-label="'+esc(label)+'" '); }
function inventoryOptionalField(...args) { return inventoryField(...args).replace(/ required>/,"> "); }
function inventorySelectField(label,name,value,options) { return selectField(label,name,value,options).replace("<select ",'<select aria-label="'+esc(label)+'" '); }
function inventoryDrinkFields(d) {
  return inventoryField('Bezeichnung','name',d.name||'','text','required maxlength="100"')+inventoryField('Flaschengröße (ml)','size_ml',d.size_ml??500,'number','min="1" max="100000" step="1" required')+inventoryField('VK pro Flasche (€)','sale_euros',d.sale_cents===undefined?'':(d.sale_cents/100).toFixed(2),'number','min="0" max="10000" step="0.01" required')+inventoryOptionalField('EK pro Flasche (€), optional','purchase_euros',d.purchase_cents==null?'':(d.purchase_cents/100).toFixed(2),'number','min="0" max="10000" step="0.01"')+inventoryField('Mindestbestand (Flaschen)','minimum',d.minimum??0,'number','min="0" max="1000000000" step="1" required')+inventorySelectField('Zustand','active',d.active??1,[[1,'Aktiv'],[0,'Archiviert']]);
}
function inventoryStatus(d) { return !d.active?'archived':d.stock===0?'empty':d.stock<d.minimum?'low':'sufficient'; }
function inventoryMatches(d,filters=inventoryFilters) {
  const missing=Math.max(0,d.minimum-d.stock),low=Boolean(d.active&&missing);
  const band=(value,preset)=>!preset||preset==='zero'&&value===0||preset==='positive'&&value>0||preset==='1-12'&&value>=1&&value<=12||preset==='13-24'&&value>=13&&value<=24||preset==='25+'&&value>=25;
  const sale=!filters.sale||filters.sale==='free'&&d.sale_cents===0||filters.sale==='paid'&&d.sale_cents>0||filters.sale==='up-to-250'&&d.sale_cents<=250||filters.sale==='over-250'&&d.sale_cents>250;
  const purchase=!filters.purchase||filters.purchase==='unknown'&&d.purchase_cents===null||filters.purchase==='known'&&d.purchase_cents!==null||filters.purchase==='free'&&d.purchase_cents===0||filters.purchase==='paid'&&d.purchase_cents>0;
  const status=!filters.status||filters.status==='active'&&d.active||filters.status==='empty-low'&&['empty','low'].includes(inventoryStatus(d))||filters.status===inventoryStatus(d);
  const shortfall=!filters.missing||filters.missing==='none'&&d.active&&missing===0||filters.missing==='any'&&low||filters.missing==='1-6'&&d.active&&missing>=1&&missing<=6||filters.missing==='7+'&&d.active&&missing>=7;
  return (!filters.name||d.name.toLocaleLowerCase('de-DE').includes(filters.name.trim().toLocaleLowerCase('de-DE')))&&(!filters.size||d.size_ml===Number(filters.size))&&sale&&purchase&&status&&shortfall&&(filters.stock==='low'?low:band(d.stock,filters.stock))&&band(d.minimum,filters.minimum);
}
function inventoryStockRows(drinks) {
  return drinks.length?drinks.map(d=>'<tr data-inventory-open="'+esc(d.id)+'"><th scope="row"><button type="button" class="inventory-drink-link" data-inventory-open="'+esc(d.id)+'" aria-label="'+esc(d.name)+' bearbeiten">'+esc(d.name)+'</button></th><td>'+d.size_ml+' ml</td><td>'+euro(d.sale_cents)+'</td><td>'+(d.purchase_cents===null?'Unbekannt':euro(d.purchase_cents))+'</td><td><strong>'+d.stock+' Flaschen</strong></td><td>'+d.minimum+' Flaschen</td><td>'+(d.active?Math.max(0,d.minimum-d.stock)+' Flaschen':'–')+'</td><td><span class="pill inventory-status-'+inventoryStatus(d)+'">'+({empty:'Leer',low:'Nachbestellen',sufficient:'Ausreichend',archived:'Archiviert'}[inventoryStatus(d)])+'</span></td></tr>').join(''):'<tr><td colspan="8">Keine Getränke für diese Filter gefunden.</td></tr>';
}
function updateInventoryStockRows() {
  const drinks=state.inventory?.drinks||[],filtered=drinks.filter(d=>inventoryMatches(d));
  document.querySelector('#inventory-stock-rows').innerHTML=inventoryStockRows(filtered);
  document.querySelector('#inventory-filter-count').textContent=filtered.length+' von '+drinks.length+' Getränken';
}
function inventoryDashboard() {
  const inv=state.inventory||{drinks:[],packages:[],movements:[]};
  let html='<div class="page-title inventory-title"><div><h1>Lagerverwaltung</h1><p>Getränk in der Bestandstabelle anklicken, um Bestand, Stammdaten oder Gebinde zu bearbeiten.</p></div><button type="button" class="primary" id="inventory-new-button">Getränk anlegen</button></div><nav class="inventory-menu" aria-label="Lagerverwaltung"><button type="button" data-inventory-section="stock" '+(inventorySection==='stock'?'aria-current="page"':'')+'>Lagerbestand</button><button type="button" data-inventory-section="movements" '+(inventorySection==='movements'?'aria-current="page"':'')+'>Lagerbewegungen</button></nav>';
  if(inventorySection==='movements')html+=inventoryMovementHistory(inv);
  else {
    const active=inv.drinks.filter(d=>d.active),filtered=inv.drinks.filter(d=>inventoryMatches(d));
    const select=(key,label,options)=>'<label><span class="sr-only">'+label+' filtern</span><select data-inventory-filter="'+key+'" aria-label="'+label+' filtern">'+[['','Alle'],...options].map(([value,text])=>'<option value="'+esc(value)+'" '+(String(inventoryFilters[key]||'')===String(value)?'selected':'')+'>'+esc(text)+'</option>').join('')+'</select></label>';
    const bands=[['zero','0 Flaschen'],['positive','Mehr als 0'],['1-12','1–12 Flaschen'],['13-24','13–24 Flaschen'],['25+','Ab 25 Flaschen']];
    const sizes=[...new Set(inv.drinks.map(d=>d.size_ml))].sort((a,b)=>a-b).map(size=>[size,size+' ml']);
    html+='<section class="panel inventory-stock" aria-labelledby="inventory-stock-title"><div class="section-title"><div><h2 id="inventory-stock-title">Lagerbestand</h2><p>'+quantity(active.length,'aktives Getränk','aktive Getränke')+' · <strong>'+active.reduce((sum,d)=>sum+d.stock,0)+' Flaschen insgesamt</strong> · '+active.filter(d=>d.stock<d.minimum).length+' unter Mindestbestand</p></div><button type="button" id="inventory-filter-reset">Filter zurücksetzen</button></div>';
    html+='<p id="inventory-filter-count" role="status">'+filtered.length+' von '+inv.drinks.length+' Getränken</p><div class="rental-history"><table class="inventory-table"><thead><tr>'+['Getränk','Flaschengröße','VK / Flasche','EK / Flasche','Aktueller Bestand','Mindestbestand','Fehlmenge','Status'].map(title=>'<th scope="col">'+title+'</th>').join('')+'</tr><tr class="inventory-filter-row"><th><label><span class="sr-only">Getränk filtern</span><input type="search" data-inventory-filter="name" aria-label="Getränk filtern" placeholder="Name suchen …" list="inventory-name-presets" value="'+esc(inventoryFilters.name||'')+'"></label><datalist id="inventory-name-presets">'+inv.drinks.map(d=>'<option value="'+esc(d.name)+'">').join('')+'</datalist></th><th>'+select('size','Flaschengröße',sizes)+'</th><th>'+select('sale','VK',[['free','0,00 €'],['paid','Kostenpflichtig'],['up-to-250','Bis 2,50 €'],['over-250','Über 2,50 €']])+'</th><th>'+select('purchase','EK',[['unknown','Unbekannt'],['known','Bekannt'],['free','0,00 €'],['paid','Über 0,00 €']])+'</th><th>'+select('stock','Bestand',[['low','Unter Mindestbestand'],...bands])+'</th><th>'+select('minimum','Mindestbestand',bands)+'</th><th>'+select('missing','Fehlmenge',[['none','Keine'],['any','Nachbestellen'],['1-6','1–6 Flaschen'],['7+','Ab 7 Flaschen']])+'</th><th>'+select('status','Status',[['active','Aktiv'],['archived','Archiviert'],['empty-low','Leer + Nachbestellen'],['empty','Leer'],['low','Nachbestellen'],['sufficient','Ausreichend']])+'</th></tr></thead><tbody id="inventory-stock-rows">'+inventoryStockRows(filtered)+'</tbody></table></div>';
    if(!inv.drinks.length)html+='<p>Noch keine Getränke angelegt. Über „Getränk anlegen“ beginnen und anschließend im Overlay den Anfangsbestand erfassen. Jedes neue Getränk startet mit 0 Flaschen.</p>';
    html+='</section>';
  }
  root.innerHTML=html;
}
function inventoryMovementHistory(inv) {
  return '<section class="panel"><h2>Lagerbewegungen</h2><p>Letzte 200 Bewegungen. Die vollständige Historie bleibt in Datenbank und Sicherung erhalten. Gegenbuchungen sind auch für ältere Bewegungsnummern möglich.</p><div class="rental-history"><table><thead><tr><th>Nr. / Zeitpunkt</th><th>Getränk / Gebinde bei Buchung</th><th>Art / Flaschen</th><th>VK / EK pro Flasche</th><th>Grund / Bezug</th></tr></thead><tbody>'+inv.movements.map(m=>{const s=JSON.parse(m.snapshot);return '<tr><td>#'+m.id+'<br>'+esc(new Date(m.created_at).toLocaleString('de-DE'))+'</td><td>'+esc(s.name)+' · '+s.size_ml+' ml<br>'+esc(s.package_name||'Einzelflaschen')+' · '+s.bottles+' Flaschen/Gebinde</td><td>'+esc(inventoryKinds[m.kind])+'<br>'+(m.quantity>0?'+':'')+m.quantity+'</td><td>'+euro(s.sale_cents)+' / '+(s.purchase_cents===null?'unbekannt':euro(s.purchase_cents))+'</td><td>'+esc(m.reason)+(m.reverses?'<br>Gegenbuchung zu #'+m.reverses:'')+'</td></tr>';}).join('')+'</tbody></table></div><h3>Bewegung gegenbuchen</h3><form id="inventory-reverse">'+inventoryHidden('action','movement')+inventoryHidden('version',inv.drinks[0]?.version??0)+inventoryHidden('operation_id',crypto.randomUUID())+inventoryHidden('kind','reversal')+inventorySelectField('Getränk','drink_id',inv.drinks[0]?.id||'',inv.drinks.map(d=>[d.id,d.name]))+inventoryField('Bewegungsnummer','reverses','','number','min="1" step="1" required')+inventoryField('Pflichtbegründung','reason','','text','required maxlength="500"')+'<button '+(inv.drinks.length?'':'disabled')+'>Gegenbuchung verbindlich buchen</button></form></section>';
}
function openInventoryDrink(id) {
  if(busy)return;
  const d=(state.inventory?.drinks||[]).find(d=>d.id===id);
  if(id!=='new'&&!d)return;
  inventoryEditId=id;
  document.querySelector('#inventory-dialog-title').textContent=d?d.name+' · '+d.size_ml+' ml':'Getränk anlegen';
  document.querySelector('#inventory-dialog-error').textContent='';
  const packs=(state.inventory?.packages||[]).filter(p=>p.drink_id===id);
  let html=d?'<p><strong>'+d.stock+' Flaschen</strong> · Mindestbestand '+d.minimum+' · VK '+euro(d.sale_cents)+' · EK '+(d.purchase_cents===null?'unbekannt':euro(d.purchase_cents))+' · '+(d.active?'Aktiv':'Archiviert')+'</p>':'';
  if(d?.active&&d.stock<d.minimum)html+='<p role="status">Mindestbestand unterschritten: '+(d.minimum-d.stock)+' Flaschen fehlen.</p>';
  if(d)html+='<nav class="inventory-menu" aria-label="Getränk bearbeiten"><button type="button" data-inventory-editor="stock" '+(!d.active?'disabled':'')+'>Bestand buchen</button><button type="button" data-inventory-editor="drink">Stammdaten</button><button type="button" data-inventory-editor="packages" '+(!d.active?'disabled':'')+'>Gebinde ('+packs.length+')</button></nav>';
  html+='<section data-inventory-editor-panel="drink"><h3>Stammdaten</h3><form id="inventory-'+(d?'drink-'+d.id:'new')+'">'+(d?inventoryMetadata(d,'drink')+inventoryHidden('id',d.id):inventoryHidden('action','drink')+inventoryHidden('operation_id',crypto.randomUUID()))+inventoryDrinkFields(d||{})+'<button class="primary">'+(d?'Stammdaten speichern':'Getränk anlegen')+'</button></form></section>';
  if(d?.active){
    html+='<section data-inventory-editor-panel="stock"><h3>Bestand buchen</h3><p>Bestandsänderungen werden als nachvollziehbare Lagerbewegung gespeichert.</p><form id="inventory-move-'+d.id+'" data-stock="'+d.stock+'">'+inventoryMetadata(d,'movement')+inventorySelectField('Bewegungsart','kind','receipt',Object.entries(inventoryKinds).filter(([k])=>k!=='reversal'))+inventorySelectField('Gebinde','package_id','',[['','Nur Einzelflaschen'],...packs.map(p=>[p.id,p.name+' ('+p.bottles+' Flaschen)'])])+inventoryField('Anzahl Gebinde','packages',0,'number','min="0" max="1000000000" step="1" required')+inventoryField('Einzelflaschen zusätzlich','singles',0,'number','min="0" max="1000000000" step="1" required')+inventorySelectField('Richtung bei Inventurdifferenz','direction',1,[[1,'Zugang'],[-1,'Abgang']])+inventoryOptionalField('Tatsächlicher EK pro Flasche (€), optional','purchase_euros',d.purchase_cents===null?'':(d.purchase_cents/100).toFixed(2),'number','min="0" max="10000" step="0.01"')+inventoryOptionalField('Begründung (Pflicht bei Bruch, Eigenverbrauch, Inventurdifferenz)','reason','','text','maxlength="500"')+'<p data-inventory-preview aria-live="polite">Menge zur Vorschau eingeben.</p><button class="primary">Lagerbewegung verbindlich buchen</button></form></section>';
    html+='<section data-inventory-editor-panel="packages"><h3>Gebinde verwalten</h3>'+[...packs,{id:'',name:'',bottles:20}].map(p=>'<form class="inventory-package-form" id="inventory-pack-'+(p.id||d.id)+'"><h4>'+(p.id?esc(p.name):'Neues Gebinde')+'</h4>'+inventoryMetadata(d,'package')+inventoryHidden('id',p.id)+inventoryField('Gebindename','name',p.name,'text','required maxlength="100"')+inventoryField('Flaschen pro Gebinde','bottles',p.bottles,'number','min="1" max="1000000" step="1" required')+'<button>'+(p.id?'Gebinde ändern':'Gebinde anlegen')+'</button></form>').join('')+'</section>';
  }
  document.querySelector('#inventory-dialog-content').innerHTML=html;
  selectInventoryEditor(d?.active?'stock':'drink');
  if(!inventoryDialog.open)inventoryDialog.showModal();
}
function selectInventoryEditor(name) {
  for(const panel of inventoryDialog.querySelectorAll('[data-inventory-editor-panel]'))panel.hidden=panel.dataset.inventoryEditorPanel!==name;
  for(const button of inventoryDialog.querySelectorAll('[data-inventory-editor]')){if(button.dataset.inventoryEditor===name)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
}
function updateInventoryMovementPreview(event) {
  if(view!=='lager')return;
  const form=event.target.closest?.('form[id^="inventory-move-"]');if(!form)return;
  const data=Object.fromEntries(new FormData(form)),p=state.inventory.packages.find(p=>p.id===data.package_id);
  const reason=form.elements?.namedItem?.('reason');if(reason)reason.required=['breakage','own_use','adjustment'].includes(data.kind);
  let amount=Number(data.packages)*(p?.bottles||1)+Number(data.singles);
  if(['consumption','breakage','own_use'].includes(data.kind)||data.kind==='adjustment'&&data.direction==='-1')amount=-amount;
  form.querySelector('[data-inventory-preview]').textContent=(amount>0?'+':'')+amount+' Flaschen → '+(Number(form.dataset.stock)+amount)+' Flaschen Bestand';
}
root.addEventListener('input',event=>{
  if(view!=='lager')return;
  const key=event.target.dataset?.inventoryFilter;
  if(key==='name'){inventoryFilters[key]=event.target.value;updateInventoryStockRows();}
});
root.addEventListener('change',event=>{
  if(view!=='lager')return;
  const key=event.target.dataset?.inventoryFilter;
  if(key){inventoryFilters[key]=event.target.value;updateInventoryStockRows();}
  if(event.target.name==='drink_id'&&(event.target.form?.getAttribute?.('id')??event.target.form?.id)==='inventory-reverse')event.target.form.elements.version.value=state.inventory.drinks.find(d=>d.id===event.target.value)?.version??0;
});
root.addEventListener('click',event=>{
  if(view!=='lager'||busy)return;
  const target=event.target.closest?.('[data-inventory-open]');
  if(target?.dataset.inventoryOpen){openInventoryDrink(target.dataset.inventoryOpen);return;}
  const button=event.target.closest?.('button');if(!button)return;
  if(button.id==='inventory-new-button')openInventoryDrink('new');
  if(button.id==='inventory-filter-reset'){inventoryFilters={};inventoryDashboard();}
  if(button.dataset.inventorySection){saveDrafts();inventorySection=button.dataset.inventorySection;inventoryDashboard();restoreDrafts();}
});
inventoryDialog.addEventListener('input',updateInventoryMovementPreview);
inventoryDialog.addEventListener('submit',event=>{event.preventDefault();handleInventorySubmit(event.target);});
inventoryDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
inventoryDialog.addEventListener('click',async event=>{
  const button=event.target.closest?.('button');if(!button||busy)return;
  if(button.id==='inventory-dialog-close')inventoryDialog.close();
  if(button.dataset.inventoryEditor)selectInventoryEditor(button.dataset.inventoryEditor);
  if(button.id==='inventory-dialog-reload'){await refresh(true);openInventoryDrink(inventoryEditId);}
});
inventoryDialog.addEventListener('close',()=>{
  const target=[...root.querySelectorAll('button[data-inventory-open]')].find(button=>button.dataset.inventoryOpen===inventoryEditId)||root.querySelector('#inventory-new-button');
  target?.focus();
});
function handleInventorySubmit(form) {
  if(view!=='lager')return false;
  const formId=form.getAttribute?.('id')??form.id;
  if(typeof formId!=='string'||!formId.startsWith('inventory-'))return false;
  if(busy)return true;
  const data=Object.fromEntries(new FormData(form));
  const cents=value=>{if(value==='')return null;if(!/^\d+(?:\.\d{1,2})?$/.test(value))throw Error('Bitte einen Preis mit höchstens zwei Nachkommastellen eingeben.');return Math.round(Number(value)*100);};
  const save=async()=>{
    busy=true;document.querySelector('#inventory-dialog-error').textContent='';
    const controls=[...inventoryDialog.querySelectorAll('button')].map(button=>[button,button.disabled]);
    for(const [button] of controls)button.disabled=true;
    try{
      const payload={...data};
      for(const name of ['version','size_ml','minimum','active','bottles','packages','singles','direction','reverses'])if(name in payload)payload[name]=Number(payload[name]);
      if('sale_euros' in payload){payload.sale_cents=cents(payload.sale_euros);delete payload.sale_euros;}
      if('purchase_euros' in payload){payload.purchase_cents=cents(payload.purchase_euros);delete payload.purchase_euros;}
      await api('/api/inventory',payload);drafts.delete(formId);form.remove();
      if(inventoryDialog.open)inventoryDialog.close();message('Lageränderung gespeichert.');
    }catch(error){document.querySelector('#inventory-dialog-error').textContent=error.message;message(error.message);}
    finally{busy=false;for(const [button,disabled] of controls)button.disabled=disabled;await refresh(true);}
  };
  save();return true;
}

const root = document.querySelector('#app'), connection = document.querySelector('#connection');
const table = Number(/^\/tisch\/([1-8])$/.exec(location.pathname)?.[1]);
if (table) document.body.classList.add('kiosk');
if (table && location.hash) history.replaceState(null, '', location.pathname);
let setupChoice, clockOffset=0;
let csrf = '', state, current, busy = false, pendingFinish;
const navigation = document.querySelector('#admin-nav');
const finishDialog = document.querySelector('#finish-dialog');
const views = { uebersicht: ['Tischübersicht', 'Alle acht Tische und laufenden Partien im Blick.'], spieltage: ['Spieltagsverwaltung', 'Veranstaltungen anlegen, Begegnungen planen und Tische zuweisen.'], ergebnisse: ['Ergebnisse', 'Abgeschlossene Partien und ihre gespeicherten Endstände.'] };
let view = Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'uebersicht';
const drafts = new Map();
function saveDrafts() { for (const form of root.querySelectorAll('form')) if (form.id && !['login','tablet-login'].includes(form.id)) drafts.set(form.id, [...new FormData(form)]); }
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
  if(result.match?.server_now) clockOffset=result.match.server_now-Date.now();
  if(result.matches?.[0]?.server_now) clockOffset=result.matches[0].server_now-Date.now();
  return result;
}
function login() {
  state = undefined; navigation.hidden = true;
  root.innerHTML = `<section class="login"><div class="login-copy"><p class="eyebrow">WILLKOMMEN IM VEREIN</p><h1>Der nächste Stoß.<br>Alles im Blick.</h1><p>Spieltage organisieren. Begegnungen starten.<br>Spielstände direkt am Tisch erfassen.</p><form id="login"><label>Administrator-Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Anmelden →</button></form><small>Die Tablets öffnen ihre eigene Tisch-Adresse.</small></div><div class="login-badge"><img src="/assets/bsv-logo.png" alt="BSV Pfaffenhofen · Vereinslogo seit 1995"></div></section>`;
  connection.textContent = 'Vereinsverwaltung'; connection.className = ''; document.querySelector('#logout').hidden = true;
}
function dashboard() {
  const live = state.matches.filter(m => m.status === 'live');
  document.querySelector('#logout').hidden = false;
  navigation.hidden = false;
  for (const link of navigation.querySelectorAll('a')) { if (link.hash === '#' + view) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); }
  const visibleMatches = state.matches.filter(m => view === 'ergebnisse' ? m.status === 'finished' : view === 'spieltage' ? true : m.status === 'live');
  root.innerHTML = `<div class="page-title"><div><p class="eyebrow">SPIELBETRIEB</p><h1>${views[view][0]}</h1><p>${views[view][1]}</p></div><span class="pill">${live.length} / 8 Tische belegt</span></div>
    <section ${view === 'uebersicht' ? '' : 'hidden'}><div class="section-title"><h2>Unsere Tische</h2><span>Live-Spielstände · alle 3 Sekunden</span></div><section class="tables">${Array.from({length:8}, (_,i) => {
      const m = live.find(m => m.table_no === i + 1);
      return `<a href="/tisch/${i+1}" class="table-card ${m ? 'occupied' : ''}"><div><strong>TISCH ${String(i+1).padStart(2,'0')}</strong><span class="dot ${m ? 'active' : ''}"></span></div>${m ? `<p>${esc(m.discipline)} · Race to ${m.target}</p><div class="mini-score"><span>${esc(m.player_a)}</span><b>${m.a}</b></div><div class="mini-score"><span>${esc(m.player_b)}</span><b>${m.b}</b></div>${timers(m)}<small>● Break: ${m.setup_done ? esc(m[m.breaker === 'a' ? 'player_a' : 'player_b']) : 'Noch offen'}</small>` : '<div class="free">Bereit für die nächste Partie</div><small>Frei verfügbar ↗</small>'}</a>`;
    }).join('')}</section></section>
    <section class="planning" ${view === 'spieltage' ? '' : 'hidden'}><div class="panel"><p class="eyebrow">01 · VERANSTALTUNG</p><h2>Spieltag anlegen</h2><form id="event"><label>Name<input name="name" maxlength="100" placeholder="z. B. Bezirksliga · 3. Spieltag" required></label><div class="form-row"><label>Format<select name="kind"><option>Liga</option><option>Turnier</option></select></label><label>Datum<input name="date" type="date" required></label></div><button class="primary">Veranstaltung anlegen</button></form></div>
    <div class="panel"><p class="eyebrow">02 · BEGEGNUNG</p><h2>Die nächste Partie</h2><form id="match"><label>Veranstaltung<select name="event_id" required><option value="">Bitte auswählen</option>${state.events.filter(e=>e.status === 'open').map(e => `<option value="${e.id}">${esc(e.date)} · ${esc(e.name)} (${esc(e.kind)})</option>`).join('')}</select></label><div class="form-row"><label>Spieler A<input name="player_a" maxlength="100" required></label><label>Spieler B<input name="player_b" maxlength="100" required></label></div><div class="form-row"><label>Disziplin<select name="discipline"><option>8-Ball</option><option>9-Ball</option><option>10-Ball</option></select></label><label>Gewinnspiele<input name="target" type="number" value="5" min="1" max="99" required></label></div><label>Tablet-PIN (6 Ziffern)<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><button class="primary" ${state.events.some(e=>e.status === 'open') ? '' : 'disabled'}>Begegnung planen</button></form></div></section>
    <section ${view === 'spieltage' ? '' : 'hidden'}><div class="section-title"><h2>Veranstaltungen</h2></div><div class="event-list">${state.events.map(eventCard).join('') || '<p>Noch keine Veranstaltungen angelegt.</p>'}</div></section><div class="section-title"><h2>${view === 'ergebnisse' ? 'Abgeschlossene Partien' : view === 'spieltage' ? 'Alle Begegnungen' : 'Laufende Partien'}</h2><span>${visibleMatches.length} Partien</span></div><section id="matches">${matchRows(visibleMatches)}</section>`;
}
function matchRows(matches) {
  return matches.map(m => `<article class="match-row"><div><span class="pill ${m.status === 'live' ? 'green' : ''}">${labels[m.status]}</span><h3>${esc(m.player_a)} <span class="muted">vs.</span> ${esc(m.player_b)}</h3><p>${esc(state.events.find(e => e.id === m.event_id)?.name)} · ${esc(m.discipline)} · Ziel ${m.target}${m.table_no ? ' · Tisch ' + m.table_no : ''}</p></div><strong class="result">${m.a} : ${m.b}</strong>${m.status === 'planned' ? `<form class="start" data-id="${m.id}"><label>Tisch<select name="table_no">${Array.from({length:8},(_,i) => `<option value="${i+1}">Tisch ${i+1}</option>`).join('')}</select></label><button>Tisch zuweisen ↗</button></form>` : m.status === 'live' ? `<div class="match-actions"><a href="/tisch/${m.table_no}">Punkte bearbeiten ↗</a>${finishButton(m)}${Math.max(m.a,m.b) < m.target ? '<small>Abschluss ab Erreichen des Spielziels</small>' : '<small>Spielziel erreicht · bereit zum Abschluss</small>'}</div>` : ''}${m.pin_set ? '' : '<small>Tablet-PIN fehlt · bitte Partie bearbeiten</small>'}${timers(m)}${matchAdminActions(m)}</article>`).join('') || '<div class="empty">Keine Partien in dieser Ansicht.</div>';
}
function tabletLogin() {
  current=undefined; navigation.hidden=true; document.querySelector('#logout').hidden=true;
  if(root.querySelector('#tablet-login')) { root.querySelector('button').disabled=false; return; }
  root.innerHTML=`<section class="panel"><p class="eyebrow">TISCH ${table}</p><h1>Partie freischalten</h1><p>Die sechsstellige PIN erhaltet ihr von der Spielleitung.</p><form id="tablet-login"><label>Partie-PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required></label><button class="primary">Tisch freischalten</button></form></section>`;
}
function duration(ms) { const seconds=Math.max(0,Math.floor(ms/1000)); return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':'); }
function timers(m) {
  if(!m.setup_done) return '<p>Wartet auf Ausstoßen und erstes Break</p>';
  if(!m.started_at) return '<p>Spielzeit noch nicht erfasst (Bestand)</p>';
  return '<p class="match-timers">Partie: <strong data-time-base="'+m.elapsed_ms+'" data-time-since="'+(m.running_since??'')+'">'+duration(m.elapsed_ms+(m.running_since===null?0:Date.now()+clockOffset-m.running_since))+'</strong>'+(m.rack_since!==null?' · Runde: <strong data-time-base="0" data-time-since="'+m.rack_since+'">'+duration(Date.now()+clockOffset-m.rack_since)+'</strong>':'')+'</p>';
}
function tickTimers() { for(const el of document.querySelectorAll('[data-time-base]')) el.textContent=duration(Number(el.dataset.timeBase)+(el.dataset.timeSince===''?0:Date.now()+clockOffset-Number(el.dataset.timeSince))); }
function preparation(m) {
  if(setupChoice?.id!==m.id || setupChoice?.version!==m.version) setupChoice={id:m.id,version:m.version};
  const lag=setupChoice.lag;
  root.innerHTML=`<section class="panel"><p class="eyebrow">TISCH ${table} · SPIELVORBEREITUNG</p><h1>${lag?'Wer hat das erste Break?':'Wer hat das Ausstoßen (Lag) gewonnen?'}</h1><p>${esc(m.player_a)} gegen ${esc(m.player_b)}</p>${lag?'<p>Ausstoßen gewonnen: '+esc(m[lag==='a'?'player_a':'player_b'])+'</p>':''}<div class="dialog-actions">${['a','b'].map(side=>'<button class="primary" data-'+(lag?'begin':'lag')+'="'+side+'">'+esc(m[side==='a'?'player_a':'player_b'])+'</button>').join('')}</div>${lag?'<button data-setup-back>Zurück zum Ausstoßen</button>':''}<p>Die Zeitmessung beginnt mit der Bestätigung des ersten Breaks.</p></section>`;
}
function kiosk() {
  document.querySelector('#logout').hidden = true; navigation.hidden = true;
  if (!current) { root.innerHTML = `<div class="waiting"><p class="eyebrow">TISCH ${String(table).padStart(2,'0')}</p><img class="waiting-logo" src="/assets/bsv-logo.png" alt="BSV Pfaffenhofen"><h1>Bereit, wenn ihr es seid.</h1><p>Die nächste Begegnung erscheint hier automatisch,<br>sobald sie in der Verwaltung gestartet wird.</p></div>`; return; }
  if(!current.setup_done) { preparation(current); return; }
  const m = current, done = Math.max(m.a,m.b) === m.target;
  root.innerHTML = `<div class="score-heading"><span class="pill">TISCH ${String(table).padStart(2,'0')}</span><p>${esc(m.event_name)}</p><h2>${esc(m.discipline)} <span class="muted">/</span> Race to ${m.target}</h2>${timers(m)}</div><section class="scoreboard">${['a','b'].map(side => `<article class="player ${m.breaker === side && !done ? 'breaking' : ''}"><div class="break-label">${m.breaker === side && !done ? '● NÄCHSTES BREAK' : '&nbsp;'}</div><h1>${esc(m[side === 'a' ? 'player_a' : 'player_b'])}</h1><div class="points">${m[side]}</div><div class="score-controls"><button data-side="${side}" data-delta="-1" aria-label="Punkt bei Spieler ${side.toUpperCase()} zurücknehmen" ${m[side] === 0 || busy ? 'disabled' : ''}>−</button><button class="primary" data-side="${side}" data-delta="1" ${done || busy ? 'disabled' : ''}>+ Punkt</button></div></article>`).join('')}</section><p class="score-note">${done ? 'Spielziel erreicht · Endstand prüfen und Spiel abschließen.' : 'Wechselbreak · Nach jedem abgeschlossenen Rack wechselt das Anstoßrecht.'}</p><div class="finish-bar">${finishButton(m)}${!done ? '<small>Verfügbar, sobald das Spielziel erreicht ist.</small>' : ''}</div>`;
}
async function refresh(initial = false) {
  try {
    if (table) {
      // A logged-in administrator can also open the table view.
      try { const admin = await api('/api/admin'); csrf = admin.csrf; } catch(e) { if (e.status !== 401) throw e; }
      const data = await api(`/api/tables/${table}`);
      if(data.match) delete data.match.server_now; // Clock sync must not replace focused controls.
      if (initial || JSON.stringify(current) !== JSON.stringify(data.match)) { current = data.match; kiosk(); }
    } else {
      state = await api('/api/admin'); csrf = state.csrf;
      if (initial || !root.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') {
        saveDrafts(); dashboard(); restoreDrafts();
      }
    }
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
  e.preventDefault(); const form = e.target, data = Object.fromEntries(new FormData(form));
  mutate(async () => {
    if (form.id === 'tablet-login') { const result=await api(`/api/tables/${table}/login`,data); sessionStorage.setItem(`tablet-session:${table}`,result.token); form.reset(); }
    if (form.id === 'login') { const result = await api('/api/login', data); csrf = result.csrf; }
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
    pendingFinish = { ...m };
    document.querySelector('#finish-summary').textContent = m.player_a + ' ' + m.a + ' : ' + m.b + ' ' + m.player_b;
    finishDialog.showModal();
  }
});
document.querySelector('#finish-cancel').addEventListener('click', () => finishDialog.close());
finishDialog.addEventListener('close', () => pendingFinish = undefined);
document.querySelector('#finish-confirm').addEventListener('click', () => {
  if (!pendingFinish || busy) return;
  const m = pendingFinish; finishDialog.close();
  mutate(() => api('/api/matches/' + m.id + '/finish', { version:m.version }));
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
  return `<article class="event-card"><span class="pill">${esc(event.kind)} · ${closed?'Gesamtabschluss':'Offen'}</span><h3>${esc(event.name)}</h3><p>${esc(event.date)} · ${matches.length} Partien</p>${closed?'<p>Gesperrt · Ergebnisse endgültig</p>':`<div class="entity-actions"><button data-entity="event" data-action="edit" data-id="${event.id}">Veranstaltung bearbeiten</button><button data-entity="event" data-action="delete" data-id="${event.id}">Veranstaltung löschen</button><button class="primary" data-entity="event" data-action="close" data-id="${event.id}">Veranstaltung abschließen</button></div><small>${matches.filter(m=>m.status!=='finished').length} Partien noch nicht abgeschlossen</small>`}</article>`;
}
function matchAdminActions(m) {
  const event=state.events.find(e=>e.id===m.event_id);
  if(event?.status!=='open')return '<span class="pill">Veranstaltung gesperrt</span>';
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
  pendingAdmin={entity,action,item:{...item}};
  const title=(entity==='event'?'Veranstaltung':'Partie')+' '+({edit:'bearbeiten',delete:'löschen',close:'abschließen'}[action]);
  document.querySelector('#admin-dialog-title').textContent=title;
  document.querySelector('#admin-dialog-error').textContent='';
  document.querySelector('#admin-dialog-save').textContent=action==='edit'?'Änderungen speichern':action==='delete'?'Verbindlich löschen':'Gesamtabschluss bestätigen';
  let content='';
  if(action==='edit'&&entity==='event') {
    content=field('Name','name',item.name,'text','maxlength="100"')+selectField('Format','kind',item.kind,[['Liga','Liga'],['Turnier','Turnier']])+field('Datum','date',item.date,'date');
  } else if(action==='edit') {
    content='<p>Bis zum Gesamtabschluss sind auch beendete Partien korrigierbar. Zum Weiterspielen Status „Am Tisch“ wählen und einen freien Tisch zuweisen.</p>'+selectField('Veranstaltung','event_id',item.event_id,state.events.filter(e=>e.status==='open').map(e=>[e.id,e.name]))+
      '<div class="form-row">'+field('Spieler A','player_a',item.player_a,'text','maxlength="100"')+field('Spieler B','player_b',item.player_b,'text','maxlength="100"')+'</div>'+
      '<div class="form-row">'+selectField('Disziplin','discipline',item.discipline,['8-Ball','9-Ball','10-Ball'].map(v=>[v,v]))+selectField('Gewinner Ausstoßen','lag_winner',item.lag_winner??'',[['','Noch nicht erfasst'],['a',item.player_a],['b',item.player_b]])+field('Gewinnspiele','target',item.target,'number','min="1" max="99"')+selectField('Erstes Break','first',item.first,[['a','Spieler A'],['b','Spieler B']])+'</div>'+
      '<div class="form-row">'+field('Punkte A','a',item.a,'number','min="0" max="99"')+field('Punkte B','b',item.b,'number','min="0" max="99"')+'</div>'+
      '<div class="form-row">'+selectField('Status','status',item.status,Object.entries(labels))+selectField('Tisch','table_no',item.table_no??'',[['','Kein Tisch'],...Array.from({length:8},(_,i)=>[i+1,'Tisch '+(i+1)])])+'</div>'+
      '<label>'+ (item.pin_set ? 'Neue Tablet-PIN (leer lassen zum Beibehalten)' : 'Tablet-PIN nachtragen') +'<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off"></label>'+
      '<small>Geplant: 0:0 und kein Tisch. Am Tisch: freier Tisch erforderlich. Abgeschlossen: genau ein Spieler hat das Spielziel erreicht.</small>';
  } else {
    const name=entity==='event'?item.name:item.player_a+' / '+item.player_b;
    content='<p><strong>'+esc(name)+'</strong></p>';
    if(action==='delete')content+='<p>Dieser Eintrag wird gelöscht.'+(entity==='event'?' Alle '+state.matches.filter(m=>m.event_id===item.id).length+' zugehörigen Partien einschließlich ihrer Ergebnisse werden ebenfalls gelöscht.':'')+' Belegte Tische werden freigegeben. Diese Aktion kann in der Oberfläche nicht rückgängig gemacht werden.</p>';
    else content+='<p>Nach dem Gesamtabschluss sind Veranstaltung, Partien und Ergebnisse endgültig gesperrt. Alle Partien müssen zuvor abgeschlossen oder gelöscht sein. Bitte die Ergebnisse vorher prüfen.</p>';
  }
  document.querySelector('#admin-dialog-content').innerHTML=content;
  adminDialog.showModal();
});
document.querySelector('#admin-dialog-cancel').addEventListener('click',()=>adminDialog.close());
document.querySelector('#admin-edit-form').addEventListener('submit',async e=>{
  e.preventDefault(); if(!pendingAdmin||busy)return;
  const {entity,action,item}=pendingAdmin, data=Object.fromEntries(new FormData(e.target));
  if(entity==='match'&&action==='edit') {
    for(const key of ['event_id','target','a','b'])data[key]=Number(data[key]);
    data.lag_winner=data.lag_winner || null;
    data.table_no=data.table_no===''?null:Number(data.table_no);
  }
  busy=true; adminDialog.querySelectorAll('button').forEach(b=>b.disabled=true);
  try {
    await api('/api/'+(entity==='event'?'events':'matches')+'/'+item.id+'/'+action,{...data,version:item.version});
    adminDialog.close(); message('');
  } catch(error) { document.querySelector('#admin-dialog-error').textContent=error.message; }
  finally {busy=false; adminDialog.querySelectorAll('button').forEach(b=>b.disabled=false); await refresh(true);}
});

await refresh(true);
setInterval(() => { if (!busy) refresh(); }, 3000);

setInterval(tickTimers,1000);

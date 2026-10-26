const root = document.querySelector('#app'), connection = document.querySelector('#connection');
const table = Number(/^\/tisch\/([1-8])$/.exec(location.pathname)?.[1]);
if (table) document.body.classList.add('kiosk');
const fragment = new URLSearchParams(location.hash.slice(1));
if (table && fragment.has('key')) { sessionStorage.setItem(`table:${table}`, fragment.get('key')); history.replaceState(null, '', location.pathname); }
let csrf = '', state, current, busy = false;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const labels = { planned:'Geplant', live:'Am Tisch', finished:'Abgeschlossen' };
function message(value) { const el = document.querySelector('#message'); el.textContent = value; el.hidden = !value; }
async function api(path, data) {
  const headers = {};
  if (table) headers.Authorization = `Bearer ${sessionStorage.getItem(`table:${table}`) || ''}`;
  if (data) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf; }
  const res = await fetch(path, { method: data ? 'POST' : 'GET', headers, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(8000) });
  const result = await res.json();
  if (!res.ok) { const error = new Error(result.error); error.status = res.status; throw error; }
  return result;
}
function login() {
  root.innerHTML = `<section class="login"><p class="eyebrow">WILLKOMMEN IM VEREIN</p><h1>Der nächste Stoß.<br>Alles im Blick.</h1><p>Spieltage organisieren. Begegnungen starten.<br>Spielstände direkt am Tisch erfassen.</p><form id="login"><label>Administrator-Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Anmelden →</button></form><small>Die Tablets öffnen ihre eigene Tisch-Adresse.</small></section>`;
  connection.textContent = 'Vereinsverwaltung'; document.querySelector('#logout').hidden = true;
}
function dashboard() {
  const live = state.matches.filter(m => m.status === 'live');
  document.querySelector('#logout').hidden = false;
  root.innerHTML = `<div class="page-title"><div><p class="eyebrow">SPIELBETRIEB</p><h1>Gute Spiele beginnen hier.</h1><p>Spieltage, Turniere und alle acht Tische auf einen Blick.</p></div><span class="pill">${live.length} / 8 Tische belegt</span></div>
    <div class="section-title"><h2>Unsere Tische</h2><span>Live-Spielstände · alle 3 Sekunden</span></div><section class="tables">${Array.from({length:8}, (_,i) => {
      const m = live.find(m => m.table_no === i + 1);
      return `<a href="/tisch/${i+1}" class="table-card ${m ? 'occupied' : ''}"><div><strong>TISCH ${String(i+1).padStart(2,'0')}</strong><span class="dot ${m ? 'active' : ''}"></span></div>${m ? `<p>${esc(m.discipline)} · Race to ${m.target}</p><div class="mini-score"><span>${esc(m.player_a)}</span><b>${m.a}</b></div><div class="mini-score"><span>${esc(m.player_b)}</span><b>${m.b}</b></div><small>● Break: ${esc(m[m.breaker === 'a' ? 'player_a' : 'player_b'])}</small>` : '<div class="free">Bereit für die nächste Partie</div><small>Frei verfügbar ↗</small>'}</a>`;
    }).join('')}</section>
    <section class="planning"><div class="panel"><p class="eyebrow">01 · VERANSTALTUNG</p><h2>Spieltag anlegen</h2><form id="event"><label>Name<input name="name" maxlength="100" placeholder="z. B. Bezirksliga · 3. Spieltag" required></label><div class="form-row"><label>Format<select name="kind"><option>Liga</option><option>Turnier</option></select></label><label>Datum<input name="date" type="date" required></label></div><button class="primary">Veranstaltung anlegen</button></form></div>
    <div class="panel"><p class="eyebrow">02 · BEGEGNUNG</p><h2>Die nächste Partie</h2><form id="match"><label>Veranstaltung<select name="event_id" required><option value="">Bitte auswählen</option>${state.events.map(e => `<option value="${e.id}">${esc(e.date)} · ${esc(e.name)} (${esc(e.kind)})</option>`).join('')}</select></label><div class="form-row"><label>Spieler A<input name="player_a" maxlength="100" required></label><label>Spieler B<input name="player_b" maxlength="100" required></label></div><div class="form-row"><label>Disziplin<select name="discipline"><option>8-Ball</option><option>9-Ball</option><option>10-Ball</option></select></label><label>Gewinnspiele<input name="target" type="number" value="5" min="1" max="99" required></label><label>Erstes Break<select name="first"><option value="a">Spieler A</option><option value="b">Spieler B</option></select></label></div><button class="primary" ${state.events.length ? '' : 'disabled'}>Begegnung planen</button></form></div></section>
    <div class="section-title"><h2>Begegnungen</h2><span>${state.matches.length} Partien</span></div><section id="matches">${matchRows()}</section>`;
}
function matchRows() {
  return state.matches.map(m => `<article class="match-row"><div><span class="pill ${m.status === 'live' ? 'green' : ''}">${labels[m.status]}</span><h3>${esc(m.player_a)} <span class="muted">vs.</span> ${esc(m.player_b)}</h3><p>${esc(state.events.find(e => e.id === m.event_id)?.name)} · ${esc(m.discipline)} · Ziel ${m.target}${m.table_no ? ' · Tisch ' + m.table_no : ''}</p></div><strong class="result">${m.a} : ${m.b}</strong>${m.status === 'planned' ? `<form class="start" data-id="${m.id}"><label>Tisch<select name="table_no">${Array.from({length:8},(_,i) => `<option value="${i+1}">Tisch ${i+1}</option>`).join('')}</select></label><button>Starten ↗</button></form>` : m.status === 'live' && Math.max(m.a,m.b) === m.target ? `<button data-finish="${m.id}">Ergebnis bestätigen ✓</button>` : ''}</article>`).join('') || '<div class="empty">Noch keine Begegnungen. Lege eine Veranstaltung und die erste Partie an.</div>';
}
function kiosk() {
  document.querySelector('#logout').hidden = true;
  if (!current) { root.innerHTML = `<div class="waiting"><p class="eyebrow">TISCH ${String(table).padStart(2,'0')}</p><div class="ball">8</div><h1>Bereit, wenn ihr es seid.</h1><p>Die nächste Begegnung erscheint hier automatisch,<br>sobald sie in der Verwaltung gestartet wird.</p></div>`; return; }
  const m = current, done = Math.max(m.a,m.b) === m.target;
  root.innerHTML = `<div class="score-heading"><span class="pill">TISCH ${String(table).padStart(2,'0')}</span><p>${esc(m.event_name)}</p><h2>${esc(m.discipline)} <span class="muted">/</span> Race to ${m.target}</h2></div><section class="scoreboard">${['a','b'].map(side => `<article class="player ${m.breaker === side && !done ? 'breaking' : ''}"><div class="break-label">${m.breaker === side && !done ? '● NÄCHSTES BREAK' : '&nbsp;'}</div><h1>${esc(m[side === 'a' ? 'player_a' : 'player_b'])}</h1><div class="points">${m[side]}</div><div class="score-controls"><button data-side="${side}" data-delta="-1" aria-label="Punkt bei Spieler ${side.toUpperCase()} zurücknehmen" ${m[side] === 0 || busy ? 'disabled' : ''}>−</button><button class="primary" data-side="${side}" data-delta="1" ${done || busy ? 'disabled' : ''}>+ Punkt</button></div></article>`).join('')}</section><p class="score-note">${done ? 'Spielziel erreicht · Die Vereinsverwaltung bestätigt das Ergebnis. Korrekturen sind bis dahin möglich.' : 'Wechselbreak · Nach jedem abgeschlossenen Rack wechselt das Anstoßrecht.'}</p>`;
}
async function refresh(initial = false) {
  try {
    if (table) {
      // A logged-in administrator can also open the table view.
      try { const admin = await api('/api/admin'); csrf = admin.csrf; } catch(e) { if (e.status !== 401) throw e; }
      const data = await api(`/api/tables/${table}`);
      if (initial || JSON.stringify(current) !== JSON.stringify(data.match)) { current = data.match; kiosk(); }
    } else {
      state = await api('/api/admin'); csrf = state.csrf;
      if (initial || !document.querySelector('#event')) dashboard();
      else if (!root.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') {
        // Update score summaries without replacing forms or discarding user input.
        const oldForms = [...root.querySelectorAll('form')].map(f => ({ id:f.id, data:[...new FormData(f)] })).filter(f => f.id);
        dashboard(); for (const form of oldForms) for (const [name,value] of form.data) { const field = document.getElementById(form.id)?.elements.namedItem(name); if (field) field.value = value; }
      }
    }
    connection.textContent = '● Verbunden'; connection.className = 'online';
  } catch(e) {
    connection.textContent = '● Nicht verbunden'; connection.className = 'offline';
    if (!table && e.status === 401) login();
    else { message(e.message || 'Verbindung unterbrochen. Änderungen werden nicht offline gespeichert.'); root.querySelectorAll('[data-side]').forEach(b => b.disabled = true); if (table) current = undefined; }
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
    if (form.id === 'login') { const result = await api('/api/login', data); csrf = result.csrf; }
    if (form.id === 'event') await api('/api/events', data);
    if (form.id === 'match') await api('/api/matches', { ...data, event_id:Number(data.event_id), target:Number(data.target) });
    if (form.classList.contains('start')) { const m = state.matches.find(m => m.id === Number(form.dataset.id)); await api(`/api/matches/${m.id}/start`, { table_no:Number(data.table_no), version:m.version }); }
  });
});
root.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.side && current) { const m = current; mutate(() => api(`/api/matches/${m.id}/score`, { side:button.dataset.side, delta:Number(button.dataset.delta), version:m.version })); }
  if (button.dataset.finish) { const m = state.matches.find(m => m.id === Number(button.dataset.finish)); if (confirm(`Ergebnis ${m.a}:${m.b} für ${m.player_a} / ${m.player_b} verbindlich abschließen?`)) mutate(() => api(`/api/matches/${m.id}/finish`, { version:m.version })); }
});
document.querySelector('#logout').addEventListener('click', () => mutate(() => api('/api/logout', {})));
await refresh(true);
setInterval(() => { if (!busy) refresh(); }, 3000);

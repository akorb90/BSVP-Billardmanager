import { rentalPrice, hourlyRate } from '../public/rental-pricing.js';

export function migrateRentals(db) {
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE rental_settings(id INTEGER PRIMARY KEY CHECK(id=1), base_cents INTEGER NOT NULL DEFAULT 900, version INTEGER NOT NULL DEFAULT 0);
    INSERT INTO rental_settings(id) VALUES(1);
    CREATE TABLE rentals(id INTEGER PRIMARY KEY, table_no INTEGER NOT NULL CHECK(table_no BETWEEN 1 AND 8),
      started_at INTEGER NOT NULL, ended_at INTEGER, hourly_cents INTEGER NOT NULL, base_cents INTEGER NOT NULL,
      adjustment_percent REAL, duration_ms INTEGER, billed_minutes INTEGER, total_cents INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','finished')), version INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX rented_table ON rentals(table_no) WHERE status='active';
    PRAGMA user_version=5; COMMIT;`);
}

export function rentalService({db, transaction, fail, integer, log, activeTable}) {
  db.prepare("INSERT OR IGNORE INTO entity_ids(name,value) VALUES('rentals',(SELECT COALESCE(MAX(id),0) FROM rentals))").run();
  const confirm = (body, action, phrase) => {
    if(body.action !== action || (phrase && body.confirmation !== phrase)) throw fail(400,'Bitte die angezeigte Aktion bestätigen.');
  };
  const settings = () => db.prepare('SELECT * FROM rental_settings WHERE id=1').get();
  const occupied = number => db.prepare("SELECT id FROM rentals WHERE table_no=? AND status='active'").get(number);
  const get = id => {
    const item = db.prepare('SELECT * FROM rentals WHERE id=?').get(id);
    if (!item) throw fail(404, 'Buchung nicht gefunden.');
    return item;
  };
  const calculate = fn => { try { return fn(); } catch(e) { throw fail(400, e.message); } };
  return {
    occupied,
    state: () => ({rentals:db.prepare('SELECT * FROM rentals ORDER BY id DESC').all(), rental_settings:settings(), server_now:Date.now()}),
    handle(path, body) {
      return transaction(() => {
        if (path === '/api/rentals/settings') {
          const before=settings();
          if(body.version !== before.version) throw fail(409, 'Der Grundpreis wurde geändert. Bitte neu prüfen.');
          confirm(body,'rental:settings','GRUNDPREIS ÄNDERN');
          const base=calculate(()=>hourlyRate(900,'direct',body.base_euros));
          db.prepare('UPDATE rental_settings SET base_cents=?,version=version+1 WHERE id=1').run(base);
          log('admin','rental:settings',null,{before,after:settings()});
          return settings();
        }
        if (path === '/api/rentals') {
          const number=activeTable(body.table_no), base=settings();
          if (body.settings_version !== base.version) throw fail(409,'Der Grundpreis wurde geändert. Bitte den Preis erneut prüfen.');
          if (occupied(number) || db.prepare("SELECT id FROM matches WHERE table_no=? AND status='live'").get(number)) throw fail(409,'Dieser Tisch ist belegt.');
          if(body.discount!==undefined && (typeof body.discount!=='number' || !Number.isFinite(body.discount) || body.discount<0 || body.discount>100)) throw fail(400,'Rabatt muss zwischen 0 und 100 % liegen.');
          const mode=body.discount!==undefined?'percent':body.mode ?? 'direct', value=body.discount!==undefined?-body.discount:body.value ?? base.base_cents/100;
          const rate=calculate(()=>hourlyRate(base.base_cents,mode,value));
          const id=db.prepare("UPDATE entity_ids SET value=value+1 WHERE name='rentals' RETURNING value").get().value;
          db.prepare('INSERT INTO rentals(id,table_no,started_at,hourly_cents,base_cents,adjustment_percent) VALUES(?,?,?,?,?,?)').run(id,number,Date.now(),rate,base.base_cents,mode==='percent'?value:null);
          const item=get(id);
          log('admin','rental:start',null,{after:item});
          return item;
        }
        const route=/^\/api\/rentals\/(\d+)\/(finish|edit|delete)$/.exec(path);
        if (!route) throw fail(404,'Nicht gefunden.');
        const id=Number(route[1]), action=route[2], before=get(id);
        // Retry only the exact same completion; corrections invalidate old requests.
        if(action==='finish' && before.status==='finished' && body.version===before.version-1 && body.ended_at===before.ended_at) {
          confirm(body,'rental:finish'); return before;
        }
        if (body.version !== before.version) throw fail(409,'Die Buchung wurde zwischenzeitlich geändert. Bitte neu öffnen und erneut bestätigen.');
        if(action==='delete') {
          confirm(body,'rental:delete','BUCHUNG LÖSCHEN');
          db.prepare('DELETE FROM rentals WHERE id=?').run(id);
          log('admin','rental:delete',null,{before}); return {ok:true};
        } else if(action==='finish') {
          if(before.status!=='active') throw fail(409,'Die Buchung ist bereits abgeschlossen.');
          confirm(body,'rental:finish');
          const end=integer(body.ended_at,before.started_at,Date.now()), price=rentalPrice(before.started_at,end,before.hourly_cents);
          db.prepare("UPDATE rentals SET ended_at=?,duration_ms=?,billed_minutes=?,total_cents=?,status='finished',version=version+1 WHERE id=?").run(end,price.duration_ms,price.billed_minutes,price.total_cents,id);
        } else {
          if(before.status!=='finished') throw fail(409,'Nur abgeschlossene Buchungen können korrigiert werden.');
          if(body.confirmation !== 'BUCHUNG ÄNDERN' || body.action !== 'rental:edit') throw fail(400,'Bitte die Korrektur mit BUCHUNG ÄNDERN bestätigen.');
          const start=integer(body.started_at,0,Date.now()), end=integer(body.ended_at,start,Date.now());
          const rate=calculate(()=>hourlyRate(before.base_cents,body.mode,body.value));
          const price=calculate(()=>rentalPrice(start,end,rate));
          db.prepare('UPDATE rentals SET started_at=?,ended_at=?,hourly_cents=?,adjustment_percent=?,duration_ms=?,billed_minutes=?,total_cents=?,version=version+1 WHERE id=?').run(start,end,rate,body.mode==='percent'?body.value:null,price.duration_ms,price.billed_minutes,price.total_cents,id);
        }
        const after=get(id); log('admin','rental:'+action,null,{before,after}); return after;
      });
    }
  };
}

// Rebuild the two tables to widen SQLite CHECK constraints while preserving all rows.
export function migrateTables(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const name of ['matches', 'rentals']) {
      const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql;
      const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL").all(name);
      db.exec(sql.replace(/CREATE TABLE\s+"?\w+"?/i, `CREATE TABLE ${name}_expanded`).replace('table_no BETWEEN 1 AND 8', 'table_no BETWEEN 1 AND 20'));
      db.exec(`INSERT INTO ${name}_expanded SELECT * FROM ${name}; DROP TABLE ${name}; ALTER TABLE ${name}_expanded RENAME TO ${name};`);
      for (const index of indexes) db.exec(index.sql);
    }
    db.exec(`CREATE TABLE table_settings(id INTEGER PRIMARY KEY CHECK(id=1),table_count INTEGER NOT NULL CHECK(table_count BETWEEN 1 AND 20),version INTEGER NOT NULL CHECK(version>=0));
      INSERT INTO table_settings VALUES(1,8,0); PRAGMA user_version=8; COMMIT;`);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function tableService({db, transaction, fail, integer, log}) {
  const get = async () => await db.prepare('SELECT * FROM table_settings WHERE id=1').get();
  const activeNumber = async value => integer(value,1,(await get()).table_count);
  return {
    get, activeNumber,
    save: async body => await transaction(async () => {
      const before=await get(), count=integer(body.table_count,1,20);
      if (body.version !== before.version) throw fail(409,'Die Tischanzahl wurde zwischenzeitlich geändert. Bitte neu laden und erneut prüfen.');
      if (await db.prepare("SELECT 1 FROM matches WHERE status='live' AND table_no>? UNION ALL SELECT 1 FROM rentals WHERE status='active' AND table_no>?").get(count,count)) throw fail(409,'Ein entfallender Tisch ist noch belegt. Bitte zuerst die Partie oder Vermietung abschließen.');
      await db.prepare('UPDATE table_settings SET table_count=?,version=version+1 WHERE id=1').run(count);
      await log('admin','settings:tables',null,{before,after:await get()});
      return await get();
    })
  };
}

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

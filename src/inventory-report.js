// Calendar dates use the club's German civil time, including DST boundaries.
export function berlinMidnight(day) {
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw Error('Bitte gültige Kalenderdaten wählen.');
  const utc=Date.parse(day+'T00:00:00Z');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hourCycle:'h23'}).format(utc));
  return utc-hour*3600000;
}
export async function inventoryReport(db,from,to) {
  const start=berlinMidnight(from),last=berlinMidnight(to);
  if(last<start)throw Error('Der Endtag muss nach dem Starttag liegen.');
  const next=new Date(Date.parse(to)+86400000).toISOString().slice(0,10),end=berlinMidnight(next);
  const drinks=await db.prepare('SELECT * FROM inventory_drinks ORDER BY name,id').all();
  const movements=await db.prepare('SELECT * FROM inventory_movements ORDER BY id').all();
  const rows=drinks.map(d=>({id:d.id,name:d.name,active:d.active,minimum:d.minimum,stock:0,consumption:0,receipts:0,purchase_cents:0,unknown_purchase:0,known_purchase:0}));
  const byId=new Map(rows.map(r=>[r.id,r])),byMovement=new Map(movements.map(m=>[m.id,m]));
  for(const m of movements) {
    const row=byId.get(m.drink_id);row.stock+=m.quantity;
    const at=Date.parse(m.created_at);
    if(at<start||at>=end)continue;
    const original=m.kind==='reversal'?byMovement.get(m.reverses):m,sign=m.kind==='reversal'?-1:1;
    if(original.kind==='consumption')row.consumption-=m.quantity;
    if(original.kind==='receipt') {
      row.receipts+=m.quantity;
      const s=JSON.parse(original.snapshot),quantity=Math.abs(original.quantity)*sign;
      if(s.purchase_cents===null)row.unknown_purchase+=quantity;
      else {row.known_purchase+=quantity;row.purchase_cents+=quantity*s.purchase_cents;}
    }
  }
  const rentals=await db.prepare('SELECT * FROM rentals ORDER BY id').all(),positions=await db.prepare('SELECT p.*,m.quantity,m.snapshot FROM rental_drinks p JOIN inventory_movements m ON p.movement_id=m.id').all();
  const amount=r=>positions.filter(p=>p.rental_id===r.id&&p.cancelled_at===null).reduce((sum,p)=>sum-p.quantity*JSON.parse(p.snapshot).sale_cents,0);
  const finished=rentals.filter(r=>r.status==='finished'&&r.ended_at>=start&&r.ended_at<end);
  const audits=await db.prepare("SELECT id,at,action,detail FROM audit WHERE action IN ('rental:edit','rental:cancel','rental:drink') ORDER BY id DESC").all();
  const corrections=audits.flatMap(a=>{const d=JSON.parse(a.detail),r=finished.find(r=>r.id===(d.after?.id??d.id));return r&&(a.action==='rental:edit'||d.status==='finished')?[{id:a.id,at:a.at,action:a.action,rental_id:r.id}]:[];});
  return {from,to,time_zone:'Europe/Berlin',rows,rent_cents:finished.reduce((s,r)=>s+r.total_cents,0),drink_cents:finished.reduce((s,r)=>s+amount(r),0),finished_count:finished.length,open:rentals.filter(r=>r.status==='active').map(r=>({...r,drink_cents:amount(r)})),corrections};
}

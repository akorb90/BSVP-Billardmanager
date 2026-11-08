import {createHmac, randomBytes, randomUUID} from 'node:crypto';
import {rentalPrice} from '../public/rental-pricing.js';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>JSON.stringify(canonical(value));
export function validateRentalDrinks(data) {
  const movements=new Map(data.inventory_movements.map(m=>[m.id,m]));
  for(const o of data.rental_operations) {
    const request=JSON.parse(o.request),result=JSON.parse(o.result);
    if(!/^[\w-]{16,80}$/.test(o.id)||!data.rentals.some(r=>r.id===o.rental_id)||request.change?.operation_id!==o.id||result.id!==o.rental_id)throw Error('rental operation');
  }
  for(const r of data.rentals)if(r.comment!==null&&(typeof r.comment!=='string'||!r.comment.trim()||r.comment!==r.comment.trim()||r.comment.length>200))throw Error('rental comment');
  for(const p of data.rental_drinks) {
    const r=data.rentals.find(r=>r.id===p.rental_id),m=movements.get(p.movement_id),rev=movements.get(p.reversal_id);
    if(!r||!r.comment||!m||m.kind!=='consumption'||m.operation_id!==p.id)throw Error('rental drink reference');
    if(p.cancelled_at!==null&&(!Number.isSafeInteger(p.cancelled_at)||p.cancelled_at<Date.parse(m.created_at)||typeof p.reason!=='string'||!p.reason.trim()))throw Error('rental cancellation');
    if(p.returned===1&&(!rev||rev.reverses!==m.id))throw Error('rental return');
    if(data.inventory_movements.some(x=>x.reverses===m.id&&x.id!==p.reversal_id))throw Error('unlinked rental return');
  }
  for(const c of data.rental_checks) {
    const r=data.rentals.find(r=>r.id===c.rental_id),s=JSON.parse(c.snapshot),request=JSON.parse(c.request);
    if(!r||!Number.isSafeInteger(c.checked_at)||c.checked_at<0||c.version>r.version||s.rental_id!==r.id||s.version!==c.version||!Array.isArray(s.positions)||!s.positions.includes('rent')||new Set(s.positions).size!==s.positions.length||typeof request!=='object'||!request)throw Error('rental check');
    if(!Array.isArray(request.checked)||digest([...request.checked].sort())!==digest([...s.positions].sort())||request.version!==c.version-1||c.checked_at<s.ended_at)throw Error('rental check confirmation');
    if(s.positions.some(id=>id!=='rent'&&!data.rental_drinks.some(p=>p.id===id&&p.rental_id===r.id)))throw Error('rental checked position');
    const price=rentalPrice(s.started_at,s.ended_at,s.hourly_cents);
    if(!Array.isArray(s.lines)||s.lines.some(p=>{const linked=data.rental_drinks.find(x=>x.id===p.id&&x.rental_id===r.id),m=linked&&movements.get(linked.movement_id),v=m&&JSON.parse(m.snapshot);return !m||p.name!==v.name||p.quantity!==-m.quantity||p.sale_cents!==v.sale_cents||p.total_cents!==p.quantity*p.sale_cents;}))throw Error('rental historical snapshot');
    const active=s.lines.filter(p=>p.cancelled_at===null);
    if(digest([...s.positions].sort())!==digest(['rent',...active.map(p=>p.id)].sort())||s.drink_cents!==active.reduce((sum,p)=>sum+p.total_cents,0))throw Error('rental historical total');
    if(price.total_cents!==s.rent_cents||!Number.isSafeInteger(s.drink_cents)||s.drink_cents<0||s.total_cents!==s.rent_cents+s.drink_cents)throw Error('rental checked amount');
    if(c.version===r.version&&(r.status!=='finished'||r.comment!==s.comment||r.ended_at!==s.ended_at||r.total_cents!==s.rent_cents||r.started_at!==s.started_at||r.hourly_cents!==s.hourly_cents))throw Error('rental current check');
  }
  for(const r of data.rentals.filter(r=>r.status==='finished'&&data.rental_drinks.some(p=>p.rental_id===r.id))) {
    const c=data.rental_checks.find(c=>c.rental_id===r.id&&c.version===r.version),s=c&&JSON.parse(c.snapshot);
    const active=data.rental_drinks.filter(p=>p.rental_id===r.id&&p.cancelled_at===null);
    const sum=active.reduce((n,p)=>{const m=movements.get(p.movement_id);return n-m.quantity*JSON.parse(m.snapshot).sale_cents;},0);
    if(!s||s.drink_cents!==sum||digest([...s.positions].sort())!==digest(['rent',...active.map(p=>p.id)].sort()))throw Error('rental current positions');
  }
}

export function rentalDrinksService({db,fail,log,inventory}) {
  const secret=randomBytes(32);
  const sign=s=>createHmac('sha256',secret).update(digest(s)).digest('hex');
  const positions=async id=>(await db.prepare('SELECT p.*,m.quantity,m.snapshot,m.created_at FROM rental_drinks p JOIN inventory_movements m ON m.id=p.movement_id WHERE p.rental_id=? ORDER BY m.id').all(id)).map(p=>({...p,...JSON.parse(p.snapshot),quantity:-p.quantity,total_cents:-p.quantity*JSON.parse(p.snapshot).sale_cents}));
  const comment=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>200)throw fail(400,'Bitte einen Mietkommentar mit 1 bis 200 Zeichen ergänzen.');return value.trim();};
  const summary=async(r,end=r.ended_at??Date.now(),change=null)=>{
    let lines=(await positions(r.id)).map(({id,name,quantity,sale_cents,total_cents,cancelled_at})=>({id,name,quantity,sale_cents,total_cents,cancelled_at}));
    if(change?.kind==='cancel')lines=lines.map(p=>p.id===change.position_id?{...p,cancelled_at:1}:p);
    if(change?.kind==='drink') {
      if(lines.length>=1000)throw fail(409,'Maximal 1000 Getränkepositionen je Vermietung.');
      const d=await db.prepare('SELECT * FROM inventory_drinks WHERE id=?').get(change.drink_id);
      if(!d||!d.active||d.version!==change.drink_version)throw fail(409,'Getränk wurde geändert. Bitte neu laden.');
      if(!Number.isSafeInteger(change.quantity)||change.quantity<1||change.quantity>1000000)throw fail(400,'Ungültige Getränkemenge.');
      lines.push({id:change.operation_id,name:d.name,quantity:change.quantity,sale_cents:d.sale_cents,total_cents:d.sale_cents*change.quantity,cancelled_at:null});
    }
    const price=rentalPrice(r.started_at,end,r.hourly_cents),drink_cents=lines.filter(p=>p.cancelled_at===null).reduce((s,p)=>s+p.total_cents,0);
    return {rental_id:r.id,version:r.version,comment:r.comment,started_at:r.started_at,hourly_cents:r.hourly_cents,ended_at:end,...price,rent_cents:price.total_cents,drink_cents,total_cents:price.total_cents+drink_cents,positions:['rent',...lines.filter(p=>p.cancelled_at===null).map(p=>p.id)],lines,change};
  };
  const verify=(body,s)=>{
    const p=body.preview;
    if(!p||!p.summary||typeof p.summary!=='object'||p.signature!==sign(p.summary)||p.summary.version!==s.version||digest(p.summary)!==digest(s))throw fail(409,'Die Vorschau ist ungültig oder veraltet. Bitte erneut prüfen.');
    if(!Array.isArray(body.checked)||digest([...body.checked].sort())!==digest([...s.positions].sort()))throw fail(400,'Bitte Tischmiete und jede Getränkeposition einzeln bestätigen.');
  };
  const record=async(r,s,body)=>{
    const snapshot={...s,version:r.version,lines:s.lines.map(p=>({id:p.id,name:p.name,quantity:p.quantity,sale_cents:p.sale_cents,total_cents:p.total_cents,cancelled_at:p.cancelled_at}))};
    await db.prepare('INSERT INTO rental_checks VALUES(?,?,?,?,?,?)').run(randomUUID(),r.id,r.version,Date.now(),digest(snapshot),digest(body));
    await log('admin','rental:checked',null,{snapshot});
  };
  return {comment,positions,summary,verify,record,
    async retry(id,body) {
      return !!await db.prepare('SELECT 1 FROM rental_checks WHERE rental_id=? AND request=? AND version=(SELECT version FROM rentals WHERE id=?)').get(id,digest(body),id);
    },
    async handle(r,action,body) {
      if(action==='drink') {
        const id=body.change?.operation_id;
        if(typeof id!=='string'||!(/^[\w-]{16,80}$/).test(id))throw fail(400,'Ungültiger Vorgangsbezug.');
        const old=await db.prepare('SELECT * FROM rental_operations WHERE id=?').get(id);
        if(old) {
          if(old.rental_id!==r.id||old.request!==digest(body))throw fail(409,'Vorgangsbezug bereits verwendet.');
          return JSON.parse(old.result);
        }
      }
      if(action==='preview') {
        comment(r.comment);
        let proposed=r;
        if(body.comment!==undefined)proposed={...r,comment:comment(body.comment)};
        if(body.edit) {
          const e=body.edit;
          if(r.status!=='finished'||!Number.isSafeInteger(e.started_at)||!Number.isSafeInteger(e.ended_at)||e.started_at<0||e.ended_at<e.started_at||e.ended_at>Date.now()||!Number.isSafeInteger(e.hourly_cents)||e.hourly_cents<0||e.hourly_cents>1000000)throw fail(400,'Ungültige Mietkorrektur.');
          proposed={...r,started_at:e.started_at,ended_at:e.ended_at,hourly_cents:e.hourly_cents};
        }
        const end=proposed.ended_at??body.ended_at??Date.now();
        if(!Number.isSafeInteger(end)||end<proposed.started_at||end>Date.now())throw fail(400,'Ungültiger Endzeitpunkt.');
        const s=await summary(proposed,end,body.change??null);
        return {summary:s,signature:sign(s)};
      }
      if(body.version!==r.version)throw fail(409,'Vermietung wurde geändert. Bitte neu öffnen.');
      if(action==='comment') {
        const value=comment(body.comment);
        if(r.status==='finished'&&(await positions(r.id)).length)verify(body,await summary({...r,comment:value}));
        await db.prepare('UPDATE rentals SET comment=?,version=version+1 WHERE id=?').run(value,r.id);
        if(r.status==='finished'&&(await positions(r.id)).length) {
          const after=await db.prepare('SELECT * FROM rentals WHERE id=?').get(r.id);
          await record(after,await summary(after),body);
        }
        await log('admin','rental:comment',null,{id:r.id,before:r.comment,after:value});return {ok:true};
      }
      comment(r.comment);
      const change=body.change;
      if(!change||!['drink','cancel'].includes(change.kind))throw fail(400,'Ungültige Getränkeaktion.');
      let p;
      if(change.kind==='cancel') {
        p=(await positions(r.id)).find(p=>p.id===change.position_id);
        if(!p||p.cancelled_at!==null)throw fail(409,'Position bereits storniert oder nicht vorhanden.');
        if(typeof change.reason!=='string'||!change.reason.trim()||change.reason.trim().length>500||typeof change.returned!=='boolean')throw fail(400,'Stornogrund und Entscheidung zur Lagerrückgabe erforderlich.');
      }
      const s=await summary(r,r.ended_at??Date.now(),change);
      if(r.status==='finished')verify(body,s);
      if(change.kind==='drink') {
        const m=await inventory.apply({action:'movement',operation_id:change.operation_id,drink_id:change.drink_id,version:change.drink_version,kind:'consumption',packages:0,singles:change.quantity});
        if(await db.prepare('SELECT 1 FROM rental_drinks WHERE id=?').get(change.operation_id))throw fail(409,'Vorgang wurde bereits gebucht.');
        await db.prepare('INSERT INTO rental_drinks(id,rental_id,movement_id) VALUES(?,?,?)').run(change.operation_id,r.id,m.id);
      } else {
        let reversal=null;
        if(change.returned) {
          const d=await db.prepare('SELECT version FROM inventory_drinks WHERE id=?').get((await db.prepare('SELECT drink_id FROM inventory_movements WHERE id=?').get(p.movement_id)).drink_id);
          const m=await inventory.apply({action:'movement',operation_id:change.operation_id,drink_id:(await db.prepare('SELECT drink_id FROM inventory_movements WHERE id=?').get(p.movement_id)).drink_id,version:d.version,kind:'reversal',reverses:p.movement_id,reason:change.reason},true);reversal=m.id;
        }
        await db.prepare('UPDATE rental_drinks SET cancelled_at=?,reason=?,returned=?,reversal_id=? WHERE id=?').run(Date.now(),change.reason.trim(),change.returned?1:0,reversal,p.id);
      }
      await db.prepare('UPDATE rentals SET version=version+1 WHERE id=?').run(r.id);
      const after=await db.prepare('SELECT * FROM rentals WHERE id=?').get(r.id);
      if(r.status==='finished')await record(after,await summary(after),body);
      await db.prepare('INSERT INTO rental_operations VALUES(?,?,?,?)').run(change.operation_id,r.id,digest(body),digest(after));
      await log('admin','rental:'+change.kind,null,{id:r.id,change,version:after.version,status:r.status});return after;
    }
  };
}

import { randomUUID, createHash } from 'node:crypto';

const LIMIT = 1000000000;
export function validateInventoryBackup(data) {
  const balances=new Map(), reversed=new Set();
  for(const operation of data.inventory_operations) {
    if(!/^[\w-]{16,80}$/.test(operation.id)||!/^[a-f0-9]{64}$/.test(operation.request))throw Error('inventory operation');
    const result=JSON.parse(operation.result);
    if(!result||typeof result!=='object'||Array.isArray(result))throw Error('inventory result');
  }
  for(const m of [...data.inventory_movements].sort((a,b)=>a.id-b.id)) {
    const drink=data.inventory_drinks.find(d=>d.id===m.drink_id), s=JSON.parse(m.snapshot);
    if(!drink||!data.inventory_operations.some(o=>o.id===m.operation_id)||!Number.isFinite(Date.parse(m.created_at))||typeof m.reason!=='string'||m.reason.length>500)throw Error('inventory reference');
    if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!Number.isInteger(s.size_ml)||s.size_ml<1||s.size_ml>100000||!Number.isInteger(s.sale_cents)||s.sale_cents<0||s.sale_cents>1000000||!(s.purchase_cents===null||(Number.isInteger(s.purchase_cents)&&s.purchase_cents>=0&&s.purchase_cents<=1000000)))throw Error('inventory snapshot');
    if(['breakage','own_use','adjustment','reversal'].includes(m.kind)&&!m.reason.trim())throw Error('inventory reason');
    if(['initial','receipt'].includes(m.kind)&&m.quantity<=0||['consumption','breakage','own_use'].includes(m.kind)&&m.quantity>=0)throw Error('inventory direction');
    if(m.kind==='initial'&&data.inventory_movements.some(other=>other.drink_id===m.drink_id&&other.id<m.id))throw Error('inventory initial');
    if(m.kind==='reversal') {
      const original=data.inventory_movements.find(o=>o.id===m.reverses);
      if(!original||original.id>=m.id||original.kind==='reversal'||original.drink_id!==m.drink_id||original.quantity!==-m.quantity||original.snapshot!==m.snapshot||reversed.has(original.id))throw Error('inventory reversal');
      reversed.add(original.id);
    } else {
      if(m.reverses!==null||!Number.isSafeInteger(s.packages)||s.packages<0||s.packages>LIMIT||!Number.isSafeInteger(s.singles)||s.singles<0||s.singles>LIMIT||!Number.isInteger(s.bottles)||s.bottles<1||s.bottles>1000000||s.packages*s.bottles+s.singles!==Math.abs(m.quantity))throw Error('inventory units');
      if(s.package_name===null ? s.bottles!==1||s.packages!==0 : typeof s.package_name!=='string'||!s.package_name.trim()||s.package_name.length>100)throw Error('inventory package snapshot');
    }
    const balance=(balances.get(m.drink_id)||0)+m.quantity;
    if(!Number.isSafeInteger(balance)||balance<0||balance>LIMIT)throw Error('inventory balance');
    balances.set(m.drink_id,balance);
  }
}

export function inventoryService({db,transaction,fail,log}) {
  const number=(v,min=0,max=LIMIT)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw fail(400,'Ungültige ganzzahlige Menge oder Preisangabe.');return v;};
  const text=(v,max=100)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw fail(400,'Bitte eine gültige Bezeichnung oder Begründung eingeben.');return v.trim();};
  const balance=async id=>(await db.prepare('SELECT COALESCE(SUM(quantity),0)::bigint AS stock FROM inventory_movements WHERE drink_id=?').get(id)).stock;
  const state=async()=>({drinks:await db.prepare('SELECT d.*,COALESCE((SELECT SUM(quantity) FROM inventory_movements m WHERE m.drink_id=d.id),0)::bigint AS stock FROM inventory_drinks d ORDER BY name,id').all(),packages:await db.prepare('SELECT * FROM inventory_packages ORDER BY name,id').all(),movements:await db.prepare('SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 200').all()});
  const get=async id=>{const d=await db.prepare('SELECT * FROM inventory_drinks WHERE id=?').get(id);if(!d)throw fail(404,'Getränk nicht gefunden.');return d;};
  const check=(body,d)=>{if(body.version!==d.version)throw fail(409,'Das Getränk oder sein Bestand wurde geändert. Bitte neu laden und erneut prüfen.');};
  return {state:()=>transaction(state),handle:body=>transaction(async()=>{
    const operation=text(body.operation_id,80);
    if(!/^[\w-]{16,80}$/.test(operation))throw fail(400,'Ungültiger Vorgangsbezug.');
    const request=createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const previous=await db.prepare('SELECT * FROM inventory_operations WHERE id=?').get(operation);
    if(previous){if(previous.request!==request)throw fail(409,'Vorgangsbezug wurde bereits mit anderen Eingaben verwendet.');return JSON.parse(previous.result);}
    let result;
    if(body.action==='drink') {
      const before=body.id?await get(body.id):null;
      if(before)check(body,before);
      const d={id:before?.id||randomUUID(),name:text(body.name),size_ml:number(body.size_ml,1,100000),sale_cents:number(body.sale_cents,0,1000000),purchase_cents:body.purchase_cents===null?null:number(body.purchase_cents,0,1000000),minimum:number(body.minimum),active:number(body.active,0,1),version:before?before.version+1:0};
      if(before)await db.prepare('UPDATE inventory_drinks SET name=?,size_ml=?,sale_cents=?,purchase_cents=?,minimum=?,active=?,version=? WHERE id=?').run(d.name,d.size_ml,d.sale_cents,d.purchase_cents,d.minimum,d.active,d.version,d.id);
      else await db.prepare('INSERT INTO inventory_drinks VALUES(?,?,?,?,?,?,?,?)').run(...Object.values(d));
      result=d;
      await log('admin','inventory:drink',null,{before,after:d,operation});
    } else {
      const d=await get(body.drink_id);check(body,d);
      if(body.action==='package') {
        if(!d.active)throw fail(409,'Getränk ist archiviert.');
        const before=body.id?await db.prepare('SELECT * FROM inventory_packages WHERE id=? AND drink_id=?').get(body.id,d.id):null;
        if(body.id&&!before)throw fail(404,'Gebinde nicht gefunden.');
        const p={id:before?.id||randomUUID(),drink_id:d.id,name:text(body.name),bottles:number(body.bottles,1,1000000),version:before?before.version+1:0};
        if(before)await db.prepare('UPDATE inventory_packages SET name=?,bottles=?,version=? WHERE id=?').run(p.name,p.bottles,p.version,p.id);
        else await db.prepare('INSERT INTO inventory_packages VALUES(?,?,?,?,?)').run(...Object.values(p));
        result=p;await log('admin','inventory:package',null,{before,after:p,operation});
      } else if(body.action==='movement') {
        const kinds=['initial','receipt','consumption','breakage','own_use','adjustment','reversal'];
        if(!kinds.includes(body.kind))throw fail(400,'Ungültige Bewegungsart.');
        const reason=['breakage','own_use','adjustment','reversal'].includes(body.kind)?text(body.reason,500):body.reason?text(body.reason,500):'';
        let quantity,snapshot,reverses=null;
        if(body.kind==='reversal') {
          const original=await db.prepare('SELECT * FROM inventory_movements WHERE id=? AND drink_id=?').get(number(body.reverses,1),d.id);
          if(!original||original.kind==='reversal'||await db.prepare('SELECT 1 FROM inventory_movements WHERE reverses=?').get(original.id))throw fail(409,'Diese Bewegung kann nicht erneut gegengebucht werden.');
          quantity=-original.quantity;reverses=original.id;snapshot=original.snapshot;
        } else {
          if(!d.active)throw fail(409,'Getränk ist archiviert.');
          if(body.kind==='initial'&&await db.prepare('SELECT 1 FROM inventory_movements WHERE drink_id=?').get(d.id))throw fail(409,'Anfangsbestand ist bereits erfasst oder es bestehen Bewegungen.');
          const packages=number(body.packages),singles=number(body.singles);
          const p=body.package_id?await db.prepare('SELECT * FROM inventory_packages WHERE id=? AND drink_id=?').get(body.package_id,d.id):null;
          if(packages&&!p||body.package_id&&!p)throw fail(400,'Bitte ein gültiges Gebinde auswählen.');
          quantity=number(packages*(p?.bottles||1)+singles,1);
          if(['consumption','breakage','own_use'].includes(body.kind)||body.kind==='adjustment'&&body.direction===-1)quantity=-quantity;
          if(body.kind==='adjustment'&&![1,-1].includes(body.direction))throw fail(400,'Bitte die Richtung der Inventurdifferenz angeben.');
          snapshot=JSON.stringify({name:d.name,size_ml:d.size_ml,sale_cents:d.sale_cents,purchase_cents:body.purchase_cents===undefined?d.purchase_cents:body.purchase_cents===null?null:number(body.purchase_cents,0,1000000),package_name:p?.name||null,bottles:p?.bottles||1,packages,singles});
        }
        const stock=await balance(d.id);
        if(stock+quantity<0||stock+quantity>LIMIT)throw fail(409,'Buchung würde den zulässigen Bestand unter- oder überschreiten.');
        const id=(await db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM inventory_movements').get()).id;
        result={id,drink_id:d.id,operation_id:operation,kind:body.kind,quantity,created_at:new Date().toISOString(),reason,snapshot,reverses};
        await db.prepare('INSERT INTO inventory_movements VALUES(?,?,?,?,?,?,?,?,?)').run(...Object.values(result));
        await log('admin','inventory:movement',null,result);
      } else throw fail(400,'Unbekannte Lageraktion.');
      await db.prepare('UPDATE inventory_drinks SET version=version+1 WHERE id=?').run(d.id);
    }
    await db.prepare('INSERT INTO inventory_operations VALUES(?,?,?)').run(operation,request,JSON.stringify(result));
    return result;
  })};
}

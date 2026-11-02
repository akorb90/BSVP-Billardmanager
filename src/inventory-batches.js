import {createHmac,createHash,randomBytes,randomUUID} from 'node:crypto';

const LIMIT=1000000000;
const array=rows=>{if(!Array.isArray(rows)||!rows.length||rows.length>100||new Set(rows.map(r=>r?.drink_id)).size!==rows.length)throw Error('inventory batch lines');return rows;};
const amount=(value,min=0,max=LIMIT)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const price=value=>value===null||amount(value,0,1000000);

export function validateInventoryBatchBackup(data) {
  const drinks=new Map(data.inventory_drinks.map(d=>[d.id,d])),packages=new Map(data.inventory_packages.map(p=>[p.id,p]));
  const movements=new Map(data.inventory_movements.map(m=>[m.id,m])),previous=new Map(),stocks=new Map(),last=new Map(),claimed=new Set();
  for(const m of [...movements.values()].sort((a,b)=>a.id-b.id)){previous.set(m.id,last.get(m.drink_id)||0);stocks.set(m.id,(stocks.get(last.get(m.drink_id))||0)+m.quantity);last.set(m.drink_id,m.id);}
  const receiptLine=line=>{
    const p=packages.get(line.package_id);
    if(!drinks.has(line.drink_id)||!amount(line.packages)||!amount(line.singles)||!price(line.purchase_cents)||!amount(line.package_bottles,1,1000000)||(!line.package_id&&(line.packages||line.package_bottles!==1))||(line.package_id&&(!p||p.drink_id!==line.drink_id))||!amount(line.packages*line.package_bottles+line.singles,1))throw Error('inventory template units');
  };
  for(const template of data.inventory_templates)for(const line of array(JSON.parse(template.lines)))receiptLine(line);
  for(const batch of data.inventory_batches){
    if(!Number.isFinite(Date.parse(batch.created_at))||!data.inventory_operations.some(o=>o.id===batch.id))throw Error('inventory batch reference');
    const result=JSON.parse(data.inventory_operations.find(o=>o.id===batch.id).result);
    if(['id','kind','created_at','lines'].some(key=>result[key]!==batch[key]))throw Error('inventory batch replay');
    for(const line of array(JSON.parse(batch.lines))){
      if(!drinks.has(line.drink_id)||!amount(line.version,0,Number.MAX_SAFE_INTEGER)||!amount(line.stock)||!amount(line.after)||!amount(line.last_movement_id,0,Number.MAX_SAFE_INTEGER)||!Number.isSafeInteger(line.quantity)||line.quantity!==line.after-line.stock||typeof line.reason!=='string'||line.reason.length>500)throw Error('inventory batch quantity');
      if(typeof line.name!=='string'||!line.name.trim()||line.name.length>100||!amount(line.size_ml,1,100000)||!amount(line.sale_cents,0,1000000)||!price(line.purchase_cents))throw Error('inventory batch snapshot');
      const anchor=movements.get(line.last_movement_id);
      if(line.last_movement_id&&(!anchor||anchor.drink_id!==line.drink_id)||line.stock!==(stocks.get(line.last_movement_id)||0))throw Error('inventory batch stock');
      if(batch.kind==='receipt'){receiptLine(line);if(line.quantity!==line.packages*line.package_bottles+line.singles)throw Error('inventory receipt quantity');}
      else if(batch.kind==='inventory'){if(!amount(line.counted)||line.counted!==line.after||line.quantity&&!line.reason.trim())throw Error('inventory count');}
      else throw Error('inventory batch kind');
      if(line.quantity){
        const m=movements.get(line.movement_id),s=m&&JSON.parse(m.snapshot);
        if(!m||claimed.has(m.id)||m.drink_id!==line.drink_id||m.quantity!==line.quantity||m.kind!==(batch.kind==='receipt'?'receipt':'adjustment')||m.reason!==line.reason||previous.get(m.id)!==line.last_movement_id||s.name!==line.name||s.size_ml!==line.size_ml||s.sale_cents!==line.sale_cents||s.purchase_cents!==line.purchase_cents)throw Error('inventory batch movement');
        if(batch.kind==='receipt'&&(s.packages!==line.packages||s.singles!==line.singles||s.bottles!==line.package_bottles||s.package_name!==line.package_name))throw Error('inventory batch package');
        claimed.add(m.id);
      }else if(line.movement_id!==null||batch.kind!=='inventory')throw Error('inventory zero movement');
    }
  }
}

export function inventoryBatchService({db,fail,log,number,text,get,check,balance,apply}) {
  const signingKey=randomBytes(32),sign=value=>createHmac('sha256',signingKey).update(JSON.stringify(value)).digest('hex');
  async function normalize(body,forTemplate=false) {
    if(!['receipt','inventory'].includes(body.kind))throw fail(400,'Bitte Wareneingang oder Inventur auswählen.');
    let lines;try{lines=array(body.lines);}catch{throw fail(400,'Bitte 1 bis 100 unterschiedliche Getränke erfassen.');}
    const result=[];
    for(const line of lines){
      const d=await get(line.drink_id);check(line,d);
      if(!d.active)throw fail(409,'Archivierte Getränke bitte entfernen oder reaktivieren: '+d.name);
      const stock=await balance(d.id),last=(await db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM inventory_movements WHERE drink_id=?').get(d.id)).id;
      const common={drink_id:d.id,version:d.version,name:d.name,size_ml:d.size_ml,sale_cents:d.sale_cents,stock,last_movement_id:last};
      if(body.kind==='receipt'){
        const p=line.package_id?await db.prepare('SELECT * FROM inventory_packages WHERE id=? AND drink_id=?').get(line.package_id,d.id):null;
        if(line.package_id&&!p)throw fail(400,'Gebinde gehört nicht zum Getränk.');
        const packages=number(line.packages),singles=number(line.singles),quantity=number(packages*(p?.bottles||1)+singles,1);
        if(packages&&!p)throw fail(400,'Für Kästen bitte ein Gebinde wählen.');
        const purchase_cents=line.purchase_cents===null?null:number(line.purchase_cents,0,1000000);
        result.push({...common,package_id:p?.id||null,package_name:p?.name||null,package_bottles:p?.bottles||1,packages,singles,purchase_cents,quantity,after:forTemplate?stock:number(stock+quantity),reason:line.reason?text(line.reason,500):''});
      }else{
        const counted=number(line.counted),quantity=counted-stock,reason=quantity?text(line.reason,500):line.reason?text(line.reason,500):'';
        result.push({...common,counted,purchase_cents:d.purchase_cents,quantity,after:counted,reason});
      }
    }
    return {kind:body.kind,lines:result};
  }
  return {
    state:async()=>({templates:await db.prepare('SELECT * FROM inventory_templates ORDER BY name,id').all(),batches:await db.prepare("SELECT * FROM inventory_batches WHERE id IN (SELECT id FROM inventory_batches WHERE kind='receipt' ORDER BY created_at DESC,id DESC LIMIT 20) OR id IN (SELECT id FROM inventory_batches WHERE kind='inventory' ORDER BY created_at DESC,id DESC LIMIT 20) ORDER BY created_at DESC,id DESC").all()}),
    preview:async body=>{const preview=await normalize(body);return {...preview,token:sign(preview)};},
    async confirm(body,operation){
      const preview=await normalize(body);
      if(body.preview!==sign(preview))throw fail(409,'Vorschau oder Eingaben wurden geändert. Bitte erneut prüfen.');
      const lines=[];
      for(const [index,line] of preview.lines.entries()){
        let movement=null;
        if(line.quantity){
          const child='batch-line-'+createHash('sha256').update(operation+':'+index).digest('hex').slice(0,40);
          movement=await apply({action:'movement',operation_id:child,drink_id:line.drink_id,version:line.version,kind:body.kind==='receipt'?'receipt':'adjustment',package_id:body.kind==='receipt'?line.package_id:null,packages:body.kind==='receipt'?line.packages:0,singles:body.kind==='receipt'?line.singles:Math.abs(line.quantity),purchase_cents:line.purchase_cents,direction:line.quantity<0?-1:1,reason:line.reason});
        }else{
          await db.prepare('UPDATE inventory_drinks SET version=version+1 WHERE id=?').run(line.drink_id);
        }
        lines.push({...line,movement_id:movement?.id||null});
      }
      const batch={id:operation,kind:body.kind,created_at:new Date().toISOString(),lines:JSON.stringify(lines)};
      await db.prepare('INSERT INTO inventory_batches VALUES(?,?,?,?)').run(batch.id,batch.kind,batch.created_at,batch.lines);
      await log('admin','inventory:batch',null,batch);return batch;
    },
    async template(body){
      const before=body.id?await db.prepare('SELECT * FROM inventory_templates WHERE id=?').get(body.id):null;
      if(body.id&&!before)throw fail(404,'Vorlage nicht gefunden.');
      if(before&&body.version!==before.version)throw fail(409,'Vorlage wurde geändert. Bitte neu laden.');
      const normalized=await normalize({kind:'receipt',lines:body.lines},true);
      const lines=normalized.lines.map(({drink_id,package_id,package_bottles,packages,singles,purchase_cents})=>({drink_id,package_id,package_bottles,packages,singles,purchase_cents}));
      const template={id:before?.id||randomUUID(),name:text(body.name),version:before?before.version+1:0,lines:JSON.stringify(lines)};
      if(before)await db.prepare('UPDATE inventory_templates SET name=?,version=?,lines=? WHERE id=?').run(template.name,template.version,template.lines,template.id);
      else await db.prepare('INSERT INTO inventory_templates VALUES(?,?,?,?)').run(template.id,template.name,template.version,template.lines);
      await log('admin','inventory:template',null,{before,after:template});return template;
    }
  };
}

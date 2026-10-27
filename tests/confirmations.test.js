import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {createApp} from '../src/server.js';

test('FR-002: exact confirmations, parent conflicts, closed corrections, deletion and audit',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-confirm-')),dbPath=join(dir,'db.sqlite');
  const server=createApp({dbPath,config:{adminHash:'salt:'+scryptSync('password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let cookie='',csrf='';
  const call=async(path,data,admin=true)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}`+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',...(admin?{Cookie:cookie,'X-CSRF-Token':csrf}:{})},body:data?JSON.stringify(data):undefined});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};
  };
  const state=async()=>(await call('/api/admin')).body;
  const rejected=async(path,payload)=>{
    for(const confirmation of [undefined,'',payload.confirmation.slice(0,-1),payload.confirmation.toLowerCase(),payload.confirmation+' ']) assert.equal((await call(path,{...payload,confirmation})).status,400);
    assert.equal((await call(path,{...payload,action:'other'})).status,400);
    assert.equal((await call(path,payload,false)).status,401);
  };
  try {
    const login=await call('/api/login',{password:'password'});cookie=login.cookie.split(';')[0];csrf=login.body.csrf;
    await call('/api/events',{name:'Vergangen',kind:'Liga',date:'2000-01-01'});
    let e=(await state()).events[0];
    const edit={...e,name:'Korrigiert',action:'event:edit',confirmation:'EVENT ÄNDERN'};
    await rejected('/api/events/1/edit',edit);
    assert.equal((await state()).events[0].name,'Vergangen');
    assert.equal((await call('/api/events/1/edit',edit)).status,200);
    assert.equal((await call('/api/events/1/edit',edit)).status,409);
    await call('/api/matches',{event_id:1,player_a:'Anna',player_b:'Ben',discipline:'9-Ball',target:1,pin:'123456'});
    let snapshot=await state(),m=snapshot.matches[0];e=snapshot.events[0];
    const del={version:m.version,event_version:e.version,action:'match:delete',confirmation:'SPIEL LÖSCHEN'};
    await rejected('/api/matches/1/delete',del);
    await call('/api/matches/1/start',{version:0,table_no:1,lag_winner:'a',first:'a'});
    await call('/api/matches/1/score',{version:1,side:'a',delta:1});
    assert.equal((await call('/api/matches/1/finish',{version:2})).status,400);
    assert.equal((await call('/api/matches/1/finish',{version:2,action:'match:finish',confirmation:'SPIEL ABSCHLIESSEN'})).status,200);
    snapshot=await state();m=snapshot.matches[0];e=snapshot.events[0];
    const correct={...m,a:0,b:1,event_version:e.version,action:'match:edit',confirmation:'SPIEL ÄNDERN'};
    await rejected('/api/matches/1/edit',correct);
    const close={version:e.version,action:'event:close',confirmation:'EVENT ABSCHLIESSEN'};
    await rejected('/api/events/1/close',close);
    assert.equal((await call('/api/events/1/close',close)).status,200);
    // Parent changed while the match itself did not: an old confirmation is invalid.
    assert.equal((await call('/api/matches/1/edit',correct)).status,409);
    correct.event_version=(await state()).events[0].version;
    assert.equal((await call('/api/matches/1/edit',correct)).status,200);
    snapshot=await state();m=snapshot.matches[0];e=snapshot.events[0];
    assert.equal(e.status,'closed');assert.equal(m.b,1);
    await rejected('/api/events/1/edit',{...e,name:'Nach Abschluss',action:'event:edit',confirmation:'EVENT ÄNDERN'});
    assert.equal((await call('/api/events/1/edit',{...e,name:'Nach Abschluss',action:'event:edit',confirmation:'EVENT ÄNDERN'})).status,200);
    e=(await state()).events[0];
    assert.equal((await call('/api/matches/1/edit',{...m,status:'live',event_version:e.version,action:'match:edit',confirmation:'SPIEL ÄNDERN'})).status,409);
    // Closed match deletion has the same strict contract as planned match deletion.
    await rejected('/api/matches/1/delete',{version:m.version,event_version:e.version,action:'match:delete',confirmation:'SPIEL LÖSCHEN'});
    const eventDelete={version:e.version,action:'event:delete',confirmation:'EVENT LÖSCHEN'};
    await rejected('/api/events/1/delete',eventDelete);
    assert.equal((await call('/api/events/1/delete',eventDelete)).status,200);
    assert.equal((await state()).matches.length,0);
    // Also exercise deleting a single finished match from a closed event.
    const db=new DatabaseSync(dbPath);
    const audit=db.prepare('SELECT action,detail FROM audit ORDER BY id').all();
    const correction=JSON.parse(audit.find(r=>r.action==='edit').detail);
    assert.equal(correction.before.a,1);assert.equal(correction.before.b,0);
    const deleted=JSON.parse(audit.find(r=>r.action==='event:delete').detail);
    assert.equal(deleted.before.status,'closed');assert.equal(deleted.matches[0].b,1);
    assert.ok(!JSON.stringify(audit).includes('pin_hash'));db.close();
  } finally {await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

test('FR-002 warning UI: exact input, paste/drop protection, click, cancellation and stale data',async()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const block=source.slice(source.indexOf('// One immutable action snapshot'),source.lastIndexOf('await refresh(true);'));
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:'',disabled:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},focus(){}});
    return elements.get(id);
  };
  const context=vm.createContext({document:{querySelector:element},busy:false,rentalCorrection:undefined,refresh:async()=>{},message:()=>{}});
  vm.runInContext(block+'\nglobalThis.openWarning=showWarning;globalThis.check=checkWarning;',context);
  const input=element('#warning-input'),save=element('#warning-save');
  let calls=0,valid=true;
  const open=()=>context.openWarning({phrase:'EVENT LÖSCHEN',label:'Veranstaltung löschen',summary:'Test',valid:()=>valid,run:async()=>{calls++;}});
  open();assert.equal(input.value,'');assert.equal(save.disabled,true);
  for(const value of ['', 'EVENT', 'event löschen', 'EVENT LÖSCHEN ']) {input.value=value;input.listeners.input();assert.equal(save.disabled,true);await save.listeners.click();assert.equal(calls,0);}
  for(const [type,extra] of [['paste',{}],['drop',{}],['contextmenu',{}],['beforeinput',{inputType:'insertFromPaste'}],['beforeinput',{inputType:'insertFromDrop'}],['keydown',{key:'v',ctrlKey:true}],['keydown',{key:'v',metaKey:true}],['keydown',{key:'Insert',shiftKey:true}],['keydown',{key:'Enter'}]]) {
    let prevented=false;input.listeners[type]({...extra,preventDefault(){prevented=true;}});assert.equal(prevented,true,type);
  }
  input.value='EVENT LÖSCHEN';input.listeners.input();assert.equal(save.disabled,false);assert.equal(calls,0);
  element('#warning-cancel').listeners.click();assert.equal(input.value,'');await save.listeners.click();assert.equal(calls,0);
  open();input.value='EVENT LÖSCHEN';input.listeners.input();valid=false;context.check();assert.equal(input.value,'');assert.equal(save.disabled,true);await save.listeners.click();assert.equal(calls,0);
  valid=true;open();assert.equal(input.value,'');input.value='EVENT LÖSCHEN';input.listeners.input();await save.listeners.click();assert.equal(calls,1);assert.equal(element('#warning-dialog').open,false);
  open();element('#warning-dialog').close();await save.listeners.click();assert.equal(calls,1);
});

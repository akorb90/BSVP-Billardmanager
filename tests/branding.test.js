import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync,createHash} from 'node:crypto';
import {createApp} from '../src/server.js';
import {DEFAULT_BRANDING} from '../src/branding.js';

test('FR-009: Vereinsgestaltung, Rechte, Konflikte, Upload, Neustart und Sicherung',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'billard-branding-'));
  const config={adminHash:'salt:'+scryptSync('test-password','salt',64).toString('hex'),tables:Array(8).fill('x'.repeat(40))};
  let server,base,cookie='',csrf='';
  async function start(){server=createApp({dbPath:join(dir,'db.sqlite'),config});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
  async function call(path,data,headers={}){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:data?JSON.stringify(data):undefined});return{status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};}
  async function login(){const r=await call('/api/login',{password:'test-password'});cookie=r.cookie.split(';')[0];csrf=r.body.csrf;}
  const logo='data:image/png;base64,'+readFileSync(new URL('../public/assets/bsv-logo.png',import.meta.url)).toString('base64');
  const value={...DEFAULT_BRANDING,club_name:'BC München <&> 🎱',primary:'#b13c27',background:'#ffffff',surface:'#eeeeee',text:'#111111',logo};
  const endpoint='/api/settings/branding';
  const resign=b=>{b.checksum=createHash('sha256').update(JSON.stringify(b.data)).digest('hex');return b;};
  try {
    await start();assert.equal((await call('/api/branding')).body.club_name,DEFAULT_BRANDING.club_name);
    assert.equal((await call(endpoint,value)).status,401);await login();
    assert.equal((await call(endpoint,value,{'X-CSRF-Token':'wrong'})).status,403);
    assert.equal((await call(endpoint,value,{Origin:'https://evil.invalid'})).status,403);
    for(const change of [{club_name:''},{club_name:'x'.repeat(81)},{club_name:'bad\nname'},{primary:'red;}'},{text:'#ffffff'},{logo:'data:image/svg+xml;base64,PHN2Zy8+'},{logo:'data:image/png;base64,aGVsbG8='},{logo:'x'.repeat(1400000)}])assert.ok([400,413].includes((await call(endpoint,{...value,...change})).status));
    assert.equal((await call(endpoint,value)).status,200);
    const saved=(await call('/api/branding')).body;
    assert.equal(saved.club_name,value.club_name);assert.equal(saved.has_logo,true);assert.equal(saved.version,1);assert.equal(saved.logo,undefined);
    assert.equal((await call(endpoint,value)).status,409);
    const page=await (await fetch(base+'/')).text();assert.ok(page.includes('BC München &lt;&amp;&gt; 🎱'));assert.ok(!page.includes('BSV PFAFFENHOFEN'));
    const css=await (await fetch(base+'/branding.css')).text();assert.ok(css.includes('--primary:#b13c27'));assert.ok(css.includes('--background:#ffffff'));
    const image=await fetch(base+'/api/branding/logo');assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(logo.split(',')[1],'base64'));
    const backup=(await call('/api/backups/export')).body;assert.equal(backup.schema,7);assert.equal(backup.data.branding[0].logo,logo);
    for(const key of ['club_name','background','surface','text'])assert.equal(backup.data.branding[0][key],value[key]);
    assert.equal(backup.data.branding[0].primary_color,value.primary);
    assert.ok(!backup.data.audit.find(r=>r.action==='settings:branding').detail.includes('base64'));
    const bad=structuredClone(backup);bad.data.branding[0].primary_color='bad';resign(bad);assert.equal((await call('/api/backups/preview',{backup:bad})).status,400);
    await new Promise(r=>server.close(r));await start();cookie='';csrf='';assert.deepEqual((await call('/api/branding')).body,saved);await login();
    assert.equal((await call(endpoint,{...value,version:1,logo:null})).status,200);assert.equal((await call('/api/branding')).body.has_logo,false);
    assert.equal((await call('/api/backups/preview',{backup})).status,200);
    assert.equal((await call('/api/backups/restore',{backup,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'})).status,200);
    assert.deepEqual((await call('/api/branding')).body,saved);await login();
    const legacy=structuredClone(backup);legacy.schema=6;delete legacy.data.branding;resign(legacy);
    assert.equal((await call('/api/backups/preview',{backup:legacy})).status,200);
    assert.equal((await call('/api/backups/restore',{backup:legacy,action:'backup:restore',confirmation:'DATEN WIEDERHERSTELLEN'})).status,200);
    assert.equal((await call('/api/branding')).body.club_name,DEFAULT_BRANDING.club_name);
  } finally {if(server?.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

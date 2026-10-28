// Administrative initial import into the existing installation; uses its existing credentials.
import { openDatabase } from '../src/database.js';
import { loadConfig } from '../src/config.js';
import {scheduleService} from '../src/schedule.js';
import { nuLigaService } from '../src/nuliga.js';
import { backupService } from '../src/backup.js';
import { writeFileSync,mkdirSync } from 'node:fs';

const db=await openDatabase({databaseUrl:process.env.DATABASE_URL,config:loadConfig(process.env.CONFIG_FILE)});
const transaction=fn=>db.transaction(fn);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const log=(actor,action,id,detail)=>db.prepare('INSERT INTO audit(actor,action,match_id,detail) VALUES(?,?,?,?)').run(actor,action,id,JSON.stringify(detail));
try {
  const backups=await backupService({db,transaction,fail,log});
  const directory=(process.env.DATA_DIR||'/data')+'/nuliga-backups';
  mkdirSync(directory,{recursive:true});
  const path=directory+'/stand-'+new Date().toISOString().replaceAll(':','-')+'.json';
  writeFileSync(path,JSON.stringify(await backups.export()),{mode:0o600});
  console.log('Vollständige Sicherung: '+path);
  if(!process.argv.includes('--backup-only')){const nextId=async name=>(await db.prepare('UPDATE entity_ids SET value=value+1 WHERE name=? RETURNING value').get(name)).value;const service=process.argv.includes('--schedule')?scheduleService({db,transaction,fail,log,nextId}):nuLigaService({db,transaction,fail,log});console.log(JSON.stringify(await service.sync()));}
} finally {await db.close();}

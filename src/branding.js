import {createHash} from 'node:crypto';

export const DEFAULT_BRANDING = Object.freeze({club_name:'BSV Pfaffenhofen',primary:'#147eb7',background:'#080c12',surface:'#121e2b',text:'#f1f6fc',logo:null,version:0});
export const LOGO_LIMIT = 1024 * 1024;

export function validateBranding(value) {
  if (typeof value.club_name !== 'string' || !value.club_name.trim() || value.club_name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(value.club_name)) throw new Error('Bitte einen Vereinsnamen mit 1 bis 80 Zeichen eingeben.');
  for (const key of ['primary','background','surface','text']) if (typeof value[key] !== 'string' || !/^#[a-f0-9]{6}$/i.test(value[key])) throw new Error('Bitte gültige Farben auswählen.');
  const luminance = color => {
    const channels = color.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  };
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  if (contrast(value.text,value.background)<4.5 || contrast(value.text,value.surface)<4.5) throw new Error('Text und Hintergrund sowie Text und Flächen benötigen mindestens 4,5:1 Kontrast. Bitte die Farben anpassen.');
  if (value.logo !== null) {
    if (typeof value.logo !== 'string' || value.logo.length > Math.ceil(LOGO_LIMIT/3)*4+40) throw new Error('Das Logo darf höchstens 1 MiB groß sein.');
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.logo);
    if (!match) throw new Error('Bitte ein PNG- oder JPEG-Logo auswählen.');
    const bytes = Buffer.from(match[2],'base64');
    if (bytes.length>LOGO_LIMIT || bytes.toString('base64')!==match[2] || (match[1]==='png' ? bytes.length<45 || bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || bytes.toString('ascii',12,16)!=='IHDR' || bytes.toString('ascii',bytes.length-8,bytes.length-4)!=='IEND' : bytes.length<4 || bytes[0]!==255 || bytes[1]!==216 || bytes[2]!==255 || bytes.at(-2)!==255 || bytes.at(-1)!==217)) throw new Error('Das Logo enthält keine gültigen PNG- oder JPEG-Bilddaten (maximal 1 MiB).');
  }
  return {...value,club_name:value.club_name.trim()};
}

export function brandingService({db,transaction,fail,log}) {
  const get = async () => await db.prepare('SELECT id,club_name,primary_color AS "primary",background,surface,text,logo,version FROM branding WHERE id=1').get();
  const publicState = async () => {const {id,logo,...value}=await get();return {...value,has_logo:logo!==null,logo_revision:createHash('sha256').update(logo||'default').digest('hex')};};
  return {get,publicState,async save(body) {
    return transaction(async () => {
      const before=await get();
      if (!Number.isSafeInteger(body.version) || body.version!==before.version) throw fail(409,'Die Vereinsgestaltung wurde inzwischen geändert. Bitte die Einstellungen neu laden.');
      let value;
      try {value=validateBranding({...body,logo:body.logo===undefined?before.logo:body.logo});} catch(error) {throw fail(400,error.message);}
      await db.prepare('UPDATE branding SET club_name=?,primary_color=?,background=?,surface=?,text=?,logo=?,version=version+1 WHERE id=1').run(value.club_name,value.primary,value.background,value.surface,value.text,value.logo);
      await log('admin','settings:branding',null,{club_name:value.club_name,primary:value.primary,background:value.background,surface:value.surface,text:value.text,logo_changed:before.logo!==value.logo});
      return await publicState();
    });
  }};
}

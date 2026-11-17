const room = {id:'lingkar-barat',name:'Ruang Lingkar Barat'};
const encoder = new TextEncoder();
export const departments = ['Sekretariat','Pelayanan Kesehatan','Kesehatan Masyarakat','Sumber Daya Kesehatan','Pengendalian Penduduk dan keluarga Berencana','Pencegahan dan Pengendalian Penyakit'];
function isoDate(value) {
  return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function validateBooking(input, ErrorType=Error, now=Date.now()) {
  function fail(message) { throw ErrorType===Error ? new Error(message) : new ErrorType(400,message); }
  const value={};
  for(const [field,max,required] of [['person',160,true],['activity',1000,true],['purpose',1000,true],['invitees',1000,false],['output',1000,true],['notes',1000,false],['attachment',2048,false]]) {
    if(typeof input[field]!=='string'||input[field].trim().length>max||(required&&!input[field].trim()))fail('Lengkapi isian kegiatan dengan benar.');
    value[field]=input[field].trim();
  }
  if(!departments.includes(input.department))fail('Pilih bidang yang tersedia.');
  if(input.room!==room.id)fail('Hanya Ruang Lingkar Barat yang dapat dipesan.');
  if(!isoDate(input.start)||!isoDate(input.end)||input.end<input.start||Date.parse(input.end)-Date.parse(input.start)>30*86400000)fail('Pilih tanggal mulai–selesai yang valid, maksimal 31 hari.');
  const today=new Date(now+7*3600000).toISOString().slice(0,10);
  if(input.start<today||input.end>new Date(now+366*86400000).toISOString().slice(0,10))fail('Tanggal pemesanan harus hari ini sampai satu tahun ke depan.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime||'')||(input.start===input.end&&input.endTime<=input.startTime))fail('Isi jam kegiatan dengan benar. Ruangan tetap dipesan seharian.');
  if(value.attachment) {
    try {const url=new URL(value.attachment);if(url.protocol!=='https:'||url.username||url.password)fail('Lampiran harus berupa tautan HTTPS.');}
    catch {fail('Lampiran harus berupa tautan HTTPS.');}
  }
  if(!/^[a-f0-9-]{36}$/i.test(input.requestId||''))fail('Identitas permintaan tidak valid. Muat ulang formulir.');
  return {...value,room:room.id,department:input.department,start:input.start,end:input.end,startTime:input.startTime,endTime:input.endTime,requestId:input.requestId};
}
async function cryptKey(env) {
  if(!env.CODE_PEPPER)throw new Error('Kunci server belum tersedia.');
  return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('sapa:'+env.CODE_PEPPER)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function seal(value,env) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptKey(env),encoder.encode(JSON.stringify(value))));
  return JSON.stringify({iv:Array.from(iv),data:Array.from(data)});
}
async function connection(env) {
  const row=await env.DB.prepare('SELECT encrypted FROM sapa_connection WHERE id=1').first();
  if(!row)return null;
  const value=JSON.parse(row.encrypted);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv)},await cryptKey(env),new Uint8Array(value.data))));
}
async function bridge(config,payload,ApiError) {
  let response,data;
  try {
    response=await fetch(config.url,{method:'POST',redirect:'follow',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,key:config.key}),signal:AbortSignal.timeout(28000)});
    data=await response.json();
  }catch {throw new ApiError(503,'Sambungan spreadsheet belum dapat dihubungi. Coba kembali dengan isian yang sama agar pesanan tidak tercatat dua kali.');}
  if(!response.ok||!data?.ok)throw new ApiError([400,401,404,409,503].includes(data?.status)?data.status:503,data?.error||'Sambungan spreadsheet belum siap.');
  return data;
}
async function body(request,ApiError) {
  const raw=await request.text();
  if(raw.length>20000)throw new ApiError(413,'Data terlalu panjang.');
  try {const value=JSON.parse(raw);if(value&&typeof value==='object'&&!Array.isArray(value))return value;}catch {}
  throw new ApiError(400,'Data formulir tidak valid.');
}
export async function sapaRoute(request,env,{account,ApiError}) {
  const {pathname,searchParams}=new URL(request.url);
  if(pathname.startsWith('/api/admin/')&&!account)throw new ApiError(401,'Masuk sebagai admin.');
  if(pathname==='/api/admin/sapa/connection'&&request.method==='POST') {
    if(account.role!=='owner')throw new ApiError(403,'Hanya pemilik dapat menyambungkan spreadsheet.');
    const input=await body(request,ApiError);
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(input.url||'')||!/^SAPA-[a-f0-9-]{36,80}$/i.test(input.key||''))throw new ApiError(400,'Isi URL Web App /exec dan kunci SAPA dari pengaturan Apps Script.');
    const config={url:input.url,key:input.key};
    const health=await bridge(config,{action:'health'},ApiError);
    if(health.spreadsheetId!=='1Ko90jp7tlq6q4ZsBJaUOQTG2oBdMWNHGhNuOourgd10'||health.version!==3)throw new ApiError(400,'Gunakan penghubung SAPA versi 3 yang hanya memakai spreadsheet ORDER RUANG PERTEMUAN.');
    await env.DB.prepare('INSERT INTO sapa_connection VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET encrypted=excluded.encrypted,updated_at=excluded.updated_at').bind(await seal(config,env),Date.now()).run();
    return {connected:true};
  }
  const config=await connection(env);
  if(pathname==='/api/sapa'&&request.method==='GET') {
    if(!config)return {connected:false,room,departments,bookings:[]};
    // Read times from the existing deployed bridge without requiring an Apps Script update.
    // Explicitly select public fields so notes, invitations and attachments stay private.
    const data=await bridge(config,{action:'adminList'},ApiError);
    const fields=['id','person','activity','department','start','end','created','status','room','startTime','endTime'];
    const bookings=data.bookings.filter(item=>item.status!=='dibatalkan').map(item=>Object.fromEntries(fields.map(field=>[field,item[field]||''])));
    return {connected:true,room,departments,bookings};
  }
  if(!config)throw new ApiError(503,'Pemesanan belum dibuka. Admin perlu menyambungkan spreadsheet terlebih dahulu.');
  if(pathname==='/api/sapa/availability'&&request.method==='GET') {
    const start=searchParams.get('start'),end=searchParams.get('end');
    if(!isoDate(start)||!isoDate(end)||end<start||Date.parse(end)-Date.parse(start)>30*86400000)throw new ApiError(400,'Pilih rentang tanggal maksimal 31 hari.');
    return bridge(config,{action:'availability',start,end},ApiError);
  }
  if(pathname==='/api/sapa/bookings'&&request.method==='POST') {
    if(request.headers.get('Origin')!==(env.SITE_ORIGIN||new URL(request.url).origin))throw new ApiError(403,'Asal pemesanan tidak valid.');
    const input=await body(request,ApiError);
    if(input.website)throw new ApiError(400,'Permintaan tidak valid.');
    const value=validateBooking(input,ApiError);
    const bucket='sapa:'+request.headers.get('CF-Connecting-IP')+':'+Math.floor(Date.now()/600000);
    await env.DB.prepare('DELETE FROM attempts WHERE expires_at<=?').bind(Date.now()).run();
    const count=await env.DB.prepare('INSERT INTO attempts VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,Date.now()+600000).first();
    if(count.count>10)throw new ApiError(429,'Terlalu banyak permintaan. Coba lagi dalam 10 menit.');
    return bridge(config,{action:'book',value},ApiError);
  }
  if(pathname==='/api/admin/sapa'&&request.method==='GET')return bridge(config,{action:'adminList'},ApiError);
  const id=pathname.match(/^\/api\/admin\/sapa\/bookings\/([a-f0-9-]{36})$/i)?.[1];
  if(id&&request.method==='DELETE')return bridge(config,{action:'cancel',id},ApiError);
  if(id&&request.method==='PATCH')return bridge(config,{action:'edit',id,value:validateBooking(await body(request,ApiError),ApiError)},ApiError);
  throw new ApiError(404,'Menu SAPA tidak ditemukan.');
}

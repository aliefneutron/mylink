import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import worker from './worker.mjs';
import { validateBooking } from './sapa.mjs';

const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const day=offset=>new Date(Date.parse(today)+offset*86400000).toISOString().slice(0,10);
const data=[['Timestamp','1. Penanggungjawab Kegiatan','','','','','','','8. Lokasi Kegiatan']];
let locked=false,denyLock=false;
const properties=new Map();
const sheet={
  getLastRow:()=>data.length,
  getMaxRows:()=>1000,
  getParent:()=>({getFormUrl:()=> 'https://docs.google.com/forms/d/test/edit'}),
  getRange(row,col,height=1,width=1){
    return {
      getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>data[row-1+i]?.[col-1+j]??'')),
      setValues(values){
        if(row>1)assert.equal(locked,true,'Every booking write must hold the script lock');
        values.forEach((values,i)=>{data[row-1+i]||=[];values.forEach((value,j)=>{data[row-1+i][col-1+j]=value;});});
        return this;
      },
      setValue(value){return this.setValues([[value]]);},setNumberFormat(){return this;}
    };
  }
};
const context=vm.createContext({Date,console:{log(){}},
  SpreadsheetApp:{openById(id){assert.equal(id,'1Ko90jp7tlq6q4ZsBJaUOQTG2oBdMWNHGhNuOourgd10','Only the new spreadsheet may be accessed');return {getSheetByName:()=>sheet};},flush(){}},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key),setProperty(key,value){properties.set(key,value);}})},
  Utilities:{getUuid:()=>crypto.randomUUID(),formatDate(value,zone,format){
    if(format==='HH:mm')return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value);
    return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
  }},
  LockService:{getScriptLock:()=>({tryLock(){if(locked||denyLock)return false;locked=true;return true;},releaseLock(){locked=false;}})},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:value=>({value,setMimeType(){return this;}})}
});
vm.runInContext(readFileSync(new URL('SAPA-Spreadsheet.gs',import.meta.url),'utf8'),context);
context.siapkanSAPA();
assert.equal(data[0][21],'ID SAPA');
const bridgeKey=properties.get('SAPA_KEY');
function bridge(input){return JSON.parse(context.doPost({postData:{contents:JSON.stringify({key:bridgeKey,...input})}}).value);}
const booking=()=>({room:'lingkar-barat',person:'Petugas uji',department:'Sekretariat',start:day(10),end:day(10),startTime:'08:00',endTime:'10:00',activity:'Rapat uji',purpose:'Koordinasi',invitees:'Tim',output:'Kesepakatan',notes:'',attachment:'',requestId:crypto.randomUUID()});
assert.equal(bridge({action:'health',key:'invalid'}).status,401);
assert.throws(()=>validateBooking({...booking(),room:'utara'}));
assert.throws(()=>validateBooking({...booking(),start:'2027-02-30'}));
assert.throws(()=>validateBooking({...booking(),start:day(-1)}));
assert.throws(()=>validateBooking({...booking(),end:day(50)}));
assert.throws(()=>validateBooking({...booking(),attachment:'javascript:alert(1)'}));
const value=booking();
const saved=bridge({action:'book',value});
assert.equal(saved.ok,true,JSON.stringify(saved));
assert.equal(data[1][6],value.activity,'G = Uraian Kegiatan');
assert.equal(data[1][7],value.purpose,'H = Tujuan Kegiatan');
assert.equal(data[1][4],'08:00');assert.equal(data[1][5],'10:00');
assert.equal(data[1][8],'Ruang Lingkar Barat');
const duplicate=bridge({action:'book',value});
assert.equal(duplicate.booking.id,saved.booking.id);
assert.equal(data.length,2,'Retry must not append duplicate rows');
assert.equal(bridge({action:'book',value:{...value,notes:'Changed after submit'}}).status,409);
assert.equal(bridge({action:'book',value:{...booking(),startTime:'14:00',endTime:'16:00'}}).status,409,'Different hours still conflict');
assert.equal(bridge({action:'book',value:{...booking(),start:day(9),end:day(10)}}).status,409,'Inclusive last day conflicts');
assert.equal(bridge({action:'availability',start:day(10),end:day(10)}).available,false);
assert.equal(bridge({action:'availability',start:day(11),end:day(11)}).available,true);
assert.equal(bridge({action:'edit',id:saved.booking.id,value:{...value,activity:'Rapat diperbarui'}}).ok,true,'Editing own booking excludes itself');
assert.equal(bridge({action:'list'}).bookings[0].activity,'Rapat diperbarui');
assert.equal('purpose' in bridge({action:'list'}).bookings[0],false,'Public list omits private details');
assert.equal(bridge({action:'cancel',id:saved.booking.id}).ok,true);
assert.equal(bridge({action:'availability',start:day(10),end:day(10)}).available,true);
assert.equal(bridge({action:'book',value}).status,409,'Cancelled request id cannot resurrect a booking');
// Old rows retain their original columns and are also considered for conflicts.
function legacy(location,start,end=start){const row=new Array(26).fill('');row[0]=new Date();row[1]='Pemesan lama';row[2]=new Date(start+'T12:00:00+07:00');row[3]=new Date(end+'T12:00:00+07:00');row[6]='Rapat lama';row[8]=location;data.push(row);}
legacy('Aula Dinkes lingkar barat',day(15),day(17));
legacy('Kantor Utara Jl Dr Cipto',day(18));
legacy('Ruang Pertemuan Dinkes P2KB',day(19));
assert.equal(bridge({action:'availability',start:day(16),end:day(16)}).available,false);
assert.equal(bridge({action:'availability',start:day(18),end:day(18)}).available,true);
assert.equal(bridge({action:'availability',start:day(19),end:day(19)}).available,false,'Ambiguous old Dinkes rooms require admin review');
denyLock=true;assert.equal(bridge({action:'book',value:{...booking(),start:day(21),end:day(21)}}).status,503);denyLock=false;
const countBeforeSetup=data.length;
context.siapkanSAPA();
assert.equal(data.length,countBeforeSetup,'Setup does not import or delete reservations');
assert.equal(bridge({action:'health'}).version,3);

const db=new DatabaseSync(':memory:');
for(const file of ['0001_init.sql','0002_gallery.sql','0003_visit_time.sql','0004_link_overrides.sql','0005_text_overrides.sql','0006_site_settings.sql','0007_sapa.sql','0008_image_purpose.sql'])db.exec(readFileSync(new URL('migrations/'+file,import.meta.url),'utf8'));
function statement(sql){
  const stmt=db.prepare(sql);
  const bind=(...args)=>({first:()=>stmt.get(...args)||null,all:()=>({results:stmt.all(...args)}),run:()=>({meta:{changes:stmt.run(...args).changes}})});
  return {bind,...bind()};
}
const ownerCode='SAPA-test-owner-code-1234567890',origin='https://ladini.test';
const env={SITE_ORIGIN:origin,BOOTSTRAP_CODE:ownerCode,CODE_PEPPER:'test-only-pepper',DB:{prepare:statement,batch(items){db.exec('BEGIN');try{const result=items.map(item=>item.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://script.google.com/macros/s/test-bridge/exec');
  return Response.json(bridge(JSON.parse(options.body)));
};
async function api(path,status,{method='GET',body,session,from=origin}={}){
  const request=new Request(origin+'/api/'+path,{method,headers:{Origin:from,...(body&&{'Content-Type':'application/json'}),...(session&&{Authorization:'Bearer '+session})},body:body&&JSON.stringify(body)});
  const response=await worker.fetch(request,env),payload=response.status===204?null:await response.json();
  assert.equal(response.status,status,JSON.stringify(payload));return payload;
}
try {
  assert.equal((await api('sapa',200)).connected,false);
  await api('sapa/bookings',503,{method:'POST',body:booking()});
  await api('admin/sapa',401);
  const session=(await api('login',200,{method:'POST',body:{code:ownerCode}})).session;
  await api('admin/sapa/connection',400,{method:'POST',session,body:{url:'https://attacker.test',key:bridgeKey}});
  await api('admin/sapa/connection',200,{method:'POST',session,body:{url:'https://script.google.com/macros/s/test-bridge/exec',key:bridgeKey}});
  assert.equal(db.prepare('SELECT encrypted FROM sapa_connection').get().encrypted.includes(bridgeKey),false,'Connection key stored encrypted');
  const publicData=await api('sapa',200);assert.equal(publicData.connected,true);assert.equal(JSON.stringify(publicData).includes(bridgeKey),false);
  assert.ok(publicData.bookings.length);
  assert.equal('startTime' in publicData.bookings[0],true);
  for(const item of publicData.bookings){assert.equal(item.status==='dibatalkan',false);for(const field of ['notes','purpose','attachment','invitees','requestId'])assert.equal(field in item,false);}
  await api('sapa/bookings',403,{method:'POST',body:booking(),from:'https://other.test'});
  const requests=await Promise.all([api('sapa/bookings',200,{method:'POST',body:{...booking(),start:day(25),end:day(25)}}),api('sapa/bookings',409,{method:'POST',body:{...booking(),start:day(25),end:day(25)}})]);
  const id=requests[0].booking.id;
  await api('admin/sapa/bookings/'+id,401,{method:'DELETE'});
  await api('admin/sapa/bookings/'+id,200,{method:'DELETE',session});
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const logo=await api('admin/logo',201,{method:'POST',session,body:{data:png,caption:'Logo aplikasi'}});
  assert.ok(logo.id);
  assert.equal((await api('images',200)).images.length,0,'Uploaded logo stays out of public gallery');
  await api('admin/content',204,{method:'POST',session,body:{kind:'tautan',title:'Still works',url:'https://example.com'}});
  console.log('Lulus SAPA: hanya spreadsheet baru, tanpa Google Form atau sumber lain, seharian, rentang tanggal, idempotensi, edit/batal, penguncian, proxy, enkripsi, otorisasi, dan logo terpisah dari galeri.');
} finally {globalThis.fetch=realFetch;db.close();}

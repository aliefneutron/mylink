/* Tempel ke Apps Script milik spreadsheet, lalu jalankan siapkanSAPA sekali. */
var SAPA_SHEET_ID = '1Ko90jp7tlq6q4ZsBJaUOQTG2oBdMWNHGhNuOourgd10';
var SAPA_TAB = 'Pemesanan SAPA';
var SAPA_LEGACY_ID = '1T6Hs4KLAMvxOO-mMmAt7xKDlJLCRHNqBvMMUH2cXKdg';
var SAPA_LEGACY_TAB = 'Kegiatan Harian Bidang';
var SAPA_ZONE = 'Asia/Jakarta'; // Hari kalender ruangan di Sumenep, bukan zona perangkat pemesan.
var SAPA_FIELDS = ['ID SAPA','Status SAPA','ID Permintaan SAPA','Dibuat SAPA','Diperbarui SAPA'];
var SAPA_DEPARTMENTS = ['Sekretariat','Pelayanan Kesehatan','Kesehatan Masyarakat','Sumber Daya Kesehatan','Pengendalian Penduduk dan keluarga Berencana','Pencegahan dan Pengendalian Penyakit'];

function sapaSheet_() {
  var sheet = SpreadsheetApp.openById(SAPA_SHEET_ID).getSheetByName(SAPA_TAB);
  if (!sheet) throw new Error('Tab Pemesanan SAPA tidak ditemukan.');
  return sheet;
}
function siapkanSAPA() {
  var sheet = sapaSheet_();
  var headers = sheet.getRange(1,1,1,26).getValues()[0];
  if (headers[0] !== 'Timestamp' || headers[1] !== '1. Penanggungjawab Kegiatan' || headers[8] !== '8. Lokasi Kegiatan') {
    throw new Error('Susunan kolom berbeda. Jangan lanjutkan sebelum pemetaan diperiksa.');
  }
  for (var i=0;i<5;i++) if (headers[21+i] && headers[21+i] !== SAPA_FIELDS[i]) throw new Error('Kolom V–Z sudah dipakai. Hubungi pengelola sebelum melanjutkan.');
  if (sheet.getLastRow()>1) {
    var extra=sheet.getRange(2,22,sheet.getLastRow()-1,5).getValues();
    if (!headers[21] && extra.some(function(row){return row.some(function(cell){return cell!=='';});})) throw new Error('Kolom V–Z berisi data. Pengaktifan dihentikan.');
  }
  // Semua pemesanan wajib melalui SAPA agar pemeriksaan bentrok tidak dapat dilewati.
  var legacy=SpreadsheetApp.openById(SAPA_LEGACY_ID);
  var formUrl = legacy.getFormUrl();
  if (formUrl) {
    var form=FormApp.openByUrl(formUrl);
    form.setCustomClosedFormMessage('Penjadwalan kegiatan sekarang melalui SAPA di https://aliefneutron.my.id/ladini/#layanan/penjadwalan-kegiatan');
    form.setAcceptingResponses(false);
  }
  sheet.getRange(1,22,1,5).setValues([SAPA_FIELDS]);
  var properties=PropertiesService.getScriptProperties();
  properties.setProperty('SAPA_LEGACY_FORM_URL',formUrl||'');
  sapaImportLegacy_(legacy.getSheetByName(SAPA_LEGACY_TAB),sheet);
  if (!properties.getProperty('SAPA_KEY')) properties.setProperty('SAPA_KEY','SAPA-'+Utilities.getUuid()+'-'+Utilities.getUuid());
  properties.setProperty('SAPA_READY','1');
  SpreadsheetApp.flush();
  console.log('SAPA siap. Salin SAPA_KEY dari Project Settings → Script Properties, bukan dari log. Deploy sebagai Web App: Execute as Me, akses Anyone.');
}
function sapaLegacyId_(row) {return '11111111-1111-4111-8111-'+('000000000000'+row).slice(-12);}
function sapaImportLegacy_(source,destination) {
  if(!source)throw new Error('Tab arsip lama tidak ditemukan. Pemeriksaan jadwal lama belum selesai.');
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error('Ada proses SAPA lain. Coba pengaktifan kembali.');
  try {
    var today=Utilities.formatDate(new Date(),SAPA_ZONE,'yyyy-MM-dd');
    var existing=sapaRows_().map(function(row){return row.id;});
    var rows=source.getLastRow()>1?source.getRange(2,1,source.getLastRow()-1,26).getValues():[];
    rows.forEach(function(row,index){
      var start=sapaDate_(row[2]),end=sapaDate_(row[3])||start,id=sapaLegacyId_(index+2);
      if(!start||end<today||sapaRoom_(row[8])==='other'||String(row[22]).toLowerCase()==='dibatalkan'||existing.indexOf(id)>=0)return;
      // Preserve overlapping legacy reservations for admin review; do not silently cancel them.
      row[21]=id;row[22]='aktif';row[23]=id;row[24]=row[0]||new Date();row[25]=new Date();
      var next=destination.getLastRow()+1;
      if(next>destination.getMaxRows())destination.insertRowsAfter(destination.getMaxRows(),100);
      destination.getRange(next,1,1,26).setValues([row]);existing.push(id);
    });
    SpreadsheetApp.flush();
  }finally{lock.releaseLock();}
}
function sapaDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value,SAPA_ZONE,'yyyy-MM-dd');
  var raw=String(value||'').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(Date.parse(raw)) && new Date(raw).toISOString().slice(0,10)===raw) return raw;
  // Spreadsheet ini memakai locale en_US. Teks tanggal lama ditafsirkan bulan/hari/tahun.
  var match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (match) {
    var iso=match[3]+'-'+('0'+match[1]).slice(-2)+'-'+('0'+match[2]).slice(-2);
    if (!isNaN(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10)===iso) return iso;
  }
  return '';
}
function sapaRoom_(location) {
  var value=String(location||'').toLowerCase();
  if (/utara|cipto|dinkes lama|belakang pemda|labkesda|hotel|kecamatan|puskesmas|rumah sakit|kemenag/.test(value)) return 'other';
  if (/lingkar|lingakr|linkar|joko.?tole|gedungan|selatan/.test(value)) return 'lingkar-barat';
  return /dinkes|dkp2kb|dinas kesehatan|p2kb|ppkb|pertemuan|ruang rapat/.test(value) ? 'uncertain' : 'other';
}
function sapaRows_() {
  var sheet=sapaSheet_();
  if(sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,26).getValues().map(function(row,index){
    var start=sapaDate_(row[2]),end=sapaDate_(row[3])||start;
    return {row:index+2,raw:row,id:String(row[21]||''),status:String(row[22]||'aktif'),requestId:String(row[23]||''),
      created:sapaDate_(row[24])||sapaDate_(row[0]),person:String(row[1]||''),start:start,end:end,
      room:sapaRoom_(row[8]),activity:String(row[6]||''),department:String(row[10]||'')};
  });
}
function sapaPublic_(item,admin) {
  var result={id:item.id,person:item.person,activity:item.activity,department:item.department,start:item.start,end:item.end,created:item.created,status:item.status,room:item.room==='uncertain'?'Lokasi lama perlu diperiksa':'Ruang Lingkar Barat'};
  if(admin)Object.assign(result,{startTime:sapaTime_(item.raw[4]),endTime:sapaTime_(item.raw[5]),purpose:String(item.raw[7]||''),invitees:String(item.raw[9]||''),output:String(item.raw[17]||''),attachment:String(item.raw[19]||item.raw[18]||''),notes:String(item.raw[20]||''),requestId:item.requestId});
  return result;
}
function sapaTime_(value) {return value instanceof Date?Utilities.formatDate(value,SAPA_ZONE,'HH:mm'):String(value||'').slice(0,5);}
function sapaConflicts_(rows,start,end,exclude) {
  return rows.filter(function(item){return item.id!==exclude && item.status!=='dibatalkan' && item.room!=='other' && item.start && item.end && item.start<=end && item.end>=start;});
}
function sapaFail_(status,message) {var error=new Error(message);error.status=status;throw error;}
function sapaValidate_(value) {
  if(!value||value.room!=='lingkar-barat'||SAPA_DEPARTMENTS.indexOf(value.department)<0)sapaFail_(400,'Ruangan atau bidang tidak valid.');
  ['person','activity','purpose','output'].forEach(function(field){if(typeof value[field]!=='string'||!value[field].trim()||value[field].length>(field==='person'?160:1000))sapaFail_(400,'Lengkapi data kegiatan.');});
  ['invitees','notes','attachment'].forEach(function(field){if(typeof value[field]!=='string'||value[field].length>(field==='attachment'?2048:1000))sapaFail_(400,'Data kegiatan terlalu panjang.');});
  if(!/^[a-f0-9-]{36}$/i.test(value.requestId||''))sapaFail_(400,'ID permintaan tidak valid.');
  var today=Utilities.formatDate(new Date(),SAPA_ZONE,'yyyy-MM-dd');
  if(!sapaDate_(value.start)||!sapaDate_(value.end)||value.start<today||value.end<value.start||Date.parse(value.end)-Date.parse(value.start)>30*86400000||Date.parse(value.end)>Date.now()+366*86400000)sapaFail_(400,'Tanggal kegiatan tidak valid.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime)||(value.start===value.end&&value.endTime<=value.startTime))sapaFail_(400,'Jam kegiatan tidak valid.');
  if(value.attachment&&!/^https:\/\//i.test(value.attachment))sapaFail_(400,'Lampiran harus berupa tautan HTTPS.');
}
function sapaCell_(value) {return /^[=+@\-\t\r]/.test(value)?"'"+value:value;}
function sapaWrite_(value,existing) {
  var row=new Array(26).fill('');
  row[0]=existing?existing.raw[0]:new Date();row[1]=sapaCell_(value.person);
  row[2]=new Date(value.start+'T12:00:00+07:00');row[3]=new Date(value.end+'T12:00:00+07:00');
  // Kolom E dan F lama adalah jam mulai dan jam selesai; G dan H uraian serta tujuan.
  row[4]=value.startTime;row[5]=value.endTime;row[6]=sapaCell_(value.activity);row[7]=sapaCell_(value.purpose);
  row[8]='Ruang Lingkar Barat';row[9]=sapaCell_(value.invitees);row[10]=value.department;
  row[17]=sapaCell_(value.output);row[19]=sapaCell_(value.attachment);row[20]=sapaCell_(value.notes);
  row[21]=existing?existing.id:Utilities.getUuid();row[22]='aktif';row[23]=value.requestId;
  row[24]=existing?existing.raw[24]:new Date();row[25]=new Date();
  var sheet=sapaSheet_(),number=existing?existing.row:sheet.getLastRow()+1;
  if(number>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),Math.max(100,number-sheet.getMaxRows()));
  sheet.getRange(number,1,1,26).setValues([row]);
  sheet.getRange(number,3,1,2).setNumberFormat('yyyy-mm-dd');
  SpreadsheetApp.flush();
  return {id:row[21],start:value.start,end:value.end};
}
function sapaHandle_(input) {
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('SAPA_KEY')||input.key!==props.getProperty('SAPA_KEY'))sapaFail_(401,'Kunci penghubung tidak valid.');
  if(props.getProperty('SAPA_READY')!=='1')sapaFail_(503,'Jalankan siapkanSAPA terlebih dahulu.');
  if(['health','book','edit'].indexOf(input.action)>=0) {
    var formUrl=props.getProperty('SAPA_LEGACY_FORM_URL');
    if(formUrl&&FormApp.openByUrl(formUrl).isAcceptingResponses())sapaFail_(503,'Google Form lama masih menerima jawaban. Tutup penerimaannya agar pemesanan tidak melewati pemeriksaan SAPA.');
  }
  if(input.action==='health')return {ok:true,version:2,spreadsheetId:SAPA_SHEET_ID};
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))sapaFail_(503,'Ada pemesanan lain yang sedang diproses. Coba kembali.');
  try {
    var rows=sapaRows_(),now=new Date(),today=Utilities.formatDate(now,SAPA_ZONE,'yyyy-MM-dd');
    if(input.action==='list'||input.action==='adminList') {
      var cutoff=Utilities.formatDate(new Date(now.getTime()-29*86400000),SAPA_ZONE,'yyyy-MM-dd');
      var until=Utilities.formatDate(new Date(now.getTime()+366*86400000),SAPA_ZONE,'yyyy-MM-dd');
      var admin=input.action==='adminList';
      return {ok:true,bookings:rows.filter(function(item){return item.room!=='other'&&item.start&&(admin||item.status!=='dibatalkan')&&((item.created>=cutoff&&item.created<=today)||(item.end>=today&&item.start<=until));}).map(function(item){return sapaPublic_(item,admin);})};
    }
    if(input.action==='availability') {
      if(!sapaDate_(input.start)||!sapaDate_(input.end)||input.end<input.start||Date.parse(input.end)-Date.parse(input.start)>30*86400000)sapaFail_(400,'Tanggal tidak valid.');
      var conflicts=sapaConflicts_(rows,input.start,input.end,null);
      return {ok:true,available:!conflicts.length,conflicts:conflicts.map(function(item){return sapaPublic_(item,false);})};
    }
    var existing=rows.find(function(item){return item.id&&item.id===input.id;});
    if(input.action==='cancel') {
      if(!existing)sapaFail_(404,'Pesanan tidak ditemukan. Data lama dikelola melalui spreadsheet.');
      sapaSheet_().getRange(existing.row,23).setValue('dibatalkan');
      sapaSheet_().getRange(existing.row,26).setValue(new Date());
      SpreadsheetApp.flush();return {ok:true};
    }
    if(input.action==='book'||input.action==='edit') {
      var value=input.value;sapaValidate_(value);
      if(input.action==='edit'&&!existing)sapaFail_(404,'Pesanan tidak ditemukan.');
      if(input.action==='book') {
        var duplicate=rows.find(function(item){return item.requestId===value.requestId;});
        if(duplicate) {
          if(duplicate.status==='dibatalkan')sapaFail_(409,'Pesanan ini sudah dibatalkan. Muat ulang formulir untuk memesan kembali.');
          var detail=sapaPublic_(duplicate,true);
          var same=['person','activity','purpose','invitees','output','notes','attachment','department','start','end','startTime','endTime'].every(function(field){return detail[field]===value[field]||detail[field]===sapaCell_(value[field]);});
          if(!same)sapaFail_(409,'Permintaan sebelumnya sudah tersimpan. Periksa daftar pesanan sebelum mengubah isian.');
          return {ok:true,booking:{id:duplicate.id,start:duplicate.start,end:duplicate.end},duplicate:true};
        }
      }
      var conflicts=sapaConflicts_(rows,value.start,value.end,existing?existing.id:null);
      if(conflicts.length)sapaFail_(409,'Ruang Lingkar Barat sudah dipesan pada tanggal tersebut. Pilih tanggal lain. Data lama dengan lokasi belum jelas juga harus diperiksa admin.');
      return {ok:true,booking:sapaWrite_(value,existing)};
    }
    sapaFail_(400,'Tindakan tidak dikenal.');
  } finally {lock.releaseLock();}
}
function doPost(e) {
  var result;
  try {
    if(!e||!e.postData||e.postData.contents.length>20000)sapaFail_(400,'Data tidak valid.');
    result=sapaHandle_(JSON.parse(e.postData.contents));
  }catch(error){result={ok:false,status:error.status||503,error:error.status?error.message:'Penghubung spreadsheet bermasalah. Periksa pengaturan Apps Script.'};}
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/* Kloning suara lokal, tanpa API: Pocket TTS Indonesian (ringan) dan VoxCPM2 (kualitas tinggi).
   Berjalan lewat mesin lokal FlexCut. Suara sendiri atau yang sudah memberi izin.
   VoxCPM2: OpenBMB, Apache-2.0. Pocket TTS Indonesian: anak10thn (dasar Kyutai pocket-tts), CC-BY-4.0, data LEMAS Project.
   suara.py: Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id */
const voxEngines={
 pocket:{label:'Ringan · Pocket TTS Indonesian',size:'±0,5 GB',time:'sekitar 3–10 menit',
  note:'Berjalan di CPU laptop biasa. Cocok untuk satu suara narator. Kualitas setara telepon atau video YouTube.',
  disk:'Ruang disk kosong sekitar 3 GB (model dan pustaka pendukung).'},
 voxcpm:{label:'Kualitas tinggi · VoxCPM2',size:'±5 GB',time:'sekitar 10–40 menit',
  note:'Suara paling natural, 48 kHz. Tanpa GPU prosesnya lambat.',
  disk:'Ruang disk kosong sekitar 12 GB dan RAM sebaiknya 16 GB.'}
};
let voxState={ok:false};
async function voxcpmHealth(){
 let health;
 try{health=await connectMalikiEngine()}catch(error){return {ok:false,error:error.message}}
 return {ok:true,outdated:health.voice_clone===undefined,voxcpm:!!health.system?.voxcpm,pocket:!!health.pocket};
}
function voxSelected(){return document.querySelector('input[name="voxEngine"]:checked')?.value||'pocket'}
function voxRender(){
 const status=$('#voxStatus'),guide=$('#voxGuide');if(!status||!guide)return;
 const st=voxState,kind=voxSelected(),info=voxEngines[kind];
 if(!st.ok){
  status.innerHTML='⚪ Mesin FlexCut belum berjalan. <a href="'+esc(malikiEngineDownload)+'" target="_blank" rel="noopener">Unduh mesin</a>, ekstrak ZIP, lalu klik dua kali <b>Mulai FlexCut.cmd</b> (Windows). Setelah mesin menyala, buka kembali panel ini.';
  guide.hidden=true;return;
 }
 if(st.outdated){
  status.innerHTML='⚠️ Mesin Anda versi lama. <a href="'+esc(malikiEngineDownload)+'" target="_blank" rel="noopener">Unduh mesin terbaru</a> lalu jalankan ulang.';
  guide.hidden=true;return;
 }
 const ready=!!st[kind];
 status.textContent=ready?'✅ Mesin terhubung · model siap dipakai.':'✅ Mesin terhubung · model belum diunduh.';
 guide.hidden=ready;
 if(!ready){
  guide.innerHTML='<b>Pertama kali memakai mode ini, unduh model dulu (sekali saja):</b>'+
   '<ol><li>Klik <b>Unduh model</b>. Ukuran '+info.size+', '+info.time+' tergantung kecepatan internet. '+info.disk+'</li>'+
   '<li>Tunggu sampai muncul “Komponen mesin siap”. Biarkan jendela mesin FlexCut tetap terbuka dan komputer menyala.</li>'+
   '<li>Model tersimpan di komputer Anda (folder cache Hugging Face) dan tidak perlu diunduh lagi.</li>'+
   '<li>Kembali ke panel ini, unggah rekaman, lalu klik <b>Buat narasi</b>.</li></ol>'+
   '<button type="button" id="voxDownload">Unduh model '+info.size+'</button>';
  $('#voxDownload').onclick=voxDownload;
 }
}
async function voxDownload(){
 const kind=voxSelected();
 try{
  await runMalikiJob('/api/siapkan',{komponen:kind});
 }catch(error){toast(error.message)}
 showVoxcpm();
}
async function voxcpmRefresh(){
 voxState=await voxcpmHealth();
 voxRender();
}
async function voxToWav(file){
 const ctx=new (window.AudioContext||window.webkitAudioContext)();
 try{
  const buffer=await ctx.decodeAudioData(await file.arrayBuffer());
  const rate=buffer.sampleRate,n=Math.min(buffer.length,rate*30),channels=buffer.numberOfChannels;
  const mono=new Float32Array(n);
  for(let c=0;c<channels;c++){const data=buffer.getChannelData(c);for(let i=0;i<n;i++)mono[i]+=data[i]/channels}
  const view=new DataView(new ArrayBuffer(44+n*2));
  const put=(offset,text)=>[...text].forEach((char,i)=>view.setUint8(offset+i,char.charCodeAt(0)));
  put(0,'RIFF');view.setUint32(4,36+n*2,true);put(8,'WAVEfmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);
  view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  put(36,'data');view.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,mono[i]))*32767),true);
  return new File([view.buffer],'referensi.wav',{type:'audio/wav'});
 }catch(error){
  throw new Error('Rekaman tidak dapat dibaca. Gunakan WAV, MP3, M4A, FLAC, atau OGG yang valid.');
 }finally{ctx.close()}
}
function showVoxcpm(){
 if(job||exporting||captureSession)return toast('Selesaikan proses yang berjalan terlebih dahulu.');
 pause();
 modal('<div id="malikiWorkbench"><h2>Kloning suara lokal</h2>'+
  '<p class="featureNote">Berjalan di komputer Anda lewat mesin lokal, tanpa API dan tanpa server. Pakai rekaman 10–20 detik, hanya suara sendiri atau yang sudah memberi izin.</p>'+
  '<p id="voxStatus" class="featureNote" role="status">Memeriksa mesin…</p>'+
  '<div id="voxGuide" class="featureNote" hidden></div>'+
  '<form id="voxForm" class="malikiForm">'+
  '<fieldset class="featureLabel"><legend>Mesin suara</legend>'+Object.entries(voxEngines).map(([key,info],index)=>
   '<label class="checkLabel"><input type="radio" name="voxEngine" value="'+key+'"'+(index?'':' checked')+'> '+info.label+' ('+info.size+')<br><small>'+info.note+'</small></label>').join('')+'</fieldset>'+
  '<label class="featureLabel">Rekaman referensi<input id="voxSample" type="file" accept=".wav,.mp3,.m4a,.flac,.ogg" required></label>'+
  '<label class="featureLabel">Teks narasi<textarea id="voxText" rows="4" maxlength="1000" required></textarea></label>'+
  '<label class="checkLabel"><input id="voxConsent" type="checkbox" required> Saya memiliki izin memakai suara ini.</label>'+
  '<div class="malikiButtons"><button class="primary" type="submit">Buat narasi</button></div>'+
  '<p class="featureNote">Beri label “suara AI” saat hasilnya diunggah ke media sosial. Kredit model: VoxCPM2 (OpenBMB, Apache-2.0); Pocket TTS Indonesian (anak10thn, dasar Kyutai pocket-tts, CC-BY-4.0, data LEMAS Project).</p></form>'+
  '<div class="actions"><button id="closeModal">Tutup</button></div></div>');
 document.querySelectorAll('input[name="voxEngine"]').forEach(input=>input.onchange=voxRender);
 voxcpmRefresh();
 $('#voxForm').onsubmit=async event=>{
  event.preventDefault();
  try{
   let file=$('#voxSample').files[0];const text=$('#voxText').value.trim(),kind=voxSelected(),info=voxEngines[kind];
   if(!file?.size||!text||!$('#voxConsent').checked)throw new Error('Lengkapi rekaman, teks narasi, dan izin suara.');
   if(file.size>50*1024*1024)throw new Error('Gunakan rekaman maksimal 50 MB.');
   voxState=await voxcpmHealth();
   if(!voxState.ok)throw new Error('Mesin FlexCut belum berjalan. Unduh dan jalankan mesin lokal terlebih dahulu.');
   if(voxState.outdated)throw new Error('Mesin Anda versi lama. Unduh mesin FlexCut terbaru.');
   if(!voxState[kind]){
    if(!confirm('Model "'+info.label+'" belum diunduh.\n\nPertama kali dipakai, model diunduh sekali saja ('+info.size+', '+info.time+'). '+info.disk+'\nBiarkan jendela mesin FlexCut tetap terbuka sampai selesai. Setelah itu model tersimpan di komputer dan narasi langsung dibuat.\n\nUnduh sekarang?'))return;
    await runMalikiJob('/api/siapkan',{komponen:kind});
    voxState=await voxcpmHealth();
    if(!voxState[kind])throw new Error('Model belum terpasang. Periksa koneksi internet dan ruang disk, lalu coba lagi.');
    $('#modal')?.close();
   }
   if(kind==='pocket')file=await voxToWav(file);
   const up=await malikiRequest('/api/unggah',{file,headers:{'X-Nama-File':encodeURIComponent(file.name)},timeout:300000});
   await runMalikiJob('/api/flexcut/klon-suara',{referensi:up.jalur,teks:text,izin:true,mesin:kind});
  }catch(error){toast(error.message)}
 };
}

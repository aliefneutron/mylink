/* Kloning suara lokal VoxCPM2 (OpenBMB, Apache-2.0), tanpa API.
   Berjalan lewat mesin lokal FlexCut. Suara sendiri atau yang sudah memberi izin.
   suara.py: Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id */
async function voxcpmHealth(){
 try{await connectMalikiEngine()}catch(error){return {ok:false,error:error.message}}
 try{
  const health=await malikiRequest('/api/flexcut/health');
  return {ok:true,installed:!!health.system?.voxcpm,uv:health.system?.uv!==false};
 }catch(error){return {ok:false,error:error.message}}
}
async function voxcpmStatus(){
 const box=$('#voxStatus');if(!box)return;
 const state=await voxcpmHealth();
 if(!$('#voxStatus'))return;
 if(!state.ok){
  box.innerHTML='⚪ Mesin FlexCut belum berjalan. <a href="'+esc(malikiEngineDownload)+'" target="_blank" rel="noopener">Unduh mesin</a>, ekstrak, lalu klik <b>Mulai FlexCut.cmd</b> (Windows). Setelah mesin menyala, buka kembali panel ini.';
  return;
 }
 box.textContent=state.installed?'✅ Mesin terhubung · VoxCPM2 siap dipakai.'
  :'✅ Mesin terhubung · VoxCPM2 belum dipasang. Akan terpasang otomatis saat Anda klik Buat narasi (unduhan ±5 GB, hanya sekali).';
}
function showVoxcpm(){
 if(job||exporting||captureSession)return toast('Selesaikan proses yang berjalan terlebih dahulu.');
 pause();
 modal('<div id="malikiWorkbench"><h2>Kloning suara VoxCPM2 (lokal)</h2>'+
  '<p class="featureNote">Berjalan di komputer Anda lewat mesin lokal, tanpa API dan tanpa server. Pakai rekaman 10–20 detik, hanya suara sendiri atau yang sudah memberi izin.</p>'+
  '<p id="voxStatus" class="featureNote" role="status">Memeriksa mesin…</p>'+
  '<form id="voxForm" class="malikiForm">'+
  '<label class="featureLabel">Rekaman referensi<input id="voxSample" type="file" accept=".wav,.mp3,.m4a,.flac,.ogg" required></label>'+
  '<label class="featureLabel">Teks narasi<textarea id="voxText" rows="4" maxlength="1000" required></textarea></label>'+
  '<label class="checkLabel"><input id="voxConsent" type="checkbox" required> Saya memiliki izin memakai suara ini.</label>'+
  '<div class="malikiButtons"><button class="primary" type="submit">Buat narasi</button></div>'+
  '<p class="featureNote">Beri label “suara AI” saat hasilnya diunggah ke media sosial.</p></form>'+
  '<div class="actions"><button id="voxToVoicebox">Pakai Voicebox (server)</button><button id="closeModal">Tutup</button></div></div>');
 $('#voxToVoicebox').onclick=showVoicebox;
 voxcpmStatus();
 $('#voxForm').onsubmit=async event=>{
  event.preventDefault();
  try{
   const file=$('#voxSample').files[0],text=$('#voxText').value.trim();
   if(!file?.size||!text||!$('#voxConsent').checked)throw new Error('Lengkapi rekaman, teks narasi, dan izin suara.');
   if(file.size>50*1024*1024)throw new Error('Gunakan rekaman maksimal 50 MB.');
   let state=await voxcpmHealth();
   if(!state.ok)throw new Error('Mesin FlexCut belum berjalan. Unduh dan jalankan mesin lokal terlebih dahulu.');
   if(!state.installed){
    toast('Memasang VoxCPM2 otomatis (±5 GB, hanya sekali)…');
    await runMalikiJob('/api/siapkan',{komponen:'voxcpm'});
    state=await voxcpmHealth();
    if(!state.installed)throw new Error('VoxCPM2 belum terpasang. Periksa koneksi internet dan ruang disk (butuh ±12 GB), lalu coba lagi.');
    $('#modal')?.close();
   }
   const up=await malikiRequest('/api/unggah',{file,headers:{'X-Nama-File':encodeURIComponent(file.name)},timeout:300000});
   await runMalikiJob('/api/flexcut/klon-suara',{referensi:up.jalur,teks:text,izin:true});
  }catch(error){toast(error.message)}
 };
}

/* Kloning suara lokal VoxCPM2 (OpenBMB, Apache-2.0), tanpa API.
   Berjalan lewat mesin lokal FlexCut. Suara sendiri atau yang sudah memberi izin.
   suara.py: Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id */
function showVoxcpm(){
 if(job||exporting||captureSession)return toast('Selesaikan proses yang berjalan terlebih dahulu.');
 pause();
 modal('<div id="malikiWorkbench"><h2>Kloning suara VoxCPM2 (lokal)</h2>'+
  '<p class="featureNote">Berjalan di komputer Anda lewat mesin lokal, tanpa API dan tanpa server. Pakai rekaman 10–20 detik, hanya suara sendiri atau yang sudah memberi izin. Model diunduh sekali (±5 GB).</p>'+
  '<form id="voxForm" class="malikiForm">'+
  '<label class="featureLabel">Rekaman referensi<input id="voxSample" type="file" accept=".wav,.mp3,.m4a,.flac,.ogg" required></label>'+
  '<label class="featureLabel">Teks narasi<textarea id="voxText" rows="4" maxlength="1000" required></textarea></label>'+
  '<label class="checkLabel"><input id="voxConsent" type="checkbox" required> Saya memiliki izin memakai suara ini.</label>'+
  '<div class="malikiButtons"><button class="primary" type="submit">Buat narasi</button>'+
  '<button type="button" id="voxInstall">Pasang VoxCPM2 (±5 GB)</button></div>'+
  '<p class="featureNote">Beri label “suara AI” saat hasilnya diunggah ke media sosial.</p></form>'+
  '<div class="actions"><button id="voxToVoicebox">Pakai Voicebox (server)</button><button id="closeModal">Tutup</button></div></div>');
 $('#voxToVoicebox').onclick=showVoicebox;
 $('#voxInstall').onclick=()=>runMalikiJob('/api/siapkan',{komponen:'voxcpm'}).catch(error=>toast(error.message));
 $('#voxForm').onsubmit=async event=>{
  event.preventDefault();
  try{
   await connectMalikiEngine();
   const file=$('#voxSample').files[0],text=$('#voxText').value.trim();
   if(!file?.size||!text||!$('#voxConsent').checked)throw new Error('Lengkapi rekaman, teks narasi, dan izin suara.');
   if(file.size>50*1024*1024)throw new Error('Gunakan rekaman maksimal 50 MB.');
   const up=await malikiRequest('/api/unggah',{file,headers:{'X-Nama-File':encodeURIComponent(file.name)},timeout:300000});
   await runMalikiJob('/api/flexcut/klon-suara',{referensi:up.jalur,teks:text,izin:true});
  }catch(error){toast(error.message)}
 };
}

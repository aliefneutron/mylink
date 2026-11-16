const voiceboxLanguages={en:'Inggris',ms:'Melayu',ar:'Arab',zh:'Mandarin',ja:'Jepang',ko:'Korea',
 de:'Jerman',fr:'Prancis',ru:'Rusia',pt:'Portugis',es:'Spanyol',it:'Italia',he:'Ibrani',da:'Denmark',
 el:'Yunani',fi:'Finlandia',hi:'Hindi',nl:'Belanda',no:'Norwegia',pl:'Polandia',sv:'Swedia',sw:'Swahili',tr:'Turki'};
const voiceboxEngines={
 chatterbox:Object.keys(voiceboxLanguages),
 qwen:['en','zh','ja','ko','de','fr','ru','pt','es','it']
};
const voiceboxURLKey='flexcut-voicebox-url';
let voiceboxToken='';
let voiceboxTokenOrigin='';
function voiceboxForm(){
 return '<form id="voiceboxForm" class="malikiForm">'+
  '<label class="featureLabel">Alamat HTTPS Voicebox<input id="voiceboxURL" type="url" required value="'+esc(localStorage.getItem(voiceboxURLKey)||'')+'" placeholder="https://voice.example.com"></label>'+
  '<label class="featureLabel">Token akses server<input id="voiceboxToken" type="password" autocomplete="off" placeholder="'+(voiceboxToken?'Token sesi tersimpan':'Jika server memerlukannya')+'"></label>'+
  '<div class="malikiButtons"><button type="button" id="testVoicebox">Tes koneksi Voicebox</button>'+
  '<span id="voiceboxStatus" class="featureNote" role="status"></span></div>'+
  '<div class="malikiColumns"><label class="featureLabel">Model<select id="voiceboxEngine"><option value="chatterbox">Chatterbox Multilingual</option><option value="qwen">Qwen3-TTS</option></select></label>'+
  '<label class="featureLabel">Bahasa<select id="voiceboxLanguage"></select></label></div>'+
  '<label class="featureLabel">Rekaman referensi<input id="voiceboxSample" type="file" accept=".wav,.mp3,.m4a,.ogg,.flac,.aac,.webm,.opus" required></label>'+
  '<label class="featureLabel">Transkrip rekaman referensi<input id="voiceboxTranscript" maxlength="1000" required></label>'+
  '<label class="featureLabel">Teks narasi<textarea id="voiceboxSpeech" rows="4" maxlength="5000" required></textarea></label>'+
  '<label class="checkLabel"><input id="voiceboxConsent" type="checkbox" required> Saya memiliki izin memakai suara ini dan mengirim rekamannya ke server Voicebox.</label>'+
  '<button class="primary" type="submit">Buat narasi dengan Voicebox</button>'+
  '<p class="featureNote">Pemrosesan berlangsung di server Voicebox. <a href="https://github.com/jamiepine/voicebox" target="_blank" rel="noopener">Dokumentasi Voicebox</a></p></form>';
}
function voiceboxConnection(){
 const value=$('#voiceboxURL').value.trim();
 if(!value)throw new Error('Masukkan alamat HTTPS server Voicebox.');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash){
  throw new Error('Masukkan alamat HTTPS server Voicebox. Isi token pada kolom terpisah.');
 }
 const base=url.href.replace(/\/+$/,'');
 const token=$('#voiceboxToken').value.trim()||(base===voiceboxTokenOrigin?voiceboxToken:'');
 return {base,token};
}
async function voiceboxRequest(connection,path,{method='GET',data,form,signal,audio=false}={}){
 const timeout=AbortSignal.timeout(60000);
 let response;
 try{
  response=await fetch(connection.base+path,{
   method,credentials:'omit',cache:'no-store',redirect:'error',
   headers:{...(connection.token?{Authorization:'Bearer '+connection.token}:{}),...(data?{'Content-Type':'application/json'}:{})},
   body:form||(data?JSON.stringify(data):undefined),
   signal:signal?AbortSignal.any([signal,timeout]):timeout
  });
 }catch(error){
  if(signal?.aborted)throw error;
  throw new Error('Server Voicebox tidak dapat dihubungi. Periksa alamat HTTPS dan izin CORS untuk FlexCut.');
 }
 if(!response.ok){
  const payload=await response.json().catch(()=>null);
  throw new Error(typeof payload?.detail==='string'?payload.detail:'Voicebox mengembalikan HTTP '+response.status+'.');
 }
 return audio?response.blob():response.json();
}
function saveVoiceboxConnection(connection){
 localStorage.setItem(voiceboxURLKey,connection.base);
 voiceboxToken=connection.token;
 voiceboxTokenOrigin=connection.base;
}
function bindVoiceboxForm(){
 const engine=$('#voiceboxEngine'),language=$('#voiceboxLanguage');
 const updateLanguages=()=>{
  const previous=language.value||'en';
  language.replaceChildren(...voiceboxEngines[engine.value].map(code=>new Option(voiceboxLanguages[code],code)));
  language.value=voiceboxEngines[engine.value].includes(previous)?previous:'en';
 };
 updateLanguages();engine.onchange=updateLanguages;
 $('#testVoicebox').onclick=async event=>{
  const button=event.currentTarget,status=$('#voiceboxStatus');
  button.disabled=true;
  try{
   const connection=voiceboxConnection(),health=await voiceboxRequest(connection,'/health');
   if(health.status!=='healthy')throw new Error('Alamat ini belum melayani API Voicebox yang sehat.');
   if(connection.token)await voiceboxRequest(connection,'/profiles');
   saveVoiceboxConnection(connection);
   $('#voiceboxToken').value='';$('#voiceboxToken').placeholder=voiceboxToken?'Token sesi tersimpan':'Jika server memerlukannya';
   status.textContent='Voicebox terhubung.';
  }catch(error){status.textContent=error.message}
  finally{button.disabled=false}
 };
 $('#voiceboxForm').onsubmit=event=>{
  event.preventDefault();
  try{
   const connection=voiceboxConnection(),file=$('#voiceboxSample').files[0];
   const text=$('#voiceboxSpeech').value.trim(),reference=$('#voiceboxTranscript').value.trim();
   if(!file?.size||!text||!reference||!$('#voiceboxConsent').checked)throw new Error('Lengkapi rekaman, transkrip, teks narasi, dan izin suara.');
   if(file.size>50*1024*1024)throw new Error('Gunakan rekaman maksimal 50 MB.');
   runVoiceboxClone(connection,{file,text,reference,engine:engine.value,language:language.value});
  }catch(error){$('#voiceboxStatus').textContent=error.message}
 };
}
async function runVoiceboxClone(connection,options){
 if(job||exporting)return;
 const token=beginJob('Membuat narasi dengan Voicebox');
 const controller=new AbortController(),signal=controller.signal;
 token.cancelHooks.push(()=>controller.abort());
 let profilePath,generationPath,completed=false,asset;
 try{
  setJobStatus('Menghubungkan ke Voicebox…');
  const health=await voiceboxRequest(connection,'/health',{signal});
  if(health.status!=='healthy')throw new Error('Server Voicebox belum siap.');
  saveVoiceboxConnection(connection);
  const profile=await voiceboxRequest(connection,'/profiles',{method:'POST',signal,data:{
   name:'FlexCut '+new Date().toISOString(),voice_type:'cloned',language:options.language,default_engine:options.engine
  }});
  if(!profile.id)throw new Error('Voicebox gagal membuat profil suara.');
  profilePath='/profiles/'+encodeURIComponent(profile.id);
  assertJob(token);
  const form=new FormData();
  form.append('file',options.file);
  form.append('reference_text',options.reference);
  setJobStatus('Mengirim rekaman referensi…');
  await voiceboxRequest(connection,profilePath+'/samples',{method:'POST',form,signal});
  const generation=await voiceboxRequest(connection,'/generate',{method:'POST',signal,data:{
   profile_id:profile.id,text:options.text,language:options.language,engine:options.engine,
   ...(options.engine==='qwen'?{model_size:'0.6B'}:{})
  }});
  if(!generation.id)throw new Error('Voicebox belum membuat pekerjaan narasi.');
  const id=encodeURIComponent(generation.id);
  generationPath='/generate/'+id;
  let status=generation;
  const deadline=Date.now()+15*60*1000;
  while(status.status!=='completed'){
   if(status.status==='failed')throw new Error(status.error||'Voicebox gagal menghasilkan suara.');
   if(Date.now()>=deadline)throw new Error('Voicebox belum selesai setelah 15 menit.');
   setJobStatus(status.status==='loading_model'?'Menyiapkan model di server Voicebox…':'Menghasilkan narasi di server Voicebox…');
   await new Promise(resolve=>setTimeout(resolve,1500));
   assertJob(token);
   status=await voiceboxRequest(connection,'/history/'+id,{signal});
  }
  completed=true;
  const blob=await voiceboxRequest(connection,'/audio/'+id,{signal,audio:true});
  if(!blob.size)throw new Error('Audio yang dikembalikan Voicebox kosong.');
  const file=new File([blob],'Narasi Voicebox.wav',{type:'audio/wav'});
  asset=await automaticAsset(file,'audio',token);
  assertJob(token);
  endJob(token);
  modal('<h2>Narasi Voicebox siap</h2><audio controls src="'+esc(asset.src)+'"></audio>'+
   '<div class="actions"><button id="closeModal">Tutup</button><button id="saveVoiceboxWav">Unduh WAV</button>'+
   '<button class="primary" id="addVoiceboxAudio">Tambahkan ke timeline</button></div>');
  const dialog=$('#modal');
  const release=()=>{
   if(dialog.open)return;
   dialog.removeEventListener('close',release);
   if(!assets.includes(asset)){
    URL.revokeObjectURL(asset.src);
    removeProcessedAsset(asset.id).catch(()=>{});
   }
  };
  dialog.addEventListener('close',release);
  $('#saveVoiceboxWav').onclick=()=>download(file,file.name);
  $('#addVoiceboxAudio').onclick=()=>{
   commit();assets.push(asset);addAsset(asset.id,{recordHistory:false});dialog.close();
  };
 }catch(error){
  if(asset){URL.revokeObjectURL(asset.src);removeProcessedAsset(asset.id).catch(()=>{})}
  endJob(token);
  if(!token.cancelled)modal('<h2>Narasi Voicebox belum selesai</h2><p>'+esc(error.message)+'</p><div class="actions">'+
   '<button id="closeModal">Tutup</button><button id="retryVoicebox">Kembali ke Voicebox</button></div>');
  $('#retryVoicebox')?.addEventListener('click',()=>showMalikiWorkbench('voice'));
 }finally{
  if(generationPath&&!completed)await voiceboxRequest(connection,generationPath+'/cancel',{method:'POST'}).catch(()=>{});
  if(profilePath)await voiceboxRequest(connection,profilePath,{method:'DELETE'}).catch(()=>{});
 }
}

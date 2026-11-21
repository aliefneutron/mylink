// Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id
// Adapted from vendor/studio-maliki. See its LICENSE and FLEXCUT-NOTICE.md.
let malikiTemplates=[],malikiSettings={},malikiConnected=false,malikiView='motion',malikiStyle='garis';
let malikiDraft={topic:'',notes:'',json:''};
const malikiConnectionKey='flexcut-motion-engine-url';
const malikiEngineDownload='https://aliefneutron.my.id/flexcut-studio/downloads/FlexCut-Motion-Engine.zip';
let malikiEngine='',malikiToken='',malikiTokenOrigin='';
try{malikiEngine=localStorage.getItem(malikiConnectionKey)||''}catch(error){}
if(!malikiEngine&&['localhost','127.0.0.1'].includes(location.hostname))malikiEngine='http://127.0.0.1:8791';
if(location.pathname.startsWith('/app/')&&['localhost','127.0.0.1'].includes(location.hostname))malikiEngine=location.origin;

function malikiEngineURL(value){
 if(!String(value||'').trim())throw new Error('Isi alamat server mesin, misalnya https://mesin.contoh.com.');
 let url;
 try{url=new URL(String(value).trim())}catch(error){throw new Error('Alamat server mesin tidak valid. Contoh: https://mesin.contoh.com.')}
 const loopback=['127.0.0.1','localhost'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(loopback&&url.protocol==='http:'))){
  throw new Error('Gunakan alamat HTTPS server mesin tanpa token di alamat. Alamat http hanya untuk mesin di komputer ini.');
 }
 return url.origin;
}
function malikiIsLocalPage(){return ['localhost','127.0.0.1','[::1]'].includes(location.hostname)}
function malikiIsLoopback(origin){return ['127.0.0.1','localhost'].includes(new URL(origin).hostname)}
function malikiAuthHeaders(origin){return malikiToken&&origin===malikiTokenOrigin?{Authorization:'Bearer '+malikiToken}:{}}
function malikiApplyForm(){
 malikiEngine=malikiEngineURL($('#malikiEngineURL').value);
 const typed=($('#malikiEngineToken')?.value||'').trim();
 if(typed){malikiToken=typed;malikiTokenOrigin=malikiEngine}
}
async function malikiLoopbackPermission(){
 try{
  if(!navigator.permissions?.query)return '';
  return (await navigator.permissions.query({name:'loopback-network'})).state;
 }catch(error){return ''}
}
async function malikiRequest(path,{data,file,headers={},signal,timeout=30000}={}){
 const url=malikiEngineURL(malikiEngine);
 const loopback=malikiIsLoopback(url),needsLoopbackHint=loopback&&!malikiIsLocalPage();
 let response;
 try{
  response=await fetch(url+path,{
   method:data!==undefined||file?'POST':'GET',credentials:'omit',redirect:'error',
   headers:{...malikiAuthHeaders(url),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},
   body:file||(data!==undefined?JSON.stringify(data):undefined),
   signal:signal||AbortSignal.timeout(timeout),
   ...(needsLoopbackHint?{targetAddressSpace:'loopback'}:{})
  });
 }catch(error){
  if(signal?.aborted)throw error;
  if(error?.name==='TimeoutError')throw new Error('Server mesin tidak merespons dalam '+Math.round(timeout/1000)+' detik. Periksa apakah server aktif, lalu coba lagi.');
  if(!loopback)throw new Error('Server mesin tidak dapat dihubungi di '+url+'. Periksa alamat HTTPS, status server, dan pengaturan FLEXCUT_ORIGINS (izin CORS untuk '+location.origin+').');
  if(needsLoopbackHint&&await malikiLoopbackPermission()==='denied')throw new Error('Browser memblokir akses ke mesin di komputer ini. Izinkan akses jaringan lokal untuk situs ini di pengaturan situs browser, lalu muat ulang halaman.');
  throw new Error('Tidak dapat menghubungi mesin di '+url+'. Pastikan jendela Mulai FlexCut.cmd masih terbuka. Jika browser meminta akses jaringan lokal, pilih Izinkan.');
 }
 let result;
 try{result=await response.json()}catch(error){throw new Error('Respons mesin tidak valid (HTTP '+response.status+'). Gunakan paket mesin FlexCut terbaru.')}
 if(!response.ok||result.galat)throw new Error(result.galat||'Mesin belum dapat memproses permintaan.');
 return result;
}
async function malikiMediaBlob(path){
 const base=malikiEngineURL(malikiEngine),url=new URL('/api/flexcut/asset',base);
 url.searchParams.set('path',path);
 const response=await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error',headers:malikiAuthHeaders(base)});
 if(!response.ok)throw new Error('Hasil belum dapat diunduh dari server mesin.');
 return response.blob();
}
async function connectMalikiEngine(){
 const health=await malikiRequest('/api/flexcut/health');
 if(health.service!=='flexcut-motion'||health.templates!==24)throw new Error('Gunakan paket mesin FlexCut terbaru.');
 const settings=await malikiRequest('/api/pengaturan');
 malikiSettings=settings.pengaturan;
 malikiConnected=true;
 localStorage.setItem(malikiConnectionKey,malikiEngine);
 return health;
}
function malikiCredit(){
 return '<p class="malikiCredit">Template oleh <a href="https://malikisaputra.biz.id" target="_blank" rel="noopener">Maliki Saputra (@malikisaputra)</a> · '+
  '<a href="vendor/studio-maliki/LICENSE" target="_blank" rel="noopener">Lisensi nonkomersial</a></p>';
}
async function loadMalikiTemplates(){
 if(malikiTemplates.length)return;
 const response=await fetch('maliki-templates.json');
 if(!response.ok)throw new Error('Daftar template belum dapat dimuat.');
 malikiTemplates=await response.json();
 if(malikiTemplates.length!==24)throw new Error('Paket template belum lengkap.');
}
function malikiCards(selected=''){
 return malikiTemplates.map(template=>'<button type="button" class="malikiTemplate '+(template.id===selected?'chosen':'')+'" data-maliki-style="'+esc(template.id)+'">'+
  '<img src="'+esc(template.image)+'" alt="" loading="lazy"><strong>'+esc(template.name)+'</strong></button>').join('');
}
$('.navBottom').insertAdjacentHTML('beforebegin','<button data-tab="maliki"><b>'+editorIcon('sparkles',17)+'</b>Motion & Klip</button>');
$('[data-tab="maliki"]').onclick=()=>{tab='maliki';updateNav();renderLibrary()};
const libraryBeforeMaliki=renderLibrary;
renderLibrary=function(){
 if(tab!=='maliki')return libraryBeforeMaliki();
 $('#libraryTitle').textContent='Motion & Klip';
 $('#assetCount').textContent='24 template';
 $('#libraryContent').innerHTML='<div class="malikiLibrary"><button class="primary" data-maliki-open="motion">Buat motion</button>'+
  '<button class="secondary" data-maliki-open="clip">Potong video</button><button class="secondary" data-maliki-open="voice">Kloning suara</button>'+
  '<button data-maliki-open="connection">'+editorIcon('settings-2',14)+' Mesin Motion & Klip</button>'+
  '<button id="openMalikiHistory">Riwayat hasil mesin</button>'+
  '<div class="malikiTemplates">'+malikiCards()+'</div>'+malikiCredit()+'</div>';
 $$('[data-maliki-open]').forEach(button=>button.onclick=()=>showMalikiWorkbench(button.dataset.malikiOpen));
 $('#openMalikiHistory').onclick=showMalikiHistory;
 $$('[data-maliki-style]').forEach(button=>button.onclick=()=>{malikiStyle=button.dataset.malikiStyle;showMalikiWorkbench('motion')});
 if(!malikiTemplates.length)loadMalikiTemplates().then(()=>{if(tab==='maliki')renderLibrary()}).catch(error=>toast(error.message));
};
function malikiConnectionForm(){
 const config=malikiSettings,effective=config.AI==='langganan'?config.LANGGANAN:config.AI;
 const provider=effective==='openai'&&/localhost|127\.0\.0\.1/.test(config.OPENAI_BASE_URL||'')?'ollama':effective||'lokal';
 return '<form id="malikiConnectionForm" class="malikiForm">'+
  '<label class="featureLabel">Alamat server mesin (HTTPS)<input id="malikiEngineURL" type="url" value="'+esc(malikiEngine)+'" placeholder="https://mesin.contoh.com" required></label>'+
  '<label class="featureLabel">Token akses server<input id="malikiEngineToken" type="password" autocomplete="off" placeholder="'+(malikiToken?'Token sesi tersimpan':'Isi token yang diatur di server (FLEXCUT_TOKEN)')+'"></label>'+
  '<div class="malikiButtons"><button type="button" id="malikiConnect" class="primary">Hubungkan mesin</button></div>'+
  '<p class="featureNote">Motion dan Klip diproses di server mesin Anda, tanpa instalasi di komputer ini. Token hanya disimpan selama sesi browser.</p>'+
  '<details><summary>Atau jalankan di komputer sendiri</summary><p class="featureNote">Unduh paket, ekstrak, lalu jalankan Mulai FlexCut.cmd dan isi alamat http://127.0.0.1:8791.</p>'+
  '<a class="secondary malikiDownload" href="'+malikiEngineDownload+'" download>Unduh mesin lokal</a></details>'+
  '<label class="featureLabel">Penyedia naskah AI<select id="malikiProvider">'+
   [['lokal','Gratis · naskah template lokal'],['ollama','Gratis · Ollama lokal'],['gemini','Gemini · kuota akun Google'],['openai','OpenAI-compatible · biaya penyedia'],
    ['claude-code','Claude Code · kuota langganan'],['codex','Codex CLI · kuota langganan'],['opencode','OpenCode · penyedia yang terhubung']]
    .map(([id,name])=>'<option value="'+id+'" '+(id===provider?'selected':'')+'>'+name+'</option>').join('')+'</select></label>'+
  '<label class="featureLabel">Model<input id="malikiModel" value="'+esc(provider==='gemini'?config.GEMINI_MODEL||'gemini-3.8-flash':provider==='codex'?config.CODEX_MODEL||'':provider==='claude-code'?config.CLAUDE_CODE_MODEL||'sonnet':config.OPENAI_MODEL||'gemma3:4b')+'" placeholder="Model yang tersedia pada penyedia"></label>'+
  '<label class="featureLabel">Base URL untuk Ollama / OpenAI-compatible<input id="malikiBaseURL" value="'+esc(config.OPENAI_BASE_URL||'http://localhost:11434/v1')+'"></label>'+
  '<label class="featureLabel">API key<input id="malikiAPIKey" type="password" autocomplete="off" placeholder="'+(config.GEMINI_API_KEY||config.OPENAI_API_KEY?'Key sudah tersimpan di mesin':'Opsional untuk mode lokal dan Ollama')+'"></label>'+
  '<p class="featureNote">Key disimpan di pengaturan server mesin. Layanan cloud mengikuti kuota dan biaya penyedianya. CLI hanya tersedia bila terpasang dan login di mesin yang menjalankan server.</p>'+
  '<div class="malikiButtons"><button class="primary" type="submit">Simpan koneksi AI</button><button type="button" id="malikiTestAI">Tes koneksi AI</button></div>'+
  '<div class="malikiButtons"><button type="button" data-maliki-setup="motion">Siapkan Motion</button><button type="button" data-maliki-setup="klip">Siapkan Klip</button></div>'+
  '</form>';
}
function malikiMotionForm(){
 return '<form id="malikiMotionForm" class="malikiForm">'+
  '<label class="featureLabel">Topik<input id="malikiTopic" maxlength="300" value="'+esc(malikiDraft.topic)+'" placeholder="Misalnya, 3 kebiasaan belajar yang membantu fokus"></label>'+
  '<label class="featureLabel">Naskah atau poin cerita<textarea id="malikiNotes" rows="3">'+esc(malikiDraft.notes)+'</textarea></label>'+
  '<details><summary>Naskah JSON dari sumber lain</summary><label class="featureLabel">JSON adegan<textarea id="malikiJSON" rows="5" placeholder=\'{"judul":"Judul video","adegan":[{"judul":"Pembuka","teks":"Isi narasi","ikon":"💡"}]}\'>'+esc(malikiDraft.json)+'</textarea></label></details>'+
  '<div class="malikiTemplates malikiPicker">'+malikiCards(malikiStyle)+'</div>'+
  '<label class="checkLabel"><input id="malikiDrawAI" type="checkbox" '+((malikiSettings.AI||'lokal')==='lokal'?'disabled':'')+'> Buat ilustrasi SVG dengan AI yang tersambung</label>'+
  '<p class="featureNote">Mode lokal memakai naskah template atau JSON Anda. Penyedia AI dari panel Koneksi dapat mengembangkan topik. Narasi mengikuti setelan suara mesin.</p>'+
  '<button class="primary" type="submit">Buat video motion</button></form>';
}
function malikiClipForm(){
 return '<form id="malikiClipForm" class="malikiForm">'+
  '<label class="featureLabel">Unggah video<input id="malikiClipFile" type="file" accept="*/*"></label>'+
  '<label class="featureLabel">Atau tautan YouTube<input id="malikiClipURL" type="url" placeholder="https://www.youtube.com/watch?v=…"></label>'+
  '<div class="malikiColumns"><label class="featureLabel">Jumlah klip<input id="malikiClipCount" type="number" min="1" max="30" value="3" required></label>'+
  '<label class="featureLabel">Target durasi klip (detik)<input id="malikiClipDuration" type="number" min="5" max="180" value="30" required></label></div>'+
  '<label class="featureLabel">Momen yang dicari<input id="malikiClipDirection" maxlength="500" placeholder="Misalnya, penjelasan utama atau bagian paling menarik"></label>'+
  '<label class="featureLabel">Model transkripsi<select id="malikiWhisper"><option>small</option><option>tiny</option><option>base</option><option>medium</option><option>large-v3</option></select></label>'+
  '<label class="featureLabel">Subtitle SRT yang sudah ada (opsional)<input id="malikiClipSRT" type="file" accept=".srt"></label>'+
  '<p class="featureNote">Analisis lokal memakai transkripsi, energi suara, dan kalimat pembuka. Setelah analisis, pilih klip untuk dirender dengan subtitle dan pembingkaian wajah.</p>'+
  '<button class="primary" type="submit">Cari momen video</button></form>'+malikiManualCutPanel();
}
function malikiManualCutPanel(){
 return '<details class="malikiManual"><summary>Potong manual tanpa server (di browser)</summary><div id="malikiManualCut" class="malikiForm">'+
  '<label class="featureLabel">File video<input id="malikiCutFile" type="file" accept="video/*"></label>'+
  '<div class="malikiColumns"><label class="featureLabel">Mulai (detik)<input id="malikiCutStart" type="number" min="0" step="0.1" value="0"></label>'+
  '<label class="featureLabel">Selesai (detik)<input id="malikiCutEnd" type="number" min="0.1" step="0.1" value="30"></label></div>'+
  '<div class="malikiButtons"><button type="button" id="malikiCutTimeline" class="primary">Potong &amp; tambahkan ke timeline</button>'+
  '<button type="button" id="malikiCutDownload">Potong &amp; unduh MP4</button></div>'+
  '<p class="featureNote">Diproses di browser dengan FFmpeg, tanpa server dan tanpa unggah. FFmpeg diunduh sekali saat pertama dipakai. Maksimal 600 MB. Tidak ada analisis momen, subtitle, atau pelacakan wajah otomatis; fitur itu memerlukan server mesin.</p></div></details>';
}
function malikiManualCut(toTimeline){
 const file=$('#malikiCutFile').files[0],start=Number($('#malikiCutStart').value),end=Number($('#malikiCutEnd').value);
 if(!file)throw new Error('Pilih file video untuk dipotong.');
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw new Error('Isi waktu mulai dan selesai dalam detik. Selesai harus lebih besar dari mulai.');
 const name=file.name.replace(/\.[^.]+$/,'')+'-potong.mp4';
 $('#modal').close();
 runConversion({file,name:file.name,format:'mp4',clip:{in:start,duration:end-start,speed:1},
  ...(toTimeline?{onComplete:async(blob,token)=>{
   const asset=await automaticAsset(new File([blob],name,{type:'video/mp4'}),'video',token);
   assertJob(token);commit();assets.push(asset);
   addAsset(asset.id,{recordHistory:false});
   time=clipStart(clips.find(clip=>clip.id===selected));draw();
  }}:{})});
}
async function showMalikiWorkbench(view='motion'){
 if(view==='voice')return showVoxcpm();
 if(job||exporting||captureSession)return toast('Selesaikan proses yang berjalan terlebih dahulu.');
 pause();malikiView=view;
 if(view==='motion'){try{await loadMalikiTemplates()}catch(error){return toast(error.message)}}
 const titles={motion:'Motion',clip:'Klip',connection:'Mesin',voice:'Kloning suara'};
 const content={motion:malikiMotionForm,clip:malikiClipForm,connection:malikiConnectionForm};
 modal('<div id="malikiWorkbench"><h2>Motion & Klip</h2><div class="malikiTabs">'+
  Object.entries(titles).map(([id,title])=>'<button type="button" data-maliki-view="'+id+'" class="'+(view===id?'chosen':'')+'">'+title+'</button>').join('')+'</div>'+
  '<p id="malikiConnectionStatus" class="featureNote">'+(malikiConnected?'Mesin tersambung.':'Server mesin diperlukan untuk render motion dan klip. Hubungkan di tab Mesin.')+'</p>'+
  content[view]()+'<p id="malikiError" class="errorDetail" role="alert" hidden></p>'+malikiCredit()+
  '<div class="actions"><button id="closeModal">Tutup</button></div></div>');
 $$('[data-maliki-view]').forEach(button=>button.onclick=()=>showMalikiWorkbench(button.dataset.malikiView));
 $$('#malikiWorkbench [data-maliki-style]').forEach(button=>button.onclick=()=>{
  malikiStyle=button.dataset.malikiStyle;
  $$('#malikiWorkbench [data-maliki-style]').forEach(card=>card.classList.toggle('chosen',card===button));
 });
 for(const [id,key] of [['malikiTopic','topic'],['malikiNotes','notes'],['malikiJSON','json']]){
  const input=$('#'+id);if(input)input.oninput=()=>malikiDraft[key]=input.value;
 }
 function error(message){
  const field=$('#malikiError');
  if(field){field.textContent=message;field.hidden=!message}
  else toast(message);
 }
 const action=task=>async event=>{
  event?.preventDefault();
  try{await task()}catch(failure){error(failure.message)}
 };
 $('#malikiConnect')?.addEventListener('click',action(async()=>{
  malikiApplyForm();
  await connectMalikiEngine();showMalikiWorkbench('connection');
 }));
 $('#malikiConnectionForm')?.addEventListener('submit',action(saveMalikiConnection));
 $('#malikiProvider')?.addEventListener('change',event=>{
  const provider=event.target.value;
  const models={gemini:malikiSettings.GEMINI_MODEL||'gemini-3.8-flash',ollama:'gemma3:4b',
   openai:'','claude-code':malikiSettings.CLAUDE_CODE_MODEL||'sonnet',codex:malikiSettings.CODEX_MODEL||'',opencode:malikiSettings.OPENCODE_MODEL||''};
  $('#malikiModel').value=models[provider]||'';
  if(provider==='ollama')$('#malikiBaseURL').value='http://localhost:11434/v1';
  if(provider==='openai')$('#malikiBaseURL').value='https://api.openai.com/v1';
 });
 $('#malikiTestAI')?.addEventListener('click',action(async()=>{
  await saveMalikiConnection();
  const result=await malikiRequest('/api/uji-ai',{data:{penyedia:malikiSettings.AI},timeout:260000});
  if(result.ok===false)throw new Error(result.galat||result.pesan||'Koneksi AI belum berhasil.');
  $('#malikiConnectionStatus').textContent=result.pesan||'Koneksi AI berhasil diperiksa.';
 }));
 $$('[data-maliki-setup]').forEach(button=>button.onclick=action(()=>runMalikiJob('/api/siapkan',{komponen:button.dataset.malikiSetup})));
 $('#malikiCutTimeline')?.addEventListener('click',action(()=>malikiManualCut(true)));
 $('#malikiCutDownload')?.addEventListener('click',action(()=>malikiManualCut(false)));
 $('#malikiMotionForm')?.addEventListener('submit',action(startMalikiMotion));
 $('#malikiClipForm')?.addEventListener('submit',action(startMalikiClip));
}
async function saveMalikiConnection(){
 malikiApplyForm();
 await connectMalikiEngine();
 const provider=$('#malikiProvider').value,model=$('#malikiModel').value.trim(),key=$('#malikiAPIKey').value.trim();
 const settings={AI:provider==='ollama'?'openai':provider};
 if(provider==='gemini'){
  settings.GEMINI_MODEL=model||'gemini-3.8-flash';
  if(key)settings.GEMINI_API_KEY=key;
 }else if(['ollama','openai'].includes(provider)){
  settings.OPENAI_BASE_URL=$('#malikiBaseURL').value.trim();
  settings.OPENAI_MODEL=model;
  if(key)settings.OPENAI_API_KEY=key;
 }else if(provider==='codex')settings.CODEX_MODEL=model;
 else if(provider==='claude-code')settings.CLAUDE_CODE_MODEL=model||'sonnet';
 else if(provider==='opencode')settings.OPENCODE_MODEL=model;
 const result=await malikiRequest('/api/pengaturan',{data:settings});
 malikiSettings=result.pengaturan;
 $('#malikiConnectionStatus').textContent='Koneksi AI disimpan di server mesin.';
 $('#malikiAPIKey').value='';
}
function localMalikiScript(){
 const idea=buildLocalMotionIdea({topic:malikiDraft.topic,brief:malikiDraft.notes,language:'id',kind:'education'});
 const lines=idea.brief.split(/\n+|(?<=[.!?])\s+/u).map(line=>line.trim()).filter(Boolean).slice(0,12);
 return {judul:idea.topic,gaya:malikiStyle,adegan:lines.map((line,index)=>({
  judul:index===0?idea.topic:line.split(/\s+/).slice(0,5).join(' '),teks:line,ikon:['💡','📚','🎯','✨'][index%4]
 }))};
}
async function startMalikiMotion(){
 await connectMalikiEngine();
 let script=malikiDraft.json.trim();
 if(script){
  const parsed=JSON.parse(script);
  if(!Array.isArray(parsed.adegan)||!parsed.adegan.length)throw new Error('JSON membutuhkan daftar adegan.');
 }else if(malikiSettings.AI==='lokal')script=JSON.stringify(localMalikiScript());
 if(!script&&!malikiDraft.topic.trim())throw new Error('Isi topik atau naskah JSON.');
 await runMalikiJob('/api/motion',{topik:malikiDraft.topic,naskah:script,gaya:malikiStyle,
  gambar:$('#malikiDrawAI').checked,ai:malikiSettings.AI});
}
async function startMalikiClip(){
 await connectMalikiEngine();
 const file=$('#malikiClipFile').files[0];
 let source=$('#malikiClipURL').value.trim();
 if(file)source=(await malikiRequest('/api/unggah',{file,headers:{'X-Nama-File':encodeURIComponent(file.name)},timeout:300000})).jalur;
 if(!source)throw new Error('Pilih file video atau isi tautan YouTube.');
 const subtitle=$('#malikiClipSRT').files[0];
 const subtitlePath=subtitle?(await malikiRequest('/api/unggah',{file:subtitle,headers:{'X-Nama-File':encodeURIComponent(subtitle.name)}})).jalur:'';
 await runMalikiJob('/api/klip',{sumber:source,jumlah:Number($('#malikiClipCount').value),durasi:Number($('#malikiClipDuration').value),
  arahan:$('#malikiClipDirection').value,model:$('#malikiWhisper').value,ai:malikiSettings.AI,subtitle_file:subtitlePath});
}
async function runMalikiJob(path,data){
 await connectMalikiEngine();
 const started=await malikiRequest(path,{data});
 const token=beginJob('Memproses dengan mesin');
 const controller=new AbortController();
 token.cancelHooks.push(()=>{controller.abort();malikiRequest('/api/batal',{data:{jobid:started.jobid}}).catch(()=>{})});
 let result;
 try{
  while(true){
   assertJob(token);
   const status=await malikiRequest('/api/status',{signal:controller.signal});
   setJobStatus((status.log||[]).at(-1)||'Menyiapkan mesin…');
   if(status.status==='selesai'){result=status.hasil;break}
   if(['gagal','batal'].includes(status.status))throw new Error((status.log||[]).slice(-4).join('\n')||'Proses mesin dihentikan.');
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  endJob(token);
  if(result?.nama)showMalikiResult(result);
  else{toast('Komponen mesin siap.');showMalikiWorkbench('connection')}
 }catch(error){
  endJob(token);
  if(!token.cancelled)modal('<h2>Proses belum selesai</h2><p>'+esc(error.message)+'</p>'+malikiCredit()+
   '<div class="actions"><button id="closeModal">Tutup</button><button id="malikiBack">Kembali ke pengaturan</button></div>');
  $('#malikiBack')?.addEventListener('click',()=>showMalikiWorkbench('connection'));
 }
 return started;
}
function showMalikiResult(result){
 const rendered=(result.klip||[]).filter(clip=>clip.file);
 const files=result.video?[{path:result.video,name:(result.naskah?.judul||'Motion')+'.mp4',type:'video'}]:
  result.audio?[{path:result.audio,name:'Narasi FlexCut.wav',type:'audio'}]:
   rendered.map(clip=>({path:'/berkas/klip/'+result.nama+'/'+clip.file,name:(clip.judul||'Klip '+clip.no)+'.mp4',type:'video'}));
 modal('<div id="malikiWorkbench"><h2>Hasil '+(result.audio?'narasi':result.jenis==='motion'?'motion':'klip')+'</h2>'+
  (files.length?files.map((file,index)=>'<div class="malikiResult">'+
   (file.type==='video'?'<video controls preload="metadata" data-maliki-path="'+esc(file.path)+'"></video>':'<audio controls preload="none" data-maliki-path="'+esc(file.path)+'"></audio>')+
   '<p>'+esc(file.name)+'</p><button class="primary" data-maliki-import="'+index+'">Tambahkan ke timeline</button></div>').join(''):
   '<div class="malikiClipResults">'+(result.klip||[]).map(clip=>'<label class="checkLabel"><input type="checkbox" data-maliki-clip="'+clip.no+'" checked>'+
    esc(clip.judul||'Klip '+clip.no)+' · '+fmt(clip.mulai)+' – '+fmt(clip.selesai)+'</label>').join('')+'</div>'+
    '<div class="malikiColumns"><label class="featureLabel">Rasio<select id="malikiClipRatio"><option>9:16</option><option>16:9</option><option>1:1</option></select></label>'+
    '<label class="featureLabel">Fokus<select id="malikiClipFocus"><option value="auto">Ikuti wajah</option><option value="tengah">Tengah</option><option value="kiri">Kiri</option><option value="kanan">Kanan</option></select></label></div><button class="primary" id="malikiRenderClips">Render klip terpilih</button>')+
  malikiCredit()+'<div class="actions">'+(result.naskah?'<button id="malikiEditStory">Edit naskah & render ulang</button>':'')+
  '<button id="malikiHistory">Riwayat hasil</button><button id="closeModal">Tutup</button></div></div>');
 $$('#malikiWorkbench [data-maliki-path]').forEach(async player=>{
  try{
   const blob=await malikiMediaBlob(player.dataset.malikiPath);
   if(player.isConnected)player.src=URL.createObjectURL(new Blob([blob],{type:player.tagName==='AUDIO'?'audio/wav':'video/mp4'}));
  }catch(error){player.insertAdjacentHTML('afterend','<p class="errorDetail">'+esc(error.message)+'</p>')}
 });
 $$('[data-maliki-import]').forEach(button=>button.onclick=()=>importMalikiResult(files[Number(button.dataset.malikiImport)]));
 $('#malikiRenderClips')?.addEventListener('click',async()=>{
  const selected=$$('[data-maliki-clip]:checked').map(input=>Number(input.dataset.malikiClip));
  if(!selected.length)return toast('Pilih minimal satu klip.');
  try{await runMalikiJob('/api/klip-render',{nama:result.nama,pilih:selected,gaya:{rasio:$('#malikiClipRatio').value,
   fokus:$('#malikiClipFocus').value,subtitle:true,banner:true}})}catch(error){toast(error.message)}
 });
 $('#malikiHistory').onclick=showMalikiHistory;
 $('#malikiEditStory')?.addEventListener('click',()=>{
  malikiDraft.json=JSON.stringify(result.naskah,null,2);
  malikiDraft.topic=result.naskah.judul||'';
  malikiStyle=result.naskah.gaya||malikiStyle;
  showMalikiWorkbench('motion');
 });
}
async function importMalikiResult(file){
 for(const player of $$('#malikiWorkbench video,#malikiWorkbench audio')){
  player.pause();if(player.src.startsWith('blob:'))URL.revokeObjectURL(player.src);player.removeAttribute('src');player.load();
 }
 const token=beginJob('Memasukkan hasil ke FlexCut');
 try{
  if(!file.path.startsWith('/berkas/'))throw new Error('Alamat hasil tidak dikenali.');
  const blob=await malikiMediaBlob(file.path),mediaFile=new File([blob],file.name,{type:file.type==='audio'?'audio/wav':'video/mp4'});
  const asset=await automaticAsset(mediaFile,file.type,token);
  assertJob(token);commit();assets.push(asset);
  if(file.type==='video'&&!clips.length){$('#ratio').value='9:16';setRatio()}
  addAsset(asset.id,{recordHistory:false});
  if(file.type==='video'){time=clipStart(clips.find(clip=>clip.id===selected));draw()}
  endJob(token);toast('Hasil ditambahkan ke timeline');
 }catch(error){endJob(token);toast(error.message)}
}
async function showMalikiHistory(){
 try{
  const projects=await malikiRequest('/api/proyek');
  modal('<div id="malikiWorkbench"><h2>Riwayat mesin</h2>'+projects.map((project,index)=>'<button class="secondary full" data-maliki-project="'+index+'">'+esc(project.judul)+'</button>').join('')+
   malikiCredit()+'<div class="actions"><button id="closeModal">Tutup</button></div></div>');
  $$('[data-maliki-project]').forEach(button=>button.onclick=async()=>{
   const project=projects[Number(button.dataset.malikiProject)];
   try{showMalikiResult(await malikiRequest('/api/proyek/'+project.jenis+'/'+encodeURIComponent(project.nama)))}catch(error){toast(error.message)}
  });
 }catch(error){toast(error.message)}
}

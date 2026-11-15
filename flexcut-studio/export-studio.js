/* Export presets and size-limited, quality-aware encoding. */
const mp4Mime=['video/mp4;codecs=avc1.640033,mp4a.40.2','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4'].find(m=>window.MediaRecorder?.isTypeSupported(m));
const webmMime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>window.MediaRecorder?.isTypeSupported(m));
let exportPreset='standard';
function exportDimensions(shortEdge,ratio){const width=ratio>=1?shortEdge*ratio:shortEdge,height=ratio>=1?shortEdge:shortEdge/ratio;return {width:Math.max(2,Math.round(width/2)*2),height:Math.max(2,Math.round(height/2)*2)}}
function estimatedVideoBytes(seconds,videoBitrate,audioBitrate){return Math.ceil(seconds*(videoBitrate+audioBitrate)/8*1.05+16000)}
function compressionTargetBytes(limitBytes){
 return Math.floor(limitBytes*(limitBytes>=100000000?.96:.95));
}

function compressionBudget(limitBytes,duration){
 const available=compressionTargetBytes(limitBytes)*.99*8/Math.max(.1,duration);
 const audioBitrate=Math.min(192000,Math.max(16000,Math.floor(available*.12)));
 return {videoBitrate:Math.min(80000000,Math.max(12000,Math.floor(available-audioBitrate))),audioBitrate};
}

async function compressToBudget(config,token){
 const target=compressionTargetBytes(config.limitBytes);
 let best=null, lowerBitrate=0, upperBitrate=Infinity, previous=null;
 for(let pass=1;pass<=4;pass++){
  assertJob(token);
  const candidate=await recordExportPass(config,token,pass);
  assertJob(token);
  const withinLimit=candidate.size>0&&candidate.size<config.limitBytes;
  if(withinLimit){
   if(!best||candidate.size>best.size)best=candidate;
   if(candidate.size>=target*.99)return best;
   lowerBitrate=config.videoBitrate;
   if(previous&&config.videoBitrate>previous.bitrate&&candidate.size<=previous.size*1.04)break;
  }else if(candidate.size){
   upperBitrate=config.videoBitrate;
  }else{
   break;
  }
  const ratio=target/candidate.size;
  const nextBitrate=Number.isFinite(upperBitrate)&&lowerBitrate
   ?(lowerBitrate+upperBitrate)/2
   :config.videoBitrate*Math.max(.15,Math.min(2.5,ratio));
  const boundedBitrate=Math.round(Math.min(80000000,Math.max(12000,nextBitrate)));
  if(Math.abs(boundedBitrate-config.videoBitrate)<config.videoBitrate*.015){
   if(best)break;
   if(config.audioBitrate>16000){
    config.audioBitrate=Math.max(16000,Math.round(config.audioBitrate*.6));
   }else if(config.adaptive&&config.edge>240){
    config.edge=Math.max(240,Math.floor(config.edge*.75/2)*2);
    lowerBitrate=0;
    upperBitrate=Infinity;
   }else break;
  }
  previous={bitrate:config.videoBitrate,size:candidate.size};
  config.videoBitrate=boundedBitrate;
  if(!best&&candidate.size>config.limitBytes&&ratio<.5){
   config.audioBitrate=Math.max(16000,Math.round(config.audioBitrate*.8));
   if(config.adaptive&&config.videoBitrate<qualityBitrate(config.edge,config.fps)*.2&&config.edge>240){
    config.edge=Math.max(240,Math.floor(config.edge*.75/2)*2);
    lowerBitrate=0;
    upperBitrate=Infinity;
   }
  }
 }
 if(best)return best;
 throw new Error('Batas ukuran belum tercapai. Coba resolusi lebih rendah atau batas ukuran lebih besar.');
}
function qualityBitrate(edge,fps){return Math.round((edge/720)**2*4200000*(fps>30?1.6:1))}
function mb(bytes){return (bytes/1000000).toFixed(bytes<1000000?2:1)+' MB'}
function currentExportFormat(){return mp4Mime?'mp4':'webm'}
const videoExportPresets={
 standard:{edge:720,fps:30,videoBitrate:4200000,icon:'ϟ'},
 high:{label:'Upscale 1K · Full HD',edge:1080,fps:30,videoBitrate:12000000,icon:'↗',upscale:true},
 qhd:{label:'Upscale 2K · QHD',edge:1440,fps:30,videoBitrate:qualityBitrate(1440,30),icon:'↗',upscale:true},
 smooth:{label:'1080p 60 fps',edge:1080,fps:60,videoBitrate:16000000,icon:'▣'}
};
function presetConfig(id){
 const format=currentExportFormat(),preset=videoExportPresets[id];
 return {id,format,audioBitrate:128000,label:format.toUpperCase()+' Standar',...preset};
}
const exportButton=$('#export'),exportSplit=document.createElement('div');exportSplit.className='exportSplit';exportButton.before(exportSplit);exportSplit.append(exportButton);exportButton.textContent='Ekspor';exportSplit.insertAdjacentHTML('beforeend','<button id="exportMenuToggle" class="primary" aria-label="Pilihan ekspor" aria-haspopup="menu" aria-expanded="false"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div id="exportDropdown" role="menu" hidden></div>');
function renderExportMenu(){
 const ratio=canvas.width/canvas.height;
 const presetOptions=Object.keys(videoExportPresets).map(id=>{
  const config=presetConfig(id),size=exportDimensions(config.edge,ratio);
  const detail=id==='standard'?(mp4Mime?'H.264':'VP9')+' · Web & sosial':
   config.upscale?`${config.fps} fps · ${config.format.toUpperCase()}`:'60 fps · Gerakan lebih halus';
  return `<button class="exportOption ${id===exportPreset?'active':''}" role="menuitem" data-export-preset="${id}">
   <span class="exportIcon" aria-hidden="true">${config.icon}</span><span><strong>${config.label}${id==='standard'?' <em>Best match</em>':''}</strong>
   <small>${size.width} × ${size.height} · ${detail}</small>${id==='standard'?'<i>'+Math.ceil(total())+' detik video · 30 fps</i>':''}</span>
  </button>`;
 }).join('');
 const current=presetConfig(exportPreset),size=exportDimensions(current.edge,ratio);
 $('#exportDropdown').innerHTML=presetOptions+`
  <button class="exportOption" role="menuitem" id="exportAudioMenu"><span class="exportIcon">♫</span><span><strong>Audio Only (WAV)</strong><small>Audio tanpa kompresi · PCM 16-bit</small></span></button>
  <div class="exportMenuDivider"></div>
  <button class="exportOption" role="menuitem" id="exportCustomMenu"><span class="exportIcon">⚙</span><span><strong>Custom export…</strong><small>Resolusi, frame rate, format & bitrate</small></span></button>
  <button class="exportOption" role="menuitem" id="exportCompressMenu"><span class="exportIcon">▱</span><span><strong>Compress video…</strong><small>Di bawah 100 MB, 10 MB, atau ukuran sendiri</small></span></button>
  <div class="exportMenuFooter">${size.width} × ${size.height} · ${current.fps} fps · ${current.format.toUpperCase()}</div>`;
 $$('[data-export-preset]').forEach(button=>button.onclick=()=>{
  exportPreset=button.dataset.exportPreset;
  closeExportMenu();
  showVideoExport(presetConfig(exportPreset));
 });
 $('#exportAudioMenu').onclick=()=>{closeExportMenu();showAudioExport()};
 $('#exportCustomMenu').onclick=()=>{closeExportMenu();showCustomExport()};
 $('#exportCompressMenu').onclick=()=>{closeExportMenu();showCompression()};
}
function closeExportMenu(){$('#exportDropdown').hidden=true;$('#exportMenuToggle').setAttribute('aria-expanded','false')}
$('#exportMenuToggle').onclick=e=>{e.stopPropagation();const open=$('#exportDropdown').hidden;if(open)renderExportMenu();$('#exportDropdown').hidden=!open;$('#exportMenuToggle').setAttribute('aria-expanded',String(open))};
document.addEventListener('click',e=>{if(!e.target.closest('.exportSplit'))closeExportMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExportMenu()});
exportButton.onclick=()=>{closeExportMenu();showVideoExport(presetConfig(exportPreset))};
function validateExport(audioOnly=false){if(exporting||job)return false;if(!clips.length){toast('Tambahkan klip ke timeline terlebih dahulu');return false}if(!audioOnly&&!window.MediaRecorder){toast('Browser ini belum mendukung ekspor video');return false}if((trackAudible('audio')&&audios.some(a=>a.volume>0&&!a.src))||(!audioOnly&&trackVisible('video')&&clips.some(c=>!assets.find(a=>a.id===c.asset)?.src))||(audioOnly&&audioExportInputs().some(a=>!a.src))){toast('Impor ulang media yang hilang sebelum ekspor');return false}return true}
function formatChoices(){return `<option value="mp4" ${!mp4Mime?'disabled':''}>MP4 · H.264${!mp4Mime?' (tidak didukung browser ini)':''}</option><option value="webm" ${!webmMime?'disabled':''}>WebM · ${webmMime?.includes('vp9')?'VP9':'VP8'}</option>`}
function showVideoExport(initial){
 if(!validateExport())return;
 pause();
 modal(`<h2>Ekspor video</h2>
  <label class="featureLabel">Preset video<select id="videoExportPreset">
   ${Object.keys(videoExportPresets).map(id=>`<option value="${id}">${presetConfig(id).label}</option>`).join('')}
  </select></label>
  <div class="exportSummary">
   <label>Resolusi<strong id="videoExportDimensions"></strong></label><label>Frame rate<strong id="videoExportFps"></strong></label>
   <label>Durasi<strong>${fmt(total())}</strong></label><label>Perkiraan ukuran<strong id="videoExportSize"></strong></label>
  </div>
  <p>Transisi, subtitle, dan campuran audio ikut diekspor. Waktu proses bergantung pada durasi dan perangkat. Tetap buka tab ini.</p>
  ${!mp4Mime?'<p class="exportNotice">MP4 tidak tersedia pada browser ini. Gunakan WebM, atau buka di browser yang mendukung perekaman MP4/H.264.</p>':''}
  <div class="actions"><button id="closeModal">Batal</button><button id="openCustomFromPreset">Atur sendiri</button><button class="primary" id="confirmStudioExport"></button></div>`);
 const preset=$('#videoExportPreset');
 preset.value=initial.id;
 let config=initial;
 function update(){
  config=presetConfig(preset.value);
  const size=exportDimensions(config.edge,canvas.width/canvas.height);
  $('#videoExportDimensions').textContent=`${size.width} × ${size.height}`;
  $('#videoExportFps').textContent=config.fps+' fps';
  $('#videoExportSize').textContent='~'+mb(estimatedVideoBytes(total(),config.videoBitrate,config.audioBitrate));
  $('#confirmStudioExport').textContent='Ekspor '+config.format.toUpperCase()+' ↗';
 }
 preset.onchange=()=>{exportPreset=preset.value;update()};
 update();
 $('#openCustomFromPreset').onclick=()=>{$('#modal').close();showCustomExport(config)};
 $('#confirmStudioExport').onclick=()=>runVideoExport(config);
}
function showCustomExport(initial=presetConfig('high')){if(!validateExport())return;pause();modal(`<h2>Custom export.</h2><p>Atur hasil akhir sesuai kebutuhan Anda.</p><div class="exportSettingsGrid"><label class="featureLabel">Resolusi<select id="customResolution">${[480,720,1080,1440,2160].map(n=>`<option value="${n}" ${initial.edge===n?'selected':''}>${n===1080?'1K Full HD · 1080p':n===1440?'2K QHD · 1440p':n+'p'}</option>`).join('')}</select></label><label class="featureLabel">Frame rate<select id="customFps">${[24,25,30,60].map(n=>`<option value="${n}" ${initial.fps===n?'selected':''}>${n} fps</option>`).join('')}</select></label><label class="featureLabel">Format<select id="customFormat">${formatChoices()}</select></label><label class="featureLabel">Bitrate video (Mbps)<input id="customBitrate" type="number" min="0.1" max="80" step="0.1" value="${initial.videoBitrate/1000000}"></label></div><div id="customExportEstimate" class="exportEstimate"></div><p class="featureNote">Resolusi lebih tinggi dapat memperbesar sumber. 60 fps menjaga kelancaran timeline; sumber dengan fps lebih rendah tetap mengikuti detail aslinya.</p><div class="actions"><button id="closeModal">Batal</button><button class="primary" id="confirmCustomExport">Ekspor video ↗</button></div>`);$('#customFormat').value=initial.format;const update=()=>{const size=exportDimensions(Number($('#customResolution').value),canvas.width/canvas.height);$('#customExportEstimate').textContent=`${size.width}×${size.height} · ${$('#customFps').value} fps · ~${mb(estimatedVideoBytes(total(),Number($('#customBitrate').value)*1000000,128000))}`};$$('#customResolution,#customFps,#customBitrate').forEach(el=>el.oninput=update);update();$('#confirmCustomExport').onclick=()=>{const bitrate=Number($('#customBitrate').value);if(!Number.isFinite(bitrate)||bitrate<.1||bitrate>80)return toast('Masukkan bitrate 0,1–80 Mbps');runVideoExport({edge:Number($('#customResolution').value),fps:Number($('#customFps').value),format:$('#customFormat').value,videoBitrate:Math.round(bitrate*1000000),audioBitrate:128000,label:'Custom export'})}}
function showCompression(){if(!validateExport())return;pause();modal(`<h2>Kecil ukurannya. Tetap berkesan.</h2><p>Pilih batas ukuran. FlexCut menyesuaikan bitrate untuk mendekati target sambil menjaga file di bawah batas.</p><div class="compressionTargets"><button class="chosen" data-target-mb="100"><strong>&lt; 100 MB</strong><span>Berbagi video panjang</span></button><button data-target-mb="10"><strong>&lt; 10 MB</strong><span>Kirim lebih ringan</span></button><button data-target-mb="custom"><strong>Custom</strong><span>Atur ukuran sendiri</span></button></div><label class="featureLabel" id="customTargetLabel" hidden>Batas ukuran (MB)<input id="customTargetMb" type="number" min="0.1" max="2000" step="0.1" value="5"></label><div class="exportSettingsGrid"><label class="featureLabel">Resolusi<select id="compressionResolution"><option value="auto">Otomatis · prioritas kualitas</option><option value="original">Pertahankan resolusi kanvas</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label><label class="featureLabel">Format<select id="compressionFormat">${formatChoices()}</select></label></div><div id="compressionEstimate" class="exportEstimate"></div><p class="featureNote">FlexCut mengukur hasil dan dapat mencoba hingga empat kali. Video singkat atau minim gerakan bisa menghasilkan file lebih kecil. Batas yang ketat dapat mengurangi kualitas.</p><div class="actions"><button id="closeModal">Batal</button><button class="primary" id="startCompression">Kompres & unduh ↗</button></div>`);let target='100';$('#compressionFormat').value=currentExportFormat();const update=()=>{const limit=Number(target==='custom'?$('#customTargetMb').value:target),goal=compressionTargetBytes(limit*1000000)/1000000;$('#compressionEstimate').textContent=Number.isFinite(goal)&&limit>=.1?`Target sekitar ${Number(goal.toFixed(3))} MB · batas < ${limit} MB · ${fmt(total())}`:'Masukkan batas ukuran 0,1–2000 MB'};$$('[data-target-mb]').forEach(b=>b.onclick=()=>{target=b.dataset.targetMb;$$('[data-target-mb]').forEach(x=>x.classList.toggle('chosen',x===b));$('#customTargetLabel').hidden=target!=='custom';update()});$('#customTargetMb').oninput=update;update();$('#startCompression').onclick=()=>{const limit=Number(target==='custom'?$('#customTargetMb').value:target);if(!Number.isFinite(limit)||limit<.1||limit>2000)return toast('Masukkan batas ukuran 0,1–2000 MB');const budget=compressionBudget(limit*1000000,total()),resolution=$('#compressionResolution').value,originalEdge=Math.min(canvas.width,canvas.height);let edge=resolution==='original'?originalEdge:resolution==='auto'?Math.min(1080,originalEdge):Number(resolution);if(resolution==='auto'){while(edge>240&&budget.videoBitrate<qualityBitrate(edge,30)*.28){edge=edge>720?720:edge>480?480:edge>360?360:240}}runVideoExport({edge,fps:30,format:$('#compressionFormat').value,videoBitrate:budget.videoBitrate,audioBitrate:budget.audioBitrate,limitBytes:Math.floor(limit*1000000),adaptive:resolution==='auto',label:'Kompres video'})}}
async function prepareExportMedia(destination){
 const visibleClips=trackVisible('video')?clips:[];
 for(const c of visibleClips)clipVideo(c);
 if(trackAudible('audio'))for(const a of audios){if(a.src&&!media.has(a.id))media.set(a.id,new Audio(a.src))}
 for(const el of media.values()){el.pause();if(!el._audioSource){el._audioSource=audioContext.createMediaElementSource(el);el._audioContext=audioContext}el._audioSource.disconnect();el._audioSource.connect(destination);el.muted=false}
 const visibleAssets=new Set(visibleClips.map(c=>c.asset));
 for(const a of assets.filter(a=>visibleAssets.has(a.id)&&a.type==='image'&&a.src)){const img=getImage(a);if(!img.complete)await img.decode()}
 const current=trackVisible('video')?activeClip():null,v=current?clipVideo(current.c):null;
 if(v)await waitForExportVideo(v);
}
function waitForExportVideo(video){
 return new Promise((resolve,reject)=>{
  if(video.readyState>=2&&!video.seeking)return resolve();
  const events=['loadeddata','canplay','seeked'];
  const cleanup=()=>{clearTimeout(timer);events.forEach(name=>video.removeEventListener(name,ready));video.removeEventListener('error',failed)};
  const ready=()=>{if(video.readyState>=2&&!video.seeking){cleanup();resolve()}};
  const failed=()=>{cleanup();reject(new Error('Video tidak dapat dibaca'))};
  const timer=setTimeout(()=>{cleanup();reject(new Error('Video belum siap'))},20000);
  events.forEach(name=>video.addEventListener(name,ready));video.addEventListener('error',failed);ready();
 });
}

async function recordExportPass(config,token,attempt){
  const mime=config.format==='mp4'?mp4Mime:webmMime;if(!mime)throw new Error('Format ini tidak didukung oleh browser');
  const dims=exportDimensions(config.edge,canvas.width/canvas.height);canvas.width=dims.width;canvas.height=dims.height;if(config.edge>=1080)ctx.imageSmoothingQuality='high';layoutPreview();time=0;playing=false;draw();
  const destination=audioContext.createMediaStreamDestination(),clockSource=audioContext.createOscillator(),clockGain=audioContext.createGain();clockGain.gain.value=0;clockSource.connect(clockGain);clockGain.connect(destination);clockSource.start();await prepareExportMedia(destination);await document.fonts.ready;assertJob(token);draw();await new Promise(r=>setTimeout(r,120));
  const stream=canvas.captureStream(config.fps);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:config.videoBitrate,audioBitsPerSecond:config.audioBitrate});
  const chunks=[];let recorderError;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>{recorderError=e.error||new Error('Encoder gagal');reject(recorderError)}});const cancel=()=>{if(recorder.state!=='inactive')recorder.stop()};token.cancelHooks.push(cancel);
  try{recorder.start(250);playing=true;const begin=performance.now();while(time<total()&&!token.cancelled&&!recorderError){time=Math.min(total(),(performance.now()-begin)/1000);syncAudio();draw();const progress=time/total();$('#studioExportProgress').value=progress;$('#jobStatus').textContent=`${config.limitBytes?'Putaran '+attempt+' · ':''}${Math.round(progress*100)}% · ${fmt(time)} / ${fmt(total())}`;await new Promise(r=>setTimeout(r,Math.max(1,1000/config.fps-2)))}if(recorder.state!=='inactive')recorder.stop();await stopped;assertJob(token);return new Blob(chunks,{type:recorder.mimeType||mime})}finally{playing=false;for(const el of media.values())el.pause();stream.getTracks().forEach(t=>t.stop());clockSource.stop();clockSource.disconnect();clockGain.disconnect();destination.disconnect();token.cancelHooks=token.cancelHooks.filter(fn=>fn!==cancel)}
}
async function runVideoExport(config){
  if(!validateExport())return;$('#modal').close();const original={width:canvas.width,height:canvas.height,time},token=beginJob(config.limitBytes?'Mengompres video…':'Mengekspor video…');exporting=true;$('.jobSpinner').replaceWith(Object.assign(document.createElement('progress'),{id:'studioExportProgress',max:1,value:0}));
  try{audioContext=audioContext||new AudioContext();await audioContext.resume();let result=config.limitBytes?await compressToBudget({...config},token):await recordExportPass(config,token,1);if(!result.size)throw new Error('Hasil ekspor kosong. Coba lagi.');assertJob(token);if(config.fps===60&&config.format==='mp4'){result=await normalizeMP4FrameRate(result,config,token)}assertJob(token);download(result,$('#projectName').value+(config.limitBytes?'-compressed':'')+'.'+config.format);endJob(token);toast('Video '+config.format.toUpperCase()+' diekspor · '+mb(result.size))}catch(e){endJob(token);if(!token.cancelled){console.error(e);modal(`<h2>Ekspor belum selesai.</h2><p>${esc(e.message)}</p><p>Coba resolusi lebih rendah atau format lain pada Custom export.</p><div class="actions"><button class="primary" id="closeModal">Mengerti</button></div>`)}}finally{exporting=false;playing=false;for(const el of media.values()){el.pause();el.muted=false;if(el._audioSource){el._audioSource.disconnect();el._audioSource.connect(el._audioContext.destination)}}canvas.width=original.width;canvas.height=original.height;time=original.time;layoutPreview();draw()}
}
function audioExportInputs(){return [...clips.filter(c=>trackAudible('video')&&c.volume>0&&assets.find(a=>a.id===c.asset)?.type==='video').map(c=>({name:c.name,src:assets.find(a=>a.id===c.asset)?.src,start:clipStart(c),offset:c.in,duration:c.duration,speed:c.speed,volume:c.volume})),...audios.filter(a=>trackAudible('audio')&&a.volume>0).map(a=>({...a,offset:a.in||0,speed:a.speed||1}))]}
function showAudioExport(){if(!validateExport(true))return;const inputs=audioExportInputs();if(!inputs.length)return toast('Belum ada audio pada proyek ini');pause();modal(`<h2>Ekspor audio.</h2><p>Campuran suara video dan semua track audio, mengikuti waktu, pangkasan, kecepatan, dan volume timeline.</p><div class="exportSummary"><label>Format<strong>WAV · PCM 16-bit</strong></label><label>Sample rate<strong>48 kHz · Mono</strong></label><label>Durasi<strong>${fmt(total())}</strong></label><label>Ukuran<strong>~${mb(total()*48000*2+44)}</strong></label></div><div class="actions"><button id="closeModal">Batal</button><button class="primary" id="confirmAudioExport">Ekspor WAV ↗</button></div>`);$('#confirmAudioExport').onclick=()=>exportAudioMix(inputs)}
async function exportAudioMix(inputs){$('#modal').close();const token=beginJob('Merangkai audio…');try{const rate=48000,length=Math.ceil(total()*rate);if(length>rate*1800)throw new Error('Gunakan bagian maksimal 30 menit untuk ekspor WAV');const offline=new OfflineAudioContext(1,Math.max(1,length),rate);for(let i=0;i<inputs.length;i++){assertJob(token);const a=inputs[i];if(!a.src)throw new Error('Impor ulang audio: '+a.name);if(a.start>=total())continue;setJobStatus(`Membaca audio ${i+1}/${inputs.length}: ${a.name}`);const buffer=await decodeSource(a.src,token),node=offline.createBufferSource(),gain=offline.createGain();node.buffer=buffer;node.playbackRate.value=a.speed;gain.gain.value=a.volume/100;node.connect(gain);gain.connect(offline.destination);node.start(Math.max(0,a.start),a.offset);node.stop(Math.min(total(),a.start+a.duration))}setJobStatus('Mencampur track dan menyiapkan WAV…');const mixed=await offline.startRendering();assertJob(token);download(wavBlob(mixed),$('#projectName').value+'-audio.wav');endJob(token);toast('Campuran audio WAV berhasil diekspor')}catch(e){endJob(token);if(!token.cancelled)toast('Ekspor audio gagal: '+e.message)}}
// Reflect the actual available format rather than relabeling a WebM as MP4.
exportButton.title=mp4Mime?'Ekspor MP4 H.264':'Ekspor WebM (MP4 tidak didukung browser ini)';

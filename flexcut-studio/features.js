/* Timeline transitions, local audio extraction, and editable speech captions. */
const captionStyles={
 clean:{name:'Clean',color:'#ffffff',size:45,weight:600,font:'Arial',stroke:'#101010',line:5,bg:null},
 bold:{name:'Bold kuning',color:'#ffe45c',size:54,weight:800,font:'Arial',stroke:'#151515',line:7,bg:null},
 box:{name:'Kotak gelap',color:'#ffffff',size:43,weight:600,font:'Arial',stroke:null,line:0,bg:'#101315dc'},
 mint:{name:'Mint highlight',color:'#10291e',size:46,weight:700,font:'Arial',stroke:null,line:0,bg:'#a8f3cd'},
 cinema:{name:'Cinema',color:'#ffffff',size:43,weight:400,font:'Georgia',stroke:'#111111',line:2,bg:null}
};
let captionTemplate='clean',captionView='auto',captionLanguage='indonesian',captionModel='accurate',job=null,asrWorker=null;
const decodedAudio=new Map();
try{
 const settings=JSON.parse(localStorage.getItem('flexcut-caption-settings')||'{}');
 if(['indonesian','english','auto','javanese','malay'].includes(settings.language))captionLanguage=settings.language;
 if(settings.version===2&&settings.model==='fast')captionModel='fast';
}catch(error){}
const dbPromise=new Promise(resolve=>{const request=indexedDB.open('ruangcut-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('audio');request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null)});
async function stashAudio(id,blob){const db=await dbPromise;if(db)await new Promise(resolve=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(blob,id);tx.oncomplete=resolve;tx.onerror=resolve})}
async function cachedAudio(id){const db=await dbPromise;return db?new Promise(resolve=>{const r=db.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null)}):null}
function clipVideo(c){
 const asset=assets.find(a=>a.id===c.asset);
 if(asset?.type!=='video'||!asset.src)return null;
 const key='video:'+c.id,previous=media.get(key);
 if(previous&&previous.src===new URL(asset.src,location.href).href)return previous;
 if(previous){
  previous.pause();
  previous.removeAttribute('src');
  previous.load();
 }
 const video=document.createElement('video');
 video.src=asset.src;
 video.preload='auto';
 video.playsInline=true;
 video.onloadeddata=()=>draw();
 video.onseeked=()=>{if(!playing)draw()};
 media.set(key,video);
 return video;
}
function transitionDuration(c){return Math.min(c.transitionDuration||.6,c.duration/2)}
function sourceForClip(c,local,muted=false){const a=assets.find(a=>a.id===c.asset);if(!a?.src)return null;if(a.type!=='video')return getImage(a);const v=clipVideo(c);const duration=Number.isFinite(v.duration)?v.duration:a.duration;if(duration>0){const target=Math.min(duration-.01,Math.max(0,c.in+local*c.speed));if(Math.abs(v.currentTime-target)>(playing?.22:.035))v.currentTime=target;v.playbackRate=c.speed;v.volume=muted||!trackAudible(itemTrack(c,'video'))?0:c.volume/100;v.muted=false;const finished=c.autoScene&&c.in+local*c.speed>=duration;if(playing&&!muted&&!finished){if(v.paused)v.play().catch(()=>{})}else v.pause()}return v}
function mediaFitScale(sw,sh,w,h,rotation,mode){const radians=rotation*Math.PI/180,bw=Math.abs(Math.cos(radians))*sw+Math.abs(Math.sin(radians))*sh,bh=Math.abs(Math.sin(radians))*sw+Math.abs(Math.cos(radians))*sh;return mode==='cover'?Math.max(w/bw,h/bh):Math.min(w/bw,h/bh)}
function paintClip(c,local,{muted=false,target=ctx}={}){
 if(typeof keyframedItem==='function')c=keyframedItem(c,local);
 const source=sourceForClip(c,local,muted),w=canvas.width,h=canvas.height;
 if(!source||(source.readyState!==undefined&&source.readyState<2))return;
 const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;
 if(!sw||!sh)return;
 const scale=mediaFitScale(sw,sh,w,h,c.rotation,c.fit||'contain')*c.scale/100;
 const frame=c.watermark&&typeof renderWatermarkFrame==='function'?renderWatermarkFrame(source,c.watermark,sw,sh,scale):source;
 if(c.autoScene&&typeof paintAutomaticScene==='function'){
  target.save();
  target.translate(w*((c.x??50)-50)/100,h*((c.y??50)-50)/100);
  const painted=paintAutomaticScene(target,c,local,frame,sw,sh);
  target.restore();
  if(painted)return;
 }
 target.save();
 target.globalAlpha=c.opacity/100;
 target.filter=[filterMap[c.filter]||'',`brightness(${c.brightness}%) contrast(${c.contrast}%) saturate(${c.saturation}%)`].filter(f=>f&&f!=='none').join(' ');
 target.translate(w*(c.x??50)/100,h*(c.y??50)/100);
 target.rotate(c.rotation*Math.PI/180);
 paintStudioEffect(target,frame,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale,c.studioEffect);
 target.restore();
}
function wrapCaption(text,maxWidth){const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line)}return lines}
function paintCaption(t){const style=captionStyles[t.template]||captionStyles.clean,w=canvas.width,h=canvas.height,unit=w/1280,size=t.size*unit;ctx.save();ctx.font=`${style.weight} ${size}px ${style.font}`;ctx.textAlign='center';ctx.textBaseline='middle';const lines=wrapCaption(t.text,w*.86),lineHeight=size*1.3,top=h*t.y/100-(lines.length-1)*lineHeight/2;ctx.lineJoin='round';lines.forEach((line,i)=>{const y=top+i*lineHeight;if(style.bg){ctx.fillStyle=style.bg;const width=ctx.measureText(line).width;ctx.beginPath();ctx.roundRect((w-width)/2-18*unit,y-lineHeight/2,width+36*unit,lineHeight,7*unit);ctx.fill()}if(style.stroke){ctx.strokeStyle=style.stroke;ctx.lineWidth=style.line*unit;ctx.strokeText(line,w/2,y)}ctx.fillStyle=t.color;ctx.fillText(line,w/2,y)});ctx.restore()}
draw=function(){
 const w=canvas.width,h=canvas.height;
 ctx.fillStyle='#101315';ctx.fillRect(0,0,w,h);
 const activeKeys=new Set();
 for(const {c,start} of activeVideoLayers()){
  const local=time-start,prev=precedingClip(c),duration=transitionDuration(c);
  activeKeys.add('video:'+c.id);
  if(prev&&c.transition&&c.transition!=='none'&&local<duration){
   activeKeys.add('video:'+prev.id);
   paintStudioClipTransition(prev,c,local,Math.min(1,Math.max(0,local/duration)));
  }else paintClip(c,local);
  if(!assets.find(a=>a.id===c.asset)?.src){
   ctx.fillStyle='#b3b9ba';ctx.font='22px Arial';ctx.textAlign='center';
   ctx.fillText('Impor ulang media: '+c.name,w/2,h/2,w*.85);
  }
 }
 for(const [id,el]of media){if((id.startsWith('video:')&&!activeKeys.has(id))||assets.some(a=>a.id===id))el.pause()}
 for(const originalText of texts){const t=typeof keyframedItem==='function'?keyframedItem(originalText,time-originalText.start):originalText;if(!trackVisible(itemTrack(t,'text'))||time<t.start||time>=t.start+t.duration)continue;if(t.kind==='subtitle'){paintCaption(t);continue}ctx.save();ctx.globalAlpha=(t.opacity??100)/100;ctx.translate(w*(t.x??50)/100,h*t.y/100);ctx.rotate((t.rotation||0)*Math.PI/180);ctx.fillStyle=t.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${t.weight||500} ${t.size*w/1280}px "${t.font||'Georgia'}",serif`;ctx.shadowColor='#0009';ctx.shadowBlur=8;t.text.split('\n').forEach((line,n)=>ctx.fillText(line,0,n*t.size*w/1280*1.2,w*.9));ctx.restore()}
 updateTransport();$('#playhead').style.left=time*zoom+'px';$('.stageTag').style.display=clips.length&&clips.every(c=>c.asset==='coast'&&trackVisible(itemTrack(c,'video')))?'':'none';
};
syncAudio=function(){for(const a of audios){if(!a.src)continue;let el=media.get(a.id);if(!el){el=new Audio(a.src);media.set(a.id,el)}const inside=time>=a.start&&time<a.start+a.duration;if(playing&&inside&&trackAudible(itemTrack(a,'audio'))){const target=(a.in||0)+(time-a.start)*(a.speed||1);if(Math.abs(el.currentTime-target)>.22)el.currentTime=target;el.volume=a.volume/100;el.playbackRate=a.speed||1;if(el.paused)el.play().catch(()=>{})}else el.pause()}};
// Extend the existing navigation and keep all editor state in its original history.
$('.navBottom').insertAdjacentHTML('beforebegin','<button data-tab="transitions"><b>⇄</b>Transisi</button><button data-tab="subtitles"><b>▤</b>Subtitle</button>');
$$('[data-tab="transitions"], [data-tab="subtitles"]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;updateNav();renderLibrary()});
const baseLibrary=renderLibrary;
renderLibrary=function(){if(!['transitions','subtitles'].includes(tab)){baseLibrary();if(tab==='audio'){$('#libraryContent').insertAdjacentHTML('beforeend','<div class="featureCard"><span class="featureIcon">'+editorIcon('music',23)+'</span><h3>Audio dari video</h3><p>Pisahkan suara klip ke track sendiri atau unduh sebagai WAV.</p><button class="primary full" id="extractFromAudio">Ekstrak audio video</button></div>');$('#extractFromAudio').onclick=showExtract}return}
 $('#libraryTitle').textContent=tab==='transitions'?'Transisi antar-klip':'Subtitle studio';$('#assetCount').textContent=tab==='subtitles'?texts.filter(t=>t.kind==='subtitle').length+' baris':'';
 if(tab==='transitions')return;
 $('#libraryContent').innerHTML=`<div class="captionTabs"><button data-caption-view="auto" class="${captionView==='auto'?'active':''}">Auto</button><button data-caption-view="templates" class="${captionView==='templates'?'active':''}">Template</button><button data-caption-view="edit" class="${captionView==='edit'?'active':''}">Edit teks</button></div><div id="captionPanel"></div>`;$$('[data-caption-view]').forEach(b=>b.onclick=()=>{captionView=b.dataset.captionView;renderLibrary()});renderCaptionPanel();
};
function templateCards(){return `<div class="captionTemplateGrid">${Object.entries(captionStyles).map(([id,s])=>`<button class="captionTemplate ${captionTemplate===id?'chosen':''}" data-caption-template="${id}"><span class="captionSample sample-${id}">Ceritamu dimulai.</span><strong>${s.name}</strong></button>`).join('')}</div>`}
function renderCaptionPanel(){const subs=texts.filter(t=>t.kind==='subtitle').sort((a,b)=>a.start-b.start);if(captionView==='auto'){$('#captionPanel').innerHTML=`<div class="featureCard heroFeature"><span class="featureIcon">✧</span><h3>Suara menjadi cerita.</h3><p>Ubah ucapan video menjadi subtitle dengan Whisper, langsung di perangkat Anda.</p></div><label class="featureLabel">Sumber<select id="captionSource"><option value="all">Semua klip video</option><option value="selected">Klip video terpilih</option>${audios.map(a=>`<option value="${a.id}">♫ ${esc(a.name)}</option>`).join('')}</select></label><label class="featureLabel">Bahasa ucapan<select id="captionLanguage"><option value="auto">Deteksi otomatis</option><option value="indonesian">Bahasa Indonesia</option><option value="english">English</option><option value="javanese">Bahasa Jawa</option><option value="malay">Bahasa Melayu</option></select></label><label class="featureLabel">Model Whisper<select id="captionModel"><option value="fast">Ringan · Whisper Tiny (~100 MB)</option><option value="accurate">Akurat · Large v3 Turbo (~760 MB)</option></select></label><button class="primary full" id="generateCaptions">✧ Buat auto subtitle</button><p class="featureNote">Pilih bahasa ucapan untuk membantu pengenalan. Mode Akurat menampilkan waktu per kata dan memerlukan lebih banyak memori. Model diunduh saat pertama digunakan. Audio diproses di perangkat.</p><div class="captionUtility"><button id="manualCaption">＋ Manual</button><button id="importSrt">↥ Impor SRT</button></div>`;$('#captionLanguage').value=captionLanguage;$('#captionModel').value=captionModel;
 const saveCaptionSettings=()=>{
  captionLanguage=$('#captionLanguage').value;
  captionModel=$('#captionModel').value;
  try{localStorage.setItem('flexcut-caption-settings',JSON.stringify({version:2,language:captionLanguage,model:captionModel}))}catch(error){}
 };
 $('#captionLanguage').onchange=$('#captionModel').onchange=saveCaptionSettings;
 $('#generateCaptions').onclick=()=>{saveCaptionSettings();generateCaptions($('#captionSource').value)};$('#manualCaption').onclick=addCaption;$('#importSrt').onclick=()=>$('#srtInput').click()}
 else if(captionView==='templates'){$('#captionPanel').innerHTML='<p class="featureIntro">Satu gaya. Sepanjang cerita.</p>'+templateCards()+'<button class="primary full" id="styleAll">Terapkan ke semua subtitle</button><p class="featureNote">Klik template untuk mengubah subtitle terpilih. Pilihan ini juga dipakai untuk subtitle baru.</p>';bindTemplates();$('#styleAll').onclick=()=>{if(!subs.length)return toast('Buat subtitle atau impor SRT terlebih dahulu');commit();subs.forEach(t=>setCaptionStyle(t,captionTemplate));render();toast('Template diterapkan ke semua subtitle')}}
 else{$('#captionPanel').innerHTML=`<div class="captionUtility"><button id="manualCaption">＋ Tambah</button><button id="importSrt">↥ SRT</button><button id="exportSrt">↗ SRT</button></div>${subs.length?'<div class="captionList">'+subs.map((t,i)=>`<button class="captionRow ${selected===t.id?'chosen':''}" data-caption-id="${t.id}"><span>${String(i+1).padStart(2,'0')} <small>${fmt(t.start)} → ${fmt(t.start+t.duration)}</small></span><strong>${esc(t.text)}</strong></button>`).join('')+'</div>':'<p class="empty">Belum ada subtitle.<br>Gunakan Auto, tambahkan manual, atau impor file SRT.</p>'}`;$('#manualCaption').onclick=addCaption;$('#importSrt').onclick=()=>$('#srtInput').click();$('#exportSrt').onclick=exportSrt;$$('[data-caption-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.captionId;time=texts.find(t=>t.id===selected).start;render()});const editing=subs.find(t=>t.id===selected);if(editing){$('#captionPanel').insertAdjacentHTML('beforeend',`<div class="featureCard inlineCaptionEditor"><h3>Edit subtitle</h3><textarea id="captionInline" rows="3" aria-label="Isi subtitle">${esc(editing.text)}</textarea><label class="featureLabel">Mulai (detik)<input id="captionInlineStart" type="number" min="0" step="0.1" value="${editing.start.toFixed(2)}"></label><label class="featureLabel">Durasi (detik)<input id="captionInlineDuration" type="number" min="0.1" step="0.1" value="${editing.duration.toFixed(2)}"></label><button class="primary full" id="saveCaptionInline">Simpan subtitle</button></div>`);$('#saveCaptionInline').onclick=()=>{const text=$('#captionInline').value.trim(),start=Number($('#captionInlineStart').value),duration=Number($('#captionInlineDuration').value);if(!text||!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<.1)return toast('Isi teks dan waktu subtitle dengan benar');commit();Object.assign(editing,{text,start,duration});time=Math.min(total(),start);render();toast('Subtitle disimpan')}}}}
function setCaptionStyle(t,id){const s=captionStyles[id];Object.assign(t,{template:id,color:s.color,size:s.size})}
function bindTemplates(){$$('[data-caption-template]').forEach(b=>b.onclick=()=>{captionTemplate=b.dataset.captionTemplate;const t=texts.find(t=>t.id===selected&&t.kind==='subtitle');if(t){commit();setCaptionStyle(t,captionTemplate);render()}else renderLibrary()})}
function addCaption(){if(!clips.length)return toast('Tambahkan klip terlebih dahulu');commit();const t={id:uid(),trackId:textInsertionTrack('subtitle'),kind:'subtitle',text:'Tulis subtitle Anda',start:Math.min(time,Math.max(0,total()-.5)),duration:Math.min(3,Math.max(.5,total()-time)),y:85};setCaptionStyle(t,captionTemplate);texts.push(t);selected=t.id;time=t.start;tab='subtitles';captionView='edit';updateNav();render()}
const baseInspector=renderInspector;
renderInspector=function(){baseInspector();const c=clips.find(c=>c.id===selected),t=texts.find(t=>t.id===selected),a=audios.find(a=>a.id===selected);if(c){const isVideo=assets.find(a=>a.id===c.asset)?.type==='video';$('#inspectorContent').insertAdjacentHTML('afterbegin',`<div class="clipFeatureActions">${isVideo?'<button id="extractSelected" class="secondary full">♫ Ekstrak audio</button><button id="captionSelected" class="secondary full">✧ Auto subtitle klip</button>':''}${precedingClip(c)?`<button id="transitionSelected" class="secondary full">⇄ ${transitions[c.transition||'none']?.[0]||'Transisi'}</button>`:''}</div>`);$('#extractSelected')?.addEventListener('click',showExtract);$('#captionSelected')?.addEventListener('click',()=>generateCaptions('selected'));$('#transitionSelected')?.addEventListener('click',()=>{tab='transitions';updateNav();renderLibrary()})}if(t?.kind==='subtitle'){$('#inspectorContent').insertAdjacentHTML('afterbegin',`<div class="propertySection"><h3>Template subtitle</h3><select id="selectedCaptionStyle" class="full">${Object.entries(captionStyles).map(([id,s])=>`<option value="${id}" ${t.template===id?'selected':''}>${s.name}</option>`).join('')}</select><p class="featureNote">Subtitle ikut dirender ke video ekspor.</p></div>`);$('#selectedCaptionStyle').onchange=e=>{commit();setCaptionStyle(t,e.target.value);render()}}if(a){$('#inspectorContent').insertAdjacentHTML('afterbegin','<button class="secondary full" id="downloadAudio">↧ Unduh audio WAV</button>');$('#downloadAudio').onclick=()=>downloadTrack(a)}};
function setJobStatus(text){if(job&&$('#jobStatus'))$('#jobStatus').textContent=text}
function beginJob(title){pause();const token={cancelled:false,cancelHooks:[]};job=token;modal(`<h2>${title}</h2><p id="jobStatus">Menyiapkan media…</p><div class="jobSpinner"></div><p class="featureNote">Biarkan tab ini tetap terbuka.</p><div class="actions"><button id="cancelJob">Batalkan</button></div>`);const cancel=()=>{token.cancelled=true;for(const fn of token.cancelHooks)fn();asrWorker?.terminate();asrWorker=null;$('#modal').close();$('#modal').oncancel=null;job=null;toast('Proses dibatalkan')};$('#cancelJob').onclick=cancel;$('#modal').oncancel=e=>{e.preventDefault();cancel()};return token}
function endJob(token){if(job===token){job=null;$('#modal').close();$('#modal').oncancel=null}}
function assertJob(token){if(token.cancelled)throw new Error('cancelled')}
async function decodeSource(src,token){if(decodedAudio.has(src))return decodedAudio.get(src);audioContext=audioContext||new AudioContext();await audioContext.resume();const data=await fetch(src).then(r=>{if(!r.ok)throw new Error('Media tidak dapat dibaca');return r.arrayBuffer()});assertJob(token);try{const audio=await audioContext.decodeAudioData(data);decodedAudio.set(src,audio);return audio}catch(error){assertJob(token);setJobStatus('Membaca audio video secara langsung. Proses mengikuti durasi video…');const audio=await captureAudio(src,token);decodedAudio.set(src,audio);return audio}}
async function captureAudio(src,token){const ac=audioContext,el=document.createElement('video');el.src=src;el.playsInline=true;el.preload='auto';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Metadata video tidak terbaca')),20000);el.onloadedmetadata=()=>{clearTimeout(timer);resolve()};el.onerror=()=>{clearTimeout(timer);reject(new Error('Video tidak dapat dibaca'))}});assertJob(token);if(!Number.isFinite(el.duration)||el.duration>600)throw new Error('Gunakan klip maksimal 10 menit untuk format audio ini');const source=ac.createMediaElementSource(el),processor=ac.createScriptProcessor(4096,2,1),mute=ac.createGain();mute.gain.value=0;const chunks=[];processor.onaudioprocess=e=>{const input=e.inputBuffer,out=new Float32Array(input.length);for(let ch=0;ch<input.numberOfChannels;ch++){const d=input.getChannelData(ch);for(let i=0;i<d.length;i++)out[i]+=d[i]/input.numberOfChannels}chunks.push(out)};source.connect(processor);processor.connect(mute);mute.connect(ac.destination);try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Pembacaan audio melebihi batas waktu')),(el.duration+25)*1000);const cancel=()=>{clearTimeout(timer);reject(new Error('cancelled'))};token.cancelHooks.push(cancel);el.onended=()=>{clearTimeout(timer);resolve()};el.onerror=()=>{clearTimeout(timer);reject(new Error('Audio video tidak terbaca'))};el.play().catch(reject)})}finally{el.pause();source.disconnect();processor.disconnect();mute.disconnect();el.removeAttribute('src');el.load()}assertJob(token);const length=chunks.reduce((n,c)=>n+c.length,0);if(!length)throw new Error('Tidak ada audio yang terbaca');const buffer=ac.createBuffer(1,length,ac.sampleRate),out=buffer.getChannelData(0);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length}return buffer}
async function segmentAudio(src,offset,duration,speed,rate,token,{speech=false}={}){const source=await decodeSource(src,token);assertJob(token);const frames=Math.max(1,Math.ceil(duration*rate)),offline=new OfflineAudioContext(1,frames,rate),node=offline.createBufferSource();node.buffer=source;node.playbackRate.value=speed;if(speech){const filter=offline.createBiquadFilter();filter.type='highpass';filter.frequency.value=75;filter.Q.value=.707;node.connect(filter);filter.connect(offline.destination)}else node.connect(offline.destination);node.start(0,Math.max(0,offset));node.stop(duration);const out=await offline.startRendering();assertJob(token);return out}
function wavBlob(buffer){const data=buffer.getChannelData(0),bytes=new ArrayBuffer(44+data.length*2),view=new DataView(bytes);const str=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');view.setUint32(4,36+data.length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,data.length*2,true);for(let i=0;i<data.length;i++){const s=Math.max(-1,Math.min(1,data[i]));view.setInt16(44+i*2,s<0?s*32768:s*32767,true)}return new Blob([bytes],{type:'audio/wav'})}
function selectedVideo(){const c=clips.find(c=>c.id===selected),a=assets.find(a=>a.id===c?.asset);return a?.type==='video'&&a.src?{c,a}:null}
function showExtract(){const item=selectedVideo();if(!item)return toast('Impor dan pilih klip video di timeline terlebih dahulu');pause();modal(`<h2>Suara punya ruang sendiri.</h2><p>${esc(item.c.name)} · ${item.c.duration.toFixed(1)} detik</p><p>Audio mengikuti pangkasan dan kecepatan klip. Pisahkan ke track untuk mengedit volume secara terpisah, atau unduh WAV.</p><label class="featureLabel">Hasil<select id="extractMode"><option value="track">Pisahkan ke track audio</option><option value="download">Unduh WAV saja</option><option value="both">Track audio + unduh WAV</option></select></label><label class="checkLabel"><input type="checkbox" id="muteOriginal" checked> Bisukan suara video setelah dipisahkan</label><div class="actions"><button id="closeModal">Batal</button><button class="primary" id="runExtract">Ekstrak audio</button></div>`);$('#runExtract').onclick=()=>{const mode=$('#extractMode').value,mute=$('#muteOriginal').checked;$('#modal').close();extractAudio(item,mode,mute)}}
async function extractAudio({c,a},mode,mute){const token=beginJob('Mengekstrak audio…');try{const buffer=await segmentAudio(a.src,c.in,c.duration,c.speed,44100,token),blob=wavBlob(buffer),name=c.name.replace(/\.[^.]+$/,'')+'-audio.wav';assertJob(token);if(mode!=='download'){const id=uid();await stashAudio(id,blob);assertJob(token);commit();audios.push({id,name,src:URL.createObjectURL(blob),type:'audio',start:clipStart(c),duration:c.duration,sourceDuration:c.duration,volume:c.volume,extracted:true});if(mute)c.volume=0;selected=id;tab='audio';updateNav();render()}if(mode!=='track')download(blob,name);endJob(token);toast('Audio berhasil diekstrak')}catch(e){endJob(token);if(!token.cancelled){console.error(e);toast('Ekstraksi gagal: '+e.message)}}}
async function downloadTrack(a){if(!a.src)return toast('Impor ulang audio terlebih dahulu');const token=beginJob('Menyiapkan audio WAV…');try{const buffer=await segmentAudio(a.src,a.in||0,a.duration,a.speed||1,44100,token);download(wavBlob(buffer),a.name.replace(/\.[^.]+$/,'')+'.wav');endJob(token);toast('Audio WAV diunduh')}catch(e){endJob(token);if(!token.cancelled)toast('Audio tidak dapat diekspor: '+e.message)}}
function recognize(audio,language,model,token){
 return new Promise((resolve,reject)=>{
  const worker=asrWorker=asrWorker||new Worker('caption-worker.js?v=word-timing-1',{type:'module'});
  function finish(error,output){
   const index=token.cancelHooks.indexOf(cancel);
   if(index>=0)token.cancelHooks.splice(index,1);
   worker.onmessage=worker.onerror=null;
   if(error){
    worker.terminate();
    if(asrWorker===worker)asrWorker=null;
    reject(error);
   }else resolve(output);
  }
  const cancel=()=>reject(new Error('cancelled'));
  worker.onmessage=({data})=>{
   if(data.type==='status')setJobStatus(data.text);
   if(data.type==='complete')finish(null,data.output);
   if(data.type==='error')finish(new Error(data.text));
  };
  worker.onerror=e=>finish(new Error(e.message||'Model tidak dapat dimuat'));
  token.cancelHooks.push(cancel);
  worker.postMessage({audio,language,model},[audio.buffer]);
 });
}

function subtitleChunks(output,duration,speed=1){
 const chunks=output.chunks||[],rows=[];
 const limit=t=>Math.min(duration,Math.max(0,t/speed));
 let group=[];
 function flush(){
  if(!group.length)return;
  const start=group[0].start,end=group.at(-1).end;
  rows.push({
   text:group.map(word=>word.text).join(' '),start,duration:end-start,
   words:group.map(word=>({text:word.text,start:word.start-start,duration:word.end-word.start}))
  });
  group=[];
 }
 for(let index=0;index<chunks.length;index++){
  const {text,timestamp}=chunks[index];
  if(!text?.trim()||!Number.isFinite(timestamp?.[0]))continue;
  const nextStart=chunks[index+1]?.timestamp?.[0];
  const suppliedEnd=timestamp[1];
  const start=limit(timestamp[0]);
  const next=Number.isFinite(nextStart)?limit(nextStart):duration;
  const bound=next>start?next:duration;
  const end=Math.min(bound,Number.isFinite(suppliedEnd)&&limit(suppliedEnd)>start?
   limit(suppliedEnd):start+(suppliedEnd===timestamp[0]?.05:.45));
  if(end<=start)continue;
  const previous=group.at(-1);
  if(previous&&(start-previous.end>=.55||end-group[0].start>3.5))flush();
  group.push({text:text.trim(),start,end});
  if(group.length>=7||/[.!?…][”"’']?$/.test(text.trim()))flush();
 }
 flush();
 return rows;
}

function normalizeCaptionSamples(samples){
 let peak=0,energy=0;
 for(const value of samples){
  peak=Math.max(peak,Math.abs(value));
  energy+=value*value;
 }
 if(peak<.0008||!energy)return false;
 const rms=Math.sqrt(energy/samples.length);
 const gain=Math.min(8,.94/peak,Math.max(1,.08/rms));
 if(gain>1)for(let i=0;i<samples.length;i++)samples[i]*=gain;
 return true;
}

async function generateCaptions(source){
 if(job||exporting)return;
 const videoInputs=clips.filter(c=>assets.find(a=>a.id===c.asset)?.type==='video');
 const selectedClips=source==='all'?videoInputs:videoInputs.filter(c=>source==='selected'&&c.id===selected);
 const inputs=selectedClips.map(c=>({
  id:c.id,name:c.name,src:assets.find(a=>a.id===c.asset)?.src,
  offset:c.in||0,duration:c.duration,speed:c.speed||1,start:clipStart(c)
 }));
 const audio=audios.find(a=>a.id===source);
 if(audio)inputs.push({...audio,offset:audio.in||0,speed:audio.speed||1});
 if(!inputs.length)return toast('Impor video atau audio berisi ucapan, lalu pilih sumber subtitle');
 if(inputs.some(a=>!a.src))return toast('Impor ulang media sumber sebelum membuat subtitle');
 if(inputs.some(a=>a.duration*a.speed>600))return toast('Pisahkan sumber menjadi bagian maksimal 10 menit');
 const model=captionModel,language=captionLanguage;
 const token=beginJob('Membuat auto subtitle…');
 try{
  const generated=[];
  for(let i=0;i<inputs.length;i++){
   const input=inputs[i];
   setJobStatus(`Membaca audio ${i+1}/${inputs.length} · ${input.name}`);
   const nativeDuration=input.duration*input.speed;
   const buffer=await segmentAudio(input.src,input.offset,nativeDuration,1,16000,token,{speech:true});
   const samples=buffer.getChannelData(0);
   if(!normalizeCaptionSamples(samples))continue;
   const output=await recognize(new Float32Array(samples),language,model,token);
   assertJob(token);
   for(const row of subtitleChunks(output,input.duration,input.speed)){
    const t={id:uid(),trackId:textInsertionTrack('subtitle'),kind:'subtitle',sourceId:input.id,text:row.text,words:row.words,
     start:input.start+row.start,duration:row.duration,y:85};
    setCaptionStyle(t,captionTemplate);
    generated.push(t);
   }
  }
  assertJob(token);
  if(!generated.length){endJob(token);return toast('Tidak ada ucapan dengan waktu yang dapat dikenali')}
  commit();
  const ids=new Set(generated.map(t=>t.sourceId));
  texts=texts.filter(t=>!(t.kind==='subtitle'&&ids.has(t.sourceId)));
  texts.push(...generated);
  selected=generated[0].id;
  time=generated[0].start;
  tab='subtitles';
  captionView='edit';
  updateNav();
  render();
  endJob(token);
  toast(generated.length+' subtitle dibuat dengan waktu per kata. Periksa ejaannya.');
 }catch(error){
  endJob(token);
  if(!token.cancelled){
   console.error(error);
   modal(`<h2>Auto subtitle belum berhasil</h2><p>${model==='accurate'?'Model Akurat memerlukan sekitar 760 MB untuk unduhan pertama dan memori yang cukup. Coba kembali atau pilih Ringan pada panel Auto subtitle.':'Periksa koneksi dan ulangi. Anda juga dapat mengimpor SRT atau membuat subtitle secara manual.'}</p><p class="errorDetail">${esc(error.message)}</p><div class="actions"><button class="primary" id="closeModal">Mengerti</button></div>`);
  }
 }
}
function parseSrt(source){const blocks=source.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/),rows=[];const stamp=s=>{const m=s.match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000:NaN};for(const b of blocks){const lines=b.split('\n'),n=lines.findIndex(l=>l.includes('-->'));if(n<0)continue;const [s,e]=lines[n].split('-->'),start=stamp(s),end=stamp(e),text=lines.slice(n+1).join('\n').replace(/<[^>]+>/g,'').trim();if(Number.isFinite(start)&&end>start&&text)rows.push({text,start,duration:end-start})}return rows}
function srtStamp(t){const ms=Math.round(Math.max(0,t)*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`}
function exportSrt(){const rows=texts.filter(t=>t.kind==='subtitle'&&trackVisible(itemTrack(t,'text'))).sort((a,b)=>a.start-b.start);if(!rows.length)return toast('Belum ada subtitle untuk diekspor');download(new Blob([rows.map((t,i)=>`${i+1}\n${srtStamp(t.start)} --> ${srtStamp(t.start+t.duration)}\n${t.text}\n`).join('\n')],{type:'application/x-subrip;charset=utf-8'}),$('#projectName').value+'.srt');toast('Subtitle SRT diunduh')}
document.body.insertAdjacentHTML('beforeend','<input id="srtInput" type="file" accept=".srt" hidden>');$('#srtInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;const rows=parseSrt(await file.text());if(!rows.length){toast('Tidak ada subtitle valid dalam file SRT');e.target.value='';return}commit();for(const row of rows){const t={id:uid(),trackId:textInsertionTrack('subtitle'),kind:'subtitle',...row,y:85};setCaptionStyle(t,captionTemplate);texts.push(t)}selected=texts.at(-rows.length).id;time=Math.min(total(),texts.at(-rows.length).start);tab='subtitles';captionView='edit';updateNav();render();e.target.value='';toast(rows.length+' subtitle diimpor')};
async function restoreExtractedAudio(){for(const a of audios.filter(a=>a.extracted&&!a.src)){const blob=await cachedAudio(a.id);if(blob)a.src=URL.createObjectURL(blob)}save()}
restoreExtractedAudio();render();

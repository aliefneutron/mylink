const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('#canvas'),ctx=canvas.getContext('2d'), media=new Map(), images=new Map();
let audioContext;
let assets=[{id:'coast',name:'Coastal escape.jpg',type:'image',src:'assets/coast.jpg',duration:6}],clips=[0,1,2].map((n)=>({id:'c'+n,asset:'coast',name:['The open coast','A slower moment','Somewhere, away'][n],in:0,duration:6,speed:1,scale:[100,118,140][n],rotation:0,opacity:100,volume:100,filter:'original',brightness:100,contrast:100,saturation:100}));
let texts=[{id:'t1',text:'a little escape.',start:0,duration:12,size:65,color:'#ffffff',y:57}],audios=[],selected='c0',time=0,playing=false,last=0,zoom=38,tab='media',inspect='video',undoStack=[],redoStack=[],exporting=false;
const filterMap={original:'none',warm:'sepia(.26) saturate(1.15)',cinema:'contrast(1.18) saturate(.72)',mono:'grayscale(1)',dream:'saturate(.65) brightness(1.15)',vivid:'saturate(1.65) contrast(1.08)'};
const filterNames={original:'Original',warm:'Golden hour',cinema:'Cinema',mono:'Monokrom',dream:'Dreamy',vivid:'Vivid'};
function uid(){return Math.random().toString(36).slice(2,10)}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const trackKinds={text:'Teks',video:'Video',audio:'Audio'};
const defaultTimelineTracks=()=>Object.keys(trackKinds).map(type=>({id:type,type,name:trackKinds[type]}));
let trackStates={},timelineTracks=defaultTimelineTracks(),activeTimelineTrack=null;
function trackVisible(id){return !trackStates[id]?.hidden}
function trackAudible(id){return trackVisible(id)&&!trackStates[id]?.muted}
function itemTrack(item,type){return item?.trackId||type}
function currentTrack(type){
 const chosen=timelineTracks.find(t=>t.id===activeTimelineTrack&&t.type===type);
 const previous=timelineTracks.find(t=>t.id===type)||timelineTracks.find(t=>t.type===type);
 if(chosen||previous)return (chosen||previous).id;
 timelineTracks.push({id:type,type,name:trackKinds[type]});
 return type;
}
function normalizeTimelineTracks(){
 for(const [type,items] of [['video',clips],['text',texts],['audio',audios]]){
  for(const item of items)if(!timelineTracks.some(t=>t.type===type&&t.id===itemTrack(item,type)))item.trackId=currentTrack(type);
 }
}
function clipsOnTrack(id){return clips.filter(c=>itemTrack(c,'video')===id)}
function precedingClip(clip){
 const sequence=clipsOnTrack(itemTrack(clip,'video'));
 return sequence[sequence.indexOf(clip)-1];
}
function clipStart(clip){
 let start=0;
 for(const c of clipsOnTrack(itemTrack(clip,'video'))){
  if(c.id===clip.id)return start;
  start+=c.duration;
 }
 return 0;
}
function total(){
 const lengths=new Map();
 for(const c of clips){
  const id=itemTrack(c,'video');
  lengths.set(id,(lengths.get(id)||0)+c.duration);
 }
 let end=0;
 for(const duration of lengths.values())end=Math.max(end,duration);
 for(const item of [...texts,...audios])end=Math.max(end,item.start+item.duration);
 return end;
}
function activeVideoLayers(){
 const layers=[],atEnd=time===total();
 for(const track of timelineTracks.filter(t=>t.type==='video'&&trackVisible(t.id))){
  let start=0;
  for(const c of clipsOnTrack(track.id)){
   if(time<start+c.duration||(atEnd&&Math.abs(time-start-c.duration)<.001)){
    layers.push({c,start});
    break;
   }
   start+=c.duration;
  }
 }
 return layers;
}
function activeClip(){
 const layers=activeVideoLayers();
 const focused=clips.find(c=>c.id===selected);
 return layers.find(({c})=>itemTrack(c,'video')===(focused?itemTrack(focused,'video'):activeTimelineTrack))||layers.at(-1)||null;
}
function fmt(t){
 const centiseconds=Math.round(Math.max(0,t)*100);
 const pad=value=>String(value).padStart(2,'0');
 return pad(Math.floor(centiseconds/6000))+':'+pad(Math.floor(centiseconds/100)%60)+'.'+pad(centiseconds%100);
}
const playButton=$('#play'),previewCurrentTime=$('#currentTime').firstChild,previewTotalTime=$('#totalTime').firstChild;
function updateTransport(){
 // Whole seconds during playback keep the transport quiet while the video draws.
 const current=playing?fmt(Math.floor(time)).slice(0,-3):fmt(time);
 const duration=fmt(total());
 if(previewCurrentTime.data!==current)previewCurrentTime.data=current;
 if(previewTotalTime.data!==duration)previewTotalTime.data=duration;
 const label=playing?'Jeda':'Putar';
 if(playButton.getAttribute('aria-label')!==label){
  playButton.classList.toggle('is-playing',playing);
  playButton.setAttribute('aria-label',label);
 }
}
function snapshot(){return {assets:assets.slice(),edit:JSON.stringify({clips,texts,audios,trackStates,timelineTracks,ratio:$('#ratio').value})}}
function commit(){undoStack.push(snapshot());if(undoStack.length>50)undoStack.shift();redoStack=[]}
function restore(s){const d=JSON.parse(s.edit);assets=s.assets.slice();trackStates=d.trackStates||{};timelineTracks=d.timelineTracks??defaultTimelineTracks();clips=d.clips;texts=d.texts;audios=d.audios;if(![...clips,...texts,...audios].some(x=>x.id===selected))selected=clips[0]?.id;$('#ratio').value=d.ratio||'16:9';setRatio();time=Math.min(time,total());syncAudio();render()}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2800)}
function save(){try{localStorage.setItem('ruangcut-project',JSON.stringify({clips,texts,audios,trackStates,timelineTracks,assets:assets.map(({src,...a})=>({...a,src:a.id==='coast'?src:null})),name:$('#projectName').value,ratio:$('#ratio').value}));$('#saveStatus').textContent='✓ Tersimpan di perangkat'}catch(e){$('#saveStatus').textContent='Penyimpanan perangkat penuh'}}
function getImage(a){if(!images.has(a.id)){const img=new Image();img.src=a.src;images.set(a.id,img);img.onload=draw}return images.get(a.id)}
function getVideo(a){if(!media.has(a.id)){const v=document.createElement('video');v.src=a.src;v.playsInline=true;v.preload='auto';v.onloadeddata=draw;v.onseeked=()=>{if(!playing)draw()};media.set(a.id,v)}return media.get(a.id)}
function draw(){const w=canvas.width,h=canvas.height;ctx.fillStyle='#101315';ctx.fillRect(0,0,w,h);const current=activeClip();for(const [id,v] of media){if(id!==current?.c.asset)v.pause()}
if(current){const {c,start}=current,a=assets.find(a=>a.id===c.asset);if(a?.src){let source;if(a.type==='video'){source=getVideo(a);const target=c.in+(time-start)*c.speed;if(Number.isFinite(source.duration)){if(Math.abs(source.currentTime-target)>(playing?.3:.045))source.currentTime=Math.min(source.duration-.02,Math.max(0,target));source.playbackRate=c.speed;source.volume=c.volume/100;source.muted=exporting;if(playing&&source.paused)source.play().catch(()=>{});if(!playing)source.pause()}}else source=getImage(a);const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(sw&&sh){ctx.save();ctx.filter=[filterMap[c.filter]||'none',`brightness(${c.brightness}%) contrast(${c.contrast}%) saturate(${c.saturation}%)`].filter(f=>f!=='none').join(' ');ctx.globalAlpha=c.opacity/100;ctx.translate(w/2,h/2);ctx.rotate(c.rotation*Math.PI/180);const r=Math.max(w/sw,h/sh)*c.scale/100;ctx.drawImage(source,-sw*r/2,-sh*r/2,sw*r,sh*r);ctx.restore()}}else{ctx.fillStyle='#a0a8a7';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText('Impor ulang media: '+c.name,w/2,h/2)}}
for(const t of texts){if(time>=t.start&&time<t.start+t.duration){ctx.save();ctx.fillStyle=t.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${t.size*w/1280}px Georgia,serif`;ctx.shadowColor='#0009';ctx.shadowBlur=8;const lines=t.text.split('\n');lines.forEach((line,n)=>ctx.fillText(line,w/2,h*t.y/100+n*t.size*w/1280*1.2,w*.9));ctx.restore()}}
updateTransport();$('#playhead').style.left=time*zoom+'px';}
function setRatio(){const [w,h]=$('#ratio').value.split(':').map(Number);canvas.width=w===9?720:1280;canvas.height=Math.round(canvas.width*h/w);$('.stageTag').style.display=clips.every(c=>c.asset==='coast')?'':'none';$('.canvasWrap').style.aspectRatio=`${w}/${h}`;draw()}
function frame(now){if(playing&&!exporting){time+=(now-last)/1000;if(time>=total()){time=total();pause()}syncAudio();draw()}last=now;requestAnimationFrame(frame)}requestAnimationFrame(frame);
function syncAudio(){for(const a of audios){if(!a.src)continue;let el=media.get(a.id);if(!el){el=new Audio(a.src);media.set(a.id,el)}const inside=time>=a.start&&time<a.start+a.duration;if(playing&&inside){if(Math.abs(el.currentTime-(time-a.start))>.3)el.currentTime=time-a.start;el.volume=a.volume/100;if(el.paused)el.play().catch(()=>{})}else el.pause()}}
function pause(){playing=false;for(const el of media.values())el.pause();draw()}
function togglePlay(){if(exporting)return;if(playing)pause();else{if(!total())return toast('Tambahkan media ke timeline terlebih dahulu');if(time>=total())time=0;playing=true;last=performance.now();draw()}}
function render(){renderTimeline();renderLibrary();renderInspector();draw();save();$('#undo').disabled=!undoStack.length;$('#redo').disabled=!redoStack.length}
function timelineClipWidth(duration){
 const pixels=duration*zoom;
 return Math.max(1,pixels-Math.min(3,pixels*.12));
}
function sizeTimelineClip(element,duration){
 const width=timelineClipWidth(duration);
 element.style.width=width+'px';
 element.classList.toggle('compactTimelineClip',width<22);
}
function renderTimeline(){
 normalizeTimelineTracks();
 if(typeof syncTimelineLanes==='function')syncTimelineLanes();
 for(const track of timelineTracks){
  const lane=timelineLane(track.id,track.type);
  lane.replaceChildren();
  const entries=track.type==='video'?clipsOnTrack(track.id):track.type==='text'?
   texts.filter(t=>itemTrack(t,'text')===track.id):audios.filter(a=>itemTrack(a,'audio')===track.id);
  if(track.type==='audio'&&!entries.length){
   const placeholder=document.createElement('button');
   placeholder.type='button';placeholder.className='audioPlaceholder';
   placeholder.innerHTML=editorIcon('plus',14)+' Impor audio';
   placeholder.onclick=()=>{activeTimelineTrack=track.id;$('#fileInput').accept='audio/*';$('#fileInput').click()};
   lane.append(placeholder);
  }
  let start=0;
  for(const item of entries){
   const element=document.createElement('div'),video=track.type==='video';
   element.className='clip'+(video?'':track.type==='text'?' textClip':' audioClip')+(selected===item.id?' selected':'');
   element.style.left=(video?start:item.start)*zoom+'px';
   element.dataset.id=item.id;
   sizeTimelineClip(element,item.duration);
   if(video){
    const asset=assets.find(a=>a.id===item.asset);
    const film=document.createElement('div');
    film.className='film';
    if(asset?.type==='image'&&asset.src){
     const image=new Image();
     image.src=asset.src;image.alt='';image.draggable=false;film.append(image);
    }
    const label=document.createElement('span');
    label.className='clipName';label.textContent=item.name;
    element.append(film,label);
    start+=item.duration;
   }else element.textContent=track.type==='text'?'T  '+item.text:'♫ '+item.name;
   element.onclick=()=>{activeTimelineTrack=track.id;selected=item.id;renderTimeline();renderInspector();if(['effects','transitions'].includes(tab))renderLibrary()};
   if(track.type!=='text'){
    element.draggable=true;
    element.ondragstart=e=>e.dataTransfer.setData('text/clip',item.id);
   }
   lane.append(element);
  }
 }
 $('#clipCount').innerHTML=`${clips.length} klip <em>·</em> 30 fps`;
 draw();
}
function timelineLane(id,type){
 const laneID=id in trackKinds?id+'Track':'lane-'+id;
 let lane=document.getElementById(laneID);
 if(!lane&&type){
  lane=document.createElement('div');
  lane.id=laneID;lane.className='track '+type+'Track';
  $('#playhead').before(lane);
 }
 return lane;
}
function renderLibrary(){$('#libraryTitle').textContent={media:'Media proyek',audio:'Audio & musik',text:'Tambahkan teks',filters:'Filter warna',effects:'Efek visual'}[tab];$('#assetCount').textContent=tab==='media'?assets.length+' aset':'';let content='';if(tab==='media'){content='<button class="import" id="importMedia"><strong>＋</strong> Impor media</button><div class="libraryTabs"><span class="active">Semua media</span><span>Video, foto & audio</span></div><div class="assets">'+assets.map(a=>`<div class="asset" draggable="true" data-asset="${a.id}"><div class="thumb">${a.type==='image'&&a.src?`<img src="${esc(a.src)}" alt="${esc(a.name)}">`:`<span class="mediaFallback">${a.type==='audio'?'♫ AUDIO':a.type==='image'?'▧ FOTO':'▣ VIDEO'}</span>`}<span class="duration">${fmt(a.duration).slice(0,5)}</span></div><p>${esc(a.name)}</p><small>${a.type==='video'?'Video':'Foto'} · ${a.id==='coast'?'Contoh': 'Lokal'}</small></div>`).join('')+'</div><p class="empty" style="font-size:10px;margin-top:22px">Mulai cerita Anda.<br>Impor video atau tarik media ke sini.</p>'}else if(tab==='audio'){content='<button class="import" id="importMedia">＋ Impor audio</button><p class="empty">Tambahkan musik, voice-over, atau suara suasana dari perangkat Anda.</p>'+audios.map(a=>`<p>♫ ${esc(a.name)}</p>`).join('')}else if(tab==='text'){content='<button class="import" id="newText">＋ Tambahkan teks</button><button class="preset" data-preset="Judul video Anda">Judul sederhana <span style="float:right">T</span></button><button class="preset" data-preset="a little escape.">a little escape. <span style="float:right;font-family:Georgia">Aa</span></button><button class="preset" data-preset="CERITAKAN MOMENMU">CERITAKAN MOMENMU</button><p class="empty">Klik teks di timeline untuk mengubah isi, ukuran, warna, dan durasinya.</p>'}else if(tab==='filters'){content='<p class="empty" style="padding-top:0">Berikan suasana pada klip terpilih.</p><div class="swatches">'+Object.entries(filterNames).map(([id,name])=>`<button class="swatch" data-filter="${id}"><img src="assets/coast.jpg" alt="" style="filter:${filterMap[id]}">${name}</button>`).join('')+'</div>'}else{content='<p class="empty">Transformasi cepat untuk klip terpilih.</p><button class="preset" data-effect="zoom">⊕ &nbsp; Close-up <small style="float:right">125%</small></button><button class="preset" data-effect="rotate">↻ &nbsp; Putar 90°</button><button class="preset" data-effect="fade">◐ &nbsp; Transparan <small style="float:right">70%</small></button><button class="preset" data-effect="reset">↺ &nbsp; Reset tampilan</button>'}$('#libraryContent').innerHTML=content;$('#importMedia')?.addEventListener('click',()=>{$('#fileInput').accept=tab==='audio'?'audio/*':'video/*,image/*,audio/*';$('#fileInput').click()});$('#newText')?.addEventListener('click',()=>addText());$$('[data-asset]').forEach(el=>{el.ondragstart=e=>e.dataTransfer.setData('text/asset',el.dataset.asset)});$$('[data-preset]').forEach(el=>el.onclick=()=>addText(el.dataset.preset));$$('[data-filter]').forEach(el=>el.onclick=()=>{const c=clips.find(c=>c.id===selected);if(!c)return toast('Pilih klip video di timeline');commit();c.filter=el.dataset.filter;render();toast('Filter '+filterNames[c.filter]+' diterapkan')});$$('[data-effect]').forEach(el=>el.onclick=()=>{const c=clips.find(c=>c.id===selected);if(!c)return toast('Pilih klip video terlebih dahulu');commit();switch(el.dataset.effect){case'zoom':c.scale=125;break;case'rotate':c.rotation=(c.rotation+90)%360;break;case'fade':c.opacity=70;break;default:Object.assign(c,{scale:100,rotation:0,opacity:100,filter:'original',brightness:100,contrast:100,saturation:100})}render()})}
function field(label,key,value,min,max,step=1,type='number'){return `<label class="field">${label}<input data-prop="${key}" type="${type}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`}
function renderInspector(){const c=clips.find(c=>c.id===selected),t=texts.find(t=>t.id===selected),a=audios.find(a=>a.id===selected);let html='';if(t){html=`<div class="propertySection"><h3>Teks <span>▾</span></h3><textarea id="textValue" rows="3">${esc(t.text)}</textarea>${field('Ukuran','size',t.size,12,180)}<label class="field">Warna<input type="color" data-prop="color" value="${t.color}"></label>${field('Posisi horizontal (%)','x',t.x??50,1,99)}${field('Posisi vertikal (%)','y',t.y,1,99)}</div><div class="propertySection"><h3>Waktu tampil</h3>${field('Mulai (detik)','start',t.start,0,total(),.1)}${field('Durasi (detik)','duration',t.duration,.1,300,.1)}</div>`}else if(a){html=`<div class="propertySection"><h3>Audio</h3><p>${esc(a.name)}</p>${field('Volume (%)','volume',a.volume,0,100,1,'range')}${field('Mulai (detik)','start',a.start,0,300,.1)}${field('Durasi (detik)','duration',a.duration,.1,a.sourceDuration,.1)}</div>`}else if(c){if(inspect==='adjust'){html=`<div class="propertySection"><h3>Warna & cahaya</h3>${field('Kecerahan','brightness',c.brightness,20,200,1,'range')}${field('Kontras','contrast',c.contrast,20,200,1,'range')}${field('Saturasi','saturation',c.saturation,0,200,1,'range')}<label class="field">Filter<select data-prop="filter">${Object.entries(filterNames).map(([id,n])=>`<option value="${id}" ${c.filter===id?'selected':''}>${n}</option>`).join('')}</select></label></div>`}else{html=`<div class="propertySection"><h3>Transformasi <span>▾</span></h3>${field('Skala (%)','scale',c.scale,10,300,1,'range')}${field('Rotasi (°)','rotation',c.rotation,-360,360)}<div class="alignButtons"><button id="rotateLeft" title="Putar ke kiri">↶</button><button id="resetScale" title="Reset transformasi">⊡</button><button id="rotateRight" title="Putar ke kanan">↷</button></div></div><div class="propertySection"><h3>Klip <span>▾</span></h3>${field('Pangkas awal (d)','in',c.in,0,36000,.1)}${field('Durasi (detik)','duration',c.duration,.1,300,.1)}<label class="field">Kecepatan<select data-prop="speed">${[.25,.5,1,1.5,2,3].map(s=>`<option ${c.speed===s?'selected':''} value="${s}">${s}×</option>`).join('')}</select></label></div><div class="propertySection"><h3>Komposisi <span>▾</span></h3>${field('Opasitas','opacity',c.opacity,0,100,1,'range')}${field('Volume','volume',c.volume,0,100,1,'range')}</div>`}}else html='<p class="empty">Pilih klip pada timeline untuk mulai mengedit.</p>';$('#inspectorContent').innerHTML=html+'<p class="inspectorFoot">Setiap momen punya cerita.<br>Buat jadi milik Anda.</p>';const target=c||t||a;$$('[data-prop]').forEach(el=>{el.onchange=()=>{commit();const key=el.dataset.prop;let value=['filter','color'].includes(key)?el.value:Number(el.value);if(typeof value==='number'){value=Math.max(Number(el.min||.1),Math.min(Number(el.max||36000),value));if(!Number.isFinite(value))return}if(c&&['in','duration','speed'].includes(key)){const asset=assets.find(a=>a.id===c.asset);let next={...c,[key]:value};if(key==='speed')next.duration=c.duration*c.speed/value;if(asset?.type==='video'&&next.in+next.duration*next.speed>asset.duration+.01){undoStack.pop();el.value=target[key];return toast('Durasi melebihi panjang video sumber')}Object.assign(c,next)}else target[key]=value;time=Math.min(time,total());render()}});const textEditor=$('#textValue');if(textEditor){let historyStarted=false;textEditor.addEventListener('focus',()=>historyStarted=false);textEditor.addEventListener('input',e=>{if(!historyStarted){commit();historyStarted=true}t.text=e.target.value;renderTimeline();draw();save();$('#undo').disabled=!undoStack.length;$('#redo').disabled=!redoStack.length});textEditor.addEventListener('change',()=>{if(tab==='subtitles')renderLibrary()})};for(const [id,fn]of [['rotateLeft',()=>c.rotation-=90],['rotateRight',()=>c.rotation+=90],['resetScale',()=>Object.assign(c,{scale:100,rotation:0})]])$('#'+id)?.addEventListener('click',()=>{commit();fn();render()})}
function addAsset(id,{recordHistory=true,trackId=null,start=time}={}){
 const asset=assets.find(a=>a.id===id);
 if(!asset?.src)return toast('Impor ulang file dari perangkat Anda');
 if(recordHistory)commit();
 const kind=asset.type==='audio'?'audio':'video';
 const target=timelineTracks.some(t=>t.id===trackId&&t.type===kind)?trackId:currentTrack(kind);
 if(asset.type==='audio'){
  const track={id:uid(),assetId:id,name:asset.name,type:'audio',src:asset.src,trackId:target,start,duration:asset.duration,volume:80,sourceDuration:asset.duration};
  audios.push(track);
  selected=track.id;
 }else{
  const clip={id:uid(),trackId:target,asset:id,name:asset.name,in:0,duration:asset.duration,speed:1,scale:100,rotation:0,opacity:100,volume:100,filter:'original',brightness:100,contrast:100,saturation:100};
  clips.push(clip);
  selected=clip.id;
 }
 activeTimelineTrack=target;
 render();
 toast('Media ditambahkan ke timeline');
}
function addText(text='Teks Anda di sini'){commit();const t={id:uid(),trackId:currentTrack('text'),text,start:time,duration:Math.min(5,Math.max(1,total()-time)),size:65,color:'#ffffff',y:57};texts.push(t);selected=t.id;tab='text';updateNav();render()}
function split(){const current=activeClip();if(!current)return;const {c,start}=current,offset=time-start;if(offset<.1||offset>c.duration-.1)return toast('Letakkan playhead di bagian tengah klip');commit();const after={...c,id:uid(),in:c.in+offset*c.speed,duration:c.duration-offset};c.duration=offset;clips.splice(clips.indexOf(c)+1,0,after);selected=after.id;render();toast('Klip berhasil dipisahkan')}
function remove(){if(![...clips,...texts,...audios].some(c=>c.id===selected))return;commit();clips=clips.filter(c=>c.id!==selected);texts=texts.filter(c=>c.id!==selected);audios=audios.filter(c=>c.id!==selected);selected=clips[0]?.id;time=Math.min(time,total());render()}
async function importFiles(files,options={}){for(const f of files){const type=f.type.split('/')[0];if(!['video','image','audio'].includes(type)){toast('Gunakan file video, gambar, atau audio');continue}const src=URL.createObjectURL(f),id=uid();try{let duration=6;if(type!=='image'){duration=await new Promise((resolve,reject)=>{const e=document.createElement(type==='audio'?'audio':'video');e.preload='metadata';e.src=src;e.onloadedmetadata=()=>Number.isFinite(e.duration)?resolve(e.duration):reject();e.onerror=reject;setTimeout(reject,15000)})}const missing=assets.find(a=>a.name===f.name&&!a.src&&a.type===type);if(missing){missing.src=src;missing.duration=duration;for(const track of audios.filter(a=>type==='audio'&&!a.src&&(a.assetId===missing.id||(!a.assetId&&!a.extracted&&a.name===f.name)))){track.src=src;track.assetId=missing.id}render();toast(f.name+' dihubungkan kembali');continue}const a={id,name:f.name,type,src,duration};commit();assets.push(a);addAsset(id,{...options,recordHistory:false});toast(f.name+' berhasil diimpor')}catch(e){URL.revokeObjectURL(src);toast('File tidak dapat dibaca oleh browser ini')}}$('#fileInput').value='';render()}
function updateNav(){$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))}
$('#fileInput').onchange=e=>importFiles([...e.target.files]);$$('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;updateNav();renderLibrary()});$$('[data-inspect]').forEach(b=>b.onclick=()=>{inspect=b.dataset.inspect;$$('[data-inspect]').forEach(x=>x.classList.toggle('active',x===b));renderInspector()});$('#play').onclick=togglePlay;$('#prev').onclick=()=>{pause();time=0;draw()};$('#next').onclick=()=>{pause();time=total();draw()};$('#split').onclick=split;$('#delete').onclick=remove;$('#addText').onclick=()=>addText();$('#duplicate').onclick=()=>{const c=clips.find(c=>c.id===selected);if(!c)return;commit();const clone={...c,id:uid()};clips.splice(clips.indexOf(c)+1,0,clone);selected=clone.id;render()};$('#undo').onclick=()=>{if(undoStack.length){pause();redoStack.push(snapshot());restore(undoStack.pop())}};$('#redo').onclick=()=>{if(redoStack.length){pause();undoStack.push(snapshot());restore(redoStack.pop())}};$('#ratio').onchange=()=>{commit();setRatio();save()};$('#ruler').onpointerdown=e=>{pause();const seek=ev=>{time=Math.max(0,Math.min(total(),(ev.clientX-$('#ruler').getBoundingClientRect().left)/zoom));draw()};seek(e);const end=()=>{window.removeEventListener('pointermove',seek);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',seek);window.addEventListener('pointerup',end)};$('#fullscreen').onclick=()=>{$('.canvasWrap').requestFullscreen?.().catch(()=>toast('Layar penuh tidak tersedia'))};$('#resolution').onclick=()=>toast('Pratinjau HD · Ekspor mengikuti rasio kanvas');$('#projectName').onchange=save;
$('.library').ondragover=e=>e.preventDefault();$('.library').ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length)importFiles([...e.dataTransfer.files])};
function modal(html){$('#modalContent').innerHTML=html;$('#modal').showModal();$('#closeModal')?.addEventListener('click',()=>$('#modal').close())}
function help(){modal('<h2>Ruang untuk berkarya.</h2><p>Impor foto atau video, lalu klik aset untuk menambahkannya ke timeline. Tarik klip untuk mengatur urutan. Klik penggaris waktu untuk berpindah, lalu pisahkan klip di posisi playhead.</p><p><kbd>Spasi</kbd> Putar / jeda<br><kbd>S</kbd> Pisahkan klip<br><kbd>Delete</kbd> Hapus pilihan<br><kbd>Ctrl Z</kbd> Urungkan<br><kbd>Ctrl Y</kbd> Ulangi</p><p>Proyek disimpan otomatis di browser ini. Setelah halaman dimuat ulang, file impor perlu dipilih kembali. Menu Ekspor menyediakan MP4, WAV, dan kompresi. Buka Konversi untuk MP3 atau format video lainnya.</p><div class="actions"><button class="primary" id="closeModal">Mulai mengedit</button></div>')}
$('#help').onclick=help;$('#guide').onclick=help;
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
$('#saveProject').onclick=()=>{save();download(new Blob([JSON.stringify({name:$('#projectName').value,clips,texts,audios:audios.map(({src,...a})=>a),trackStates,timelineTracks,assets:assets.map(({src,...a})=>a),ratio:$('#ratio').value},null,2)],{type:'application/json'}),$('#projectName').value+'.flexcut.json');toast('Pengaturan proyek diunduh. Simpan juga file media asli Anda.')};
$('#export').onclick=()=>{if(!clips.length)return toast('Tambahkan klip terlebih dahulu');if(audios.some(a=>!a.src)||clips.some(c=>!assets.find(a=>a.id===c.asset)?.src))return toast('Impor ulang media yang hilang sebelum ekspor');if(!window.MediaRecorder||!canvas.captureStream)return toast('Browser ini belum mendukung ekspor video');pause();modal(`<h2>Siap dibagikan.</h2><p>Cerita Anda, dalam satu video.</p><div class="propertySection">${field('Durasi','exportDuration',total().toFixed(1),0,300)}<label class="field">Resolusi<span>${canvas.width} × ${canvas.height}</span></label><label class="field">Format<span>WebM · 30 fps</span></label></div><p>Ekspor berjalan selama durasi video. Biarkan tab tetap terbuka. Video impor dan musik akan disertakan dengan volumenya.</p><div class="actions"><button id="closeModal">Batal</button><button class="primary" id="startExport">Ekspor sekarang ↗</button></div>`);$('[data-prop="exportDuration"]').disabled=true;$('#startExport').onclick=exportVideo};
async function exportVideo(){let recorder,stream,ac,destination,cancelled=false;try{exporting=true;$('#modalContent').innerHTML='<h2>Merangkai cerita Anda…</h2><p id="exportStatus">Menyiapkan video</p><progress id="exportProgress" value="0" max="1"></progress><div class="actions"><button id="cancelExport">Batalkan</button></div>';$('#cancelExport').onclick=()=>cancelled=true;$('#modal').oncancel=e=>{e.preventDefault();cancelled=true};time=0;draw();ac=audioContext||(audioContext=new AudioContext());await ac.resume();destination=ac.createMediaStreamDestination();for(const c of clips)clipVideo(c);for(const a of audios){if(!media.has(a.id))media.set(a.id,new Audio(a.src))}for(const el of media.values()){if(!el._audioSource){el._audioSource=ac.createMediaElementSource(el);el._audioContext=ac}el._audioSource.disconnect();el._audioSource.connect(destination)}
for(const el of media.values()){el.pause();el.currentTime=0;el.muted=false}stream=canvas.captureStream(30);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:8000000}:{});const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const stopped=new Promise(r=>recorder.onstop=r);await new Promise(r=>setTimeout(r,200));playing=true;recorder.start(200);const start=performance.now();while(time<total()&&!cancelled){time=Math.min(total(),(performance.now()-start)/1000);syncAudio();draw();for(const el of media.values())el.muted=false;$('#exportProgress').value=time/total();$('#exportStatus').textContent=Math.round(time/total()*100)+'% · '+fmt(time)+' / '+fmt(total());await new Promise(r=>setTimeout(r,1000/30))}recorder.stop();await stopped;if(!cancelled)download(new Blob(chunks,{type:mime||'video/webm'}),$('#projectName').value+'.webm');$('#modal').close();toast(cancelled?'Ekspor dibatalkan':'Video berhasil diekspor')}catch(e){console.error(e);$('#modal').close();toast('Ekspor gagal. Coba browser Chrome atau Edge terbaru.')}finally{exporting=false;pause();stream?.getTracks().forEach(t=>t.stop());for(const el of media.values()){el.muted=false;if(el._audioSource){el._audioSource.disconnect();el._audioSource.connect(el._audioContext.destination)}}$('#modal').oncancel=null;draw()}}
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('#modal').open||exporting)return;if(e.code==='Space'&&!e.target.closest?.('.trackControl,.trackMenu button,[data-add-track]')){e.preventDefault();togglePlay()}if(e.key.toLowerCase()==='s'&&!e.ctrlKey)split();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove()}if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('#undo').click()}if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();$('#redo').click()}});
try{const d=JSON.parse(localStorage.getItem('ruangcut-project'));if(d){trackStates=d.trackStates||{};timelineTracks=d.timelineTracks??defaultTimelineTracks();clips=d.clips;texts=d.texts;audios=d.audios.map(a=>({...a,src:null}));assets=d.assets;$('#projectName').value=d.name;$('#ratio').value=d.ratio||'16:9';selected=clips[0]?.id;if(assets.some(a=>!a.src))setTimeout(()=>toast('Impor ulang media lokal untuk melanjutkan proyek Anda'),1000)}}catch(e){}setRatio();render();

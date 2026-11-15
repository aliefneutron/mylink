// Direct timeline manipulation and visual media browsing.
const timelineViewport=$('#timelineScroll');
const thumbRequests=new Map();
let thumbQueue=Promise.resolve(),textGesture=null;

function timelineContentEnd(){return Math.max(total(),...texts.map(t=>t.start+t.duration),...audios.map(a=>a.start+a.duration),0)}
function snapTextStart(value,duration,points,tolerance,maxEnd){
  const max=Math.max(0,maxEnd-duration);let result=Math.min(max,Math.max(0,value)),distance=tolerance;const proposed=result;
  for(const point of points){for(const candidate of [point,point-duration]){const delta=Math.abs(proposed-candidate);if(candidate>=0&&candidate<=max&&delta<distance){result=candidate;distance=delta}}}
  return Math.min(max,Math.max(0,Math.round(result*100)/100));
}

$('.timelineBody').insertAdjacentHTML('afterend',`<div class="timelineNavigator"><span class="panHelp">↔ Tarik area kosong · Gulir untuk geser</span><button id="timelineLeft" title="Geser timeline ke kiri" aria-label="Geser timeline ke kiri">‹</button><input id="timelinePan" type="range" min="0" max="0" value="0" step="1" aria-label="Geser posisi timeline"><button id="timelineRight" title="Geser timeline ke kanan" aria-label="Geser timeline ke kanan">›</button><span id="visibleTimeRange"></span></div>`);
$('.timeline').insertAdjacentHTML('afterbegin','<div id="timelineResize" role="separator" aria-label="Atur tinggi timeline" aria-orientation="horizontal" tabindex="0"><span></span></div>');
$('.timelineHint').textContent='Tarik teks untuk pindah · Shift+gulir: vertikal';

function syncTimelineNavigation(){
  const max=Math.max(0,timelineViewport.scrollWidth-timelineViewport.clientWidth),pan=$('#timelinePan');
  pan.max=Math.ceil(max);pan.value=Math.round(timelineViewport.scrollLeft);pan.disabled=max<1;
  $('#timelineLeft').disabled=timelineViewport.scrollLeft<1;$('#timelineRight').disabled=timelineViewport.scrollLeft>=max-1;
  $('#visibleTimeRange').textContent=fmt(timelineViewport.scrollLeft/zoom).slice(0,5)+' – '+fmt((timelineViewport.scrollLeft+timelineViewport.clientWidth)/zoom).slice(0,5);
  $('.trackLabels').scrollTop=timelineViewport.scrollTop;
}
timelineViewport.addEventListener('scroll',syncTimelineNavigation,{passive:true});
$('#timelinePan').oninput=e=>{timelineViewport.scrollLeft=Number(e.target.value)};
$('#timelineLeft').onclick=()=>timelineViewport.scrollBy({left:-timelineViewport.clientWidth*.7,behavior:'smooth'});
$('#timelineRight').onclick=()=>timelineViewport.scrollBy({left:timelineViewport.clientWidth*.7,behavior:'smooth'});
timelineViewport.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey)return;
  if(e.shiftKey){e.preventDefault();timelineViewport.scrollTop+=(e.deltaY||e.deltaX)*(e.deltaMode===1?18:1);return;}
  const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  if(timelineViewport.scrollWidth>timelineViewport.clientWidth){e.preventDefault();timelineViewport.scrollLeft+=delta*(e.deltaMode===1?18:1)}
},{passive:false});
new ResizeObserver(syncTimelineNavigation).observe(timelineViewport);

// Dragging an empty track pans both axes without moving any clips.
$('#tracks').addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1)return;
  if(e.target.closest('.clip,button,#ruler'))return;
  e.preventDefault();const x=e.clientX,y=e.clientY,left=timelineViewport.scrollLeft,top=timelineViewport.scrollTop;
  const move=ev=>{timelineViewport.scrollLeft=left+x-ev.clientX;timelineViewport.scrollTop=top+y-ev.clientY};
  const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);timelineViewport.classList.remove('panning')};
  timelineViewport.classList.add('panning');window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
});

function bindTextDrag(el,t){
  el.dataset.textId=t.id;el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`${t.kind==='subtitle'?'Subtitle':'Teks'} ${t.text}. Mulai ${t.start.toFixed(2)} detik. Tarik untuk memindahkan.`);
  el.title='Tarik untuk memindahkan waktu tampil · Tombol panah: 0,1 detik';el.style.touchAction='none';
  el.onclick=()=>{if(el.dataset.dragged==='true'){delete el.dataset.dragged;return}selected=t.id;renderTimeline();renderInspector();if(tab==='subtitles')renderLibrary()};
  el.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const start=Math.max(0,Math.min(Math.max(0,total()-t.duration),t.start+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1)));if(start===t.start)return;commit();t.start=Math.round(start*100)/100;selected=t.id;render();$('#textTrack').querySelector(`[data-text-id="${t.id}"]`)?.focus()};
  el.onpointerdown=e=>{
    if(e.button!==0||exporting)return;
    e.preventDefault();e.stopPropagation();pause();selected=t.id;renderInspector();
    $$('#textTrack .clip,#videoTrack .clip,#audioTrack .clip').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');
    const initial=t.start,startX=e.clientX,initialScroll=timelineViewport.scrollLeft,originalTime=time;
    const points=[0,time,...texts.filter(x=>x!==t).flatMap(x=>[x.start,x.start+x.duration]),...clips.map(clipStart),total()];
    const gesture={lastX:e.clientX,alt:e.altKey,moved:false,done:false};textGesture=gesture;
    const update=()=>{if(!gesture.moved)return;const delta=(gesture.lastX-startX+timelineViewport.scrollLeft-initialScroll)/zoom;t.start=snapTextStart(initial+delta,t.duration,gesture.alt?[]:points,7/zoom,total());el.style.left=t.start*zoom+'px';el.title='Mulai '+fmt(t.start);$('#dragTimeBadge').textContent=fmt(t.start);draw()};
    const autoScroll=()=>{if(gesture.done)return;if(gesture.moved){const rect=timelineViewport.getBoundingClientRect();if(gesture.lastX>rect.right-35)timelineViewport.scrollLeft+=Math.min(18,(gesture.lastX-rect.right+35)*.45);else if(gesture.lastX<rect.left+35)timelineViewport.scrollLeft-=Math.min(18,(rect.left+35-gesture.lastX)*.45);update()}requestAnimationFrame(autoScroll)};
    const move=ev=>{gesture.lastX=ev.clientX;gesture.alt=ev.altKey;if(!gesture.moved&&Math.abs(ev.clientX-startX)>3){commit();gesture.moved=true;el.classList.add('dragging');el.insertAdjacentHTML('beforeend','<span id="dragTimeBadge"></span>')}update()};
    const finish=ev=>{if(gesture.done)return;gesture.done=true;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);textGesture=null;if(gesture.moved){el.dataset.dragged='true';render();toast('Teks dipindah ke '+fmt(t.start))}else{renderTimeline();renderInspector()}};
    const cancel=()=>{if(gesture.moved){t.start=initial;undoStack.pop();time=originalTime}finish()};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);requestAnimationFrame(autoScroll);
  };
}

const previousTimeline=renderTimeline;
renderTimeline=function(){
  previousTimeline();
  const width=Math.max(30,timelineContentEnd()+5)*zoom;$('#tracks').style.width=Math.max(timelineViewport.clientWidth,width)+'px';
  const textElements=[...$('#textTrack').children];texts.forEach((t,i)=>{if(textElements[i])bindTextDrag(textElements[i],t)});
  fillFilmstrips();syncTimelineNavigation();
};
const previousWorkspaceDraw=draw;
draw=function(){previousWorkspaceDraw();if(playing&&!textGesture){const x=time*zoom;if(x>timelineViewport.scrollLeft+timelineViewport.clientWidth-45||x<timelineViewport.scrollLeft)timelineViewport.scrollLeft=Math.max(0,x-timelineViewport.clientWidth*.2)}};

function setTimelineHeight(height){const available=$('main').clientHeight,max=Math.max(190,available-180);$('.timeline').style.setProperty('--timeline-size',Math.min(max,Math.max(190,height))+'px');$('main').style.setProperty('--timeline-size',Math.min(max,Math.max(190,height))+'px')}
$('#timelineResize').onpointerdown=e=>{e.preventDefault();const initial=$('.timeline').getBoundingClientRect().height,y=e.clientY;const move=ev=>setTimelineHeight(initial+y-ev.clientY);const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end)};
$('#timelineResize').onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setTimelineHeight($('.timeline').clientHeight+(e.key==='ArrowUp'?25:-25))}};

function nearestThumbnail(frames,at){return frames.reduce((best,f)=>Math.abs(f.at-at)<Math.abs(best.at-at)?f:best,frames[0])}
function fillFilmstrips(){
  for(const c of clips){const asset=assets.find(a=>a.id===c.asset),el=$('#videoTrack').querySelector(`[data-id="${c.id}"]`),film=el?.querySelector('.film');if(!film||!asset)continue;
    const frames=asset.frames?.length?asset.frames:(asset.type==='image'&&asset.src?[{at:0,src:asset.src}]:[]);
    if(!frames.length){if(asset.type==='video'&&asset.src){film.innerHTML='<span class="thumbnailLoading">◌ Menyiapkan preview…</span>';requestThumbnails(asset)}continue}
    const count=Math.max(1,Math.ceil(c.duration*zoom/78));film.innerHTML=Array.from({length:count},(_,i)=>{const at=c.in+c.duration*c.speed*(i+.5)/count;return `<img class="filmFrame" src="${esc(nearestThumbnail(frames,at).src)}" alt="" draggable="false">`}).join('');
  }
}
function audioTracksForAsset(asset){
 if(asset.type!=='audio')return [];
 const matchingAssets=assets.filter(a=>a.type==='audio'&&a.name===asset.name);
 return audios.filter(a=>a.assetId===asset.id||(!a.assetId&&!a.extracted&&(
  (asset.src&&a.src===asset.src)||(!asset.src&&!a.src&&matchingAssets.length===1&&a.name===asset.name)
 )));
}

function confirmAssetRemoval(asset){
 if(!assets.includes(asset))return;
 const clipIds=new Set(clips.filter(c=>c.asset===asset.id).map(c=>c.id));
 const audioIds=new Set(audioTracksForAsset(asset).map(a=>a.id));
 const linkedCount=clipIds.size+audioIds.size;
 pause();
 modal(`<h2>Hapus media dari proyek?</h2><p>${esc(asset.name)}</p>
  <p>${linkedCount?`${linkedCount} klip yang menggunakan media ini juga akan dihapus dari timeline. `:''}File asli tetap ada di perangkat. Gunakan Urungkan jika ingin mengembalikannya.</p>
  <div class="actions"><button id="closeModal">Batal</button><button class="primary" id="confirmRemoveAsset">Hapus media</button></div>`);
 $('#confirmRemoveAsset').onclick=()=>{
  commit();
  assets=assets.filter(a=>a.id!==asset.id);
  clips=clips.filter(c=>!clipIds.has(c.id));
  audios=audios.filter(a=>!audioIds.has(a.id));
  if(clipIds.has(selected)||audioIds.has(selected))selected=clips[0]?.id;
  time=Math.min(time,total());
  $('#modal').close();
  render();
  toast('Media dihapus · Urungkan untuk mengembalikan');
 };
}

let selectedLibraryAsset=null;

function selectLibraryAsset(id){
 selectedLibraryAsset=id;
 for(const card of $$('#libraryContent [data-asset]')){
  const selected=card.dataset.asset===id;
  card.classList.toggle('assetSelected',selected);
  card.querySelector('.assetSelect')?.setAttribute('aria-pressed',String(selected));
 }
}

function bindAssetCard(card,thumb,asset){
 if(thumb.querySelector('.assetActions'))return;
 const selectButton=document.createElement('button');
 selectButton.type='button';
 selectButton.className='assetSelect';
 selectButton.setAttribute('aria-label','Pilih '+asset.name);
 const selected=selectedLibraryAsset===asset.id;
 selectButton.setAttribute('aria-pressed',String(selected));
 card.classList.toggle('assetSelected',selected);
 card.onclick=()=>selectLibraryAsset(asset.id);
 card.ondblclick=event=>{
  if(!event.target.closest('.assetActions'))addAsset(asset.id);
 };
 card.onkeydown=event=>{
  if(event.key==='Escape'&&selectedLibraryAsset===asset.id){
   selectLibraryAsset(null);
   selectButton.blur();
  }
  if(event.code==='Space'&&event.target.closest('button'))event.stopPropagation();
 };

 const actions=document.createElement('div');
 actions.className='assetActions';
 const controls=[
  ['assetAdd','Tambahkan ke timeline','M5 12h14M12 5v14',()=>addAsset(asset.id)],
  ['assetPreview','Pratinjau','M8 5l12 7-12 7z',()=>showAssetPreview(asset)],
  ['assetRemove','Hapus','M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7',()=>confirmAssetRemoval(asset)]
 ];
 for(const [className,label,path,action] of controls){
  const button=document.createElement('button');
  button.type='button';
  button.className=className;
  button.title=label+' '+asset.name;
  button.setAttribute('aria-label',button.title);
  button.innerHTML=`<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  button.onclick=event=>{event.stopPropagation();action()};
  actions.append(button);
 }
 thumb.append(selectButton,actions);
}

function populateAssetCards(){
  if(tab!=='media')return;
  for(const el of $$('[data-asset]')){const asset=assets.find(a=>a.id===el.dataset.asset);if(!asset)continue;const thumb=el.querySelector('.thumb'),poster=asset.frames?.[0]?.src||(asset.type==='image'?asset.src:null);
    if(poster){thumb.querySelector('img,.thumbnailLoading,.mediaFallback')?.remove();thumb.querySelector('span[style]')?.remove();const img=document.createElement('img');img.src=poster;img.alt=asset.name;img.draggable=false;thumb.prepend(img)}else if(asset.type==='video'&&asset.src){const placeholder=thumb.querySelector('.mediaFallback');if(placeholder){placeholder.className='thumbnailLoading';placeholder.removeAttribute('style');placeholder.textContent='◌ Menyiapkan preview…'}requestThumbnails(asset)}
    bindAssetCard(el,thumb,asset);
    const small=el.querySelector('small');if(small)small.textContent=({video:'Video',image:'Foto',audio:'Audio'}[asset.type]||'Media')+(asset.width?' · '+asset.width+' × '+asset.height:' · Lokal');
  }
}
function waitVideoEvent(video,event,action){return new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',fail)},done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(new Error('Preview tidak terbaca'))},timer=setTimeout(fail,15000);video.addEventListener(event,done,{once:true});video.addEventListener('error',fail,{once:true});action?.()})}
async function captureThumbnails(asset){
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  try{await waitVideoEvent(video,'loadeddata',()=>{video.src=asset.src;video.load()});if(!video.videoWidth)throw new Error('Video belum siap');asset.width=video.videoWidth;asset.height=video.videoHeight;
    const shot=document.createElement('canvas');const ratio=Math.min(320/video.videoWidth,180/video.videoHeight);shot.width=Math.max(1,Math.round(video.videoWidth*ratio));shot.height=Math.max(1,Math.round(video.videoHeight*ratio));const paint=shot.getContext('2d'),frames=[];
    const duration=Number.isFinite(video.duration)?video.duration:asset.duration;for(const fraction of [.08,.28,.5,.72,.92]){const at=Math.max(0,Math.min(duration-.03,duration*fraction));if(Math.abs(video.currentTime-at)>.01)await waitVideoEvent(video,'seeked',()=>{video.currentTime=at});paint.drawImage(video,0,0,shot.width,shot.height);frames.push({at,src:shot.toDataURL('image/jpeg',.72)})}
    asset.frames=frames;save();populateAssetCards();if(!textGesture)fillFilmstrips();
  }catch(error){console.warn('Thumbnail:',asset.name,error.message);$$('[data-asset]').filter(el=>el.dataset.asset===asset.id).forEach(el=>{const loading=el.querySelector('.thumbnailLoading');if(loading){loading.className='mediaFallback';loading.textContent='▶ Pratinjau video'}})}finally{video.pause();video.removeAttribute('src');video.load()}
}
function requestThumbnails(asset){if(asset.frames?.length||!asset.src)return;const key=asset.id+asset.src;if(thumbRequests.has(key))return;thumbRequests.set(key,true);thumbQueue=thumbQueue.then(()=>captureThumbnails(asset)).catch(console.warn)}
function showAssetPreview(asset){if(!asset.src)return toast('Impor ulang media untuk membuka pratinjau');pause();modal(`<h2>${esc(asset.name)}</h2><div class="assetPreviewStage">${asset.type==='video'?`<video id="assetPreviewVideo" src="${esc(asset.src)}" controls playsinline preload="auto" poster="${esc(asset.frames?.[0]?.src||'')}"></video>`:asset.type==='audio'?`<audio id="assetPreviewVideo" src="${esc(asset.src)}" controls preload="metadata"></audio>`:`<img src="${esc(asset.src)}" alt="${esc(asset.name)}">`}</div><p>${({video:'Video',image:'Foto',audio:'Audio'}[asset.type]||'Media')}${asset.width?' · '+asset.width+' × '+asset.height:''} · ${asset.duration.toFixed(1)} detik</p><div class="actions"><button id="closeModal">Tutup</button><button class="primary" id="addPreviewToTimeline">＋ Tambahkan ke timeline</button></div>`);$('#addPreviewToTimeline').onclick=()=>{$('#modal').close();addAsset(asset.id)}}
$('#modal').addEventListener('close',()=>{$('#assetPreviewVideo')?.pause()});
const previousMediaLibrary=renderLibrary;
renderLibrary=function(){previousMediaLibrary();populateAssetCards();for(const asset of assets){if(asset.type==='video')requestThumbnails(asset)}};
render();

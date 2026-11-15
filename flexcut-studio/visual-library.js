const transitionDescriptions={
 dissolve:'Campurkan dua klip secara halus.',black:'Rendam gambar lewat hitam.',white:'Rendam gambar lewat putih.',
 circleReveal:'Buka klip baru dari tengah.',radialWipe:'Sapuan melingkar.',diamondReveal:'Buka bentuk wajik.',
 pixelate:'Pecah gambar menjadi blok.',glitch:'Pergantian dengan gangguan digital.',blinds:'Buka beberapa bilah sekaligus.',
 mosaic:'Buka ubin secara berurutan.',ripple:'Gelombang melewati sambungan.',colorSplit:'Pisahkan rona saat berganti.'
};
const transitionGroups=['Dissolve','Sapuan','Gerak','Kreatif'];
const effectGroups=['Dasar','Warna','Buram','Kreatif','Gaya','Transformasi'];
const studioFilters={transition:{group:'Semua',query:''},effect:{group:'Semua',query:''}};
const transitionPicker=document.createElement('div');
transitionPicker.id='transitionPicker';
transitionPicker.hidden=true;
transitionPicker.setAttribute('role','dialog');
transitionPicker.setAttribute('aria-label','Pilih transisi klip');
document.body.append(transitionPicker);
let pickerAnchor=null;
const studioImageCache=new Map();

function studioThumbnail(clip){
 const asset=assets.find(item=>item.id===clip?.asset);
 return asset?.frames?.[0]?.src||(asset?.type==='image'&&asset.src)||'assets/coast.jpg';
}

function loadStudioThumbnail(url){
 if(!studioImageCache.has(url)){
  if(studioImageCache.size>=24)studioImageCache.delete(studioImageCache.keys().next().value);
  studioImageCache.set(url,new Promise(resolve=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>resolve(null);
   img.src=url;
  }));
 }
 return studioImageCache.get(url);
}

function sampleStudioFrame(img,{mirror=false}={}){
 const image=document.createElement('canvas');
 image.width=160;image.height=90;
 const g=image.getContext('2d');
 const shade=g.createLinearGradient(0,0,160,90);
 shade.addColorStop(0,mirror?'#595882':'#233a51');
 shade.addColorStop(1,mirror?'#524664':'#3f684a');
 g.fillStyle=shade;g.fillRect(0,0,160,90);
 if(img){
  const scale=Math.max(160/img.naturalWidth,90/img.naturalHeight);
  const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
  if(mirror){g.translate(160,0);g.scale(-1,1);g.filter='hue-rotate(35deg)'}
  g.drawImage(img,(160-width)/2,(90-height)/2,width,height);
 }
 return image;
}

async function bindStudioPreviews(root,kind,clip){
 const previous=precedingClip(clip);
 const before=studioThumbnail(previous||clip),after=studioThumbnail(clip);
 const [imgA,imgB]=await Promise.all([loadStudioThumbnail(before),loadStudioThumbnail(after)]);
 if(!root.isConnected)return;
 const a=sampleStudioFrame(imgA);
 const b=kind==='transition'?sampleStudioFrame(imgB,{mirror:before===after}):a;
 for(const card of root.querySelectorAll('[data-studio-id]')){
  const id=card.dataset.studioId,view=card.querySelector('canvas'),g=view.getContext('2d');
  const w=view.width,h=view.height;
  const paint=p=>{
   g.fillStyle='#101315';g.fillRect(0,0,w,h);
   if(kind==='transition'){drawStudioTransition(g,a,b,w,h,id,p);return}
   const style=visualEffects[id].style;
   g.save();
   if(style==='close-up'){g.translate(-w*.125,-h*.125);g.scale(1.25,1.25)}
   if(style==='rotate'){g.translate(w/2,h/2);g.rotate(Math.PI/2);g.translate(-w/2,-h/2)}
   if(style==='opacity')g.globalAlpha=.7;
   paintStudioEffect(g,a,0,0,w,h,id);
   g.restore();
  };
  paint(kind==='transition'?.42:1);
  if(kind!=='transition')continue;
  let animation=0;
  const stop=()=>{
   cancelAnimationFrame(animation);animation=0;
   paint(.42);
  };
  const start=()=>{
   if(animation||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const begin=performance.now();
   const tick=now=>{
    if(!card.isConnected||card.closest('[hidden]')){animation=0;return}
    paint(Math.min(1,Math.max(0,((now-begin)%1800-160)/1150)));
    animation=requestAnimationFrame(tick);
   };
   animation=requestAnimationFrame(tick);
  };
  card.addEventListener('pointerenter',start);
  card.addEventListener('pointerleave',stop);
  card.addEventListener('focus',start);
  card.addEventListener('blur',stop);
 }
}

function applyStudioTransition(clip,id,duration){
 if(!precedingClip(clip)){toast('Pilih sambungan atau klip kedua di timeline');return false}
 commit();
 clip.transition=id;
 clip.transitionDuration=duration;
 selected=clip.id;
 pause();
 time=clipStart(clip)+(id==='none'?0:transitionDuration(clip)*.45);
 render();
 toast(id==='none'?'Transisi dilepas':transitions[id][0]+' diterapkan');
 return true;
}

function applyStudioEffect(clip,id){
 if(!clip){toast('Pilih klip foto atau video di timeline');return}
 if(exporting||job)return;
 pause();
 if(time<clipStart(clip)||time>=clipStart(clip)+clip.duration)time=clipStart(clip);
 const pose=typeof keyframedItem==='function'?keyframedItem(clip,time-clipStart(clip)):clip;
 let changes;
 commit();
 if(id==='reset'){
  changes={scale:100,rotation:0,opacity:100,filter:'original',studioEffect:null,brightness:100,contrast:100,saturation:100};
 }else{
  const style=visualEffects[id].style;
  if(style==='close-up')changes={scale:125};
  else if(style==='rotate')changes={rotation:(pose.rotation+90)%360};
  else if(style==='opacity')changes={opacity:70};
  else changes={studioEffect:id};
 }
 if(typeof setTransformValues==='function')setTransformValues(clip,changes);
 else Object.assign(clip,changes);
 render();
 toast(id==='reset'?'Tampilan klip direset':visualEffects[id].name+' diterapkan');
}

function renderStudioLibrary(root,kind,clip,{popover=false}={}){
 const targetClip=()=>popover?clip:clips.find(item=>item.id===selected);
 const state=popover?{group:'Semua',query:''}:studioFilters[kind];
 const isTransition=kind==='transition';
 const shownClip=clip&&typeof keyframedItem==='function'?keyframedItem(clip,time-clipStart(clip)):clip;
 const entries=Object.values(isTransition?visualTransitionCatalog:visualEffects);
 const groups=isTransition?transitionGroups:effectGroups;
 const currentDuration=clip?.transitionDuration||.6;
 const durationOptions=[.3,.6,1,1.5];
 if(!durationOptions.includes(currentDuration))durationOptions.push(currentDuration);
 root.innerHTML=`
 <div class="studioGallery">
  ${popover?'<div class="studioPickerHeading"><strong>Transisi antar-klip</strong><button class="closeStudioPicker" aria-label="Tutup pilihan transisi">×</button></div>':''}
  <input class="studioSearch" type="search" aria-label="Cari ${isTransition?'transisi':'efek'}" placeholder="Cari ${isTransition?'transisi':'efek'}…">
  <div class="studioCategories" aria-label="Kategori">
   ${['Semua',...groups].map(group=>`<button type="button" data-studio-group="${group}">${group} ${group==='Semua'?entries.length:entries.filter(item=>item.group===group).length}</button>`).join('')}
  </div>
  <div class="studioCardList">
   ${groups.map(group=>`<section data-studio-section="${group}"><h3>${group}</h3><div class="studioCardGrid">
     ${entries.filter(item=>item.group===group).map(item=>`<button type="button" class="studioCard ${(isTransition?clip?.transition:shownClip?.studioEffect)===item.id?'chosen':''}" data-studio-id="${item.id}" aria-pressed="${(isTransition?clip?.transition:shownClip?.studioEffect)===item.id}">
      <canvas width="160" height="90" aria-hidden="true"></canvas><strong>${item.name}</strong>
      <small>${item.description||transitionDescriptions[item.id]||item.group}</small></button>`).join('')}
   </div></section>`).join('')}
  </div>
  <p class="featureNote studioNoResults" hidden>Pencarian tidak menemukan pilihan.</p>
  ${isTransition?`<div class="studioGalleryFooter">
   <label class="featureLabel">Durasi<select class="studioTransitionDuration">${durationOptions.map(n=>`<option value="${n}" ${n===currentDuration?'selected':''}>${String(n).replace('.',',')} detik</option>`).join('')}</select></label>
   <button class="studioRemoveTransition" ${clip?.transition&&clip.transition!=='none'?'':'disabled'}>Lepas transisi</button>
   ${popover?'':'<button class="studioApplyAll">Terapkan ke semua</button>'}
  </div>`:`<div class="studioGalleryFooter"><button class="studioResetEffect">Reset tampilan</button><button class="studioWatermark">Hapus watermark</button></div>`}
 </div>`;
 const gallery=root.querySelector('.studioGallery');
 const search=gallery.querySelector('.studioSearch');
 const duration=gallery.querySelector('.studioTransitionDuration');
 search.value=state.query;
 function filterCards(){
  const query=state.query.trim().toLowerCase();
  let found=0;
  for(const card of gallery.querySelectorAll('[data-studio-id]')){
   const item=entries.find(entry=>entry.id===card.dataset.studioId);
   const matches=(state.group==='Semua'||item.group===state.group)
     && (!query||[item.name,item.group,item.description,transitionDescriptions[item.id]].some(value=>value?.toLowerCase().includes(query)));
   card.hidden=!matches;
   if(matches)found++;
  }
  for(const section of gallery.querySelectorAll('[data-studio-section]'))section.hidden=!section.querySelector('.studioCard:not([hidden])');
  for(const button of gallery.querySelectorAll('[data-studio-group]')){
   button.setAttribute('aria-pressed',String(button.dataset.studioGroup===state.group));
  }
  gallery.querySelector('.studioNoResults').hidden=found!==0;
 }
 search.oninput=()=>{state.query=search.value;filterCards()};
 for(const button of gallery.querySelectorAll('[data-studio-group]'))button.onclick=()=>{state.group=button.dataset.studioGroup;filterCards()};
 for(const card of gallery.querySelectorAll('[data-studio-id]'))card.onclick=()=>{
  if(!isTransition){applyStudioEffect(targetClip(),card.dataset.studioId);return}
  const applied=applyStudioTransition(targetClip(),card.dataset.studioId,Number(duration.value));
  if(applied&&popover)closeStudioTransitionPicker(true);
 };
 gallery.onkeydown=event=>{if(event.code==='Space'&&event.target.closest('button'))event.stopPropagation()};
 if(isTransition){
  duration.onchange=()=>{
   const clip=targetClip();
   if(clip?.transition&&clip.transition!=='none'){
    applyStudioTransition(clip,clip.transition,Number(duration.value));
    if(popover)closeStudioTransitionPicker(true);
   }
  };
  gallery.querySelector('.studioRemoveTransition').onclick=()=>{
   if(applyStudioTransition(targetClip(),'none',Number(duration.value))&&popover)closeStudioTransitionPicker(true);
  };
  gallery.querySelector('.studioApplyAll')?.addEventListener('click',()=>{
   if(clips.length<2)return toast('Tambahkan minimal dua klip');
   const id=clip?.transition&&clip.transition!=='none'?clip.transition:'dissolve';
   const seconds=Number(duration.value);
   commit();
   for(const item of clips.filter(precedingClip)){item.transition=id;item.transitionDuration=seconds}
   render();toast('Transisi diterapkan ke semua sambungan');
  });
 }else{
  gallery.querySelector('.studioResetEffect').onclick=()=>applyStudioEffect(targetClip(),'reset');
  gallery.querySelector('.studioWatermark').onclick=()=>showWatermarkEditor(targetClip());
 }
 gallery.querySelector('.closeStudioPicker')?.addEventListener('click',()=>closeStudioTransitionPicker(true));
 filterCards();
 bindStudioPreviews(gallery,kind,clip);
}

function closeStudioTransitionPicker(restoreFocus=false){
 const anchor=pickerAnchor;
 pickerAnchor=null;
 transitionPicker.hidden=true;
 transitionPicker.replaceChildren();
 if(restoreFocus&&anchor){
  const button=$$('#tracks .studioTransitionMarker').find(el=>el.dataset.transitionClip===anchor.dataset.transitionClip);
  button?.focus();
 }
}

function showStudioTransitionPicker(clip,anchor){
 selected=clip.id;
 renderInspector();
 if(tab==='transitions')renderLibrary();
 pickerAnchor=anchor;
 transitionPicker.hidden=false;
 renderStudioLibrary(transitionPicker,'transition',clip,{popover:true});
 const rect=anchor.getBoundingClientRect();
 transitionPicker.style.left=Math.max(8,Math.min(innerWidth-transitionPicker.offsetWidth-8,rect.left-12))+'px';
 transitionPicker.style.top=Math.max(8,Math.min(innerHeight-transitionPicker.offsetHeight-8,rect.top-transitionPicker.offsetHeight-5))+'px';
 transitionPicker.querySelector('input').focus({preventScroll:true});
}

document.addEventListener('pointerdown',event=>{
 if(!transitionPicker.hidden&&!event.target.closest('#transitionPicker,.studioTransitionMarker'))closeStudioTransitionPicker();
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!transitionPicker.hidden){event.preventDefault();closeStudioTransitionPicker(true)}
});
timelineViewport.addEventListener('scroll',()=>{if(!transitionPicker.hidden)closeStudioTransitionPicker()},{passive:true});

const timelineBeforeStudio=renderTimeline;
renderTimeline=function(){
 timelineBeforeStudio();
 for(const clip of clips){
  if(precedingClip(clip)){
   const active=Boolean(clip.transition&&clip.transition!=='none');
   const button=document.createElement('button');
   button.type='button';
   button.className='transitionMark studioTransitionMarker'+(active?' hasTransition':'');
   button.dataset.transitionClip=clip.id;
   button.style.left=clipStart(clip)*zoom+'px';
   button.textContent=active?'⇄':'+';
   button.title=active?`Edit ${transitions[clip.transition]?.[0]||'transisi'}`:'Tambahkan transisi';
   button.setAttribute('aria-label',`${button.title} sebelum ${clip.name}`);
   button.onkeydown=event=>{if(event.code==='Space')event.stopPropagation()};
   button.onclick=()=>showStudioTransitionPicker(clip,button);
   timelineLane(itemTrack(clip,'video')).append(button);
  }
 }
};

const libraryBeforeStudio=renderLibrary;
renderLibrary=function(){
 if(!['transitions','effects'].includes(tab)){libraryBeforeStudio();return}
 const kind=tab==='transitions'?'transition':'effect';
 $('#libraryTitle').textContent=kind==='transition'?'Transisi':'Efek';
 $('#assetCount').textContent='';
 renderStudioLibrary($('#libraryContent'),kind,clips.find(c=>c.id===selected));
};
render();

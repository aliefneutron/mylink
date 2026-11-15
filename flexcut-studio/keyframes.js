const videoKeyframeDefaults={x:50,y:50,scale:100,rotation:0,opacity:100,brightness:100,contrast:100,saturation:100};
const textKeyframeDefaults={x:50,y:50,size:65,rotation:0,opacity:100};
const keyframeTolerance=1/60;
function keyframeDefaults(item){return typeof item.text==='string'?textKeyframeDefaults:videoKeyframeDefaults}
function discreteKeyframeDefaults(item){return typeof item.text==='string'?{}:{filter:'original',studioEffect:null}}
function keyframeSnapshot(item,changes={},local=keyframeLocalTime(item)){
 const pose=keyframedItem(item,local);
 const values=Object.fromEntries(Object.entries(keyframeDefaults(item)).map(([key,fallback])=>
  [key,changes[key]??pose[key]??fallback]));
 for(const [key,fallback] of Object.entries(discreteKeyframeDefaults(item))){
  values[key]=Object.hasOwn(changes,key)?changes[key]:pose[key]??fallback;
 }
 return values;
}
function keyframeLocalTime(item){return studioClamp(time-(clips.includes(item)?clipStart(item):item.start),0,item.duration)}
function itemKeyframes(item){
 const defaults=keyframeDefaults(item);
 return (Array.isArray(item.keyframes)?item.keyframes:[])
  .filter(frame=>Number.isFinite(frame.time)&&frame.values&&typeof frame.values==='object')
  .map(frame=>{
   const values=Object.fromEntries(Object.keys(defaults).map(key=>
    [key,Number.isFinite(frame.values[key])?frame.values[key]:item[key]??defaults[key]]));
   for(const [key,fallback] of Object.entries(discreteKeyframeDefaults(item))){
    values[key]=Object.hasOwn(frame.values,key)?frame.values[key]:item[key]??fallback;
   }
   return {...frame,values};
  })
  .sort((a,b)=>a.time-b.time);
}
function keyframedItem(item,local){
 const frames=itemKeyframes(item);
 if(!frames.length)return item;
 const defaults=keyframeDefaults(item),base={...defaults,...item};
 let left=frames[0],right=frames.at(-1);
 if(local<=left.time)return {...base,...left.values};
 if(local>=right.time)return {...base,...right.values};
 for(let i=1;i<frames.length;i++){
  if(local<frames[i].time){left=frames[i-1];right=frames[i];break}
 }
 let progress=(local-left.time)/(right.time-left.time);
 if(left.easing==='ease')progress=progress*progress*(3-2*progress);
 if(left.easing==='hold')progress=0;
 const values={};
 for(const key of Object.keys(defaults))values[key]=left.values[key]+(right.values[key]-left.values[key])*progress;
 for(const key of Object.keys(discreteKeyframeDefaults(item)))values[key]=(local>=right.time?right:left).values[key];
 return {...base,...values};
}
function saveItemKeyframe(item,values,local=keyframeLocalTime(item)){
 const frames=itemKeyframes(item),at=Math.round(local*30)/30;
 const existing=frames.find(frame=>Math.abs(frame.time-at)<keyframeTolerance);
 const snapshot=keyframeSnapshot(item,values,local);
 if(!frames.length&&at>keyframeTolerance){
  frames.push({time:0,values:keyframeSnapshot(item,{},0),easing:'hold'});
 }
 if(existing){existing.values=snapshot}
 else frames.push({time:at,values:snapshot,easing:'linear'});
 item.keyframes=frames.sort((a,b)=>a.time-b.time);
}
function setTransformValues(item,values){
 if(itemKeyframes(item).length)saveItemKeyframe(item,values);
 else Object.assign(item,values);
}
function trimItemKeyframes(item,original,from,to){
 const frames=itemKeyframes(original);
 if(!frames.length)return;
 const snapshot=at=>{
  return keyframeSnapshot(original,{},at);
 };
 const start={time:0,values:snapshot(from),easing:(frames.findLast(frame=>frame.time<=from)||frames[0]).easing||'linear'};
 const end={time:studioRound(to-from),values:snapshot(to),easing:'linear'};
 item.keyframes=[start,...frames.filter(frame=>frame.time>from+keyframeTolerance&&frame.time<to-keyframeTolerance)
  .map(frame=>({...frame,time:studioRound(frame.time-from),values:{...frame.values}})),end];
}

function renameTimelineTrack(track){
 track=timelineTracks.find(current=>current.id===track.id);
 if(!track)return;
 if(exporting||job)return;
 pause();
 modal('<h2>Ubah nama track</h2><label class="featureLabel">Nama track<input id="renameTrackValue" maxlength="80" value="'+esc(track.name)+'"></label>'+
  '<div class="actions"><button id="closeModal">Batal</button><button id="saveTrackName" class="primary">Simpan</button></div>');
 const saveName=()=>{
  const name=$('#renameTrackValue').value.trim();
  if(!name)return $('#renameTrackValue').focus();
  commit();track.name=name;$('#modal').close();render();
 };
 $('#saveTrackName').onclick=saveName;
 $('#renameTrackValue').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();saveName()}};
 $('#renameTrackValue').focus();$('#renameTrackValue').select();
}
function timelineItemName(item){
 if(item.name)return item.name;
 return item.kind==='subtitle'?'Subtitle':typeof item.text==='string'?'Judul':'Klip';
}
let lastTimelineNameTap=null;
function finishTimelineTap(item,event){
 const now=performance.now();
 const previous=lastTimelineNameTap;
 lastTimelineNameTap={id:item.id,time:now,x:event.clientX,y:event.clientY};
 if(previous?.id===item.id&&now-previous.time<450&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<8){
  lastTimelineNameTap=null;
  renameEditorItem(item);
 }
}
function renameEditorItem(item){
 if(exporting||job)return;
 pause();selected=item.id;renderInspector();
 modal('<h2>Ubah nama klip</h2><label class="featureLabel">Nama di timeline<input id="renameClipValue" maxlength="100" value="'+esc(timelineItemName(item))+'"></label>'+
  '<div class="actions"><button id="closeModal">Batal</button><button id="saveClipName" class="primary">Simpan</button></div>');
 const saveName=()=>{
  const name=$('#renameClipValue').value.trim();
  if(!name)return $('#renameClipValue').focus();
  commit();item.name=name;$('#modal').close();render();
 };
 $('#saveClipName').onclick=saveName;
 $('#renameClipValue').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();saveName()}};
 $('#renameClipValue').focus();$('#renameClipValue').select();
}

const timelineBeforeKeyframes=renderTimeline;
renderTimeline=function(){
 timelineBeforeKeyframes();
 for(const element of $$('#tracks .clip')){
  const item=[...clips,...texts,...audios].find(row=>row.id===element.dataset.id);
  if(!item)continue;
  element.ondblclick=event=>{
   if(event.target.closest('.timelineTrimHandle,.itemKeyframeMarker'))return;
   event.preventDefault();event.stopPropagation();renameEditorItem(item);
  };
  for(const frame of itemKeyframes(item).filter(frame=>frame.time>=0&&frame.time<=item.duration)){
   const marker=document.createElement('button');
   marker.type='button';marker.className='itemKeyframeMarker';
   marker.style.left=studioClamp(frame.time/item.duration*100,1,99)+'%';
   marker.dataset.keyframeTime=frame.time;
   marker.title='Keyframe · '+fmt(frame.time);
   marker.setAttribute('aria-label',marker.title);
   marker.onpointerdown=event=>{event.preventDefault();event.stopPropagation()};
   marker.onclick=event=>{
    event.preventDefault();event.stopPropagation();pause();selected=item.id;
    time=item.start+frame.time;renderInspector();draw();
   };
   element.append(marker);
  }
 }
};

function currentKeyframeItem(){return [...clips,...texts].find(item=>item.id===selected)}
function toggleEditorKeyframe(item=currentKeyframeItem()){
 if(!item||exporting||job)return;
 pause();
 const local=keyframeLocalTime(item),frames=itemKeyframes(item);
 time=item.start+local;
 const existing=frames.find(frame=>Math.abs(frame.time-local)<keyframeTolerance);
 const pose=keyframeSnapshot(item,{},local);
 commit();
 if(existing){
  item.keyframes=frames.filter(frame=>frame!==existing);
  if(!item.keyframes.length)Object.assign(item,pose);
 }else saveItemKeyframe(item,{},local);
 render();
}
const quickKeyframeButton=document.createElement('button');
quickKeyframeButton.type='button';quickKeyframeButton.id='timelineKeyframe';
quickKeyframeButton.title='Tambah atau hapus keyframe pada playhead';
quickKeyframeButton.setAttribute('aria-label',quickKeyframeButton.title);
quickKeyframeButton.innerHTML=editorIcon('diamond',17);
quickKeyframeButton.onclick=()=>toggleEditorKeyframe();
addTrackButton.before(quickKeyframeButton);
const clearTimelineButton=document.createElement('button');
clearTimelineButton.type='button';clearTimelineButton.id='clearTimeline';
clearTimelineButton.title='Kosongkan seluruh timeline';
clearTimelineButton.setAttribute('aria-label',clearTimelineButton.title);
clearTimelineButton.innerHTML=editorIcon('list-x',17);
quickKeyframeButton.after(clearTimelineButton);
clearTimelineButton.onclick=()=>{
 if(exporting||job)return;
 pause();
 modal('<h2>Kosongkan seluruh timeline?</h2><p>Semua video, gambar, teks, subtitle, dan audio pada timeline akan dihapus. Media proyek tetap tersedia. Anda dapat memakai Urungkan untuk mengembalikannya.</p>'+
  '<div class="actions"><button id="closeModal">Batal</button><button class="primary" id="confirmClearTimeline">Kosongkan timeline</button></div>');
 $('#confirmClearTimeline').onclick=()=>{
  if(exporting||job)return;
  pause();commit();
  for(const element of media.values())element.pause();
  clips=[];texts=[];audios=[];selected=null;activeTimelineTrack=null;time=0;
  timelineTracks=defaultTimelineTracks();trackStates={};
  timelineViewport.scrollLeft=timelineViewport.scrollTop=0;
  $('#modal').close();render();toast('Timeline dikosongkan');
 };
};
function syncKeyframeInspector(){
 const item=currentKeyframeItem();
 const local=item?keyframeLocalTime(item):0,frames=item?itemKeyframes(item):[];
 const exact=frames.find(frame=>Math.abs(frame.time-local)<keyframeTolerance);
 quickKeyframeButton.disabled=!item||exporting||Boolean(job);
 quickKeyframeButton.classList.toggle('active',Boolean(exact));
 quickKeyframeButton.setAttribute('aria-pressed',String(Boolean(exact)));
 clearTimelineButton.disabled=exporting||Boolean(job)||![...clips,...texts,...audios].length;
 if(!item||!$('#itemKeyframeTime'))return;
 $('#itemKeyframeTime').textContent=fmt(local);
 if($('#itemKeyframeFrame')!==document.activeElement)$('#itemKeyframeFrame').value=Math.round(local*30);
 const toggle=$('#toggleItemKeyframe');
 toggle.classList.toggle('active',Boolean(exact));
 toggle.setAttribute('aria-label',exact?'Hapus keyframe saat ini':'Tambah keyframe');
 toggle.title=toggle.getAttribute('aria-label');
 $('#prevItemKeyframe').disabled=!frames.some(frame=>frame.time<local-keyframeTolerance);
 $('#nextItemKeyframe').disabled=!frames.some(frame=>frame.time>local+keyframeTolerance);
 $('#itemKeyframeEasing').disabled=!exact;
 $('#itemKeyframeEasing').value=exact?.easing||'linear';
 const pose=keyframedItem(item,local);
 for(const [key,input] of Object.entries({
  x:$('#freeMediaX')||$('[data-prop="x"]'),y:$('#freeMediaY')||$('[data-prop="y"]'),
  scale:$('[data-prop="scale"]'),size:$('[data-prop="size"]'),rotation:$('[data-prop="rotation"]'),
  opacity:$('[data-prop="opacity"]')||$('#keyframeTextOpacity'),
  brightness:$('[data-prop="brightness"]'),contrast:$('[data-prop="contrast"]'),saturation:$('[data-prop="saturation"]')
 })){
  if(input&&input!==document.activeElement)input.value=studioRound(pose[key]??keyframeDefaults(item)[key]??0);
 }
}

const inspectorBeforeKeyframes=renderInspector;
renderInspector=function(){
 inspectorBeforeKeyframes();
 const item=[...clips,...texts,...audios].find(row=>row.id===selected);
 if(!item)return;
 const name=document.createElement('label');
 name.className='featureLabel clipNameField';
 name.innerHTML='Nama klip<input id="editorClipName" maxlength="100" value="'+esc(timelineItemName(item))+'">';
 $('#inspectorContent').prepend(name);
 $('#editorClipName').onchange=event=>{
  const value=event.target.value.trim();
  if(!value){event.target.value=timelineItemName(item);return}
  if(value===item.name)return;
  commit();item.name=value;renderTimeline();save();
 };
 if(audios.includes(item))return;
 const panel=document.createElement('section');panel.className='propertySection keyframePanel';
 panel.innerHTML='<h3>Keyframe</h3><div class="keyframeActions">'+
  '<button type="button" id="prevItemKeyframe" aria-label="Keyframe sebelumnya">'+editorIcon('chevron-left',15)+'</button>'+
  '<button type="button" id="toggleItemKeyframe" aria-label="Tambah keyframe">'+editorIcon('diamond',17)+'</button>'+
  '<button type="button" id="nextItemKeyframe" aria-label="Keyframe berikutnya">'+editorIcon('chevron-right',15)+'</button>'+
  '<output id="itemKeyframeTime">00:00.00</output></div>'+
  '<label class="featureLabel">Interpolasi<select id="itemKeyframeEasing"><option value="linear">Linier</option><option value="ease">Halus</option><option value="hold">Tahan</option></select></label>'+
  '<label class="featureLabel">Frame lokal · 30 fps<input id="itemKeyframeFrame" type="number" min="0" max="'+Math.floor(item.duration*30)+'" step="1"></label>'+
  '<p class="featureNote">Atur frame, tambah keyframe, lalu ubah zoom atau efek. Pilih Tahan untuk pergantian tepat pada keyframe berikutnya.</p>'+
  (texts.includes(item)?field('Rotasi (°)','rotation',item.rotation||0,-360,360)+
   '<label class="featureLabel">Opasitas (%)<input id="keyframeTextOpacity" type="range" min="0" max="100" step="1" value="'+(item.opacity??100)+'"></label>':'');
 name.after(panel);
 $('#toggleItemKeyframe').onclick=()=>toggleEditorKeyframe(item);
 $('#itemKeyframeFrame').onchange=event=>{
  const frame=Number(event.target.value);
  if(!Number.isFinite(frame)||frame<0||frame>Math.floor(item.duration*30))return syncKeyframeInspector();
  pause();time=item.start+Math.round(frame)/30;draw();
 };
 for(const [id,direction] of [['prevItemKeyframe',-1],['nextItemKeyframe',1]]){
  $('#'+id).onclick=()=>{
   pause();const local=keyframeLocalTime(item);
   const frames=itemKeyframes(item).filter(frame=>direction<0?frame.time<local-keyframeTolerance:frame.time>local+keyframeTolerance);
   const frame=direction<0?frames.at(-1):frames[0];
   if(frame){time=item.start+frame.time;draw()}
  };
 }
 $('#itemKeyframeEasing').onchange=event=>{
  const local=keyframeLocalTime(item),frames=itemKeyframes(item);
  const exact=frames.find(frame=>Math.abs(frame.time-local)<keyframeTolerance);
  if(!exact)return;
  commit();exact.easing=event.target.value;item.keyframes=frames;render();
 };
 const defaults=keyframeDefaults(item);
 const inputs=$$('[data-prop]').filter(input=>Object.hasOwn(defaults,input.dataset.prop));
 if($('#keyframeTextOpacity'))inputs.push($('#keyframeTextOpacity'));
 for(const input of inputs){
  const key=input.dataset.prop||'opacity';
  input.onchange=event=>{
   if(exporting||job)return;
   const value=Number(event.target.value);
   if(!Number.isFinite(value))return;
   pause();commit();
   setTransformValues(item,{[key]:studioClamp(value,Number(input.min),Number(input.max))});
   render();
  };
 }
 const filterInput=$('[data-prop="filter"]');
 if(filterInput)filterInput.onchange=event=>{
  pause();commit();setTransformValues(item,{filter:event.target.value});render();
 };
 if(clips.includes(item)){
  for(const [id,delta] of [['rotateLeft',-90],['rotateRight',90],['resetScale',0]]){
   const button=$('#'+id);
   if(!button)continue;
   const replacement=button.cloneNode(true);
   button.replaceWith(replacement);
   replacement.onclick=()=>{
    if(exporting||job)return;
    pause();commit();
    const pose=keyframedItem(item,keyframeLocalTime(item));
    setTransformValues(item,id==='resetScale'?{x:50,y:50,scale:100,rotation:0}:{rotation:pose.rotation+delta});
    render();
   };
  }
 }
 syncKeyframeInspector();
};

const boundsBeforeKeyframes=studioTextBounds;
studioTextBounds=function(item){return boundsBeforeKeyframes(keyframedItem(item,time-item.start))};
const drawBeforeKeyframes=draw;
draw=function(){drawBeforeKeyframes();syncKeyframeInspector()};
render();

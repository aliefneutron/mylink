// Shared controls for the spatial and timeline position of every editor item.
const mediaSelection=document.createElement('div');
mediaSelection.className='mediaPreviewSelection';
mediaSelection.hidden=true;
mediaSelection.innerHTML=['nw','ne','sw','se'].map(corner=>
 '<button type="button" class="mediaScale '+corner+'" aria-label="Ubah ukuran video atau gambar"></button>').join('');
previewBox.append(mediaSelection);

function mediaPreviewBounds(clip){
 const asset=assets.find(a=>a.id===clip.asset);
 const source=asset?.type==='video'?clipVideo(clip):asset?.src?getImage(asset):null;
 const sw=source?.videoWidth||source?.naturalWidth,sh=source?.videoHeight||source?.naturalHeight;
 if(!sw||!sh)return null;
 const factor=mediaFitScale(sw,sh,canvas.width,canvas.height,clip.rotation,clip.fit||'contain')*clip.scale/100;
 return {x:clip.x??50,y:clip.y??50,width:sw*factor,height:sh*factor};
}
function syncMediaSelection(){
 const clip=clips.find(c=>c.id===selected);
 const bounds=clip&&activeVideoLayers().some(row=>row.c===clip)&&mediaPreviewBounds(clip);
 mediaSelection.hidden=Boolean(playing||exporting||!bounds);
 if(mediaSelection.hidden)return;
 Object.assign(mediaSelection.style,{
  left:bounds.x+'%',top:bounds.y+'%',width:bounds.width/canvas.width*100+'%',
  height:bounds.height/canvas.height*100+'%',transform:'translate(-50%,-50%) rotate('+clip.rotation+'deg)'
 });
}
function beginMediaTransform(event,clip,resize=false){
 if(event.button!==0||playing||exporting||job)return;
 event.preventDefault();event.stopPropagation();
 const rect=canvas.getBoundingClientRect(),original={x:clip.x,y:clip.y,scale:clip.scale};
 const point={x:event.clientX,y:event.clientY};
 const center={x:rect.left+rect.width*(clip.x??50)/100,y:rect.top+rect.height*(clip.y??50)/100};
 const radius=Math.max(8,Math.hypot(point.x-center.x,point.y-center.y));
 selected=clip.id;activeTimelineTrack=itemTrack(clip,'video');renderTimeline();renderInspector();
 let changed=false;
 const move=ev=>{
  if(ev.pointerId!==event.pointerId)return;
  const dx=ev.clientX-point.x,dy=ev.clientY-point.y;
  if(!changed&&Math.hypot(dx,dy)<2)return;
  if(!changed){commit();changed=true}
  if(resize)clip.scale=studioRound(studioClamp(original.scale*Math.hypot(ev.clientX-center.x,ev.clientY-center.y)/radius,5,500));
  else{
   clip.x=studioRound(studioClamp((original.x??50)+dx/rect.width*100,-100,200));
   clip.y=studioRound(studioClamp((original.y??50)+dy/rect.height*100,-100,200));
  }
  draw();
 };
 const finish=ev=>{
  if(ev.pointerId!==event.pointerId)return;
  window.removeEventListener('pointermove',move);
  window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);
  if(changed&&ev.type==='pointercancel'){Object.assign(clip,original);undoStack.pop()}
  render();
 };
 window.addEventListener('pointermove',move);
 window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
}
mediaSelection.querySelectorAll('button').forEach(button=>button.onpointerdown=event=>{
 const clip=clips.find(c=>c.id===selected);
 if(clip)beginMediaTransform(event,clip,true);
});
canvas.addEventListener('pointerdown',event=>{
 if(event.defaultPrevented||playing||exporting||event.button!==0)return;
 const rect=canvas.getBoundingClientRect();
 const x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height;
 const hit=activeVideoLayers().reverse().find(({c})=>{
  const b=mediaPreviewBounds(c);
  if(!b)return false;
  const angle=-c.rotation*Math.PI/180,dx=x-b.x*canvas.width/100,dy=y-b.y*canvas.height/100;
  return Math.abs(dx*Math.cos(angle)-dy*Math.sin(angle))<=b.width/2&&Math.abs(dx*Math.sin(angle)+dy*Math.cos(angle))<=b.height/2;
 });
 if(hit)beginMediaTransform(event,hit.c);
});
const drawBeforeFreeEditing=draw;
draw=function(){drawBeforeFreeEditing();syncMediaSelection()};

function timelineItemType(item){return clips.includes(item)?'video':texts.includes(item)?'text':'audio'}
function timelineSourceLimit(item,type){
 const asset=assets.find(a=>a.id===(type==='video'?item.asset:item.assetId));
 if(type==='text'||asset?.type==='image'||item.autoScene)return Infinity;
 const source=type==='video'?asset?.duration:item.sourceDuration||asset?.duration;
 return Number.isFinite(source)&&source>0?source:Infinity;
}
function timelineEditValues(item,type,original,mode,delta,anchors,alt){
 const start=original.start,end=start+original.duration,speed=original.speed||1;
 const snap=value=>{
  if(alt)return value;
  let closest=value,distance=Math.min(.5,7/zoom);
  for(const anchor of anchors){
   const candidate=Math.abs(anchor-value);
   if(candidate<distance){closest=anchor;distance=candidate}
  }
  return closest;
 };
 const sourceLimit=timelineSourceLimit(item,type);
 const bounded=Number.isFinite(sourceLimit);
 const sourceIn=original.in||0;
 if(mode==='move'){
  let position=Math.max(0,start+delta);
  const left=snap(position),right=snap(position+original.duration)-original.duration;
  position=Math.abs(left-position)<=Math.abs(right-position)?left:right;
  return {start:studioRound(Math.max(0,position)),duration:original.duration,in:original.in};
 }
 if(mode==='start'){
  const earliest=bounded?Math.max(0,start-sourceIn/speed):0;
  const position=studioClamp(snap(start+delta),earliest,end-.1);
  return {start:studioRound(position),duration:studioRound(end-position),
   in:type==='text'?original.in:Math.max(0,studioRound(sourceIn+(position-start)*speed))};
 }
 const maxEnd=bounded?start+(sourceLimit-sourceIn)/speed:36000;
 const position=studioClamp(snap(end+delta),start+.1,maxEnd);
 return {start,duration:studioRound(position-start),in:original.in};
}
function bindFreeTimelineItem(element,item,type){
 element.draggable=false;
 element.onkeydown=event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key)||event.target!==element)return;
  event.preventDefault();event.stopPropagation();
  if(exporting||job)return;
  commit();item.start=studioRound(Math.max(0,item.start+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?1:.1)));
  selected=item.id;render();
  $$('#tracks .clip').find(el=>el.dataset.id===item.id)?.focus();
 };
 element.tabIndex=0;
 element.style.touchAction='none';
 element.querySelectorAll('.textTrimHandle').forEach(handle=>handle.remove());
 const begin=(event,mode)=>{
  if(event.button!==0||exporting||job)return;
  event.preventDefault();event.stopPropagation();pause();
  const original={...item,start:type==='video'?clipStart(item):item.start};
  const originalTime=time,originX=event.clientX,originY=event.clientY,initialScroll=timelineViewport.scrollLeft;
  const lane=element.parentElement;
  const initialVertical=timelineViewport.scrollTop;
  const anchors=[0,time,...[...clips,...texts,...audios].filter(other=>other!==item)
   .flatMap(other=>{const start=clips.includes(other)?clipStart(other):other.start;return [start,start+other.duration]})];
  selected=item.id;activeTimelineTrack=itemTrack(item,type);renderInspector();
  const badge=document.createElement('span');badge.className='timelineEditBadge';element.append(badge);
  let changed=false,lastX=originX,lastY=originY,alt=event.altKey,raf=0,targetTrack=null;
  const update=()=>{
   if(!changed)return;
   const delta=(lastX-originX+timelineViewport.scrollLeft-initialScroll)/zoom;
   const values=timelineEditValues(item,type,original,mode,delta,anchors,alt);
   Object.assign(item,values);
   if(type==='text'&&mode==='start'&&original.words)applyTextTrim(item,original,{start:values.start,duration:values.duration});
   element.style.left=item.start*zoom+'px';sizeTimelineClip(element,item.duration);
   element.style.zIndex='12';
   const required=Math.max(total()*zoom+200,timelineViewport.clientWidth);
   laneList.style.width=required+'px';
   if(mode==='move'){
    targetTrack=timelineTracks.find(track=>{
     if(track.type!==type)return false;
     const box=timelineLane(track.id).getBoundingClientRect();
     return lastY>=box.top&&lastY<=box.bottom;
    });
    element.style.transform='translateY('+(lastY-originY+timelineViewport.scrollTop-initialVertical)+'px)';
    $$('#tracks .track').forEach(track=>track.classList.toggle('timelineDropTarget',track.dataset.trackLane===targetTrack?.id));
   }
   badge.textContent=fmt(item.start)+' – '+fmt(item.start+item.duration);
   draw();
  };
  const move=ev=>{
   if(ev.pointerId!==event.pointerId)return;
   lastX=ev.clientX;lastY=ev.clientY;alt=ev.altKey;
   if(!changed&&Math.hypot(lastX-originX,lastY-originY)>=3){commit();changed=true;element.classList.add('dragging')}
   update();
  };
  const scroll=()=>{
   if(changed){
    const box=timelineViewport.getBoundingClientRect();
    if(lastX>box.right-28)timelineViewport.scrollLeft+=14;
    else if(lastX<box.left+28)timelineViewport.scrollLeft-=14;
    if(mode==='move'&&lastY>box.bottom-22)timelineViewport.scrollTop+=10;
    else if(mode==='move'&&lastY<box.top+40)timelineViewport.scrollTop-=10;
    update();
   }
   raf=requestAnimationFrame(scroll);
  };
  const finish=ev=>{
   if(ev.pointerId!==event.pointerId)return;
   cancelAnimationFrame(raf);
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);
   if(changed&&ev.type==='pointercancel'){
    Object.assign(item,original);time=originalTime;undoStack.pop();
   }else if(changed&&mode==='move'&&targetTrack){item.trackId=targetTrack.id;activeTimelineTrack=targetTrack.id}
   $$('#tracks .timelineDropTarget').forEach(track=>track.classList.remove('timelineDropTarget'));
   if(mode!=='move'&&type==='text')time=item.start;
   render();
  };
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
  raf=requestAnimationFrame(scroll);
 };
 element.onpointerdown=event=>{if(!event.target.closest('.timelineTrimHandle,.transitionJunction'))begin(event,'move')};
 element.onclick=event=>{
  if(event.target.closest('.timelineTrimHandle'))return;
  selected=item.id;activeTimelineTrack=itemTrack(item,type);
  time=item.start;renderTimeline();renderInspector();draw();
 };
 for(const side of ['start','end']){
  const handle=document.createElement('button');
  handle.type='button';handle.className='timelineTrimHandle timelineTrim-'+side;
  handle.setAttribute('aria-label',side==='start'?'Atur waktu mulai klip':'Atur waktu selesai klip');
  handle.onpointerdown=event=>begin(event,side);
  handle.onclick=event=>{event.preventDefault();event.stopPropagation()};
  element.append(handle);
 }
}
const timelineBeforeFreeEditing=renderTimeline;
renderTimeline=function(){
 timelineBeforeFreeEditing();
 for(const element of $$('#tracks .clip')){
  const item=[...clips,...texts,...audios].find(row=>row.id===element.dataset.id);
  if(item)bindFreeTimelineItem(element,item,timelineItemType(item));
 }
};

const inspectorBeforeFreeEditing=renderInspector;
renderInspector=function(){
 inspectorBeforeFreeEditing();
 const item=[...clips,...texts,...audios].find(row=>row.id===selected);
 if(!item)return;
 const type=timelineItemType(item),section=document.createElement('div');
 section.className='propertySection';
 section.innerHTML='<h3>Posisi di timeline</h3><label class="featureLabel">Mulai (detik)<input id="freeItemStart" type="number" min="0" max="36000" step="0.01" value="'+item.start+'"></label>'+
  '<label class="featureLabel">Selesai (detik)<input id="freeItemEnd" type="number" min="0.1" max="36000" step="0.01" value="'+studioRound(item.start+item.duration)+'"></label>';
 if(type==='video')section.insertAdjacentHTML('beforeend',
  '<label class="featureLabel">Posisi horizontal (%)<input id="freeMediaX" type="number" min="-100" max="200" step="0.1" value="'+(item.x??50)+'"></label>'+
  '<label class="featureLabel">Posisi vertikal (%)<input id="freeMediaY" type="number" min="-100" max="200" step="0.1" value="'+(item.y??50)+'"></label>');
 $('#inspectorContent').prepend(section);
 $('#freeItemStart').onchange=event=>{
  const start=Number(event.target.value);
  if(!Number.isFinite(start)||start<0||start>36000)return renderInspector();
  commit();item.start=studioRound(start);time=item.start;render();
 };
 $('#freeItemEnd').onchange=event=>{
  const end=Number(event.target.value);
  if(!Number.isFinite(end)||end<item.start+.1||end>36000)return renderInspector();
  const original={...item};
  const values=timelineEditValues(item,type,original,'end',end-item.start-item.duration,[],true);
  commit();Object.assign(item,values);render();
 };
 for(const [id,key] of [['freeMediaX','x'],['freeMediaY','y']]){
  const input=$('#'+id);
  if(input)input.onchange=event=>{
   const value=Number(event.target.value);
   if(!Number.isFinite(value))return renderInspector();
   commit();item[key]=studioClamp(value,-100,200);render();
  };
 }
};
for(const track of timelineTracks.filter(t=>t.type==='text')){
 const group=texts.filter(t=>itemTrack(t,'text')===track.id);
 if(group.some(t=>t.kind!=='subtitle')&&group.some(t=>t.kind==='subtitle')){
  const id=textInsertionTrack('subtitle');
  group.filter(t=>t.kind==='subtitle').forEach(t=>t.trackId=id);
 }
}
$('.timelineHint').textContent='Tarik klip untuk pindah · Tarik ujung untuk pangkas · Alt untuk lepas snap';
render();

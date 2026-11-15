/* Selection handles live in the DOM so they stay out of exported frames. */
const textPreviewSelection=document.createElement('div');
textPreviewSelection.className='textPreviewSelection';
textPreviewSelection.hidden=true;
textPreviewSelection.innerHTML='<button class="textPreviewMove" aria-label="Geser teks di video" title="Tarik untuk memindahkan teks"></button><button class="textPreviewScale" aria-label="Ubah ukuran teks" title="Tarik sudut untuk mengubah ukuran teks"></button>';
previewBox.append(textPreviewSelection);
const moveTextButton=textPreviewSelection.querySelector('.textPreviewMove');
const scaleTextButton=textPreviewSelection.querySelector('.textPreviewScale');
let previewTextGesture=null;

function studioClamp(value,min,max){return Math.min(max,Math.max(min,value))}
function studioRound(value){return Math.round(value*100)/100}
function visibleStudioText(text){return trackVisible(itemTrack(text,'text'))&&time>=text.start&&time<text.start+text.duration&&Boolean(text.text.trim())}

function studioTextBounds(text){
 const w=canvas.width,h=canvas.height,isCaption=text.kind==='subtitle';
 const style=isCaption?captionStyles[text.template]||captionStyles.clean:null;
 const size=text.size*w/1280, lineHeight=size*(isCaption?1.3:1.2);
 ctx.save();
 ctx.font=`${text.weight||style?.weight||500} ${size}px "${text.font||style?.font||'Georgia'}",${isCaption?'sans-serif':'serif'}`;
 let lines=isCaption?wrapCaption(text.text,w*.86):text.text.split('\n');
 if(style?.animation==='word'){
  const {words,index}=activeCaptionWord(text);
  lines=[words[index]?.text||text.text];
 }
 const measured=lines.map(line=>ctx.measureText(line).width);
 ctx.restore();
 const padding=style?.bg?18*w/1280:5;
 const width=Math.max(18,Math.min(w*.9,Math.max(0,...measured))+padding*2);
 const height=Math.max(18,lineHeight*Math.max(1,lines.length)+10);
 const x=w*(text.x??50)/100,y=h*text.y/100;
 return {left:x-width/2,top:(isCaption?y:y+(Math.max(1,lines.length)-1)*lineHeight/2)-height/2,width,height};
}

function syncPreviewTextSelection(){
 const text=texts.find(item=>item.id===selected);
 if(exporting||playing||!text||!visibleStudioText(text)){
  textPreviewSelection.hidden=true;return;
 }
 const box=studioTextBounds(text);
 Object.assign(textPreviewSelection.style,{
  left:box.left/canvas.width*100+'%',top:box.top/canvas.height*100+'%',
  width:box.width/canvas.width*100+'%',height:box.height/canvas.height*100+'%'
 });
 textPreviewSelection.hidden=false;
}

function startPreviewTextGesture(event,text,mode){
 if(event.button!==0||exporting||playing||previewTextGesture)return;
 event.preventDefault();event.stopPropagation();
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 if(selected!==text.id){selected=text.id;renderTimeline();renderInspector()}
 const original={x:text.x,y:text.y,size:text.size};
 const start={x:event.clientX,y:event.clientY};
 const centerX=rect.left+rect.width*(text.x??50)/100;
 const centerY=rect.top+rect.height*text.y/100;
 const radius=Math.max(10,Math.hypot(start.x-centerX,start.y-centerY));
 let changed=false;
 previewTextGesture=event.pointerId;
 const move=ev=>{
  if(ev.pointerId!==previewTextGesture)return;
  const dx=ev.clientX-start.x,dy=ev.clientY-start.y;
  if(!changed&&Math.hypot(dx,dy)<2)return;
  if(!changed){commit();changed=true}
  if(mode==='move'){
   text.x=studioRound(studioClamp((original.x??50)+dx/rect.width*100,1,99));
   text.y=studioRound(studioClamp(original.y+dy/rect.height*100,1,99));
  }else text.size=studioRound(studioClamp(original.size*Math.hypot(ev.clientX-centerX,ev.clientY-centerY)/radius,12,180));
  draw();
 };
 const finish=ev=>{
  if(ev.pointerId!==previewTextGesture)return;
  previewTextGesture=null;
  window.removeEventListener('pointermove',move);
  window.removeEventListener('pointerup',finish);
  window.removeEventListener('pointercancel',finish);
  if(changed&&ev.type==='pointercancel'){Object.assign(text,original);undoStack.pop()}
  if(changed)render();else syncPreviewTextSelection();
 };
 window.addEventListener('pointermove',move);
 window.addEventListener('pointerup',finish);
 window.addEventListener('pointercancel',finish);
}

for(const [button,mode] of [[moveTextButton,'move'],[scaleTextButton,'scale']]){
 button.onpointerdown=event=>{
  const text=texts.find(item=>item.id===selected);
  if(text)startPreviewTextGesture(event,text,mode);
 };
 button.onkeydown=event=>{
  if(event.code==='Space')event.stopPropagation();
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  const text=texts.find(item=>item.id===selected);
  if(!text)return;
  event.preventDefault();event.stopPropagation();
  const step=event.shiftKey?5:1;
  const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
  commit();
  if(mode==='scale')text.size=studioClamp(text.size+direction*step,12,180);
  else if(event.key==='ArrowLeft'||event.key==='ArrowRight')text.x=studioClamp((text.x??50)+direction*step,1,99);
  else text.y=studioClamp(text.y+direction*step,1,99);
  render();
 };
}
canvas.addEventListener('pointerdown',event=>{
 if(event.button!==0||playing||exporting)return;
 const rect=canvas.getBoundingClientRect();
 const x=(event.clientX-rect.left)*canvas.width/rect.width;
 const y=(event.clientY-rect.top)*canvas.height/rect.height;
 const text=[...texts].reverse().find(item=>{
  if(!visibleStudioText(item))return false;
  const bounds=studioTextBounds(item);
  return x>=bounds.left&&x<=bounds.left+bounds.width&&y>=bounds.top&&y<=bounds.top+bounds.height;
 });
 if(text)startPreviewTextGesture(event,text,'move');
});

const drawBeforeTextHandles=draw;
draw=function(){drawBeforeTextHandles();syncPreviewTextSelection()};

function textTrimChange(original,side,candidate,anchors,tolerance,limit){
 let edge=candidate,best=tolerance;
 for(const anchor of anchors){
  const distance=Math.abs(candidate-anchor);
  if(distance<=best){edge=anchor;best=distance}
 }
 if(side==='start'){
  const start=studioClamp(studioRound(edge),0,Math.max(0,original.end-.1));
  return {start,duration:studioRound(original.end-start)};
 }
 const end=studioClamp(studioRound(edge),original.start+.1,Math.max(original.start+.1,limit));
 return {start:original.start,duration:studioRound(end-original.start)};
}

function applyTextTrim(text,original,changed){
 text.start=changed.start;text.duration=changed.duration;
 if(original.words){
  const delta=changed.start-original.start;
  text.words=original.words.map(word=>({...word,start:Math.max(0,studioRound(word.start-delta))}));
 }
}
function textTrimBounds(text){
 return {start:text.start,end:text.start+text.duration,words:text.words};
}
function revealSelectedText(text){
 if(time<text.start||time>=text.start+text.duration){
  time=Math.min(total(),text.start);
  // A text at the end of the video still has a visible selection when it starts on a frame.
  if(time===total()&&text.start<total())time=Math.max(0,total()-.001);
 }
}

function bindTextTrim(element,text){
 const startTrim=(event,side)=>{
  if(event.button!==0||exporting)return;
  event.preventDefault();event.stopPropagation();
  pause();selected=text.id;renderInspector();
  const original=textTrimBounds(text),x=event.clientX,initialScroll=timelineViewport.scrollLeft;
  const anchors=[0,time,total(),...clips.map(clipStart),...texts.filter(item=>item!==text).flatMap(item=>[item.start,item.start+item.duration])];
  const timelineLimit=Math.max(total(),original.end);
  const pointer=event.pointerId,originalTime=time;
  const target=event.currentTarget;
  target.setPointerCapture(pointer);
  element.classList.add('selected','textTrimming');
  let changed=false,lastX=x,lastAlt=false,scrollFrame=0;
  function update(){
   const delta=(lastX-x+timelineViewport.scrollLeft-initialScroll)/zoom;
   const edge=(side==='start'?original.start:original.end)+delta;
   const result=textTrimChange(original,side,edge,lastAlt?[]:anchors,Math.min(.75,7/zoom),timelineLimit);
   if(!changed&&result.start===original.start&&result.duration===text.duration)return;
   if(!changed){commit();changed=true}
   applyTextTrim(text,original,result);
   element.style.left=text.start*zoom+'px';
   sizeTimelineClip(element,text.duration);
   target.title=`${fmt(text.start)} – ${fmt(text.start+text.duration)}`;
   let badge=element.querySelector('.textTrimTime');
   if(!badge){badge=document.createElement('span');badge.className='textTrimTime';element.append(badge)}
   badge.textContent=target.title;
   revealSelectedText(text);
   draw();
  }
  function autoScroll(){
   const rect=timelineViewport.getBoundingClientRect(),old=timelineViewport.scrollLeft;
   if(lastX>rect.right-24)timelineViewport.scrollLeft+=12;
   else if(lastX<rect.left+24)timelineViewport.scrollLeft-=12;
   if(old!==timelineViewport.scrollLeft)update();
   scrollFrame=requestAnimationFrame(autoScroll);
  }
  target.onpointermove=ev=>{
   if(ev.pointerId!==pointer)return;
   lastX=ev.clientX;lastAlt=ev.altKey;
   if(changed||Math.abs(lastX-x)>=2)update();
  };
  const finish=ev=>{
   if(ev.pointerId!==pointer)return;
   cancelAnimationFrame(scrollFrame);
   element.classList.remove('textTrimming');
   target.onpointermove=target.onpointerup=target.onpointercancel=null;
   if(changed&&ev.type==='pointercancel'){
    text.start=original.start;text.duration=original.end-original.start;text.words=original.words;
    time=originalTime;undoStack.pop();
   }
   if(changed)render();
   else{revealSelectedText(text);renderTimeline();renderInspector();draw()}
  };
  target.onpointerup=target.onpointercancel=finish;
  scrollFrame=requestAnimationFrame(autoScroll);
 };
 for(const [side,label] of [['start','Atur waktu mulai teks'],['end','Atur waktu selesai teks']]){
  const handle=document.createElement('button');
  handle.type='button';handle.className='textTrimHandle textTrim-'+side;handle.dataset.trimSide=side;
  handle.title=label+' · Tarik ujung';handle.setAttribute('aria-label',label);
  handle.onpointerdown=event=>startTrim(event,side);
  handle.onclick=event=>event.stopPropagation();
  handle.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();
   if(exporting)return;
   const original=textTrimBounds(text),edge=side==='start'?original.start:original.end;
   const delta=(event.key==='ArrowRight'?1:-1)*(event.shiftKey?1:.1);
   const result=textTrimChange(original,side,edge+delta,[],0,Math.max(total(),original.end));
   if(result.start===text.start&&result.duration===text.duration)return;
   commit();selected=text.id;applyTextTrim(text,original,result);revealSelectedText(text);render();
   $$('#tracks .textClip').find(el=>el.dataset.textId===text.id)?.querySelector('.textTrim-'+side)?.focus();
  };
  element.append(handle);
 }
}
const textDragBeforeTrim=bindTextDrag;
bindTextDrag=function(element,text){
 textDragBeforeTrim(element,text);
 const click=element.onclick,pointer=element.onpointerdown;
 element.onclick=event=>{if(!event.target.closest('.textTrimHandle')){revealSelectedText(text);click(event)}};
 element.onpointerdown=event=>{if(!event.target.closest('.textTrimHandle')){revealSelectedText(text);pointer(event)}};
 bindTextTrim(element,text);
};
render();

const trackHeaders=$('.trackLabels');
const laneList=$('#tracks');
let trackMenuAnchor=null;
const addTrackButton=document.createElement('button');
addTrackButton.type='button';
addTrackButton.className='timelineAddTrack';
addTrackButton.dataset.addTrack='';
addTrackButton.setAttribute('aria-label','Tambah track');
addTrackButton.innerHTML=editorIcon('layers',16)+editorIcon('plus',11);
addTrackButton.title='Tambah track';
addTrackButton.setAttribute('aria-haspopup','menu');
addTrackButton.setAttribute('aria-expanded','false');
$('.timelineToolbar>div').append(addTrackButton);

const trackMenu=document.createElement('div');
trackMenu.className='trackMenu';
trackMenu.setAttribute('role','menu');
trackMenu.hidden=true;
document.body.append(trackMenu);

function closeTrackMenu(restoreFocus=false){
 trackMenu.hidden=true;
 if(trackMenuAnchor){
  trackMenuAnchor.setAttribute('aria-expanded','false');
  if(restoreFocus)trackMenuAnchor.focus();
 }
 trackMenuAnchor=null;
}
function showTrackMenu(anchor,options){
 if(exporting||job)return;
 if(trackMenuAnchor===anchor){closeTrackMenu();return}
 closeTrackMenu();
 trackMenu.replaceChildren();
 for(const [text,icon,action] of options){
  const button=document.createElement('button');
  button.type='button';button.setAttribute('role','menuitem');
  button.innerHTML=editorIcon(icon,15)+'<span>'+esc(text)+'</span>';
  button.onclick=()=>{closeTrackMenu();action()};
  trackMenu.append(button);
 }
 trackMenuAnchor=anchor;
 anchor.setAttribute('aria-expanded','true');
 trackMenu.hidden=false;
 const bounds=anchor.getBoundingClientRect(),width=trackMenu.offsetWidth,height=trackMenu.offsetHeight;
 trackMenu.style.left=Math.max(6,Math.min(innerWidth-width-6,bounds.left))+'px';
 trackMenu.style.top=Math.max(6,bounds.bottom+height+12<innerHeight?bounds.bottom+4:bounds.top-height-4)+'px';
 trackMenu.querySelector('button').focus();
}
document.addEventListener('pointerdown',e=>{if(trackMenuAnchor&&!trackMenu.contains(e.target)&&!trackMenuAnchor.contains(e.target))closeTrackMenu()});
trackMenu.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.stopPropagation();closeTrackMenu(true)}
 if(['ArrowDown','ArrowUp'].includes(e.key)){
  e.preventDefault();
  const items=[...trackMenu.children],index=items.indexOf(document.activeElement);
  items[(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
 }
});
timelineViewport.addEventListener('scroll',()=>closeTrackMenu(),{passive:true});

const trackKindIcons={video:'film',audio:'volume-2',text:'type'};
addTrackButton.onclick=()=>showTrackMenu(addTrackButton,Object.keys(trackKinds).map(type=>[
 'Track '+trackKinds[type],trackKindIcons[type],()=>addTimelineTrack(type)
]));
function addTimelineTrack(type){
 commit();
 let sequence=1,name=trackKinds[type];
 while(timelineTracks.some(t=>t.name===name))name=trackKinds[type]+' '+(++sequence);
 const track={id:timelineTracks.some(t=>t.id===type)?'t-'+uid():type,type,name};
 timelineTracks.push(track);
 activeTimelineTrack=track.id;selected=null;
 render();
 timelineLane(track.id).scrollIntoView({block:'nearest',inline:'nearest'});
}
function trackItems(track){
 const items={video:clips,text:texts,audio:audios}[track.type];
 return items.filter(item=>itemTrack(item,track.type)===track.id);
}
function confirmRemoveTrack(track){
 const count=trackItems(track).length;
 const remove=()=>{
  pause();commit();
  if(track.type==='video')clips=clips.filter(c=>itemTrack(c,'video')!==track.id);
  else if(track.type==='text')texts=texts.filter(t=>itemTrack(t,'text')!==track.id);
  else{
   for(const item of trackItems(track))media.get(item.id)?.pause();
   audios=audios.filter(a=>itemTrack(a,'audio')!==track.id);
  }
  timelineTracks=timelineTracks.filter(t=>t.id!==track.id);
  delete trackStates[track.id];
  if(activeTimelineTrack===track.id)activeTimelineTrack=null;
  if(![...clips,...texts,...audios].some(item=>item.id===selected))selected=null;
  time=Math.min(time,total());render();
  toast('Track '+track.name+' dihapus');
 };
 if(!count)return remove();
 pause();
 modal(`<h2>Hapus track ${esc(track.name)}?</h2><p>${count} klip pada track ini akan dihapus dari timeline. Media sumber tetap tersedia di panel Media.</p><div class="actions"><button id="closeModal">Batal</button><button id="removeTimelineTrack" class="primary">Hapus track</button></div>`);
 $('#removeTimelineTrack').onclick=()=>{$('#modal').close();remove()};
}
function moveTimelineItem(item,track,position=null,before=null){
 const oldId=itemTrack(item,track.type);
 if(before===item)return;
 if(oldId===track.id&&track.type!=='video'&&position===null)return;
 commit();
 if(position!==null)item.start=position;
 item.trackId=track.id;
 activeTimelineTrack=track.id;selected=item.id;
 time=Math.min(time,total());
 render();
}
function onTimelineDrop(event,track,lane){
 event.preventDefault();event.stopPropagation();
 if(exporting||job)return;
 const transfer=event.dataTransfer;
 const position=Math.max(0,(event.clientX-lane.getBoundingClientRect().left)/zoom);
 const id=transfer.getData('text/clip');
 if(id){
  const items={video:clips,text:texts,audio:audios}[track.type],item=items.find(c=>c.id===id);
  if(!item)return toast('Gunakan track dengan jenis yang sama');
  const before=track.type==='video'?items.find(c=>c.id===event.target.closest('.clip')?.dataset.id):null;
  moveTimelineItem(item,track,position,before);
  return;
 }
 const asset=assets.find(item=>item.id===transfer.getData('text/asset'));
 if(asset){
  if(track.type==='text'||track.type!==(asset.type==='audio'?'audio':'video'))return toast('Gunakan track dengan jenis media yang sama');
  addAsset(asset.id,{trackId:track.id,start:position});
 }
 if(transfer.files.length){
  const files=[...transfer.files].filter(file=>track.type==='audio'?(typeof mediaFileKind==='function'?mediaFileKind(file)==='audio':file.type.startsWith('audio/')):
   track.type==='video'&&(typeof mediaFileKind==='function'?['image','video'].includes(mediaFileKind(file)):/^(image|video)\//.test(file.type)));
  if(!files.length)return toast('Gunakan track dengan jenis media yang sama');
  importFiles(files,{trackId:track.id,start:position});
 }
}

function buildTrackHeader(track,label){
 label.dataset.timelineTrack=track.id;
 label.dataset.trackKind=track.type;
 label.innerHTML=`<button type="button" class="trackControl trackSelect" title="Pilih track ${esc(track.name)}">
  ${editorIcon(trackKindIcons[track.type],14)}<span>${esc(track.name)}</span></button><div class="trackControlButtons"></div>`;
 const select=label.querySelector('.trackSelect');
 select.onclick=()=>{activeTimelineTrack=track.id;selected=null;renderTimeline();renderInspector()};
 select.ondblclick=()=>renameTimelineTrack(track);
 const controls=label.querySelector('.trackControlButtons');
 const toggles=track.type==='text'?[['hidden','eye','eye-off']]:[['muted','volume-2','volume-x'],['hidden','eye','eye-off']];
 for(const [property,on,off] of toggles){
  const button=document.createElement('button');
  button.type='button';button.className='trackControl trackToggle';button.dataset.trackControl=property;
  button.innerHTML=`<i>${editorIcon(on,15)}</i><i>${editorIcon(off,15)}</i>`;
  button.onclick=()=>{
   if(exporting||job)return;
   commit();
   const state=trackStates[track.id]||{};
   trackStates[track.id]={...state,[property]:!state[property]};
   syncAudio();render();
  };
  controls.append(button);
 }
 const menu=document.createElement('button');
 menu.type='button';menu.className='trackControl trackMore';
 menu.innerHTML=editorIcon('ellipsis',15);
 menu.setAttribute('aria-haspopup','menu');menu.setAttribute('aria-expanded','false');
 menu.setAttribute('aria-label','Opsi track '+track.name);menu.title='Opsi track '+track.name;
 menu.onclick=()=>showTrackMenu(menu,[['Ubah nama track','type',()=>renameTimelineTrack(track)],['Hapus track','trash-2',()=>confirmRemoveTrack(track)]]);
 label.oncontextmenu=e=>{e.preventDefault();menu.click()};
 controls.append(menu);
}
function syncTimelineLanes(){
 closeTrackMenu();
 const ids=new Set(timelineTracks.map(t=>t.id)),headers=new Map();
 for(const node of trackHeaders.querySelectorAll('[data-timeline-track]')){
  if(!ids.has(node.dataset.timelineTrack))node.remove();
  else headers.set(node.dataset.timelineTrack,node);
 }
 for(const node of laneList.querySelectorAll('.track')){
  const id=node.dataset.trackLane||node.id.replace(/Track$/,'');
  if(!ids.has(id)){
   if(id in trackKinds){node.hidden=true;node.replaceChildren()}
   else node.remove();
  }
 }
 // Earlier groups draw first within each media type; newest video layers appear above the base.
 const order=Object.keys(trackKinds).flatMap(type=>timelineTracks.filter(t=>t.type===type).reverse());
 let headerAfter=trackHeaders.firstElementChild,laneAfter=$('#ruler');
 for(const track of order){
  const label=headers.get(track.id)||document.createElement('div');
  label.className='timelineTrackLabel';
  if(!label.querySelector('.trackSelect'))buildTrackHeader(track,label);
  const lane=timelineLane(track.id,track.type);
  lane.dataset.trackLane=track.id;
  lane.hidden=false;
  if(headerAfter.nextElementSibling!==label)headerAfter.after(label);
  if(laneAfter.nextElementSibling!==lane)laneAfter.after(lane);
  headerAfter=label;laneAfter=lane;
  label.classList.toggle('currentTrack',activeTimelineTrack===track.id);
  label.querySelector('.trackSelect span').textContent=track.name;
  label.querySelector('.trackSelect').setAttribute('aria-pressed',String(activeTimelineTrack===track.id));
  lane.onclick=e=>{if(e.target===lane){activeTimelineTrack=track.id;selected=null;renderTimeline();renderInspector()}};
  lane.ondragover=e=>e.preventDefault();
  lane.ondrop=e=>onTimelineDrop(e,track,lane);
  const hidden=!trackVisible(track.id),muted=Boolean(trackStates[track.id]?.muted);
  lane.classList.toggle('trackInactive',hidden);lane.classList.toggle('trackMuted',muted);
  for(const button of label.querySelectorAll('.trackToggle')){
   const visibility=button.dataset.trackControl==='hidden',active=visibility?!hidden:!muted;
   button.setAttribute('aria-pressed',String(active));
   button.setAttribute('aria-label',(visibility?'Aktifkan track ':'Suara track ')+track.name);
   button.title=(visibility?(hidden?'Aktifkan':'Nonaktifkan'):(muted?'Aktifkan suara':'Bisukan'))+' track '+track.name;
  }
 }
}
const inspectorBeforeTrackPicker=renderInspector;
renderInspector=function(){
 inspectorBeforeTrackPicker();
 const item=clips.find(c=>c.id===selected)||texts.find(t=>t.id===selected)||audios.find(a=>a.id===selected);
 if(!item)return;
 const type=clips.includes(item)?'video':texts.includes(item)?'text':'audio';
 const tracks=timelineTracks.filter(t=>t.type===type);
 if(tracks.length<2)return;
 const label=document.createElement('label');
 label.className='featureLabel trackPicker';
 label.textContent='Track';
 const select=document.createElement('select');
 select.setAttribute('aria-label','Pindahkan klip ke track');
 for(const track of tracks)select.add(new Option(track.name,track.id,undefined,track.id===itemTrack(item,type)));
 select.onchange=()=>moveTimelineItem(item,tracks.find(t=>t.id===select.value));
 label.append(select);$('#inspectorContent').prepend(label);
};
render();

const autoVideoStyles={
 pop:{name:'Pop Edukasi',color:'#dcff50',background:'#18213a',caption:'karaoke',transition:'dissolve',motion:'zoom',layout:'framed'},
 film:{name:'Sinematik',color:'#eac58e',background:'#15171c',caption:'lower',transition:'black',motion:'pan',layout:'full'},
 product:{name:'Promo Produk',color:'#50f4c9',background:'#172525',caption:'outline',transition:'slide',motion:'lift',layout:'framed'},
 minimal:{name:'Minimal Editorial',color:'#e9e3d5',background:'#25212a',caption:'clean',transition:'dissolve',motion:'pan',layout:'framed'}
};
const autoVideoLabels={
 id:{intro:'Kenali',summary:'Inti dari',action:'Cari tahu lebih lanjut',detail:'Sorotan',story:['Awal cerita','Perjalanan','Akhir cerita'],language:'Bahasa Indonesia'},
 en:{intro:'Explore',summary:'The essentials of',action:'Find out more',detail:'Highlight',story:['The beginning','The journey','The ending'],language:'English'}
};
const autoVideoSlotKey='flexcut-auto-video-settings';
let autoVideoDraft={topic:'',brief:''};
let autoVideoOptions={style:'pop',ratio:'9:16',duration:30,scene:6,language:'id',kind:'education',tone:'casual',caption:'template',sourceAudio:false};
try{
 const saved=JSON.parse(localStorage.getItem(autoVideoSlotKey)||'{}');
 autoVideoOptions={...autoVideoOptions,...saved};
}catch(error){}

$('.navBottom').insertAdjacentHTML('beforebegin',`<button data-tab="automatic"><b>${editorIcon('sparkles',17)}</b>Otomatis</button>`);
$('[data-tab="automatic"]').onclick=()=>{tab='automatic';updateNav();renderLibrary()};
const libraryBeforeAutoVideo=renderLibrary;
renderLibrary=function(){
 if(tab!=='automatic')return libraryBeforeAutoVideo();
 $('#libraryTitle').textContent='Video Otomatis';
 $('#assetCount').textContent='';
 $('#libraryContent').innerHTML=`<div class="autoVideoLibrary">
  <button type="button" class="primary full editorIconLabel" id="openAutoVideo">${editorIcon('sparkles',15)} Buat video</button>
  <div class="autoVideoStyleGrid">${autoStyleCards('library')}</div>
 </div>`;
 $('#openAutoVideo').onclick=()=>showAutoVideoBuilder();
 $$('[data-auto-library]').forEach(button=>button.onclick=()=>showAutoVideoBuilder(button.dataset.autoLibrary));
};

function autoStyleCards(context,selectedStyle){
 return Object.entries(autoVideoStyles).map(([id,style])=>`
  <button type="button" class="autoVideoStyle ${id===selectedStyle?'chosen':''}" data-auto-${context}="${id}" style="--template-accent:${style.color};--template-bg:${style.background}">
   <span class="autoVideoSwatch" aria-hidden="true"><i></i><i></i><i></i></span><strong>${style.name}</strong>
  </button>`).join('');
}
function showAutoVideoBuilder(chosen){
 if(job||exporting||captureSession)return toast('Selesaikan proses yang sedang berjalan terlebih dahulu');
 pause();
 let style=autoVideoStyles[chosen]?chosen:autoVideoStyles[autoVideoOptions.style]?autoVideoOptions.style:'pop';
 const libraryMedia=assets.filter(a=>a.src&&['image','video'].includes(a.type));
 modal(`<form id="autoVideoForm">
  <h2>Video Otomatis</h2>
  <div class="autoVideoFields">
   <label class="featureLabel autoVideoWide">Judul atau topik<input id="autoTopic" required maxlength="100" placeholder="Misalnya, Kenapa kopi punya aroma yang berbeda?"></label>
   <label class="featureLabel autoVideoWide">Poin isi atau naskah<textarea id="autoBrief" rows="4" maxlength="4500" placeholder="Tulis fakta, manfaat, atau kalimat yang ingin muncul. Pisahkan poin dengan baris baru."></textarea></label>
   <div class="autoVideoWide autoIdeaAction">
    <button id="autoDevelopIdea" type="button" class="secondary editorIconLabel">${editorIcon('sparkles',15)} Kembangkan ide</button>
    <span id="autoIdeaStatus" class="featureNote" role="status"></span>
   </div>
   <label class="featureLabel">Jenis konten<select id="autoKind"><option value="education">Edukasi</option><option value="product">Promosi produk</option><option value="story">Cerita singkat</option></select></label>
   <label class="featureLabel">Gaya bercerita<select id="autoTone"><option value="casual">Santai</option><option value="direct">Langsung ke inti</option><option value="story">Bercerita</option></select></label>
   <label class="featureLabel">Bahasa<select id="autoLanguage"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
   <label class="featureLabel">Rasio<select id="autoRatio"><option value="9:16">9:16</option><option value="16:9">16:9</option><option value="1:1">1:1</option></select></label>
   <label class="featureLabel">Durasi video (detik)<input type="number" id="autoDuration" min="6" max="180" required></label>
   <label class="featureLabel">Target detik per adegan<input type="number" id="autoSceneLength" min="3" max="15" required></label>
  </div>
  <label class="featureLabel">Gaya subtitle<select id="autoCaptionStyle"><option value="template">Ikuti gaya visual</option>
   ${Object.entries(captionStyles).map(([id,item])=>`<option value="${id}">${esc(item.name)}</option>`).join('')}</select></label>
  <fieldset class="autoVideoStyleField"><legend>Gaya visual</legend><div class="autoVideoStyleGrid">${autoStyleCards('style',style)}</div></fieldset>

  <label class="checkLabel autoGenerateAssets"><input id="autoGenerateAssets" type="checkbox"> Buat foto, musik, dan narasi dengan Google AI</label>
  <fieldset id="autoOwnAssets" class="autoVideoFields">
   <label class="featureLabel autoVideoWide">Unggah foto atau video<input id="autoVisualFiles" type="file" accept="image/*,video/*" multiple></label>
   ${libraryMedia.length?`<fieldset class="autoVideoWide autoAssetPicker"><legend>Pilih dari Media proyek</legend>
    ${libraryMedia.map(a=>`<label class="checkLabel"><input type="checkbox" value="${esc(a.id)}" data-auto-asset> ${esc(a.name)}</label>`).join('')}
   </fieldset>`:''}
   <label class="featureLabel">Musik latar (opsional)<input id="autoMusic" type="file" accept="audio/*"></label>
   <label class="featureLabel">Narasi (opsional)<input id="autoNarration" type="file" accept="audio/*"></label>
   <label class="checkLabel autoVideoWide"><input id="autoSourceAudio" type="checkbox"> Sertakan suara asli klip video</label>
  </fieldset>
  <details class="autoVideoGemini" id="autoGeminiSettings"><summary>Pengaturan Gemini</summary>
   <label class="featureLabel">API key Google AI Studio<input id="autoGeminiKey" type="password" autocomplete="off" placeholder="Isi untuk memakai Gemini"></label>
   <label class="featureLabel">Model ID<input id="autoGeminiModel" maxlength="80" value="gemini-4-hydrogen" spellcheck="false"></label>
   <div class="autoGeminiKeyActions"><button id="saveAutoGeminiKey" type="button" class="secondary">Simpan API key</button>
    <button id="removeAutoGeminiKey" type="button">Hapus key tersimpan</button></div>
   <p id="autoGeminiKeyStatus" class="featureNote" role="status"></p>
   <label class="checkLabel"><input id="autoGeminiScript" type="checkbox"> Tulis naskah adegan dengan Gemini</label>
   <label class="featureLabel">Suara narator<select id="autoGeminiVoice"><option value="Kore">Kore</option><option value="Puck">Puck</option><option value="Aoede">Aoede</option><option value="Leda">Leda</option></select></label>
   <p class="featureNote">Pengembangan ide dan pembuatan aset mengirim prompt ke Google AI. Pembuatan aset mengikuti akses model dan kuota akun.</p>
  </details>
  <p id="autoVideoSummary" class="featureNote" role="status"></p>
  <p id="autoVideoError" class="errorDetail" role="alert" hidden></p>
  <div class="actions"><button id="closeModal" type="button">Batal</button><button type="submit" class="primary editorIconLabel">${editorIcon('sparkles',15)} Buat video</button></div>
 </form>`);
 const form=$('#autoVideoForm');
 for(const [name,id] of Object.entries({kind:'autoKind',tone:'autoTone',language:'autoLanguage',ratio:'autoRatio',duration:'autoDuration',scene:'autoSceneLength',caption:'autoCaptionStyle'}))$('#'+id).value=autoVideoOptions[name];
 $('#autoSourceAudio').checked=Boolean(autoVideoOptions.sourceAudio);
 const update=()=>{
  const duration=Number($('#autoDuration').value),scene=Number($('#autoSceneLength').value);
  const count=duration>=6&&scene>=3?Math.ceil(duration/scene):0;
  $('#autoVideoSummary').textContent=count?count+' adegan · '+duration+' detik · '+autoVideoStyles[style].name:'Masukkan durasi video dan durasi adegan.';
 };
 form.addEventListener('input',update);
 for(const button of $$('[data-auto-style]')){
  button.setAttribute('aria-pressed',String(button.dataset.autoStyle===style));
  button.onclick=()=>{
   style=button.dataset.autoStyle;
   for(const option of $$('[data-auto-style]')){
    option.classList.toggle('chosen',option===button);
    option.setAttribute('aria-pressed',String(option===button));
   }
   update();
  };
 }
 update();
 const settings=$('#autoGeminiSettings'),keyInput=$('#autoGeminiKey'),modelInput=$('#autoGeminiModel');
 const savedKeyStatus=$('#autoGeminiKeyStatus'),assetSwitch=$('#autoGenerateAssets');
 const topicInput=$('#autoTopic'),briefInput=$('#autoBrief'),ideaButton=$('#autoDevelopIdea');
 const submitButton=form.querySelector('button[type=submit]');
 const notice=$('#autoVideoError'),ideaStatus=$('#autoIdeaStatus');
 topicInput.value=autoVideoDraft.topic;
 briefInput.value=autoVideoDraft.brief;
 keyInput.value=storedAutoGeminiKey();
 modelInput.value=autoVideoOptions.geminiModel||'gemini-4-hydrogen';
 assetSwitch.checked=Boolean(autoVideoOptions.generateAssets);
 $('#autoGeminiScript').checked=Boolean(autoVideoOptions.geminiScript);
 $('#autoGeminiVoice').value=autoVideoOptions.voice||'Kore';
 function updateKeyStatus(){
  const saved=storedAutoGeminiKey();
  savedKeyStatus.textContent=saved?'API key tersimpan di browser ini.':'API key belum disimpan.';
  $('#removeAutoGeminiKey').disabled=!saved&&!keyInput.value;
 }
 function displayError(message){
  notice.textContent=message;
  notice.hidden=!message;
 }
 $('#saveAutoGeminiKey').onclick=()=>{
  const key=keyInput.value.trim();
  if(!key)return displayError('Masukkan API key terlebih dahulu.');
  try{
   localStorage.setItem(autoGeminiKeySlot,key);
   displayError('');updateKeyStatus();
  }catch(error){displayError('Browser ini tidak dapat menyimpan API key.')}
 };
 $('#removeAutoGeminiKey').onclick=()=>{
  try{
   localStorage.removeItem(autoGeminiKeySlot);
   keyInput.value='';updateKeyStatus();displayError('');
  }catch(error){displayError('API key belum dapat dihapus dari penyimpanan browser.')}
 };
 function updateAssetMode(){
  $('#autoOwnAssets').disabled=assetSwitch.checked;
  $('#autoGeminiVoice').disabled=!assetSwitch.checked;
  if(assetSwitch.checked&&!keyInput.value.trim())settings.open=true;
 }
 assetSwitch.onchange=updateAssetMode;
 keyInput.oninput=updateKeyStatus;
 updateKeyStatus();updateAssetMode();
 function readAutoVideoOptions(){
  return {style,topic:topicInput.value.trim(),brief:briefInput.value.trim(),
   kind:$('#autoKind').value,tone:$('#autoTone').value,language:$('#autoLanguage').value,
   ratio:$('#autoRatio').value,caption:$('#autoCaptionStyle').value,duration:Number($('#autoDuration').value),scene:Number($('#autoSceneLength').value),
   visual:[...$('#autoVisualFiles').files],existing:$$('[data-auto-asset]:checked').map(input=>input.value),
   music:$('#autoMusic').files[0],narration:$('#autoNarration').files[0],sourceAudio:$('#autoSourceAudio').checked,
   generateAssets:assetSwitch.checked,geminiScript:$('#autoGeminiScript').checked,voice:$('#autoGeminiVoice').value,
   key:keyInput.value.trim(),model:modelInput.value.trim()};
 }
 let ideaController;
 $('#modal').addEventListener('close',()=>ideaController?.abort(),{once:true});
 ideaButton.onclick=async()=>{
  if(ideaController)return;
  const options=readAutoVideoOptions();
  if(!options.topic){displayError('Isi judul atau topik untuk dikembangkan.');topicInput.focus();return}
  if(!options.key||!options.model){
   displayError('Isi API key dan Model ID Gemini terlebih dahulu.');
   settings.open=true;
   keyInput.focus();
   return;
  }
  const controller=ideaController=new AbortController();
  ideaButton.disabled=submitButton.disabled=true;
  topicInput.readOnly=briefInput.readOnly=true;
  displayError('');ideaStatus.textContent='Mengembangkan ide dengan Gemini…';
  try{
   const result=await developAutomaticIdea(options,controller.signal);
   controller.signal.throwIfAborted();
   if(!form.isConnected)return;
   topicInput.value=result.topic;briefInput.value=result.brief;
   autoVideoDraft=result;
   ideaStatus.textContent='Poin cerita siap diedit.';
  }catch(error){
   if(!controller.signal.aborted){displayError(error.message);ideaStatus.textContent=error.message}
  }finally{
   ideaController=null;
   if(form.isConnected){
    ideaButton.disabled=submitButton.disabled=false;
    topicInput.readOnly=briefInput.readOnly=false;
   }
  }
 };
 form.onsubmit=e=>{
  e.preventDefault();
  if(ideaController)return;
  const options=readAutoVideoOptions();
  const usesGemini=options.generateAssets||options.geminiScript||(!options.brief&&Boolean(options.key));
  const lines=options.brief.split(/\s+/).filter(Boolean).length;
  const message=!options.topic?'Isi judul atau topik.':
   usesGemini&&(!options.key||!options.model)?'Isi API key dan Model ID untuk Gemini.':
   !options.generateAssets&&!options.visual.length&&!options.existing.length?'Tambahkan foto atau video, atau aktifkan pembuatan aset otomatis.':
   !options.brief&&!usesGemini?'Isi poin isi atau gunakan Gemini untuk menulis.':
   !usesGemini&&lines>Math.floor(options.duration*3)?'Naskah terlalu panjang. Tambah durasi atau ringkas poin isi.':'';
  if(message){
   displayError(message);
   if(usesGemini&&(!options.key||!options.model))settings.open=true;
   return;
  }
  options.useGemini=usesGemini;
  if((clips.length||texts.length||audios.length)&&!confirm('Ganti isi timeline dengan video otomatis? Gunakan Urungkan untuk kembali ke edit sebelumnya.'))return;
  const {topic,brief,visual,existing,music,narration,key,model,useGemini,...savedOptions}=options;
  autoVideoDraft={topic,brief};
  autoVideoOptions={...savedOptions,geminiModel:model};
  try{localStorage.setItem(autoVideoSlotKey,JSON.stringify(autoVideoOptions))}catch(error){}
  $('#modal').close();
  buildAutomaticVideo(options);
 };
}

function automaticSceneLengths(duration,sceneLength){
 const count=Math.ceil(duration/sceneLength);
 const milliseconds=duration*1000;
 return Array.from({length:count},(_,i)=>
  (Math.round((i+1)*milliseconds/count)-Math.round(i*milliseconds/count))/1000);
}
function automaticScriptFromBrief(options,count){
 const labels=autoVideoLabels[options.language];
 const wordsPerScene=Math.max(6,Math.min(20,Math.floor(options.duration/count*2.6)));
 const rows=options.brief.split(/\n+|(?<=[.!?])\s+/u).flatMap(value=>{
  const words=value.trim().split(/\s+/).filter(Boolean),groups=[];
  for(let i=0;i<words.length;i+=wordsPerScene)groups.push(words.slice(i,i+wordsPerScene).join(' '));
  return groups;
 });
 const intro=options.tone==='direct'?options.topic:labels.intro+' '+options.topic;
 const headings=Array.from({length:count},(_,i)=>options.kind==='story'||options.tone==='story'?
  i===0?options.topic:i===count-1?labels.story[2]:labels.story[1]+' '+i:i===0?intro:
  i===count-1?(options.kind==='product'?labels.action:labels.summary+' '+options.topic):labels.detail+' '+i);
 if(count===1)return [{title:options.topic,caption:rows.join(' ')}];
 return headings.map((title,i)=>({title,caption:rows.filter((_,index)=>Math.floor(index*count/rows.length)===i).join(' ')}));
}
async function automaticGeminiScript(options,count,signal){
 const result=await autoGeminiJSON(options,
  'Return JSON {scenes:[{title:string,caption:string,visual:string,assetIndex:number}]}. Return exactly '+count+' scenes. Keep titles under 9 words and captions short enough to narrate in each scene. The visual field describes one coherent image with concrete subject, action, and setting. Use distinct shots and a consistent look. Use a zero-based assetIndex from supplied assets where relevant. Follow the requested language. Do not invent prices, statistics, endorsements, or unverifiable claims. Return no markdown.',
  {...autoGeminiContext(options),scenes:count,secondsPerScene:options.duration/count,
   assets:options.generateAssets?[]:[...options.existing.map(id=>assets.find(a=>a.id===id)?.name||''),...options.visual.map(file=>file.name)]},
  signal);
 if(!Array.isArray(result?.scenes)||result.scenes.length!==count||result.scenes.some(s=>
  typeof s?.title!=='string'||!s.title.trim()||typeof s.caption!=='string')){
  throw new Error('Format naskah Gemini tidak sesuai. Coba lagi atau buat dari poin isi.');
 }
 return result.scenes.map(s=>({title:s.title.trim().slice(0,100),caption:s.caption.trim().slice(0,220),
  visual:typeof s.visual==='string'?s.visual.trim().slice(0,360):'',assetIndex:s.assetIndex}));
}
async function automaticAsset(file,type,token){
 const id=uid(),src=URL.createObjectURL(file);
 try{
  let duration=0;
  if(type!=='image'){
   const element=document.createElement(type);
   element.preload='metadata';
   try{
    await waitVideoEvent(element,'loadedmetadata',()=>element.src=src);
    duration=element.duration;
   }finally{element.removeAttribute('src');element.load()}
   if(!Number.isFinite(duration)||duration<=0)throw new Error('Durasi tidak dapat dibaca: '+file.name);
  }else{
   const image=new Image();image.src=src;
   await image.decode();
   assertJob(token);
   duration=6;
  }
  assertJob(token);
  await storeProcessedAsset(id,file);
  return {id,name:file.name,type,src,duration,derivedLocal:true};
 }catch(error){
  URL.revokeObjectURL(src);
  throw error;
 }
}

function automaticTimelineStyle(style,options,source,length,scene,index,start){
 const styleId=options.style;
 const captionId=captionStyles[options.caption]?options.caption:style.caption;
 const maxLine=options.ratio==='9:16'?23:34;
 const titleLines=[''];
 for(const word of scene.title.split(/\s+/)){
  const last=titleLines.at(-1);
  if(last&&(last.length+word.length+1)>maxLine&&titleLines.length<3)titleLines.push(word);
  else titleLines[titleLines.length-1]=last?last+' '+word:word;
 }
 const title={id:uid(),trackId:'text',text:titleLines.join('\n'),start:start+.1,duration:Math.max(.1,length-.26),
  size:styleId==='minimal'?60:66,color:'#ffffff',x:50,y:style.layout==='framed'?16:22,
  font:styleId==='film'?'Playfair Display':'Montserrat',weight:800};
 const parts=scene.caption.trim().split(/\s+/).filter(Boolean),captions=[];
 const maxWords=options.ratio==='9:16'?10:14;
 const count=Math.ceil(parts.length/maxWords);
 const interval=(length-.42)/Math.max(1,count);
 for(let i=0;i<count;i++){
  captions.push({id:uid(),trackId:'text',kind:'subtitle',template:captionId,text:parts.slice(i*maxWords,(i+1)*maxWords).join(' '),
   start:start+.25+interval*i,duration:interval,x:50,y:style.layout==='framed'?87:85,color:'#ffffff',size:50,
   font:captionStyles[captionId].font,weight:captionStyles[captionId].weight});
 }
 const clip={id:uid(),trackId:'video',asset:source.id,name:scene.title,in:0,duration:length,
  speed:source.type==='video'?Math.max(.25,Math.min(1,source.duration/length)):1,scale:100,fit:'cover',rotation:0,opacity:100,volume:options.sourceAudio?100:0,filter:'original',
  brightness:100,contrast:100,saturation:100,autoScene:{style:styleId,index},
  transition:index&&transitions[style.transition]?style.transition:'none',transitionDuration:.4};
 return {clip,title,captions};
}
async function buildAutomaticVideo(options){
 const token=beginJob('Membuat video otomatis');
 const created=[],controller=new AbortController();
 token.cancelHooks.push(()=>controller.abort());
 const progressBar=document.createElement('progress');
 progressBar.id='autoVideoProgress';progressBar.max=5;progressBar.value=0;progressBar.setAttribute('aria-label','Progres pembuatan video');
 $('.jobSpinner').replaceWith(progressBar);
 const status=(step,message)=>{assertJob(token);progressBar.value=step;setJobStatus(message)};
 try{
  const lengths=automaticSceneLengths(options.duration,options.scene);
  const signal=controller.signal,narrations=[];
  status(0,options.useGemini?'Menulis naskah dengan Gemini…':'Menyusun naskah dari poin isi…');
  const scenes=options.useGemini?await automaticGeminiScript(options,lengths.length,signal):automaticScriptFromBrief(options,lengths.length);
  status(1,'Menyiapkan aset…');
  const visuals=[];
  let music=null;
  if(options.generateAssets){
   for(let i=0;i<scenes.length;i++){
    status(1+i/scenes.length,`Membuat foto adegan ${i+1}/${scenes.length}…`);
    const file=await generateAutoGeminiPhoto(options,scenes[i],i,scenes.length,signal);
    const asset=await automaticAsset(file,'image',token);
    created.push(asset);visuals.push(asset);
   }
   let position=0;
   for(let i=0;i<scenes.length;i++){
    status(2+i/scenes.length,`Membuat narasi adegan ${i+1}/${scenes.length}…`);
    const file=await generateAutoGeminiNarration(options,scenes[i],i,lengths[i],signal);
    const asset=await automaticAsset(file,'audio',token);
    created.push(asset);
    narrations.push({asset,position,length:lengths[i]});
    position+=lengths[i];
   }
   status(3,'Membuat musik latar dengan Lyria…');
   music=await automaticAsset(await generateAutoGeminiMusic(options,signal),'audio',token);
   created.push(music);
  }else{
   for(const id of options.existing){
    const asset=assets.find(a=>a.id===id&&a.src);
    if(asset)visuals.push(asset);
   }
   for(const file of options.visual){
    const type=file.type.startsWith('video/')?'video':'image';
    const asset=await automaticAsset(file,type,token);
    created.push(asset);visuals.push(asset);
   }
   if(options.music){
    music=await automaticAsset(options.music,'audio',token);
    created.push(music);
   }
   if(options.narration){
    const asset=await automaticAsset(options.narration,'audio',token);
    created.push(asset);narrations.push({asset,position:0,length:options.duration});
   }
  }
  if(!visuals.length)throw new Error('Tidak ada foto atau video yang dapat digunakan.');
  status(4,'Menyusun hasil ke timeline…');
  const style=autoVideoStyles[options.style];
  let start=0;
  const timeline=lengths.map((length,index)=>{
   const scene=scenes[index],picked=!options.generateAssets&&Number.isInteger(scene.assetIndex)?visuals[scene.assetIndex]:null;
   const data=automaticTimelineStyle(style,options,picked||visuals[index%visuals.length],length,scene,index,start);
   start+=length;
   return data;
  });
  const audio=(source,volume,trackId,position,length,speed=1)=>({
   id:uid(),trackId,assetId:source.id,name:source.name,src:source.src,start:position,in:0,speed,
   duration:Math.min(length,source.duration/speed),sourceDuration:source.duration,type:'audio',volume
  });
  const outputAudio=[];
  if(music){
   const volume=narrations.length?16:25;
   const interval=options.generateAssets?Math.max(1,music.duration):options.duration;
   for(let position=0;position<options.duration;position+=interval){
    outputAudio.push(audio(music,volume,'audio',position,options.duration-position));
   }
  }
  for(const {asset,position,length} of narrations){
   const speed=options.generateAssets?Math.min(3,Math.max(1,asset.duration/length)):1;
   outputAudio.push(audio(asset,100,music?'auto-narasi':'audio',position,length,speed));
  }
  status(4.7,'Menyiapkan pratinjau…');
  for(const visual of visuals.filter(asset=>asset.type==='image')){
   const image=getImage(visual);
   if(!image.complete)await image.decode();
  }
  assertJob(token);
  commit();
  assets.push(...created);
  clips=timeline.map(row=>row.clip);
  texts=timeline.flatMap(row=>[row.title,...row.captions]);
  audios=outputAudio;
  timelineTracks=defaultTimelineTracks();
  if(music)timelineTracks.find(track=>track.type==='audio').name='Musik';
  if(narrations.length&&music)timelineTracks.push({id:'auto-narasi',type:'audio',name:'Narasi'});
  if(narrations.length&&!music)timelineTracks.find(track=>track.type==='audio').name='Narasi';
  trackStates={};selected=clips[0].id;activeTimelineTrack='video';time=0;
  $('#projectName').value=options.topic;
  $('#ratio').value=options.ratio;
  timelineZoomMode='fit';
  setRatio();render();
  progressBar.value=progressBar.max;
  endJob(token);
  toast('Video siap dipratinjau · '+timeline.length+' adegan');
 }catch(error){
  for(const asset of created)if(!assets.includes(asset)){
   URL.revokeObjectURL(asset.src);
   removeProcessedAsset(asset.id).catch(()=>{});
  }
  endJob(token);
  if(!token.cancelled)modal(`<h2>Video belum berhasil dibuat</h2><p>${esc(error.message)}</p><div class="actions"><button id="closeModal" class="primary">Kembali</button></div>`);
 }
}

function paintAutomaticScene(target,clip,local,frame,sw,sh){
 const style=autoVideoStyles[clip.autoScene.style];
 if(!style)return false;
 const w=canvas.width,h=canvas.height,framed=style.layout==='framed',index=clip.autoScene.index;
 const progress=Math.max(0,Math.min(1,local/clip.duration));
 const x=framed?w*.08:0,y=framed?h*.25:0,bw=framed?w*.84:w,bh=framed?h*.49:h;
 target.save();
 target.globalAlpha=clip.opacity/100;
 target.fillStyle=style.background;target.fillRect(0,0,w,h);
 target.save();
 target.beginPath();
 target.roundRect(x,y,bw,bh,framed?Math.min(w,h)*.024:0);
 target.clip();
 const zoom=style.motion==='zoom'?1+progress*.15:1.075;
 const factor=(clip.fit==='contain'?Math.min(bw/sw,bh/sh):Math.max(bw/sw,bh/sh))*zoom*clip.scale/100;
 const dx=style.motion==='pan'?(progress-.5)*bw*.057*(index%2?1:-1):0;
 const dy=style.motion==='lift'?(progress-.5)*bh*.085:0;
 target.translate(x+bw/2+dx,y+bh/2+dy);
 target.rotate(clip.rotation*Math.PI/180);
 target.filter=[filterMap[clip.filter]||'',`brightness(${clip.brightness}%) contrast(${clip.contrast}%) saturate(${clip.saturation}%)`].filter(value=>value&&value!=='none').join(' ');
 paintStudioEffect(target,frame,-sw*factor/2,-sh*factor/2,sw*factor,sh*factor,clip.studioEffect);
 target.restore();
 if(!framed){
  const shade=target.createLinearGradient(0,0,0,h);
  shade.addColorStop(0,'#11141dc9');shade.addColorStop(.43,'#11141d00');shade.addColorStop(.61,'#11141d00');shade.addColorStop(1,'#11141dde');
  target.fillStyle=shade;target.fillRect(0,0,w,h);
 }
 target.fillStyle=style.color;
 target.fillRect(w*.08,h*.072,w*(.08+.14*progress),Math.max(2,h*.005));
 if(framed){target.fillRect(x,y+bh+h*.024,bw,Math.max(1,h*.002));}
 target.restore();
 return true;
}

draw();

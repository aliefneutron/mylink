const autoVideoStyles={
 pop:{name:'Pop Edukasi',color:'#dcff50',background:'#18213a',caption:'karaoke',transition:'dissolve',motion:'zoom',layout:'framed'},
 film:{name:'Sinematik',color:'#eac58e',background:'#15171c',caption:'lower',transition:'black',motion:'pan',layout:'full'},
 product:{name:'Promo Produk',color:'#50f4c9',background:'#172525',caption:'outline',transition:'slide',motion:'lift',layout:'framed'},
 minimal:{name:'Minimal Editorial',color:'#e9e3d5',background:'#25212a',caption:'clean',transition:'dissolve',motion:'pan',layout:'framed'},
 ...motionSkillStyles
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
   ${style.poster?`<img class="autoMotionSwatch" alt="" src="${motionAssetURL(style.poster)}">`:
    '<span class="autoVideoSwatch" aria-hidden="true"><i></i><i></i><i></i></span>'}<strong>${style.name}</strong>
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
   <label class="featureLabel autoVideoWide">Judul atau topik<input id="autoTopic" maxlength="100" placeholder="Misalnya, Kenapa kopi punya aroma yang berbeda?"></label>
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
  <label class="featureLabel" id="autoMotionModeLabel" hidden>Sumber topik dan naskah
   <select id="autoMotionMode"><option value="local">Gratis · template FlexCut</option><option value="gemini">Gemini AI · pakai kuota Google</option></select>
  </label>
  <label class="checkLabel autoGenerateAssets" id="autoMotionAudioLabel" hidden><input id="autoMotionAudio" type="checkbox"> Tambahkan narasi dan musik dari Google AI</label>
  <p id="autoMotionHint" class="featureNote" hidden></p>
  <fieldset id="autoOwnAssets" class="autoVideoFields">
   <div class="autoVideoWide autoVideoFields" id="autoVisualAssets">
   <label class="featureLabel autoVideoWide">Unggah foto atau video<input id="autoVisualFiles" type="file" accept="image/*,video/*" multiple></label>
   ${libraryMedia.length?`<fieldset class="autoVideoWide autoAssetPicker"><legend>Pilih dari Media proyek</legend>
    ${libraryMedia.map(a=>`<label class="checkLabel"><input type="checkbox" value="${esc(a.id)}" data-auto-asset> ${esc(a.name)}</label>`).join('')}
   </fieldset>`:''}
   <label class="checkLabel autoVideoWide"><input id="autoSourceAudio" type="checkbox"> Sertakan suara asli klip video</label>
   </div>
   <label class="featureLabel">Musik latar (opsional)<input id="autoMusic" type="file" accept="audio/*"></label>
   <label class="featureLabel">Narasi (opsional)<input id="autoNarration" type="file" accept="audio/*"></label>
  </fieldset>
  <details class="autoVideoGemini" id="autoGeminiSettings"><summary>Pengaturan Gemini</summary>
   <label class="featureLabel">API key Google AI Studio<input id="autoGeminiKey" type="password" autocomplete="off" placeholder="Isi untuk memakai Gemini"></label>
   <label class="featureLabel">Model ID<input id="autoGeminiModel" maxlength="80" value="gemini-4-hydrogen" spellcheck="false"></label>
   <div class="autoGeminiKeyActions"><button id="saveAutoGeminiKey" type="button" class="secondary">Simpan API key</button>
    <button id="removeAutoGeminiKey" type="button">Hapus key tersimpan</button></div>
   <p id="autoGeminiKeyStatus" class="featureNote" role="status"></p>
   <label class="checkLabel" id="autoGeminiScriptLabel"><input id="autoGeminiScript" type="checkbox"> Tulis naskah adegan dengan Gemini</label>
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
   updateAssetMode();
  };
 }
 update();
 const settings=$('#autoGeminiSettings'),keyInput=$('#autoGeminiKey'),modelInput=$('#autoGeminiModel');
 const savedKeyStatus=$('#autoGeminiKeyStatus'),assetSwitch=$('#autoGenerateAssets');
 const motionAudio=$('#autoMotionAudio'),motionMode=$('#autoMotionMode');
 const topicInput=$('#autoTopic'),briefInput=$('#autoBrief'),ideaButton=$('#autoDevelopIdea');
 const submitButton=form.querySelector('button[type=submit]');
 const notice=$('#autoVideoError'),ideaStatus=$('#autoIdeaStatus');
 topicInput.value=autoVideoDraft.topic;
 briefInput.value=autoVideoDraft.brief;
 keyInput.value=storedAutoGeminiKey();
 modelInput.value=autoVideoOptions.geminiModel||'gemini-4-hydrogen';
 assetSwitch.checked=Boolean(autoVideoOptions.generateAssets);
 motionAudio.checked=Boolean(autoVideoOptions.motionAudio);
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
  const motion=Boolean(motionSkillStyles[style]),geminiMotion=motion&&motionMode.value==='gemini';
  const generated=motion?geminiMotion&&motionAudio.checked:assetSwitch.checked;
  $('#autoOwnAssets').disabled=generated;
  $('#autoVisualAssets').hidden=motion;
  const hint=$('#autoMotionHint');
  hint.hidden=!motion;
  hint.textContent=geminiMotion?'Gemini menulis adegan. Saat kuota habis, FlexCut memakai naskah template.':
   'Tanpa API key atau kredit. Isi topik dan poin cerita, atau gunakan contoh bawaan. Tambahkan rekaman narasi atau musik sendiri jika perlu.';
  $('#autoMotionModeLabel').hidden=!motion;
  $('#autoMotionAudioLabel').hidden=!geminiMotion;
  $('#autoGeminiScriptLabel').hidden=motion;
  assetSwitch.closest('label').hidden=motion;
  settings.hidden=motion&&!geminiMotion;
  $('#autoGeminiVoice').disabled=!generated;
  if((geminiMotion||generated)&&!keyInput.value.trim())settings.open=true;
 }
 const updateIdeaLabel=()=>{
  const label=topicInput.value.trim()?'Kembangkan ide':'Buat topik';
  ideaButton.innerHTML=editorIcon('sparkles',15)+' '+label;
 };
 motionMode.onchange=motionAudio.onchange=assetSwitch.onchange=updateAssetMode;
 topicInput.oninput=updateIdeaLabel;
 keyInput.oninput=updateKeyStatus;
 updateKeyStatus();updateAssetMode();updateIdeaLabel();
 function readAutoVideoOptions(){
  return {style,topic:topicInput.value.trim(),brief:briefInput.value.trim(),
   kind:$('#autoKind').value,tone:$('#autoTone').value,language:$('#autoLanguage').value,
   ratio:$('#autoRatio').value,caption:$('#autoCaptionStyle').value,duration:Number($('#autoDuration').value),scene:Number($('#autoSceneLength').value),
   visual:[...$('#autoVisualFiles').files],existing:$$('[data-auto-asset]:checked').map(input=>input.value),
   music:$('#autoMusic').files[0],narration:$('#autoNarration').files[0],sourceAudio:$('#autoSourceAudio').checked,
   generateAssets:assetSwitch.checked,motionGemini:motionMode.value==='gemini',motionAudio:motionAudio.checked,
   geminiScript:$('#autoGeminiScript').checked,voice:$('#autoGeminiVoice').value,
   key:keyInput.value.trim(),model:modelInput.value.trim()};
 }
 let ideaController;
 $('#modal').addEventListener('close',()=>ideaController?.abort(),{once:true});
 ideaButton.onclick=async()=>{
  if(ideaController)return;
  const options=readAutoVideoOptions();
  const motion=Boolean(motionSkillStyles[options.style]);
  function applyIdea(result,message){
   topicInput.value=result.topic;briefInput.value=result.brief;
   autoVideoDraft=result;
   updateIdeaLabel();ideaStatus.textContent=message;
  }
  if(motion&&!options.motionGemini){
   displayError('');
   applyIdea(buildLocalMotionIdea(options),'Topik dan poin template siap diedit.');
   return;
  }
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
   applyIdea(result,'Topik dan poin cerita siap diedit.');
  }catch(error){
   if(!controller.signal.aborted&&form.isConnected){
    if(motion&&[402,429].includes(error.status))applyIdea(buildLocalMotionIdea(options),'Kuota Google terbatas. Topik dan poin diambil dari template.');
    else{displayError(error.message);ideaStatus.textContent=error.message}
   }
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
  const motion=Boolean(motionSkillStyles[options.style]);
  const usesGemini=motion?options.motionGemini:options.generateAssets||options.geminiScript||(!options.brief&&Boolean(options.key));
  const lines=options.brief.split(/\s+/).filter(Boolean).length;
  const message=!options.topic&&!motion?'Isi judul atau topik, atau klik Buat topik.':
   usesGemini&&(!options.key||!options.model)?'Isi API key dan Model ID untuk Gemini.':
   !motion&&!options.generateAssets&&!options.visual.length&&!options.existing.length?'Tambahkan foto atau video, atau aktifkan pembuatan aset otomatis.':
   !motion&&!options.brief&&!usesGemini?'Isi poin isi atau gunakan Gemini untuk menulis.':
   !usesGemini&&lines>Math.floor(options.duration*3)?'Naskah terlalu panjang. Tambah durasi atau ringkas poin isi.':'';
  if(message){
   displayError(message);
   if(usesGemini&&(!options.key||!options.model))settings.open=true;
   return;
  }
  options.useGemini=usesGemini;
  if((clips.length||texts.length||audios.length)&&!confirm('Ganti isi timeline dengan video otomatis? Gunakan Urungkan untuk kembali ke edit sebelumnya.'))return;
  const {topic,brief,visual,existing,music,narration,key,model,useGemini,motionGemini,...savedOptions}=options;
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
 const motion=motionSkillStyles[options.style];
 const context={...autoGeminiContext(options),scenes:count,secondsPerScene:options.duration/count};
 const common=' Return exactly '+count+' scenes, in the requested language. Keep titles under 9 words and captions short enough to narrate in each scene. Preserve facts the user supplies. Do not invent prices, statistics, endorsements, or unverifiable claims. Return no markdown.';
 const prompt=motion?
  'Return JSON {topic:string,scenes:[{title:string,caption:string,motion:{location:string,action:string,camera:string,panel:string,cast:string,speaker:string}}]}. Choose a clear topic if the input topic is blank. The caption is the spoken script. The first scene must hook the viewer. '+motion.direction+
   ' Pick fields only from the supplied lists. Vary camera and action as the story progresses. Use first for the male character and second for the female character. Keep the speaker in the selected cast.':
  'Return JSON {scenes:[{title:string,caption:string,visual:string,assetIndex:number}]}. The visual field describes one coherent image with concrete subject, action, and setting. Use distinct shots and a consistent look. Use a zero-based assetIndex from supplied assets where relevant.';
 const input=motion?{...context,choices:{location:motion.locations,action:motionActions,camera:motionCameras,panel:motionPanels,cast:motionCast,speaker:motionCast.slice(1)}}:
  {...context,assets:options.generateAssets?[]:[...options.existing.map(id=>assets.find(a=>a.id===id)?.name||''),...options.visual.map(file=>file.name)]};
 const result=await autoGeminiJSON(options,prompt+common,input,signal);
 const topic=options.topic||(typeof result?.topic==='string'?result.topic.trim().slice(0,100):'');
 if(!Array.isArray(result?.scenes)||result.scenes.length!==count||result.scenes.some(s=>
  typeof s?.title!=='string'||!s.title.trim()||typeof s.caption!=='string'||(motion&&!s.caption.trim()))||!topic){
  throw new Error('Format topik atau naskah Gemini tidak sesuai. Coba lagi.');
 }
 const scenes=result.scenes.map((s,index)=>({title:s.title.trim().slice(0,100),caption:s.caption.trim().slice(0,220),
  visual:typeof s.visual==='string'?s.visual.trim().slice(0,360):'',assetIndex:s.assetIndex,
  motion:motion?motionSceneDetails(options.style,s.motion,index):undefined}));
 return {topic,scenes};
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
  size:styleId==='minimal'?60:66,color:'#ffffff',x:50,y:scene.motion?14:style.layout==='framed'?16:22,
  font:styleId==='film'?'Playfair Display':'Montserrat',weight:800};
 const parts=scene.caption.trim().split(/\s+/).filter(Boolean),captions=[];
 const maxWords=options.ratio==='9:16'?10:14;
 const count=Math.ceil(parts.length/maxWords);
 const interval=(length-.42)/Math.max(1,count);
 for(let i=0;i<count;i++){
  captions.push({id:uid(),trackId:'text',kind:'subtitle',template:captionId,text:parts.slice(i*maxWords,(i+1)*maxWords).join(' '),
   start:start+.25+interval*i,duration:interval,x:50,y:scene.motion?89:style.layout==='framed'?87:85,color:'#ffffff',size:50,
   font:captionStyles[captionId].font,weight:captionStyles[captionId].weight});
 }
 const clip={id:uid(),trackId:'video',asset:source.id,name:scene.title,in:0,duration:length,
  speed:source.type==='video'?Math.max(.25,Math.min(1,source.duration/length)):1,scale:100,fit:'cover',rotation:0,opacity:100,volume:options.sourceAudio?100:0,filter:'original',
  brightness:100,contrast:100,saturation:100,autoScene:{style:styleId,index,motion:scene.motion},
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
  const motion=motionSkillStyles[options.style];
  let generatedAudio=motion?options.motionGemini&&options.motionAudio:options.generateAssets;
  let quotaFallback='';
  status(0,options.useGemini?'Menulis naskah dengan Gemini…':'Menyusun naskah dari poin isi…');
  let scenes;
  if(options.useGemini){
   try{
    const result=await automaticGeminiScript(options,lengths.length,signal);
    options={...options,topic:result.topic};
    scenes=result.scenes;
   }catch(error){
    if(!motion||![402,429].includes(error.status))throw error;
    generatedAudio=false;
    quotaFallback='Kuota Google terbatas · naskah dari template FlexCut';
   }
  }
  if(!scenes){
   if(motion)options={...options,...buildLocalMotionIdea(options)};
   scenes=automaticScriptFromBrief(options,lengths.length);
   if(motion)scenes.forEach((scene,index)=>{scene.motion=motionSceneDetails(options.style,null,index)});
  }
  status(1,'Menyiapkan aset…');
  const visuals=[];
  let music=null;
  if(motion){
   status(1,'Menyiapkan karakter dan latar motion…');
   await prepareMotionStyle(options.style);
   const previous=assets.find(a=>a.motionStyle===options.style&&a.src);
   if(previous)visuals.push(previous);
   else{
    const response=await fetch(motionAssetURL(motion.poster),{signal});
    if(!response.ok)throw new Error('Pratinjau gaya motion gagal dimuat.');
    const file=new File([await response.blob()],motion.name+'.webp',{type:'image/webp'});
    const asset=await automaticAsset(file,'image',token);
    asset.motionStyle=options.style;
    created.push(asset);visuals.push(asset);
   }
  }else if(options.generateAssets){
   for(let i=0;i<scenes.length;i++){
    status(1+i/scenes.length,`Membuat foto adegan ${i+1}/${scenes.length}…`);
    const file=await generateAutoGeminiPhoto(options,scenes[i],i,scenes.length,signal);
    const asset=await automaticAsset(file,'image',token);
    created.push(asset);visuals.push(asset);
   }
  }
  if(generatedAudio){
   try{
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
   }catch(error){
    if(!motion||![402,429].includes(error.status))throw error;
    quotaFallback='Kuota audio Google terbatas · video tetap siap dipratinjau';
   }
  }else{
   if(!motion){
    for(const id of options.existing){
     const asset=assets.find(a=>a.id===id&&a.src);
     if(asset)visuals.push(asset);
    }
    for(const file of options.visual){
     const type=file.type.startsWith('video/')?'video':'image';
     const asset=await automaticAsset(file,type,token);
     created.push(asset);visuals.push(asset);
    }
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
   const interval=generatedAudio?Math.max(1,music.duration):options.duration;
   for(let position=0;position<options.duration;position+=interval){
    outputAudio.push(audio(music,volume,'audio',position,options.duration-position));
   }
  }
  for(const {asset,position,length} of narrations){
   const speed=generatedAudio?Math.min(3,Math.max(1,asset.duration/length)):1;
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
  autoVideoDraft={topic:options.topic,brief:options.brief};
  $('#ratio').value=options.ratio;
  timelineZoomMode='fit';
  setRatio();render();
  progressBar.value=progressBar.max;
  endJob(token);
  toast(quotaFallback||'Video siap dipratinjau · '+timeline.length+' adegan');
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
 if(style.poster){paintSkillMotion(target,clip,local,frame);return true}
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

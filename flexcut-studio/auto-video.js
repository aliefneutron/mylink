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
  <div class="autoVideoFields">
   <label class="featureLabel autoVideoWide">Unggah foto atau video<input id="autoVisualFiles" type="file" accept="image/*,video/*" multiple></label>
   ${libraryMedia.length?`<fieldset class="autoVideoWide autoAssetPicker"><legend>Pilih dari Media proyek</legend>
    ${libraryMedia.map(a=>`<label class="checkLabel"><input type="checkbox" value="${esc(a.id)}" data-auto-asset> ${esc(a.name)}</label>`).join('')}
   </fieldset>`:''}
   <label class="featureLabel">Musik latar (opsional)<input id="autoMusic" type="file" accept="audio/*"></label>
   <label class="featureLabel">Narasi (opsional)<input id="autoNarration" type="file" accept="audio/*"></label>
   <label class="checkLabel autoVideoWide"><input id="autoSourceAudio" type="checkbox"> Sertakan suara asli klip video</label>
  </div>
  <details class="autoVideoGemini"><summary>Tulis naskah dengan Gemini</summary>
   <label class="featureLabel">API key Google AI Studio<input id="autoGeminiKey" type="password" autocomplete="off" placeholder="Isi untuk memakai Gemini"></label>
   <label class="featureLabel">Model ID<input id="autoGeminiModel" maxlength="80" value="gemini-4-hydrogen" spellcheck="false"></label>
   <p class="featureNote">Jika diisi, topik, poin isi, dan nama aset dikirim ke Gemini. Media tetap di browser dan key hanya dipakai untuk pembuatan ini.</p>
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
 form.onsubmit=e=>{
  e.preventDefault();
  const options={style,topic:$('#autoTopic').value.trim(),brief:$('#autoBrief').value.trim(),
   kind:$('#autoKind').value,tone:$('#autoTone').value,language:$('#autoLanguage').value,
   ratio:$('#autoRatio').value,caption:$('#autoCaptionStyle').value,duration:Number($('#autoDuration').value),scene:Number($('#autoSceneLength').value),
   visual:[...$('#autoVisualFiles').files],existing:$$('[data-auto-asset]:checked').map(input=>input.value),
   music:$('#autoMusic').files[0],narration:$('#autoNarration').files[0],sourceAudio:$('#autoSourceAudio').checked,
   key:$('#autoGeminiKey').value.trim(),model:$('#autoGeminiModel').value.trim()};
  const error=$('#autoVideoError');
  const words=options.brief.split(/\s+/).filter(Boolean).length;
  const message=!options.topic?'Isi judul atau topik.':!options.visual.length&&!options.existing.length?'Tambahkan setidaknya satu foto atau video.':
   !options.brief&&!options.key?'Isi setidaknya satu poin isi atau hubungkan Gemini untuk menulis naskah.':
   options.key&&!options.model?'Isi Model ID untuk Gemini.':!options.key&&words>Math.floor(options.duration*3)?'Naskah terlalu panjang untuk durasi ini. Tambah durasi atau ringkas poin isi.':'';
  if(message){error.textContent=message;error.hidden=false;return}
  if((clips.length||texts.length||audios.length)&&!confirm('Ganti isi timeline dengan video otomatis? Gunakan Urungkan untuk kembali ke edit sebelumnya.'))return;
  const {topic,brief,visual,existing,music,narration,key,model,...settings}=options;
  autoVideoOptions=settings;
  try{localStorage.setItem(autoVideoSlotKey,JSON.stringify(settings))}catch(error){}
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
async function automaticGeminiScript(options,count,token){
 const controller=new AbortController();
 token.cancelHooks.push(()=>controller.abort());
 let response;
 try{
  response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
   method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+options.key},
   body:JSON.stringify({model:options.model,response_format:{type:'json_object'},messages:[
    {role:'system',content:'Return JSON {scenes:[{title:string,caption:string,assetIndex:number}]}. Return exactly '+count+' scenes. Keep titles under 9 words and captions short enough to read in their duration. Use a zero-based assetIndex from the supplied asset list where relevant. Follow the requested language. Respect user facts and do not invent prices, statistics, endorsements, or factual claims absent from supplied notes. Do not return markdown.'},
    {role:'user',content:JSON.stringify({topic:options.topic,notes:options.brief,language:autoVideoLabels[options.language].language,
     contentType:options.kind,tone:options.tone,visualStyle:autoVideoStyles[options.style].name,durationSeconds:options.duration,
     assets:[...options.existing.map(id=>assets.find(a=>a.id===id)?.name||''),...options.visual.map(file=>file.name)]})}
   ]})
  });
 }catch(error){
  if(token.cancelled)throw error;
  throw new Error('Gemini tidak dapat dihubungi. Periksa koneksi dan pembatasan API key.');
 }
 if(!response.ok)throw new Error('Gemini mengembalikan HTTP '+response.status+'. Periksa API key, model, dan kuota.');
 const body=await response.json();
 let result;
 try{result=JSON.parse(body.choices?.[0]?.message?.content||'');}catch(error){}
 if(!Array.isArray(result?.scenes)||result.scenes.length!==count||result.scenes.some(s=>
  typeof s?.title!=='string'||!s.title.trim()||typeof s.caption!=='string')){
  throw new Error('Format naskah Gemini tidak sesuai. Coba lagi atau buat dari poin isi.');
 }
 return result.scenes.map(s=>({title:s.title.trim().slice(0,100),caption:s.caption.trim().slice(0,220),assetIndex:s.assetIndex}));
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
 const created=[];
 const progressBar=document.createElement('progress');
 progressBar.id='autoVideoProgress';progressBar.max=4;progressBar.value=0;
 $('.jobSpinner').replaceWith(progressBar);
 const status=(step,message)=>{assertJob(token);progressBar.value=step;setJobStatus(message)};
 try{
  const lengths=automaticSceneLengths(options.duration,options.scene);
  status(0,options.key?'Menulis naskah dengan Gemini…':'Menyusun naskah dari poin isi…');
  const scenes=options.key?await automaticGeminiScript(options,lengths.length,token):automaticScriptFromBrief(options,lengths.length);
  status(1,'Menyiapkan foto, video, dan audio…');
  const selectedAssets=options.existing.map(id=>assets.find(a=>a.id===id&&a.src)).filter(Boolean);
  for(const file of options.visual){
   const type=file.type.startsWith('video/')?'video':'image';
   created.push(await automaticAsset(file,type,token));
  }
  const visuals=[...selectedAssets,...created];
  if(!visuals.length)throw new Error('Tidak ada foto atau video yang dapat digunakan.');
  const music=options.music?await automaticAsset(options.music,'audio',token):null;
  if(music)created.push(music);
  const narration=options.narration?await automaticAsset(options.narration,'audio',token):null;
  if(narration)created.push(narration);
  status(2,'Membangun adegan dan teks di timeline…');
  const style=autoVideoStyles[options.style];
  let start=0;
  const timeline=lengths.map((length,index)=>{
   const scene=scenes[index],picked=Number.isInteger(scene.assetIndex)?visuals[scene.assetIndex]:null;
   const data=automaticTimelineStyle(style,options,picked||visuals[index%visuals.length],length,scene,index,start);
   start+=length;
   return data;
  });
  const audio=(source,volume,trackId)=>({
   id:uid(),trackId,assetId:source.id,name:source.name,src:source.src,start:0,in:0,speed:1,
   duration:Math.min(options.duration,source.duration),sourceDuration:source.duration,type:'audio',
   volume
  });
  status(3,'Menyiapkan pratinjau…');
  for(const visual of visuals.filter(asset=>asset.type==='image')){
   const image=getImage(visual);
   if(!image.complete)await image.decode();
  }
  assertJob(token);
  commit();
  assets.push(...created);
  clips=timeline.map(row=>row.clip);
  texts=timeline.flatMap(row=>[row.title,...row.captions]);
  audios=[music&&audio(music,narration?16:25,'audio'),narration&&audio(narration,100,music?'auto-narasi':'audio')].filter(Boolean);
  timelineTracks=defaultTimelineTracks();
  if(music)timelineTracks.find(track=>track.type==='audio').name='Musik';
  if(narration&&music)timelineTracks.push({id:'auto-narasi',type:'audio',name:'Narasi'});
  if(narration&&!music)timelineTracks.find(track=>track.type==='audio').name='Narasi';
  trackStates={};selected=clips[0].id;activeTimelineTrack='video';time=0;
  $('#projectName').value=options.topic;
  $('#ratio').value=options.ratio;
  timelineZoomMode='fit';
  setRatio();render();
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

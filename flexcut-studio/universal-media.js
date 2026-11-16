// Accept video containers independently of the MIME type supplied by the operating system.
const mediaAudioMimes={mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',opus:'audio/ogg',oga:'audio/ogg',wma:'audio/x-ms-wma'};
const mediaImageMimes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif',bmp:'image/bmp'};
function mediaFileKind(file){
 const mime=file.type.split('/')[0];
 if(['video','image','audio'].includes(mime))return mime;
 const extension=file.name.split('.').at(-1).toLowerCase();
 if(mediaImageMimes[extension])return 'image';
 if(mediaAudioMimes[extension])return 'audio';
 return 'video';
}
function normalizedMediaFile(file){
 const kind=mediaFileKind(file),extension=file.name.split('.').at(-1).toLowerCase();
 if(file.type.startsWith(kind+'/'))return file;
 const type=kind==='image'?mediaImageMimes[extension]:kind==='audio'?mediaAudioMimes[extension]:'video/'+extension;
 return new File([file],file.name,{type:type||'application/octet-stream',lastModified:file.lastModified});
}
function browserCanPlayVideo(file){
 return new Promise(resolve=>{
  const video=document.createElement('video'),src=URL.createObjectURL(file);
  const finish=readable=>{
   clearTimeout(timer);video.onloadeddata=video.onerror=null;
   video.removeAttribute('src');video.load();URL.revokeObjectURL(src);resolve(readable);
  };
  const timer=setTimeout(()=>finish(false),5000);
  video.preload='auto';
  video.onloadeddata=()=>finish(Number.isFinite(video.duration)&&video.duration>0&&video.videoWidth>0);
  video.onerror=()=>finish(false);
  video.src=src;
 });
}
function showMediaConversion(asset,options={}){
 if(!asset.src)return toast('Pilih ulang file sumber untuk melanjutkan konversi.');
 pause();
 modal('<h2>Siapkan video untuk diedit</h2><p>'+esc(asset.name)+'</p><p>Konversi ke MP4 H.264 agar video bisa dipratinjau dan dimasukkan ke timeline.</p>'+
  converterDescription()+'<div class="actions"><button id="closeModal">Nanti</button><button id="convertPendingMedia" class="primary">Konversi & tambahkan ke timeline</button></div>');
 $('#convertPendingMedia').onclick=()=>{
  $('#modal').close();
  runConversion({src:asset.src,name:asset.name,format:'mp4',onComplete:async(blob,token)=>{
   const file=new File([blob],asset.name.replace(/\.[^.]+$/,'')+'-converted.mp4',{type:'video/mp4'});
   const converted=await automaticAsset(file,'video',token);
   assertJob(token);commit();assets.push(converted);
   addAsset(converted.id,{...options,recordHistory:false});
   time=clipStart(clips.find(clip=>clip.id===selected));render();
  }});
 };
}
const importFilesBeforeUniversal=importFiles;
importFiles=async function(files,options={}){
 const pending=[];
 for(const original of files){
  const file=normalizedMediaFile(original);
  if(mediaFileKind(file)!=='video'||await browserCanPlayVideo(file)){
   await importFilesBeforeUniversal([file],options);
   continue;
  }
  const id=uid(),src=URL.createObjectURL(file);
  try{
   await storeProcessedAsset(id,file);
   const asset={id,name:file.name,type:'video',src,duration:0,size:file.size,derivedLocal:true,requiresConversion:true};
   commit();assets.push(asset);pending.push(asset);render();
  }catch(error){URL.revokeObjectURL(src);toast(error.message)}
 }
 $('#fileInput').value='';
 if(pending.length===1)showMediaConversion(pending[0],options);
 else if(pending.length)toast(pending.length+' video tersimpan di Media. Pilih video untuk konversi MP4.');
};
const addAssetBeforeUniversal=addAsset;
addAsset=function(id,options={}){
 const asset=assets.find(item=>item.id===id);
 if(asset?.requiresConversion)return showMediaConversion(asset,options);
 return addAssetBeforeUniversal(id,options);
};
const previewBeforeUniversal=showAssetPreview;
showAssetPreview=function(asset){
 if(asset.requiresConversion)return showMediaConversion(asset);
 return previewBeforeUniversal(asset);
};
const thumbnailsBeforeUniversal=requestThumbnails;
requestThumbnails=function(asset){if(!asset.requiresConversion)return thumbnailsBeforeUniversal(asset)};
const libraryBeforeUniversal=renderLibrary;
renderLibrary=function(){
 libraryBeforeUniversal();
 if(tab!=='media')return;
 for(const asset of assets.filter(item=>item.requiresConversion)){
  const card=$$('[data-asset]').find(element=>element.dataset.asset===asset.id);
  if(!card)continue;
  const duration=card.querySelector('.duration'),detail=card.querySelector('small');
  if(duration)duration.textContent='MP4';
  if(detail)detail.textContent='Siap dikonversi ke MP4';
 }
};
$('#convertFileInput').accept='*/*';
render();

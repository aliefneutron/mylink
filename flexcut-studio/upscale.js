function upscaleDimensions(width,height,shortEdge){
 const factor=Math.min(shortEdge/Math.min(width,height),Math.round(shortEdge*16/9)/Math.max(width,height));
 if(factor<=1)return {width,height,upscale:false};
 const even=value=>Math.max(2,Math.round(value/2)*2);
 const target={width:even(width*factor),height:even(height*factor)};
 return {...target,upscale:target.width>width||target.height>height};
}

async function openUpscaleSource(asset){
 if(asset.type==='image'){
  const image=new Image();
  image.src=asset.src;
  await image.decode();
  return {width:image.naturalWidth,height:image.naturalHeight,image};
 }
 const video=document.createElement('video');
 const ready=waitVideoEvent(video,'loadedmetadata',()=>{video.preload='metadata';video.src=asset.src});
 try{
  await ready;
  return {width:video.videoWidth,height:video.videoHeight};
 }finally{
  video.removeAttribute('src');
  video.load();
 }
}

function showUpscale(asset,clip=null){
 if(job||exporting)return toast('Selesaikan proses yang sedang berjalan terlebih dahulu');
 if(!asset?.src)return toast('Impor ulang media terlebih dahulu');
 pause();
 const isVideo=asset.type==='video';
 modal(`<h2>Upscale ${isVideo?'video':'foto'}</h2><p>${esc(asset.name)}</p>
  <label class="featureLabel">Resolusi target<select id="upscaleResolution">
   <option value="720">HD · 720p</option><option value="1080">Full HD · 1080p</option>
   <option value="1440" selected>2K QHD · hingga 2560 × 1440</option>
  </select></label><p id="upscaleSummary" class="featureNote" role="status">Membaca resolusi sumber…</p>
  <p class="featureNote">Rasio asli dipertahankan. Pembesaran halus menggunakan interpolasi.${isVideo?' Video disimpan sebagai MP4 dengan audio dari sumber.':''}</p>
  <div class="actions"><button id="closeModal">Batal</button><button id="downloadUpscale" ${clip?'':'class="primary"'} disabled>Unduh ${isVideo?'MP4':'PNG'}</button>
  ${clip?'<button id="applyUpscale" class="primary" disabled>Gunakan pada klip</button>':''}</div>`);
 const dialog=$('#modal'),preset=$('#upscaleResolution'),summary=$('#upscaleSummary');
 const downloadButton=$('#downloadUpscale'),applyButton=$('#applyUpscale');
 openUpscaleSource(asset).then(source=>{
  if(!dialog.open||!preset.isConnected)return;
  if(!source.width||!source.height)throw new Error('Resolusi sumber tidak terbaca.');
  function update(){
   const target=upscaleDimensions(source.width,source.height,Number(preset.value));
   summary.textContent=target.upscale?
    `${source.width} × ${source.height} → ${target.width} × ${target.height} px`:
    'Resolusi sumber sudah setara atau lebih besar dari target.';
   downloadButton.disabled=!target.upscale;
   if(applyButton)applyButton.disabled=!target.upscale;
   const run=apply=>{
    dialog.close();
    runUpscale(asset,source,target,apply?clip:null);
   };
   downloadButton.onclick=()=>run(false);
   if(applyButton)applyButton.onclick=()=>run(true);
  }
  preset.onchange=update;
  update();
 }).catch(error=>{if(summary.isConnected)summary.textContent=error.message||'Media tidak dapat dibaca.'});
}

function upscalePhoto(source,target){
 const output=document.createElement('canvas');
 output.width=target.width;
 output.height=target.height;
 const context=output.getContext('2d');
 context.imageSmoothingQuality='high';
 context.drawImage(source.image,0,0,output.width,output.height);
 return new Promise((resolve,reject)=>output.toBlob(
  blob=>blob?resolve(blob):reject(new Error('Foto hasil upscale tidak dapat disimpan.')),'image/png'
 ));
}

async function upscaleVideo(asset,target,token){
 const controller=new AbortController();
 token.cancelHooks.push(()=>controller.abort());
 const response=await fetch(asset.src,{signal:controller.signal});
 if(!response.ok)throw new Error('Video sumber tidak dapat dibaca.');
 const input=await response.blob();
 assertJob(token);
 if(input.size>600000000)throw new Error('Gunakan file video di bawah 600 MB agar cukup di memori browser.');
 const engine=await loadConverter(token);
 const extension=asset.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]||'video';
 const inputPath='upscale-input-'+uid()+'.'+extension;
 const outputPath='upscale-output-'+uid()+'.mp4';
 const progress=({progress})=>setJobStatus('Memperbesar video… '+Math.floor(Math.min(.99,Math.max(0,progress))*100)+'%');
 token.cancelHooks.push(()=>{if(engine.loaded){engine.terminate();if(ffmpegEngine===engine)ffmpegEngine=null}});
 engine.on('progress',progress);
 try{
  await engine.writeFile(inputPath,new Uint8Array(await input.arrayBuffer()));
  assertJob(token);
  setJobStatus('Memperbesar video di perangkat…');
  const status=await engine.exec(['-y','-i',inputPath,'-map','0:v:0','-map','0:a:0?',
   '-vf',`scale=${target.width}:${target.height}:flags=lanczos,setsar=1`,
   '-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',
   '-c:a','aac','-b:a','192k','-movflags','+faststart',outputPath]);
  assertJob(token);
  if(status!==0)throw new Error('Upscale video gagal. Periksa codec dan ruang memori browser.');
  return new Blob([await engine.readFile(outputPath)],{type:'video/mp4'});
 }finally{
  engine.off('progress',progress);
  if(engine.loaded){
   for(const file of [inputPath,outputPath])await engine.deleteFile(file).catch(()=>{});
  }
 }
}

async function runUpscale(asset,source,target,clip){
 const token=beginJob('Upscale media…');
 try{
  const isVideo=asset.type==='video';
  const blob=isVideo?await upscaleVideo(asset,target,token):await upscalePhoto(source,target);
  assertJob(token);
  if(!blob.size)throw new Error('Hasil upscale kosong.');
  const name=asset.name.replace(/\.[^.]+$/,'')+'-'+target.width+'x'+target.height+(isVideo?'.mp4':'.png');
  if(clip){
   const id=uid();
   setJobStatus('Menyimpan hasil upscale…');
   await storeProcessedAsset(id,blob);
   assertJob(token);
   commit();
   assets.push({id,name,type:asset.type,src:URL.createObjectURL(blob),duration:asset.duration,
    width:target.width,height:target.height,derivedLocal:true});
   clip.asset=id;
   render();
  }else download(blob,name);
  endJob(token);
  toast(`Upscale ${target.width} × ${target.height} selesai`);
 }catch(error){
  endJob(token);
  if(!token.cancelled){
   console.error(error);
   modal(`<h2>Upscale belum berhasil</h2><p>${esc(error.message)}</p><div class="actions"><button class="primary" id="closeModal">Mengerti</button></div>`);
  }
 }
}

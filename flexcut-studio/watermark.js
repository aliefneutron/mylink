/* Rebuild a marked area using pixels just outside its edges. */
const watermarkOutput=document.createElement('canvas');
const watermarkSample=document.createElement('canvas');
const watermarkPatch=document.createElement('canvas');
const watermarkOutputContext=watermarkOutput.getContext('2d');
const watermarkSampleContext=watermarkSample.getContext('2d',{willReadFrequently:true});
const watermarkPatchContext=watermarkPatch.getContext('2d');

function watermarkRegion(rect){
 const values=[rect?.x,rect?.y,rect?.w,rect?.h];
 if(values.some(value=>!Number.isFinite(value)))return null;
 const [x,y,w,h]=values;
 const left=Math.max(0,x),top=Math.max(0,y),right=Math.min(1,x+w),bottom=Math.min(1,y+h);
 if(right-left<.004||bottom-top<.004)return null;
 return {x:left,y:top,w:right-left,h:bottom-top,mode:rect.mode==='blur'?'blur':'repair'};
}

function watermarkPixels(region,width,height){
 const x=Math.min(width-1,Math.floor(region.x*width));
 const y=Math.min(height-1,Math.floor(region.y*height));
 const right=Math.min(width,Math.ceil((region.x+region.w)*width));
 const bottom=Math.min(height,Math.ceil((region.y+region.h)*height));
 return {x,y,w:right-x,h:bottom-y};
}

function repairWatermarkPixels(edges,patch,width,height,sides){
 const stride=width+2;
 for(let y=0;y<height;y++){
  const v=(y+.5)/height;
  for(let x=0;x<width;x++){
   const u=(x+.5)/width;
   const left=(y+1)*stride,right=left+width+1,top=x+1,bottom=(height+1)*stride+top;
   const wl=sides.left?1/Math.max(.02,u):0;
   const wr=sides.right?1/Math.max(.02,1-u):0;
   const wt=sides.top?1/Math.max(.02,v):0;
   const wb=sides.bottom?1/Math.max(.02,1-v):0;
   const weight=wl+wr+wt+wb;
   const index=(y*width+x)*4;
   for(let channel=0;channel<4;channel++){
    patch[index+channel]=(wl*edges[left*4+channel]+wr*edges[right*4+channel]
      +wt*edges[top*4+channel]+wb*edges[bottom*4+channel])/weight;
   }
  }
 }
}

function makeWatermarkPatch(source,rect,sourceWidth,sourceHeight){
 const {x,y,w,h}=rect;
 const sides={left:x>0,right:x+w<sourceWidth,top:y>0,bottom:y+h<sourceHeight};
 if(!Object.values(sides).some(Boolean))return null;
 const scale=Math.min(1,72/Math.max(w,h));
 const pw=Math.max(2,Math.round(w*scale)),ph=Math.max(2,Math.round(h*scale));
 watermarkSample.width=pw+2;
 watermarkSample.height=ph+2;
 const sample=watermarkSampleContext;
 const edge=Math.max(1,Math.round(Math.min(w,h)*.025));
 if(sides.left){const n=Math.min(x,edge);sample.drawImage(source,x-n,y,n,h,0,1,1,ph)}
 if(sides.right){const n=Math.min(sourceWidth-x-w,edge);sample.drawImage(source,x+w,y,n,h,pw+1,1,1,ph)}
 if(sides.top){const n=Math.min(y,edge);sample.drawImage(source,x,y-n,w,n,1,0,pw,1)}
 if(sides.bottom){const n=Math.min(sourceHeight-y-h,edge);sample.drawImage(source,x,y+h,w,n,1,ph+1,pw,1)}
 const edges=sample.getImageData(0,0,pw+2,ph+2).data;
 watermarkPatch.width=pw;
 watermarkPatch.height=ph;
 const patch=watermarkPatchContext.createImageData(pw,ph);
 repairWatermarkPixels(edges,patch.data,pw,ph,sides);
 watermarkPatchContext.putImageData(patch,0,0);
 return watermarkPatch;
}

function blurWatermarkPatch(source,rect){
 const scale=Math.min(1,5/Math.max(rect.w,rect.h));
 watermarkPatch.width=Math.max(1,Math.round(rect.w*scale));
 watermarkPatch.height=Math.max(1,Math.round(rect.h*scale));
 watermarkPatchContext.imageSmoothingQuality='high';
 watermarkPatchContext.drawImage(source,rect.x,rect.y,rect.w,rect.h,
  0,0,watermarkPatch.width,watermarkPatch.height);
 return watermarkPatch;
}

function renderWatermarkFrame(source,stored,width,height,renderScale=1){
 const region=watermarkRegion(stored);
 if(!region||(source.readyState!==undefined&&source.readyState<2))return source;
 const sourceRect=watermarkPixels(region,width,height);
 let patch;
 try{
  if(region.mode==='repair')patch=makeWatermarkPatch(source,sourceRect,width,height);
 }catch(error){
  if(error.name!=='SecurityError')throw error;
 }
 patch=patch||blurWatermarkPatch(source,sourceRect);
 const scale=Math.min(1,Math.max(.01,renderScale),4096/Math.max(width,height));
 const outWidth=Math.max(1,Math.round(width*scale)),outHeight=Math.max(1,Math.round(height*scale));
 if(watermarkOutput.width!==outWidth)watermarkOutput.width=outWidth;
 if(watermarkOutput.height!==outHeight)watermarkOutput.height=outHeight;
 const output=watermarkOutputContext,rect=watermarkPixels(region,outWidth,outHeight);
 output.clearRect(0,0,outWidth,outHeight);
 output.drawImage(source,0,0,outWidth,outHeight);
 output.clearRect(rect.x,rect.y,rect.w,rect.h);
 output.drawImage(patch,rect.x,rect.y,rect.w,rect.h);
 return watermarkOutput;
}

function showWatermarkEditor(clip){
 const asset=assets.find(a=>a.id===clip?.asset);
 if(!asset?.src)return toast(clip?'Impor ulang media klip terlebih dahulu':'Pilih klip foto atau video di timeline');
 const isVideo=asset.type==='video';
 const saved=watermarkRegion(clip.watermark);
 let region=saved,dragStart=null;
 pause();
 modal(`<h2>Samarkan watermark</h2><p>Tarik kotak yang sedikit lebih besar dari watermark. Untuk video, cek posisinya di beberapa bagian.</p>
  <div class="watermarkStage"><canvas id="watermarkCanvas" aria-label="Pratinjau dan area watermark"></canvas></div>
  <p id="watermarkStatus" class="featureNote" role="status">Memuat media…</p>
  ${isVideo?'<label class="watermarkSeek">Posisi video <input id="watermarkSeek" type="range" min="0" max="0" step="0.01" value="0" disabled><output id="watermarkTime">00:00.00</output></label>':''}
  <div class="watermarkOptions">
   <label class="featureLabel">Metode<select id="watermarkMethod"><option value="repair">Isi dari sekeliling</option><option value="blur">Buramkan area</option></select></label>
   <label class="checkLabel"><input type="checkbox" id="watermarkCompare"> Lihat asli</label>
  </div>
  <details class="watermarkDetails"><summary>Atur area dengan angka (%)</summary><div class="watermarkCoordinates">
   ${[['x','Dari kiri'],['y','Dari atas'],['w','Lebar'],['h','Tinggi']].map(([key,label])=>`<label class="featureLabel">${label}<input data-watermark-coordinate="${key}" type="number" min="0" max="100" step="0.1"></label>`).join('')}
  </div></details>
  <div class="actions"><button id="closeModal">Batal</button>${saved?'<button id="clearWatermark">Hapus efek</button>':''}<button id="applyWatermark" class="primary" disabled>Terapkan</button></div>`);

 const dialog=$('#modal'),preview=$('#watermarkCanvas'),paint=preview.getContext('2d');
 const method=$('#watermarkMethod'),compare=$('#watermarkCompare'),status=$('#watermarkStatus'),apply=$('#applyWatermark');
 const coordinates=$$('[data-watermark-coordinate]');
 const source=isVideo?document.createElement('video'):new Image();
 method.value=saved?.mode||'repair';
 if(isVideo){
  source.preload='auto';
  source.playsInline=true;
  source.muted=true;
  const seek=$('#watermarkSeek'),offset=clip.in||0;
  seek.oninput=()=>{
   source.currentTime=Math.min(source.duration-.001,offset+Number(seek.value)*(clip.speed||1));
   $('#watermarkTime').textContent=fmt(Number(seek.value));
  };
  source.onloadedmetadata=()=>{
   const duration=Math.min(clip.duration,(source.duration-offset)/(clip.speed||1));
   seek.max=Math.max(0,duration);
   seek.disabled=duration<=0;
   seek.value=Math.max(0,Math.min(duration,time-clipStart(clip)));
   seek.oninput();
  };
  source.onloadeddata=redraw;
  source.onseeked=redraw;
 }else source.onload=redraw;

 function syncCoordinates(){
  for(const input of coordinates){
   const value=region?.[input.dataset.watermarkCoordinate];
   input.value=value===undefined?'':Number((value*100).toFixed(1));
  }
 }

 function redraw(){
  if(!dialog.open)return;
  const width=source.videoWidth||source.naturalWidth,height=source.videoHeight||source.naturalHeight;
  if(!width||!height||(isVideo&&source.readyState<2))return;
  const scale=Math.min(1,720/width,350/height);
  preview.width=Math.max(1,Math.round(width*scale));
  preview.height=Math.max(1,Math.round(height*scale));
  preview.style.width=preview.width+'px';
  let frame=source;
  if(region&&!compare.checked&&!dragStart){
   frame=renderWatermarkFrame(source,{...region,mode:method.value},width,height,scale);
  }
  paint.drawImage(frame,0,0,preview.width,preview.height);
  if(region){
   paint.strokeStyle='#c4ff00';
   paint.lineWidth=1.5;
   paint.setLineDash([5,3]);
   paint.strokeRect(region.x*preview.width,region.y*preview.height,region.w*preview.width,region.h*preview.height);
  }
  apply.disabled=!region||Boolean(dragStart);
  status.textContent=region?'Area dipilih. Bandingkan hasil dengan media asli.':'Tarik untuk memilih area.';
 }

 function point(event){
  const rect=preview.getBoundingClientRect();
  const clamp=value=>Math.min(1,Math.max(0,value));
  return {x:clamp((event.clientX-rect.left)/rect.width),y:clamp((event.clientY-rect.top)/rect.height)};
 }
 let beforeDrag=null,pointerId=null;
 preview.onpointerdown=event=>{
  if(event.button!==0||pointerId!==null||!(source.videoWidth||source.naturalWidth))return;
  event.preventDefault();
  pointerId=event.pointerId;
  preview.setPointerCapture(pointerId);
  beforeDrag=region;
  dragStart=point(event);
 };
 preview.onpointermove=event=>{
  if(!dragStart||event.pointerId!==pointerId)return;
  const p=point(event);
  region=watermarkRegion({x:Math.min(p.x,dragStart.x),y:Math.min(p.y,dragStart.y),
   w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y),mode:method.value});
  redraw();
 };
 preview.onpointerup=event=>{
  if(!dragStart||event.pointerId!==pointerId)return;
  pointerId=null;
  dragStart=null;
  region=region||beforeDrag;
  syncCoordinates();
  redraw();
 };
 preview.onpointercancel=event=>{
  if(!dragStart||event.pointerId!==pointerId)return;
  pointerId=null;
  dragStart=null;
  region=beforeDrag;
  syncCoordinates();
  redraw();
 };
 for(const input of coordinates)input.oninput=()=>{
  const values=Object.fromEntries(coordinates.map(field=>[field.dataset.watermarkCoordinate,
   field.value===''?NaN:Number(field.value)/100]));
  region=watermarkRegion({...values,mode:method.value});
  redraw();
 };
 method.onchange=redraw;
 compare.onchange=redraw;
 apply.onclick=()=>{
  if(!region)return;
  commit();
  clip.watermark={...region,mode:method.value};
  dialog.close();
  render();
  toast('Efek watermark diterapkan ke klip');
 };
 $('#clearWatermark')?.addEventListener('click',()=>{
  commit();
  delete clip.watermark;
  dialog.close();
  render();
 });
 source.onerror=()=>{status.textContent='Media tidak dapat dibuka. Impor ulang file lalu coba lagi.'};
 dialog.addEventListener('close',()=>{
  if(isVideo){source.pause();source.removeAttribute('src');source.load()}
 },{once:true});
 syncCoordinates();
 source.src=asset.src;
}

const inspectorBeforeWatermark=renderInspector;
renderInspector=function(){
 inspectorBeforeWatermark();
 const clip=clips.find(c=>c.id===selected);
 if(!clip)return;
 $('#inspectorContent').insertAdjacentHTML('afterbegin',
  `<button class="secondary full" id="openWatermarkEditor">${clip.watermark?'Edit area watermark':'Samarkan watermark'}</button>`);
 $('#openWatermarkEditor').onclick=()=>showWatermarkEditor(clip);
};

const libraryBeforeWatermark=renderLibrary;
renderLibrary=function(){
 libraryBeforeWatermark();
 if(tab!=='effects')return;
 $('#libraryContent').insertAdjacentHTML('afterbegin','<button class="preset" id="watermarkEffect">Samarkan watermark</button>');
 $('#watermarkEffect').onclick=()=>showWatermarkEditor(clips.find(c=>c.id===selected));
};
render();

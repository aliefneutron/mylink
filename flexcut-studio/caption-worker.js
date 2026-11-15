/* Model selections and WebGPU fallback adapted from OpenReel Video's Whisper worker (MIT). */
const captionModels={
 accurate:{id:'onnx-community/whisper-large-v3-turbo_timestamped',label:'Whisper Large v3 Turbo',dtype:'q4'},
 fast:{id:'onnx-community/whisper-tiny',label:'Whisper Tiny',dtype:'q8'}
};
let loadedCaptionModel=null;

function captionStatus(text){self.postMessage({type:'status',text})}

async function loadCaptionModel(pipeline,key){
 const model=captionModels[key];
 captionStatus('Menyiapkan '+model.label+'…');
 const create=device=>pipeline('automatic-speech-recognition',model.id,{
  dtype:model.dtype,device,progress_callback:progress=>{
   if(progress.status==='progress')captionStatus(
    `Mengunduh ${model.label} · ${progress.file.split('/').pop()} · ${Math.round(progress.progress||0)}%`);
  }
 });
 if(key==='accurate'&&navigator.gpu){
  try{return {transcriber:await create('webgpu'),backend:'WebGPU'}}
  catch(error){captionStatus('WebGPU belum siap. Mencoba WebAssembly…')}
 }
 return {transcriber:await create('wasm'),backend:'WebAssembly'};
}

self.onmessage=async ({data})=>{
 try{
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  const requested=data.model==='accurate'?'accurate':'fast';
  if(loadedCaptionModel?.requested!==requested){
   await loadedCaptionModel?.transcriber.dispose();
   loadedCaptionModel=null;
   let active=requested,loaded;
   try{loaded=await loadCaptionModel(pipeline,requested)}
   catch(error){
    if(requested!=='accurate')throw error;
    captionStatus('Model akurat tidak dapat dimuat. Beralih ke Whisper Tiny.');
    active='fast';
    loaded=await loadCaptionModel(pipeline,active);
   }
   loadedCaptionModel={...loaded,requested,active};
  }
  if(!data.audio?.length)throw new Error('Audio tidak ditemukan pada sumber yang dipilih.');
  const active=loadedCaptionModel.active;
  captionStatus(`Mengenali ucapan dengan ${captionModels[active].label} · ${loadedCaptionModel.backend}…`);
  const options={task:'transcribe',return_timestamps:true,chunk_length_s:30,stride_length_s:5};
  if(data.language&&data.language!=='auto')options.language=data.language;
  const result=await loadedCaptionModel.transcriber(data.audio,options);
  const output=Array.isArray(result)?result[0]:result;
  self.postMessage({type:'complete',output,model:active});
 }catch(error){self.postMessage({type:'error',text:error.message||String(error)})}
};

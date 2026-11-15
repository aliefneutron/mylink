/* Model selections and WebGPU fallback adapted from OpenReel Video's Whisper worker (MIT). */
const captionModels={
 accurate:{id:'onnx-community/whisper-large-v3-turbo_timestamped',revision:'b3f77bf9a8c4d5ea3415827033d1ffea7955fd9a',label:'Whisper Large v3 Turbo',dtype:'q4'},
 fast:{id:'onnx-community/whisper-tiny_timestamped',revision:'517244293732ee2d58139af5814231b7e6830a0d',label:'Whisper Tiny',dtype:'q8'}
};
let loadedCaptionModel=null;

function captionStatus(text){self.postMessage({type:'status',text})}

async function loadCaptionModel(pipeline,key,device){
 const model=captionModels[key];
 captionStatus('Menyiapkan '+model.label+' · '+(device==='wasm'?'WebAssembly':'WebGPU')+'…');
 const transcriber=await pipeline('automatic-speech-recognition',model.id,{
  revision:model.revision,dtype:model.dtype,device,progress_callback:progress=>{
   if(progress.status==='progress')captionStatus(
    `Mengunduh ${model.label} · ${progress.file.split('/').pop()} · ${Math.round(progress.progress||0)}%`);
  }
 });
 return {transcriber,device,key};
}

async function transcribe(pipeline,key,audio,options){
 if(loadedCaptionModel?.key!==key){
  await loadedCaptionModel?.transcriber.dispose();
  loadedCaptionModel=null;
 }
 if(!loadedCaptionModel&&key==='accurate'&&navigator.gpu){
  try{loadedCaptionModel=await loadCaptionModel(pipeline,key,'webgpu')}
  catch(error){console.warn(error);captionStatus('WebGPU belum siap. Mencoba model yang sama dengan WebAssembly…')}
 }
 async function run(){
  loadedCaptionModel=loadedCaptionModel||await loadCaptionModel(pipeline,key,'wasm');
  const backend=loadedCaptionModel.device==='wasm'?'WebAssembly':'WebGPU';
  captionStatus(`Mengenali ucapan dengan ${captionModels[key].label} · ${backend}…`);
  return loadedCaptionModel.transcriber(audio,options);
 }
 try{return await run()}
 catch(error){
  if(loadedCaptionModel?.device!=='webgpu')throw error;
  console.warn(error);
  await loadedCaptionModel.transcriber.dispose().catch(()=>{});
  loadedCaptionModel=null;
  captionStatus('Pemrosesan WebGPU gagal. Mencoba model yang sama dengan WebAssembly…');
  return run();
 }
}

self.onmessage=async ({data})=>{
 try{
  if(!data.audio?.length)throw new Error('Audio tidak ditemukan pada sumber yang dipilih.');
  const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
  env.allowLocalModels=false;
  env.backends.onnx.wasm.numThreads=1;
  const key=data.model==='fast'?'fast':'accurate';
  const options={task:'transcribe',return_timestamps:'word',chunk_length_s:30,stride_length_s:5};
  if(data.language&&data.language!=='auto')options.language=data.language;
  const result=await transcribe(pipeline,key,data.audio,options);
  self.postMessage({type:'complete',output:Array.isArray(result)?result[0]:result});
 }catch(error){self.postMessage({type:'error',text:error.message||String(error)})}
};

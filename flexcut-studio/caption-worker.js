// Speech recognition stays in this worker; only model files are downloaded.
let transcriber;
self.onmessage = async ({data}) => {
  try {
    const {pipeline, env} = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    if (!transcriber) {
      self.postMessage({type:'status',text:'Mengunduh model Whisper. Unduhan pertama dapat memakan beberapa menit.'});
      transcriber = await pipeline('automatic-speech-recognition','onnx-community/whisper-tiny',{
        dtype:'q8',device:'wasm',progress_callback:p=>{
          if(p.status==='progress')self.postMessage({type:'status',text:`Mengunduh ${p.file.split('/').pop()} · ${Math.round(p.progress||0)}%`});
        }
      });
    }
    self.postMessage({type:'status',text:'Mengenali ucapan… Tetap buka tab ini.'});
    const options = {return_timestamps:true,chunk_length_s:30,stride_length_s:5,task:'transcribe'};
    if(data.language!=='auto') options.language=data.language;
    const output=await transcriber(data.audio,options);
    self.postMessage({type:'complete',output});
  } catch(error) { self.postMessage({type:'error',text:error.message||String(error)}); }
};

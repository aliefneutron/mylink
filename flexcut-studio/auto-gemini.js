const geminiApiBase='https://generativelanguage.googleapis.com/v1beta';
const autoGeminiKeySlot='flexcut-gemini-api-key';
const autoGeminiModels={
 image:'gemini-nano-banana-2.1',
 music:'lyria-3.5',
 speech:'gemini-3.8-flash-tts'
};
const autoGeminiTone={
 casual:'warm, conversational and natural',direct:'clear and concise',story:'warm, expressive storyteller'
};
const autoGeminiVisualStyle={
 pop:'playful editorial illustration, bold shapes, saturated colors, clean focal point',
 film:'cinematic photography, directional light, natural contrast, nuanced mood',
 product:'commercial product photography, attractive lighting, polished clean composition',
 minimal:'minimal editorial photography, generous breathing room, restrained colors'
};
function storedAutoGeminiKey(){
 try{return localStorage.getItem(autoGeminiKeySlot)||''}catch(error){return ''}
}
async function autoGeminiRequest(path,key,body,signal,interactions=false){
 let response;
 try{
  response=await fetch(geminiApiBase+path,{
   method:'POST',credentials:'omit',redirect:'error',signal,
   headers:{'Content-Type':'application/json',...(interactions?
    {'x-goog-api-key':key}:{Authorization:'Bearer '+key})},
   body:JSON.stringify(body)
  });
 }catch(error){
  signal.throwIfAborted();
  throw new Error('Google AI tidak dapat dihubungi. Periksa koneksi dan pembatasan API key.');
 }
 if(!response.ok){
  const hint=response.status===429?'Kuota atau batas permintaan tercapai.':
   response.status===401||response.status===403?'Periksa izin model, API key, dan setelan billing Google AI Studio.':
   'Periksa ketersediaan model dan konfigurasi Google AI Studio.';
  throw Object.assign(new Error('Google AI · HTTP '+response.status+'. '+hint),{status:response.status});
 }
 try{return await response.json()}catch(error){
  throw new Error('Format respons Google AI tidak bisa dibaca.');
 }
}
async function autoGeminiJSON({key,model},system,input,signal){
 const result=await autoGeminiRequest('/openai/chat/completions',key,{
  model,response_format:{type:'json_object'},
  messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}]
 },signal);
 try{return JSON.parse(result.choices?.[0]?.message?.content||'')}
 catch(error){throw new Error('Format naskah Gemini tidak sesuai. Coba ulangi.')}
}
function autoGeminiContext(options){
 return {topic:options.topic,notes:options.brief,language:autoVideoLabels[options.language].language,
  contentType:options.kind,tone:options.tone,visualStyle:autoVideoStyles[options.style].name,durationSeconds:options.duration};
}
async function developAutomaticIdea(options,signal){
 const idea=await autoGeminiJSON(options,
  'Develop the supplied subject into a usable video outline. If the topic is blank, invent one specific, feasible topic consistent with the notes and content type. Return JSON {topic:string,points:string[]}. Preserve the original topic and user-provided facts. Produce 3-6 concise points with an opening, a logical progression, and an ending appropriate to the requested duration, content type, tone and language. Do not invent statistics, prices, product claims, or endorsements. Return no markdown.',
  {...autoGeminiContext(options),direction:motionSkillStyles[options.style]?.direction},signal);
 const topic=options.topic||(typeof idea?.topic==='string'?idea.topic.trim().slice(0,100):'');
 if(!topic||!Array.isArray(idea?.points))throw new Error('Gemini belum menghasilkan topik dan poin cerita yang bisa digunakan.');
 const brief=idea.points.filter(point=>typeof point==='string'&&point.trim()).map(point=>point.trim()).join('\n').slice(0,4500);
 if(!brief)throw new Error('Gemini belum menghasilkan poin cerita.');
 return {topic,brief};
}
function autoGeminiMediaBlock(result,type){
 const steps=Array.isArray(result?.steps)?result.steps:[];
 const output=steps.filter(step=>step.type==='model_output').flatMap(step=>step.content||[]);
 return output.findLast(block=>block.type===type&&typeof block.data==='string'&&block.data.length);
}
async function generateAutoGeminiMedia(key,model,input,format,name,signal,generationConfig){
 const result=await autoGeminiRequest('/interactions',key,{
  model,input,response_format:format,store:false,stream:false,
  ...(generationConfig?{generation_config:generationConfig}:{})
 },signal,true);
 const block=autoGeminiMediaBlock(result,format.type);
 if(!block)throw new Error('Model '+model+' tidak mengembalikan '+(format.type==='image'?'gambar':'audio')+'. Periksa prompt dan akses model.');
 const fileTypes={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','audio/wav':'wav','audio/mpeg':'mp3','audio/mp3':'mp3'};
 const mime=(block.mime_type||format.mime_type||(format.type==='image'?'image/png':'audio/mpeg')).split(';')[0].toLowerCase();
 if(!fileTypes[mime]||!mime.startsWith(format.type+'/'))throw new Error('Format aset dari '+model+' belum didukung.');
 let bytes;
 try{bytes=typeof Uint8Array.fromBase64==='function'?Uint8Array.fromBase64(block.data):Uint8Array.from(atob(block.data),char=>char.charCodeAt(0))}
 catch(error){throw new Error('Data aset dari Google AI tidak dapat dibaca.')}
 return new File([bytes],name+'.'+fileTypes[mime],{type:mime});
}
function generateAutoGeminiPhoto(options,scene,index,total,signal){
 const style=autoVideoStyles[options.style];
 const prompt=`Create one finished editorial image for scene ${index+1} of ${total} in a video about "${options.topic}". Subject and action: ${scene.visual||scene.title}. Scene context: ${scene.caption||scene.title}. Art direction: ${autoGeminiVisualStyle[options.style]}. Shared palette accent ${style.color}. Use a clearly recognizable subject and balanced composition for a ${options.ratio} frame. Keep the main subject centered in the safe area. No captions, watermarks, UI or typography. The editor will add title and subtitles separately.`;
 return generateAutoGeminiMedia(options.key,autoGeminiModels.image,prompt,
  {type:'image',aspect_ratio:options.ratio,image_size:'1K'},'Gemini Foto '+(index+1),signal);
}
function generateAutoGeminiMusic(options,signal){
 const prompt=`An instrumental background score for a video about "${options.topic}". Visual style: ${autoVideoStyles[options.style].name}. Tone: ${options.tone}. Aim for ${options.duration} seconds. Clean production, an unobtrusive stable level for narration, gentle dynamics, no voice, no lyrics, no humming, no vocal samples. Start promptly and end cleanly.`;
 return generateAutoGeminiMedia(options.key,autoGeminiModels.music,prompt,{type:'audio'},'Gemini Musik',signal);
}
function generateAutoGeminiNarration(options,scene,index,length,signal){
 const input=[{type:'user_input',content:[{type:'text',text:scene.caption||scene.title,
  annotations:[{type:'speech_metadata',style:`${autoGeminiTone[options.tone]}. Speak in ${autoVideoLabels[options.language].language}, with clear pronunciation and natural pace. Keep pauses brief and aim to finish within ${length.toFixed(1)} seconds.`}]}]}];
 return generateAutoGeminiMedia(options.key,autoGeminiModels.speech,input,{type:'audio',mime_type:'audio/wav'},'Gemini Narasi '+(index+1),signal,
  {speech_config:[{voice:options.voice||'Kore'}]});
}

/* Context crop sizing and masked compositing adapted from WatermarkRemover-AI.
   See vendor/watermark-ai/NOTICE.md. */
function watermarkAIClient(signal, onStatus) {
 const worker = new Worker(new URL('./watermark-ai-worker.js?v=lama-1', location.href), {type: 'module'});
 let nextId = 0;
 let pending;
 function fail(error) {
  pending?.reject(error);
  pending = null;
 }
 function abort() {
  worker.terminate();
  fail(signal.reason);
 }
 signal.addEventListener('abort', abort, {once: true});
 worker.onmessage = ({data}) => {
  if (data.id !== pending?.id) return;
  if (data.status) return onStatus(data.status);
  if (data.error) fail(new Error(data.error));
  else {
   pending.resolve(data.pixels);
   pending = null;
  }
 };
 worker.onerror = event => fail(new Error(event.message || 'Mesin LaMa tidak dapat dimuat. Cek koneksi lalu coba lagi.'));
 return {
  predict(pixels, width, height, mask) {
   signal.throwIfAborted();
   return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending = {id, resolve, reject};
    worker.postMessage({id, pixels, width, height, mask}, [pixels.buffer]);
   });
  },
  close() {
   signal.removeEventListener('abort', abort);
   worker.terminate();
  }
 };
}

function watermarkAIBounds(start, size, limit) {
 const span = Math.min(limit, size + 128);
 const left = Math.max(0, Math.min(limit - span, start - 64));
 return [left, span];
}

function createWatermarkAIProcessor(client, region, reuseFrames = false) {
 const crop = document.createElement('canvas');
 const cropContext = crop.getContext('2d', {willReadFrequently: true});
 const patch = document.createElement('canvas');
 const patchContext = patch.getContext('2d');
 let previous;
 return async function applyMask(context, width, height) {
  const rect = watermarkPixels(region, width, height);
  if (rect.w * rect.h >= width * height * .9) throw new Error('Pilih area watermark yang lebih kecil agar LaMa punya konteks.');
  const [x, w] = watermarkAIBounds(rect.x, rect.w, width);
  const [y, h] = watermarkAIBounds(rect.y, rect.h, height);
  const scale = Math.min(1, 512 / Math.max(w, h));
  crop.width = Math.max(1, Math.round(w * scale));
  crop.height = Math.max(1, Math.round(h * scale));
  const sx = crop.width / w, sy = crop.height / h;
  const mx = Math.min(crop.width - 1, Math.floor((rect.x - x) * sx));
  const my = Math.min(crop.height - 1, Math.floor((rect.y - y) * sy));
  const mask = {
   x: mx, y: my,
   w: Math.max(1, Math.min(crop.width, Math.ceil((rect.x + rect.w - x) * sx)) - mx),
   h: Math.max(1, Math.min(crop.height, Math.ceil((rect.y + rect.h - y) * sy)) - my)
  };
  cropContext.drawImage(context.canvas, x, y, w, h, 0, 0, crop.width, crop.height);
  const pixels = cropContext.getImageData(0, 0, crop.width, crop.height).data;
  const key = [crop.width, crop.height, mask.x, mask.y, mask.w, mask.h].join(':');
  if (key !== previous?.key || !pixels.every((value, index) => value === previous.pixels[index])) {
   const current = reuseFrames ? pixels.slice() : null;
   const result = await client.predict(pixels, crop.width, crop.height, mask);
   patch.width = mask.w;
   patch.height = mask.h;
   patchContext.putImageData(new ImageData(result, mask.w, mask.h), 0, 0);
   if (current) previous = {key, pixels: current};
  }
  context.clearRect(rect.x, rect.y, rect.w, rect.h);
  context.drawImage(patch, rect.x, rect.y, rect.w, rect.h);
  return context.canvas;
 };
}

async function watermarkAIImage(frame, signal, onStatus, region) {
 const canvas = document.createElement('canvas');
 canvas.width = frame.naturalWidth || frame.videoWidth;
 canvas.height = frame.naturalHeight || frame.videoHeight;
 const context = canvas.getContext('2d');
 context.drawImage(frame, 0, 0);
 const client = watermarkAIClient(signal, onStatus);
 try {
  await createWatermarkAIProcessor(client, region)(context, canvas.width, canvas.height);
  return canvas;
 } finally {
  client.close();
 }
}

async function watermarkAIVideo(asset, clip, region, signal, onStatus, onProgress) {
 onStatus('Membuka video dan memeriksa codec…');
 const bunny = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.66.0/dist/bundles/mediabunny.mjs');
 const blob = await (await fetch(asset.src, {signal})).blob();
 const input = new bunny.Input({source: new bunny.BlobSource(blob), formats: bunny.ALL_FORMATS});
 let client, conversion;
 const abort = () => { conversion?.cancel().catch(() => {}); };
 signal.addEventListener('abort', abort, {once: true});
 try {
  const track = await input.getPrimaryVideoTrack();
  if (!track || !await track.canDecode()) throw new Error('Codec video ini belum bisa diproses oleh browser.');
  const hasAudio = Boolean(await input.getPrimaryAudioTrack());
  const start = clip.in || 0;
  const end = Math.min(await input.computeDuration(), start + clip.duration * (clip.speed || 1));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  let applyMask;
  let frames = 0;
  const video = {
   forceTranscode: true,
   bitrate: bunny.QUALITY_HIGH,
   async process(sample) {
    signal.throwIfAborted();
    if (canvas.width !== sample.displayWidth) canvas.width = sample.displayWidth;
    if (canvas.height !== sample.displayHeight) canvas.height = sample.displayHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    sample.draw(context, 0, 0, canvas.width, canvas.height);
    onStatus('LaMa sedang memproses frame ' + (++frames) + '…');
    return applyMask(context, canvas.width, canvas.height);
   }
  };
  for (const [format, mime, ext] of [[new bunny.Mp4OutputFormat(), 'video/mp4', 'mp4'],
   [new bunny.WebMOutputFormat(), 'video/webm', 'webm']]) {
   signal.throwIfAborted();
   const target = new bunny.BufferTarget();
   const output = new bunny.Output({format, target});
   conversion = await bunny.Conversion.init({input, output, tracks: 'primary', trim: {start, end}, video, showWarnings: false});
   const tracks = conversion.utilizedTracks;
   if (!conversion.isValid || !tracks.some(track => track.isVideoTrack()) ||
       (hasAudio && !tracks.some(track => track.isAudioTrack()))) continue;
   signal.throwIfAborted();
   client = watermarkAIClient(signal, onStatus);
   applyMask = createWatermarkAIProcessor(client, region, true);
   let firstProgress;
   conversion.onProgress = progress => {
    const now = performance.now();
    if (progress > 0 && !firstProgress) firstProgress = {progress, now};
    const advanced = firstProgress ? progress - firstProgress.progress : 0;
    const remaining = advanced > 0 ? (now - firstProgress.now) / 1000 / advanced * (1 - progress) : null;
    onProgress(progress, remaining);
   };
   await conversion.execute();
   signal.throwIfAborted();
   if (!frames || !target.buffer?.byteLength) throw new Error('Tidak ada frame video yang dapat diproses.');
   return {blob: new Blob([target.buffer], {type: mime}), ext, duration: end - start};
  }
  throw new Error('Browser tidak dapat menyimpan hasil video beserta audionya. Coba Chrome atau Edge dengan video MP4.');
 } finally {
  signal.removeEventListener('abort', abort);
  client?.close();
  input.dispose();
 }
}

function watermarkAIPNG(canvas) {
 return new Promise((resolve, reject) => canvas.toBlob(
  blob => blob ? resolve(blob) : reject(new Error('Hasil PNG tidak dapat dibuat.')), 'image/png'
 ));
}

async function storeProcessedAsset(id, blob) {
 const db = await dbPromise;
 if (!db) throw new Error('Penyimpanan browser tidak tersedia untuk media hasil proses.');
 await new Promise((resolve, reject) => {
  const tx = db.transaction('audio', 'readwrite');
  tx.objectStore('audio').put(blob, 'watermark-ai:' + id);
  tx.oncomplete = resolve;
  tx.onabort = () => reject(new Error('Hasil gagal disimpan. Periksa ruang penyimpanan browser.'));
 });
}

async function removeProcessedAsset(id) {
 const db = await dbPromise;
 if (!db) return;
 await new Promise((resolve, reject) => {
  const tx = db.transaction('audio', 'readwrite');
  tx.objectStore('audio').delete('watermark-ai:' + id);
  tx.oncomplete = resolve;
  tx.onabort = reject;
 });
}

async function restoreProcessedAssets() {
 let changed = false;
 for (const asset of assets.filter(asset => (asset.watermarkAI || asset.derivedLocal) && !asset.src)) {
  const blob = await cachedAudio('watermark-ai:' + asset.id);
  if (blob && assets.includes(asset) && !asset.src) {
   asset.src = URL.createObjectURL(blob);
   if (asset.type === 'audio') {
    for (const audio of audios.filter(item => item.assetId === asset.id && !item.src)) audio.src = asset.src;
   }
   changed = true;
  }
 }
 if (changed) render();
}

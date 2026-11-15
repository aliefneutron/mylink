/* RGB tensor preparation, symmetric padding and masked output adapted from
   WatermarkRemover-AI. See vendor/watermark-ai/NOTICE.md. */
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.wasm.min.mjs';

const modelUrl = 'https://huggingface.co/othytenk/lama-int4-int8/resolve/b52ebb642126086fe3da1524a3b1d7629ae4c6a9/lama_int4_int8_r4.onnx';
const modelDigest = '4e3b78a253eb4abf21896811c928ffa91214b916e5d6ced24cecdd7999b4aaa1';
const modelSize = 36931151;
const side = 512;
const plane = side * side;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
ort.env.wasm.numThreads = 1;
let session;

async function downloadWeights(response, id) {
 const bytes = new Uint8Array(modelSize);
 const reader = response.body.getReader();
 let offset = 0, lastUpdate = 0;
 try {
  while (true) {
   const {done, value} = await reader.read();
   if (done) break;
   if (offset + value.length > bytes.length) throw new Error('Ukuran model LaMa tidak sesuai.');
   bytes.set(value, offset);
   offset += value.length;
   if (Date.now() - lastUpdate >= 500) {
    self.postMessage({id, status: 'Mengunduh LaMa… ' + Math.floor(offset / modelSize * 100) + '% (37 MB)'});
    lastUpdate = Date.now();
   }
  }
  if (offset !== modelSize) throw new Error('Unduhan model LaMa belum lengkap. Coba lagi.');
  return bytes;
 } finally {
  await reader.cancel().catch(() => {});
 }
}

async function loadModel(id) {
 if (session) return session;
 const cache = await globalThis.caches?.open('flexcut-lama-v2').catch(() => null);
 const stored = await cache?.match(modelUrl);
 if (!stored) self.postMessage({id, status: 'Mengunduh model LaMa (sekitar 37 MB)…'});
 const response = stored || await fetch(modelUrl);
 if (!response.ok) throw new Error('Unduhan model LaMa gagal. Cek koneksi lalu coba lagi.');
 const bytes = stored ? await response.arrayBuffer() : await downloadWeights(response, id);
 self.postMessage({id, status: 'Menyiapkan model LaMa…'});
 const hash = await crypto.subtle.digest('SHA-256', bytes);
 if (Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') !== modelDigest) {
  await cache?.delete(modelUrl).catch(() => {});
  throw new Error('Model LaMa tidak lengkap. Coba unduh kembali.');
 }
 try {
  session = await ort.InferenceSession.create(bytes, {executionProviders: ['wasm']});
 } catch (error) {
  console.error(error);
  throw new Error('LaMa tidak dapat dijalankan. Coba tutup tab lain dan buka kembali editor di Chrome atau Edge.');
 }
 if (!stored) cache?.put(modelUrl, new Response(bytes)).catch(() => {});
 return session;
}

function reflected(index, size) {
 const offset = index % (2 * size);
 return offset < size ? offset : 2 * size - offset - 1;
}

async function predict(id, {pixels, width, height, mask}) {
 const inference = await loadModel(id);
 const rgb = new Float32Array(3 * plane);
 const selected = new Float32Array(plane);
 for (let y = 0; y < side; y++) {
  const sy = reflected(y, height);
  for (let x = 0; x < side; x++) {
   const sx = reflected(x, width);
   const src = (sy * width + sx) * 4;
   const dst = y * side + x;
   for (let channel = 0; channel < 3; channel++) rgb[channel * plane + dst] = pixels[src + channel] / 255;
   if (sx >= mask.x && sx < mask.x + mask.w && sy >= mask.y && sy < mask.y + mask.h) selected[dst] = 1;
  }
 }
 const inputs = {
  image: new ort.Tensor('float32', rgb, [1, 3, side, side]),
  mask: new ort.Tensor('float32', selected, [1, 1, side, side])
 };
 let tensor;
 try {
  const output = await inference.run(inputs);
  tensor = output.output;
  if (tensor?.dims.join(',') !== '1,3,512,512') throw new Error('Dimensi hasil LaMa tidak sesuai.');
  const prediction = tensor.data;
  const patch = new Uint8ClampedArray(mask.w * mask.h * 4);
  for (let y = 0; y < mask.h; y++) {
   for (let x = 0; x < mask.w; x++) {
    const src = (y + mask.y) * side + x + mask.x;
    const dst = (y * mask.w + x) * 4;
    for (let channel = 0; channel < 3; channel++) {
     const value = prediction[channel * plane + src];
     if (!Number.isFinite(value)) throw new Error('Model LaMa menghasilkan piksel tidak valid.');
     patch[dst + channel] = value;
    }
    patch[dst + 3] = pixels[((y + mask.y) * width + x + mask.x) * 4 + 3];
   }
  }
  return patch;
 } finally {
  inputs.image.dispose();
  inputs.mask.dispose();
  tensor?.dispose();
 }
}

self.onmessage = async ({data}) => {
 const {id} = data;
 try {
  const pixels = await predict(id, data);
  self.postMessage({id, pixels}, [pixels.buffer]);
 } catch (error) {
  self.postMessage({id, error: error.message || String(error)});
 }
};

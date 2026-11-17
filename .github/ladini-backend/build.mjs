import { readFileSync, writeFileSync } from 'node:fs';

const [input, output, endpoint = ''] = process.argv.slice(2);
if (!input || !output) throw new Error('Pemakaian: node build.mjs input.html output.html [https://alamat-worker]');
let apiOrigin = '';
if (endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Alamat API harus berupa origin HTTPS.');
  }
  apiOrigin = url.origin;
}

const asset = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
let html = readFileSync(input, 'utf8');
function insertBefore(marker, markup) {
  if (!html.includes(marker)) throw new Error('Bagian tidak ditemukan: ' + marker);
  html = html.replace(marker, () => markup + '\n' + marker);
}
if (!html.includes('function openVideo(') || !html.includes('const directoryPages = new Map(')) {
  throw new Error('Versi halaman LADINI tidak cocok.');
}
const apiTag = '<meta name="ladini-api" content="' + apiOrigin + '">';
if (html.includes('id="admin-dialog"')) {
  const existing = /<meta name="ladini-api" content="[^"]*">/;
  if (!existing.test(html)) throw new Error('Konfigurasi API LADINI tidak ditemukan.');
  html = html.replace(existing, () => apiTag);
} else {
  insertBefore('</head>', apiTag + '\n<style>' + asset('panel.css') + '</style>');
  insertBefore('<section aria-labelledby="video-title"', '<section id="managed-extras" class="glass content-card block" aria-labelledby="managed-title" hidden><h2 id="managed-title">Pengumuman dan tautan tambahan</h2><ul class="managed-items"></ul></section>');
  insertBefore('</body>', asset('panel.html') + '\n<script>' + asset('panel.js') + '</script>');
}
writeFileSync(output, html);

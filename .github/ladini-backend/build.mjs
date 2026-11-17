import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
// Remove the discontinued service from both navigation and its built-in page.
html = html.replace(/<div data-directory-page="layanan\/penomoran-siva"[\s\S]*?(?=<div data-directory-page=|<\/main>)/, '');
html = html.replace(/<a\b[^>]*href="#layanan\/penomoran-siva"[^>]*>[\s\S]*?<\/a>/g, '');
html = html.replace(/<li>\s*<\/li>/g, '');
html = html.replace(/<script type="application\/json" id="ladini-content-index">[\s\S]*?<\/script>\s*/g, '');
const index = new Map();
function key(value) { return createHash('sha256').update(value).digest('hex').slice(0,20); }
function plain(value) {
  return value.replace(/<svg\b[\s\S]*?<\/svg>/g,'').replace(/<[^>]*>/g,' ')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/\s+/g,' ').trim();
}
html = html.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all,before,href,after,body) => {
  if (!/^(https?:|#)/.test(href) || ['#konten','#beranda'].includes(href) || /class="(?:skip|brand)"/.test(before+after)) return all;
  const id = key('link:' + href);
  const title = plain(body);
  if (!title) return all;
  const kind = href.startsWith('#layanan') ? 'layanan' : href.startsWith('#informasi') ? 'informasi' : 'tautan';
  index.set(id, {id,kind,title:title.slice(0,160),url:href.replace(/&amp;/g,'&'),description:'Tautan bawaan LADINI'});
  return '<a' + before.replace(/ data-link-key="[^"]*"/g,'') + 'href="' + href + '"' +
    after.replace(/ data-link-key="[^"]*"/g,'') + ' data-link-key="' + id + '">' + body + '</a>';
});
html = html.replace(/<button\b([^>]*data-video="([^"]+)"[^>]*)>/g,(all,attributes,id)=>{
  const title = attributes.match(/data-title="([^"]+)"/)?.[1] || attributes.match(/aria-label="Putar ([^"]+)"/)?.[1];
  if (!title || !/^[\w-]{11}$/.test(id)) return all;
  const contentId = key('video:'+id);
  index.set(contentId,{id:contentId,kind:'video',title:plain(title),url:'https://www.youtube.com/watch?v='+id,description:'Video bawaan LADINI'});
  return '<button'+attributes.replace(/ data-link-key="[^"]*"/g,'')+' data-link-key="'+contentId+'">';
});
const contentIndex = '<script type="application/json" id="ladini-content-index">' +
  JSON.stringify([...index.values()]).replaceAll('<','\\u003c') + '</script>';
html = html.replace("const player = document.createElement('iframe');",
  "const directVideo = !button.dataset.video && button.dataset.videoUrl;\n    const player = document.createElement(directVideo ? 'video' : 'iframe');\n    if (directVideo) { player.controls = true; player.playsInline = true; }");
html = html.replace("player.src = 'https://www.youtube.com/embed/' + button.dataset.video + '?autoplay=1&playsinline=1&rel=0';",
  "player.src = directVideo ? button.dataset.videoUrl : 'https://www.youtube.com/embed/' + button.dataset.video + '?autoplay=1&playsinline=1&rel=0';");
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
  const css = /<style>\.admin-entry[\s\S]*?<\/style>/;
  const panel = /<button type="button" class="admin-entry"[\s\S]*?<\/template>/;
  const script = /<script>\(\(\) => \{\s*const apiBase[\s\S]*?<\/script>/;
  if (![css, panel, script].every((pattern) => pattern.test(html))) {
    throw new Error('Struktur integrasi admin tidak cocok.');
  }
  html = html.replace(css, () => '<style>' + asset('panel.css') + '</style>')
    .replace(panel, () => asset('panel.html').trim())
    .replace(script, () => contentIndex + '\n<script>' + asset('panel.js') + '</script>');
} else {
  insertBefore('</head>', apiTag + '\n<style>' + asset('panel.css') + '</style>');
  insertBefore('<section aria-labelledby="video-title"', '<section id="managed-extras" class="glass content-card block" aria-labelledby="managed-title" hidden><h2 id="managed-title">Pengumuman dan tautan tambahan</h2><ul class="managed-items"></ul></section>');
  insertBefore('</body>', asset('panel.html') + '\n' + contentIndex + '\n<script>' + asset('panel.js') + '</script>');
}
writeFileSync(output, html);

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const code = 'LDN-local-integration-test-1234567890';
const origin = 'http://127.0.0.1:8791';
const child = spawn(process.execPath, [fileURLToPath(new URL('preview.mjs', import.meta.url))], {
  env: { ...process.env, LADINI_PORT: '8791', LADINI_PREVIEW_CODE: code, LADINI_DB: ':memory:' },
  stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true
});
const timeout = AbortSignal.timeout(12000);

async function request(path, status, { method = 'GET', body, session, from = origin } = {}) {
  const response = await fetch(origin + '/api/' + path, {
    method,
    headers: { Origin: from, ...(body && { 'Content-Type': 'application/json' }),
      ...(session && { Authorization: 'Bearer ' + session }) },
    body: body && JSON.stringify(body),
    signal: timeout
  });
  const payload = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, JSON.stringify(payload));
  return payload;
}

try {
  await once(child.stdout, 'data', { signal: timeout });
  await request('admin', 401);
  await request('login', 401, { method: 'POST', body: { code: code + '-wrong' } });
  await request('stats', 403, { from: 'https://unapproved.example' });
  const owner = (await request('login', 200, { method: 'POST', body: { code } })).session;
  const customEditorCode = 'Editor-Ladini-2026';
  const override = '0123456789abcdef0123';
  await request('admin/overrides/'+override,401,{method:'PATCH',body:{title:'Uji',url:'https://example.com'}});
  await request('admin/overrides/'+override,400,{method:'PATCH',session:owner,body:{title:'Uji',url:'javascript:alert(1)'}});
  await request('admin/overrides/'+override,204,{method:'PATCH',session:owner,body:{title:'Layanan diperbarui',url:'#layanan'}});
  assert.equal((await request('content',200)).overrides[0].url,'#layanan');
  await request('admin/overrides/'+override,204,{method:'DELETE',session:owner});
  assert.equal((await request('content',200)).overrides[0].hidden,1);
  await request('admin/overrides/'+override,204,{method:'POST',session:owner});
  assert.equal((await request('content',200)).overrides.length,0);
  await request('admin/overrides/'+override,204,{method:'PATCH',session:owner,body:{kind:'teks',title:'Profil baru',body:'Isi profil diperbarui melalui admin.'}});
  assert.equal((await request('content',200)).overrides[0].body,'Isi profil diperbarui melalui admin.');
  await request('admin/overrides/'+override,204,{method:'DELETE',session:owner});
  assert.equal((await request('content',200)).overrides[0].hidden,1);
  await request('admin/overrides/'+override,204,{method:'POST',session:owner});
  await request('admin/accounts', 201, {method:'POST', session:owner, body:{name:'Editor kode pilihan',code:customEditorCode}});
  const customEditor = await request('login',200,{method:'POST',body:{code:customEditorCode}});
  await request('admin/accounts',409,{method:'POST',session:owner,body:{name:'Duplikat',code:customEditorCode}});
  await request('admin/code',403,{method:'POST',session:customEditor.session,body:{currentCode:'Salah-ladini-2026',newCode:'Kode-Baru-2026',confirmCode:'Kode-Baru-2026'}});
  await request('admin/code',400,{method:'POST',session:customEditor.session,body:{currentCode:customEditorCode,newCode:'short',confirmCode:'short'}});
  await request('admin/code',409,{method:'POST',session:customEditor.session,body:{currentCode:customEditorCode,newCode:code,confirmCode:code}});
  const otherSession = (await request('login',200,{method:'POST',body:{code:customEditorCode}})).session;
  await request('admin/code',204,{method:'POST',session:customEditor.session,body:{currentCode:customEditorCode,newCode:'Kode-Baru-2026',confirmCode:'Kode-Baru-2026'}});
  await request('login',401,{method:'POST',body:{code:customEditorCode}});
  await request('admin',401,{session:otherSession});
  await request('admin',200,{session:customEditor.session});
  await request('login',200,{method:'POST',body:{code:'Kode-Baru-2026'}});

  const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  await request('admin/images',401,{method:'POST',body:{caption:'Uji gambar',data:imageData}});
  await request('admin/images',400,{method:'POST',session:owner,body:{caption:'Isi salah',data:'data:image/png;base64,aW52YWxpZA=='}});
  await request('admin/images',204,{method:'POST',session:owner,body:{caption:'Uji gambar',data:imageData}});
  const image = (await request('images',200)).images[0];
  const file = await fetch(origin+'/api/images/'+image.id,{signal:timeout});
  assert.equal(file.status,200);
  assert.equal(file.headers.get('Content-Type'),'image/png');
  assert.ok((await file.arrayBuffer()).byteLength > 0);
  await request('admin/images/'+image.id,204,{method:'DELETE',session:owner});
  assert.equal((await request('images',200)).images.length,0);
  await request('stats?tz=Invalid/Timezone',400);
  const editorCode = (await request('admin/accounts', 201, {
    method: 'POST', session: owner, body: { name: 'Editor uji' }
  })).code;
  const editor = await request('login', 200, { method: 'POST', body: { code: editorCode } });
  assert.equal(editor.account.role, 'editor');
  const settings = {title:'Portal Uji LADINI',subtitle:'Layanan terpadu',theme:'light',accent:'#086246',background:'#f2f7f4',
    logoId:'',backgroundId:'',tabs:[{id:crypto.randomUUID(),label:'Panduan',type:'page',body:'Panduan layanan',url:''}]};
  await request('admin/settings',403,{method:'PATCH',session:editor.session,body:{version:0,value:settings}});
  await request('admin/settings',400,{method:'PATCH',session:owner,body:{version:0,value:{...settings,accent:'bad'}}});
  const stored = await request('admin/settings',200,{method:'PATCH',session:owner,body:{version:0,value:settings}});
  assert.equal(stored.version,1);
  assert.equal(stored.value.tabs[0].url,'#halaman/'+settings.tabs[0].id);
  assert.equal((await request('content',200)).settings.value.title,settings.title);
  await request('admin/settings',409,{method:'PATCH',session:owner,body:{version:0,value:settings}});
  await request('admin/settings',200,{method:'PATCH',session:owner,body:{version:1,value:{...settings,theme:'dark'}}});
  await request('admin/accounts', 403, { method: 'POST', session: editor.session, body: { name: 'Dilarang' } });

  const video = { kind: 'video', title: 'Maklumat Pelayanan', url: 'https://youtube.com/shorts/WE-JFoLffeY' };
  await request('admin/content', 400, { method: 'POST', session: owner, body: { ...video, url: 'javascript:alert(1)' } });
  await request('admin/content', 204, { method: 'POST', session: editor.session, body: video });
  await request('admin/content', 204, {
    method: 'POST', session: owner, body: { kind: 'layanan', title: 'Layanan uji', url: 'https://example.com/layanan' }
  });
  await request('admin/content', 204, {
    method: 'POST', session: owner,
    body: { kind: 'video', title: 'Video mandiri', url: 'https://example.com/ladini.mp4' }
  });
  let { items } = await request('content', 200);
  const recorded = items.find((item) => item.title === video.title);
  assert.equal(recorded.youtube_id, 'WE-JFoLffeY');
  assert.equal(items.find((item) => item.title === 'Video mandiri').youtube_id, null);
  await request('admin/content/' + recorded.id, 204, {
    method: 'PATCH', session: owner, body: { ...video, title: 'Video diperbarui' }
  });
  ({ items } = await request('content', 200));
  assert.ok(items.some((item) => item.title === 'Video diperbarui'));

  await request('admin/accounts/' + editor.account.id, 204, { method: 'DELETE', session: owner });
  await request('admin', 401, { session: editor.session });
  await request('login', 401, { method: 'POST', body: { code: editorCode } });
  await request('admin/content/' + recorded.id, 204, { method: 'DELETE', session: owner });
  assert.ok(!(await request('content', 200)).items.some((item) => item.id === recorded.id));

  const visitor = crypto.randomUUID();
  const view = crypto.randomUUID();
  for (const data of [
    { visitor, view }, { visitor, view }, { visitor, view: crypto.randomUUID() },
    { visitor }, { visitor: crypto.randomUUID(), view: crypto.randomUUID() }
  ]) await request('visit', 204, { method: 'POST', body: data });
  const stats = await request('stats', 200);
  assert.equal(stats.online, 2);
  assert.equal(stats.visitors_today, 2);
  assert.equal(stats.views_today, 3);
  assert.equal(stats.visitors_month, 2);
  assert.equal(stats.visitors_last_month, 0);
  assert.equal(stats.visitors_total, 2);
  assert.equal(stats.views_total, 3);
  const localStats = await request('stats?tz=Pacific/Honolulu',200);
  assert.equal(localStats.views_today,3);
  assert.equal(localStats.visitors_today,2);

  await request('admin/logout', 204, { session: owner, method: 'POST' });
  await request('admin', 401, { session: owner });
  console.log('Lulus: kode pilihan dan perubahan kode, sesi, peran, gambar, tautan, zona waktu, CORS dan deduplikasi.');
} finally {
  child.kill();
}

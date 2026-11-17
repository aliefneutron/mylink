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
  const editorCode = (await request('admin/accounts', 201, {
    method: 'POST', session: owner, body: { name: 'Editor uji' }
  })).code;
  const editor = await request('login', 200, { method: 'POST', body: { code: editorCode } });
  assert.equal(editor.account.role, 'editor');
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

  await request('admin/logout', 204, { session: owner, method: 'POST' });
  await request('admin', 401, { session: owner });
  console.log('Lulus: autentikasi, peran, cabut akses, tautan, CORS, statistik dan deduplikasi tayangan.');
} finally {
  child.kill();
}

const kinds = new Set(['video', 'layanan', 'informasi', 'pengumuman', 'tautan']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hour = 3600000;
const encoder = new TextEncoder();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function respond(data, status, origin) {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return status === 204 ? new Response(null, { status, headers }) : Response.json(data, { status, headers });
}

async function json(request, limit = 8192) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'Payload harus berupa JSON.');
  }
  const stream = request.body?.getReader();
  if (!stream) throw new ApiError(400, 'Data kosong.');
  const decoder = new TextDecoder();
  let value = '';
  let length = 0;
  while (true) {
    const item = await stream.read();
    if (item.done) break;
    length += item.value.length;
    if (length > limit) {
      await stream.cancel();
      throw new ApiError(413, 'Data terlalu panjang.');
    }
    value += decoder.decode(item.value, { stream: true });
  }
  try {
    const result = JSON.parse(value + decoder.decode());
    if (result && typeof result === 'object' && !Array.isArray(result)) return result;
  } catch {
    // Invalid JSON uses the same response as an invalid shape.
  }
  throw new ApiError(400, 'Data tidak valid.');
}

function text(value, limit) {
  return typeof value === 'string' && value.trim().length <= limit ? value.trim() : '';
}

function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function accessHash(code, env) {
  if (!env.CODE_PEPPER) throw new ApiError(503, 'Pengaturan kode akses belum siap.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.CODE_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(code)));
  return 'hmac:' + Array.from(signed, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function chosenCode(input) {
  if (typeof input !== 'string' || input.trim() !== input || input.length < 10 || input.length > 128) {
    throw new ApiError(400, 'Kode akses harus 10–128 karakter tanpa spasi di awal atau akhir.');
  }
  return input;
}

function codeConflict(error) {
  if (/UNIQUE constraint failed: accounts.code_hash/i.test(error.message)) {
    throw new ApiError(409, 'Kode sudah digunakan akun lain. Pilih kode berbeda.');
  }
  throw error;
}

function sameDigest(a, b) {
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function safeURL(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {
    // An invalid URL receives the same response as a disallowed scheme.
  }
  throw new ApiError(400, 'Masukkan tautan HTTPS yang valid.');
}

function contentPayload(input) {
  const kind = input.kind;
  const title = text(input.title, 160);
  const description = text(input.description, 700);
  if (!kinds.has(kind) || !title || (input.description && !description)) {
    throw new ApiError(400, 'Isi kategori, judul, dan deskripsi dengan benar.');
  }
  const rawURL = text(input.url, 2048);
  if (kind !== 'video' && /^#[A-Za-z0-9][A-Za-z0-9/?=%_.&-]*$/.test(rawURL)) {
    return [kind, title, description, rawURL, null];
  }
  const url = safeURL(rawURL);
  let videoId = null;
  if (kind === 'video') {
    if (url.hostname === 'youtu.be') videoId = url.pathname.split('/')[1];
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      videoId = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
    }
    if (!/^[\w-]{11}$/.test(videoId || '')) {
      if (!/\.(mp4|webm|ogv)$/i.test(url.pathname)) {
        throw new ApiError(400, 'Gunakan tautan YouTube atau tautan langsung ke MP4, WebM, atau OGV.');
      }
      videoId = null;
    }
  }
  return [kind, title, description, url.href, videoId];
}

const publicFields = 'id, kind, title, description, url, youtube_id, updated_at';
async function listContent(db) {
  return (await db.prepare('SELECT ' + publicFields + ' FROM content ORDER BY updated_at DESC, id').all()).results;
}
async function listOverrides(db) {
  return (await db.prepare('SELECT id, title, url, hidden FROM link_overrides').all()).results;
}

async function login(request, env, now) {
  const db = env.DB;
  const input = await json(request);
  const code = text(input.code, 140);
  if (code.length < 10) throw new ApiError(401, 'Kode akses tidak valid.');
  const boundary = Math.floor(now / (5 * 60000));
  const address = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = await digest('login:' + address + ':' + boundary);
  await db.prepare('DELETE FROM attempts WHERE expires_at <= ?').bind(now).run();
  const attempt = await db.prepare(`INSERT INTO attempts VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count`).bind(bucket, (boundary + 1) * 5 * 60000).first();
  if (attempt.count > 10) throw new ApiError(429, 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.');
  const hash = await digest(code);
  const secureHash = env.CODE_PEPPER ? await accessHash(code, env) : '';
  let account = await db.prepare('SELECT id, name, role FROM accounts WHERE code_hash IN (?, ?) AND disabled = 0').bind(hash, secureHash).first();
  if (!account && env.BOOTSTRAP_CODE?.length >= 24 && sameDigest(hash, await digest(env.BOOTSTRAP_CODE))) {
    await db.prepare("INSERT OR IGNORE INTO accounts VALUES (?, 'Pemilik LADINI', 'owner', ?, 0, ?)").bind(crypto.randomUUID(), hash, now).run();
    account = await db.prepare("SELECT id, name, role FROM accounts WHERE role = 'owner' AND code_hash = ? AND disabled = 0").bind(hash).first();
  }
  if (!account) throw new ApiError(401, 'Kode akses tidak valid.');
  const session = token();
  const sessionHash = await digest(session);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(sessionHash, account.id, now + 8 * hour)
  ]);
  return { session, account };
}

async function authenticate(request, db, now) {
  const session = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{48})$/)?.[1];
  if (!session) throw new ApiError(401, 'Masuk dengan kode akses.');
  const hash = await digest(session);
  const account = await db.prepare(`SELECT a.id, a.name, a.role FROM accounts a
    JOIN sessions s ON s.account_id = a.id WHERE s.token_hash = ? AND s.expires_at > ? AND a.disabled = 0`).bind(hash, now).first();
  if (!account) throw new ApiError(401, 'Sesi berakhir. Masuk kembali.');
  return { account, hash };
}

async function recordVisit(request, db, now) {
  const input = await json(request);
  if (!uuid.test(input.visitor || '') || (input.view && !uuid.test(input.view))) {
    throw new ApiError(400, 'Identitas kunjungan tidak valid.');
  }
  const id = await digest('visitor:' + input.visitor);
  const updates = [db.prepare(`INSERT INTO visitors VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen = MAX(visitors.last_seen, excluded.last_seen)`).bind(id, now)];
  if (input.view) {
    const day = localDay(now);
    updates.push(db.prepare('INSERT OR IGNORE INTO visitor_days VALUES (?, ?)').bind(day, id));
    updates.push(db.prepare('INSERT OR IGNORE INTO page_views (id, day, created_at, visitor) VALUES (?, ?, ?, ?)').bind(input.view, day, now, id));
  }
  await db.batch(updates);
}

function localDay(now) {
  return new Date(now + 7 * hour).toISOString().slice(0, 10);
}

function localBoundary(year, month, day, timezone) {
  const target = Date.UTC(year, month - 1, day);
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const values = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]));
    const local = Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour, +values.minute, +values.second);
    const next = instant + target - local;
    if (next === instant) break;
    instant = next;
  }
  return instant;
}

function getStats(db, now, timezone = 'Asia/Jakarta') {
  let date;
  try { date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { throw new ApiError(400, 'Zona waktu tidak valid.'); }
  const parts = Object.fromEntries(date.formatToParts(now).map((part) => [part.type, part.value]));
  const year = +parts.year, monthNumber = +parts.month, dayNumber = +parts.day;
  const day = parts.year + '-' + parts.month + '-' + parts.day;
  const month = parts.year + '-' + parts.month + '-01';
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const previousMonth = previous.toISOString().slice(0, 10);
  const todayAt = localBoundary(year, monthNumber, dayNumber, timezone);
  const tomorrowDate = new Date(Date.UTC(year, monthNumber - 1, dayNumber + 1));
  const tomorrowAt = localBoundary(tomorrowDate.getUTCFullYear(), tomorrowDate.getUTCMonth()+1, tomorrowDate.getUTCDate(), timezone);
  const monthAt = localBoundary(year, monthNumber, 1, timezone);
  const previousAt = localBoundary(previous.getUTCFullYear(), previous.getUTCMonth()+1, 1, timezone);
  return db.prepare(`SELECT
    (SELECT COUNT(*) FROM visitors WHERE last_seen >= ?) AS online,
    (SELECT COUNT(DISTINCT visitor) FROM (
      SELECT visitor FROM page_views WHERE created_at >= ? AND created_at < ?
      UNION SELECT visitor FROM visitor_days WHERE day = ? AND EXISTS (SELECT 1 FROM page_views WHERE created_at = 0 AND day = ?)
    )) AS visitors_today,
    (SELECT COUNT(*) FROM page_views WHERE (created_at >= ? AND created_at < ?) OR (created_at = 0 AND day = ?)) AS views_today,
    (SELECT COUNT(DISTINCT visitor) FROM (
      SELECT visitor FROM page_views WHERE created_at >= ?
      UNION SELECT visitor FROM visitor_days WHERE day >= ? AND EXISTS (SELECT 1 FROM page_views WHERE created_at = 0 AND day = visitor_days.day)
    )) AS visitors_month,
    (SELECT COUNT(DISTINCT visitor) FROM (
      SELECT visitor FROM page_views WHERE created_at >= ? AND created_at < ?
      UNION SELECT visitor FROM visitor_days WHERE day >= ? AND day < ? AND EXISTS (SELECT 1 FROM page_views WHERE created_at = 0 AND day = visitor_days.day)
    )) AS visitors_last_month,
    (SELECT COUNT(*) FROM page_views) AS views_total,
    (SELECT COUNT(DISTINCT visitor) FROM visitor_days) AS visitors_total`)
    .bind(now - 5 * 60000, todayAt, tomorrowAt, day, day, todayAt, tomorrowAt, day,
      monthAt, month, previousAt, monthAt, previousMonth, month).first();
}

async function route(request, env, origin) {
  const db = env.DB;
  const { pathname } = new URL(request.url);
  const method = request.method;
  const now = Date.now();
  const ok = (data, status = 200) => respond(data, status, origin);
  if (method === 'OPTIONS') return ok(null, 204);
  if (method === 'GET' && pathname === '/api/content') return ok({ items: await listContent(db), overrides: await listOverrides(db) });
  if (method === 'GET' && pathname === '/api/stats') return ok(await getStats(db, now, new URL(request.url).searchParams.get('tz') || 'Asia/Jakarta'));
  if (method === 'GET' && pathname === '/api/images') {
    return ok({ images: (await db.prepare('SELECT id, caption, created_at FROM images ORDER BY created_at DESC, id').all()).results });
  }
  const imageId = pathname.match(/^\/api\/images\/([a-f0-9-]+)$/)?.[1];
  if (method === 'GET' && uuid.test(imageId || '')) {
    const image = await db.prepare('SELECT mime, data FROM images WHERE id = ?').bind(imageId).first();
    if (!image) throw new ApiError(404, 'Gambar tidak ditemukan.');
    const binary = Uint8Array.from(atob(image.data), (char) => char.charCodeAt(0));
    return new Response(binary, { headers: { 'Content-Type': image.mime, 'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff', ...(origin && { 'Access-Control-Allow-Origin': origin }) } });
  }
  if (method === 'POST' && pathname === '/api/visit') {
    if (!origin) throw new ApiError(403, 'Asal kunjungan tidak valid.');
    await recordVisit(request, db, now);
    return ok(null, 204);
  }
  if (method === 'POST' && pathname === '/api/login') return ok(await login(request, env, now));
  if (!pathname.startsWith('/api/admin')) throw new ApiError(404, 'Halaman tidak ditemukan.');

  const { account, hash } = await authenticate(request, db, now);
  if (method === 'GET' && pathname === '/api/admin') return ok({
    account,
    items: await listContent(db),
    overrides: await listOverrides(db),
    images: (await db.prepare('SELECT id, caption, created_at FROM images ORDER BY created_at DESC, id').all()).results,
    accounts: account.role === 'owner'
      ? (await db.prepare('SELECT id, name, role, disabled FROM accounts ORDER BY created_at').all()).results : []
  });
  const overrideId = pathname.match(/^\/api\/admin\/overrides\/([a-f0-9]{20})$/)?.[1];
  if (overrideId && method === 'PATCH') {
    const input = await json(request);
    const title = text(input.title, 160);
    let url = text(input.url, 2048);
    if (!title || !url) throw new ApiError(400, 'Isi judul dan tautan yang valid.');
    if (input.kind === 'video') contentPayload({kind:'video',title,url});
    else if (!/^#[A-Za-z0-9][A-Za-z0-9/?=%_.&-]*$/.test(url)) url = safeURL(url).href;
    await db.prepare(`INSERT INTO link_overrides VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, url=excluded.url, hidden=0, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
      .bind(overrideId, title, url, now, account.id).run();
    return ok(null, 204);
  }
  if (overrideId && method === 'DELETE') {
    await db.prepare(`INSERT INTO link_overrides VALUES (?, '', '', 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET hidden=1, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
      .bind(overrideId, now, account.id).run();
    return ok(null, 204);
  }
  if (overrideId && method === 'POST') {
    await db.prepare('DELETE FROM link_overrides WHERE id = ?').bind(overrideId).run();
    return ok(null, 204);
  }
  if (method === 'POST' && pathname === '/api/admin/images') {
    const input = await json(request, 1450000);
    const caption = text(input.caption, 200);
    const match = typeof input.data === 'string' && input.data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!caption || !match || match[2].length > 1398104) throw new ApiError(400, 'Gunakan gambar JPG, PNG, atau WebP maksimal 1 MB dan isi keterangannya.');
    let bytes;
    try { bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)); }
    catch { throw new ApiError(400, 'Gambar tidak valid.'); }
    const starts = (...signature) => signature.every((value, index) => bytes[index] === value);
    const valid = (match[1] === 'image/jpeg' && starts(255,216,255)) ||
      (match[1] === 'image/png' && starts(137,80,78,71,13,10,26,10)) ||
      (match[1] === 'image/webp' && starts(82,73,70,70) && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP');
    if (!valid || bytes.length > 1048576) throw new ApiError(400, 'Isi gambar atau ukurannya tidak valid.');
    const saved = await db.prepare(`INSERT INTO images SELECT ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM images) < 100 AND
      (SELECT COALESCE(SUM(length(data)), 0) FROM images) + ? <= 69905066`)
      .bind(crypto.randomUUID(), caption, match[1], match[2], now, account.id, match[2].length).run();
    if (!saved.meta.changes) throw new ApiError(409, 'Galeri penuh. Hapus gambar yang sudah tidak digunakan.');
    return ok(null, 204);
  }
  const deletedImage = pathname.match(/^\/api\/admin\/images\/([a-f0-9-]+)$/)?.[1];
  if (method === 'DELETE' && uuid.test(deletedImage || '')) {
    await db.prepare('DELETE FROM images WHERE id = ?').bind(deletedImage).run();
    return ok(null, 204);
  }
  if (method === 'POST' && pathname === '/api/admin/logout') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return ok(null, 204);
  }
  if (method === 'POST' && pathname === '/api/admin/code') {
    const input = await json(request);
    const newCode = chosenCode(input.newCode);
    if (newCode !== input.confirmCode) throw new ApiError(400, 'Konfirmasi kode belum sama.');
    const currentCode = text(input.currentCode, 140);
    const oldHash = await digest(currentCode);
    const currentHash = await accessHash(currentCode, env);
    const stored = await db.prepare('SELECT code_hash FROM accounts WHERE id = ? AND disabled = 0').bind(account.id).first();
    if (!stored || ![oldHash, currentHash].includes(stored.code_hash)) {
      throw new ApiError(403, 'Kode akses saat ini salah.');
    }
    const newHash = await accessHash(newCode, env);
    const duplicate = await db.prepare('SELECT id FROM accounts WHERE code_hash IN (?, ?) AND id != ?')
      .bind(newHash, await digest(newCode), account.id).first();
    if (duplicate) throw new ApiError(409, 'Kode sudah digunakan akun lain. Pilih kode berbeda.');
    try {
      const changed = await db.batch([
        db.prepare('UPDATE accounts SET code_hash = ? WHERE id = ? AND code_hash = ? AND disabled = 0')
          .bind(newHash, account.id, stored.code_hash),
        db.prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash != ? AND EXISTS (SELECT 1 FROM accounts WHERE id = ? AND code_hash = ?)')
          .bind(account.id, hash, account.id, newHash)
      ]);
      if (!changed[0].meta.changes) throw new ApiError(409, 'Kode sudah berubah. Masuk kembali lalu ulangi.');
    } catch (error) { codeConflict(error); }
    return ok(null, 204);
  }
  if (method === 'POST' && pathname === '/api/admin/content') {
    const input = contentPayload(await json(request));
    const changed = await db.prepare(`INSERT INTO content (id, kind, title, description, url, youtube_id, updated_at, updated_by)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM content) < 1000`)
      .bind(crypto.randomUUID(), ...input, now, account.id).run();
    if (!changed.meta.changes) throw new ApiError(409, 'Batas 1.000 tautan sudah tercapai.');
    return ok(null, 204);
  }
  const id = pathname.split('/').at(-1);
  if (uuid.test(id) && pathname === '/api/admin/content/' + id) {
    if (method === 'PATCH') {
      const input = contentPayload(await json(request));
      const changed = await db.prepare(`UPDATE content SET kind = ?, title = ?, description = ?, url = ?, youtube_id = ?,
        updated_at = ?, updated_by = ? WHERE id = ?`).bind(...input, now, account.id, id).run();
      if (!changed.meta.changes) throw new ApiError(404, 'Tautan tidak ditemukan.');
      return ok(null, 204);
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM content WHERE id = ?').bind(id).run();
      return ok(null, 204);
    }
  }
  if (pathname.startsWith('/api/admin/accounts') && account.role !== 'owner') throw new ApiError(403, 'Hanya pemilik yang dapat mengelola akun.');
  if (method === 'POST' && pathname === '/api/admin/accounts') {
    const input = await json(request);
    const name = text(input.name, 80);
    if (!name) throw new ApiError(400, 'Masukkan nama editor.');
    const code = input.code ? chosenCode(input.code) : 'LDN-' + token();
    const codeHash = await accessHash(code, env);
    const duplicate = await db.prepare('SELECT id FROM accounts WHERE code_hash IN (?, ?)')
      .bind(codeHash, await digest(code)).first();
    if (duplicate) throw new ApiError(409, 'Kode sudah digunakan akun lain. Pilih kode berbeda.');
    let changed;
    try { changed = await db.prepare(`INSERT INTO accounts
      SELECT ?, ?, 'editor', ?, 0, ? WHERE (SELECT COUNT(*) FROM accounts WHERE disabled = 0) < 50`)
      .bind(crypto.randomUUID(), name, codeHash, now).run();
    } catch (error) { codeConflict(error); }
    if (!changed.meta.changes) throw new ApiError(409, 'Batas 50 akun aktif sudah tercapai.');
    return ok({ code }, 201);
  }
  if (uuid.test(id) && pathname === '/api/admin/accounts/' + id && method === 'DELETE') {
    await db.batch([
      db.prepare("UPDATE accounts SET disabled = 1 WHERE id = ? AND role = 'editor'").bind(id),
      db.prepare("DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE id = ? AND role = 'editor')").bind(id)
    ]);
    return ok(null, 204);
  }
  throw new ApiError(404, 'Halaman tidak ditemukan.');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = env.SITE_ORIGIN || new URL(request.url).origin;
    if (origin && origin !== allowed) return respond({ error: 'Asal permintaan tidak diizinkan.' }, 403, null);
    try {
      return await route(request, env, origin);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('LADINI API:', error.message);
      return respond({ error: error instanceof ApiError ? error.message : 'Layanan LADINI sedang mengalami kendala.' },
        error instanceof ApiError ? error.status : 500, origin);
    }
  }
};

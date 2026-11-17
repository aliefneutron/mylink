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

async function json(request) {
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
    if (length > 8192) {
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
  const url = safeURL(text(input.url, 2048));
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

async function login(request, env, now) {
  const db = env.DB;
  const input = await json(request);
  const code = text(input.code, 140);
  if (code.length < 24) throw new ApiError(401, 'Kode akses tidak valid.');
  const boundary = Math.floor(now / (5 * 60000));
  const address = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = await digest('login:' + address + ':' + boundary);
  await db.prepare('DELETE FROM attempts WHERE expires_at <= ?').bind(now).run();
  const attempt = await db.prepare(`INSERT INTO attempts VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count`).bind(bucket, (boundary + 1) * 5 * 60000).first();
  if (attempt.count > 10) throw new ApiError(429, 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.');
  const hash = await digest(code);
  let account = await db.prepare('SELECT id, name, role FROM accounts WHERE code_hash = ? AND disabled = 0').bind(hash).first();
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
    updates.push(db.prepare('INSERT OR IGNORE INTO page_views VALUES (?, ?)').bind(input.view, day));
  }
  await db.batch(updates);
}

function localDay(now) {
  return new Date(now + 7 * hour).toISOString().slice(0, 10);
}

function getStats(db, now) {
  const day = localDay(now);
  const month = day.slice(0, 7) + '-01';
  const previousMonth = new Date(Date.parse(month + 'T00:00:00Z') - 24 * hour).toISOString().slice(0, 7) + '-01';
  return db.prepare(`SELECT
    (SELECT COUNT(*) FROM visitors WHERE last_seen >= ?) AS online,
    (SELECT COUNT(*) FROM visitor_days WHERE day = ?) AS visitors_today,
    (SELECT COUNT(*) FROM page_views WHERE day = ?) AS views_today,
    (SELECT COUNT(DISTINCT visitor) FROM visitor_days WHERE day >= ?) AS visitors_month,
    (SELECT COUNT(DISTINCT visitor) FROM visitor_days WHERE day >= ? AND day < ?) AS visitors_last_month,
    (SELECT COUNT(*) FROM page_views) AS views_total,
    (SELECT COUNT(DISTINCT visitor) FROM visitor_days) AS visitors_total`)
    .bind(now - 5 * 60000, day, day, month, previousMonth, month).first();
}

async function route(request, env, origin) {
  const db = env.DB;
  const { pathname } = new URL(request.url);
  const method = request.method;
  const now = Date.now();
  const ok = (data, status = 200) => respond(data, status, origin);
  if (method === 'OPTIONS') return ok(null, 204);
  if (method === 'GET' && pathname === '/api/content') return ok({ items: await listContent(db) });
  if (method === 'GET' && pathname === '/api/stats') return ok(await getStats(db, now));
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
    accounts: account.role === 'owner'
      ? (await db.prepare('SELECT id, name, role, disabled FROM accounts ORDER BY created_at').all()).results : []
  });
  if (method === 'POST' && pathname === '/api/admin/logout') {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
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
    const name = text((await json(request)).name, 80);
    if (!name) throw new ApiError(400, 'Masukkan nama editor.');
    const code = 'LDN-' + token();
    const changed = await db.prepare(`INSERT INTO accounts
      SELECT ?, ?, 'editor', ?, 0, ? WHERE (SELECT COUNT(*) FROM accounts WHERE disabled = 0) < 50`)
      .bind(crypto.randomUUID(), name, await digest(code), now).run();
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

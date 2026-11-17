import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.mjs';

const db = new DatabaseSync(process.env.LADINI_DB || ':memory:');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(new URL('migrations/0001_init.sql', import.meta.url), 'utf8'));

function statement(query) {
  const prepared = db.prepare(query);
  function bind(...values) {
    return {
      first: () => prepared.get(...values) || null,
      all: () => ({ results: prepared.all(...values) }),
      run: () => ({ meta: { changes: prepared.run(...values).changes } })
    };
  }
  return { bind, ...bind() };
}

const port = Number(process.env.LADINI_PORT || 8790);
const origin = 'http://127.0.0.1:' + port;
const bootstrap = process.env.LADINI_PREVIEW_CODE;
if (!bootstrap || bootstrap.length < 24) throw new Error('Setel LADINI_PREVIEW_CODE minimal 24 karakter.');
const env = {
  BOOTSTRAP_CODE: bootstrap,
  SITE_ORIGIN: origin,
  DB: {
    prepare: statement,
    batch(items) {
      db.exec('BEGIN');
      try {
        const results = items.map((item) => item.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  }
};

const pagePath = process.argv[2] || new URL('index.html', import.meta.url);
createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin);
    if (url.pathname.startsWith('/api/')) {
      const request = new Request(url, { method: incoming.method, headers: incoming.headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) && { body: Readable.toWeb(incoming), duplex: 'half' })
      });
      const result = await worker.fetch(request, env);
      outgoing.writeHead(result.status, Object.fromEntries(result.headers));
      outgoing.end(result.body ? Buffer.from(await result.arrayBuffer()) : undefined);
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/ladini/') {
      outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      outgoing.end(readFileSync(pagePath));
      return;
    }
    outgoing.writeHead(404).end();
  } catch (error) {
    console.error(error.message);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
}).listen(port, '127.0.0.1', () => console.log('Pratinjau LADINI: ' + origin));

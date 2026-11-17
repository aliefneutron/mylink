CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  code_hash TEXT NOT NULL UNIQUE,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_owner ON accounts(role) WHERE role = 'owner';
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS attempts (
  bucket TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('video', 'layanan', 'informasi', 'pengumuman', 'tautan')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  youtube_id TEXT,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS content_date ON content(updated_at DESC);
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS visitors_seen ON visitors(last_seen);
CREATE TABLE IF NOT EXISTS visitor_days (
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY(day, visitor)
);
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS page_views_day ON page_views(day);

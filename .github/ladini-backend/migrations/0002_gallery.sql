CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  caption TEXT NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES accounts(id)
);

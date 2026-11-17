ALTER TABLE page_views ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE page_views ADD COLUMN visitor TEXT;
CREATE INDEX IF NOT EXISTS page_views_time ON page_views(created_at);

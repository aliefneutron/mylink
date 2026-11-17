ALTER TABLE images ADD COLUMN purpose TEXT NOT NULL DEFAULT 'gallery' CHECK(purpose IN ('gallery','logo'));

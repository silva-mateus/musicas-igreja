-- Enable unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    has_liturgical_times BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default workspace
INSERT INTO workspaces (name, slug, icon, color, has_liturgical_times, sort_order)
VALUES ('Igreja', 'igreja', 'church', '#3b82f6', true, 0)
ON CONFLICT (slug) DO NOTHING;

-- Ensure legacy string data is migrated to junction tables before dropping columns
-- Migrate Category string -> file_categories
INSERT INTO file_categories (file_id, category_id)
SELECT pf.id, c.id
FROM pdf_files pf
JOIN categories c ON c.name = pf.category
WHERE pf.category IS NOT NULL
  AND pf.category != ''
  AND NOT EXISTS (
    SELECT 1 FROM file_categories fc WHERE fc.file_id = pf.id AND fc.category_id = c.id
  );

-- Migrate Artist string -> file_artists
INSERT INTO file_artists (file_id, artist_id)
SELECT pf.id, a.id
FROM pdf_files pf
JOIN artists a ON a.name = pf.artist
WHERE pf.artist IS NOT NULL
  AND pf.artist != ''
  AND NOT EXISTS (
    SELECT 1 FROM file_artists fa WHERE fa.file_id = pf.id AND fa.artist_id = a.id
  );

-- Migrate LiturgicalTime string -> file_liturgical_times
INSERT INTO file_liturgical_times (file_id, liturgical_time_id)
SELECT pf.id, lt.id
FROM pdf_files pf
JOIN liturgical_times lt ON lt.name = pf.liturgical_time
WHERE pf.liturgical_time IS NOT NULL
  AND pf.liturgical_time != ''
  AND NOT EXISTS (
    SELECT 1 FROM file_liturgical_times flt WHERE flt.file_id = pf.id AND flt.liturgical_time_id = lt.id
  );

-- Add workspace_id to pdf_files
ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS workspace_id INT;
UPDATE pdf_files SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'igreja') WHERE workspace_id IS NULL;
ALTER TABLE pdf_files ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE pdf_files ADD CONSTRAINT fk_pdf_files_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

-- Add workspace_id to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS workspace_id INT;
UPDATE categories SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'igreja') WHERE workspace_id IS NULL;
ALTER TABLE categories ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE categories ADD CONSTRAINT fk_categories_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

-- Add workspace_id to liturgical_times
ALTER TABLE liturgical_times ADD COLUMN IF NOT EXISTS workspace_id INT;
UPDATE liturgical_times SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'igreja') WHERE workspace_id IS NULL;
ALTER TABLE liturgical_times ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE liturgical_times ADD CONSTRAINT fk_liturgical_times_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

-- Add workspace_id to merge_lists
ALTER TABLE merge_lists ADD COLUMN IF NOT EXISTS workspace_id INT;
UPDATE merge_lists SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'igreja') WHERE workspace_id IS NULL;
ALTER TABLE merge_lists ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE merge_lists ADD CONSTRAINT fk_merge_lists_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

-- Drop legacy string columns from pdf_files
ALTER TABLE pdf_files DROP COLUMN IF EXISTS category;
ALTER TABLE pdf_files DROP COLUMN IF EXISTS artist;
ALTER TABLE pdf_files DROP COLUMN IF EXISTS liturgical_time;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_pdf_files_workspace ON pdf_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pdf_files_upload_date ON pdf_files(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON categories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_liturgical_times_workspace ON liturgical_times(workspace_id);
CREATE INDEX IF NOT EXISTS idx_merge_lists_workspace ON merge_lists(workspace_id);
CREATE INDEX IF NOT EXISTS idx_merge_list_items_list_order ON merge_list_items(merge_list_id, order_position);
CREATE INDEX IF NOT EXISTS idx_file_categories_category ON file_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_file_liturgical_times_lt ON file_liturgical_times(liturgical_time_id);
CREATE INDEX IF NOT EXISTS idx_file_artists_artist ON file_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_date);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_date);

-- Update file paths to include workspace slug
UPDATE pdf_files
SET file_path = 'organized/igreja/' || SUBSTRING(file_path FROM LENGTH('organized/') + 1)
WHERE file_path LIKE 'organized/%' AND file_path NOT LIKE 'organized/igreja/%';

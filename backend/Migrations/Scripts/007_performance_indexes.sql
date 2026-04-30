-- 007_performance_indexes.sql
-- Phase A1: indexes for hot read paths.
-- Idempotent (IF NOT EXISTS / IF NOT EXISTS extensions).

-- Trigram + unaccent for ILIKE substring search on song_name / artist / category names.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- pdf_files: substring search on title (song_name) is hottest filter
CREATE INDEX IF NOT EXISTS idx_pdf_files_song_name_trgm
  ON pdf_files USING gin (song_name gin_trgm_ops);

-- pdf_files: filter by musical_key (chord browser, transpose lookup)
CREATE INDEX IF NOT EXISTS idx_pdf_files_musical_key
  ON pdf_files (musical_key)
  WHERE musical_key IS NOT NULL;

-- pdf_files: composite for "rail recente" — workspace + upload_date desc
CREATE INDEX IF NOT EXISTS idx_pdf_files_workspace_upload
  ON pdf_files (workspace_id, upload_date DESC);

-- pdf_files: filter chord vs pdf inside workspace
CREATE INDEX IF NOT EXISTS idx_pdf_files_workspace_content_type
  ON pdf_files (workspace_id, content_type);

-- categories.name: search suggestions
CREATE INDEX IF NOT EXISTS idx_categories_name
  ON categories (name);

-- artists.name: search suggestions + trigram for ILIKE
CREATE INDEX IF NOT EXISTS idx_artists_name
  ON artists (name);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm
  ON artists USING gin (name gin_trgm_ops);

-- system_events: alert badge count + unread feed
CREATE INDEX IF NOT EXISTS idx_system_events_workspace_unread
  ON system_events (workspace_id, is_read, created_date DESC);

-- audit_logs: per-user audit page
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date
  ON audit_logs (user_id, created_date DESC);

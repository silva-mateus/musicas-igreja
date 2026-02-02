-- Migration: Create file_artists N:N relationship table
-- Description: Creates a many-to-many relationship between pdf_files and artists
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Step 1: Create the file_artists table
CREATE TABLE IF NOT EXISTS file_artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES pdf_files(id) ON DELETE CASCADE,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Step 2: Create unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ix_file_artists_file_id_artist_id ON file_artists(file_id, artist_id);

-- Step 3: Ensure all artists in pdf_files exist in the artists table
INSERT OR IGNORE INTO artists (name, created_date)
SELECT DISTINCT artist, datetime('now')
FROM pdf_files
WHERE artist IS NOT NULL 
  AND artist != ''
  AND artist NOT IN (SELECT name FROM artists);

-- Step 4: Migrate data to file_artists table
INSERT OR IGNORE INTO file_artists (file_id, artist_id)
SELECT pf.id, a.id
FROM pdf_files pf
JOIN artists a ON a.name = pf.artist
WHERE pf.artist IS NOT NULL 
  AND pf.artist != ''
  AND NOT EXISTS (
    SELECT 1 FROM file_artists fa 
    WHERE fa.file_id = pf.id AND fa.artist_id = a.id
  );

-- Log migration result
SELECT 'Artists migrated: ' || COUNT(*) as result FROM file_artists;

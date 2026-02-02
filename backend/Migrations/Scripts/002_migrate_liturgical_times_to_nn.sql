-- Migration: Migrate liturgical_time field from pdf_files to file_liturgical_times (N:N relationship)
-- Description: This script migrates the legacy 'liturgical_time' column data to the N:N file_liturgical_times table
-- Safe to run multiple times (idempotent)

-- Step 1: Ensure all liturgical times in pdf_files exist in the liturgical_times table
INSERT OR IGNORE INTO liturgical_times (name, created_date)
SELECT DISTINCT liturgical_time, datetime('now')
FROM pdf_files
WHERE liturgical_time IS NOT NULL 
  AND liturgical_time != ''
  AND liturgical_time NOT IN (SELECT name FROM liturgical_times);

-- Step 2: Migrate data to file_liturgical_times table
INSERT OR IGNORE INTO file_liturgical_times (file_id, liturgical_time_id)
SELECT pf.id, lt.id
FROM pdf_files pf
JOIN liturgical_times lt ON lt.name = pf.liturgical_time
WHERE pf.liturgical_time IS NOT NULL 
  AND pf.liturgical_time != ''
  AND NOT EXISTS (
    SELECT 1 FROM file_liturgical_times flt 
    WHERE flt.file_id = pf.id AND flt.liturgical_time_id = lt.id
  );

-- Log migration result
SELECT 'Liturgical times migrated: ' || COUNT(*) as result FROM file_liturgical_times;

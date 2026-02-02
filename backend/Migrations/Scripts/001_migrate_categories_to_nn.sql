-- Migration: Migrate category field from pdf_files to file_categories (N:N relationship)
-- Description: This script migrates the legacy 'category' column data to the N:N file_categories table
-- Safe to run multiple times (idempotent)

-- Step 1: Ensure all categories in pdf_files exist in the categories table
INSERT OR IGNORE INTO categories (name, created_date)
SELECT DISTINCT category, datetime('now')
FROM pdf_files
WHERE category IS NOT NULL 
  AND category != ''
  AND category NOT IN (SELECT name FROM categories);

-- Step 2: Migrate data to file_categories table
INSERT OR IGNORE INTO file_categories (file_id, category_id)
SELECT pf.id, c.id
FROM pdf_files pf
JOIN categories c ON c.name = pf.category
WHERE pf.category IS NOT NULL 
  AND pf.category != ''
  AND NOT EXISTS (
    SELECT 1 FROM file_categories fc 
    WHERE fc.file_id = pf.id AND fc.category_id = c.id
  );

-- Log migration result
SELECT 'Categories migrated: ' || COUNT(*) as result FROM file_categories;

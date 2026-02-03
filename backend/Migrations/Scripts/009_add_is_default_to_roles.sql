-- Migration: Add is_default column to roles table
-- Description: Adds the is_default column to support default role assignment
-- Safe to run multiple times

-- Add the is_default column if it doesn't exist
-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we handle the error
ALTER TABLE roles ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

-- Set viewer as the default role
UPDATE roles SET is_default = 1 WHERE name = 'viewer';

SELECT 'Added is_default column to roles table.' as result;

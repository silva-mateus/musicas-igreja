-- Migration: Users table indexes and cleanup
-- Description: Ensures proper indexes exist on users table
-- Note: Table creation and schema migration is handled by Program.cs
-- Safe to run multiple times

-- Create unique index on username if not exists
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username);

SELECT 'Users table indexes verified.' as result;

-- Migration: Create users table and seed default admin user
-- Description: Creates the users table for authentication and seeds a default admin
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Step 1: Create the users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    role INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_date TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_date TEXT
);

-- Step 2: Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username);

-- Step 3: Seed default admin user (password: admin123)
-- Password hash is SHA256 of 'admin123' in base64: jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI=
INSERT OR IGNORE INTO users (username, full_name, password_hash, role, is_active, created_date)
VALUES ('admin', 'Administrador', 'jZae727K08KaOmKSgOaGzww/XVqGr/PKEgIMkjrcbJI=', 3, 1, datetime('now'));

-- Log result
SELECT 'Users table created. Admin user seeded.' as result;

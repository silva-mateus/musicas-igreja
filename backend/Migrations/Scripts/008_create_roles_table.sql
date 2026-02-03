-- Migration: Create roles table and migrate existing users
-- Description: Creates the roles table with permissions and updates users table
-- Safe to run multiple times

-- Step 1: Create the roles table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system_role INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    can_view_music INTEGER NOT NULL DEFAULT 1,
    can_download_music INTEGER NOT NULL DEFAULT 1,
    can_edit_music_metadata INTEGER NOT NULL DEFAULT 0,
    can_upload_music INTEGER NOT NULL DEFAULT 0,
    can_delete_music INTEGER NOT NULL DEFAULT 0,
    can_manage_lists INTEGER NOT NULL DEFAULT 0,
    can_manage_categories INTEGER NOT NULL DEFAULT 0,
    can_manage_users INTEGER NOT NULL DEFAULT 0,
    can_manage_roles INTEGER NOT NULL DEFAULT 0,
    can_access_admin INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Seed default roles (matching old enum values: Viewer=0, Editor=1, Uploader=2, Admin=3)
-- Now using: Viewer=1, Editor=2, Uploader=3, Admin=4

INSERT OR IGNORE INTO roles (id, name, display_name, description, is_system_role, priority, 
    can_view_music, can_download_music, can_edit_music_metadata, can_upload_music, can_delete_music,
    can_manage_lists, can_manage_categories, can_manage_users, can_manage_roles, can_access_admin)
VALUES 
(1, 'viewer', 'Visualizador', 'Pode visualizar e baixar músicas', 1, 10,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 0),
(2, 'editor', 'Editor', 'Pode editar metadados de músicas e gerenciar listas', 1, 20,
    1, 1, 1, 0, 0, 1, 1, 0, 0, 0),
(3, 'uploader', 'Uploader', 'Pode fazer upload de novas músicas', 1, 30,
    1, 1, 1, 1, 0, 1, 1, 0, 0, 0),
(4, 'admin', 'Administrador', 'Acesso total ao sistema', 1, 100,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

-- Step 3: Add role_id column to users if not exists
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we handle this in application code

-- Step 4: Migrate existing users from old role column to role_id
-- Old enum: Viewer=0, Editor=1, Uploader=2, Admin=3
-- New IDs:  Viewer=1, Editor=2, Uploader=3, Admin=4
-- So we add 1 to the old value

UPDATE users SET role_id = role + 1 WHERE role_id IS NULL OR role_id = 0;

SELECT 'Roles table created and users migrated.' as result;

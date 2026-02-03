ALTER TABLE roles ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
UPDATE roles SET is_default = 1 WHERE name = 'viewer';

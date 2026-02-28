-- Custom filter groups (replaces liturgical_times as a generic concept)
CREATE TABLE IF NOT EXISTS custom_filter_groups (
    id SERIAL PRIMARY KEY,
    workspace_id INT NOT NULL REFERENCES workspaces(id),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfg_workspace_slug ON custom_filter_groups(workspace_id, slug);

-- Custom filter values (individual options within a group)
CREATE TABLE IF NOT EXISTS custom_filter_values (
    id SERIAL PRIMARY KEY,
    filter_group_id INT NOT NULL REFERENCES custom_filter_groups(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cfv_group_slug ON custom_filter_values(filter_group_id, slug);
CREATE INDEX IF NOT EXISTS idx_cfv_group ON custom_filter_values(filter_group_id);

-- File <-> custom filter value junction
CREATE TABLE IF NOT EXISTS file_custom_filters (
    id SERIAL PRIMARY KEY,
    file_id INT NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    filter_value_id INT NOT NULL REFERENCES custom_filter_values(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcf_file_value ON file_custom_filters(file_id, filter_value_id);
CREATE INDEX IF NOT EXISTS idx_fcf_value ON file_custom_filters(filter_value_id);

-- Migrate existing liturgical_times data to custom_filter_groups/values
-- For each workspace that has liturgical times, create a "Tempo Litúrgico" group
INSERT INTO custom_filter_groups (workspace_id, name, slug, sort_order)
SELECT DISTINCT lt.workspace_id, 'Tempo Litúrgico', 'tempo-liturgico', 0
FROM liturgical_times lt
WHERE NOT EXISTS (
    SELECT 1 FROM custom_filter_groups cfg
    WHERE cfg.workspace_id = lt.workspace_id AND cfg.slug = 'tempo-liturgico'
);

-- Also create the group for workspaces with has_liturgical_times=true but no liturgical_times rows
INSERT INTO custom_filter_groups (workspace_id, name, slug, sort_order)
SELECT w.id, 'Tempo Litúrgico', 'tempo-liturgico', 0
FROM workspaces w
WHERE w.has_liturgical_times = true
AND NOT EXISTS (
    SELECT 1 FROM custom_filter_groups cfg WHERE cfg.workspace_id = w.id AND cfg.slug = 'tempo-liturgico'
);

-- Migrate liturgical_time entries to custom_filter_values
INSERT INTO custom_filter_values (filter_group_id, name, slug, sort_order)
SELECT cfg.id, lt.name, lt.slug, ROW_NUMBER() OVER (PARTITION BY lt.workspace_id ORDER BY lt.id) - 1
FROM liturgical_times lt
JOIN custom_filter_groups cfg ON cfg.workspace_id = lt.workspace_id AND cfg.slug = 'tempo-liturgico'
WHERE NOT EXISTS (
    SELECT 1 FROM custom_filter_values cfv WHERE cfv.filter_group_id = cfg.id AND cfv.slug = lt.slug
);

-- Migrate file_liturgical_times to file_custom_filters
INSERT INTO file_custom_filters (file_id, filter_value_id)
SELECT flt.file_id, cfv.id
FROM file_liturgical_times flt
JOIN liturgical_times lt ON lt.id = flt.liturgical_time_id
JOIN custom_filter_groups cfg ON cfg.workspace_id = lt.workspace_id AND cfg.slug = 'tempo-liturgico'
JOIN custom_filter_values cfv ON cfv.filter_group_id = cfg.id AND cfv.slug = lt.slug
WHERE NOT EXISTS (
    SELECT 1 FROM file_custom_filters fcf WHERE fcf.file_id = flt.file_id AND fcf.filter_value_id = cfv.id
);

-- Drop old tables and column
DROP TABLE IF EXISTS file_liturgical_times;
DROP TABLE IF EXISTS liturgical_times;
ALTER TABLE workspaces DROP COLUMN IF EXISTS has_liturgical_times;

-- Drop old indexes that referenced removed tables
DROP INDEX IF EXISTS idx_liturgical_times_workspace;
DROP INDEX IF EXISTS idx_file_liturgical_times_lt;

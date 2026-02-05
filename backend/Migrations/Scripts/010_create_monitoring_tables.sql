-- Migration 010: Create Monitoring Tables
-- Description: Creates tables for system monitoring, audit logs, and metrics

-- System Events table (for security events, errors, alerts)
CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low',
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    user_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit Logs table (for user actions tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    ip_address TEXT,
    old_value TEXT,
    new_value TEXT,
    created_date TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System Metrics table (for system health and performance metrics)
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    metadata TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance optimization

-- System Events indexes
CREATE INDEX IF NOT EXISTS idx_system_events_created_date ON system_events(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_is_read ON system_events(is_read);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_user_id ON system_events(user_id);
CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);

-- Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_date ON audit_logs(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- System Metrics indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_type ON system_metrics(metric_type);

-- Migration 011: Create Alert Configurations Table
-- Description: Allows users to configure custom alert thresholds via UI

CREATE TABLE IF NOT EXISTS alert_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    metric_type TEXT NOT NULL,
    threshold_value REAL NOT NULL,
    threshold_unit TEXT NOT NULL,
    comparison_operator TEXT NOT NULL DEFAULT 'greater_than',
    severity TEXT NOT NULL DEFAULT 'medium',
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_date TEXT NOT NULL DEFAULT (datetime('now')),
    updated_date TEXT
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_alert_configs_key ON alert_configurations(config_key);
CREATE INDEX IF NOT EXISTS idx_alert_configs_metric ON alert_configurations(metric_type);
CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configurations(is_enabled);

-- Seed default alert configurations
INSERT OR IGNORE INTO alert_configurations 
    (config_key, name, description, metric_type, threshold_value, threshold_unit, comparison_operator, severity, is_enabled)
VALUES
    ('disk_usage_warning', 'Aviso de Disco Cheio', 'Alerta quando o disco ultrapassar o limite de uso', 'disk_usage', 80.0, '%', 'greater_than', 'high', 1),
    ('disk_usage_critical', 'Disco Crítico', 'Alerta crítico quando o disco estiver quase cheio', 'disk_usage', 90.0, '%', 'greater_than', 'critical', 1),
    ('storage_size_warning', 'Tamanho de Armazenamento Alto', 'Alerta quando o armazenamento de arquivos ultrapassar o limite', 'storage_size', 5000.0, 'MB', 'greater_than', 'medium', 1),
    ('failed_logins_warning', 'Muitas Tentativas de Login Falhadas', 'Alerta quando houver muitas tentativas de login falhadas em 24h', 'failed_logins_24h', 20.0, 'count', 'greater_than', 'high', 1),
    ('failed_logins_critical', 'Ataque de Login Detectado', 'Alerta crítico de possível ataque de força bruta', 'failed_logins_24h', 50.0, 'count', 'greater_than', 'critical', 1),
    ('uploads_spike', 'Pico de Uploads', 'Alerta quando houver muitos uploads em pouco tempo', 'uploads_1h', 20.0, 'count', 'greater_than', 'medium', 0),
    ('memory_usage_high', 'Uso de Memória Alto', 'Alerta quando o uso de memória ultrapassar o limite', 'memory_usage', 500.0, 'MB', 'greater_than', 'medium', 0);

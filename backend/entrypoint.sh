#!/bin/bash
set -e

# Função de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "🎵 Iniciando Organizador de Música Litúrgica..."

# Criar diretórios necessários se não existirem
mkdir -p /data/logs /data/uploads /data/organized

# Configurar permissões
chmod 755 /data
chmod 755 /data/logs /data/uploads /data/organized

# Verificar se o banco de dados existe; se não, tentar copiar snapshot do repositório antes de inicializar
if [ ! -f "/data/pdf_organizer.db" ]; then
    # Primeiro tenta usar um DB presente em /app/data (repo) ou /app (repo root)
    if [ -f "/app/data/pdf_organizer.db" ]; then
        log "📦 DB encontrado em /app/data do repositório. Copiando para /data..."
        cp -f /app/data/pdf_organizer.db /data/pdf_organizer.db
        chmod 644 /data/pdf_organizer.db
        log "✅ DB copiado para /data/pdf_organizer.db"
    elif [ -f "/app/pdf_organizer.db" ]; then
        log "📦 DB encontrado em /app do repositório. Copiando para /data..."
        cp -f /app/pdf_organizer.db /data/pdf_organizer.db
        chmod 644 /data/pdf_organizer.db
        log "✅ DB copiado para /data/pdf_organizer.db"
    fi

    if [ ! -f "/data/pdf_organizer.db" ]; then
        log "📊 Banco de dados não encontrado. Inicializando estrutura..."
        python -c "
import sys
sys.path.insert(0, '/app')
from app import init_db
init_db()
print('✅ Banco de dados inicializado com sucesso!')
"
    fi
else
    log "📊 Banco de dados já existe. Pulando inicialização."
fi

# Verificar conectividade do banco
log "🔍 Verificando conectividade do banco de dados..."
python -c "
import sys
sys.path.insert(0, '/app')
import sqlite3
try:
    conn = sqlite3.connect('/data/pdf_organizer.db')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM sqlite_master WHERE type=\"table\"')
    tables = cursor.fetchone()[0]
    conn.close()
    print(f'✅ Banco conectado. {tables} tabelas encontradas.')
except Exception as e:
    print(f'❌ Erro ao conectar ao banco: {e}')
    sys.exit(1)
"

# Verificar dependências Python
log "📦 Verificando dependências Python..."
python -c "
packages = ['flask', 'bcrypt', 'pypdf']
missing = []
for pkg in packages:
    try:
        __import__(pkg)
    except ImportError:
        missing.append(pkg)

if missing:
    print(f'❌ Dependências faltando: {missing}')
    exit(1)
else:
    print('✅ Todas as dependências estão instaladas.')
"

# Verificar configurações obrigatórias
log "⚙️  Verificando configurações..."

# Verificar SECRET_KEY
if [ -z "${SECRET_KEY}" ] || [ "${SECRET_KEY}" = "your-secret-key-change-this" ]; then
    log "⚠️  WARNING: SECRET_KEY não configurada ou usando valor padrão!"
    log "   Configure a variável SECRET_KEY para produção."
fi

# Configurar variáveis de ambiente padrão se não definidas
export FLASK_ENV=${FLASK_ENV:-production}
export DATABASE_PATH=${DATABASE_PATH:-/data/pdf_organizer.db}
export UPLOAD_FOLDER=${UPLOAD_FOLDER:-/data/uploads}
export ORGANIZED_FOLDER=${ORGANIZED_FOLDER:-/data/organized}
export LOG_FOLDER=${LOG_FOLDER:-/data/logs}

log "📝 Configurações:"
log "   FLASK_ENV: $FLASK_ENV"
log "   DATABASE_PATH: $DATABASE_PATH"
log "   UPLOAD_FOLDER: $UPLOAD_FOLDER"
log "   ORGANIZED_FOLDER: $ORGANIZED_FOLDER"
log "   LOG_FOLDER: $LOG_FOLDER"

# Executar comando passado como argumento
log "🚀 Iniciando aplicação..."
exec "$@"
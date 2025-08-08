#!/bin/bash
set -e

echo "🎵 Iniciando Backend do Sistema Músicas Igreja..."

# Função para log com timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Configurar banco de dados
DATABASE_DIR="/app/data"
DATABASE_PATH="$DATABASE_DIR/pdf_organizer.db"
INITIAL_DB_PATH="/tmp/initial_db/pdf_organizer.db"

# Criar diretório de dados se não existir
mkdir -p "$DATABASE_DIR"

# Se o banco não existir e tivermos um banco inicial, copiá-lo
if [ ! -f "$DATABASE_PATH" ] && [ -f "$INITIAL_DB_PATH" ]; then
    log "📄 Inicializando banco de dados a partir do modelo..."
    cp "$INITIAL_DB_PATH" "$DATABASE_PATH"
    log "✅ Banco de dados inicializado"
else
    log "📄 Banco de dados já existe ou não há modelo inicial"
fi

# Verificar permissões do banco
if [ -f "$DATABASE_PATH" ]; then
    log "🔐 Verificando permissões do banco de dados..."
    if [ ! -w "$DATABASE_PATH" ]; then
        log "⚠️  Banco de dados não tem permissão de escrita, tentando corrigir..."
        chmod 664 "$DATABASE_PATH" || log "❌ Falha ao corrigir permissões"
    fi
    log "✅ Permissões do banco verificadas"
fi

# Criar diretórios necessários se não existirem
log "📁 Verificando diretórios necessários..."
mkdir -p "$DATABASE_DIR/uploads"
mkdir -p "$DATABASE_DIR/organized" 
mkdir -p "$DATABASE_DIR/logs"

# Verificar se os diretórios são graváveis
for dir in "$DATABASE_DIR/uploads" "$DATABASE_DIR/organized" "$DATABASE_DIR/logs"; do
    if [ ! -w "$dir" ]; then
        log "⚠️  Diretório $dir não tem permissão de escrita"
        chmod 755 "$dir" || log "❌ Falha ao corrigir permissões de $dir"
    fi
done

log "✅ Diretórios verificados"

# Verificar variáveis de ambiente importantes
log "🔧 Verificando configuração..."
log "   - FLASK_ENV: ${FLASK_ENV:-development}"
log "   - DATABASE_PATH: ${DATABASE_PATH}"
log "   - UPLOAD_FOLDER: ${UPLOAD_FOLDER:-/app/data/uploads}"
log "   - PORT: ${PORT:-5000}"

# Verificar se o Flask está funcionando
log "🐍 Testando importação do Flask..."
python -c "import flask; print('Flask importado com sucesso')" || {
    log "❌ Erro ao importar Flask"
    exit 1
}

# Verificar se a aplicação pode ser importada
log "🎵 Testando importação da aplicação..."
python -c "import sys; sys.path.append('/app'); import app; print('Aplicação importada com sucesso')" || {
    log "❌ Erro ao importar aplicação"
    exit 1
}

log "✅ Configuração verificada"

# Aguardar um pouco para garantir que tudo está pronto
sleep 2

log "🚀 Iniciando servidor Flask..."
log "   - Host: 0.0.0.0"
log "   - Porta: ${PORT:-5000}"
log "   - Ambiente: ${FLASK_ENV:-development}"

# Executar o comando fornecido
exec "$@"
#!/bin/bash

# 🎵 Script de Restore para Backups Automáticos
# Restaura backups criados pelo backup-cron.sh
#
# Uso:
#   ./restore-cron-backup.sh                    # Restaura o último backup
#   ./restore-cron-backup.sh latest             # Restaura o último backup  
#   ./restore-cron-backup.sh 20251218           # Restaura backup de uma data específica
#   ./restore-cron-backup.sh /path/to/file.tar.gz  # Restaura arquivo específico

set -e

# ============================================
# CONFIGURAÇÕES
# ============================================

BACKUP_DIR="${BACKUP_DIR:-/home/thi_s/backups/musicas-igreja}"
CONTAINER_NAME="musicas-igreja-app"
VOLUME_DATA="backend_musicas_data"
VOLUME_ORGANIZED="backend_musicas_organized"

# ============================================
# FUNÇÕES AUXILIARES
# ============================================

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

log() {
    echo "[$TIMESTAMP] $1"
}

log_error() {
    echo "[$TIMESTAMP] ❌ ERROR: $1" >&2
}

log_success() {
    echo "[$TIMESTAMP] ✅ $1"
}

log_info() {
    echo "[$TIMESTAMP] ℹ️  $1"
}

# ============================================
# DETERMINAR ARQUIVO DE BACKUP
# ============================================

BACKUP_ARG="${1:-latest}"
BACKUP_FILE=""

if [ "$BACKUP_ARG" = "latest" ]; then
    # Usar link simbólico para último backup
    if [ -L "$BACKUP_DIR/latest.tar.gz" ]; then
        BACKUP_FILE=$(readlink -f "$BACKUP_DIR/latest.tar.gz")
    else
        # Pegar o arquivo mais recente
        BACKUP_FILE=$(ls -1t "$BACKUP_DIR/daily/"*.tar.gz 2>/dev/null | head -1)
    fi
elif [ -f "$BACKUP_ARG" ]; then
    # Caminho completo fornecido
    BACKUP_FILE="$BACKUP_ARG"
elif [ -f "$BACKUP_DIR/daily/musicas_backup_${BACKUP_ARG}.tar.gz" ]; then
    # Data fornecida (YYYYMMDD)
    BACKUP_FILE="$BACKUP_DIR/daily/musicas_backup_${BACKUP_ARG}.tar.gz"
else
    # Tentar encontrar por padrão parcial
    BACKUP_FILE=$(ls -1t "$BACKUP_DIR/daily/"*"${BACKUP_ARG}"*.tar.gz 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup não encontrado!"
    echo ""
    echo "📦 Backups disponíveis:"
    ls -lh "$BACKUP_DIR/daily/"*.tar.gz 2>/dev/null || echo "Nenhum backup encontrado"
    echo ""
    echo "Uso: $0 [latest|YYYYMMDD|/caminho/arquivo.tar.gz]"
    exit 1
fi

log "🎵 Restaurando backup: $BACKUP_FILE"

# ============================================
# CONFIRMAÇÃO
# ============================================

echo ""
echo "⚠️  ATENÇÃO: Este processo irá sobrescrever os dados atuais!"
echo ""
read -p "Continuar com o restore? [y/N]: " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Restore cancelado pelo usuário"
    exit 0
fi

# ============================================
# EXTRAIR BACKUP
# ============================================

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_info "Extraindo backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Mostrar manifesto se existir
if [ -f "$TEMP_DIR/MANIFEST.txt" ]; then
    echo ""
    echo "📋 Manifesto do backup:"
    cat "$TEMP_DIR/MANIFEST.txt"
    echo ""
fi

# ============================================
# PARAR CONTAINERS
# ============================================

log_info "Parando containers..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true

# ============================================
# RESTAURAR BANCO DE DADOS
# ============================================

if [ -f "$TEMP_DIR/pdf_organizer.db" ]; then
    log_info "Restaurando banco de dados..."
    
    docker run --rm \
        -v "$VOLUME_DATA:/data" \
        -v "$TEMP_DIR:/backup:ro" \
        alpine sh -c "
            cp /backup/pdf_organizer.db /data/pdf_organizer.db
            chmod 666 /data/pdf_organizer.db
        "
    
    log_success "Banco de dados restaurado"
else
    log_error "Banco de dados não encontrado no backup!"
fi

# ============================================
# RESTAURAR MÚSICAS ORGANIZADAS
# ============================================

if [ -d "$TEMP_DIR/organized" ]; then
    log_info "Restaurando músicas organizadas..."
    
    PDF_COUNT=$(find "$TEMP_DIR/organized" -name "*.pdf" 2>/dev/null | wc -l)
    
    docker run --rm \
        -v "$VOLUME_ORGANIZED:/organized" \
        -v "$TEMP_DIR:/backup:ro" \
        alpine sh -c "
            rm -rf /organized/*
            cp -r /backup/organized/* /organized/ 2>/dev/null || true
            chmod -R 755 /organized
        "
    
    log_success "Músicas restauradas: $PDF_COUNT arquivos"
else
    log_error "Músicas organizadas não encontradas no backup!"
fi

# ============================================
# REINICIAR CONTAINERS
# ============================================

log_info "Reiniciando containers..."
docker start "$CONTAINER_NAME"

# Aguardar container iniciar
sleep 10

# Verificar se está rodando
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "Container reiniciado com sucesso"
else
    log_error "Falha ao reiniciar container!"
    exit 1
fi

# ============================================
# VALIDAÇÃO
# ============================================

log_info "Validando restore..."

# Testar banco de dados
docker exec "$CONTAINER_NAME" python3 -c "
import sqlite3
import os
db_path = os.environ.get('DATABASE_PATH', '/data/pdf_organizer.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM pdf_files')
count = cursor.fetchone()[0]
print(f'Banco de dados OK: {count} músicas registradas')
conn.close()
" 2>/dev/null || log_error "Falha ao validar banco de dados"

# ============================================
# RESUMO FINAL
# ============================================

echo ""
log "🎉 Restore concluído!"
echo ""
echo "📋 Resumo:"
echo "   Arquivo restaurado: $(basename "$BACKUP_FILE")"
echo "   Container: $CONTAINER_NAME"
echo ""
echo "🔗 Acesse: http://localhost:5001"


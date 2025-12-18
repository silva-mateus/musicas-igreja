#!/bin/bash

# 🎵 Script de Backup Automático (Cron) - Organizador de Música Litúrgica
# Este script faz backup incremental: só cria novo backup se houver mudanças
# 
# Uso no crontab (backup diário às 3h da manhã):
#   0 3 * * * /caminho/para/backup-cron.sh >> /var/log/musicas-backup.log 2>&1
#
# Ou para rodar manualmente:
#   ./backup-cron.sh

set -e

# ============================================
# CONFIGURAÇÕES
# ============================================

# Diretório onde os backups serão armazenados
BACKUP_DIR="${BACKUP_DIR:-/home/thi_s/backups/musicas-igreja}"

# Nome do container Docker
CONTAINER_NAME="musicas-igreja-app"

# Volumes Docker
VOLUME_DATA="backend_musicas_data"
VOLUME_ORGANIZED="backend_musicas_organized"

# Número máximo de backups a manter (para rotação)
MAX_BACKUPS="${MAX_BACKUPS:-30}"

# Log file
LOG_FILE="${LOG_FILE:-/var/log/musicas-backup.log}"

# ============================================
# FUNÇÕES AUXILIARES
# ============================================

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
DATE_TAG=$(date +"%Y%m%d")

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
# VERIFICAÇÕES INICIAIS
# ============================================

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    log_error "Docker não está rodando!"
    exit 1
fi

# Verificar se os volumes existem
if ! docker volume ls | grep -q "$VOLUME_DATA"; then
    log_error "Volume $VOLUME_DATA não encontrado!"
    exit 1
fi

if ! docker volume ls | grep -q "$VOLUME_ORGANIZED"; then
    log_error "Volume $VOLUME_ORGANIZED não encontrado!"
    exit 1
fi

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/temp"
mkdir -p "$BACKUP_DIR/daily"

log "🎵 Iniciando backup automático..."

# ============================================
# EXTRAIR DADOS PARA PASTA TEMPORÁRIA
# ============================================

TEMP_DIR="$BACKUP_DIR/temp/current_$$"
mkdir -p "$TEMP_DIR"

# Cleanup em caso de erro
trap "rm -rf $TEMP_DIR" EXIT

log_info "Extraindo banco de dados..."
docker run --rm \
    -v "$VOLUME_DATA:/data:ro" \
    -v "$TEMP_DIR:/backup" \
    alpine sh -c "cp /data/pdf_organizer.db /backup/ 2>/dev/null || echo 'DB não encontrado'" 

log_info "Extraindo músicas organizadas..."
docker run --rm \
    -v "$VOLUME_ORGANIZED:/organized:ro" \
    -v "$TEMP_DIR:/backup" \
    alpine sh -c "cp -r /organized /backup/organized 2>/dev/null || mkdir -p /backup/organized"

# ============================================
# CALCULAR HASH DOS DADOS ATUAIS
# ============================================

log_info "Calculando hash dos dados..."

# Hash do banco de dados
if [ -f "$TEMP_DIR/pdf_organizer.db" ]; then
    DB_HASH=$(sha256sum "$TEMP_DIR/pdf_organizer.db" | awk '{print $1}')
else
    DB_HASH="none"
fi

# Hash das músicas (baseado na lista de arquivos e seus tamanhos)
if [ -d "$TEMP_DIR/organized" ]; then
    ORGANIZED_HASH=$(find "$TEMP_DIR/organized" -type f -name "*.pdf" -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | awk '{print $1}')
else
    ORGANIZED_HASH="none"
fi

# Hash combinado
CURRENT_HASH="${DB_HASH}_${ORGANIZED_HASH}"
HASH_FILE="$BACKUP_DIR/.last_backup_hash"

log_info "Hash atual: $CURRENT_HASH"

# ============================================
# VERIFICAR SE HOUVE MUDANÇAS
# ============================================

NEEDS_BACKUP=false

if [ -f "$HASH_FILE" ]; then
    LAST_HASH=$(cat "$HASH_FILE")
    if [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
        log_info "Mudanças detectadas desde o último backup"
        NEEDS_BACKUP=true
    else
        log_info "Nenhuma mudança detectada - pulando backup"
    fi
else
    log_info "Primeiro backup - criando..."
    NEEDS_BACKUP=true
fi

# ============================================
# CRIAR BACKUP SE NECESSÁRIO
# ============================================

if [ "$NEEDS_BACKUP" = true ]; then
    BACKUP_NAME="musicas_backup_${DATE_TAG}"
    BACKUP_FILE="$BACKUP_DIR/daily/${BACKUP_NAME}.tar.gz"
    
    # Se já existe backup do mesmo dia, adicionar hora
    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_NAME="musicas_backup_${DATE_TAG}_$(date +%H%M%S)"
        BACKUP_FILE="$BACKUP_DIR/daily/${BACKUP_NAME}.tar.gz"
    fi
    
    log_info "Criando backup: $BACKUP_NAME"
    
    # Criar arquivo de manifesto
    cat > "$TEMP_DIR/MANIFEST.txt" << EOF
🎵 BACKUP AUTOMÁTICO - Organizador de Música Litúrgica
======================================================

Data/Hora: $TIMESTAMP
Nome: $BACKUP_NAME
Hash: $CURRENT_HASH

CONTEÚDO:
---------
EOF
    
    # Info do banco
    if [ -f "$TEMP_DIR/pdf_organizer.db" ]; then
        DB_SIZE=$(ls -lh "$TEMP_DIR/pdf_organizer.db" | awk '{print $5}')
        echo "✅ Banco de dados: $DB_SIZE" >> "$TEMP_DIR/MANIFEST.txt"
        
        # Contar registros
        DB_COUNT=$(sqlite3 "$TEMP_DIR/pdf_organizer.db" "SELECT COUNT(*) FROM pdf_files;" 2>/dev/null || echo "?")
        echo "   Registros: $DB_COUNT músicas" >> "$TEMP_DIR/MANIFEST.txt"
    else
        echo "❌ Banco de dados: não encontrado" >> "$TEMP_DIR/MANIFEST.txt"
    fi
    
    # Info das músicas
    if [ -d "$TEMP_DIR/organized" ]; then
        PDF_COUNT=$(find "$TEMP_DIR/organized" -name "*.pdf" 2>/dev/null | wc -l)
        ORGANIZED_SIZE=$(du -sh "$TEMP_DIR/organized" 2>/dev/null | awk '{print $1}' || echo "0")
        echo "✅ PDFs organizados: $PDF_COUNT arquivos ($ORGANIZED_SIZE)" >> "$TEMP_DIR/MANIFEST.txt"
    else
        echo "❌ PDFs organizados: não encontrado" >> "$TEMP_DIR/MANIFEST.txt"
    fi
    
    # Compactar backup
    log_info "Compactando backup..."
    cd "$TEMP_DIR"
    tar -czf "$BACKUP_FILE" .
    cd - > /dev/null
    
    # Verificar se o backup foi criado
    if [ -f "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
        log_success "Backup criado: $BACKUP_FILE ($BACKUP_SIZE)"
        
        # Salvar hash do backup atual
        echo "$CURRENT_HASH" > "$HASH_FILE"
        
        # Criar link simbólico para o backup mais recente
        ln -sf "$BACKUP_FILE" "$BACKUP_DIR/latest.tar.gz"
    else
        log_error "Falha ao criar backup!"
        exit 1
    fi
    
    # ============================================
    # ROTAÇÃO DE BACKUPS ANTIGOS
    # ============================================
    
    log_info "Verificando rotação de backups (máximo: $MAX_BACKUPS)..."
    
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR/daily/"*.tar.gz 2>/dev/null | wc -l)
    
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
        log_info "Removendo $REMOVE_COUNT backup(s) antigo(s)..."
        
        ls -1t "$BACKUP_DIR/daily/"*.tar.gz | tail -n "$REMOVE_COUNT" | while read old_backup; do
            log_info "Removendo: $old_backup"
            rm -f "$old_backup"
        done
        
        log_success "Rotação concluída"
    fi
else
    log_success "Backup não necessário - dados não mudaram"
fi

# ============================================
# RESUMO FINAL
# ============================================

log "📊 Estatísticas de backup:"
log "   Diretório: $BACKUP_DIR/daily/"
log "   Backups existentes: $(ls -1 "$BACKUP_DIR/daily/"*.tar.gz 2>/dev/null | wc -l)"
log "   Espaço utilizado: $(du -sh "$BACKUP_DIR/daily" 2>/dev/null | awk '{print $1}')"

if [ -L "$BACKUP_DIR/latest.tar.gz" ]; then
    log "   Último backup: $(readlink "$BACKUP_DIR/latest.tar.gz")"
fi

log "🎵 Backup automático finalizado!"


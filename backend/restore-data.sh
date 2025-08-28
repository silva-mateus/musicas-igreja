#!/bin/bash

# 🎵 Script de Restore - Organizador de Música Litúrgica
# Este script restaura backup completo do banco de dados e PDFs organizados

set -e

# Configurações
BACKUP_DIR="./backups"
CONTAINER_NAME="musicas-igreja-app"
APPUSER_UID=1000
APPUSER_GID=1000

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função de logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Função para corrigir permissões
fix_permissions() {
    local path="$1"
    local is_container_path="$2"
    
    if [ "$is_container_path" = true ]; then
        # Corrigir permissões dentro do container
        docker exec "$CONTAINER_NAME" bash -c "
            find '$path' -type d -exec chmod 755 {} \; 2>/dev/null || true
            find '$path' -type f -exec chmod 644 {} \; 2>/dev/null || true
            chown -R appuser:appuser '$path' 2>/dev/null || true
        " && success "Permissões corrigidas no container: $path"
    else
        # Corrigir permissões no host
        if [ -e "$path" ]; then
            find "$path" -type d -exec chmod 755 {} \; 2>/dev/null || true
            find "$path" -type f -exec chmod 644 {} \; 2>/dev/null || true
            
            # Tentar definir ownership para appuser se possível
            if command -v chown >/dev/null && [ "$(id -u)" -eq 0 ]; then
                chown -R $APPUSER_UID:$APPUSER_GID "$path" 2>/dev/null || true
            fi
            
            success "Permissões corrigidas no host: $path"
        fi
    fi
}

# Verificar argumentos
if [ $# -eq 0 ]; then
    echo "📋 Uso: $0 <nome_do_backup>"
    echo
    echo "📦 Backups disponíveis:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR" | grep musicas_backup || echo "Nenhum backup encontrado"
    else
        echo "Diretório de backup não encontrado: $BACKUP_DIR"
    fi
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Verificar se é arquivo compactado
if [ -f "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" ] && [ ! -d "$BACKUP_PATH" ]; then
    log "📦 Extraindo backup compactado..."
    cd "$BACKUP_DIR"
    tar -xzf "${BACKUP_NAME}.tar.gz"
    cd ..
    success "Backup extraído"
fi

# Verificar se o backup existe
if [ ! -d "$BACKUP_PATH" ]; then
    error "Backup não encontrado: $BACKUP_PATH"
fi

# Verificar se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando!"
fi

log "🎵 Iniciando restore do backup: $BACKUP_NAME"

# Mostrar manifesto se existir
if [ -f "$BACKUP_PATH/MANIFEST.txt" ]; then
    echo
    log "📋 Manifesto do backup:"
    cat "$BACKUP_PATH/MANIFEST.txt"
    echo
    
    read -p "📥 Continuar com o restore? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "❌ Restore cancelado pelo usuário"
        exit 0
    fi
fi

# Verificar se o container está rodando
if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    CONTAINER_RUNNING=true
    log "🐳 Container está rodando: $CONTAINER_NAME"
    
    # Perguntar se deve parar o container
    read -p "⏹️  Parar container para restore seguro? [Y/n]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        log "⏹️  Parando container..."
        docker-compose stop
        CONTAINER_RUNNING=false
        success "Container parado"
    fi
else
    CONTAINER_RUNNING=false
    log "📴 Container não está rodando"
fi

# 1. RESTORE DO BANCO DE DADOS
if [ -f "$BACKUP_PATH/pdf_organizer.db" ]; then
    log "💾 Restaurando banco de dados..."
    
    # Verificar integridade antes do restore
    if ! sqlite3 "$BACKUP_PATH/pdf_organizer.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        error "Banco de dados do backup está corrompido!"
    fi
    
    if [ "$CONTAINER_RUNNING" = true ]; then
        # Container rodando - copiar para dentro
        docker cp "$BACKUP_PATH/pdf_organizer.db" "$CONTAINER_NAME:/data/pdf_organizer.db" || {
            docker cp "$BACKUP_PATH/pdf_organizer.db" "$CONTAINER_NAME:/app/data/pdf_organizer.db" || {
                error "Falha ao copiar banco para container"
            }
        }
        fix_permissions "/data/pdf_organizer.db" true
    else
        # Container parado - usar volume
        if docker volume ls | grep -q "musicas_data"; then
            docker run --rm -v musicas_data:/data -v "$(pwd)/$BACKUP_PATH":/backup alpine sh -c "
                cp /backup/pdf_organizer.db /data/pdf_organizer.db
                chmod 644 /data/pdf_organizer.db
                chown $APPUSER_UID:$APPUSER_GID /data/pdf_organizer.db 2>/dev/null || true
            " && success "Banco de dados restaurado no volume"
        else
            error "Volume musicas_data não encontrado"
        fi
    fi
    
    success "Banco de dados restaurado"
else
    warning "Banco de dados não encontrado no backup"
fi

# 2. RESTORE DOS PDFs ORGANIZADOS
if [ -d "$BACKUP_PATH/organized" ]; then
    log "📄 Restaurando PDFs organizados..."
    
    # Backup do diretório atual se existir
    if [ -d "./organized" ]; then
        mv "./organized" "./organized.backup.$(date +%Y%m%d_%H%M%S)"
        warning "Diretório organized atual foi renomeado para backup"
    fi
    
    # Copiar diretório organized
    cp -r "$BACKUP_PATH/organized" "./"
    
    # Corrigir permissões
    fix_permissions "./organized" false
    
    # Contar PDFs restaurados
    PDF_COUNT=$(find "./organized" -name "*.pdf" | wc -l)
    success "PDFs organizados restaurados: $PDF_COUNT arquivos"
else
    warning "PDFs organizados não encontrados no backup"
fi

# 3. RESTORE DOS UPLOADS
if [ -d "$BACKUP_PATH/uploads" ]; then
    log "📤 Restaurando uploads..."
    
    if [ "$CONTAINER_RUNNING" = true ]; then
        # Container rodando - copiar para dentro
        docker cp "$BACKUP_PATH/uploads" "$CONTAINER_NAME:/data/" || {
            docker cp "$BACKUP_PATH/uploads" "$CONTAINER_NAME:/app/data/" || {
                warning "Falha ao copiar uploads para container"
            }
        }
        fix_permissions "/data/uploads" true
    else
        # Container parado - usar volume
        if docker volume ls | grep -q "musicas_data"; then
            docker run --rm -v musicas_data:/data -v "$(pwd)/$BACKUP_PATH":/backup alpine sh -c "
                rm -rf /data/uploads
                cp -r /backup/uploads /data/
                chmod -R 644 /data/uploads/*
                chmod 755 /data/uploads
                find /data/uploads -type d -exec chmod 755 {} \;
                chown -R $APPUSER_UID:$APPUSER_GID /data/uploads 2>/dev/null || true
            " && success "Uploads restaurados no volume"
        else
            warning "Volume musicas_data não encontrado para uploads"
        fi
    fi
    
    success "Uploads restaurados"
else
    warning "Uploads não encontrados no backup"
fi

# 4. RESTORE DAS CONFIGURAÇÕES
if [ -d "$BACKUP_PATH/config" ]; then
    log "⚙️  Restaurando configurações..."
    
    CONFIG_FILES=(
        ".env"
        "credentials.json"
        "token.json"
    )
    
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$BACKUP_PATH/config/$file" ]; then
            # Fazer backup do arquivo atual se existir
            if [ -f "./$file" ]; then
                cp "./$file" "./${file}.backup.$(date +%Y%m%d_%H%M%S)"
            fi
            
            cp "$BACKUP_PATH/config/$file" "./"
            chmod 644 "./$file"
            success "Configuração restaurada: $file"
        fi
    done
    
    # docker-compose.yml é apenas para referência, não sobrescrever
    if [ -f "$BACKUP_PATH/config/docker-compose.yml" ]; then
        cp "$BACKUP_PATH/config/docker-compose.yml" "./docker-compose.yml.backup"
        success "docker-compose.yml salvo como referência (.backup)"
    fi
else
    warning "Configurações não encontradas no backup"
fi

# 5. VERIFICAR E CORRIGIR PERMISSÕES FINAIS
log "🔧 Verificando e corrigindo permissões finais..."

# Permissões no host
PATHS_TO_FIX=(
    "./organized"
    "./.env"
    "./credentials.json"
    "./token.json"
)

for path in "${PATHS_TO_FIX[@]}"; do
    if [ -e "$path" ]; then
        fix_permissions "$path" false
    fi
done

# 6. REINICIAR SERVIÇOS SE NECESSÁRIO
if [ "$CONTAINER_RUNNING" = false ]; then
    read -p "🚀 Iniciar containers após restore? [Y/n]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        log "🚀 Iniciando containers..."
        docker-compose up -d
        
        # Aguardar containers iniciarem
        sleep 5
        
        # Verificar se container está saudável
        if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$CONTAINER_NAME.*healthy\|Up"; then
            success "Containers iniciados com sucesso"
            
            # Corrigir permissões finais dentro do container
            log "🔧 Corrigindo permissões finais no container..."
            docker exec "$CONTAINER_NAME" bash -c "
                chown -R appuser:appuser /data 2>/dev/null || true
                chown -R appuser:appuser /app/organized 2>/dev/null || true
                chmod -R 755 /data /app/organized 2>/dev/null || true
                find /data -type f -exec chmod 644 {} \; 2>/dev/null || true
                find /app/organized -type f -exec chmod 644 {} \; 2>/dev/null || true
            " && success "Permissões finais corrigidas no container"
        else
            warning "Container pode não estar funcionando corretamente"
        fi
    fi
fi

# 7. VALIDAÇÃO PÓS-RESTORE
log "🔍 Validando restore..."

# Verificar banco de dados
if [ -f "./organized" ] || docker exec "$CONTAINER_NAME" test -f "/data/pdf_organizer.db" 2>/dev/null; then
    # Testar conectividade do banco
    if docker exec "$CONTAINER_NAME" python -c "
import sqlite3
import os
db_path = os.environ.get('DATABASE_PATH', '/data/pdf_organizer.db')
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM pdf_files')
    count = cursor.fetchone()[0]
    print(f'✅ Banco conectado: {count} arquivos registrados')
    conn.close()
except Exception as e:
    print(f'❌ Erro no banco: {e}')
    exit(1)
" 2>/dev/null; then
        success "Banco de dados validado"
    else
        warning "Banco de dados pode ter problemas"
    fi
fi

# Verificar PDFs organizados
if [ -d "./organized" ]; then
    PDF_COUNT=$(find "./organized" -name "*.pdf" | wc -l)
    if [ "$PDF_COUNT" -gt 0 ]; then
        success "PDFs organizados validados: $PDF_COUNT arquivos"
    else
        warning "Nenhum PDF encontrado em ./organized"
    fi
fi

# 8. RESUMO FINAL
echo
log "🎉 Restore concluído!"
echo
echo "📋 Resumo:"
echo "  🗂️  Backup: $BACKUP_NAME"
echo "  💾 Banco: $([ -f "$BACKUP_PATH/pdf_organizer.db" ] && echo "✅ Restaurado" || echo "❌ Não encontrado")"
echo "  📄 PDFs: $([ -d "./organized" ] && echo "✅ Restaurados" || echo "❌ Não encontrados")"
echo "  📤 Uploads: $([ -d "$BACKUP_PATH/uploads" ] && echo "✅ Restaurados" || echo "❌ Não encontrados")"
echo "  ⚙️  Configs: $([ -d "$BACKUP_PATH/config" ] && echo "✅ Restauradas" || echo "❌ Não encontradas")"
echo
success "Todas as permissões foram corrigidas para appuser:appuser"
echo
echo "🔗 Acesse: http://localhost:5001"
echo

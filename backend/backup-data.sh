#!/bin/bash

# 🎵 Script de Backup - Organizador de Música Litúrgica
# Este script faz backup completo do banco de dados e PDFs organizados

set -e

# Configurações
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="musicas_backup_${TIMESTAMP}"
CONTAINER_NAME="musicas-igreja-app"

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

# Verificar se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando!"
fi

log "🎵 Iniciando backup dos dados..."

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

log "📁 Criando backup em: $BACKUP_PATH"

# Verificar se o container está rodando
if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    CONTAINER_RUNNING=true
    log "🐳 Container está rodando: $CONTAINER_NAME"
else
    CONTAINER_RUNNING=false
    warning "Container não está rodando: $CONTAINER_NAME"
fi

# 1. BACKUP DO BANCO DE DADOS
log "💾 Fazendo backup do banco de dados..."

if [ "$CONTAINER_RUNNING" = true ]; then
    # Container rodando - extrair DB do volume
    docker cp "$CONTAINER_NAME:/data/pdf_organizer.db" "$BACKUP_PATH/pdf_organizer.db" 2>/dev/null || {
        # Fallback para /app/data se /data não existir
        docker cp "$CONTAINER_NAME:/app/data/pdf_organizer.db" "$BACKUP_PATH/pdf_organizer.db" 2>/dev/null || {
            warning "Banco de dados não encontrado no container"
        }
    }
else
    # Container parado - usar docker run temporário
    if docker volume ls | grep -q "musicas_data"; then
        docker run --rm -v musicas_data:/data -v "$(pwd)/$BACKUP_PATH":/backup alpine sh -c "
            if [ -f /data/pdf_organizer.db ]; then
                cp /data/pdf_organizer.db /backup/pdf_organizer.db
                echo 'DB copiado de /data'
            else
                echo 'DB não encontrado em /data'
            fi
        " || warning "Falha ao acessar volume musicas_data"
    else
        warning "Volume musicas_data não encontrado"
    fi
fi

# Verificar se o backup do DB foi bem-sucedido
if [ -f "$BACKUP_PATH/pdf_organizer.db" ]; then
    DB_SIZE=$(ls -lh "$BACKUP_PATH/pdf_organizer.db" | awk '{print $5}')
    success "Banco de dados: $DB_SIZE"
    
    # Verificar integridade do banco
    if sqlite3 "$BACKUP_PATH/pdf_organizer.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        success "Integridade do banco verificada"
    else
        error "Banco de dados corrompido!"
    fi
else
    warning "Backup do banco de dados falhou"
fi

# 2. BACKUP DOS PDFs ORGANIZADOS
log "📄 Fazendo backup dos PDFs organizados..."

# Verificar se existe diretório organized
if [ -d "./organized" ]; then
    # Contar arquivos PDF
    PDF_COUNT=$(find "./organized" -name "*.pdf" | wc -l)
    
    if [ "$PDF_COUNT" -gt 0 ]; then
        # Copiar todo o diretório organized
        cp -r "./organized" "$BACKUP_PATH/"
        
        # Calcular tamanho total
        ORGANIZED_SIZE=$(du -sh "$BACKUP_PATH/organized" | awk '{print $1}')
        success "PDFs organizados: $PDF_COUNT arquivos ($ORGANIZED_SIZE)"
    else
        warning "Nenhum PDF encontrado em ./organized"
        mkdir -p "$BACKUP_PATH/organized"
    fi
else
    warning "Diretório ./organized não encontrado"
    mkdir -p "$BACKUP_PATH/organized"
fi

# 3. BACKUP DOS UPLOADS (se existirem)
log "📤 Fazendo backup dos uploads..."

if [ "$CONTAINER_RUNNING" = true ]; then
    # Tentar copiar uploads do container
    docker cp "$CONTAINER_NAME:/data/uploads" "$BACKUP_PATH/uploads" 2>/dev/null || {
        docker cp "$CONTAINER_NAME:/app/data/uploads" "$BACKUP_PATH/uploads" 2>/dev/null || {
            warning "Diretório uploads não encontrado no container"
            mkdir -p "$BACKUP_PATH/uploads"
        }
    }
else
    # Container parado - usar volume
    if docker volume ls | grep -q "musicas_data"; then
        docker run --rm -v musicas_data:/data -v "$(pwd)/$BACKUP_PATH":/backup alpine sh -c "
            if [ -d /data/uploads ]; then
                cp -r /data/uploads /backup/
                echo 'Uploads copiados de /data'
            else
                mkdir -p /backup/uploads
                echo 'Uploads não encontrados'
            fi
        " || {
            warning "Falha ao acessar uploads"
            mkdir -p "$BACKUP_PATH/uploads"
        }
    else
        mkdir -p "$BACKUP_PATH/uploads"
    fi
fi

# Verificar uploads
if [ -d "$BACKUP_PATH/uploads" ]; then
    UPLOAD_COUNT=$(find "$BACKUP_PATH/uploads" -type f | wc -l)
    if [ "$UPLOAD_COUNT" -gt 0 ]; then
        UPLOAD_SIZE=$(du -sh "$BACKUP_PATH/uploads" | awk '{print $1}')
        success "Uploads: $UPLOAD_COUNT arquivos ($UPLOAD_SIZE)"
    else
        success "Uploads: diretório vazio"
    fi
fi

# 4. BACKUP DAS CONFIGURAÇÕES
log "⚙️  Fazendo backup das configurações..."

# Copiar arquivos de configuração importantes
CONFIG_FILES=(
    "docker-compose.yml"
    ".env"
    "credentials.json"
    "token.json"
)

mkdir -p "$BACKUP_PATH/config"

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "./$file" ]; then
        cp "./$file" "$BACKUP_PATH/config/"
        success "Configuração: $file"
    elif [ "$CONTAINER_RUNNING" = true ]; then
        # Tentar extrair do container
        docker cp "$CONTAINER_NAME:/app/$file" "$BACKUP_PATH/config/" 2>/dev/null && {
            success "Configuração: $file (do container)"
        } || true
    fi
done

# 5. CRIAR MANIFESTO DO BACKUP
log "📋 Criando manifesto do backup..."

cat > "$BACKUP_PATH/MANIFEST.txt" << EOF
🎵 BACKUP - Organizador de Música Litúrgica
==========================================

Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')
Versão: $BACKUP_NAME
Container: $CONTAINER_NAME
Status Container: $([ "$CONTAINER_RUNNING" = true ] && echo "Rodando" || echo "Parado")

CONTEÚDO:
---------
EOF

if [ -f "$BACKUP_PATH/pdf_organizer.db" ]; then
    echo "✅ Banco de dados: $(ls -lh "$BACKUP_PATH/pdf_organizer.db" | awk '{print $5}')" >> "$BACKUP_PATH/MANIFEST.txt"
else
    echo "❌ Banco de dados: não encontrado" >> "$BACKUP_PATH/MANIFEST.txt"
fi

if [ -d "$BACKUP_PATH/organized" ]; then
    PDF_COUNT=$(find "$BACKUP_PATH/organized" -name "*.pdf" | wc -l)
    ORGANIZED_SIZE=$(du -sh "$BACKUP_PATH/organized" | awk '{print $1}')
    echo "✅ PDFs organizados: $PDF_COUNT arquivos ($ORGANIZED_SIZE)" >> "$BACKUP_PATH/MANIFEST.txt"
else
    echo "❌ PDFs organizados: não encontrado" >> "$BACKUP_PATH/MANIFEST.txt"
fi

if [ -d "$BACKUP_PATH/uploads" ]; then
    UPLOAD_COUNT=$(find "$BACKUP_PATH/uploads" -type f | wc -l)
    UPLOAD_SIZE=$(du -sh "$BACKUP_PATH/uploads" | awk '{print $1}')
    echo "✅ Uploads: $UPLOAD_COUNT arquivos ($UPLOAD_SIZE)" >> "$BACKUP_PATH/MANIFEST.txt"
else
    echo "❌ Uploads: não encontrado" >> "$BACKUP_PATH/MANIFEST.txt"
fi

# Listar configurações
echo "" >> "$BACKUP_PATH/MANIFEST.txt"
echo "CONFIGURAÇÕES:" >> "$BACKUP_PATH/MANIFEST.txt"
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$BACKUP_PATH/config/$file" ]; then
        echo "✅ $file" >> "$BACKUP_PATH/MANIFEST.txt"
    else
        echo "❌ $file" >> "$BACKUP_PATH/MANIFEST.txt"
    fi
done

# 6. COMPACTAR BACKUP (OPCIONAL)
read -p "🗜️  Deseja compactar o backup? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "🗜️  Compactando backup..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME/"
    
    # Verificar se a compactação foi bem-sucedida
    if [ -f "${BACKUP_NAME}.tar.gz" ]; then
        COMPRESSED_SIZE=$(ls -lh "${BACKUP_NAME}.tar.gz" | awk '{print $5}')
        success "Backup compactado: ${BACKUP_NAME}.tar.gz ($COMPRESSED_SIZE)"
        
        # Perguntar se deve remover pasta não compactada
        read -p "🗑️  Remover pasta não compactada? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$BACKUP_NAME"
            success "Pasta não compactada removida"
        fi
    else
        error "Falha na compactação"
    fi
    
    cd ..
fi

# 7. RESUMO FINAL
echo
log "🎉 Backup concluído!"
echo
echo "📁 Localização: $BACKUP_PATH"
echo "📋 Manifesto: $BACKUP_PATH/MANIFEST.txt"
echo
success "Para restaurar, use: ./restore-data.sh $BACKUP_NAME"
echo

# 8. CORRIGIR PERMISSÕES DOS ARQUIVOS DE BACKUP
log "🔧 Corrigindo permissões dos arquivos de backup..."

# Verificar se o usuário atual pode alterar permissões
if [ -w "$BACKUP_PATH" ]; then
    # Definir permissões corretas para backup
    find "$BACKUP_PATH" -type d -exec chmod 755 {} \;
    find "$BACKUP_PATH" -type f -exec chmod 644 {} \;
    
    # Se existir arquivo compactado, corrigir permissões também
    if [ -f "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" ]; then
        chmod 644 "$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    fi
    
    success "Permissões do backup corrigidas"
else
    warning "Não foi possível corrigir permissões do backup"
fi

# Listar backups existentes
echo "📦 Backups disponíveis:"
ls -la "$BACKUP_DIR" | grep musicas_backup || echo "Nenhum backup anterior encontrado"

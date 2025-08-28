#!/bin/bash

# 🎵 Deploy Seguro - Organizador de Música Litúrgica
# Este script faz deploy com backup automático dos dados

set -e

# Configurações
CONTAINER_NAME="musicas-igreja-app"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
AUTO_BACKUP_NAME="auto_backup_before_deploy_${TIMESTAMP}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

title() {
    echo -e "${PURPLE}🎵 $1${NC}"
}

# Função para corrigir permissões
fix_final_permissions() {
    log "🔧 Corrigindo permissões finais..."
    
    # Aguardar container estar pronto
    sleep 3
    
    if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
        docker exec "$CONTAINER_NAME" bash -c "
            # Corrigir ownership para appuser
            chown -R appuser:appuser /data /app/organized 2>/dev/null || true
            
            # Permissões de diretórios
            find /data -type d -exec chmod 755 {} \; 2>/dev/null || true
            find /app/organized -type d -exec chmod 755 {} \; 2>/dev/null || true
            
            # Permissões de arquivos
            find /data -type f -exec chmod 644 {} \; 2>/dev/null || true
            find /app/organized -type f -exec chmod 644 {} \; 2>/dev/null || true
            
            # Permissões específicas para executáveis se houver
            find /data -name '*.sh' -exec chmod 755 {} \; 2>/dev/null || true
            
            echo '✅ Permissões corrigidas para appuser:appuser'
        " && success "Permissões finais aplicadas"
    fi
    
    # Corrigir permissões no host também
    if [ -d "./organized" ]; then
        find "./organized" -type d -exec chmod 755 {} \; 2>/dev/null || true
        find "./organized" -type f -exec chmod 644 {} \; 2>/dev/null || true
    fi
}

# Banner inicial
clear
title "========================================"
title "   DEPLOY SEGURO - MÚSICAS IGREJA"
title "========================================"
echo

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml não encontrado. Execute este script do diretório backend/"
fi

# Verificar se o Docker está rodando
if ! docker info > /dev/null 2>&1; then
    error "Docker não está rodando!"
fi

# 1. BACKUP AUTOMÁTICO
title "📦 ETAPA 1: BACKUP AUTOMÁTICO"
echo

if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME" || docker volume ls | grep -q "musicas_data"; then
    log "🔄 Executando backup automático antes do deploy..."
    
    # Criar backup automaticamente
    if [ -f "./backup-data.sh" ]; then
        chmod +x ./backup-data.sh
        
        # Executar backup não-interativo
        BACKUP_DIR="$BACKUP_DIR" TIMESTAMP="$TIMESTAMP" bash -c "
            echo 'N' | ./backup-data.sh
        " && success "Backup automático concluído: $AUTO_BACKUP_NAME"
    else
        warning "Script de backup não encontrado, criando backup manual..."
        
        # Backup manual simples
        mkdir -p "$BACKUP_DIR/$AUTO_BACKUP_NAME"
        
        # Copiar dados importantes
        if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
            docker cp "$CONTAINER_NAME:/data/pdf_organizer.db" "$BACKUP_DIR/$AUTO_BACKUP_NAME/" 2>/dev/null || true
        fi
        
        if [ -d "./organized" ]; then
            cp -r "./organized" "$BACKUP_DIR/$AUTO_BACKUP_NAME/"
        fi
        
        success "Backup manual concluído"
    fi
else
    log "ℹ️  Nenhum container ou volume existente encontrado, pulando backup"
fi

echo

# 2. ESCOLHA DO TIPO DE DEPLOY
title "🚀 ETAPA 2: TIPO DE DEPLOY"
echo

echo "Escolha o tipo de deploy:"
echo "1) 🔄 Deploy normal (preservar volumes)"
echo "2) 🗑️  Deploy limpo (remover volumes)"
echo "3) 🔧 Deploy com rebuild (recriar imagens)"
echo "4) ❌ Cancelar"
echo

read -p "Digite sua escolha [1-4]: " -n 1 -r
echo
echo

case $REPLY in
    1)
        DEPLOY_TYPE="normal"
        title "🔄 Deploy Normal Selecionado"
        ;;
    2)
        DEPLOY_TYPE="clean"
        title "🗑️  Deploy Limpo Selecionado"
        warning "ATENÇÃO: Volumes serão removidos!"
        echo
        read -p "Tem certeza? Digite 'CONFIRMO' para continuar: " CONFIRM
        if [ "$CONFIRM" != "CONFIRMO" ]; then
            error "Deploy cancelado"
        fi
        ;;
    3)
        DEPLOY_TYPE="rebuild"
        title "🔧 Deploy com Rebuild Selecionado"
        ;;
    4)
        log "❌ Deploy cancelado pelo usuário"
        exit 0
        ;;
    *)
        error "Opção inválida"
        ;;
esac

echo

# 3. EXECUÇÃO DO DEPLOY
title "⚡ ETAPA 3: EXECUÇÃO DO DEPLOY"
echo

case $DEPLOY_TYPE in
    "normal")
        log "🔄 Iniciando deploy normal..."
        docker-compose down
        docker-compose pull
        docker-compose up -d
        ;;
    "clean")
        log "🗑️  Iniciando deploy limpo..."
        docker-compose down
        
        # Remover volumes
        log "🗑️  Removendo volumes..."
        docker volume rm $(docker volume ls -q | grep musicas) 2>/dev/null || true
        
        # Remover imagens antigas
        log "🗑️  Removendo imagens antigas..."
        docker image prune -f
        
        docker-compose pull
        docker-compose up -d
        ;;
    "rebuild")
        log "🔧 Iniciando deploy com rebuild..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        ;;
esac

echo

# 4. AGUARDAR INICIALIZAÇÃO
title "⏳ ETAPA 4: AGUARDANDO INICIALIZAÇÃO"
echo

log "⏳ Aguardando containers iniciarem..."
sleep 10

# Verificar health do container
MAX_ATTEMPTS=30
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$CONTAINER_NAME.*healthy\|Up"; then
        success "Container iniciado com sucesso!"
        break
    else
        log "Tentativa $ATTEMPT/$MAX_ATTEMPTS - Aguardando container ficar saudável..."
        sleep 5
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    error "Container não iniciou corretamente após $MAX_ATTEMPTS tentativas"
fi

echo

# 5. RESTAURAR DADOS (SE NECESSÁRIO)
title "📥 ETAPA 5: RESTAURAÇÃO DE DADOS"
echo

if [ "$DEPLOY_TYPE" = "clean" ]; then
    log "🔄 Deploy limpo detectado, dados precisam ser restaurados"
    
    if [ -d "$BACKUP_DIR/$AUTO_BACKUP_NAME" ]; then
        read -p "📥 Restaurar dados do backup automático? [Y/n]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            log "📥 Restaurando dados..."
            
            if [ -f "./restore-data.sh" ]; then
                chmod +x ./restore-data.sh
                echo "y" | ./restore-data.sh "$AUTO_BACKUP_NAME"
            else
                warning "Script de restore não encontrado, restauração manual necessária"
            fi
        fi
    fi
else
    log "✅ Deploy preservou volumes, dados mantidos"
fi

echo

# 6. CORREÇÃO FINAL DE PERMISSÕES
title "🔧 ETAPA 6: CORREÇÃO DE PERMISSÕES"
echo

fix_final_permissions

echo

# 7. VALIDAÇÃO PÓS-DEPLOY
title "✔️  ETAPA 7: VALIDAÇÃO"
echo

log "🔍 Validando deploy..."

# Verificar se container está rodando
if docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    success "Container está rodando"
    
    # Verificar aplicação respondendo
    if curl -f http://localhost:5001/health >/dev/null 2>&1; then
        success "Aplicação respondendo"
    else
        warning "Aplicação pode não estar respondendo corretamente"
    fi
    
    # Verificar banco de dados
    if docker exec "$CONTAINER_NAME" python -c "
import sqlite3
import os
db_path = os.environ.get('DATABASE_PATH', '/data/pdf_organizer.db')
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM pdf_files')
    count = cursor.fetchone()[0]
    print(f'Banco conectado: {count} arquivos registrados')
except Exception as e:
    print(f'Erro no banco: {e}')
    exit(1)
" 2>/dev/null; then
        success "Banco de dados funcionando"
    else
        warning "Banco de dados pode ter problemas"
    fi
    
    # Verificar permissões
    docker exec "$CONTAINER_NAME" bash -c "
        if [ -w /data ] && [ -r /data ]; then
            echo 'Permissões /data: OK'
        else
            echo 'Permissões /data: PROBLEMA'
            exit 1
        fi
    " >/dev/null 2>&1 && success "Permissões verificadas"
    
else
    error "Container não está rodando!"
fi

echo

# 8. RESUMO FINAL
title "🎉 DEPLOY CONCLUÍDO!"
echo

echo "📊 Resumo do Deploy:"
echo "  🕐 Horário: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  📦 Backup: $AUTO_BACKUP_NAME"
echo "  🚀 Tipo: $DEPLOY_TYPE"
echo "  🔧 Permissões: appuser:appuser"
echo

success "Sistema disponível em: http://localhost:5001"
success "Frontend disponível em: http://localhost:3001"

echo
log "📋 Logs do container:"
echo "  docker-compose logs -f"
echo
log "🔍 Debug se necessário:"
echo "  docker exec -it $CONTAINER_NAME bash"
echo
log "📦 Restaurar backup manual:"
echo "  ./restore-data.sh <nome_do_backup>"
echo

# Mostrar status dos containers
echo
log "📊 Status dos containers:"
docker-compose ps

echo
title "✅ Deploy finalizado com sucesso!"

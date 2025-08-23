#!/bin/bash

echo "🔧 Script Simples de Correção de Permissões"
echo "==========================================="

# Detectar se estamos em produção (dados persistentes) ou desenvolvimento
PERSISTENT_DATA_PATH="/home/runner/musicas-igreja-data"
if [ -d "$PERSISTENT_DATA_PATH" ]; then
    echo "🏭 Modo PRODUÇÃO detectado - usando dados persistentes"
    ORGANIZED_DIR="$PERSISTENT_DATA_PATH/organized"
    COMPOSE_FILE="docker-compose.production.yml"
else
    echo "💻 Modo DESENVOLVIMENTO detectado - usando workspace local"
    ORGANIZED_DIR="./organized"
    COMPOSE_FILE="docker-compose.yml"
fi

# Parar containers
echo "⏹️ Parando containers..."
if [ -f "$COMPOSE_FILE" ]; then
    docker-compose -f "$COMPOSE_FILE" down || true
else
    docker-compose down || true
fi

echo "🔍 Verificando diretório organized..."
echo "📂 Diretório alvo: $ORGANIZED_DIR"

if [ -d "$ORGANIZED_DIR" ]; then
    echo "✅ Diretório existe"
    echo "📋 Permissões atuais:"
    ls -la "$ORGANIZED_DIR"
    
    echo "🔧 Corrigindo permissões usando Docker..."
    docker run --rm -v "$ORGANIZED_DIR:/target" alpine:latest sh -c "
        chown -R 1000:1000 /target
        chmod -R 755 /target
        echo 'Permissions fixed via Docker'
    "
    
    echo "✅ Permissões corrigidas:"
    ls -la "$ORGANIZED_DIR"
else
    echo "❌ Diretório $ORGANIZED_DIR não encontrado, criando..."
    mkdir -p "$ORGANIZED_DIR"
    docker run --rm -v "$ORGANIZED_DIR:/target" alpine:latest sh -c "
        chown -R 1000:1000 /target
        chmod -R 755 /target
        echo 'Directory created with correct permissions via Docker'
    "
fi

echo "🗃️ Corrigindo volume Docker..."
docker run --rm -v musicas_data:/data alpine sh -c "
    chown -R 1000:1000 /data 2>/dev/null || true
    chmod -R 755 /data 2>/dev/null || true
    echo 'Volume permissions fixed'
" 2>/dev/null || echo "Volume não existe (será criado automaticamente)"

echo "🚀 Reiniciando sistema..."
if [ -f "$COMPOSE_FILE" ]; then
    echo "📄 Usando $COMPOSE_FILE"
    docker-compose -f "$COMPOSE_FILE" up -d
else
    echo "📄 Usando docker-compose.yml padrão"
    docker-compose up -d
fi

echo "⏱️ Aguardando 20 segundos..."
sleep 20

echo "📊 Status final:"
if [ -f "$COMPOSE_FILE" ]; then
    docker-compose -f "$COMPOSE_FILE" ps
else
    docker-compose ps
fi

echo "🎯 Teste de saúde:"
if curl -s http://localhost:5001/health >/dev/null 2>&1; then
    echo "✅ Sistema funcionando!"
    echo "🎉 Problema de permissões resolvido!"
else
    echo "⚠️ Sistema ainda não respondendo, verificando logs..."
    if [ -f "$COMPOSE_FILE" ]; then
        docker-compose -f "$COMPOSE_FILE" logs --tail=20 musicas-igreja
    else
        docker-compose logs --tail=20 musicas-igreja
    fi
fi

echo ""
echo "📊 Informações do setup:"
echo "   Diretório organized: $ORGANIZED_DIR"
echo "   Compose file: $COMPOSE_FILE"
echo "   Modo: $([ -d "$PERSISTENT_DATA_PATH" ] && echo "PRODUÇÃO" || echo "DESENVOLVIMENTO")"
echo ""
echo "✅ Script finalizado!"

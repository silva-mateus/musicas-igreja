#!/bin/bash

echo "🔧 Script de Correção de Permissões - Músicas Igreja"
echo "=================================================="

# Parar containers
echo "⏹️  Parando containers..."
docker-compose down

# Verificar diretório organized
if [ -d "./organized" ]; then
    echo "✅ Diretório ./organized encontrado"
    
    # Mostrar permissões atuais
    echo "📋 Permissões atuais:"
    ls -la ./organized
    
    # Corrigir permissões (UID 1000 = appuser do container)
    echo "🔧 Corrigindo permissões para UID/GID 1000..."
    sudo chown -R 1000:1000 ./organized
    sudo chmod -R 755 ./organized
    
    echo "✅ Permissões corrigidas:"
    ls -la ./organized
else
    echo "❌ Diretório ./organized não encontrado!"
    echo "   Criando estrutura básica..."
    
    mkdir -p ./organized
    sudo chown -R 1000:1000 ./organized
    sudo chmod -R 755 ./organized
    
    echo "✅ Diretório criado com permissões corretas"
fi

# Verificar volume Docker
echo "🗃️  Verificando volume musicas_data..."
docker volume inspect musicas_data >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Volume musicas_data existe"
    
    # Corrigir permissões do volume
    echo "🔧 Corrigindo permissões do volume..."
    docker run --rm -v musicas_data:/data alpine sh -c "
        chown -R 1000:1000 /data
        chmod -R 755 /data
        ls -la /data
    "
else
    echo "⚠️  Volume musicas_data não existe (será criado automaticamente)"
fi

# Opção de usar docker-compose com root temporariamente
echo ""
echo "🚀 Opções para subir o sistema:"
echo "1. Subir normal (recomendado se permissões foram corrigidas):"
echo "   docker-compose up -d"
echo ""
echo "2. Subir como root temporariamente (se ainda tiver problemas):"
echo "   docker-compose -f docker-compose.fix-permissions.yml up -d"
echo ""

read -p "Deseja subir o sistema agora? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Subindo sistema..."
    docker-compose up -d
    
    echo "📊 Status dos containers:"
    sleep 5
    docker ps | grep musicas
    
    echo ""
    echo "📋 Para monitorar logs:"
    echo "docker logs -f musicas-igreja-app"
fi

echo ""
echo "✅ Script finalizado!"

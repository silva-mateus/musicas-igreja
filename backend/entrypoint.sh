#!/bin/bash
set -e

# Função de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "🎵 Iniciando Organizador de Música Litúrgica..."

# Criar diretórios necessários se não existirem
mkdir -p /data/logs /data/uploads

# Configurar permissões
chmod 755 /data
chmod 755 /data/logs /data/uploads

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
import time
sys.path.insert(0, '/app')
import sqlite3

max_retries = 3
for attempt in range(max_retries):
    try:
        conn = sqlite3.connect('/data/pdf_organizer.db')
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM sqlite_master WHERE type=\"table\"')
        tables = cursor.fetchone()[0]
        conn.close()
        print(f'✅ Banco conectado. {tables} tabelas encontradas.')
        break
    except Exception as e:
        print(f'⚠️  Tentativa {attempt + 1}/{max_retries} - Erro ao conectar ao banco: {e}')
        if attempt == max_retries - 1:
            print('❌ Falha após todas as tentativas. Continuando mesmo assim...')
        else:
            time.sleep(2)
"

# Verificar dependências Python
log "📦 Verificando dependências Python..."
python -c "
packages = ['flask', 'bcrypt', 'pypdf']
missing = []
for pkg in packages:
    try:
        __import__(pkg)
        print(f'✅ {pkg} - OK')
    except ImportError:
        missing.append(pkg)
        print(f'❌ {pkg} - FALTANDO')

if missing:
    print(f'⚠️  ATENÇÃO: Dependências faltando: {missing}')
    print('⚠️  A aplicação pode não funcionar corretamente.')
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
export ORGANIZED_FOLDER=${ORGANIZED_FOLDER:-/app/organized}
export LOG_FOLDER=${LOG_FOLDER:-/data/logs}

# Verificar se estamos rodando como root e devemos corrigir permissões
if [ "$(id -u)" = "0" ] && [ "${FIX_PERMISSIONS}" = "true" ]; then
    log "🔧 Rodando como root - corrigindo permissões de volumes..."
    
    # Corrigir permissões do volume /data
    if [ -d "/data" ]; then
        chown -R 1000:1000 /data
        chmod -R 755 /data
        log "✅ Permissões de /data corrigidas"
    fi
    
    # Corrigir permissões do volume /app/organized
    if [ -d "/app/organized" ]; then
        chown -R 1000:1000 /app/organized
        chmod -R 755 /app/organized
        log "✅ Permissões de /app/organized corrigidas"
    fi
    
    log "🔄 Reiniciando como usuário appuser..."
    exec su-exec 1000:1000 "$0" "$@"
fi

# Verificar e configurar diretório organized
log "📁 Configurando diretório organized: $ORGANIZED_FOLDER"
if [ -d "/app/organized" ]; then
    log "✅ Diretório /app/organized encontrado"
    
    # Tentar ajustar permissões (pode falhar se for volume mount)
    if chmod -R 777 /app/organized 2>/dev/null; then
        log "✅ Permissões ajustadas para /app/organized"
    else
        log "⚠️  Não foi possível ajustar permissões (provavelmente volume mount)"
        log "   Isso é normal para volumes Docker. Testando acesso..."
    fi
    
    # Verificar se conseguimos escrever no diretório
    test_file="/app/organized/.write_test_$$"
    if echo "test" > "$test_file" 2>/dev/null; then
        rm -f "$test_file" 2>/dev/null
        log "✅ Diretório /app/organized tem acesso de escrita"
    else
        log "❌ Sem acesso de escrita em /app/organized"
        log "   DICA: Execute 'sudo chown -R 1000:1000 ./organized' no host"
    fi
    
    # Verificar se tem conteúdo (pelo menos uma pasta de categoria)
    if [ -z "$(ls -A /app/organized 2>/dev/null)" ]; then
        log "📂 Diretório organized vazio. Tentando criar estrutura básica..."
        if mkdir -p "/app/organized"/{Aclamação,Adoração,Animação,Casamento,Comunhão,Entrada,Final,Ofertório} 2>/dev/null; then
            log "✅ Estrutura básica criada"
        else
            log "⚠️  Não foi possível criar estrutura (sem permissões)"
        fi
    fi
else
    log "⚠️  Diretório /app/organized não encontrado. Tentando criar..."
    if mkdir -p "/app/organized"/{Aclamação,Adoração,Animação,Casamento,Comunhão,Entrada,Final,Ofertório} 2>/dev/null; then
        log "✅ Diretório /app/organized criado com estrutura básica"
    else
        log "❌ Não foi possível criar /app/organized"
        log "   Verificando se diretório pai existe..."
        ls -la /app/ 2>/dev/null || log "   Diretório /app não acessível"
    fi
fi

log "📝 Configurações:"
log "   FLASK_ENV: $FLASK_ENV"
log "   DATABASE_PATH: $DATABASE_PATH"
log "   UPLOAD_FOLDER: $UPLOAD_FOLDER"
log "   ORGANIZED_FOLDER: $ORGANIZED_FOLDER"
log "   LOG_FOLDER: $LOG_FOLDER"

# Verificar permissões de diretórios críticos
log "🔒 Verificando permissões de diretórios..."
for dir in "/data/uploads" "/app/organized" "/data/logs"; do
    if [ -d "$dir" ]; then
        perms=$(ls -ld "$dir" | awk '{print $1, $3, $4}')
        log "   $dir: $perms"
    else
        log "   $dir: ❌ não existe"
    fi
done

# Testar escrita nos diretórios críticos
log "✍️  Testando escrita nos diretórios..."
for dir in "/data/uploads" "/app/organized"; do
    if [ -d "$dir" ]; then
        test_file="$dir/.write_test_$$"
        if echo "test" > "$test_file" 2>/dev/null; then
            rm -f "$test_file" 2>/dev/null
            log "   $dir: ✅ escrita OK"
        else
            log "   $dir: ⚠️  sem permissão de escrita"
            if [ "$dir" = "/app/organized" ]; then
                log "      → Execute no host: sudo chown -R 1000:1000 ./organized"
            fi
        fi
    else
        log "   $dir: ❓ não existe"
    fi
done

# Verificar se a variável ORGANIZED_FOLDER está sendo lida corretamente pelo Python
log "🐍 Verificando leitura da variável ORGANIZED_FOLDER pelo Python..."
python -c "
import os
import glob

organized_folder = os.environ.get('ORGANIZED_FOLDER', 'NOT_SET')
print(f'ORGANIZED_FOLDER no Python: {organized_folder}')

if organized_folder == 'NOT_SET':
    print('❌ ORGANIZED_FOLDER não está definida!')
else:
    print('✅ ORGANIZED_FOLDER lida corretamente')
    if os.path.exists(organized_folder):
        print(f'✅ Diretório {organized_folder} existe')
        # Contar PDFs existentes para confirmar que é o diretório correto
        pdf_count = len(glob.glob(organized_folder + '/**/*.pdf', recursive=True))
        print(f'📄 Encontrados {pdf_count} arquivos PDF no diretório organized')
        if pdf_count > 0:
            print('✅ Diretório contém PDFs existentes - configuração correta!')
        else:
            print('⚠️  Nenhum PDF encontrado - verifique se é o diretório correto')
    else:
        print(f'❌ Diretório {organized_folder} não existe')
"

# Executar comando passado como argumento
log "🚀 Iniciando aplicação..."
exec "$@"
#!/bin/bash

# Script para desenvolvimento local sem Docker
# Sistema de Músicas da Igreja

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Banner
echo -e "${BLUE}"
cat << "EOF"
🎵 ====================================== 🎵
   SISTEMA DE MÚSICAS DA IGREJA
      Desenvolvimento Local
🎵 ====================================== 🎵
EOF
echo -e "${NC}"

# Verificar dependências
check_dependencies() {
    log "Verificando dependências..."
    
    # Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 não encontrado!"
        echo "Instale Python 3: https://www.python.org/downloads/"
        exit 1
    fi
    success "Python 3 encontrado: $(python3 --version)"
    
    # Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js não encontrado!"
        echo "Instale Node.js: https://nodejs.org/"
        exit 1
    fi
    success "Node.js encontrado: $(node --version)"
    
    # npm
    if ! command -v npm &> /dev/null; then
        error "npm não encontrado!"
        exit 1
    fi
    success "npm encontrado: $(npm --version)"
}

# Configurar backend
setup_backend() {
    log "Configurando backend Flask..."
    
    cd backend
    
    # Criar ambiente virtual se não existir
    if [ ! -d "venv" ]; then
        log "Criando ambiente virtual Python..."
        python3 -m venv venv
        success "Ambiente virtual criado!"
    fi
    
    # Ativar ambiente virtual
    source venv/bin/activate
    
    # Instalar dependências
    log "Instalando dependências Python..."
    pip install -r requirements.txt
    
    # Criar diretórios necessários
    mkdir -p data logs uploads organized
    
    # Copiar banco se existir na raiz
    if [ -f "../pdf_organizer.db" ] && [ ! -f "data/pdf_organizer.db" ]; then
        log "Copiando banco de dados existente..."
        cp ../pdf_organizer.db data/
        success "Banco de dados copiado!"
    fi
    
    cd ..
    success "Backend configurado!"
}

# Configurar frontend
setup_frontend() {
    log "Configurando frontend NextJS..."
    
    cd frontend
    
    # Instalar dependências se não existir node_modules
    if [ ! -d "node_modules" ]; then
        log "Instalando dependências Node.js..."
        npm install
        success "Dependências instaladas!"
    else
        log "Dependências já instaladas, verificando atualizações..."
        npm ci
    fi
    
    cd ..
    success "Frontend configurado!"
}

# Configurar ambiente
setup_environment() {
    log "Configurando variáveis de ambiente..."
    
    # Criar .env se não existir
    if [ ! -f ".env" ]; then
        if [ -f "env.example.new" ]; then
            cp env.example.new .env
            success "Arquivo .env criado a partir do template!"
            warning "Configure as variáveis em .env conforme necessário"
        else
            error "Template env.example.new não encontrado!"
            exit 1
        fi
    else
        success "Arquivo .env já existe!"
    fi
}

# Função para iniciar backend
start_backend() {
    log "Iniciando backend Flask..."
    cd backend
    source venv/bin/activate
    
    export FLASK_ENV=development
    export DATABASE_PATH=./data/pdf_organizer.db
    export UPLOAD_FOLDER=./uploads
    export ORGANIZED_FOLDER=./organized
    export LOG_FOLDER=./logs
    export SECRET_KEY=dev-secret-key-not-for-production
    export FRONTEND_URL=http://localhost:3000
    
    python app.py
}

# Função para iniciar frontend  
start_frontend() {
    log "Iniciando frontend NextJS..."
    cd frontend
    
    export NEXT_PUBLIC_API_URL=http://localhost:5000
    export NODE_ENV=development
    
    npm run dev
}

# Função para verificar status
check_status() {
    log "Verificando status dos serviços..."
    
    # Backend
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        success "Backend está rodando: http://localhost:5000"
    else
        warning "Backend não está respondendo em http://localhost:5000"
    fi
    
    # Frontend
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        success "Frontend está rodando: http://localhost:3000"
    else
        warning "Frontend não está respondendo em http://localhost:3000"
    fi
}

# Menu principal
show_menu() {
    echo
    log "Escolha uma opção:"
    echo "1) 🔧 Configurar ambiente (primeira vez)"
    echo "2) 🐍 Iniciar apenas Backend (http://localhost:5000)"
    echo "3) ⚛️  Iniciar apenas Frontend (http://localhost:3000)"
    echo "4) 🚀 Iniciar ambos (em paralelo)"
    echo "5) 📊 Verificar status dos serviços"
    echo "6) 🧹 Limpar ambiente"
    echo "7) ❌ Sair"
    echo
}

# Limpar ambiente
clean_environment() {
    log "Limpando ambiente..."
    
    # Parar processos se estiverem rodando
    pkill -f "python app.py" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    
    # Remover node_modules e venv se solicitado
    read -p "Remover node_modules e venv? (y/N): " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        rm -rf frontend/node_modules
        rm -rf backend/venv
        success "Ambiente limpo!"
    fi
}

# Iniciar ambos em paralelo
start_both() {
    log "Iniciando backend e frontend em paralelo..."
    echo
    warning "Use Ctrl+C para parar ambos os serviços"
    echo
    
    # Iniciar backend em background
    (
        cd backend
        source venv/bin/activate
        export FLASK_ENV=development
        export DATABASE_PATH=./data/pdf_organizer.db
        export UPLOAD_FOLDER=./uploads
        export ORGANIZED_FOLDER=./organized
        export LOG_FOLDER=./logs
        export SECRET_KEY=dev-secret-key-not-for-production
        export FRONTEND_URL=http://localhost:3000
        python app.py
    ) &
    BACKEND_PID=$!
    
    # Aguardar backend iniciar
    sleep 3
    
    # Iniciar frontend em background
    (
        cd frontend
        export NEXT_PUBLIC_API_URL=http://localhost:5000
        export NODE_ENV=development
        npm run dev
    ) &
    FRONTEND_PID=$!
    
    # Aguardar ambos iniciarem
    sleep 5
    
    # Mostrar URLs
    echo
    success "🎉 Ambos os serviços iniciados!"
    echo
    echo "📍 URLs disponíveis:"
    echo "  🎨 Frontend: http://localhost:3000"
    echo "  🔧 Backend:  http://localhost:5000"
    echo "  ❤️  Health:  http://localhost:5000/health"
    echo
    
    # Aguardar interrupção
    trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
    wait
}

# Função principal
main() {
    while true; do
        show_menu
        read -p "Digite sua escolha (1-7): " choice
        
        case $choice in
            1)
                check_dependencies
                setup_environment
                setup_backend
                setup_frontend
                success "🎉 Ambiente configurado com sucesso!"
                ;;
            2)
                start_backend
                ;;
            3)
                start_frontend
                ;;
            4)
                start_both
                ;;
            5)
                check_status
                ;;
            6)
                clean_environment
                ;;
            7)
                log "Saindo..."
                exit 0
                ;;
            *)
                error "Opção inválida!"
                ;;
        esac
        
        if [ "$choice" != "4" ]; then
            echo
            read -p "Pressione Enter para continuar..."
        fi
    done
}

# Interceptar Ctrl+C
trap 'echo -e "\n${YELLOW}Interrompido pelo usuário${NC}"; exit 0' INT

# Executar função principal
main
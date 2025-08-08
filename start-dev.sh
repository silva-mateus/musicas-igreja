#!/bin/bash

# Script de inicialização para desenvolvimento do Sistema Músicas Igreja
# Autor: Sistema de Músicas da Igreja
# Versão: 2.0.0

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
        Ambiente de Desenvolvimento
🎵 ====================================== 🎵
EOF
echo -e "${NC}"

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado!"
    echo "Por favor, instale o Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "Docker Compose não está instalado!"
    echo "Por favor, instale o Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    warning "Arquivo .env não encontrado"
    log "Criando .env a partir do template..."
    
    if [ -f "env.example.new" ]; then
        cp env.example.new .env
        success ".env criado a partir do template"
        warning "Por favor, edite o arquivo .env com suas configurações"
    else
        error "Template env.example.new não encontrado!"
        exit 1
    fi
fi

# Função para escolher modo de execução
choose_mode() {
    echo
    log "Escolha o modo de execução:"
    echo "1) 🐳 Docker Development (Recomendado)"
    echo "2) 🐳 Docker Production" 
    echo "3) 💻 Local Development (Manual)"
    echo "4) 🧹 Cleanup (Parar e limpar containers)"
    echo "5) 📊 Status dos serviços"
    echo
    read -p "Digite sua escolha (1-5): " choice
    
    case $choice in
        1)
            run_docker_dev
            ;;
        2)
            run_docker_prod
            ;;
        3)
            run_local_dev
            ;;
        4)
            cleanup_containers
            ;;
        5)
            show_status
            ;;
        *)
            error "Opção inválida!"
            choose_mode
            ;;
    esac
}

# Executar em modo Docker Development
run_docker_dev() {
    log "Iniciando em modo Docker Development..."
    
    # Verificar se existe docker-compose.dev.yml
    if [ ! -f "docker-compose.dev.yml" ]; then
        error "Arquivo docker-compose.dev.yml não encontrado!"
        exit 1
    fi
    
    # Parar containers existentes
    log "Parando containers existentes..."
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    
    # Iniciar serviços
    log "Iniciando serviços..."
    docker-compose -f docker-compose.dev.yml up --build
}

# Executar em modo Docker Production
run_docker_prod() {
    log "Iniciando em modo Docker Production..."
    
    # Verificar se existe docker-compose.yml
    if [ ! -f "docker-compose.yml" ]; then
        error "Arquivo docker-compose.yml não encontrado!"
        exit 1
    fi
    
    # Parar containers existentes
    log "Parando containers existentes..."
    docker-compose down 2>/dev/null || true
    
    # Iniciar serviços
    log "Iniciando serviços..."
    docker-compose up --build -d
    
    success "Serviços iniciados em modo produção!"
    show_urls
}

# Executar desenvolvimento local
run_local_dev() {
    log "Configurando desenvolvimento local..."
    
    # Verificar dependências
    if ! command -v python3 &> /dev/null; then
        error "Python 3 não está instalado!"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        error "Node.js não está instalado!"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm não está instalado!"
        exit 1
    fi
    
    # Instalar dependências do backend
    if [ ! -d "backend/venv" ]; then
        log "Criando ambiente virtual Python..."
        cd backend
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        cd ..
        success "Ambiente virtual Python criado!"
    fi
    
    # Instalar dependências do frontend
    if [ ! -d "frontend/node_modules" ]; then
        log "Instalando dependências do frontend..."
        cd frontend
        npm install
        cd ..
        success "Dependências do frontend instaladas!"
    fi
    
    warning "Para executar localmente:"
    echo "Terminal 1 (Backend):"
    echo "  cd backend && source venv/bin/activate && python app.py"
    echo
    echo "Terminal 2 (Frontend):"
    echo "  cd frontend && npm run dev"
    echo
}

# Limpar containers
cleanup_containers() {
    log "Limpando containers e volumes..."
    
    # Parar e remover containers
    docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
    docker-compose down -v 2>/dev/null || true
    
    # Remover imagens órfãs
    docker image prune -f
    
    # Remover volumes órfãos
    docker volume prune -f
    
    success "Limpeza concluída!"
}

# Mostrar status dos serviços
show_status() {
    log "Status dos serviços:"
    echo
    
    # Verificar containers
    if docker ps -q --filter "name=musicas-igreja" | grep -q .; then
        echo "🐳 Containers Docker:"
        docker ps --filter "name=musicas-igreja" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo
    else
        warning "Nenhum container Docker rodando"
    fi
    
    # Verificar URLs
    echo "🌐 URLs dos serviços:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000"
    echo "  Health:   http://localhost:5000/health"
    echo
    
    # Testar conectividade
    log "Testando conectividade..."
    
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        success "Backend está respondendo"
    else
        warning "Backend não está respondendo"
    fi
    
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        success "Frontend está respondendo"
    else
        warning "Frontend não está respondendo"
    fi
}

# Mostrar URLs úteis
show_urls() {
    echo
    success "🎉 Sistema iniciado com sucesso!"
    echo
    echo "📍 URLs dos serviços:"
    echo "  🎨 Frontend:   http://localhost:3000"
    echo "  🔧 Backend:    http://localhost:5000"
    echo "  ❤️  Health:    http://localhost:5000/health"
    echo "  📊 Dashboard:  http://localhost:3000/dashboard"
    echo
    echo "🔧 Comandos úteis:"
    echo "  docker-compose logs -f backend   # Logs do backend"
    echo "  docker-compose logs -f frontend  # Logs do frontend"
    echo "  docker-compose ps               # Status dos containers"
    echo
}

# Interceptar Ctrl+C
trap 'echo -e "\n${YELLOW}Interrompido pelo usuário${NC}"; exit 0' INT

# Executar função principal
choose_mode
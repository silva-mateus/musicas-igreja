# Script de inicialização para desenvolvimento do Sistema Músicas Igreja (Windows)
# Autor: Sistema de Músicas da Igreja
# Versão: 2.0.0

param(
    [string]$Mode = ""
)

# Configurar encoding para caracteres especiais
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Funções para output colorido
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# Banner
Write-Host @"
🎵 ====================================== 🎵
   SISTEMA DE MÚSICAS DA IGREJA
        Ambiente de Desenvolvimento
🎵 ====================================== 🎵
"@ -ForegroundColor Blue

# Verificar se Docker está instalado
function Test-Docker {
    try {
        $null = docker --version
        return $true
    }
    catch {
        Write-Error "Docker não está instalado!"
        Write-Host "Por favor, instale o Docker Desktop: https://docs.docker.com/desktop/windows/"
        exit 1
    }
}

# Verificar se Docker Compose está disponível
function Test-DockerCompose {
    try {
        $null = docker compose version
        return $true
    }
    catch {
        try {
            $null = docker-compose --version
            return $true
        }
        catch {
            Write-Error "Docker Compose não está instalado!"
            Write-Host "Por favor, instale o Docker Compose: https://docs.docker.com/compose/install/"
            exit 1
        }
    }
}

# Verificar arquivo .env
function Test-EnvFile {
    if (-not (Test-Path ".env")) {
        Write-Warning "Arquivo .env não encontrado"
        Write-Log "Criando .env a partir do template..."
        
        if (Test-Path "env.example.new") {
            Copy-Item "env.example.new" ".env"
            Write-Success ".env criado a partir do template"
            Write-Warning "Por favor, edite o arquivo .env com suas configurações"
        }
        else {
            Write-Error "Template env.example.new não encontrado!"
            exit 1
        }
    }
}

# Escolher modo de execução
function Choose-Mode {
    Write-Host ""
    Write-Log "Escolha o modo de execução:"
    Write-Host "1) 🐳 Docker Development (Recomendado)"
    Write-Host "2) 🐳 Docker Production"
    Write-Host "3) 💻 Local Development (Manual)"
    Write-Host "4) 🧹 Cleanup (Parar e limpar containers)"
    Write-Host "5) 📊 Status dos serviços"
    Write-Host ""
    
    $choice = Read-Host "Digite sua escolha (1-5)"
    
    switch ($choice) {
        "1" { Start-DockerDev }
        "2" { Start-DockerProd }
        "3" { Start-LocalDev }
        "4" { Start-Cleanup }
        "5" { Show-Status }
        default {
            Write-Error "Opção inválida!"
            Choose-Mode
        }
    }
}

# Executar em modo Docker Development
function Start-DockerDev {
    Write-Log "Iniciando em modo Docker Development..."
    
    if (-not (Test-Path "docker-compose.dev.yml")) {
        Write-Error "Arquivo docker-compose.dev.yml não encontrado!"
        exit 1
    }
    
    Write-Log "Parando containers existentes..."
    try {
        docker compose -f docker-compose.dev.yml down 2>$null
    }
    catch {
        # Ignorar erros se não houver containers
    }
    
    Write-Log "Iniciando serviços..."
    docker compose -f docker-compose.dev.yml up --build
}

# Executar em modo Docker Production
function Start-DockerProd {
    Write-Log "Iniciando em modo Docker Production..."
    
    if (-not (Test-Path "docker-compose.yml")) {
        Write-Error "Arquivo docker-compose.yml não encontrado!"
        exit 1
    }
    
    Write-Log "Parando containers existentes..."
    try {
        docker compose down 2>$null
    }
    catch {
        # Ignorar erros se não houver containers
    }
    
    Write-Log "Iniciando serviços..."
    docker compose up --build -d
    
    Write-Success "Serviços iniciados em modo produção!"
    Show-Urls
}

# Executar desenvolvimento local
function Start-LocalDev {
    Write-Log "Configurando desenvolvimento local..."
    
    # Verificar Python
    try {
        $null = python --version
    }
    catch {
        Write-Error "Python não está instalado!"
        Write-Host "Por favor, instale Python: https://www.python.org/downloads/"
        exit 1
    }
    
    # Verificar Node.js
    try {
        $null = node --version
    }
    catch {
        Write-Error "Node.js não está instalado!"
        Write-Host "Por favor, instale Node.js: https://nodejs.org/"
        exit 1
    }
    
    # Verificar npm
    try {
        $null = npm --version
    }
    catch {
        Write-Error "npm não está instalado!"
        exit 1
    }
    
    # Configurar backend
    if (-not (Test-Path "backend\venv")) {
        Write-Log "Criando ambiente virtual Python..."
        Set-Location backend
        python -m venv venv
        .\venv\Scripts\Activate.ps1
        pip install -r requirements.txt
        Set-Location ..
        Write-Success "Ambiente virtual Python criado!"
    }
    
    # Configurar frontend
    if (-not (Test-Path "frontend\node_modules")) {
        Write-Log "Instalando dependências do frontend..."
        Set-Location frontend
        npm install
        Set-Location ..
        Write-Success "Dependências do frontend instaladas!"
    }
    
    Write-Warning "Para executar localmente:"
    Write-Host "Terminal 1 (Backend):"
    Write-Host "  cd backend"
    Write-Host "  .\venv\Scripts\Activate.ps1"
    Write-Host "  python app.py"
    Write-Host ""
    Write-Host "Terminal 2 (Frontend):"
    Write-Host "  cd frontend"
    Write-Host "  npm run dev"
    Write-Host ""
}

# Limpar containers
function Start-Cleanup {
    Write-Log "Limpando containers e volumes..."
    
    # Parar e remover containers
    try {
        docker compose -f docker-compose.dev.yml down -v 2>$null
    }
    catch {}
    
    try {
        docker compose down -v 2>$null
    }
    catch {}
    
    # Remover imagens órfãs
    docker image prune -f
    
    # Remover volumes órfãos
    docker volume prune -f
    
    Write-Success "Limpeza concluída!"
}

# Mostrar status dos serviços
function Show-Status {
    Write-Log "Status dos serviços:"
    Write-Host ""
    
    # Verificar containers
    $containers = docker ps --filter "name=musicas-igreja" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    if ($containers -and $containers.Count -gt 1) {
        Write-Host "🐳 Containers Docker:"
        $containers | ForEach-Object { Write-Host $_ }
        Write-Host ""
    }
    else {
        Write-Warning "Nenhum container Docker rodando"
    }
    
    # Verificar URLs
    Write-Host "🌐 URLs dos serviços:"
    Write-Host "  Frontend: http://localhost:3000"
    Write-Host "  Backend:  http://localhost:5000"
    Write-Host "  Health:   http://localhost:5000/health"
    Write-Host ""
    
    # Testar conectividade
    Write-Log "Testando conectividade..."
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Success "Backend está respondendo"
        }
    }
    catch {
        Write-Warning "Backend não está respondendo"
    }
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Success "Frontend está respondendo"
        }
    }
    catch {
        Write-Warning "Frontend não está respondendo"
    }
}

# Mostrar URLs úteis
function Show-Urls {
    Write-Host ""
    Write-Success "🎉 Sistema iniciado com sucesso!"
    Write-Host ""
    Write-Host "📍 URLs dos serviços:"
    Write-Host "  🎨 Frontend:   http://localhost:3000"
    Write-Host "  🔧 Backend:    http://localhost:5000"
    Write-Host "  ❤️  Health:    http://localhost:5000/health"
    Write-Host "  📊 Dashboard:  http://localhost:3000/dashboard"
    Write-Host ""
    Write-Host "🔧 Comandos úteis:"
    Write-Host "  docker compose logs -f backend   # Logs do backend"
    Write-Host "  docker compose logs -f frontend  # Logs do frontend"
    Write-Host "  docker compose ps               # Status dos containers"
    Write-Host ""
}

# Função principal
function Main {
    Test-Docker
    Test-DockerCompose
    Test-EnvFile
    
    if ($Mode) {
        switch ($Mode.ToLower()) {
            "dev" { Start-DockerDev }
            "prod" { Start-DockerProd }
            "local" { Start-LocalDev }
            "cleanup" { Start-Cleanup }
            "status" { Show-Status }
            default { Choose-Mode }
        }
    }
    else {
        Choose-Mode
    }
}

# Interceptar Ctrl+C
try {
    Main
}
catch [System.Management.Automation.FlowControlException] {
    Write-Host "`n⚠️  Interrompido pelo usuário" -ForegroundColor Yellow
    exit 0
}
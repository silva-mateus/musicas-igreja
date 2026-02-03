# PowerShell Deploy Script with Tests
# Usage: .\deploy.ps1 [--skip-tests]

param(
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Musicas Igreja - Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$RootDir = $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$TestsDir = Join-Path $RootDir "backend.tests"
$FrontendDir = Join-Path $RootDir "frontend"

# Step 1: Run Tests
if (-not $SkipTests) {
    Write-Host "[1/4] Running Backend Tests..." -ForegroundColor Yellow
    Write-Host ""
    
    Push-Location $TestsDir
    try {
        dotnet restore --verbosity quiet
        dotnet build --no-restore --configuration Release --verbosity quiet
        dotnet test --no-build --configuration Release --verbosity normal
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Red
            Write-Host "  DEPLOY ABORTED: Tests failed!" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "Tests passed successfully!" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[1/4] Skipping tests (--skip-tests flag used)" -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Build Backend
Write-Host "[2/4] Building Backend..." -ForegroundColor Yellow
Push-Location $BackendDir
try {
    dotnet build --configuration Release --verbosity quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Backend build successful!" -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host ""

# Step 3: Build Frontend
Write-Host "[3/4] Building Frontend..." -ForegroundColor Yellow
Push-Location $FrontendDir
try {
    npm ci --silent
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Frontend build successful!" -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host ""

# Step 4: Docker Build (optional)
Write-Host "[4/4] Building Docker Images..." -ForegroundColor Yellow
try {
    docker build -t musicas-backend:latest ./backend
    docker build -t musicas-frontend:latest ./frontend
    Write-Host "Docker images built successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Docker build skipped or failed (Docker may not be available)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deploy preparation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the services, run:" -ForegroundColor Cyan
Write-Host "  .\start-all.ps1" -ForegroundColor White

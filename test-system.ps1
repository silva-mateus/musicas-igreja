# Script para testar sistema rapidamente
param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Both
)

Write-Host "🎵 ====================================== 🎵" -ForegroundColor Blue
Write-Host "   TESTE RÁPIDO DO SISTEMA" -ForegroundColor Yellow
Write-Host "🎵 ====================================== 🎵" -ForegroundColor Blue

if ($Backend -or $Both) {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] 🔧 Testando Backend..." -ForegroundColor Green
    
    # Iniciar backend em background
    Start-Process powershell -ArgumentList "-Command", "cd backend; .\venv\Scripts\Activate.ps1; python app.py" -WindowStyle Hidden
    
    # Aguardar um pouco para o backend iniciar
    Start-Sleep -Seconds 3
    
    # Testar endpoints
    try {
        Write-Host "   ✓ Testando /health..." -ForegroundColor Gray
        $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method GET -ErrorAction Stop
        Write-Host "   ✅ Backend rodando: $($health.status)" -ForegroundColor Green
        
        Write-Host "   ✓ Testando /api/setup/status..." -ForegroundColor Gray
        $setup = Invoke-RestMethod -Uri "http://localhost:5000/api/setup/status" -Method GET -ErrorAction Stop
        Write-Host "   📋 Setup status: needs_setup=$($setup.needs_setup)" -ForegroundColor Cyan
        
        if ($setup.needs_setup) {
            Write-Host "   ⚠️  Sistema precisa de configuração inicial" -ForegroundColor Yellow
        } else {
            Write-Host "   ✅ Sistema já configurado" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "   ❌ Erro no backend: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($Frontend -or $Both) {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] 🎨 Testando Frontend..." -ForegroundColor Green
    
    # Iniciar frontend em background
    Start-Process powershell -ArgumentList "-Command", "cd frontend; npm run dev" -WindowStyle Hidden
    
    # Aguardar um pouco para o frontend iniciar
    Start-Sleep -Seconds 5
    
    try {
        Write-Host "   ✓ Testando http://localhost:3000..." -ForegroundColor Gray
        $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -ErrorAction Stop
        Write-Host "   ✅ Frontend rodando: Status $($frontend.StatusCode)" -ForegroundColor Green
        
    } catch {
        Write-Host "   ❌ Erro no frontend: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if (-not $Backend -and -not $Frontend -and -not $Both) {
    Write-Host "`nUso:" -ForegroundColor Yellow
    Write-Host "  .\test-system.ps1 -Backend     # Testar apenas backend" -ForegroundColor White
    Write-Host "  .\test-system.ps1 -Frontend    # Testar apenas frontend" -ForegroundColor White
    Write-Host "  .\test-system.ps1 -Both        # Testar ambos" -ForegroundColor White
}

Write-Host "`n🎵 ====================================== 🎵" -ForegroundColor Blue
Write-Host "   Acesse: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   API: http://localhost:5000" -ForegroundColor Cyan
Write-Host "🎵 ====================================== 🎵" -ForegroundColor Blue
# PowerShell script to run tests locally
# Usage: .\run-tests.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Running Musicas Igreja API Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to tests directory
$testsPath = Join-Path $PSScriptRoot "..\backend.tests"
Push-Location $testsPath

try {
    # Restore packages
    Write-Host "Restoring packages..." -ForegroundColor Yellow
    dotnet restore

    # Build
    Write-Host "Building test project..." -ForegroundColor Yellow
    dotnet build --no-restore --configuration Debug

    # Run tests
    Write-Host ""
    Write-Host "Running tests..." -ForegroundColor Yellow
    Write-Host ""
    
    dotnet test --no-build --verbosity normal --configuration Debug --logger "console;verbosity=detailed"

    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  All tests passed!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  Some tests failed!" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
    }

    exit $exitCode
}
finally {
    Pop-Location
}

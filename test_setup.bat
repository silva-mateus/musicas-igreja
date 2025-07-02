@echo off
title Teste - Sistema Musicas Igreja
echo.
echo ========================================
echo  TESTE DO SISTEMA MUSICAS IGREJA
echo ========================================
echo.

echo 1. Testando se Python esta disponivel...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRO: Python nao encontrado
    goto :end
) else (
    echo ✅ Python encontrado
)

echo.
echo 2. Testando se Flask esta instalado...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRO: Flask nao instalado
    echo Execute: pip install -r requirements.txt
    goto :end
) else (
    echo ✅ Flask instalado
)

echo.
echo 3. Testando se o servidor esta rodando na porta 5000...
netstat -an | find "5000" >nul 2>&1
if errorlevel 1 (
    echo ❌ Servidor nao esta rodando na porta 5000
    echo Execute: start_musicas_igreja.bat
) else (
    echo ✅ Servidor rodando na porta 5000
)

echo.
echo 4. Testando resolucao DNS do dominio personalizado...
ping musicas-igreja.local -n 1 >nul 2>&1
if errorlevel 1 (
    echo ❌ Dominio musicas-igreja.local nao configurado
    echo Execute como administrador: setup_custom_url.ps1
) else (
    echo ✅ Dominio musicas-igreja.local configurado
)

echo.
echo 5. Testando acesso HTTP...
echo Tentando acessar http://localhost:5000...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000' -TimeoutSec 5; Write-Host '✅ Servidor respondendo (Status:' $response.StatusCode ')' } catch { Write-Host '❌ Servidor nao responde ou nao esta rodando' }"

echo.
echo ========================================
echo  RESULTADO DO TESTE
echo ========================================
echo.
echo Se todos os testes passaram:
echo   • Acesse: http://localhost:5000
echo   • Ou: http://musicas-igreja.local:5000
echo.
echo Se algum teste falhou:
echo   • Consulte o arquivo SETUP_AUTOMATICO.md
echo   • Ou execute start_musicas_igreja.bat
echo.

:end
pause 
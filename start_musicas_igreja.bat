@echo off
title Musicas Igreja - Sistema de Gestao
cd /d "%~dp0"

REM Check for administrator privileges and request if needed
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Executando com privilegios de administrador...
    goto :setup_domain
) else (
    echo Solicitando privilegios de administrador para configurar dominio personalizado...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:setup_domain
echo.
echo ========================================
echo  CONFIGURACAO INICIAL DO SISTEMA
echo ========================================
echo.

REM Configure custom domain using simple batch script
echo Configurando dominio personalizado musicas-igreja.local...

REM Check if domain already configured
findstr /C:"musicas-igreja.local" %SystemRoot%\System32\drivers\etc\hosts >nul
if %errorLevel% == 0 (
    echo Dominio ja configurado!
) else (
    echo Adicionando dominio ao arquivo hosts...
    echo. >> %SystemRoot%\System32\drivers\etc\hosts
    echo # Musicas Igreja - Sistema local >> %SystemRoot%\System32\drivers\etc\hosts
    echo 127.0.0.1	musicas-igreja.local >> %SystemRoot%\System32\drivers\etc\hosts
    echo Dominio configurado com sucesso!
)

:start_application
echo.
echo ========================================
echo  INICIANDO SERVIDOR FLASK
echo ========================================
echo.

echo [%date% %time%] Iniciando sistema Musicas Igreja...
echo Aguarde enquanto o servidor Flask e iniciado...

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao foi encontrado no PATH
    echo Por favor, instale o Python ou adicione-o ao PATH do sistema
    pause
    exit /b 1
)

REM Check if requirements are installed
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias...
    pip install -r requirements.txt
)

REM Start the Flask application
echo.
echo ========================================
echo  SISTEMA MUSICAS IGREJA - INICIADO
echo ========================================
echo.
echo Acesse o sistema em:
echo http://localhost:5000
echo http://musicas-igreja.local:5000
echo.
echo Para parar o servidor, pressione Ctrl+C
echo.

python app.py

pause 
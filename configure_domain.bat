@echo off
title Configurar Dominio Personalizado - Musicas Igreja

echo.
echo ========================================
echo  CONFIGURANDO DOMINIO PERSONALIZADO
echo ========================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Este script precisa ser executado como Administrador!
    echo.
    echo Clique com o botao direito neste arquivo e selecione:
    echo "Executar como administrador"
    echo.
    pause
    exit /b 1
)

echo Verificando se dominio ja esta configurado...

REM Check if domain already configured
findstr /C:"musicas-igreja.local" %SystemRoot%\System32\drivers\etc\hosts >nul
if %errorLevel% == 0 (
    echo Dominio musicas-igreja.local ja esta configurado!
    goto :test_domain
)

echo Adicionando dominio ao arquivo hosts...

REM Backup hosts file
copy "%SystemRoot%\System32\drivers\etc\hosts" "%SystemRoot%\System32\drivers\etc\hosts.backup" >nul

REM Add domain to hosts file
echo. >> %SystemRoot%\System32\drivers\etc\hosts
echo # Musicas Igreja - Sistema local >> %SystemRoot%\System32\drivers\etc\hosts
echo 127.0.0.1	musicas-igreja.local >> %SystemRoot%\System32\drivers\etc\hosts

echo Dominio configurado com sucesso!

:test_domain
echo.
echo Testando configuracao...
ping musicas-igreja.local -n 1 >nul 2>&1
if %errorLevel% == 0 (
    echo Teste OK - Dominio funcionando!
) else (
    echo Aguarde alguns segundos para o DNS atualizar...
)

echo.
echo ========================================
echo  CONFIGURACAO CONCLUIDA
echo ========================================
echo.
echo URLs disponiveis:
echo - http://localhost:5000
echo - http://musicas-igreja.local:5000
echo.
echo Para iniciar o sistema, execute: start_musicas_igreja.bat
echo.

pause 
@echo off
cd /d "%~dp0"

REM Log startup attempt
echo [%date% %time%] Auto-starting Musicas Igreja system... >> startup_log.txt

REM Check if already running (basic check by looking for python process with app.py)
tasklist /FI "IMAGENAME eq python.exe" | find /I "python.exe" > nul
if not errorlevel 1 (
    echo [%date% %time%] Python already running, checking if Musicas Igreja is active... >> startup_log.txt
)

REM Start the application silently in background
start /MIN "" pythonw app.py

REM Log successful startup
echo [%date% %time%] Musicas Igreja started successfully >> startup_log.txt

REM Exit silently
exit 
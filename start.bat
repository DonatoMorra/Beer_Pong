@echo off
color 0A
echo ===================================================
echo     BEERPONG CHAMPIONS - Launcher Automatico
echo ===================================================
echo.
echo Sto cercando l'indirizzo IP del tuo PC...

:: Trova l'IP locale (esclude quelli virtuali di Docker/VM se possibile)
for /f "delims=" %%a in ('powershell -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' }).IPv4Address.IPAddress | Select-Object -First 1"') do set HOST_IP=%%a

if "%HOST_IP%"=="" (
    set HOST_IP=localhost
    echo [!] IP non trovato, uso localhost.
) else (
    echo [OK] IP trovato: %HOST_IP%
)

:: CREA IL FILE .ENV (Questo e' il modo piu' sicuro per Docker)
echo HOST_IP=%HOST_IP% > .env
echo [OK] Configurazione salvata in .env

echo.
echo Avvio dei container (con riavvio forzato per applicare l'IP)...
docker-compose up -d --build --force-recreate

echo.
echo ===================================================
echo  SITO PRONTO!
echo  PC: http://localhost:8081
echo  TELEFONI: http://%HOST_IP%:8081
echo ===================================================
pause

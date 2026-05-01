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
echo ADMIN_PASSWORD=roccadaspideBeer >> .env
echo [OK] Configurazione sicura salvata in .env

echo.
echo Avvio dei container (con sicurezza Spring Security)...
docker-compose up -d --build --force-recreate

echo.
echo Avvio del Tunnel Pubblico (per 4G/5G)...
:: Avviamo il tunnel in una finestra separata cosi' se c'e' un errore lo vedi subito
start "BeerPong-Tunnel" npx -y localtunnel --port 8081 --subdomain beerpong-torneo-premium-2024

echo.
echo ===================================================
echo  SITO PRONTO E SICURO!
echo  PC: http://localhost:8081
echo  LINK PUBBLICO (4G): https://beerpong-torneo-premium-2024.loca.lt
echo.
echo  CREDENZIALI ADMIN:
echo  User: admin
echo  Pass: roccadaspideBeer
echo ===================================================
pause

@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Updater.ps1" %*
set "updaterExit=%ERRORLEVEL%"
if not "%updaterExit%"=="0" echo Update fehlgeschlagen. Bitte das oben genannte Protokoll pruefen.
pause
exit /b %updaterExit%

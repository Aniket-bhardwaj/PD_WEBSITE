@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup.ps1" -Mode Start %*
set "start_result=%errorlevel%"
if not "%start_result%"=="0" pause
exit /b %start_result%

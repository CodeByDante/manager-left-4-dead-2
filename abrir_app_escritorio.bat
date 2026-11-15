@echo off
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js LTS para ejecutar el proyecto desde su codigo fuente.
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 pause

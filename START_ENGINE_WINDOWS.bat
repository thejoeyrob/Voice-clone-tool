@echo off
setlocal
cd /d "%~dp0"
if not exist .jweds-venv\Scripts\python.exe (
  echo Run SETUP_ENGINE_WINDOWS.bat first.
  pause
  exit /b 1
)
start "" http://127.0.0.1:8765
.jweds-venv\Scripts\python.exe engine_server.py
pause

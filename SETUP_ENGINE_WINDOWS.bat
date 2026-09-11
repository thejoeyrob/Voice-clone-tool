@echo off
setlocal
cd /d "%~dp0"
echo.
echo JW EDS Audio Engine - first-time local engine setup
echo ====================================================
where py >nul 2>nul
if %errorlevel%==0 (
  set PY=py -3.11
) else (
  set PY=python
)
%PY% --version || goto :nopy
if not exist .jweds-venv %PY% -m venv .jweds-venv
call .jweds-venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements-local-engine.txt
if errorlevel 1 goto :fail
echo.
echo Setup complete. Run START_ENGINE_WINDOWS.bat next.
pause
exit /b 0
:nopy
echo Python 3.10 or 3.11 is required. Install Python and run this file again.
pause
exit /b 1
:fail
echo Setup did not complete. Scroll up for the Python/pip error.
pause
exit /b 1

@echo off
cd /d "%~dp0"

echo ===================================================
echo   NeuroAI Backend Launcher
echo ===================================================

REM Check if Python is installed and added to PATH
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to system PATH.
    echo Please install Python 3.10+ and check "Add Python to PATH".
    pause
    exit /b 1
)

REM Check if existing venv works on this machine
if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" -c "import sys" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [!] Detected venv from a different laptop/user. Cleaning up old venv...
        rmdir /s /q "venv"
    )
)

REM Create fresh venv if missing or deleted
if not exist "venv" (
    echo [*] Creating virtual environment for this laptop...
    python -m venv venv
    echo [*] Activating venv and installing packages from requirements.txt...
    call venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    echo [*] Activating local virtual environment...
    call venv\Scripts\activate.bat
)

echo ===================================================
echo [*] Starting FastAPI Backend on http://localhost:8000
echo ===================================================
uvicorn main:app --reload --port 8000
pause

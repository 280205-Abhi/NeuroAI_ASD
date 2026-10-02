#!/usr/bin/env bash
# NeuroAI Backend Launcher for macOS / Linux

cd "$(dirname "$0")"

echo "==================================================="
echo "  NeuroAI Backend Launcher (macOS / Linux)"
echo "==================================================="

if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed or not in PATH."
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "[*] Creating virtual environment..."
    python3 -m venv venv
    echo "[*] Installing requirements..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "[*] Activating virtual environment..."
    source venv/bin/activate
fi

echo "==================================================="
echo "[*] Starting FastAPI Backend on http://localhost:8000"
echo "==================================================="
uvicorn main:app --reload --reload-exclude "venv/*" --reload-exclude "chroma_db/*" --reload-exclude "models/*" --reload-exclude "__pycache__/*" --port 8000

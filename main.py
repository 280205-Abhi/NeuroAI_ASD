"""
Root entrypoint for deployment platforms (like Render).
Ensures the backend directory is in sys.path and exposes the FastAPI app.
"""

import importlib.util
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Use importlib to load backend/main.py explicitly avoiding circular self-import of root main.py
spec = importlib.util.spec_from_file_location("backend_main", str(BACKEND_DIR / "main.py"))
backend_main = importlib.util.module_from_spec(spec)
sys.modules["backend_main"] = backend_main
spec.loader.exec_module(backend_main)

app = backend_main.app

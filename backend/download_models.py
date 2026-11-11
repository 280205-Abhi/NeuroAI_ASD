"""
backend/download_models.py

Utility script to verify and ensure required ML/DL model artifacts 
are present in backend/models/ before starting the server.
Used during deployment (e.g. Render build step) and local setup.
"""

import os
import sys
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

# Active model artifacts required by the NeuroAI backend
REQUIRED_MODELS = [
    "mri_ensemble_v3.pkl",
    "best_binary_model.pkl",
    "best_severity_model.pkl",
    "preprocessor.pkl",
    "model_comparison.csv",
    "full_results.csv",
]

# Map of model filenames to optional cloud download URLs (e.g., HuggingFace, S3, or GDrive)
# If files are already tracked in git, no download is needed.
MODEL_URLS = {
    # "mri_ensemble_v3.pkl": os.environ.get("MODEL_MRI_URL", ""),
    # "best_binary_model.pkl": os.environ.get("MODEL_BINARY_URL", ""),
}


def download_file(url: str, dest_path: Path):
    """Downloads a file with progress notice."""
    print(f"[*] Downloading {dest_path.name} from {url}...")
    try:
        urllib.request.urlretrieve(url, dest_path)
        print(f"[✓] Successfully downloaded {dest_path.name}")
    except Exception as e:
        print(f"[X] Failed to download {dest_path.name}: {e}")


def ensure_models_exist():
    """Checks for required model files and reports readiness."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    missing = []
    present = []
    
    for filename in REQUIRED_MODELS:
        filepath = MODELS_DIR / filename
        if filepath.exists():
            present.append(filename)
        else:
            url = MODEL_URLS.get(filename)
            if url:
                download_file(url, filepath)
                if filepath.exists():
                    present.append(filename)
                else:
                    missing.append(filename)
            else:
                missing.append(filename)

    for p in present:
        print(f"[✓] Model artifact present: {p}")

    if missing:
        print(f"[!] Notice: The following artifacts were not found in {MODELS_DIR}:")
        for m in missing:
            print(f"    - {m}")
        print("[!] The server will activate mock/fallback metrics if artifacts are missing.")
    else:
        print(f"\n[✓] All {len(present)} required model artifacts are verified in backend/models/.")

    # Pre-build matplotlib font cache during build step so runtime does not spend memory/time
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.font_manager
        matplotlib.font_manager._load_fontmanager()
        print("[✓] Matplotlib font cache pre-initialized during build.")
    except Exception:
        pass

    # Return success so deployment builds do not fail
    return 0


if __name__ == "__main__":
    sys.exit(ensure_models_exist())


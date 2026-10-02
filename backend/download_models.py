"""
backend/download_models.py

Utility script to automatically download required ML/DL model artifacts 
from team cloud storage into backend/models/ if missing.
"""

import os
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"

# Map of model filenames to public download URLs (e.g., HuggingFace, S3, or GDrive direct download)
MODEL_URLS = {
    # Replace these URLs with your actual team storage / Hugging Face model repository URLs
    # "mri_ensemble_new.pkl": "https://huggingface.co/your-username/neuroai-models/resolve/main/mri_ensemble_new.pkl",
    # "modelA_ensemble.pkl": "https://huggingface.co/your-username/neuroai-models/resolve/main/modelA_ensemble.pkl",
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
    """Checks for required model files and downloads any missing artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    missing_count = 0
    for filename, url in MODEL_URLS.items():
        filepath = MODELS_DIR / filename
        if not filepath.exists():
            missing_count += 1
            download_file(url, filepath)
            
    if missing_count == 0:
        print("[✓] All required model artifacts are present in backend/models/")


if __name__ == "__main__":
    ensure_models_exist()

# NeuroAI Model Artifacts Directory (`backend/models/`)

This directory contains pre-trained Machine Learning and Deep Learning model weights used by the NeuroAI backend.

> **Note for Teammates**: Large binary model files (`.pkl`, `.pth`) are excluded from Git repository tracking to prevent repo bloat.

---

## 👥 How Teammates Get Model Files

### Option 1: Direct Download Link (Recommended)
1. Download the team model package from the shared team folder:
   - **Google Drive / Team Storage**: `[INSERT YOUR GOOGLE DRIVE / HUGGING FACE LINK HERE]`
2. Extract all `.pkl` and `.pth` files into this directory (`backend/models/`).

### Option 2: Automated Download Script
If cloud URLs are configured in `backend/download_models.py`, simply run:
```bash
python download_models.py
```

---

## ☁️ Deployment Model Handling

When deploying to cloud platforms (Render, AWS EC2, GCP, Hugging Face Spaces):

1. **Auto-Fetch on Startup**:
   - `download_models.py` can be triggered during server initialization (e.g., in `main.py` startup lifespan or `Dockerfile`).
2. **Graceful Fallback**:
   - If model files are absent, NeuroAI logs a notice and activates pre-computed mock/fallback metrics so diagnostic API routes return valid structured responses without crashing.

---

## Required Model Artifact List

- `best_binary_model.pkl` — Clinical ASD classification model
- `best_severity_model.pkl` — ADOS/severity score estimation model
- `preprocessor.pkl` — Feature scaler
- `modelA_ensemble.pkl`, `modelA_scaler.pkl`, `modelA_imputer.pkl` — Clinical feature GBDT model artifacts
- `mri_ensemble_new.pkl` (or `best_mri_model.pkl`) — Structural MRI ensemble classifier
- `full_results.csv` & `mri_results.csv` — Performance comparison tables

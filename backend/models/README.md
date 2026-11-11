# NeuroAI Model Artifacts Directory (`backend/models/`)

This directory contains pre-trained Machine Learning and Deep Learning model weights used by the NeuroAI backend.

> **Note**: Large binary model files (`.pkl`, `.pth`) are excluded from Git repository tracking to prevent repo bloat.

---

## Required Model Artifact List (Active Pipeline)

- `mri_ensemble_v3.pkl` — Dual-backbone structural MRI ensemble classifier (ResNet18 + EfficientNet-B0) with subject-wise evaluation and Grad-CAM++
- `best_binary_model.pkl` — Clinical ASD soft-voting ensemble classifier (Random Forest + Gradient Boosting + Extra Trees)
- `best_severity_model.pkl` — 3-class ASD severity estimation model (Tuned GBDT)
- `preprocessor.pkl` — Median imputer and StandardScaler for the 7 core clinical features
- `full_results.csv` & `model_comparison.csv` — Performance comparison benchmark tables served to `/api/models/comparison`

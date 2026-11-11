# NeuroAI — Multimodal ASD Detection & Clinical Decision Support System

NeuroAI is an explainable multimodal clinical decision support platform for Autism Spectrum Disorder (ASD) detection, severity estimation, and evidence-based recommendation generation. It integrates structural brain MRI analysis, an M-CHAT-R-inspired behavioral screening questionnaire, and clinical feature assessment with Retrieval-Augmented Generation (RAG) powered by vetted clinical guidelines.

> **Research prototype, not a diagnostic tool.** ASD is diagnosed clinically. The MRI module was evaluated with subject-wise validation on held-out subjects (subject-level AUC 0.787, accuracy about 69-73%); see [MRI Model Performance](#-mri-model-performance).

---

## 🌟 Key Features

- 🧠 **Structural Brain MRI Analysis**: ResNet18 + EfficientNet-B0 ensemble trained with subject-wise splits, validation-tuned decision threshold, test-time augmentation, subject-level aggregation, an "inconclusive" band, and Grad-CAM++ heatmaps. Images outside the training domain (for example ordinary grayscale MRI) are rejected instead of misclassified.
- 📋 **Behavioral Screening**: 10-item M-CHAT-R-inspired caregiver questionnaire with automated risk scoring (a simplified aid; the published M-CHAT-R/F has 20 items).
- 🩺 **Clinical Feature Assessment**: Ensemble GBDT machine learning model evaluating clinical, behavioral, and developmental indicators with SHAP feature importances.
- 🔗 **Multimodal Conflict Arbitration**: Rule-based detection of disagreement between the MRI, screening and clinical modules, surfaced to the clinician and the RAG layer.
- 🤖 **Evidence-Based RAG Recommendations**: Self-contained Retrieval-Augmented Generation utilizing embedded clinical guidelines (AAP, NICE with official reference URLs), powered by Groq/OpenAI LLM and optional live web retrieval via Tavily.
- 📄 **Exportable PDF Reports**: Auto-generated clinical diagnostic summaries built with ReportLab.

---

## 📁 Repository Structure

```
NeuroAI/
├── backend/
│   ├── main.py               # FastAPI application & API endpoints
│   ├── model_logic.py        # ML/DL inference, domain check, SHAP, & Grad-CAM++ pipeline
│   ├── report.py             # ReportLab PDF generator
│   ├── run_backend.bat       # Windows 1-click launcher
│   ├── run_backend.sh        # macOS / Linux 1-click launcher
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variables template
│   ├── models/               # Active model artifacts (see below)
│   ├── old_models/           # Retired leaky-split MRI model and results (do not deploy)
│   └── rag/                  # RAG engine (Retriever, Generator, Searcher)
│
├── frontend/
│   ├── src/
│   │   ├── pages/            # CaseEntry, MriAnalysis, Screening, ClinicalFeatures, FusedResults, Report
│   │   ├── components/       # UI layout, AppShell, Markdown renderer, Loader
│   │   ├── lib/              # CaseStore, AppState, API client
│   │   └── styles/           # Theme CSS custom properties
│   ├── package.json          # Node dependencies & scripts
│   └── vite.config.js        # Vite dev server configuration & API proxy
│
└── README.md
```

---

## 🚀 Setup & Installation Guide

Follow these steps to set up NeuroAI on your local machine:

### Prerequisites

- **Python**: 3.10 or higher
- **Node.js**: 18.0 or higher (with npm)
- **Git**

---

### 1. Backend Setup

1. **Navigate to the `backend` directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment**:
   - **Windows (Command Prompt / PowerShell)**:
     ```cmd
     python -m venv venv
     venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   - **Windows**: `copy .env.example .env`
   - **macOS / Linux**: `cp .env.example .env`

   Open `.env` and add your API credentials:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_MODEL=qwen/qwen3.8-27b

   # Optional Live Web Search
   ENABLE_LIVE_SEARCH=false
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

5. **Model Artifacts (`backend/models/`)**:
   Ensure these files are in `backend/models/` before starting:

   | File | Purpose |
   |---|---|
   | `mri_ensemble_v3.pkl` | MRI ensemble (subject-wise model, threshold 0.322, weights, test metrics) |
   | `model_comparison.csv` | MRI test results served to the comparison page |
   | `best_binary_model.pkl` | Clinical binary ASD classifier |
   | `best_severity_model.pkl` | Clinical severity classifier |
   | `preprocessor.pkl` | Clinical imputer + scaler |
   | `full_results.csv` | Clinical benchmark table |

   Keep the old `mri_ensemble_new.pkl` and `mri_results.csv` out of this folder (move them to `backend/old_models/`); they come from an evaluation with subject leakage.

6. **Start the FastAPI Backend**:
   - **Windows**: Double-click or run `run_backend.bat`
   - **macOS / Linux**: Run `./run_backend.sh`
   - **Manual**:
     ```bash
     uvicorn main:app --reload --port 8000
     ```

   Verify the backend is running at [http://127.0.0.1:8000/api/status](http://127.0.0.1:8000/api/status). It should report `mri_model_version: mri_ensemble_v3.pkl` and `mri_threshold: 0.322`.

7. **(Optional) Check the MRI model from the command line**:
   ```bash
   python check_mri_model.py path/to/slice.png
   ```
   Pass several slices of the same person to also get a subject-level prediction.

---

### 2. Frontend Setup

1. **Navigate to the `frontend` directory**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to [http://localhost:5173](http://localhost:5173).

> **Note**: Vite is configured to proxy all `/api/*` requests automatically to `http://127.0.0.1:8000`. Keep both backend and frontend servers running simultaneously during development.

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `GROQ_API_KEY` | API Key for Groq Cloud LLM | `gsk_...` |
| `OPENAI_API_KEY` | Alternative OpenAI API key if using OpenAI directly | `sk-...` |
| `LLM_BASE_URL` | Base URL for OpenAI-compatible endpoint | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | Target LLM model identifier | `qwen/qwen3.8-27b` |
| `ENABLE_LIVE_SEARCH` | Enable real-time web retrieval via Tavily/DDGS | `true` or `false` |
| `TAVILY_API_KEY` | API Key for Tavily Search API | `tvly-...` |

---

## 🧠 MRI Model Performance

Held-out test set: **175 subjects never used for training, early stopping or threshold selection** (the data is split by subject, so no person appears in two sets).

| Model | Subject accuracy | Subject AUC | Sensitivity | Specificity |
|---|---|---|---|---|
| ResNet18 | 70.3% | 0.775 | 55.7% | 82.3% |
| EfficientNet-B0 | 75.4% | 0.770 | 58.2% | 89.6% |
| Ensemble, threshold 0.5 | 72.6% | 0.787 | 57.0% | 85.4% |
| **Ensemble, tuned threshold 0.322 (deployed)** | **68.6%** | **0.787** (95% CI 0.716-0.851) | **69.6%** | 67.7% |

- Metrics are **subject-level**: probabilities from several slices of one person are averaged (`POST /api/mri/predict_subject`). A single slice (`POST /api/mri/predict`) is less reliable.
- Earlier figures of 83-84% came from a random slice split in which almost all validation subjects also appeared in training; they are no longer valid.
- Published ASD-vs-control studies on ABIDE with strict validation report roughly 60-75%, in line with these results.

**Limitations**
- Works only on false-colour ABIDE-style slices. Other images (for example grayscale MRI) are rejected with HTTP 422.
- Cross-site generalisation has not been tested (ABIDE combines many scanners).
- Research prototype only; not for clinical use.

---

## 🩹 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/api/status` shows `mri_resnet: false` | The MRI model failed to load. Read the traceback printed in the backend console; check that `mri_ensemble_v3.pkl` is in `backend/models/`. |
| MRI upload returns **422** "outside the training domain" | The image is not a false-colour slice like the training data. This is intentional. |
| Result shows "Inconclusive" | The probability is within 0.10 of the decision threshold; use several slices via `predict_subject`. |
| Comparison page shows old numbers | An old `mri_results.csv` or the old model is still in `backend/models/`; move them to `backend/old_models/`. |

---

## 🛠️ Production Build

To test or generate static frontend assets for production:

```bash
cd frontend
npm run build
```

The compiled static files will be saved in `frontend/dist/`.
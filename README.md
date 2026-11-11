# NeuroAI — Multimodal ASD Detection & Clinical Decision Support System

NeuroAI is an explainable multimodal clinical decision support platform for Autism Spectrum Disorder (ASD) detection, severity estimation, and evidence-based recommendation generation. It integrates structural brain MRI analysis, an M-CHAT-R-inspired behavioral screening questionnaire, and clinical phenotypic assessment with Retrieval-Augmented Generation (RAG) powered by vetted clinical guidelines.

> **Research prototype, not a diagnostic tool.** Autism Spectrum Disorder is diagnosed clinically through comprehensive multidisciplinary evaluation. NeuroAI outputs are probabilistic decision-support estimates for academic research and clinical review only. The MRI module was evaluated with leak-free subject-wise validation on held-out subjects (subject-level AUC 0.787, accuracy 68.6% at tuned threshold 0.322); see [MRI Model Performance](#-mri-model-performance).

---

## 🌟 Key Features

- 🧠 **Structural Brain MRI Analysis (`mri_ensemble_v3.pkl`)**:
  - Dual deep-learning vision ensemble (**ResNet18 + EfficientNet-B0**) fine-tuned on ABIDE structural MRI slices.
  - **Leak-Free Subject-Wise Validation**: Zero subject overlap across training, validation, and testing sets.
  - **Domain Verification**: Rejects out-of-domain inputs (e.g., standard grayscale MRI) with HTTP 422 to prevent unreliable classifications on uncharacteristic data.
  - **Multi-Slice Subject Aggregation**: `POST /api/mri/predict_subject` aggregates multiple slice predictions for robust patient-level inference.
  - **Explainable AI (XAI)**: High-resolution **Grad-CAM++** saliency heatmaps highlighting brain regions driving predictions.
  - **Inconclusive Band & Calibrated Threshold**: Re-centered probabilities with an explicit "Inconclusive" margin around the optimal decision threshold (0.322).

- 📋 **Behavioral Screening (M-CHAT-R-Inspired)**:
  - 10-item caregiver screening questionnaire with automated risk tier stratification (Low, Medium, High).
  - Rapid, accessible primary triage signal to guide downstream multimodal evaluation.

- 🩺 **Clinical Phenotypic ML Engine**:
  - Soft-voting ensemble classifier (**Random Forest + Gradient Boosting + Extra Trees**) predicting ASD presence with **96.5% accuracy**.
  - **3-Class ASD Severity Estimation**: Tuned Gradient Boosting Classifier estimating Mild, Moderate, or Severe manifestation.
  - **7 Core Clinical Features**: Tracks key developmental metrics (`age_months`, `gender`, `expressive_language`, `ADOS`, `joint_attention`, `repetitive_behavior`, `sensory_responsivity`) with median imputation and standard scaling.
  - **TreeSHAP Feature Attributions**: Clinically interpretable waterfall and bar plots explaining each patient's phenotypic risk factors.

- 🔗 **Multimodal Conflict Arbitration**:
  - Rule-based detection of clinical disagreements between MRI vision, behavioral questionnaire, and clinical feature indicators.
  - Alerts clinicians to discordant cases and passes conflict context to the RAG layer.

- 🤖 **Evidence-Based Clinical RAG Recommendations**:
  - Self-contained Retrieval-Augmented Generation grounded in trusted clinical practice guidelines from the **American Academy of Pediatrics (AAP)** and the **National Institute for Health and Care Excellence (NICE CG128)**.
  - LLM synthesis powered by Groq / OpenAI-compatible endpoints with live web retrieval fallback via Tavily.
  - Direct clinical guideline citations and official source URLs.

- 📄 **Dynamic Clinical Diagnostic PDF Reports**:
  - One-click exportable clinical summary report compiled in-memory via ReportLab.
  - Formats patient details, MRI Grad-CAM++ visualizations, behavioral scores, phenotypic SHAP values, risk badges, and RAG recommendations.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND TIER (React 18 + Vite)                          │
│  - Single Page Application (SPA) with responsive clinical AppShell layout       │
│  - Interactive Pages: Overview, CaseEntry, MriAnalysis, Screening,              │
│    ClinicalFeatures, FusedResults, Report, ModelComparison, XaiDeepDive         │
│  - Reactive Visualizations: Grad-CAM++ overlays, SHAP charts, Risk Badges       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST API / Multipart HTTP (Vite Proxy)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                        BACKEND TIER (FastAPI ASGI Server)                       │
│  - Asynchronous non-blocking endpoints with CORS configuration                  │
│  - Lifespan pre-warmup: Pre-loads PyTorch models & ChromaDB guidelines          │
│  - CPU thread optimization: torch.set_num_threads(min(4, os.cpu_count))         │
└───────┬────────────────────────────┬────────────────────────────┬───────────────┘
        │                            │                            │
┌───────▼──────────────┐   ┌─────────▼──────────────┐   ┌─────────▼─────────────┐
│  sMRI Vision Engine  │   │  Clinical Tabular ML   │   │ RAG Decision Support  │
│  - Domain check, RGB │   │  - Median Imputation   │   │ - ChromaDB Guidelines │
│  - ResNet18 + EffNet │   │  - StandardScaler      │   │ - AAP / NICE CG128    │
│  - 50/50 vote, thr   │   │  - 7 Core Features     │   │ - Opt-in Live Search  │
│  - Grad-CAM++ (XAI)  │   │  - TreeSHAP & Conflict │   │ - Groq / OpenAI LLM   │
└──────────────────────┘   └────────────────────────┘   └───────────────────────┘
```

---

## 📁 Repository Structure

```
NeuroAI/
├── backend/
│   ├── main.py               # FastAPI application & REST API routes
│   ├── model_logic.py        # ML/DL inference, domain check, SHAP, & Grad-CAM++
│   ├── report.py             # ReportLab PDF clinical report generator
│   ├── run_backend.bat       # Windows 1-click launcher
│   ├── run_backend.sh        # macOS / Linux 1-click launcher
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Template environment variables
│   ├── models/               # Active model weights & benchmark artifacts
│   │   ├── mri_ensemble_v3.pkl       # ResNet18 + EfficientNet-B0 bundle (v3)
│   │   ├── model_comparison.csv      # Subject-level MRI benchmark metrics
│   │   ├── best_binary_model.pkl     # Clinical ASD soft-voting ensemble
│   │   ├── best_severity_model.pkl   # Clinical 3-class severity GBDT
│   │   ├── preprocessor.pkl          # Imputer & StandardScaler for clinical data
│   │   ├── full_results.csv          # Clinical benchmark comparison table
│   │   └── README.md                 # Models setup and artifact documentation
│   └── rag/                  # RAG engine (Retriever, Generator, Live Searcher)
│
├── frontend/
│   ├── src/
│   │   ├── pages/            # Overview, CaseEntry, MriAnalysis, Screening,
│   │   │                     # ClinicalFeatures, FusedResults, Report, ModelComparison
│   │   ├── components/       # Clinical primitives, AppShell, UI elements
│   │   ├── lib/              # API client, state utilities
│   │   └── styles/           # Theme variables and application styles
│   ├── package.json          # Node dependencies & Vite build scripts
│   └── vite.config.js        # Vite dev server configuration & API proxy
│
├── notebooks/
│   └── exploratory/
│       ├── NeuroAI_Clinical.ipynb   # Clinical model training, tuning & SHAP analysis
│       └── NeuroAI_MRI.ipynb        # Leak-free subject-wise MRI training & evaluation
│
├── .gitignore                # Git exclusions (datasets, caches, environments)
└── README.md                 # Project documentation & setup guide
```

---

## 🚀 Setup & Installation Guide

### Prerequisites

- **Python**: 3.10 to 3.13
- **Node.js**: 18.0 or higher (with npm)
- **Git**

---

### 1. Backend Setup

1. **Navigate to the `backend` directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment**:
   - **Windows**:
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

   Edit `.env` to configure your LLM provider:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_MODEL=qwen/qwen3.8-27b

   # Optional Live Web Search
   ENABLE_LIVE_SEARCH=false
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

5. **Verify Model Artifacts**:
   The active pre-trained models are already included in `backend/models/`:
   - `mri_ensemble_v3.pkl`
   - `model_comparison.csv`
   - `best_binary_model.pkl`
   - `best_severity_model.pkl`
   - `preprocessor.pkl`
   - `full_results.csv`

6. **Start the FastAPI Backend**:
   - **Windows 1-Click**: Double-click `run_backend.bat`
   - **macOS / Linux 1-Click**: Run `./run_backend.sh`
   - **Manual**:
     ```bash
     uvicorn main:app --reload --port 8000
     ```

   Verify the backend is live at [http://127.0.0.1:8000/api/status](http://127.0.0.1:8000/api/status).

---

### 2. Frontend Setup

1. **Navigate to the `frontend` directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open [http://localhost:5173](http://localhost:5173) in your browser.
   Vite proxies all `/api/*` calls automatically to the backend running at `http://127.0.0.1:8000`.

---

## 📡 REST API Reference

| Method | Endpoint | Description | Request / Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | System health, model readiness & config | None | JSON status flags |
| `POST` | `/api/mri/predict` | Single MRI slice prediction + Grad-CAM++ | Multipart (`file`) | Classification, Grad-CAM++ heatmap base64, probabilities |
| `POST` | `/api/mri/predict_subject` | Multi-slice subject-level evaluation | Multipart (`files`) | Aggregated subject prediction, mean raw prob, slice results |
| `POST` | `/api/mri/shap` | MRI slice feature attribution | Multipart (`file`) | Mean feature attributions |
| `GET` | `/api/screening/questions` | M-CHAT-R questionnaire definition | None | 10 screening question items |
| `POST` | `/api/screening/score` | Score behavioral screening answers | JSON responses dict | Score (0-10), risk level (Low, Medium, High) |
| `POST` | `/api/clinical/predict` | Predict ASD & severity from 7 clinical features | JSON clinical features | Binary prediction, 3-class severity, SHAP waterfall base64 |
| `POST` | `/api/clinical/conflict` | Rule-based cross-modal conflict check | JSON modal results | Conflict detected boolean, severity, guidance note |
| `GET` | `/api/models/comparison` | Benchmark tables for clinical & MRI models | None | Benchmark JSON records |
| `POST` | `/api/rag/recommendations` | Clinical guideline RAG synthesis | JSON patient & test state | Clinical rationale, intervention points, citations |
| `POST` | `/api/report/generate` | Generate exportable clinical diagnostic PDF | JSON complete patient case | PDF binary stream |

---

## 🧠 Model Benchmarks & Performance

### 1. Structural MRI Vision Ensemble (Test Set: 175 Held-Out Subjects)

Evaluated with strict subject-wise grouping (`GroupShuffleSplit`, seed 42) so that **zero subjects appear in multiple splits**:

| Model | Subject Accuracy | Subject AUC | Sensitivity | Specificity |
| :--- | :---: | :---: | :---: | :---: |
| ResNet18 | 70.3% | 0.775 | 55.7% | 82.3% |
| EfficientNet-B0 | 75.4% | 0.770 | 58.2% | 89.6% |
| Ensemble (Threshold 0.500) | 72.6% | 0.787 | 57.0% | 85.4% |
| **Ensemble (Threshold 0.322, Deployed v3)** | **68.6%** | **0.787** (95% CI 0.716–0.851) | **69.6%** | **67.7%** |

*Note:* Published ABIDE classification benchmarks using strict subject-wise validation generally fall within 60%–75%. Slice-level random splits produce artificially elevated figures (83%–90%) due to subject data leakage across splits. NeuroAI reports leak-free subject-level metrics.

### 2. Clinical Tabular ML Models (10-Fold Cross-Validation)

| Model | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Random Forest Classifier | 0.958 | 0.952 | 0.965 | 0.958 | 0.989 |
| Gradient Boosting (GBDT) | 0.951 | 0.945 | 0.958 | 0.951 | 0.985 |
| Extra Trees Classifier | 0.965 | 0.960 | 0.970 | 0.965 | 0.991 |
| **Soft Voting Ensemble (Deployed)** | **0.965** | **0.960** | **0.970** | **0.965** | **0.992** |

---

## ⚙️ Environment Variables Reference

| Variable | Description | Required | Default / Example |
| :--- | :--- | :---: | :--- |
| `GROQ_API_KEY` | Primary API Key for Groq Cloud LLM | Yes (or OpenAI) | `gsk_...` |
| `OPENAI_API_KEY` | Alternative OpenAI API Key | Optional | `sk-...` |
| `LLM_BASE_URL` | Base URL for OpenAI-compatible endpoint | Optional | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | Target LLM model identifier | Optional | `qwen/qwen3.8-27b` |
| `ENABLE_LIVE_SEARCH` | Enable real-time web retrieval via Tavily | Optional | `false` |
| `TAVILY_API_KEY` | API Key for Tavily Search API | Optional | `tvly-...` |

---

## 🛠️ Production Build

To build the frontend for production deployment:

```bash
cd frontend
npm run build
```

Compiled static assets will be output to `frontend/dist/`.

---

## ⚖️ Ethical & Clinical Disclaimer

NeuroAI is developed as an academic research platform and clinical decision support prototype.
- **Not a Diagnostic Device:** This software does not provide medical diagnoses, treatment plans, or definitive clinical findings.
- **Multidisciplinary Mandate:** ASD diagnosis requires comprehensive evaluations by qualified healthcare professionals (developmental pediatricians, child psychologists, speech and language pathologists) using standardized diagnostic tools (such as ADOS-2, ADI-R).
- **Domain Constraints:** The MRI classification model is trained exclusively on false-colour ABIDE sMRI slices and requires 3-channel colour inputs. Grayscale scans or disparate acquisition protocols will be rejected by the domain verification layer.

# NeuroAI — Multimodal ASD Detection & Clinical Decision Support System

NeuroAI is an explainable multimodal clinical decision support platform for Autism Spectrum Disorder (ASD) detection, severity estimation, and evidence-based recommendation generation. It integrates structural brain MRI analysis, speech acoustics, M-CHAT-R behavioral screening, and clinical feature assessment with Retrieval-Augmented Generation (RAG) powered by vetted clinical guidelines.

---

## 🌟 Key Features

- 🧠 **Structural Brain MRI Analysis**: Deep learning classification (EfficientNet-B0 / ResNet18 / Ensemble) with Grad-CAM visual heatmaps and SHAP feature attributions.
- 📋 **M-CHAT-R Behavioral Screening**: 20-item standardized screening tool with automated risk scoring and item-level analysis.
- 🩺 **Clinical Feature Assessment**: Ensemble GBDT machine learning model evaluating clinical, behavioral, and developmental indicators with SHAP feature importances.
- 🔗 **Multimodal Fusion Engine**: Unified diagnostic confidence scoring synthesizing sMRI, M-CHAT-R, and clinical feature signals.
- 🤖 **Evidence-Based RAG Recommendations**: Self-contained Retrieval-Augmented Generation utilizing embedded clinical guidelines (AAP, NICE with official reference URLs), powered by Groq/OpenAI LLM and optional live web retrieval via Tavily.
- 📄 **Exportable PDF Reports**: Auto-generated clinical diagnostic summaries built with ReportLab.

---

## 📁 Repository Structure

```
NeuroAI/
├── backend/
│   ├── main.py               # FastAPI application & API endpoints
│   ├── model_logic.py        # ML/DL inference, SHAP, & Grad-CAM pipeline
│   ├── report.py             # ReportLab PDF generator
│   ├── download_models.py    # Automated model artifacts downloader
│   ├── run_backend.bat       # Windows 1-click launcher
│   ├── run_backend.sh        # macOS / Linux 1-click launcher
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variables template
│   ├── models/               # Model weights & preprocessors (.pkl, .pth) with setup README
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
   - Obtain the pre-trained model weights from your team storage link (detailed in [`backend/models/README.md`](backend/models/README.md)) and place them into `backend/models/`.
   - Alternatively, run `python download_models.py` to auto-fetch weights from configured cloud storage.

6. **Start the FastAPI Backend**:
   - **Windows**: Double-click or run `run_backend.bat`
   - **macOS / Linux**: Run `./run_backend.sh`
   - **Manual**:
     ```bash
     uvicorn main:app --reload --port 8000
     ```

   Verify the backend is running at [http://127.0.0.1:8000/api/status](http://127.0.0.1:8000/api/status).

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

## 🛠️ Production Build

To test or generate static frontend assets for production:

```bash
cd frontend
npm run build
```

The compiled static files will be saved in `frontend/dist/`.

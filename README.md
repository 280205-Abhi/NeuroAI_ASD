# NeuroAI — Explainable-AI-Based-ASD-Classification-Severity-Estimation

Multimodal clinical-support system integrating brain MRI, speech acoustics, and M-CHAT-R behavioral screening for ASD detection and severity estimation.

This replaces the single Streamlit script with two independent pieces:

```
backend/    FastAPI — your existing model logic, wrapped as a JSON/file API
frontend/   React (Vite) — a themeable UI with fixed CSS custom properties,
            so there's no light/dark theme bleed like Streamlit's global CSS.
```

## 1. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy your existing model files into `backend/models/`:
- `best_severity_model*.pkl`, `best_binary_model*.pkl`, `preprocessor*.pkl`
- `mri_ensemble_new.pkl` (or `mri_ensemble.pkl` / `honest_mri_model.pkl`)
- `full_results*.csv` (clinical model comparison)
- `mri_results.csv` (optional — falls back to built-in numbers if missing)

Run it:

```bash
uvicorn main:app --reload --port 8000
```

Check `http://127.0.0.1:8000/api/status` — it should report which models loaded.

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to `http://127.0.0.1:8000`
(see `vite.config.js`), so both servers need to be running at once during
development.

## What changed vs. the Streamlit version

- **No more CSS `!important` wars.** All styling lives in
  `frontend/src/styles/theme.css` as CSS custom properties (`--navy-900`,
  `--accent`, risk-badge colors, etc.) — one source of truth instead of
  fighting Streamlit's injected classes.
- **Fixed clinical-light theme, on purpose.** `color-scheme: light` is pinned
  so the OS/browser never auto-inverts form fields — appropriate for a
  diagnostic-support tool where color coding (red = risk, green = typical)
  needs to mean the same thing everywhere.
- **State lives in React**, not `st.session_state` — see
  `frontend/src/lib/AppState.jsx`. The Report page reads MRI/Speech/Screening
  results from there, same as before.
- **Heavy computation (model inference, SHAP, Grad-CAM++, librosa, PDF
  generation) stays in Python** — the browser only ever handles file
  upload/display, never runs PyTorch. Endpoints are in `backend/main.py`.

## Production build

```bash
cd frontend
npm run build       # outputs static files to frontend/dist
```

Serve `frontend/dist` with any static host (nginx, Vercel, etc.) and point it
at your deployed FastAPI backend — update `vite.config.js`'s proxy target or
set a build-time `VITE_API_BASE` if you deploy the API on a different origin.

## Notes / things you may want to adjust

- The **Ensemble XAI Conflict** tab requires `bin_model` to be a
  `VotingClassifier` with `estimators_` — same requirement as the original
  Streamlit code.
- CORS in `backend/main.py` is currently locked to `localhost:5173`. Update
  `allow_origins` before deploying.
- The MRI SHAP endpoint re-uploads the already-analyzed image (converted from
  the base64 preview) rather than re-reading the original file, to avoid
  keeping server-side session state — functionally equivalent to the
  original `st.session_state['mri_result']` flow.

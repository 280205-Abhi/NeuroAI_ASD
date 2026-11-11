# ═══════════════════════════════════════════════════════════
# NeuroAI — FastAPI backend
# Run: uvicorn main:app --reload --port 8000
# ═══════════════════════════════════════════════════════════

import io
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image
from pydantic import BaseModel

import os
from dotenv import load_dotenv
load_dotenv()

import model_logic as ml

import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Minimal startup footprint (<100MB) for constrained deployment environments (e.g. Render 512MB)
    # Heavy models are loaded lazily on-demand when endpoints are called.
    yield

app = FastAPI(title="NeuroAI API", lifespan=lifespan)

# Allow CORS from all origins (Render frontend, localhost, custom domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = Path(__file__).parent / "models"

corpus_retriever_instance = None

def get_corpus_retriever():
    global corpus_retriever_instance
    if corpus_retriever_instance is None:
        from rag.corpus_retriever import CorpusRetriever
        corpus_retriever_instance = CorpusRetriever()
    return corpus_retriever_instance


# ── Health & Root ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "NeuroAI API",
        "version": "1.0.0",
        "endpoints": {
            "api_root": "/api",
            "status": "/api/status",
            "docs": "/docs",
            "models_comparison": "/api/models/comparison",
        },
    }


@app.get("/api")
def api_root():
    return {
        "status": "online",
        "service": "NeuroAI API",
        "message": "API root prefix. Specific available endpoints are listed below.",
        "endpoints": {
            "status": "/api/status",
            "screening_questions": "/api/screening/questions",
            "screening_score": "/api/screening/score",
            "clinical_predict": "/api/clinical/predict",
            "clinical_conflict": "/api/clinical/conflict",
            "mri_predict": "/api/mri/predict",
            "mri_predict_subject": "/api/mri/predict_subject",
            "models_comparison": "/api/models/comparison",
            "rag_recommendations": "/api/rag/recommendations",
            "report_generate": "/api/report/generate",
            "docs": "/docs",
        },
    }


# ── Status ───────────────────────────────────────────────────

@app.get("/api/status")
def status():
    has_api_key = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY"))
    meta = ml.get_mri_metadata()
    clinical_file_ok = (MODEL_DIR / "best_binary_model.pkl").exists()
    mri_file_ok = (MODEL_DIR / "mri_ensemble_v3.pkl").exists()
    return {
        "clinical_ensemble": clinical_file_ok,
        "mri_resnet": mri_file_ok,
        "mri_effnet": mri_file_ok,
        "mri_model_version": meta.get("version", "mri_ensemble_v3.pkl") if mri_file_ok else None,
        "xai_engine": True,
        "rag_engine": True,
        "llm_api_configured": has_api_key,
    }


# ── MRI ──────────────────────────────────────────────────────

@app.post("/api/mri/predict")
async def mri_predict(file: UploadFile = File(...)):
    print(f"[MRI] Received prediction request for: {file.filename}")
    resnet, effnet, device, ok = ml.load_mri_ensemble()
    if not ok:
        raise HTTPException(503, "MRI model not loaded. Check backend/models/ folder.")

    raw_bytes = await file.read()
    print(f"[MRI] Read {len(raw_bytes)} bytes. Opening image...")
    img = Image.open(io.BytesIO(raw_bytes))

    if ml.is_grayscale_image(img):
        raise HTTPException(
            status_code=422,
            detail="Out-of-domain image: The model was trained on false-colour ABIDE sMRI slices and requires 3-channel colour inputs. Grayscale images are not supported."
        )

    preprocessed = ml.preprocess_mri_image(img)
    domain_warnings = ml.check_image_domain(img)

    result = ml.predict_mri(img, resnet, effnet, device)
    if not result["success"]:
        raise HTTPException(500, result.get("error", "Prediction failed"))

    badge, badge_class = ml.get_risk_badge(result["asd_prob"])
    if result.get("inconclusive"):
        badge = "Inconclusive"
    result["risk_badge"] = badge
    result["risk_badge_class"] = badge_class
    result["preprocessed_b64"] = ml.pil_to_b64(preprocessed.resize((224, 224)))
    result["domain_warnings"] = domain_warnings
    print(f"[MRI] Finished prediction: {result.get('prediction')} ({result.get('confidence'):.2f})")
    return result


@app.post("/api/mri/predict_subject")
async def mri_predict_subject(files: list[UploadFile] = File(...)):
    resnet, effnet, device, ok = ml.load_mri_ensemble()
    if not ok:
        raise HTTPException(503, "MRI model not loaded. Check backend/models/ folder.")

    if not files:
        raise HTTPException(400, "No slice files uploaded.")

    pil_images = []
    for f in files:
        raw_bytes = await f.read()
        img = Image.open(io.BytesIO(raw_bytes))
        if ml.is_grayscale_image(img):
            raise HTTPException(
                status_code=422,
                detail=f"Out-of-domain image in slice '{f.filename}': The model was trained on false-colour ABIDE sMRI slices and requires 3-channel colour inputs. Grayscale images are not supported."
            )
        pil_images.append(img)

    result = ml.predict_mri_subject(pil_images, resnet, effnet, device)
    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Subject prediction failed"))

    return result


@app.post("/api/mri/shap")
async def mri_shap(file: UploadFile = File(...)):
    resnet, effnet, device, ok = ml.load_mri_ensemble()
    if not ok:
        raise HTTPException(503, "MRI model not loaded.")
    raw_bytes = await file.read()
    img = Image.open(io.BytesIO(raw_bytes))
    result = ml.explain_mri_shap(img, resnet, device)
    if not result["success"]:
        raise HTTPException(500, result.get("error", "SHAP failed"))
    return {"success": True, "shap_img_b64": ml.pil_to_b64(result["shap_img"]), "method": result["method"]}



# ── Screening ────────────────────────────────────────────────

class ScreeningRequest(BaseModel):
    answers: list[str]  # 10 answers, "Yes"/"No", in QUESTIONS order


@app.get("/api/screening/questions")
def screening_questions():
    return [{"text": q, "positive": p} for q, p in ml.QUESTIONS]


@app.post("/api/screening/score")
def screening_score(req: ScreeningRequest):
    if len(req.answers) != len(ml.QUESTIONS):
        raise HTTPException(400, f"Expected {len(ml.QUESTIONS)} answers")
    return ml.score_questionnaire(req.answers)


# ── Clinical SHAP / ensemble conflict ───────────────────────

class ClinicalRequest(BaseModel):
    age_months: float = 28.0
    gender: int = 1
    expressive_language: int = 1
    ADOS: float = 7.0
    joint_attention: int = 1
    repetitive_behavior: int = 1
    sensory_responsivity: int = 1


@app.post("/api/clinical/predict")
def clinical_predict(req: ClinicalRequest):
    _, _, _, ok = ml.load_clinical_models()
    if not ok:
        raise HTTPException(503, "Clinical models not loaded.")
    result = ml.run_clinical_shap(req.dict())
    if not result["success"]:
        raise HTTPException(500, result.get("error", "Prediction failed"))
    return result


class ConflictRequest(BaseModel):
    input_scaled: list[float]
    features: list[str]


@app.post("/api/clinical/conflict")
def clinical_conflict(req: ConflictRequest):
    result = ml.run_ensemble_conflict(req.input_scaled, req.features)
    if not result["success"]:
        raise HTTPException(500, result.get("error", "Conflict analysis failed"))
    return result


# ── Model comparison ─────────────────────────────────────────

@app.get("/api/models/comparison")
def models_comparison():
    csv_path = MODEL_DIR / "full_results__2_.csv"
    if not csv_path.exists():
        csv_path = MODEL_DIR / "full_results.csv"

    clinical = []
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        clinical = [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in df.to_dict(orient="records")]

    mri_path = MODEL_DIR / "model_comparison.csv"
    if not mri_path.exists():
        mri_path = MODEL_DIR / "mri_results.csv"

    mri = []
    if mri_path.exists():
        df_mri = pd.read_csv(mri_path)
        mri = [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in df_mri.to_dict(orient="records")]
    else:
        mri = [
            {"Model": "ResNet18", "Slice acc": 0.6849, "Subject acc": 0.7029, "Subject AUC": 0.7745, "Sensitivity": 0.5570, "Specificity": 0.8229},
            {"Model": "EfficientNet-B0", "Slice acc": 0.7067, "Subject acc": 0.7543, "Subject AUC": 0.7698, "Sensitivity": 0.5823, "Specificity": 0.8958},
            {"Model": "Ensemble (ResNet18 + EfficientNet-B0)", "Slice acc": 0.7117, "Subject acc": 0.7257, "Subject AUC": 0.7872, "Sensitivity": 0.5696, "Specificity": 0.8542},
            {"Model": "Ensemble, tuned threshold 0.32", "Slice acc": None, "Subject acc": 0.6857, "Subject AUC": 0.7872, "Sensitivity": 0.6962, "Specificity": 0.6771},
        ]

    return {"clinical": clinical, "mri": mri}


# ── RAG Decision Support ──────────────────────────────────────

class RAGApiRequest(BaseModel):
    mri_result: dict | None = None
    clinical_result: dict | None = None
    q_result: dict | None = None
    use_live_search: bool = False


@app.post("/api/rag/recommendations")
def rag_recommendations(req: RAGApiRequest):
    from rag.models import map_app_state_to_model_results
    from rag.builder import build_query
    from rag.live_searcher import live_search
    from rag.generator import generate_recommendations

    model_results = map_app_state_to_model_results(req.mri_result, req.clinical_result, req.q_result)
    query = build_query(model_results)

    retriever = get_corpus_retriever()
    corpus_evidence = retriever.search(query, top_k=4)

    live_evidence = []
    if req.use_live_search:
        live_evidence = live_search(query, max_results=4)

    print(f"\n[RAG Pipeline Audit Log]")
    print(f"  Query: '{query}'")
    print(f"  Retrieved Corpus Evidence ({len(corpus_evidence)} passages):")
    for idx, doc in enumerate(corpus_evidence, 1):
        print(f"    [{idx}] Title: {doc.get('title')} | Publisher: {doc.get('publisher')} | Text: '{doc.get('text')[:90]}...'")
    if live_evidence:
        print(f"  Retrieved Live Web Evidence ({len(live_evidence)} passages):")
        for idx, doc in enumerate(live_evidence, 1):
            print(f"    [{idx}] Title: {doc.get('title')} | URL: {doc.get('url')} | Timestamp: {doc.get('retrieved_at')}")
    print(f"  Conflict Flag: {model_results.conflict_flag} | Reason: {model_results.conflict_reason}\n")

    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")

    if not api_key:
        raise HTTPException(400, "Missing GROQ_API_KEY or OPENAI_API_KEY in environment variables (.env).")

    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url)

    try:
        rec_text = generate_recommendations(model_results, corpus_evidence, live_evidence, client)
        return {
            "success": True,
            "query": query,
            "recommendation_text": rec_text,
            "corpus_evidence": corpus_evidence,
            "live_evidence": live_evidence,
            "live_search_used": len(live_evidence) > 0,
            "model_results": model_results.model_dump() if hasattr(model_results, "model_dump") else model_results.dict(),
        }
    except Exception as e:
        raise HTTPException(500, f"RAG recommendation generation failed: {str(e)}")


# ── PDF report ───────────────────────────────────────────────

class ReportRequest(BaseModel):
    patient_name: str = ""
    patient_age: int = 60
    mri_result: dict | None = None
    q_result: dict | None = None
    clinical_result: dict | None = None
    rag_result: dict | None = None


@app.post("/api/report/generate")
def report_generate(req: ReportRequest):
    from report import generate_pdf  # local import keeps reportlab optional at import time
    pdf_buf = generate_pdf(
        patient_name=req.patient_name,
        patient_age=req.patient_age,
        mri_result=req.mri_result,
        q_result=req.q_result,
        clinical_result=req.clinical_result,
        rag_result=req.rag_result,
    )
    filename = f"NeuroAI_Report_{(req.patient_name or 'Patient').replace(' ', '_')}_{pd.Timestamp.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        pdf_buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ═══════════════════════════════════════════════════════════
# NeuroAI — FastAPI backend
# Run: uvicorn main:app --reload --port 8000
# ═══════════════════════════════════════════════════════════

import io
from pathlib import Path

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
from rag.models import map_app_state_to_model_results, ModelResults
from rag.builder import build_query
from rag.corpus_retriever import CorpusRetriever
from rag.live_searcher import live_search
from rag.generator import generate_recommendations

import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    async def _warmup():
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, ml.load_clinical_models)
        await loop.run_in_executor(None, ml.load_mri_ensemble)
        await loop.run_in_executor(None, get_corpus_retriever)

    asyncio.create_task(_warmup())
    yield

app = FastAPI(title="NeuroAI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = Path(__file__).parent / "models"

corpus_retriever_instance = None

def get_corpus_retriever():
    global corpus_retriever_instance
    if corpus_retriever_instance is None:
        corpus_retriever_instance = CorpusRetriever()
    return corpus_retriever_instance


# ── Status ───────────────────────────────────────────────────

@app.get("/api/status")
def status():
    _, _, _, clinical_ok = ml.load_clinical_models()
    resnet, effnet, _, mri_ok = ml.load_mri_ensemble()
    has_api_key = bool(os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY"))
    return {
        "clinical_ensemble": clinical_ok,
        "mri_resnet": mri_ok,
        "mri_effnet": mri_ok and effnet is not None,
        "xai_engine": True,
        "rag_engine": True,
        "llm_api_configured": has_api_key,
    }


# ── MRI ──────────────────────────────────────────────────────

@app.post("/api/mri/predict")
def mri_predict(file: UploadFile = File(...)):
    resnet, effnet, device, ok = ml.load_mri_ensemble()
    if not ok:
        raise HTTPException(503, "MRI model not loaded. Check backend/models/ folder.")

    raw_bytes = file.file.read()
    img = Image.open(io.BytesIO(raw_bytes))

    preprocessed = ml.preprocess_mri_image(img)
    domain_warnings = ml.check_image_domain(img)

    result = ml.predict_mri(img, resnet, effnet, device)
    if not result["success"]:
        raise HTTPException(500, result.get("error", "Prediction failed"))

    badge, badge_class = ml.get_risk_badge(result["asd_prob"])
    result["risk_badge"] = badge
    result["risk_badge_class"] = badge_class
    result["preprocessed_b64"] = ml.pil_to_b64(preprocessed.resize((224, 224)))
    result["domain_warnings"] = domain_warnings
    return result


@app.post("/api/mri/shap")
def mri_shap(file: UploadFile = File(...)):
    resnet, effnet, device, ok = ml.load_mri_ensemble()
    if not ok:
        raise HTTPException(503, "MRI model not loaded.")
    raw_bytes = file.file.read()
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
    age_months: float
    gender: int
    pregnancy_problems: int
    normally_evolved_perinatal_phenomena: int
    birth_anomalies: int
    psychiatric_disorders_familiarity: int
    QS: float
    IQ: float
    QA_VABS: float
    ADOS: float
    I_intellective_impairment: int
    II_language_impairment: int
    III_known_medical_condition: int
    III_history_environmental_exposure: int
    III_known_genetic_condition: int
    IV_other_mental_behavioral_disorders: int
    other_psychiatric_comorbidities: int
    nutrition_disorders: int
    CGH_array_alterations: int
    DQ: float
    DQ_IQ: float
    n_alterated_chromosomes: int
    n_mutations: int
    n_dup: int
    n_del: int


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
        clinical = df.to_dict(orient="records")

    mri_path = MODEL_DIR / "mri_results.csv"
    if mri_path.exists():
        mri = pd.read_csv(mri_path).to_dict(orient="records")
    else:
        mri = [
            {"model": "PCA + VotingClassifier", "test_acc": 0.650, "auc": 0.720, "approach": "Traditional ML", "semester": "Previous", "val_samples": 41},
            {"model": "ResNet18", "test_acc": 0.832, "auc": 0.9024, "approach": "Deep Learning", "semester": "Current", "val_samples": 2134},
            {"model": "EfficientNet-B0", "test_acc": 0.820, "auc": 0.890, "approach": "Deep Learning", "semester": "Current", "val_samples": 2134},
            {"model": "ResNet18+EfficientNet", "test_acc": 0.840, "auc": 0.910, "approach": "Deep Learning Ensemble", "semester": "Current", "val_samples": 2134},
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


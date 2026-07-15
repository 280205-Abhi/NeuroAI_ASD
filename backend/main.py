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

import model_logic as ml

app = FastAPI(title="NeuroAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = Path(__file__).parent / "models"


# ── Status ───────────────────────────────────────────────────

@app.get("/api/status")
def status():
    _, _, _, clinical_ok = ml.load_clinical_models()
    resnet, effnet, _, mri_ok = ml.load_mri_ensemble()
    return {
        "clinical_ensemble": clinical_ok,
        "mri_resnet": mri_ok,
        "mri_effnet": mri_ok and effnet is not None,
        "speech_analyzer": True,
        "xai_engine": True,
    }


# ── MRI ──────────────────────────────────────────────────────

@app.post("/api/mri/predict")
async def mri_predict(file: UploadFile = File(...)):
    resnet, effnet, device, ok = ml.load_mri_ensemble()
    if not ok:
        raise HTTPException(503, "MRI model not loaded. Check backend/models/ folder.")

    raw_bytes = await file.read()
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


# ── Speech ───────────────────────────────────────────────────

@app.post("/api/speech/analyze")
async def speech_analyze(file: UploadFile = File(...)):
    raw_bytes = await file.read()
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    result = ml.analyze_speech(raw_bytes, suffix=suffix)
    if not result["success"]:
        raise HTTPException(500, result.get("error", "Speech analysis failed"))
    return result


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


# ── PDF report ───────────────────────────────────────────────

class ReportRequest(BaseModel):
    patient_name: str = ""
    patient_age: int = 60
    mri_result: dict | None = None
    speech_result: dict | None = None
    q_result: dict | None = None


@app.post("/api/report/generate")
def report_generate(req: ReportRequest):
    from report import generate_pdf  # local import keeps reportlab optional at import time
    pdf_buf = generate_pdf(
        patient_name=req.patient_name,
        patient_age=req.patient_age,
        mri_result=req.mri_result,
        speech_result=req.speech_result,
        q_result=req.q_result,
    )
    filename = f"NeuroAI_Report_{(req.patient_name or 'Patient').replace(' ', '_')}_{pd.Timestamp.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        pdf_buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

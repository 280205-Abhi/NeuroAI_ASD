"""
backend/rag/models.py

Structured data models for the RAG recommendation engine, plus the
conflict-detection rule table and the adapter that maps NeuroAI's existing
per-modality result objects into a single ModelResults instance.
"""

from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class ModelResults(BaseModel):
    mri_label: Optional[str] = "N/A"          # "ASD" / "Control" / "N/A" if not run
    mri_confidence: Optional[float] = None
    severity_label: str                        # "No ASD" / "Mild-Moderate" / "Severe"
    mchat_tier: str                             # "Low Risk" / "Moderate Risk" / "High Risk"
    mchat_score: int
    top_shap_features: List[Dict] = Field(default_factory=list)
    conflict_flag: bool = False
    conflict_reason: Optional[str] = None       # human-readable, shown in UI if flagged


class RAGRequest(BaseModel):
    model_results: ModelResults
    use_live_search: bool = False               # opt-in, off by default


class EvidenceItem(BaseModel):
    text: str
    title: str
    source_type: str                            # "corpus" | "live"
    url: Optional[str] = None
    publisher: Optional[str] = None
    retrieved_at: Optional[str] = None           # ISO timestamp, only for live evidence


class RAGResponse(BaseModel):
    recommendation_text: str
    corpus_evidence: List[EvidenceItem]
    live_evidence: List[EvidenceItem] = Field(default_factory=list)
    live_search_used: bool = False


# ---------------------------------------------------------------------------
# Conflict detection — explicit rule table, not a fuzzy heuristic, so it's
# testable and its behavior can be documented in the paper's methodology.
# ---------------------------------------------------------------------------

MRI_POSITIVE = {"ASD"}
MRI_NEGATIVE = {"Control", "NonASD"}
LOW_RISK_TIERS = {"Low Risk", "Low"}
MODERATE_RISK_TIERS = {"Moderate Risk", "Moderate"}
HIGH_RISK_TIERS = {"High Risk", "High"}
SEVERE_LABELS = {"Severe"}
NO_ASD_LABELS = {"No ASD"}


def detect_conflict(mri_label: Optional[str], mchat_tier: str, severity_label: str, top_shap_features: List[Dict] = None):
    """Returns (conflict_flag, reason). Keep this as an explicit table so
    every conflict case is enumerable and can be unit tested individually."""
    if top_shap_features is None:
        top_shap_features = []

    # Rule 1: MRI ASD vs Low Risk Screening
    if mri_label in MRI_POSITIVE and mchat_tier in LOW_RISK_TIERS:
        return True, "MRI classified ASD, but behavioral screening indicates Low Risk."

    # Rule 2: MRI Control vs High Risk Screening
    if mri_label in MRI_NEGATIVE and mchat_tier in HIGH_RISK_TIERS:
        return True, "MRI classified Control, but behavioral screening indicates High Risk."

    # Rule 3: MRI Control vs Severe Clinical Grade
    if mri_label in MRI_NEGATIVE and severity_label in SEVERE_LABELS:
        return True, "MRI classified Control, but clinical severity estimate is Severe."

    # Rule 4: MRI ASD vs No ASD Clinical Grade
    if mri_label in MRI_POSITIVE and severity_label in NO_ASD_LABELS:
        return True, "MRI classified ASD, but clinical severity estimate is No ASD."

    # Rule 5 (Case 251007 profile): Moderate Risk screening + majority positive SHAP features pushing toward ASD risk, despite "No ASD" severity grade
    positive_shap_count = sum(1 for f in top_shap_features if f.get("shap", 0) > 0 or f.get("value", 0) > 0.05)
    if mchat_tier in MODERATE_RISK_TIERS and severity_label in NO_ASD_LABELS and positive_shap_count >= 2:
        return True, "Behavioral screening indicates Moderate Risk and top clinical SHAP features push toward ASD risk, despite a severity grade of No ASD."

    return False, None


def map_app_state_to_model_results(mri_result: Optional[dict], clinical_result: Optional[dict],
                                    q_result: Optional[dict]) -> ModelResults:
    """Adapter: converts NeuroAI's existing per-modality output dicts into
    a single ModelResults instance. Adjust key names here if your actual
    app-state shape differs — this is the one place that needs to change."""
    mri_label = mri_result.get("prediction", "N/A") if mri_result else "N/A"
    mri_conf = mri_result.get("confidence") if mri_result else None

    severity = "Unknown"
    shap = []
    if clinical_result:
        severity = clinical_result.get("sev_label", "Unknown")
        shap = clinical_result.get("shap", [])[:4]

    mchat_tier = "Unknown"
    mchat_score = 0
    if q_result:
        mchat_tier = q_result.get("level", "Unknown")
        mchat_score = q_result.get("score", 0)

    conflict, reason = detect_conflict(mri_label, mchat_tier, severity, shap)

    return ModelResults(
        mri_label=mri_label,
        mri_confidence=mri_conf,
        severity_label=severity,
        mchat_tier=mchat_tier,
        mchat_score=mchat_score,
        top_shap_features=shap,
        conflict_flag=conflict,
        conflict_reason=reason,
    )


if __name__ == "__main__":
    print("Running conflict-detection unit tests...")
    
    # Test Case 251007 Profile
    shap_case_251007 = [
        {"feature": "ADOS", "value": 3.312, "shap": 0.1147},
        {"feature": "IQ", "value": 2.085, "shap": -0.0878},
        {"feature": "age_months", "value": -1.018, "shap": 0.0763},
        {"feature": "DQ_IQ", "value": -3.891, "shap": 0.0571},
    ]
    c_flag, c_reason = detect_conflict("Control", "Moderate Risk", "No ASD", shap_case_251007)
    assert c_flag is True, "Test failed: Case 251007 profile should flag a conflict!"
    print("[PASSED] Unit Test Passed: Case 251007 Moderate Risk + positive SHAP mismatch detected.")
    print(f"   Reason: {c_reason}")

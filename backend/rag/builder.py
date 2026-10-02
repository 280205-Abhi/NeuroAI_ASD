"""
backend/rag/builder.py

Query Synthesis Builder for the RAG Engine.
Translates structured ModelResults into a dense search string optimized for retrieving
clinical guidelines from the vetted corpus or live web search.
"""

from .models import ModelResults


def build_query(model_results: ModelResults) -> str:
    """
    Synthesizes a dense search query string from ModelResults.
    Combines severity grade, screening risk tier, SHAP features, and conflict notes.
    """
    query_parts = ["Autism Spectrum Disorder ASD clinical guidelines"]

    if model_results.mchat_tier and model_results.mchat_tier != "Unknown":
        query_parts.append(f"M-CHAT risk tier {model_results.mchat_tier} score {model_results.mchat_score}")

    if model_results.severity_label and model_results.severity_label != "Unknown":
        query_parts.append(f"clinical severity {model_results.severity_label}")

    if model_results.mri_label and model_results.mri_label != "N/A":
        query_parts.append(f"structural brain MRI classification {model_results.mri_label}")

    if model_results.top_shap_features:
        feature_names = [f.get("feature", f.get("name", "")) for f in model_results.top_shap_features if f.get("feature") or f.get("name")]
        if feature_names:
            query_parts.append(f"key clinical features: {', '.join(feature_names[:3])}")

    if model_results.conflict_flag and model_results.conflict_reason:
        query_parts.append(f"multimodal assessment discrepancy: {model_results.conflict_reason}")

    query_parts.append("diagnostic evaluation next steps referral intervention recommendations")

    return " ".join(query_parts)

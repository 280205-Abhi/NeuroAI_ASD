# ═══════════════════════════════════════════════════════════
# NeuroAI — core model logic (framework-agnostic)
# Ported from the original Streamlit app. No st.* calls here —
# this module is imported by main.py (FastAPI) and could just as
# easily be imported by a CLI or a different web framework.
# ═══════════════════════════════════════════════════════════

import io
import os
import pickle
import tempfile
import warnings
from functools import lru_cache
from pathlib import Path

import cv2
import librosa
import numpy as np
import pandas as pd
import shap
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from torchvision.models import efficientnet_b0

warnings.filterwarnings("ignore")

MODEL_DIR = Path(__file__).parent / "models"


def find_model(names):
    for name in names:
        p = MODEL_DIR / name
        if p.exists():
            return p
    return None


# ── Clinical ensemble ───────────────────────────────────────

@lru_cache(maxsize=1)
def load_clinical_models():
    try:
        sev_p = find_model(["best_severity_model__2_.pkl", "best_severity_model (2).pkl", "best_severity_model.pkl"])
        bin_p = find_model(["best_binary_model__2_.pkl", "best_binary_model (2).pkl", "best_binary_model.pkl"])
        prep_p = find_model(["preprocessor__2_.pkl", "preprocessor (2).pkl", "preprocessor.pkl"])
        if not all([sev_p, bin_p, prep_p]):
            return None, None, None, False

        class PatchedUnpickler(pickle.Unpickler):
            def find_class(self, module, name):
                if module == "_loss":
                    module = "sklearn._loss._loss"
                return super().find_class(module, name)

        with open(sev_p, "rb") as f:
            sev = PatchedUnpickler(f).load()
        with open(bin_p, "rb") as f:
            bin_m = PatchedUnpickler(f).load()
        with open(prep_p, "rb") as f:
            prep = PatchedUnpickler(f).load()

        if prep and "imputer" in prep:
            imp = prep["imputer"]
            if not hasattr(imp, "_fill_dtype"):
                imp._fill_dtype = np.float64

        return sev, bin_m, prep, True
    except Exception:
        return None, None, None, False


# ── MRI ensemble ─────────────────────────────────────────────

@lru_cache(maxsize=1)
def load_mri_ensemble():
    try:
        paths = [MODEL_DIR / "mri_ensemble_new.pkl", MODEL_DIR / "mri_ensemble.pkl", MODEL_DIR / "honest_mri_model.pkl"]
        bundle = None

        class CPU_Unpickler(pickle.Unpickler):
            def find_class(self, module, name):
                if module == "_loss":
                    module = "sklearn._loss._loss"
                if module == "torch.storage" and name == "_load_from_bytes":
                    return lambda b: torch.load(io.BytesIO(b), map_location="cpu", weights_only=False)
                return super().find_class(module, name)

        for p in paths:
            if p.exists():
                with open(p, "rb") as f:
                    bundle = CPU_Unpickler(f).load()
                break

        if bundle is None:
            return None, None, None, False

        device = torch.device("cpu")

        resnet = models.resnet18(weights=None)
        resnet.fc = nn.Sequential(
            nn.Dropout(0.5), nn.Linear(512, 256), nn.ReLU(), nn.BatchNorm1d(256),
            nn.Dropout(0.3), nn.Linear(256, 2),
        )

        if "resnet_state" in bundle:
            resnet.load_state_dict(bundle["resnet_state"], strict=False)
            resnet = resnet.to(device)
            resnet.eval()
            try:
                effnet = efficientnet_b0(weights=None)
                effnet.classifier = nn.Sequential(
                    nn.Dropout(0.4), nn.Linear(1280, 256), nn.ReLU(),
                    nn.Dropout(0.3), nn.Linear(256, 2),
                )
                effnet.load_state_dict(bundle["effnet_state"], strict=False)
                effnet = effnet.to(device)
                effnet.eval()
            except Exception:
                effnet = None
            return resnet, effnet, device, True

        elif "model_state" in bundle:
            resnet.load_state_dict(bundle["model_state"], strict=False)
            resnet = resnet.to(device)
            resnet.eval()
            return resnet, None, device, True

        return None, None, None, False
    except Exception:
        return None, None, None, False


def preprocess_mri_image(pil_image):
    img_rgb = pil_image.convert("RGB")
    arr = np.array(img_rgb)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    enhanced_rgb = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(enhanced_rgb)


def check_image_domain(pil_image):
    arr = np.array(pil_image.convert("RGB"))
    w, h = pil_image.size
    out = []
    if w / max(h, 1) > 1.3:
        out.append(f"Landscape image ({w}x{h}). Training images were nearly square. CLAHE applied.")
    if arr.mean() < 50:
        out.append(f"Very dark image (mean {arr.mean():.0f}/255). May be from a different pipeline. CLAHE applied.")
    if pil_image.mode == "RGBA":
        out.append("RGBA image — converted to RGB automatically.")
    return out


def get_mri_transform():
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


def extract_shap_vals(shap_vals):
    if isinstance(shap_vals, list):
        return shap_vals[1][0] if len(shap_vals) > 1 else shap_vals[0][0]
    elif isinstance(shap_vals, np.ndarray):
        if shap_vals.ndim == 3:
            return shap_vals[0, :, 1] if shap_vals.shape[2] > 1 else shap_vals[0, :, 0]
        elif shap_vals.ndim == 2:
            return shap_vals[0]
        return shap_vals.flatten()
    return shap_vals


def pil_to_b64(pil_img, fmt="PNG"):
    import base64
    buf = io.BytesIO()
    pil_img.save(buf, format=fmt)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def explain_mri_shap(image_input, resnet, device):
    """GradCAM++ pixel attribution (kept name from original for continuity)."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from pytorch_grad_cam import GradCAMPlusPlus

        transform = get_mri_transform()
        raw = Image.open(image_input) if isinstance(image_input, (str, Path)) else image_input
        original = preprocess_mri_image(raw)
        inp = transform(original).unsqueeze(0).to(device)

        cam = GradCAMPlusPlus(model=resnet, target_layers=[resnet.layer4[-1]])
        grayscale_cam = cam(input_tensor=inp)[0]
        centered = grayscale_cam - 0.5

        fig, ax = plt.subplots(figsize=(4, 4), dpi=150)
        im = ax.imshow(centered, cmap="seismic", vmin=-0.5, vmax=0.5)
        plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
        ax.axis("off")
        ax.set_title("Pixel Attribution Map", fontsize=9)
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
        plt.close(fig)
        buf.seek(0)
        shap_img = Image.open(buf).copy()
        buf.close()
        return {"success": True, "shap_img": shap_img, "method": "GradCAM++"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def predict_mri(image_input, resnet, effnet, device):
    try:
        from pytorch_grad_cam import GradCAMPlusPlus
        from pytorch_grad_cam.utils.image import show_cam_on_image

        transform = get_mri_transform()
        raw = Image.open(image_input) if isinstance(image_input, (str, Path)) else image_input
        original = preprocess_mri_image(raw)
        orig_resized = original.resize((224, 224))
        inp = transform(original).unsqueeze(0).to(device)

        with torch.no_grad():
            out_r = resnet(inp)
            pr = torch.softmax(out_r, dim=1)
            if effnet is not None:
                out_e = effnet(inp)
                pe = torch.softmax(out_e, dim=1)
                probs = 0.6 * pr + 0.4 * pe
                r_prob = pr[0][1].item()
                e_prob = pe[0][1].item()
            else:
                probs = pr
                r_prob = pr[0][1].item()
                e_prob = None

        pred_idx = torch.argmax(probs).item()
        label = "ASD" if pred_idx == 1 else "NonASD"
        asd_prob = probs[0][1].item()
        non_prob = probs[0][0].item()
        confidence = probs[0][pred_idx].item()

        cam = GradCAMPlusPlus(model=resnet, target_layers=[resnet.layer4[-1]])
        grayscale_cam = cam(input_tensor=inp)[0]
        rgb_img = np.array(orig_resized).astype(np.float32) / 255.0
        heatmap = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True, colormap=2)
        heatmap_img = Image.fromarray(heatmap)

        return {
            "success": True,
            "prediction": label,
            "confidence": confidence,
            "asd_prob": asd_prob,
            "non_prob": non_prob,
            "heatmap_b64": pil_to_b64(heatmap_img),
            "original_b64": pil_to_b64(orig_resized),
            "resnet_prob": r_prob,
            "effnet_prob": e_prob,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_risk_badge(prob):
    p = prob * 100
    if p < 25:
        return "Low Risk", "low"
    elif p < 45:
        return "Borderline", "borderline"
    elif p < 65:
        return "Moderate Risk", "moderate"
    elif p < 80:
        return "High Risk", "high"
    return "Very High Risk", "very-high"


# ── Speech ───────────────────────────────────────────────────

def analyze_speech(audio_bytes, suffix=".wav"):
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        y, sr = librosa.load(tmp_path, duration=30)
        os.unlink(tmp_path)
        duration = librosa.get_duration(y=y, sr=sr)

        f0, voiced_flag, _ = librosa.pyin(y, fmin=50, fmax=500)
        voiced_f0 = f0[voiced_flag] if voiced_flag is not None else np.array([])
        pitch_mean = float(np.mean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        pitch_std = float(np.std(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        pitch_range = float(np.max(voiced_f0) - np.min(voiced_f0)) if len(voiced_f0) > 0 else 0.0

        rms = librosa.feature.rms(y=y)[0]
        speech_ratio = float(np.sum(rms > 0.01) / len(rms))
        pause_ratio = float(np.sum(rms < 0.01) / len(rms))
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(np.asarray(tempo).reshape(-1)[0])
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_var = float(np.var(mfcc))

        risk_score = 0
        flags = []
        if pitch_std < 20 and pitch_mean > 0:
            risk_score += 25
            flags.append("Monotone speech pattern")
        if speech_ratio < 0.3:
            risk_score += 20
            flags.append("Low speech activity")
        if pause_ratio > 0.6:
            risk_score += 20
            flags.append("Excessive pausing")
        if mfcc_var < 50:
            risk_score += 15
            flags.append("Low prosodic variation")
        if pitch_range < 50 and pitch_mean > 0:
            risk_score += 20
            flags.append("Narrow pitch range")
        if not flags:
            flags.append("No significant prosodic risk markers")

        risk_level = "Low" if risk_score < 30 else "Moderate" if risk_score < 60 else "High"

        return {
            "success": True, "duration": duration, "pitch_mean": pitch_mean,
            "pitch_std": pitch_std, "pitch_range": pitch_range,
            "speech_ratio": speech_ratio, "pause_ratio": pause_ratio,
            "tempo": float(tempo), "mfcc_var": mfcc_var,
            "risk_score": risk_score, "risk_level": risk_level, "flags": flags,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── Screening questionnaire ──────────────────────────────────

QUESTIONS = [
    ("Does the child make consistent eye contact?", True),
    ("Does the child respond to their name?", True),
    ("Does the child point to show interest in things?", True),
    ("Does the child engage in pretend or imaginative play?", True),
    ("Does the child show interest in other children?", True),
    ("Does the child repeat words or phrases over and over?", False),
    ("Does the child show repetitive movements (rocking, hand-flapping)?", False),
    ("Does the child get very upset with minor changes in routine?", False),
    ("Does the child have unusual reactions to sounds, textures or lights?", False),
    ("Does the child avoid being cuddled or held?", False),
]


def score_questionnaire(answers):
    score = 0
    for i, (q, positive) in enumerate(QUESTIONS):
        if positive and answers[i] == "No":
            score += 1
        elif not positive and answers[i] == "Yes":
            score += 1
    if score <= 2:
        return {"score": score, "max": 10, "level": "Low Risk",
                "rec": "Typical development indicators. Continue routine monitoring."}
    elif score <= 5:
        return {"score": score, "max": 10, "level": "Moderate Risk",
                "rec": "Some ASD indicators present. Recommend formal evaluation within 1-3 months."}
    return {"score": score, "max": 10, "level": "High Risk",
            "rec": "Multiple ASD indicators. Recommend immediate referral to developmental specialist."}


# ── Clinical SHAP ────────────────────────────────────────────

CLINICAL_FEATURE_KEYS = [
    "age_months", "gender", "pregnancy_problems", "normally_evolved_perinatal_phenomena",
    "birth_anomalies", "psychiatric_disorders_familiarity", "QS", "IQ", "QA_VABS", "ADOS",
    "I_intellective_impairment", "II_language_impairment", "III_known_medical_condition",
    "III_history_environmental_exposure", "III_known_genetic_condition",
    "IV_other_mental_behavioral_disorders", "other_psychiatric_comorbidities",
    "nutrition_disorders", "CGH_array_alterations", "DQ", "DQ_IQ",
    "n_alterated_chromosomes", "n_mutations", "n_dup", "n_del",
]

SEV_LABELS = {0: "No ASD", 1: "Mild-Moderate ASD", 2: "Severe ASD"}


def run_clinical_shap(input_dict):
    sev_model, bin_model, prep, ok = load_clinical_models()
    if not ok:
        return {"success": False, "error": "Clinical models not loaded"}

    features = prep["features"]
    imputer = prep["imputer"]
    scaler = prep["scaler"]

    inp_df = pd.DataFrame([input_dict])[features]
    inp_imp = imputer.transform(inp_df)
    inp_sc = scaler.transform(inp_imp)
    inp_sc_df = pd.DataFrame(inp_sc, columns=features)

    bin_pred = int(bin_model.predict(inp_sc)[0])
    bin_prob = bin_model.predict_proba(inp_sc)[0].tolist()
    sev_pred = int(sev_model.predict(inp_sc)[0])
    sev_prob = sev_model.predict_proba(inp_sc)[0].tolist()

    try:
        explainer = shap.TreeExplainer(bin_model)
        shap_vals = explainer.shap_values(inp_sc_df)
        vals = extract_shap_vals(shap_vals)
        shap_summary = sorted(
            [{"feature": f, "value": round(float(inp_sc_df.iloc[0][f]), 3),
              "shap": round(float(v), 4)} for f, v in zip(features, vals)],
            key=lambda r: abs(r["shap"]), reverse=True,
        )
    except Exception as e:
        shap_summary = []

    return {
        "success": True,
        "bin_pred": bin_pred, "bin_prob": bin_prob,
        "sev_pred": sev_pred, "sev_prob": sev_prob,
        "sev_label": SEV_LABELS[sev_pred],
        "shap": shap_summary,
        "input_scaled": inp_sc_df.iloc[0].tolist(),
        "features": features,
    }


def run_ensemble_conflict(input_scaled, features):
    sev_model, bin_model, prep, ok = load_clinical_models()
    if not ok or not hasattr(bin_model, "estimators_"):
        return {"success": False, "error": "Conflict map requires a VotingClassifier ensemble"}

    inp_df = pd.DataFrame([input_scaled], columns=features)
    if hasattr(bin_model, "estimators") and bin_model.estimators is not None:
        estimators_list = list(zip([e[0] for e in bin_model.estimators], bin_model.estimators_))
    else:
        estimators_list = [(f"Tree {i+1}", est) for i, est in enumerate(bin_model.estimators_[:3])]

    model_shaps, model_names = {}, []
    for name, est in estimators_list:
        try:
            exp = shap.TreeExplainer(est)
            sv = exp.shap_values(inp_df)
            model_shaps[name] = extract_shap_vals(sv)
            model_names.append(name)
        except Exception:
            pass

    if len(model_shaps) < 2:
        return {"success": False, "error": "Not enough estimators produced SHAP values"}

    rows = []
    for i, feat in enumerate(features):
        feat_vals = {m: float(model_shaps[m][i]) for m in model_names}
        signs = [1 if v > 0 else -1 for v in feat_vals.values()]
        agree = len(set(signs)) == 1
        rows.append({
            "feature": feat, "agree": agree,
            "avg_impact": round(float(np.mean([abs(v) for v in feat_vals.values()])), 4),
            "per_model": {m: round(v, 4) for m, v in feat_vals.items()},
        })
    rows.sort(key=lambda r: r["avg_impact"], reverse=True)
    return {"success": True, "rows": rows[:15]}
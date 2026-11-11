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

# Use headless Agg backend to prevent font cache and GUI memory overhead on servers
os.environ["MPLBACKEND"] = "Agg"
import matplotlib
matplotlib.use("Agg")

import cv2
import numpy as np
import pandas as pd
import shap
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from torchvision.models import efficientnet_b0

warnings.filterwarnings("ignore")

# Limit PyTorch CPU thread count to 1 to minimize memory usage and prevent contention on 512MB instances
if hasattr(torch, "set_num_threads"):
    try:
        torch.set_num_threads(1)
    except Exception:
        pass


@lru_cache(maxsize=32)
def _get_tree_explainer_cached(model_id, model):
    return shap.TreeExplainer(model)


def get_cached_tree_explainer(model):
    return _get_tree_explainer_cached(id(model), model)


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

_mri_metadata = {
    "version": "mri_ensemble_v3.pkl",
    "threshold": 0.322,
    "weights": [0.5, 0.5],
}


def get_mri_metadata():
    return _mri_metadata


@lru_cache(maxsize=1)
def load_mri_ensemble():
    global _mri_metadata
    try:
        paths = [
            MODEL_DIR / "mri_ensemble_v3.pkl",
            MODEL_DIR / "mri_ensemble_new.pkl",
            MODEL_DIR / "mri_ensemble.pkl",
            MODEL_DIR / "honest_mri_model.pkl",
        ]
        bundle = None
        chosen_path = None

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
                chosen_path = p
                break

        if bundle is None:
            return None, None, None, False

        device = torch.device("cpu")

        if chosen_path and chosen_path.name == "mri_ensemble_v3.pkl":
            _mri_metadata["version"] = "mri_ensemble_v3.pkl"
            _mri_metadata["threshold"] = float(bundle.get("threshold", 0.322))
            _mri_metadata["weights"] = bundle.get("weights", [0.5, 0.5])

            resnet = models.resnet18(weights=None)
            resnet.fc = nn.Sequential(nn.Dropout(0.2), nn.Linear(512, 2))
            resnet.load_state_dict(bundle["resnet_state"], strict=True)
            resnet = resnet.to(device)
            resnet.eval()

            effnet = efficientnet_b0(weights=None)
            effnet.classifier[1] = nn.Linear(1280, 2)
            effnet.load_state_dict(bundle["effnet_state"], strict=True)
            effnet = effnet.to(device)
            effnet.eval()

            # Free the 60MB raw bundle dict from RAM immediately
            del bundle
            import gc
            gc.collect()

            return resnet, effnet, device, True

        # Fallback for older model bundles
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


def is_grayscale_image(pil_image):
    """Detect whether an image is grayscale (out of domain for false-colour ABIDE model)."""
    if pil_image.mode in ("L", "1"):
        return True
    arr = np.array(pil_image.convert("RGB"))
    diff_rg = np.abs(arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int))
    diff_rb = np.abs(arr[:, :, 0].astype(int) - arr[:, :, 2].astype(int))
    max_diff = max(int(np.max(diff_rg)), int(np.max(diff_rb)))
    return max_diff < 10


def preprocess_mri_image(pil_image):
    """Raw RGB conversion without CLAHE or grayscale conversion."""
    return pil_image.convert("RGB")


def check_image_domain(pil_image):
    arr = np.array(pil_image.convert("RGB"))
    w, h = pil_image.size
    out = []
    if w / max(h, 1) > 1.3:
        out.append(f"Landscape image ({w}x{h}). Training images were nearly square.")
    if arr.mean() < 50:
        out.append(f"Very dark image (mean {arr.mean():.0f}/255). May be from a different acquisition protocol.")
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
        grayscale_cam = cam(input_tensor=inp, targets=None)[0]
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
            r_prob = pr[0][1].item()
            if effnet is not None:
                out_e = effnet(inp)
                pe = torch.softmax(out_e, dim=1)
                w = _mri_metadata.get("weights", [0.5, 0.5])
                probs = w[0] * pr + w[1] * pe
                e_prob = pe[0][1].item()
            else:
                probs = pr
                e_prob = None

        raw_asd_prob = probs[0][1].item()
        threshold = _mri_metadata.get("threshold", 0.322)

        # Re-center so 0.5 = decision threshold
        if raw_asd_prob < threshold:
            asd_prob = 0.5 * (raw_asd_prob / threshold)
        else:
            asd_prob = 0.5 + 0.5 * ((raw_asd_prob - threshold) / (1.0 - threshold))

        asd_prob = max(0.0, min(1.0, asd_prob))
        non_prob = 1.0 - asd_prob
        inconclusive = abs(asd_prob - 0.5) < 0.05
        pred_idx = 1 if asd_prob >= 0.5 else 0
        label = "Inconclusive" if inconclusive else ("ASD" if pred_idx == 1 else "NonASD")
        confidence = max(asd_prob, non_prob)

        cam = GradCAMPlusPlus(model=resnet, target_layers=[resnet.layer4[-1]])
        grayscale_cam = cam(input_tensor=inp, targets=None)[0]
        rgb_img = np.array(orig_resized).astype(np.float32) / 255.0
        heatmap = show_cam_on_image(rgb_img, grayscale_cam, use_rgb=True, colormap=2)
        heatmap_img = Image.fromarray(heatmap)

        return {
            "success": True,
            "prediction": label,
            "confidence": confidence,
            "asd_prob": asd_prob,
            "non_prob": non_prob,
            "raw_asd_prob": raw_asd_prob,
            "threshold": threshold,
            "inconclusive": inconclusive,
            "model_version": _mri_metadata.get("version", "mri_ensemble_v3.pkl"),
            "heatmap_b64": pil_to_b64(heatmap_img),
            "original_b64": pil_to_b64(orig_resized),
            "resnet_prob": r_prob,
            "effnet_prob": e_prob,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def predict_mri_subject(images, resnet, effnet, device):
    try:
        slice_results = []
        raw_probs = []
        for img in images:
            res = predict_mri(img, resnet, effnet, device)
            if not res.get("success"):
                return res
            slice_results.append(res)
            raw_probs.append(res["raw_asd_prob"])

        mean_raw_asd_prob = float(np.mean(raw_probs))
        threshold = _mri_metadata.get("threshold", 0.322)

        if mean_raw_asd_prob < threshold:
            asd_prob = 0.5 * (mean_raw_asd_prob / threshold)
        else:
            asd_prob = 0.5 + 0.5 * ((mean_raw_asd_prob - threshold) / (1.0 - threshold))

        asd_prob = max(0.0, min(1.0, asd_prob))
        non_prob = 1.0 - asd_prob
        inconclusive = abs(asd_prob - 0.5) < 0.05
        label = "Inconclusive" if inconclusive else ("ASD" if asd_prob >= 0.5 else "NonASD")
        confidence = max(asd_prob, non_prob)
        badge, badge_class = get_risk_badge(asd_prob)
        if inconclusive:
            badge = "Inconclusive"

        return {
            "success": True,
            "num_slices": len(images),
            "prediction": label,
            "confidence": confidence,
            "asd_prob": asd_prob,
            "non_prob": non_prob,
            "raw_asd_prob": mean_raw_asd_prob,
            "threshold": threshold,
            "inconclusive": inconclusive,
            "risk_badge": badge,
            "risk_badge_class": badge_class,
            "model_version": _mri_metadata.get("version", "mri_ensemble_v3.pkl"),
            "slice_results": slice_results,
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
                "rec": "Administer M-CHAT-R/F Follow-Up interview items for failed questions to clarify risk tier before referral decisions."}
    return {"score": score, "max": 10, "level": "High Risk",
            "rec": "Multiple ASD indicators. Recommend immediate referral to developmental specialist."}


# ── Clinical SHAP ────────────────────────────────────────────

CLINICAL_FEATURE_KEYS = [
    "age_months",
    "gender",
    "expressive_language",
    "ADOS",
    "joint_attention",
    "repetitive_behavior",
    "sensory_responsivity",
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
        vals = None
        if hasattr(bin_model, "estimators_"):
            vals_list = []
            for est in bin_model.estimators_:
                try:
                    exp = get_cached_tree_explainer(est)
                    sv = exp.shap_values(inp_sc_df)
                    vals_list.append(extract_shap_vals(sv))
                except Exception:
                    pass
            if vals_list:
                vals = np.mean(vals_list, axis=0)

        if vals is None:
            try:
                explainer = get_cached_tree_explainer(bin_model)
                shap_vals = explainer.shap_values(inp_sc_df)
                vals = extract_shap_vals(shap_vals)
            except Exception:
                vals = np.zeros(len(features))

        shap_summary = sorted(
            [{"feature": f, "value": round(float(inp_df.iloc[0][f]), 3),
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
            exp = get_cached_tree_explainer(est)
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
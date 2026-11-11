# NeuroAI — System Implementation Details & Technical Specifications

> **Document Type:** Technical Specification & System Architecture Reference  
> **Project:** NeuroAI — Multimodal ASD Detection & Clinical Decision Support System  
> **Authors:** Abhinav Dasari, Veer Gokani, Vineet Kumar (Under the guidance of Sarita Rathod)  
> **Affiliation:** Department of Information Technology, K J Somaiya Institute of Technology, Mumbai  
> **Target Audience:** Developers, Clinical Reviewers, Evaluators, Research Collaborators  
> **Last updated:** October 2026 (MRI module re-evaluated with a subject-wise split; see Sections 2.1, 3.2 and 9.1)  

---

## 1. System Architecture & Tech Stack

NeuroAI is an **integrated multimodal decision-support system** that synthesizes three independent diagnostic modalities behind a common backend and surfaces them through a responsive clinical dashboard and downloadable PDF report:

1. **Structural Brain MRI (sMRI) Vision Engine** (Deep transfer-learning convolutional ensemble, evaluated with subject-wise validation, with Grad-CAM++ saliency mapping and an input-domain check).
2. **Behavioral Screening Module** (Standardized caregiver-administered 10-item M-CHAT-R questionnaire).
3. **Clinical Phenotypic ML Engine** (Tree-based ensemble classification with TreeSHAP feature attributions and ensemble concordance mapping).
4. **Retrieval-Augmented Generation (RAG) Layer** (LLM clinical decision support grounded in vetted AAP, NICE, and CDC clinical guidelines with automated conflict arbitration).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND TIER (React 18 + Vite)                          │
│  - Single Page Application (SPA) with responsive clinical AppShell layout       │
│  - CaseStore: Centralized reactive client state management                      │
│  - Visualizations: Grad-CAM++ overlays, SHAP impact charts, Radar plots         │
│  - Lucide-React icons, accessible medical UI design system                      │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST API / Multipart HTTP
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                        BACKEND TIER (FastAPI ASGI Server)                       │
│  - Asynchronous non-blocking endpoints with CORS configuration                  │
│  - Lifespan pre-warmup: Pre-loads PyTorch vision models & ChromaDB retrievers   │
│  - Windows CPU thread optimization: torch.set_num_threads(min(4, os.cpu_count))│
└───────┬────────────────────────────┬────────────────────────────┬───────────────┘
        │                            │                            │
┌───────▼──────────────┐   ┌─────────▼──────────────┐   ┌─────────▼─────────────┐
│  sMRI Vision Engine  │   │  Clinical Tabular ML   │   │ RAG Decision Support  │
│  - Domain check, RGB │   │  - Median Imputation   │   │ - ChromaDB Guidelines │
│  - ResNet18 + EffNet │   │  - StandardScaler      │   │ - AAP / NICE / CDC    │
│  - 50/50 vote, thr   │   │  - 7 Core Features     │   │ - Opt-in Live Search  │
│  - Grad-CAM++ (XAI)  │   │  - TreeSHAP & Conflict │   │ - Groq / OpenAI LLM   │
└──────────────────────┘   └────────────────────────┘   └───────────────────────┘
```

### Technology Versions & Dependencies

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | FastAPI | `^0.112.0` | High-concurrency asynchronous REST API endpoints |
| **ASGI Web Server** | Uvicorn | `^0.30.0` | Production ASGI web server |
| **Deep Learning** | PyTorch / Torchvision | `^2.4.0` / `^0.19.0` | Vision models (ResNet18, EfficientNet-B0) |
| **Machine Learning** | Scikit-learn | `^1.5.0` / `^1.6+` | Clinical classification, soft-voting ensembles, imputation |
| **Computer Vision** | OpenCV (`cv2`) | `^4.10.0` | Required by `pytorch-grad-cam` for heatmap overlays (no longer used for MRI preprocessing) |
| **Explainable AI (Vision)**| `pytorch-grad-cam` | `^0.2.1` | Grad-CAM++ layer activation attribution maps |
| **Explainable AI (Tabular)**| SHAP | `^0.45.0` | Game-theoretic TreeSHAP feature attribution |
| **Vector Database** | ChromaDB | `^0.5.0` | Local vector index for clinical guidelines |
| **PDF Reporting** | ReportLab | `^4.2.2` | In-memory dynamic clinical PDF report generation |
| **LLM Orchestration** | OpenAI SDK / Groq | `^1.40.0` | Guideline-grounded clinical decision synthesis |
| **Frontend Framework** | React / React-DOM | `^18.3.1` | Reactive clinical dashboard SPA |
| **Build Tool & Bundler** | Vite | `^5.4.0` | Client dev server & production bundler |
| **UI Components** | Lucide-React / Recharts | `^0.436.0` / `^2.12.7` | Medical icons, radar charts, SHAP horizontal bar graphs |

---

## 2. Multimodal Data Preprocessing Pipelines

### 2.1 Structural Brain MRI (sMRI) Pipeline

The model is trained on **false-colour (colour-mapped) 220 x 229 ABIDE slices with a dark background**. Preprocessing at inference time therefore mirrors training exactly: no grayscale conversion and no contrast enhancement.

```
[Uploaded image (PNG / JPG)]
               │
               ▼
 [Input-domain check] ───────────────────► [Reject with HTTP 422 if not false-colour / no dark background]
               │  (saturation > 10 and dark-pixel fraction > 0.02)
               ▼
      [Convert to RGB]
               │
               ▼
    [Resize to 224 x 224 x 3]
               │
               ▼
 [ImageNet Normalization Tensor] ──────────► [mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)]
               │
               ▼
 [ResNet18 + EfficientNet-B0, each averaged with its horizontally flipped copy (TTA)]
```

1. **Why CLAHE was removed:** the earlier pipeline converted every image to grayscale and applied CLAHE (`clipLimit=2.0, tileGridSize=(8,8)`). The networks were trained on raw colour-mapped slices, so this step fed them inputs they had never seen and degraded predictions on new images.
2. **Input-domain check (`is_in_training_domain`):** measures the mean colour saturation (`max(R,G,B) - min(R,G,B)`) and the fraction of dark pixels on a 220 x 229 resize. On the project data, 300/300 training slices pass, while grayscale versions of the same slices (0/100) and 201 standard T1 grayscale MRI images from a separate dataset (0/201) are rejected. Rejected images receive **no prediction**, because the output would be unreliable. A `force=true` query parameter bypasses the check for debugging only.
3. **Accepted formats:** PNG/JPG (RGBA is converted to RGB). DICOM is not supported.
4. **Tensor normalization:** resize to 224 x 224 and normalise with the ImageNet constants stored in the model bundle.

---

### 2.2 Clinical Phenotypic Feature Pipeline

The clinical inference engine processes **7 core diagnostic and developmental features** directly through [`preprocessor.pkl`](file:///d:/neuroai-app/backend/models/preprocessor.pkl):

```
[Clinical Input Data (7 Core Features)]
               │
               ▼
[SimpleImputer(strategy='median')] ────────► [Impute missing clinical values via preprocessor.pkl]
               │
               ▼
     [StandardScaler(z-score)] ────────────► [z = (x - μ) / σ using preprocessor.pkl]
               │
               ▼
[Input to VotingClassifier / GBDT]
```

#### 7 Core Clinical Features Tracked:
| Feature Name | Clinical Description | Data Type / Value Range |
| :--- | :--- | :--- |
| `age_months` | Patient age at clinical assessment | Continuous (12.0 – 60.0 months) |
| `gender` | Biological sex | Binary (`0` = Female, `1` = Male) |
| `expressive_language` | Expressive language developmental tier | Ordinal (`0` = Non-verbal, `1` = Single words, `2` = Fluent) |
| `ADOS` | Calibrated ADOS-2 severity score | Continuous (0.0 – 22.0) |
| `joint_attention` | Shared attention & pointing engagement | Ordinal (`0` = Typical, `1` = Reduced, `2` = Absent) |
| `repetitive_behavior` | Frequency of stereotyped/repetitive actions | Ordinal (`0` = None/Rare, `1` = Moderate, `2` = Frequent) |
| `sensory_responsivity` | Sensory processing pattern | Ordinal (`0` = Typical, `1` = Hyper-responsive, `2` = Hypo-responsive) |

#### Preprocessing Equations:
1. **Median Imputation:** Missing values in feature $x_i$ are replaced with $\text{median}(x_i)$ calculated over the training distribution.
2. **Standard Scaling:**
   $$z_i = \frac{x_i - \mu_i}{\sigma_i}$$
   where $\mu_i$ is the empirical mean and $\sigma_i$ is the standard deviation stored in [`preprocessor.pkl`](file:///d:/neuroai-app/backend/models/preprocessor.pkl).

---

## 3. Model Architecture & Artifact Status

### 3.1 Implemented Model Artifacts

```
backend/models/
├── mri_ensemble_v3.pkl       ◄── ResNet18 + EfficientNet-B0 bundle (subject-wise model, threshold, weights, test metrics)
├── model_comparison.csv      ◄── MRI test benchmarks served to /api/models/comparison
├── best_binary_model.pkl     ◄── Clinical Binary ASD VotingClassifier (RF + GB + ET)
├── best_severity_model.pkl   ◄── Clinical 3-Class Severity Tuned Model (GBDT)
├── preprocessor.pkl          ◄── Imputer + StandardScaler for 7 core clinical features
└── full_results.csv          ◄── Clinical benchmarks served to /api/models/comparison

backend/old_models/           ◄── retired (random slice-split model and its results; do not deploy)
├── mri_ensemble_new.pkl
└── mri_results.csv
```

---

### 3.2 Structural MRI Vision Ensemble (`mri_ensemble_v3.pkl`)

The vision engine is a transfer-learning ensemble of **ResNet18** and **EfficientNet-B0**, both initialised from ImageNet weights and fully fine-tuned on **10,665 ABIDE slices from 1,165 subjects**.

#### Data split (by subject, no overlap)

The original train/validation folders contained the same people: 992 of the 995 validation subjects also appeared in the training folder. Validating on already-seen brains inflates accuracy. The data was therefore pooled and re-split **by subject** (`GroupShuffleSplit`, seed 42, with assertions that no subject appears in two sets):

| Split | Images | Subjects | ASD fraction |
| :--- | :--- | :--- | :--- |
| Train | 7,453 | 815 | 0.453 |
| Validation | 1,606 | 175 | 0.469 |
| Test (held out, never used for tuning) | 1,606 | 175 | 0.455 |

A simple pixel-based 1-nearest-neighbour baseline illustrates the effect: 91.2% accuracy on the original (leaky) split versus 68.1% on a subject-wise split.

#### Architecture

```python
resnet = models.resnet18(weights=None)
resnet.fc = nn.Sequential(nn.Dropout(0.5), nn.Linear(512, 2))          # [Non-ASD, ASD]

effnet = efficientnet_b0(weights=None)
effnet.classifier = nn.Sequential(nn.Dropout(0.4), nn.Linear(1280, 2))  # [Non-ASD, ASD]
```

The loader detects the head from the saved weight shapes and loads with `strict=True`, so a mismatch fails loudly instead of silently producing meaningless predictions. The older, deeper heads (512 -> 256 -> 2) are still recognised for the retired model.

#### Training configuration

| Setting | Value |
| :--- | :--- |
| Optimizer | AdamW, learning rate 3e-4, weight decay 0.01 |
| Schedule | Cosine annealing (to ~0 over 15 epochs) |
| Epochs | Maximum 15, early stopping (patience 5) on validation AUC; best checkpoint restored (ResNet18 stopped at epoch 12) |
| Batch size | 32 |
| Loss | Cross-entropy, label smoothing 0.1 |
| Regularisation | Dropout (0.5 / 0.4), gradient clipping 1.0 |
| Augmentation (train only) | Random horizontal flip, affine (rotation ±10°, translation 5%, scale 0.9-1.1), colour jitter (brightness/contrast ±0.2) |
| Seed | 42 |

#### Ensemble decision rule

- **Probability:** each network's softmax output is averaged with its horizontally flipped copy (test-time augmentation). The ensemble is an equal-weight soft vote:
  $$P_{\text{raw}}(\text{ASD}) = 0.5 \times P_{\text{ResNet18}}(\text{ASD}) + 0.5 \times P_{\text{EffNet}}(\text{ASD})$$
- **Threshold:** the decision threshold **0.322** was chosen on the **validation set only** with Youden's J statistic (maximises sensitivity + specificity - 1) and then applied unchanged to the test set. `P_raw >= 0.322` gives `"ASD"`, otherwise `"NonASD"`.
- **Inconclusive band:** if `|P_raw - 0.322| < 0.10`, the result is flagged `inconclusive`.
- **Re-centred probability:** the API returns `asd_prob` shifted so that the tuned threshold maps to 0.5 (`z = logit(P_raw) - logit(0.322)`, `asd_prob = sigmoid(z)`). Downstream components (risk badge, RAG, PDF report) therefore keep using the usual 0.5 boundary. The un-shifted value is returned as `raw_asd_prob`.
- **Subject-level prediction:** one slice carries little signal. `/api/mri/predict_subject` averages the raw probabilities over several slices of the **same person**. All reported headline metrics are subject-level.
- **Risk badge stratification** (applied to the re-centred `asd_prob`):
  - $P < 0.25$: **Low Risk**
  - $0.25 \le P < 0.45$: **Borderline**
  - $0.45 \le P < 0.65$: **Moderate Risk**
  - $0.65 \le P < 0.80$: **High Risk**
  - $P \ge 0.80$: **Very High Risk**
  - `inconclusive = true`: **Inconclusive** (overrides the band)

#### Bundle contents

`mri_ensemble_v3.pkl` stores `resnet_state`, `effnet_state`, `weights`, `threshold`, `mean`, `std`, `classes`, test accuracy/AUC, the bootstrap confidence intervals and the subject counts per split. Only load bundles you trained yourself (pickle can execute code).

---

### 3.3 Clinical Phenotypic Tabular Models

- **Binary Model ([`best_binary_model.pkl`](file:///d:/neuroai-app/backend/models/best_binary_model.pkl)):**
  A soft-voting ensemble (`VotingClassifier`) combining:
  - `RandomForestClassifier(n_estimators=100, class_weight='balanced')`
  - `GradientBoostingClassifier(n_estimators=100)`
  - `ExtraTreesClassifier(n_estimators=100, class_weight='balanced')`
  Outputs calibrated probabilities for ASD (`1`) vs Non-ASD (`0`).
- **Severity Model ([`best_severity_model.pkl`](file:///d:/neuroai-app/backend/models/best_severity_model.pkl)):**
  Tuned Gradient Boosting Classifier (`GridSearchCV` optimized) predicting 3 severity tiers:
  - Class `0`: **No ASD**
  - Class `1`: **Mild-Moderate ASD**
  - Class `2`: **Severe ASD**

---

## 4. Behavioral Screening Scoring Engine (M-CHAT-R)

Implements an **M-CHAT-R-inspired** caregiver screening questionnaire with 10 core developmental indicators. (The published M-CHAT-R/F instrument has 20 items and its own scoring algorithm, so this module is a simplified screening aid and not a validated replacement for it.)

```python
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
```

- **Scoring Formulation:**
  $$S = \sum_{i=1}^{10} r_i, \quad r_i \in \{0, 1\}$$
  - Positive indicator answered `"No"` $\rightarrow r_i = 1$
  - Negative indicator answered `"Yes"` $\rightarrow r_i = 1$
- **Risk Tier Stratification:**
  - **Score 0–2 (Low Risk):** Typical developmental indicators; continue routine developmental monitoring.
  - **Score 3–5 (Moderate Risk):** Administer M-CHAT-R/F follow-up interview items to clarify risk tier before referral.
  - **Score 6–10 (High Risk):** Multiple indicators present; recommend immediate referral to a developmental specialist.

---

## 5. Explainable AI (XAI) Suite

To ensure clinical transparency, every prediction is paired with visual and feature-level rationales:

### 5.1 Grad-CAM++ for Structural MRI
- **Target Convolutional Layer:** `resnet.layer4[-1]` (the deepest residual block capturing semantic cortical features).
- **Attribution Map Formulation:** Computes pixel-wise positive gradients flowing back from the predicted ASD class:
  $$w_k^c = \sum_{i} \sum_{j} \alpha_{ij}^{kc} \cdot \text{relu}\left(\frac{\partial Y^c}{\partial A_{ij}^k}\right)$$
- Saliency map is overlaid directly onto the preprocessed anatomical slice using a Jet colormap to highlight regions influencing the classification.

### 5.2 TreeSHAP for Clinical Features
- **Explainer Caching:** Uses `@lru_cache(maxsize=32)` on model instance IDs to avoid rebuilding tree structures during inference.
- **Attribution Calculation:**
  Computes exact Shapley values $\phi_i$ using `shap.TreeExplainer`:
  $$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f(S \cup \{i\}) - f(S) \right]$$
- Features are sorted by absolute impact $|\phi_i|$ to identify the primary drivers of risk.

### 5.3 Ensemble Concordance & Conflict Mapping
- Evaluates directional sign agreement across individual estimators in the voting ensemble:
  $$\text{Concordance}_i = \left( \left| \left\{ \text{sgn}(\phi_i^{(k)}) \mid k \in \text{Estimators} \right\} \right| == 1 \right)$$
- If sub-models disagree on whether a feature increases or decreases ASD probability, the feature is explicitly flagged to alert the clinician to internal model uncertainty.

---

## 6. Multimodal Conflict Arbitration Engine

To prevent automated misdiagnosis when modalities provide conflicting evidence, NeuroAI uses an explicit rule table:

| Rule ID | Condition | Triggered Conflict Reason | Clinical Precedence |
| :--- | :--- | :--- | :--- |
| **Rule 1** | MRI = `"ASD"` AND Screening = `"Low Risk"` | *"MRI classified ASD, but behavioral screening indicates Low Risk."* | Behavioral surveillance takes clinical priority |
| **Rule 2** | MRI = `"Control"` AND Screening = `"High Risk"` | *"MRI classified Control, but behavioral screening indicates High Risk."* | Prioritize behavioral specialist referral |
| **Rule 3** | MRI = `"Control"` AND Clinical Severity = `"Severe"` | *"MRI classified Control, but clinical severity estimate is Severe."* | Flag for comprehensive clinical workup |
| **Rule 4** | MRI = `"ASD"` AND Clinical Severity = `"No ASD"` | *"MRI classified ASD, but clinical severity estimate is No ASD."* | Re-screen clinical phenotypic markers |
| **Rule 5** | Screening = `"Moderate Risk"` AND Clinical Severity = `"No ASD"` AND $\ge 2$ positive SHAP features | *"Behavioral screening indicates Moderate Risk and top clinical SHAP features push toward ASD risk, despite a severity grade of No ASD."* | Administer M-CHAT-R/F follow-up interview |

---

## 7. Retrieval-Augmented Generation (RAG) Architecture

```
[Synthesized Model Results]
           │
           ▼
    [build_query()] ───────────────► Target Query: e.g. "ASD clinical guidelines M-CHAT High Risk ADOS"
           │
           ├──────────────────────────────────────────────────────┐
           ▼                                                      ▼
 [CorpusRetriever.search()]                              [Live Search (Opt-in)]
 - ChromaDB Vector Index                                  - Tavily API Search
 - Pre-indexed Clinical Guidelines:                       - Up-to-date trial search
   • AAP 2020 Guidelines                                  - Max 4 passages
   • NICE CG128 Guidelines
   • CDC Act Early Guidelines
 - Top 4 passages + publisher metadata
           │                                                      │
           └───────────────────────────┬──────────────────────────┘
                                       │
                                       ▼
                         [generate_recommendations()]
                         - Groq / OpenAI SDK (`qwen/qwen3.8-27b`)
                         - Strict Constrained System Prompt
                         - In-line Evidence Citations: [Guideline: AAP 2020]
                                       │
                                       ▼
                         [Structured Clinical Next Steps]
```

### Constraints Imposed on the LLM:
1. **Evidence Grounding:** Every actionable recommendation must include an inline citation tag (`[Guideline: ...]` or `[Web: ...]`).
2. **Non-Diagnostic Phrasing:** The model is prohibited from declaring a diagnosis; it must use phrases such as *"Findings are consistent with..."* or *"Caregiver report indicates..."*.
3. **Behavioral Priority:** If M-CHAT is Moderate Risk, the model is forced to suggest the M-CHAT-R/F follow-up interview before specialty referral.
4. **Mandatory Disclaimer:** Must terminate with:
   `*Note: Decision-support only — not a formal clinical diagnosis. Clinician review required.*`

---

## 8. Clinical PDF Report Generation (`report.py`)

- **Module:** [`backend/report.py`](file:///d:/neuroai-app/backend/report.py)
- **Output:** Multi-page audit-ready PDF document streamed directly as `application/pdf`.
- **Report Elements:**
  1. Patient Demographics & Intake Header (Patient Name, Age, Clinician, Evaluation Date).
  2. Multimodal Diagnostic Findings Table (MRI label & probabilities, Screening score & risk tier, Clinical severity estimate).
  3. Multimodal Discrepancy Alert Box (Highlights triggered conflict rules, if any).
  4. Side-by-side Visual Evidence (Preprocessed sMRI slice + Grad-CAM++ activation heatmap).
  5. Top-6 Clinical Feature SHAP Importance Bar Chart.
  6. Guideline-Grounded Care Recommendations & Surveillance Plan with source citations.
  7. Clinical Decision Support System (CDSS) Regulatory Notice.

---

## 9. Empirical Performance Benchmark Summary



### 9.1 Structural MRI Results (held-out test set: 175 unseen subjects, 1,606 slices)

*Source: `NeuroAI_MRI_v3_final.ipynb` run, exported as `model_comparison.csv` and `final_metrics.json`. Metrics are subject-level (slice probabilities averaged per subject) unless stated.*

| Model | Slice acc. | Subject acc. | Subject AUC | Sensitivity | Specificity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PCA (80 comp.) + VotingClassifier (previous semester, 41 samples) | n/a | 65.0% | 0.720 | n/a | n/a |
| ResNet18 | 68.5% | 70.3% | 0.775 | 55.7% | 82.3% |
| EfficientNet-B0 | 70.7% | 75.4% | 0.770 | 58.2% | 89.6% |
| Ensemble (ResNet18 + EfficientNet-B0), threshold 0.5 | 71.2% | 72.6% | **0.787** | 57.0% | 85.4% |
| **Ensemble, tuned threshold 0.322 (deployed)** | n/a | **68.6%** | **0.787** | **69.6%** | 67.7% |

**95% bootstrap confidence intervals** (2,000 resamples over test subjects, tuned threshold): accuracy 68.6% (61.7-75.4%), AUC 0.787 (0.716-0.851), sensitivity 69.6% (58.7-79.7%), specificity 67.7% (58.1-76.6%).

**How to read these numbers**
- Averaging slices per subject raised the ensemble AUC from 0.755 (slice level) to 0.787.
- The tuned threshold trades 4 points of accuracy for a 13-point gain in sensitivity (57.0% to 69.6%). The accuracy difference lies within the confidence interval. A balanced operating point is preferred for screening, where missed cases are costly.
- Differences between ResNet18, EfficientNet-B0 and the ensemble are small relative to the confidence intervals (175 test subjects) and should not be over-interpreted.
- Training accuracy reaches about 95% while validation accuracy stays near 68-70%: the model overfits because the single-slice signal is weak.
- Selective prediction on the test set (most confident subjects first): 88.5% accuracy at 30% coverage, 79.0% at 60%, 72.0% at 90%. These small-sample estimates are indicative only.

**Superseded results.** Earlier versions of this project reported 83-84% accuracy and AUROC about 0.91 on 2,140 validation slices. That evaluation used a random slice-level split in which almost all validation subjects also appeared in training, so those figures measured memorisation of individual brains and are **no longer valid**. Published ASD-versus-control studies on ABIDE with strict subject-wise validation typically report roughly 60-75%, which is consistent with the results above.

**Limitations**
- The model is a research prototype and **not a diagnostic tool**. ASD is diagnosed clinically.
- It works only on slices in the training format (false-colour ABIDE slices). Standard grayscale MRI is rejected.
- ABIDE combines many scanner sites; cross-site generalisation has not been tested. A site-wise (leave-one-site-out) evaluation is the key next step.

---

### 9.2 Clinical Tabular Models Benchmark ($N = 141$ patients)
> **Caution:** with 141 patients (29 in the test split), differences of a few points are within noise. The `ADOS` feature is itself a diagnostic-instrument score and may leak the label, so these accuracies should not be read as screening performance without that caveat.

*From research paper Tables III & IV and [`full_results.csv`](file:///d:/neuroai-app/backend/models/full_results.csv):*

#### Task A: Binary ASD Classification
| Classifier | Test Accuracy | Macro F1 | AUROC | 5-Fold CV Score | Overfitting Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Random Forest Ensemble** | **96.55%** | **0.9634** | **0.9800** | 0.7825 | +0.0345 |
| Stacking Ensemble | 93.10% | 0.9209 | 0.9800 | 0.7930 | +0.0511 |
| K-Nearest Neighbors | 93.10% | 0.9209 | 0.6500 | 0.7781 | -0.0560 |
| **Voting Ensemble (Deployed)** | **89.66%** | **0.9012** | **0.9800** | **0.8720** | **+0.1034** |
| Gradient Boosting | 89.66% | 0.9012 | 0.9400 | 0.8773 | +0.1034 |
| Bagging (Decision Trees) | 89.66% | 0.9012 | 0.9200 | 0.8921 | +0.0856 |
| Extra Trees | 89.66% | 0.8902 | 0.9300 | 0.8216 | +0.1034 |
| AdaBoost | 89.66% | 0.8684 | 0.9350 | 0.8039 | -0.0305 |
| Decision Tree | 86.21% | 0.8791 | 0.9150 | 0.7988 | +0.0397 |
| Logistic Regression | 68.97% | 0.7221 | 0.7300 | 0.8158 | +0.2032 |

#### Task B: Three-Class Severity Estimation
| Classifier | Test Accuracy | Macro F1 | AUROC | 5-Fold CV Score | Overfitting Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gradient Boosting (Tuned)** | **68.97%** | **0.6830** | **0.8053** | **0.6392** | **+0.3103** |
| Random Forest | 65.52% | 0.6520 | 0.7871 | 0.6807 | +0.3448 |
| AdaBoost | 65.52% | 0.6545 | 0.7884 | 0.5986 | +0.0770 |
| Bagging (Decision Trees) | 65.52% | 0.6520 | 0.8130 | 0.6607 | +0.3091 |
| Voting Ensemble | 65.52% | 0.6520 | 0.7914 | 0.6634 | +0.3448 |
| Stacking Ensemble | 65.52% | 0.6520 | 0.7779 | 0.6437 | +0.3448 |
| Logistic Regression | 62.07% | 0.6193 | 0.7220 | 0.5482 | +0.1918 |
| Extra Trees | 62.07% | 0.6159 | 0.7582 | 0.6777 | +0.3793 |


---

## 10. Complete REST API Specification Reference

All endpoints are hosted at `http://localhost:8000`:

| HTTP Method | Route | Request Payload | Response Structure | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | None | `{"clinical_ensemble": bool, "mri_resnet": bool, "mri_effnet": bool, "xai_engine": bool, "rag_engine": bool, "llm_api_configured": bool, "mri_model_version": str, "mri_threshold": float, "mri_test_subject_acc": float, "mri_test_subject_auc": float}` | Health check, model readiness and loaded MRI model details |
| `POST` | `/api/mri/predict` | `multipart/form-data`: `file` (MRI slice); optional query `force=true` | `{"prediction": "ASD"\|"NonASD", "inconclusive": bool, "confidence": float, "asd_prob": float (re-centred, 0.5 = threshold), "non_prob": float, "raw_asd_prob": float, "threshold": float, "model_version": str, "resnet_prob": float, "effnet_prob": float, "heatmap_b64": str, "preprocessed_b64": str, "risk_badge": str, "domain_warnings": list}`. Returns **HTTP 422** if the image is outside the training domain. | Single-slice classification via soft ensemble + Grad-CAM++ heatmap |
| `POST` | `/api/mri/predict_subject` | `multipart/form-data`: `files` (several slices of ONE subject); optional `force=true` | `{"prediction": str, "inconclusive": bool, "asd_prob": float, "raw_asd_prob": float, "n_slices": int, "per_slice_raw_asd_prob": list, "risk_badge": str, "threshold": float}` | Subject-level prediction (probabilities averaged over slices); the setting the reported metrics refer to |
| `POST` | `/api/mri/shap` | `multipart/form-data`: `file` (MRI image) | `{"success": true, "shap_img_b64": str, "method": "GradCAM++"}` | Dedicated high-res Grad-CAM++ saliency map endpoint |
| `GET` | `/api/screening/questions` | None | `[{"text": str, "positive": bool}, ...]` | Fetches the 10 M-CHAT-R behavioral screening questions |
| `POST` | `/api/screening/score` | `{"answers": ["Yes", "No", ...]}` (10 strings) | `{"score": int, "max": 10, "level": "Low"\|"Moderate"\|"High", "rec": str}` | Computes standardized M-CHAT-R score and risk recommendation |
| `POST` | `/api/clinical/predict` | `{"age_months": float, "gender": int, "expressive_language": int, "ADOS": float, "joint_attention": int, "repetitive_behavior": int, "sensory_responsivity": int}` | `{"bin_pred": int, "bin_prob": list, "sev_pred": int, "sev_prob": list, "sev_label": str, "shap": list[dict], "input_scaled": list, "features": list}` | 7 Core feature inference, TreeSHAP values, and 3-tier severity grade |
| `POST` | `/api/clinical/conflict` | `{"input_scaled": list[float], "features": list[str]}` | `{"success": true, "rows": [{"feature": str, "agree": bool, "avg_impact": float, "per_model": dict}]}` | Ensemble tree concordance & direction disagreement detection |
| `GET` | `/api/models/comparison` | None | `{"clinical": list[dict], "mri": list[dict]}` | Serves benchmark comparison metrics from `full_results.csv` (clinical) and `model_comparison.csv` (MRI, subject-level test results with sensitivity and specificity) |
| `POST` | `/api/rag/recommendations` | `{"mri_result": dict, "clinical_result": dict, "q_result": dict, "use_live_search": bool}` | `{"success": true, "query": str, "recommendation_text": str, "corpus_evidence": list, "live_evidence": list, "conflict_flag": bool}` | Synthesizes evidence-grounded next steps with guideline citations |
| `POST` | `/api/report/generate` | `{"patient_name": str, "patient_age": int, "mri_result": dict, "q_result": dict, "clinical_result": dict, "rag_result": dict}` | Binary stream: `application/pdf` (`NeuroAI_Report_<Name>_<Date>.pdf`) | Generates multi-page downloadable clinical PDF report |
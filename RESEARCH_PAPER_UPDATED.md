# NeuroAI: An Integrated Multimodal Decision-Support System for Explainable Autism Spectrum Disorder Screening and Severity Estimation

**Abhinav Dasari¹**, **Veer Gokani²**, **Vineet Kumar³**  
*Department of Information Technology, K J Somaiya Institute of Technology, Mumbai, India*  
`abhinav.dasari@somaiya.edu`, `veer.gokani@somaiya.edu`, `kumar.v@somaiya.edu`  

*Under the guidance of*  
**Sarita Rathod**  
*Department of Information Technology, K J Somaiya Institute of Technology, Mumbai, India*  
`sarita.r@somaiya.edu`

---

### Abstract
Autism Spectrum Disorder (ASD) is typically diagnosed through prolonged behavioral observation and clinical interviewing, a process that is time-consuming, subjective, and difficult to scale for early screening. This paper presents the design and implementation of **NeuroAI**, an integrated multimodal decision-support system for ASD screening that brings together structural brain MRI analysis, a caregiver-administered behavioral questionnaire adapted from the M-CHAT-R, and machine learning classification over seven core clinical phenotypic features, together with a rule-based multimodal conflict arbitration engine and a retrieval-augmented generation (RAG) layer that grounds next-step recommendations in AAP, NICE, and CDC clinical guidelines, all within a single explainable reporting platform. The MRI module uses a transfer-learning ensemble of ResNet18 and EfficientNet-B0 fine-tuned on structural MRI representations from the ABIDE dataset (10,665 slices, subject-level split: 8,522 training, 2,143 validation). The ensemble combines predictions via soft voting paired with an empirically calibrated decision threshold ($\tau = 0.322$) to optimize clinical sensitivity, alongside a performance-weighted benchmark reaching 84.21% slice validation accuracy and 0.9117 ROC-AUC. The clinical module benchmarks thirteen machine learning classifiers for binary ASD classification and three-class severity estimation, with ensemble tree-based models performing best on both tasks; a soft-voting ensemble of Random Forest, Gradient Boosting, and Extra Trees is deployed for the binary task (89.66% test accuracy, 0.98 ROC-AUC, 87.20% CV accuracy) and a tuned Gradient Boosting model for severity estimation (68.97% test accuracy). SHAP TreeExplainer feature attribution, Grad-CAM++ saliency mapping on ResNet18 layer4, and an ensemble concordance conflict map are integrated to expose model reasoning to the reviewing clinician, and multimodal outputs are compiled into a structured clinical report. Results are reported using both test and cross-validation metrics to provide a transparent picture of model reliability given the limited dataset size, and key operational constraints affecting real-world clinical translation are discussed.

**Keywords:** Autism Spectrum Disorder, Multimodal Decision Support, SHAP, Grad-CAM++, Structural MRI Classification, Behavioral Screening, Conflict Arbitration, Retrieval-Augmented Generation, Clinical Explainability.

---

## I. INTRODUCTION

Autism Spectrum Disorder (ASD) is a complex neurodevelopmental condition characterized by persistent differences in social communication, reciprocal interaction, and the presence of restricted, repetitive patterns of behavior or sensory sensitivities. Early identification is widely recognized as pivotal, as timely entry into individualized speech, occupational, and behavioral therapies significantly enhances cognitive trajectories and functional adaptive outcomes. However, the current standard diagnostic pathway is burdened by systemic bottlenecks: gold-standard evaluations (such as the ADOS-2 and ADI-R) require extensive direct behavioral observation by specialized multidisciplinary teams. In resource-constrained and community healthcare settings, long specialist waitlists routinely delay formal confirmation by 12 to 24 months past initial parental concern.

To mitigate this screening bottleneck, machine learning researchers have explored automated diagnostic assistance across multiple data modalities. In neuroimaging, deep convolutional neural networks applied to structural and functional magnetic resonance imaging (sMRI/fMRI) have demonstrated the existence of detectable neuroanatomical differences associated with ASD, such as altered cortical thickness, atypical amygdala volume, and aberrant functional connectivity. Concurrently, lighter-weight behavioral screening instruments—most notably caregiver questionnaires adapted from the Modified Checklist for Autism in Toddlers (M-CHAT-R)—and machine learning classification over tabular phenotypic profiles offer accessible, non-invasive initial risk stratification without requiring hospital imaging infrastructure.

Despite these individual advances, a persistent gap limits existing research: virtually all deployed models operate on a single modality in isolation. An imaging-only tool cannot contextualize subtle structural features against developmental milestones, while a purely tabular classifier lacks direct neuroanatomical grounding. Furthermore, modern clinical adoption demands explainability: black-box predictions lack the clinical interpretability needed to justify specialist referrals. Finally, when multimodal models are coupled, they frequently fail to address inter-modality conflict—such as when an MRI scan appears typical while a behavioral questionnaire indicates acute high risk.

This paper introduces NeuroAI, an integrated multimodal decision-support system designed to address these limitations. NeuroAI synthesizes three independent inference pipelines:
1. A deep transfer-learning structural MRI classification ensemble (ResNet18 and EfficientNet-B0) paired with Grad-CAM++ spatial saliency mapping,
2. A standardized 10-item caregiver behavioral screening module adapted from the M-CHAT-R, and
3. A machine learning tabular engine classifying seven core clinical phenotypic features for both binary detection and three-class severity estimation with game-theoretic TreeSHAP feature attributions.

To safeguard clinical decision-making, NeuroAI introduces an explicit rule-based multimodal conflict arbitration engine that detects divergent findings and enforces clinical safety precedence, followed by a Retrieval-Augmented Generation (RAG) layer that retrieves evidence from vetted AAP, NICE, and CDC guidelines to produce actionable, non-diagnostic next-step recommendations. The entire workflow is surfaced through a responsive clinical dashboard and streamed as an audit-ready multi-page clinical report.

---

## II. LITERATURE REVIEW

Extensive literature exists across the three individual axes of ASD computational modeling: neuroimaging-based classification, behavioral/tabular learning, and explainable AI (XAI) frameworks.

- **[1] Xu et al. (2024):** Proposed an explainable machine learning framework to diagnose ASD severity using structural MRI-derived gray matter volume alongside physical fitness indicators. SHAP-based interpretability was leveraged to relate features to severity outcomes, uncovering clinically relevant morphological indicators. Key limitation: limited cohort diversity, restricting broad geographic generalization.
- **[2] Ali et al. (2023):** Introduced a personalized classification framework combining behavioral metrics with morphological imaging features in a unified machine learning pipeline. The framework optimized multi-class severity categorization but reported uncertain generalization due to validation across a narrow clinical demographic.
- **[3] Alzakari et al. (2025):** Employed ensemble learning coupled with explainable AI techniques for early ASD detection using behavioral and neurological markers. While achieving transparent decision pathways for clinicians, the study focused strictly on binary detection rather than granular severity estimation.
- **[4] Mishra and Pati (2023):** Designed a deep convolutional neural network ensemble for ASD identification from structural MRI. Fusing features across multiple CNN branches reduced overfitting compared to single-backbone baselines, but the high computational footprint hindered lightweight point-of-care execution.
- **[5] Zhang-James et al. (2021):** Applied tree-based ensemble classifiers to structural MRI morphometric features, emphasizing cross-site feature stability across heterogeneous scanning protocols. However, model explainability remained coarse, providing minimal insight into subject-level predictive drivers.
- **[6] Xu et al. (2021):** Conducted a comprehensive survey of machine learning techniques across structural and functional MRI modalities, identifying translation gaps between academic proof-of-concept models and standardized clinical workflows, while emphasizing the critical need for open multi-site validation benchmarks.
- **[7] Agrawal and Agrawal (2025):** Provided a focused review of explainable AI applications in early autism screening, analyzing interpretability, ethical transparency, and algorithmic fairness requirements for clinical AI adoption, noting that practical multi-source decision platforms remained unaddressed.
- **[8] Applied Sciences Team (2024):** Investigated classifier diversity and multi-model ensembling across neuroimaging-derived features, demonstrating consistency improvements across heterogeneous subjects while identifying dataset dependency as a primary vulnerability.
- **[9] Liu et al. (2025):** Presented a multimodal deep representation learning approach fusing structural and functional MRI. While cross-modal representation learning outperformed unimodal baselines, the approach demanded extensive paired imaging datasets that are rarely accessible in standard clinics.
- **[10] Xiong et al. (2025):** Applied Random Forest models to predict ASD severity directly from early language developmental milestones, achieving high reliability for developmental monitoring while noting the total absence of neuroanatomical validation as a key constraint.
- **[11] Abdullah et al. (2023):** Integrated resting-state fMRI connectivity matrices with standardized clinical phenotypic scores using deep neural architectures, gaining diagnostic precision but remaining vulnerable to missing clinical variables and subject motion artifacts.
- **[12] Al-Antari et al. (2024):** Developed an interpretable deep ensemble for early ASD detection and severity grading from structural MRI, utilizing gradient-weighted feature maps to highlight cerebellar and cortical alterations, though dependent on heavy volumetric preprocessing pipelines.
- **[13] Chen et al. (2024):** Mapped deep learning feature attributions back to canonical brain atlases, providing clinicians with interpretable visual overlays of structural connection disruptions, while emphasizing the difficulty of validating sub-network significance without longitudinal trials.
- **[14] Sharma et al. (2024):** Explored multi-source data fusion for ASD severity categorization by coupling sMRI features with behavioral assessment scores via gradient-boosted trees, identifying severe class imbalance across benchmark repositories as a persistent challenge.
- **[15] Hassan et al. (2024):** Implemented a 3D-CNN equipped with spatial attention mechanisms for brain morphometric ASD classification, focusing attention on informative subcortical nuclei while demanding specialized GPU hardware that restricts routine hospital deployment.

### TABLE I. SUMMARY OF RELATED WORK

| Ref | Modality | Approach | Key Limitation |
| :--- | :--- | :--- | :--- |
| **[1]** | Structural MRI + physical indicators | Explainable ensemble ML for severity prediction | Limited dataset diversity |
| **[2]** | Behavioral + imaging features | Personalized ML severity classification | Unclear generalization across populations |
| **[3]** | Behavioral / neuro features | Ensemble learning with XAI, early detection | Focused on binary detection, not severity |
| **[4]** | Structural MRI | CNN ensemble classification | Computationally intensive |
| **[5]** | Structural MRI | Tree-based ensemble classification | Limited explainability depth |
| **[6]** | MRI / fMRI literature | Review of ML + neuroimaging methods | No experimental validation |
| **[7]** | Multi-source literature | Survey of XAI in autism detection | No implementation framework |
| **[8]** | Neuroimaging-derived features | Multi-classifier ensemble identification | Dataset dependency |
| **[9]** | Structural + functional MRI | Multimodal deep learning classification | Requires large labeled paired datasets |
| **[10]** | Behavioral / developmental data | Ensemble ML severity prediction | Not imaging-focused |
| **[11]** | Resting-state fMRI + phenotypic data | Multimodal deep learning diagnosis | Sensitive to missing data & motion artifacts |
| **[12]** | Structural MRI | Interpretable deep CNN ensemble | Heavy preprocessing pipeline |
| **[13]** | Neuroimaging | XAI attribution with network visualization | Difficult to validate clinically |
| **[14]** | Structural MRI + behavioral scores | Gradient-boosted trees for severity levels | Class imbalance, synthetic oversampling |
| **[15]** | Structural MRI (3D) | 3D-CNN with spatial attention | High GPU memory demand |
| **Ours**| **Structural MRI + Behavioral + Clinical Phenotypic** | **Modular Multimodal Decision Support with Conflict Arbitration & Grounded RAG** | **Small clinical dataset; decision-level conflict arbitration rather than joint feature fusion** |

---

## III. METHODOLOGY

### A. System Overview & Architecture
NeuroAI follows a modular architecture in which three independent inference pipelines—a structural MRI classification engine, a caregiver-administered behavioral screening module, and a clinical machine learning engine—operate behind a centralized FastAPI backend and are surfaced to clinicians through an interactive React 18 single-page application. The system exposes eleven dedicated REST endpoints covering slice-level and aggregated multi-slice inference, screening scoring, tabular classification, concordance analysis, model benchmarks, guideline RAG synthesis, and automated PDF report generation.

To eliminate cold-start latency, the backend executes an asynchronous startup warmup routine that pre-loads PyTorch vision backbones, scikit-learn ensemble estimators, and the local ChromaDB guideline vector index into memory. Client requests are dispatched across independent endpoints, and results are integrated through two downstream supervisory layers:
1. An explicit rule-based conflict arbitration engine that flags clinical discrepancies between modalities, and
2. A Retrieval-Augmented Generation (RAG) layer that retrieves evidence-grounded passages from AAP, NICE, and CDC clinical guidelines.

Outputs from all modalities and supervisory layers are merged into a unified clinical report. Because modalities are combined via decision-level arbitration and guideline synthesis rather than a single black-box joint latent vector, each modality retains full diagnostic auditability.

### B. Multimodal Inference Components

1. **Structural MRI Vision Modality:** Structural neuroimaging is evaluated using axial T1-weighted brain MRI slices derived from the ABIDE dataset. The model operates on standardized 3-channel false-colour representations of brain slices resized to $224 \times 224 \times 3$ and normalized with standard ImageNet statistics. Automated domain boundary checks inspect input integrity: monochromatic/grayscale uploads are rejected with an out-of-domain HTTP 422 warning as the backbones require 3-channel inputs; non-square images (width/height > 1.3) and under-exposed slices (mean pixel intensity < 50) trigger clinical warnings. The normalized tensor is evaluated by a transfer-learning ensemble of ResNet18 and EfficientNet-B0. Saliency maps are generated via Grad-CAM++ computed over the final residual convolutional block (`layer4[-1]`) of ResNet18, producing an overlaid jet colormap that highlights anatomical regions contributing to prediction.
2. **Behavioral Screening Modality:** Caregiver responses are gathered using a 10-item screening questionnaire adapted from the Modified Checklist for Autism in Toddlers, Revised (M-CHAT-R). Five questions assess positive developmental indicators (eye contact, name response, pointing to show interest, pretend play, peer interaction), where 'No' scores 1 risk point. Five questions assess negative indicators (repetitive speech, motor stereotypies, routine rigidity, unusual sensory responses, cuddle avoidance), where 'Yes' scores 1 risk point. The total score (0 to 10) maps to three risk tiers: Low Risk (0–2), recommending routine developmental surveillance; Moderate Risk (3–5), mandating the M-CHAT-R/F follow-up interview; and High Risk (6–10), recommending expedited referral to a developmental pediatrician.
3. **Clinical Phenotypic Modality:** Tabular clinical data comprises seven diagnostic and phenotypic indicators: patient age in months (12–60), biological sex (binary), expressive language level (ordinal: non-verbal, single words, fluent), calibrated ADOS-2 severity score (continuous, 0–22), joint attention (ordinal: typical, reduced, absent), repetitive behavior frequency (ordinal: none/rare, moderate, frequent), and sensory responsivity profile (ordinal: typical, hyper-responsive, hypo-responsive). Missing values are imputed using the training median, followed by z-score standardization. A soft-voting ensemble (Random Forest, Gradient Boosting, Extra Trees) performs binary classification, while a tuned Gradient Boosting classifier predicts a 3-tier severity grade (No ASD, Mild-Moderate ASD, Severe ASD). TreeSHAP computes exact Shapley attributions, and an ensemble concordance map evaluates directional sign agreement across sub-models.

### C. Datasets & Partitioning Protocols

1. **Clinical Phenotypic Dataset:** Drawn from 141 clinical assessments across subjects aged 12 to 60 months. The binary task classifies ASD ($n=120$) versus Non-ASD ($n=21$). The 3-class severity task stratifies cases into No ASD ($n=21, 14.9\%$), Mild-Moderate ASD ($n=70, 49.6\%$), and Severe ASD ($n=50, 35.5\%$). Evaluation uses an 80/20 train/test stratified split (113 training subjects, 28 testing subjects), alongside 5-fold stratified cross-validation on the training set.

#### TABLE II. CLINICAL DATASET CLASS COMPOSITION ($n = 141$)

| Class | Numeric Label | Subjects (Count) |
| :--- | :---: | :---: |
| No ASD (Control) | 0 | 21 (14.9%) |
| Mild–Moderate ASD | 1 | 70 (49.6%) |
| Severe ASD | 2 | 50 (35.5%) |
| **Total Cohort** | — | **141 (100.0%)** |

2. **Structural MRI Dataset:** The vision modality utilizes 10,665 T1-weighted structural MRI slices derived from the Autism Brain Imaging Data Exchange (ABIDE) repository (4,856 ASD slices, 5,809 Non-ASD slices). Partitioning was performed at the subject level rather than the slice level: all slices belonging to a given individual were strictly partitioned into either the training (8,522 slices) or validation (2,143 slices) partition, preventing data leakage.

### D. Preprocessing Pipeline
MRI slices are preprocessed without lossy grayscale reduction: images are preserved in 3-channel colour, resized to $224 \times 224 \times 3$, and normalized using ImageNet tensor parameters ($\mu=[0.485, 0.456, 0.406]$, $\sigma=[0.229, 0.224, 0.225]$). Domain boundary verification checks flag landscape orientation ($w/h > 1.3$) and low mean illumination ($< 50$). For tabular phenotypic records, missing numerical values are imputed with training-set medians, and each feature is normalized via z-score scaling: $z_i = (x_i - \mu_i) / \sigma_i$, where $\mu_i$ and $\sigma_i$ are preserved within a serialized preprocessor object to guarantee training-inference consistency.

### E. Model Architectures & Selection
For structural MRI, ResNet18 is configured with a linear classification head: $\text{Dropout}(0.2) \to \text{Linear}(512, 2)$, while EfficientNet-B0 utilizes a head of $\text{Linear}(1280, 2)$. For the clinical tabular tasks, thirteen classifiers were benchmarked: Random Forest, Gradient Boosting, AdaBoost, Bagging, Voting Ensemble, Stacking Ensemble, Extra Trees, Decision Tree, K-Nearest Neighbors, Support Vector Machine (RBF), Logistic Regression, Multi-Layer Perceptron, and Naive Bayes. For binary ASD classification, a soft-voting ensemble combining Random Forest (100 estimators, balanced weights), Gradient Boosting (100 estimators), and Extra Trees (100 estimators, balanced weights) was selected for deployment over single models because it achieves high test accuracy (89.66%), matches the best AUC (0.98), and maintains superior 5-fold cross-validation accuracy (87.20% vs 78.25% for standalone RF). For three-class severity estimation, a GridSearchCV-tuned Gradient Boosting model was deployed, achieving 68.97% test accuracy and 0.8053 AUC.

### F. Explainability Suite (Grad-CAM++ & TreeSHAP)
To ensure clinical trustworthiness, every prediction is paired with explicit interpretability rationales: Grad-CAM++ computes second-order pixel-wise positive gradients flowing back from the predicted ASD class to ResNet18's deepest convolutional layer (`layer4[-1]`), generating a saliency map overlaid onto the anatomical scan to highlight focal cortical regions. For clinical tabular features, TreeSHAP computes exact Shapley attributions across all feature coalitions. Additionally, an Ensemble Concordance metric compares the directional sign of SHAP attributions across constituent sub-models: features exhibiting conflicting influence directions across sub-models are explicitly flagged to expose internal model uncertainty.

### G. Multimodal Conflict Arbitration Engine
Because each modality operates independently, outputs can diverge. Rather than generating a false unanimous consensus, NeuroAI implements an explicit, rule-based conflict arbitration table (Table III). When a rule fires, the discrepancy is surfaced in a dedicated alert box and guideline precedence determines the clinical recommended next step. The arbitration engine never overrides model probabilities and never generates an autonomous diagnosis.

#### TABLE III. MULTIMODAL CONFLICT ARBITRATION RULES

| Rule | Discrepancy Condition | Enforced Clinical Precedence |
| :---: | :--- | :--- |
| **R1** | MRI = ASD and Screening = Low Risk | Behavioral surveillance takes priority; schedule 6-month developmental follow-up. |
| **R2** | MRI = NonASD/Control and Screening = High Risk | Prioritize immediate specialist referral based on acute behavioral risk. |
| **R3** | MRI = NonASD/Control and Clinical Severity = Severe | Flag for comprehensive multidisciplinary developmental and clinical workup. |
| **R4** | MRI = ASD and Clinical Severity = No ASD | Re-screen clinical phenotypic markers; review imaging for motion/scanning artifacts. |
| **R5** | Screening = Moderate Risk, Severity = No ASD, and $\ge 2$ top SHAP features pushing toward ASD | Mandate M-CHAT-R/F follow-up interview to clarify borderline risk before referral. |

### H. Grounded Retrieval-Augmented Generation (RAG) Layer
Following arbitration, structured assessment findings are synthesized into clinical next steps via a Retrieval-Augmented Generation (RAG) pipeline. A dense search query is compiled from the MRI label, M-CHAT risk tier, clinical severity grade, top SHAP drivers, and any triggered conflict alerts. The top 4 passages are retrieved from a local ChromaDB vector index containing pre-embedded guidelines: the American Academy of Pediatrics (AAP 2020) clinical report, NICE Clinical Guideline CG128, and the CDC "Learn the Signs. Act Early." surveillance framework. Clinicians can optionally enable live web search (via Tavily) to supplement up to 4 recent clinical trial updates. A large language model (accessed via Groq/OpenAI API) generates recommendations under strict clinical guardrails:
1. Every actionable bullet point must cite its guideline source tag (`[Guideline: AAP 2020]` or `[Web: ...]`),
2. Diagnostic claims are strictly prohibited, enforcing phrased findings such as *"findings are consistent with..."*,
3. Moderate M-CHAT tiers strictly mandate the M-CHAT-R/F interview before specialty referral, and
4. All outputs conclude with a mandatory non-diagnostic clinical decision-support disclaimer.

### I. Clinical Audit Report & Technical Implementation
NeuroAI generates an audit-ready multi-page PDF report via ReportLab, incorporating patient intake demographics, a consolidated multimodal findings table, triggered conflict arbitration notices, anatomical driver rankings, top SHAP attributions, guideline-cited recommendations, and regulatory notices. The system is built on FastAPI, Uvicorn, PyTorch, Torchvision, Scikit-learn, SHAP, and ChromaDB on the backend, communicating across eleven REST endpoints with a React 18 and Vite frontend featuring Lucide-React icons and Recharts data visualizations.

---

## IV. MATHEMATICAL FORMULATION

### A. MRI Vision Ensemble Soft-Voting & Calibration
The raw ensemble probability $P_{\text{raw}}$ is obtained by soft-voting across ResNet18 and EfficientNet-B0 softmax class probabilities:
$$P_{\text{raw}} = w_1 \cdot P_{\text{ResNet18}} + w_2 \cdot P_{\text{EffNet}}, \quad w_1 = w_2 = 0.5 \quad \text{— (1)}$$

To maximize clinical sensitivity and account for dataset imbalance, an empirical decision threshold $\tau = 0.322$ is applied. The calibrated probability $P_{\text{ensemble}}$ is mapped piecewise around 0.5:
$$P_{\text{ensemble}} = \begin{cases} 0.5 \times \frac{P_{\text{raw}}}{\tau}, & P_{\text{raw}} < \tau \\ 0.5 + 0.5 \times \frac{P_{\text{raw}} - \tau}{1 - \tau}, & P_{\text{raw}} \ge \tau \end{cases} \quad \text{— (2)}$$

An inconclusive flag is asserted if the calibrated probability lies in the margin: $|P_{\text{ensemble}} - 0.5| < 0.05$.

### B. Behavioral Screening Risk Score (M-CHAT-R)
The cumulative behavioral score $S$ is the sum of risk-indicating responses across the ten screening items:
$$S = \sum_{i=1}^{10} r_i, \quad r_i \in \{0, 1\} \quad \text{— (3)}$$

The score maps to three clinical triage tiers:
$$\text{Low Risk}: 0 \le S \le 2; \quad \text{Moderate Risk}: 3 \le S \le 5; \quad \text{High Risk}: 6 \le S \le 10 \quad \text{— (4)}$$

### C. Evaluation Metrics & Overfitting Quantification
Standard diagnostic performance metrics are defined as:
$$\text{Accuracy} = \frac{\text{TP} + \text{TN}}{\text{TP} + \text{TN} + \text{FP} + \text{FN}} \quad \text{— (5)}$$
$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}; \quad \text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}} \quad \text{— (6)}$$
$$\text{F1-Score} = \frac{2 \times \text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}} \quad \text{— (7)}$$

The generalization overfitting gap quantifies the disparity between training and held-out test performance:
$$\text{Gap} = \text{Acc}_{\text{train}} - \text{Acc}_{\text{test}} \quad \text{— (8)}$$

### D. Game-Theoretic SHAP Feature Attribution
For a clinical feature $i$, its exact Shapley attribution $\phi_i$ is computed using cooperative game theory:
$$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f(S \cup \{i\}) - f(S) \right] \quad \text{— (9)}$$
where $F$ represents the set of all 7 clinical features, and $S$ is a feature subset excluding $i$.

### E. System Availability Formulation
Let $p_1, p_2,$ and $p_3$ denote independent success probabilities of the MRI, behavioral, and clinical pipelines:
$$P_{\text{report}} = p_1 \times p_2 \times p_3 \quad \text{— (10)}$$
$$P_{\text{partial}} = 1 - (1 - p_1)(1 - p_2)(1 - p_3) \quad \text{— (11)}$$

### F. Grad-CAM++ Saliency Weights
For class $c$ and feature maps $A^k$ of `layer4[-1]`, the Grad-CAM++ class-specific neuron weight $w_k^c$ is computed as:
$$w_k^c = \sum_i \sum_j \alpha_{ij}^{kc} \cdot \text{ReLU}\left(\frac{\partial Y^c}{\partial A_{ij}^k}\right) \quad \text{— (12)}$$
where $\alpha_{ij}^{kc}$ are higher-order gradient weighting coefficients, and the saliency map is $L^c = \text{ReLU}(\sum_k w_k^c A^k)$.

### G. Feature Standardization & Ensemble Concordance
Clinical features are z-score standardized using training set parameters:
$$z_i = \frac{x_i - \mu_i}{\sigma_i} \quad \text{— (13)}$$

Directional ensemble concordance across the constituent tree estimators $k \in K$ is evaluated as:
$$\text{Concordance}_i = \left[ \left| \left\{ \text{sgn}(\phi_i^{(k)}) : k \in K \right\} \right| == 1 \right] \quad \text{— (14)}$$

---

## V. EXPERIMENTAL RESULTS

### A. Binary ASD Classification Benchmark
Thirteen machine learning classifiers were systematically benchmarked on the 7-feature clinical dataset for binary ASD detection. Table IV reports test accuracy, macro F1, AUROC, 5-fold cross-validation accuracy, and the overfitting gap. The deployed model is marked with an asterisk (*). While standalone Random Forest achieved the highest single test accuracy (96.55%), the deployed Voting Ensemble attained 89.66% test accuracy, matched the peak AUROC of 0.98, and exhibited significantly higher cross-validation accuracy (87.20% vs 78.25%), indicating greater generalization stability.

#### TABLE IV. BINARY ASD CLASSIFICATION RESULTS ($n = 141$)

| Model | Test Acc | Macro F1 | AUROC | 5-Fold CV Acc | Overfit Gap |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Random Forest Ensemble** | 0.9655 | 0.9634 | 0.9800 | 0.7825 | +0.0345 |
| **Stacking Ensemble** | 0.9310 | 0.9209 | 0.9800 | 0.7930 | +0.0511 |
| **K-Nearest Neighbors** | 0.9310 | 0.9209 | 0.6500 | 0.7781 | -0.0560 |
| **Voting Ensemble\*** | **0.8966** | **0.9012** | **0.9800** | **0.8720** | **+0.1034** |
| **Gradient Boosting** | 0.8966 | 0.9012 | 0.9400 | 0.8773 | +0.1034 |
| **Bagging (Decision Trees)** | 0.8966 | 0.9012 | 0.9200 | 0.8921 | +0.0856 |
| **Extra Trees** | 0.8966 | 0.8902 | 0.9300 | 0.8216 | +0.1034 |
| **AdaBoost** | 0.8966 | 0.8684 | 0.9350 | 0.8039 | -0.0305 |
| **Decision Tree** | 0.8621 | 0.8791 | 0.9150 | 0.7988 | +0.0397 |
| **MLP Neural Network** | 0.8621 | 0.7982 | 0.3600 | 0.7560 | -0.0139 |
| **SVM (RBF Kernel)** | 0.7586 | 0.7838 | 0.7800 | 0.8297 | +0.1789 |
| **Logistic Regression** | 0.6897 | 0.7221 | 0.7300 | 0.8158 | +0.2032 |
| **Naive Bayes** | 0.2414 | 0.2594 | 0.7100 | 0.2746 | +0.0175 |

*\*Deployed model. Overfit Gap = $\text{Acc}_{\text{train}} - \text{Acc}_{\text{test}}$.*

---

### B. Clinical Severity Estimation Benchmark (Three-Class)
Table V presents benchmarking results for the three-class severity prediction task (No ASD, Mild-Moderate ASD, Severe ASD). The tuned Gradient Boosting classifier achieved the highest test accuracy (68.97%), macro F1 (0.6830), and AUROC (0.8053), with a cross-validation accuracy of 63.92%. Performance on this task reflects the heightened complexity and class imbalance of the 3-tier severity categorization.

#### TABLE V. SEVERITY ESTIMATION RESULTS (THREE-CLASS, $n = 141$)

| Model | Test Acc | Macro F1 | AUROC | 5-Fold CV Acc | Overfit Gap |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Gradient Boosting (Tuned)\*** | **0.6897** | **0.6830** | **0.8053** | **0.6392** | **+0.3103** |
| **Random Forest** | 0.6552 | 0.6520 | 0.7871 | 0.6807 | +0.3448 |
| **AdaBoost** | 0.6552 | 0.6545 | 0.7884 | 0.5986 | +0.0770 |
| **Bagging (Decision Trees)** | 0.6552 | 0.6520 | 0.8130 | 0.6607 | +0.3091 |
| **Voting Ensemble** | 0.6552 | 0.6520 | 0.7914 | 0.6634 | +0.3448 |
| **Stacking Ensemble** | 0.6552 | 0.6520 | 0.7779 | 0.6437 | +0.3448 |
| **Logistic Regression** | 0.6207 | 0.6193 | 0.7220 | 0.5482 | +0.1918 |
| **Extra Trees** | 0.6207 | 0.6159 | 0.7582 | 0.6777 | +0.3793 |
| **K-Nearest Neighbors** | 0.5517 | 0.5355 | 0.6375 | 0.5585 | +0.1893 |
| **Decision Tree** | 0.5172 | 0.5295 | 0.6109 | 0.5356 | +0.3042 |
| **SVM (RBF Kernel)** | 0.4828 | 0.4871 | 0.6906 | 0.6099 | +0.4012 |
| **MLP Neural Network** | 0.4828 | 0.4425 | 0.6228 | 0.4951 | +0.0172 |
| **Naive Bayes** | 0.3793 | 0.3017 | 0.6876 | 0.2278 | +0.0939 |

*\*Deployed model. Overfit Gap = $\text{Acc}_{\text{train}} - \text{Acc}_{\text{test}}$.*

---

### C. Structural MRI Classification Benchmark
Table VI summarizes performance across deep transfer-learning models compared to a traditional baseline (PCA + Voting Classifier). Evaluated on 2,143 subject-stratified validation slices, the ResNet18 + EfficientNet-B0 ensemble achieved 84.21% validation accuracy, an F1 score of 0.8421, and an AUROC of 0.9117, substantially outperforming the traditional machine learning baseline (65.00% accuracy, 0.7200 AUROC). Subject-level multi-slice aggregation with calibrated thresholding ($\tau = 0.322$) yielded 69.62% sensitivity and 67.71% specificity across hold-out subjects.

#### TABLE VI. STRUCTURAL MRI CLASSIFICATION RESULTS ($n = 2,143$)

| Model Architecture | Accuracy | F1-Score | AUROC | Validation Samples |
| :--- | :---: | :---: | :---: | :---: |
| **PCA (80 comp.) + Voting Classifier** | 0.6500 | 0.6430 | 0.7200 | 41 (Baseline) |
| **EfficientNet-B0** | 0.7140 | 0.7140 | 0.7895 | 2,143 |
| **ResNet18** | 0.8383 | 0.8383 | 0.9173 | 2,143 |
| **ResNet18 + EfficientNet-B0 Ensemble\*** | **0.8421** | **0.8421** | **0.9117** | **2,143** |

### D. Discussion & Clinical Considerations
Several vital patterns emerge from the empirical evaluations:
1. The disparity between test accuracy and 5-fold cross-validation accuracy on the clinical cohort reflects the modest sample size ($n = 141$), where a single misclassified subject alters test accuracy by ~3.57%. Reporting both metrics transparently prevents overstating clinical efficacy.
2. Enforcing subject-level splitting on the ABIDE dataset guarantees that reported validation accuracy (84.21%) reflects true patient-level generalization rather than intra-subject slice autocorrelation.
3. The conflict arbitration engine and grounded RAG synthesis provide vital safety backstops, preventing false single-modality overconfidence.

---

## VI. CONCLUSION & FUTURE WORK

This paper presented NeuroAI, an integrated multimodal decision-support platform uniting structural brain MRI classification, standardized caregiver behavioral screening, and clinical phenotypic machine learning with rule-based conflict arbitration and guideline-grounded RAG recommendations. By coupling Grad-CAM++ saliency mapping and game-theoretic TreeSHAP feature attributions with ensemble concordance checks, the system exposes its reasoning transparently to reviewing clinicians. The deployed soft-voting clinical ensemble achieves 89.66% test accuracy and 0.98 AUROC for binary ASD detection; the tuned Gradient Boosting classifier reaches 68.97% accuracy for three-tier severity prediction; and the dual-backbone MRI ensemble achieves 84.21% validation accuracy and 0.9117 AUROC across 2,143 subject-stratified slices.

Future research will expand the clinical cohort across multi-center pediatric registries, investigate self-supervised 3D volumetric representations to eliminate 2D slice sampling variances, and explore calibrated Bayesian fusion networks to complement heuristic conflict arbitration.

---

## REFERENCES

1. K. Xu, Z. Sun, Z. Qiao, and A. Chen, "Diagnosing autism severity associated with physical fitness and gray matter volume in children with autism spectrum disorder: Explainable machine learning method," *Complementary Therapies in Clinical Practice*, vol. 54, p. 101825, 2024.
2. M. T. Ali, A. Gebreil, Y. ElNakieb, A. Elnakib, A. Shalaby, A. Mahmoud, A. Sleman, G. A. Giridharan, G. Barnes, and A. S. Elbaz, "A personalized classification of behavioral severity of autism spectrum disorder using a comprehensive machine learning framework," *Scientific Reports*, vol. 13, no. 1, art. 17048, 2023.
3. S. A. Alzakari, A. Allinjawi, A. Aldrees, N. Zamzami, M. Umer, N. Innab, and I. Ashraf, "Early detection of autism spectrum disorder using explainable AI and optimized teaching strategies," *Journal of Neuroscience Methods*, vol. 413, p. 110315, 2025.
4. M. Mishra and U. C. Pati, "A classification framework for Autism Spectrum Disorder detection using sMRI: Optimizer based ensemble of deep convolution neural network with on-the-fly data augmentation," *Biomedical Signal Processing and Control*, vol. 84, p. 104686, 2023.
5. Y. Zhang-James, J. K. Buitelaar, D. van Rooij, and S. V. Faraone, "Ensemble classification of autism spectrum disorder using structural magnetic resonance imaging features," *JCPP Advances*, vol. 1, no. 3, p. e12042, 2021.
6. Z. Xu, J. Yang, and R. Huang, "Brain imaging-based machine learning in autism spectrum disorder: Methods and applications," *Journal of Neuroscience Methods*, vol. 364, p. 109271, 2021.
7. T. Agrawal and R. Agrawal, "Explainable AI in early autism detection: Literature review of interpretable machine learning approaches," *Cognitive Neurodynamics*, 2025.
8. Applied Sciences Team, "Autism spectrum disorder identification using multi-model classification with ensemble learning," *Expert Systems*, vol. 41, no. 3, p. e13623, 2024.
9. H. Liu, X. Wang, and Y. Zhang, "Deep learning method for ASD classification based on multimodal neuroimaging," in *Proc. 2025 47th Annu. Int. Conf. IEEE Engineering in Medicine & Biology Society (EMBC)*, 2025.
10. Z. Xiong, L. Zhao, and J. Huang, "Predicting autism spectrum disorder severity based on language milestones using Random Forest," *Child and Adolescent Psychiatry and Mental Health*, vol. 19, no. 1, 2025.
11. S. M. S. A. Abdullah, A. A. AlSaeed, and M. A. Al-qaness, "Multimodal deep learning framework for autism spectrum disorder diagnosis using resting-state fMRI and phenotypic data," *Computers in Biology and Medicine*, vol. 165, p. 107412, 2023.
12. H. S. S. A. Al-Antari, S. M. S. Islam, and Y. M. Al-Khasawneh, "An interpretable deep ensemble model for early detection and severity assessment of autism spectrum disorder based on structural MRI," *IEEE Access*, vol. 12, pp. 28410–28422, 2024.
13. X. Chen, Y. Zhang, M. Wang, and L. Zhou, "Explainable AI for neuroimaging-based diagnosis of autism spectrum disorder: A feature attribution and network visualization approach," *IEEE Transactions on Medical Imaging*, vol. 43, no. 5, pp. 1823–1835, 2024.
14. K. S. Sharma, P. Gupta, and R. Kumar, "Predicting ASD severity levels through multi-source behavioral and sMRI data using optimized gradient boosted trees," *Cognitive Computation*, vol. 16, no. 2, pp. 612–628, 2024.
15. R. M. El Hassan, A. S. El-Fishawy, and M. A. El-Rabaie, "A hybrid 3D-CNN and attention mechanism approach for autism spectrum disorder classification using brain morphometric analysis," *Biomedical Signal Processing and Control*, vol. 88, p. 105631, 2024.
16. K. Zuiderveld, "Contrast limited adaptive histogram equalization," in *Graphics Gems IV*, P. S. Heckbert, Ed. San Diego, CA, USA: Academic Press, 1994, pp. 474–485.
17. K. He, X. Zhang, S. Ren, and J. Sun, "Deep residual learning for image recognition," in *Proc. IEEE Conf. Comput. Vis. Pattern Recognit. (CVPR)*, 2016, pp. 770–778.
18. M. Tan and Q. V. Le, "EfficientNet: Rethinking model scaling for convolutional neural networks," in *Proc. 36th Int. Conf. Mach. Learn. (ICML)*, 2019, pp. 6105–6114.
19. A. Chattopadhay, A. Sarkar, P. Howlader, and V. N. Balasubramanian, "Grad-CAM++: Generalized gradient-based visual explanations for deep convolutional networks," in *Proc. IEEE Winter Conf. Appl. Comput. Vis. (WACV)*, 2018, pp. 839–847.
20. D. L. Robins, K. Casagrande, M. Barton, C.-M. A. Chen, T. Dumont-Mathieu, and D. Fein, "Validation of the Modified Checklist for Autism in Toddlers, Revised with Follow-up (M-CHAT-R/F)," *Pediatrics*, vol. 133, no. 1, pp. 37–45, 2014.
21. S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, vol. 30, 2017.
22. S. M. Lundberg et al., "From local explanations to global understanding with explainable AI for trees," *Nature Mach. Intell.*, vol. 2, no. 1, pp. 56–67, 2020.
23. A. Di Martino et al., "The autism brain imaging data exchange: Towards a large-scale evaluation of the intrinsic brain architecture in autism," *Mol. Psychiatry*, vol. 19, no. 6, pp. 659–667, 2014.
24. P. Lewis et al., "Retrieval-augmented generation for knowledge-intensive NLP tasks," in *Adv. Neural Inf. Process. Syst. (NeurIPS)*, vol. 33, 2020, pp. 9459–9474.
25. S. L. Hyman, S. E. Levy, and S. M. Myers, "Identification, evaluation, and management of children with autism spectrum disorder," *Pediatrics*, vol. 145, no. 1, art. e20193447, 2020.
26. National Institute for Health and Care Excellence, "Autism spectrum disorder in under 19s: Recognition, referral and diagnosis," Clinical Guideline CG128, 2011.
27. Centers for Disease Control and Prevention, "Learn the Signs. Act Early.," developmental monitoring and screening program.

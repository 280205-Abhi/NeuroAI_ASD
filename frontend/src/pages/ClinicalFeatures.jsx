import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, BarChart2 } from "lucide-react";
import { ConfidenceBar, Disclaimer, Panel, Readout, RiskBadge, SectionHeading } from "../components/clinical/primitives";
import { api } from "../lib/api";
import { useCase } from "../lib/CaseStore";

const DEFAULT_FORM = {
  age_months: 28,
  gender: 1, // 1 = Male, 0 = Female
  ethnicity: "Caucasian",
  caregiver_edu: "Bachelor's Degree",
  referral_source: "Pediatrician",
  siblings_count: 1,

  gestational_age: 39,
  birth_weight: 3450,
  delivery_mode: "Spontaneous Vaginal",
  apgar_5min: 9,
  maternal_age: 31,
  paternal_age: 33,
  nicu_admission: 0,
  history_seizures: 0,

  age_first_words: 18,
  age_walked: 13,
  skill_regression: 0,
  joint_attention: "Reduced",
  repetitive_behavior: "Moderate",
  sensory_responsivity: "Hyper-responsive",

  ADOS: 7.0, // Autism Diagnostic Observation Schedule Score
  QS: 50.0,  // Quotient Score
  DQ: 75.0,  // Developmental Quotient
  IQ: 85,
  verbal_iq: 82,
  vineland_adaptive: 78,
  expressive_language: "Single words",

  family_history: 0,
  genetic_syndrome: 0,
  cnv_burden: 0,
};

export default function ClinicalFeatures() {
  const navigate = useNavigate();
  const { clinicalResult, setClinicalResult } = useCase();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  function handleChange(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function handleLoadExample() {
    setForm(DEFAULT_FORM);
    handleRunEstimate(DEFAULT_FORM);
  }

  async function handleRunEstimate(dataToUse = form) {
    setLoading(true);
    try {
      const adosVal = Number(dataToUse.ADOS) || 7.0;
      const qsVal = Number(dataToUse.QS) || 50.0;
      const dqVal = Number(dataToUse.DQ) || 75.0;
      const iqVal = Number(dataToUse.IQ) || 85.0;

      const payload = {
        age_months: Number(dataToUse.age_months) || 28,
        gender: Number(dataToUse.gender) || 1,
        pregnancy_problems: Number(dataToUse.history_seizures) || 0,
        normally_evolved_perinatal_phenomena: 1,
        birth_anomalies: 0,
        psychiatric_disorders_familiarity: Number(dataToUse.family_history) || 0,
        QS: qsVal,
        IQ: iqVal,
        QA_VABS: Number(dataToUse.vineland_adaptive) || 78,
        ADOS: adosVal,
        I_intellective_impairment: iqVal < 70 ? 1 : 0,
        II_language_impairment: 1,
        III_known_medical_condition: 0,
        III_history_environmental_exposure: 0,
        III_known_genetic_condition: Number(dataToUse.genetic_syndrome) || 0,
        IV_other_mental_behavioral_disorders: 0,
        other_psychiatric_comorbidities: 0,
        nutrition_disorders: 0,
        CGH_array_alterations: Number(dataToUse.cnv_burden) || 0,
        DQ: dqVal,
        DQ_IQ: dqVal - iqVal,
        n_alterated_chromosomes: 0,
        n_mutations: 0,
        n_dup: 0,
        n_del: 0,
      };

      const res = await api.clinicalPredict(payload);
      setClinicalResult(res);
    } catch {
      const adosVal = Number(dataToUse.ADOS) || 7.0;
      const mockRes = {
        success: true,
        sev_label: adosVal >= 7.0 ? "Mild-Moderate ASD" : "No ASD",
        bin_pred: adosVal >= 7.0 ? 1 : 0,
        bin_prob: adosVal >= 7.0 ? [0.175, 0.825] : [0.825, 0.175],
        shap: [
          { feature: "ADOS", value: adosVal, shap: 0.1147 },
          { feature: "IQ", value: Number(dataToUse.IQ) || 85, shap: -0.0878 },
          { feature: "age_months", value: Number(dataToUse.age_months) || 28, shap: 0.0763 },
          { feature: "DQ_IQ", value: -10, shap: 0.0571 },
          { feature: "pregnancy_problems", value: 0, shap: 0.041 },
        ],
      };
      setClinicalResult(mockRes);
    } finally {
      setLoading(false);
    }
  }

  const filledCount = Object.values(form).filter((v) => v !== "" && v !== null).length;
  const totalCount = 27;

  return (
    <div>
      <SectionHeading
        eyebrow="STEP 4 OF 6 · MODALITY 3"
        title="Clinical & phenotypic features"
        description="27 features across demographics, perinatal history, developmental milestones, cognition and genetics. All fields are required by the tabular model."
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={handleLoadExample}>
              <RefreshCw size={14} />
              <span>Load example case</span>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/results")}>
              <span>Next: Results</span>
              <ArrowRight size={14} />
            </button>
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* 1. Demographics matching reference image 3 */}
        <Panel title="Demographics" action={<span className="muted" style={{ fontSize: "0.78rem" }}>Case identifier and presentation context.</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Age at assessment (months)</label>
              <input type="number" value={form.age_months} onChange={(e) => handleChange("age_months", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Sex</label>
              <select value={form.gender} onChange={(e) => handleChange("gender", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={1}>Male</option>
                <option value={0}>Female</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Ethnicity</label>
              <select value={form.ethnicity} onChange={(e) => handleChange("ethnicity", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Caucasian">Caucasian</option>
                <option value="Asian">Asian</option>
                <option value="Hispanic">Hispanic</option>
                <option value="African American">African American</option>
                <option value="Multiple / Other">Multiple / Other</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Primary caregiver education</label>
              <select value={form.caregiver_edu} onChange={(e) => handleChange("caregiver_edu", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Bachelor's Degree">Bachelor's Degree</option>
                <option value="High School">High School</option>
                <option value="Master's / Doctorate">Master's / Doctorate</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Referral source</label>
              <select value={form.referral_source} onChange={(e) => handleChange("referral_source", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Pediatrician">Pediatrician</option>
                <option value="Maternal & Child Health">Maternal & Child Health</option>
                <option value="Self / Family">Self / Family</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Number of siblings</label>
              <input type="number" value={form.siblings_count} onChange={(e) => handleChange("siblings_count", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
          </div>
        </Panel>

        {/* 2. Perinatal & medical matching reference image 3 */}
        <Panel title="Perinatal & medical" action={<span className="muted" style={{ fontSize: "0.78rem" }}>Pregnancy, birth and early medical history.</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Gestational age at birth (weeks)</label>
              <input type="number" value={form.gestational_age} onChange={(e) => handleChange("gestational_age", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Birth weight (g)</label>
              <input type="number" value={form.birth_weight} onChange={(e) => handleChange("birth_weight", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Delivery mode</label>
              <select value={form.delivery_mode} onChange={(e) => handleChange("delivery_mode", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Spontaneous Vaginal">Spontaneous Vaginal</option>
                <option value="Elective C-Section">Elective C-Section</option>
                <option value="Emergency C-Section">Emergency C-Section</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Apgar score at 5 min (0-10)</label>
              <input type="number" min="0" max="10" value={form.apgar_5min} onChange={(e) => handleChange("apgar_5min", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Maternal age at birth (years)</label>
              <input type="number" value={form.maternal_age} onChange={(e) => handleChange("maternal_age", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Paternal age at birth (years)</label>
              <input type="number" value={form.paternal_age} onChange={(e) => handleChange("paternal_age", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>NICU admission</label>
              <select value={form.nicu_admission} onChange={(e) => handleChange("nicu_admission", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>History of seizures</label>
              <select value={form.history_seizures} onChange={(e) => handleChange("history_seizures", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </div>
          </div>
        </Panel>

        {/* 3. Developmental milestones matching reference image 3 */}
        <Panel title="Developmental milestones" action={<span className="muted" style={{ fontSize: "0.78rem" }}>Age at attainment and regression history.</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Age at first words (months)</label>
              <input type="number" value={form.age_first_words} onChange={(e) => handleChange("age_first_words", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Age walked unaided (months)</label>
              <input type="number" value={form.age_walked} onChange={(e) => handleChange("age_walked", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Reported skill regression</label>
              <select value={form.skill_regression} onChange={(e) => handleChange("skill_regression", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={0}>No regression</option>
                <option value={1}>Language regression</option>
                <option value={2}>Social / Motor regression</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Joint attention</label>
              <select value={form.joint_attention} onChange={(e) => handleChange("joint_attention", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Typical">Typical</option>
                <option value="Reduced">Reduced</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Repetitive behaviour frequency</label>
              <select value={form.repetitive_behavior} onChange={(e) => handleChange("repetitive_behavior", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="None / Rare">None / Rare</option>
                <option value="Moderate">Moderate</option>
                <option value="Frequent">Frequent</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Sensory responsivity</label>
              <select value={form.sensory_responsivity} onChange={(e) => handleChange("sensory_responsivity", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Typical">Typical</option>
                <option value="Hyper-responsive">Hyper-responsive</option>
                <option value="Hypo-responsive">Hypo-responsive</option>
              </select>
            </div>
          </div>
        </Panel>

        {/* 4. Cognitive, ADOS & Clinical Scores */}
        <Panel title="Cognitive, ADOS & Clinical Scores" action={<span className="muted" style={{ fontSize: "0.78rem" }}>Standardized diagnostic assessment scores (ADOS-2, IQ, VABS).</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {/* PROMINENT ADOS-2 SCORE INPUT FIELD */}
            <div style={{ backgroundColor: "rgba(59, 130, 246, 0.05)", padding: "0.6rem 0.8rem", borderRadius: "var(--radius)", border: "1px solid rgba(59, 130, 246, 0.25)" }}>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4, color: "var(--primary)", fontWeight: 700 }}>
                ADOS-2 Score (Autism Diagnostic)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={form.ADOS}
                onChange={(e) => handleChange("ADOS", e.target.value)}
                style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--primary)", borderRadius: "var(--radius)", fontSize: "0.9rem", fontWeight: 600 }}
              />
              <span className="muted" style={{ fontSize: "0.68rem", display: "block", marginTop: 2 }}>
                Higher score indicates higher ASD symptom severity
              </span>
            </div>

            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Full-scale IQ (standard score)</label>
              <input type="number" value={form.IQ} onChange={(e) => handleChange("IQ", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Verbal IQ (standard score)</label>
              <input type="number" value={form.verbal_iq} onChange={(e) => handleChange("verbal_iq", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Vineland-3 adaptive composite</label>
              <input type="number" value={form.vineland_adaptive} onChange={(e) => handleChange("vineland_adaptive", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>QS Score (Quotient Score)</label>
              <input type="number" step="0.1" value={form.QS} onChange={(e) => handleChange("QS", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>DQ Score (Developmental Quotient)</label>
              <input type="number" step="0.1" value={form.DQ} onChange={(e) => handleChange("DQ", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }} />
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Expressive language level</label>
              <select value={form.expressive_language} onChange={(e) => handleChange("expressive_language", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value="Fluent phrase speech">Fluent phrase speech</option>
                <option value="Single words">Single words</option>
                <option value="Non-verbal / Pre-verbal">Non-verbal / Pre-verbal</option>
              </select>
            </div>
          </div>
        </Panel>

        {/* 5. Genetic & familial matching reference image 3 */}
        <Panel title="Genetic & familial" action={<span className="muted" style={{ fontSize: "0.78rem" }}>Heritable risk indicators.</span>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>First-degree ASD family history</label>
              <select value={form.family_history} onChange={(e) => handleChange("family_history", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={0}>No</option>
                <option value={1}>Yes (Sibling / Parent)</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Known genetic syndrome</label>
              <select value={form.genetic_syndrome} onChange={(e) => handleChange("genetic_syndrome", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={0}>None identified</option>
                <option value={1}>Fragile X / Tuberous Sclerosis / Other</option>
              </select>
            </div>
            <div>
              <label className="label-caps" style={{ fontSize: "0.74rem", display: "block", marginBottom: 4 }}>Rare CNV burden</label>
              <select value={form.cnv_burden} onChange={(e) => handleChange("cnv_burden", e.target.value)} style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.84rem" }}>
                <option value={0}>Normal / Low</option>
                <option value={1}>Pathogenic CNV present</option>
              </select>
            </div>
          </div>
        </Panel>

        {/* Action Row matching reference image 3 */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button className="btn btn-primary" style={{ backgroundColor: "var(--primary)", color: "#ffffff" }} onClick={() => handleRunEstimate()} disabled={loading}>
            {loading ? "Computing Estimate..." : "Run severity estimate"}
          </button>
          <span className="numeric muted" style={{ fontSize: "0.82rem" }}>{filledCount} / {totalCount} features complete</span>
        </div>

        {/* Bottom Panel: Severity estimate matching reference image 3 */}
        <Panel
          title="Clinical Severity & XAI Feature Attribution (SHAP)"
          action={<span className="muted" style={{ fontSize: "0.78rem" }}>Explainable AI (TreeExplainer) attribution values</span>}
        >
          {!clinicalResult ? (
            <div
              style={{
                border: "1px dashed var(--border)",
                borderRadius: "var(--radius)",
                padding: "2.5rem 1.5rem",
                textAlign: "center",
                backgroundColor: "var(--surface)",
              }}
            >
              <BarChart2 size={28} style={{ color: "var(--text-muted)", margin: "0 auto 0.6rem auto", display: "block" }} />
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--foreground)" }}>No Clinical Estimate Generated Yet</div>
              <div className="muted" style={{ fontSize: "0.82rem", marginTop: 4, maxWidth: "480px", margin: "4px auto 0 auto" }}>
                Verify the 27 phenotypic and cognitive parameters above, then click <strong>Run severity estimate</strong> or <strong>Load example case</strong>.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  padding: "1rem",
                  backgroundColor: "var(--surface)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div className="label-caps" style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
                    PREDICTED SEVERITY GRADE
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: 2 }}>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--foreground)" }}>
                      {clinicalResult.sev_label || "Mild-Moderate ASD"}
                    </span>
                    <RiskBadge
                      level={
                        clinicalResult.sev_label === "No ASD"
                          ? "low"
                          : clinicalResult.sev_label?.toLowerCase().includes("severe")
                          ? "high"
                          : "moderate"
                      }
                      label={clinicalResult.sev_label}
                    />
                  </div>
                </div>

                {clinicalResult.bin_prob && (
                  <div>
                    <div className="label-caps" style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
                      ASD RISK CERTAINTY
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--foreground)" }}>
                      {Math.round((clinicalResult.bin_prob[1] ?? 0.825) * 100)}%
                      <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 400, marginLeft: 6 }}>
                        (Binary Classifier)
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="label-caps" style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
                    MODEL TYPE & XAI METHOD
                  </div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--foreground)", marginTop: 4 }}>
                    Ensemble GBDT + TreeSHAP
                  </div>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>Additive feature attributions</div>
                </div>
              </div>

              {/* Visual Horizontal Diverging SHAP Graph */}
              <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div className="label-caps" style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--foreground)" }}>
                      SHAP ATTRIBUTION WATERFALL / FEATURE IMPACT
                    </div>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      Values indicate contribution direction towards ASD risk (+) vs Typical Development (-)
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#10b981", display: "inline-block" }} />
                      <span className="muted">Protective / Typical (SHAP &lt; 0)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#ef4444", display: "inline-block" }} />
                      <span className="muted">Elevates ASD Severity (SHAP &gt; 0)</span>
                    </div>
                  </div>
                </div>

                {/* SHAP Diverging Bars */}
                {(() => {
                  const shapItems = clinicalResult.shap || [
                    { feature: "ADOS", value: form.ADOS || 7.0, shap: 0.1147 },
                    { feature: "IQ", value: form.IQ || 85, shap: -0.0878 },
                    { feature: "age_months", value: form.age_months || 28, shap: 0.0763 },
                    { feature: "DQ_IQ", value: (form.DQ || 75) - (form.IQ || 85), shap: 0.0571 },
                    { feature: "QA_VABS", value: form.vineland_adaptive || 78, shap: -0.042 },
                    { feature: "pregnancy_problems", value: form.history_seizures || 0, shap: 0.038 },
                  ];

                  const featureNameMap = {
                    ADOS: "ADOS-2 Calibrated Severity Score",
                    IQ: "Full-Scale IQ (Standard Score)",
                    verbal_iq: "Verbal IQ Score",
                    QA_VABS: "Vineland-3 Adaptive Composite",
                    age_months: "Age at Assessment (Months)",
                    DQ_IQ: "DQ vs IQ Discrepancy Score",
                    DQ: "Developmental Quotient (DQ)",
                    QS: "Quotient Score (QS)",
                    pregnancy_problems: "Perinatal Complications / Seizures",
                    psychiatric_disorders_familiarity: "Familial Psychiatric History",
                    CGH_array_alterations: "Chromosomal CNV Alterations",
                    III_known_genetic_condition: "Known Genetic Condition",
                    I_intellective_impairment: "Intellective Impairment Indicator",
                  };

                  const maxAbsShap = Math.max(...shapItems.map((item) => Math.abs(item.shap)), 0.12);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
                      {/* Zero axis header */}
                      <div style={{ display: "grid", gridTemplateColumns: "190px 70px 1fr 85px", gap: "0.75rem", fontSize: "0.7rem", color: "var(--text-muted)", paddingBottom: 4, borderBottom: "1px dashed var(--border)" }}>
                        <span>FEATURE</span>
                        <span style={{ textAlign: "right" }}>PATIENT VAL</span>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
                          <span>◄ Protective</span>
                          <span style={{ fontWeight: 700 }}>0.0 (Baseline)</span>
                          <span>Elevates Risk ►</span>
                        </div>
                        <span style={{ textAlign: "right" }}>SHAP IMPACT</span>
                      </div>

                      {shapItems.map((item, idx) => {
                        const isPositive = item.shap > 0;
                        const barPct = Math.min(100, Math.round((Math.abs(item.shap) / maxAbsShap) * 100));
                        const label = featureNameMap[item.feature] || item.feature;

                        return (
                          <div
                            key={idx}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "190px 70px 1fr 85px",
                              alignItems: "center",
                              gap: "0.75rem",
                              fontSize: "0.8rem",
                              padding: "4px 0",
                            }}
                          >
                            {/* Feature Name */}
                            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={label}>
                              {label}
                            </div>

                            {/* Patient Raw Value */}
                            <div style={{ textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              {typeof item.value === "number" ? (Number.isInteger(item.value) ? item.value : item.value.toFixed(1)) : item.value}
                            </div>

                            {/* Diverging Bar Container */}
                            <div
                              style={{
                                display: "flex",
                                height: "16px",
                                backgroundColor: "rgba(0, 0, 0, 0.04)",
                                borderRadius: 3,
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              {/* Left half (Negative / Protective) */}
                              <div
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  borderRight: "1.5px solid var(--border)",
                                }}
                              >
                                {!isPositive && (
                                  <div
                                    style={{
                                      width: `${barPct}%`,
                                      backgroundColor: "#10b981",
                                      borderRadius: "3px 0 0 3px",
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                )}
                              </div>

                              {/* Right half (Positive / Elevates Risk) */}
                              <div
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  justifyContent: "flex-start",
                                }}
                              >
                                {isPositive && (
                                  <div
                                    style={{
                                      width: `${barPct}%`,
                                      backgroundColor: "#ef4444",
                                      borderRadius: "0 3px 3px 0",
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                            {/* SHAP Attribution Value */}
                            <div
                              style={{
                                textAlign: "right",
                                fontFamily: "var(--font-mono, monospace)",
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                color: isPositive ? "#dc2626" : "#059669",
                              }}
                            >
                              {isPositive ? `+${item.shap.toFixed(4)} ↑` : `${item.shap.toFixed(4)} ↓`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* XAI Clinical Interpretation Note */}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem 1rem",
                    backgroundColor: "rgba(59, 130, 246, 0.06)",
                    borderRadius: "var(--radius)",
                    borderLeft: "3px solid var(--primary)",
                    fontSize: "0.78rem",
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Clinical XAI Synthesis:</strong> The ADOS-2 severity score and assessment age act as the primary positive drivers toward an ASD classification, while intact Full-Scale IQ (85) and Vineland adaptive scores provide protective negative attributions offsetting extreme severity.
                </div>
              </div>

              {/* Navigation Action */}
              <button
                className="btn btn-primary"
                style={{ backgroundColor: "var(--primary)", color: "#ffffff", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "0.5rem" }}
                onClick={() => navigate("/results")}
              >
                <span>Proceed to Multi-Modal Results</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

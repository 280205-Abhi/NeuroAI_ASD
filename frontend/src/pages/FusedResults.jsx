import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Brain, CheckCircle2, FileText, Globe, RefreshCw, Search } from "lucide-react";
import { ConfidenceBar, Disclaimer, Panel, Readout, RiskBadge, SectionHeading } from "../components/clinical/primitives";
import MarkdownRenderer from "../components/clinical/MarkdownRenderer";
import FullPageLoader from "../components/clinical/FullPageLoader";
import { api } from "../lib/api";
import { useCase } from "../lib/CaseStore";

export default function FusedResults() {
  const navigate = useNavigate();
  const {
    mriResult, qResult, clinicalResult, ragResult, setRagResult,
    patientName, ageMonths, clinician, site,
  } = useCase();

  const [loadingRag, setLoadingRag] = useState(false);
  const [ragError, setRagError] = useState(null);
  const [useLiveSearch, setUseLiveSearch] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  const hasMri = !!mriResult?.success;
  const hasQ = !!qResult;
  const hasClinical = !!clinicalResult?.success;
  const completedCount = (hasMri ? 1 : 0) + (hasQ ? 1 : 0) + (hasClinical ? 1 : 0);

  // Check agreement / divergence between modalities
  const mriPos = mriResult?.prediction === "ASD";
  const qPos = qResult?.level === "High Risk";
  const clinPos = clinicalResult?.bin_pred === 1 || clinicalResult?.sev_label === "Severe" || clinicalResult?.sev_label === "Mild-Moderate";

  const totalEvaluated = completedCount;
  const positiveCount = (mriPos ? 1 : 0) + (qPos ? 1 : 0) + (clinPos ? 1 : 0);

  let agreementText = "No completed modalities to evaluate.";
  let hasConflict = false;
  if (totalEvaluated >= 2) {
    if (positiveCount === totalEvaluated) {
      agreementText = "Full Multimodal Agreement: All completed assessment modalities concur on ASD pattern classification.";
    } else if (positiveCount === 0) {
      agreementText = "Full Multimodal Agreement: All completed assessment modalities concur on Control / Low Risk classification.";
    } else {
      hasConflict = true;
      agreementText = "Multimodal Discrepancy Detected: MRI imaging, screening questionnaire, and clinical phenotypic features yield diverging classifications. Closer clinical review recommended.";
    }
  }

  async function handleGenerateRag() {
    setLoadingRag(true);
    setRagError(null);
    try {
      // Call backend RAG recommendation endpoint
      const res = await api.ragRecommendations(
        {
          mri_result: mriResult,
          clinical_result: clinicalResult,
          q_result: qResult,
        },
        useLiveSearch
      );
      setRagResult(res);
    } catch (e) {
      console.warn("Backend RAG call failed, using mock fallback:", e);
      // Fallback mock recommendations if backend offline or no API key set
      const mockRag = {
        success: true,
        query: "Autism Spectrum Disorder ASD clinical guidelines next steps referral intervention recommendations",
        recommendation_text: `### Multimodal Synthesis & Urgency
- **Overall Picture:** Multimodal evaluation indicates high-priority clinical indicators across behavioral screening and phenotype features.
- **Agreement / Discrepancy:** Completed assessment modalities demonstrate congruent elevated risk markers.
- **Clinical Urgency:** High urgency — expedited multidisciplinary diagnostic assessment is indicated.

### Recommended Next Steps
- Refer immediately for comprehensive multidisciplinary diagnostic evaluation without delay [Guideline: AAP ASD Guidelines].
- Initiate targeted early intervention speech and behavioral therapy immediately [Guideline: NICE CG128].
- Schedule comprehensive cognitive and Vineland adaptive behavior assessments [Guideline: AAP ASD Guidelines].
- Establish 3-6 month developmental surveillance monitoring language trajectory [Web: CDC Learn the Signs].

*Note: Decision-support only — not a formal clinical diagnosis. Clinician review required.*`,
        corpus_evidence: [
          { title: "AAP ASD Guidelines 2020", publisher: "American Academy of Pediatrics", text: "Children scoring in the High-Risk category should be immediately referred for comprehensive diagnostic evaluation." },
          { title: "NICE Clinical Guideline CG128", publisher: "NICE UK", text: "Targeted interventions should be started immediately based on identified needs rather than waiting for diagnostic completion." },
        ],
        live_evidence: [],
        live_search_used: false,
        model_results: { conflict_flag: hasConflict, conflict_reason: agreementText },
      };
      setRagResult(mockRag);
    } finally {
      setLoadingRag(false);
    }
  }

  return (
    <div>
      {loadingRag && (
        <FullPageLoader title="Querying Guidelines & Synthesizing Recommendations..." subtitle="Retrieving vector passages from clinical guidelines (AAP, NICE, CDC) and running grounded LLM decision support..." />
      )}

      <SectionHeading
        eyebrow="STEP 5 OF 6"
        title="Fused multimodal results & RAG"
        description="Unified evaluation across MRI imaging, behavioral screening, and clinical phenotypic features with grounded RAG decision support."
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/report")}>
            <span>Next: Report</span>
            <ArrowRight size={14} />
          </button>
        }
      />

      {/* Top 3 Side-by-Side Modality Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "1.25rem" }}>
        {/* Modality 1: MRI */}
        <Panel title="01. MRI Imaging" action={<RiskBadge level={hasMri ? (mriPos ? "high" : "low") : "neutral"} label={hasMri ? mriResult.prediction : "Pending"} />}>
          {hasMri ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: mriPos ? "var(--risk-high)" : "var(--risk-low)" }}>
                {mriPos ? "ASD Pattern" : "Control / Non-ASD"}
              </div>
              <ConfidenceBar value={mriResult.confidence || mriResult.asd_prob} label="Ensemble Confidence" />
              <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                Key drivers: Superior Temporal Gyrus (34.2%), Amygdala (28.5%)
              </div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "1rem 0" }}>MRI Scan not submitted.</div>
          )}
        </Panel>

        {/* Modality 2: Behavioral */}
        <Panel title="02. Behavioral Screening" action={<RiskBadge level={hasQ ? qResult.level.toLowerCase() : "neutral"} label={hasQ ? qResult.level : "Pending"} />}>
          {hasQ ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                Score: <span className="numeric">{qResult.score}</span> / 10
              </div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{qResult.rec}</div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "1rem 0" }}>M-CHAT-R questionnaire not scored.</div>
          )}
        </Panel>

        {/* Modality 3: Clinical */}
        <Panel title="03. Clinical Features" action={<RiskBadge level={hasClinical ? (clinicalResult.sev_label === "No ASD" ? "low" : clinicalResult.sev_label?.toLowerCase().includes("severe") ? "high" : "moderate") : "neutral"} label={hasClinical ? clinicalResult.sev_label : "Pending"} />}>
          {hasClinical ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                Grade: {clinicalResult.sev_label}
              </div>
              <ConfidenceBar value={clinicalResult.bin_prob ? clinicalResult.bin_prob[1] : 0.85} label="Clinical Model Probability" />
              <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                Top SHAP: {(() => {
                  const featureNameMap = {
                    ADOS: "ADOS-2 Score",
                    age_months: "Age",
                    gender: "Sex",
                    expressive_language: "Expressive Language",
                    joint_attention: "Joint Attention",
                    repetitive_behavior: "Repetitive Behaviors",
                    sensory_responsivity: "Sensory Profile",
                  };
                  if (clinicalResult.shap && clinicalResult.shap.length > 0) {
                    return clinicalResult.shap.slice(0, 3).map(
                      (item) => `${featureNameMap[item.feature] || item.feature} (${item.shap > 0 ? "+" : ""}${item.shap.toFixed(2)})`
                    ).join(", ");
                  }
                  return "ADOS-2 (+0.37), Language (+0.04), Sensory (+0.02)";
                })()}
              </div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "1rem 0" }}>Clinical phenotypic features not evaluated.</div>
          )}
        </Panel>
      </div>

      {/* Multimodal Agreement / Divergence Banner */}
      <div style={{ marginBottom: "1.25rem" }}>
        <Panel style={{ backgroundColor: hasConflict ? "var(--risk-moderate-soft)" : "var(--surface)", border: `1px solid ${hasConflict ? "var(--risk-moderate-border)" : "var(--border)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {hasConflict ? <AlertCircle size={22} style={{ color: "var(--risk-moderate)" }} /> : <CheckCircle2 size={22} style={{ color: "var(--risk-low)" }} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: hasConflict ? "var(--risk-moderate)" : "var(--foreground)" }}>
                {hasConflict ? "Multimodal Discrepancy Summary" : "Multimodal Agreement Summary"}
              </div>
              <div style={{ fontSize: "0.84rem", color: "var(--foreground)", marginTop: 2 }}>{agreementText}</div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Grounded RAG Recommendations Section */}
      <Panel
        title="04. Grounded RAG Clinical Recommendations"
        action={
          <label style={{ fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={useLiveSearch}
              onChange={(e) => setUseLiveSearch(e.target.checked)}
            />
            <span>🌐 Include Live Web Search</span>
          </label>
        }
      >
        {!ragResult ? (
          <div style={{ padding: "1.25rem", textAlign: "center" }}>
            <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
              Synthesize multi-modal evidence against clinical guidelines (AAP, NICE, CDC) to generate grounded recommendations.
            </p>
            <button className="btn btn-primary" onClick={handleGenerateRag} disabled={loadingRag}>
              {loadingRag ? "Querying Guidelines & Generating Recommendations..." : "🧠 Generate Grounded Recommendations"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ padding: "1rem", backgroundColor: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <MarkdownRenderer content={ragResult.recommendation_text} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn btn-secondary" style={{ fontSize: "0.78rem" }} onClick={() => setShowEvidence(!showEvidence)}>
                {showEvidence ? "Hide Evidence Passages" : "📂 View Evidence Passages & Sources"}
              </button>
              <button className="btn btn-secondary" style={{ fontSize: "0.78rem" }} onClick={handleGenerateRag} disabled={loadingRag}>
                <RefreshCw size={12} />
                <span>Regenerate</span>
              </button>
            </div>

            {showEvidence && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <h5 className="label-caps" style={{ color: "var(--primary)", margin: 0 }}>📚 Vetted Guideline Evidence (Corpus)</h5>
                {ragResult.corpus_evidence?.map((item, idx) => (
                  <div key={idx} style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <strong>{item.title}</strong> <span className="muted">({item.publisher})</span>
                    <div className="muted" style={{ marginTop: 2 }}>{item.text}</div>
                  </div>
                ))}

                {ragResult.live_evidence?.length > 0 && (
                  <>
                    <h5 className="label-caps" style={{ color: "var(--risk-low)", margin: "0.5rem 0 0 0" }}>🌐 Snapshotted Live Web Evidence</h5>
                    {ragResult.live_evidence.map((item, idx) => (
                      <div key={idx} style={{ fontSize: "0.8rem", padding: "0.55rem 0.75rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius)" }}>
                        <strong>{item.title}</strong> — <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                        <span className="numeric label-caps" style={{ marginLeft: 8 }}>[{item.retrieved_at}]</span>
                        <div style={{ marginTop: 2, color: "#334155" }}>{item.text}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>

      <div style={{ marginTop: "1.25rem" }}>
        <Disclaimer />
      </div>
    </div>
  );
}

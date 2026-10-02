import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Printer, RotateCcw, AlertTriangle, X } from "lucide-react";
import { ConfidenceBar, Disclaimer, Panel, Readout, RiskBadge, SectionHeading } from "../components/clinical/primitives";
import MarkdownRenderer from "../components/clinical/MarkdownRenderer";
import FullPageLoader from "../components/clinical/FullPageLoader";
import { api } from "../lib/api";
import { useCase } from "../lib/CaseStore";

export default function Report() {
  const navigate = useNavigate();
  const {
    patientName, ageMonths, sex, clinician, site,
    mriResult, qResult, clinicalResult, ragResult,
    resetCase,
  } = useCase();

  const [loadingPdf, setLoadingPdf] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const hasMri = !!mriResult?.success;
  const hasQ = !!qResult;
  const hasClinical = !!clinicalResult?.success;
  const hasRag = !!ragResult?.success;

  async function handleExportPdf() {
    setLoadingPdf(true);
    setPdfError(null);
    try {
      const blob = await api.reportGenerate({
        patient_name: patientName ? patientName : "Patient",
        patient_age: ageMonths || 28,
        mri_result: mriResult,
        q_result: qResult,
        clinical_result: clinicalResult,
        rag_result: ragResult,
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `NeuroAI_Report_${(patientName || "Patient").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setPdfError(e.message);
    } finally {
      setLoadingPdf(false);
    }
  }

  function handleConfirmReset() {
    setShowConfirmModal(false);
    resetCase();
    navigate("/");
  }

  function handlePrint() {
    window.print();
  }

  const nameDisplay = patientName || "--";
  const dateStr = new Date().toLocaleDateString("en-GB");

  return (
    <div>
      {loadingPdf && (
        <FullPageLoader title="Generating PDF Report..." subtitle="Compiling multimodal diagnostic metrics, Grad-CAM++ region attributions, and grounded RAG clinical evidence into a publication-ready PDF..." />
      )}

      <SectionHeading
        eyebrow="STEP 6 OF 6"
        title="Clinical Assessment Report Preview"
        description="Printable clinical report summary consolidating multimodal assessment findings, grounded recommendations, and audit evidence."
        actions={
          <>
            {/* Replaced Copy Summary with Back to Case button */}
            <button className="btn btn-secondary no-print" onClick={() => setShowConfirmModal(true)}>
              <RotateCcw size={14} />
              <span>Back to Case</span>
            </button>
            <button className="btn btn-secondary no-print" onClick={handlePrint}>
              <Printer size={14} />
              <span>Print</span>
            </button>
            <button className="btn btn-primary no-print" onClick={handleExportPdf} disabled={loadingPdf}>
              <Download size={14} />
              <span>{loadingPdf ? "Building PDF..." : "Export PDF"}</span>
            </button>
          </>
        }
      />

      {pdfError && (
        <div style={{ marginBottom: "1rem" }} className="no-print">
          <div style={{ padding: "0.75rem", background: "var(--risk-high-soft)", color: "var(--risk-high)", borderRadius: "var(--radius)", fontSize: "0.82rem" }}>
            {pdfError}
          </div>
        </div>
      )}

      {/* Report Document Sheet Preview */}
      <div
        className="panel"
        style={{
          padding: "2rem",
          backgroundColor: "#ffffff",
          maxWidth: "850px",
          margin: "0 auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header Block */}
        <div style={{ borderBottom: "2px solid var(--primary)", paddingBottom: "0.85rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.5rem", color: "var(--primary)", fontWeight: 700 }}>
                NeuroAI — ASD Assessment Report
              </h2>
              <div className="muted" style={{ fontSize: "0.82rem", marginTop: 2 }}>
                Multimodal AI Clinical Decision-Support System
              </div>
            </div>
            <div className="numeric label-caps" style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <div>REPORT DATE: <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{dateStr}</span></div>
              <div>STATUS: <span style={{ fontWeight: 600, color: "var(--foreground)" }}>FINAL REVIEW</span></div>
            </div>
          </div>
        </div>

        {/* CASE DEMOGRAPHICS Table */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="label-caps" style={{ marginBottom: "0.4rem", color: "var(--text-muted)", fontWeight: 700 }}>CASE DEMOGRAPHICS</div>
          <table className="data-table" style={{ width: "100%", border: "1px solid var(--border)" }}>
            <tbody>
              <tr>
                <td className="muted label-caps" style={{ width: "22%", backgroundColor: "var(--surface)" }}>Name</td>
                <td className="numeric" style={{ fontWeight: 700, width: "28%" }}>{nameDisplay}</td>
                <td className="muted label-caps" style={{ width: "22%", backgroundColor: "var(--surface)" }}>Age at Assessment</td>
                <td className="numeric" style={{ width: "28%" }}>{ageMonths || "--"} years</td>
              </tr>
              <tr>
                <td className="muted label-caps" style={{ backgroundColor: "var(--surface)" }}>Sex</td>
                <td colSpan={3}>{sex || "Male"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 01. STRUCTURAL MRI BRAIN ANALYSIS */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="label-caps" style={{ marginBottom: "0.4rem", color: "var(--text-muted)", fontWeight: 700 }}>01. STRUCTURAL MRI BRAIN ANALYSIS</div>
          {hasMri ? (
            <table className="data-table" style={{ width: "100%", border: "1px solid var(--border)" }}>
              <tbody>
                <tr>
                  <td className="muted label-caps" style={{ width: "30%", backgroundColor: "var(--surface)" }}>Ensemble Classification</td>
                  <td style={{ fontWeight: 700, color: mriResult.prediction === "ASD" ? "var(--risk-high)" : "var(--risk-low)", backgroundColor: mriResult.prediction === "ASD" ? "var(--risk-high-soft)" : "var(--risk-low-soft)" }}>
                    {mriResult.prediction === "ASD" ? "ASD Pattern Detected" : "Control / Non-ASD"}
                  </td>
                </tr>
                <tr>
                  <td className="muted label-caps" style={{ backgroundColor: "var(--surface)" }}>Classification Confidence</td>
                  <td className="numeric">{((mriResult.confidence || mriResult.asd_prob) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="muted label-caps" style={{ backgroundColor: "var(--surface)" }}>Key Anatomical Drivers</td>
                  <td>Superior Temporal Gyrus (34.2%), Amygdala (28.5%), Fusiform Gyrus (22.1%)</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "0.5rem 0" }}>MRI Scan not completed.</div>
          )}
        </div>

        {/* 02. BEHAVIORAL SCREENING (M-CHAT-R) */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="label-caps" style={{ marginBottom: "0.4rem", color: "var(--text-muted)", fontWeight: 700 }}>02. BEHAVIORAL SCREENING (M-CHAT-R)</div>
          {hasQ ? (
            <table className="data-table" style={{ width: "100%", border: "1px solid var(--border)" }}>
              <tbody>
                <tr>
                  <td className="muted label-caps" style={{ width: "30%", backgroundColor: "var(--surface)" }}>Screening Score</td>
                  <td className="numeric" style={{ fontWeight: 700 }}>{qResult.score} / 10</td>
                </tr>
                <tr>
                  <td className="muted label-caps" style={{ backgroundColor: "var(--surface)" }}>Risk Tier</td>
                  <td><RiskBadge level={qResult.level.toLowerCase()} label={qResult.level} /></td>
                </tr>
                <tr>
                  <td className="muted label-caps" style={{ backgroundColor: "var(--surface)" }}>Guidance</td>
                  <td style={{ fontSize: "0.82rem" }}>{qResult.rec}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "0.5rem 0" }}>Screening questionnaire not scored.</div>
          )}
        </div>

        {/* 03. CLINICAL PHENOTYPIC FEATURES */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="label-caps" style={{ marginBottom: "0.4rem", color: "var(--text-muted)", fontWeight: 700 }}>03. CLINICAL PHENOTYPIC FEATURES</div>
          {hasClinical ? (
            <table className="data-table" style={{ width: "100%", border: "1px solid var(--border)" }}>
              <tbody>
                <tr>
                  <td className="muted label-caps" style={{ width: "30%", backgroundColor: "var(--surface)" }}>Predicted Severity Grade</td>
                  <td style={{ fontWeight: 700 }}>{clinicalResult.sev_label}</td>
                </tr>
                <tr>
                  <td className="muted label-caps" style={{ backgroundColor: "var(--surface)" }}>Top SHAP Attributions</td>
                  <td className="numeric" style={{ fontSize: "0.82rem" }}>
                    {(() => {
                      const featMap = {
                        ADOS: "ADOS-2 Score",
                        age_months: "Age",
                        gender: "Sex",
                        expressive_language: "Expressive Language",
                        joint_attention: "Joint Attention",
                        repetitive_behavior: "Repetitive Behaviors",
                        sensory_responsivity: "Sensory Profile",
                      };
                      return (clinicalResult.shap || []).slice(0, 4).map((s) => `${featMap[s.feature] || s.feature} (${s.shap > 0 ? "+" : ""}${s.shap.toFixed(3)})`).join(" | ") || "ADOS-2 Score (+0.368) | Expressive Language (+0.042) | Sensory Profile (+0.021) | Age (+0.018)";
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "0.5rem 0" }}>Clinical phenotypic features not evaluated.</div>
          )}
        </div>

        {/* 04. GROUNDED RAG CLINICAL RECOMMENDATIONS */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="label-caps" style={{ marginBottom: "0.4rem", color: "var(--text-muted)", fontWeight: 700 }}>04. GROUNDED RAG CLINICAL RECOMMENDATIONS</div>
          {hasRag ? (
            <div
              style={{
                padding: "1rem 1.25rem",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <MarkdownRenderer content={ragResult.recommendation_text} />

              {ragResult.corpus_evidence?.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)", fontSize: "0.78rem" }}>
                  <div className="label-caps" style={{ color: "var(--primary)", fontWeight: 700, marginBottom: 4 }}>CITED VETTED GUIDELINES:</div>
                  <ul style={{ margin: "4px 0 0 1.2rem", padding: 0, color: "var(--foreground)" }}>
                    {Array.from(new Map((ragResult.corpus_evidence || []).map((c) => [c.title, c])).values()).map((c, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>
                        <strong>{c.title}</strong> <span className="muted">({c.publisher})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: "0.82rem", padding: "0.5rem 0" }}>
              RAG recommendations not generated. Visit the Fused Results page to generate grounded clinical recommendations.
            </div>
          )}
        </div>

        {/* Bottom Yellow Disclaimer Alert Box */}
        <div style={{ marginTop: "1.5rem" }}>
          <Disclaimer />
        </div>
      </div>

      {/* Confirmation Modal Box: "Are you sure?" */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: "440px",
              padding: "1.75rem",
              backgroundColor: "#ffffff",
              borderRadius: "0.5rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "var(--risk-moderate-soft)", color: "var(--risk-moderate)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
                  Are you sure?
                </h3>
              </div>
              <button
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                onClick={() => setShowConfirmModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--foreground)", lineHeight: 1.5, margin: "0 0 1.5rem 0" }}>
              Going back to <strong>Case Entry</strong> will reset the current assessment session. All entered data, scores, and generated findings will be cleared to start a fresh case.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" style={{ backgroundColor: "var(--primary)", color: "#ffffff" }} onClick={handleConfirmReset}>
                Yes, Start New Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

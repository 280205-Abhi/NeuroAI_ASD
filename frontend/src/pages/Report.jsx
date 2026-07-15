import React, { useState } from "react";
import { Alert, PageHeader, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAppState } from "../lib/AppState";

export default function Report() {
  const {
    mriResult, speechResult, qResult,
    childName, setChildName, childAge, setChildAge,
  } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const hasMri = !!mriResult?.success;
  const hasSpeech = !!speechResult?.success;
  const hasQ = !!qResult;
  const anyResult = hasMri || hasSpeech || hasQ;

  async function generate() {
    setLoading(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const blob = await api.reportGenerate({
        patient_name: childName,
        patient_age: childAge,
        mri_result: mriResult,
        speech_result: speechResult,
        q_result: qResult,
      });
      setDownloadUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const items = [
    ["MRI Analysis", hasMri],
    ["Speech", hasSpeech],
    ["Screening", hasQ],
  ];

  return (
    <div>
      <PageHeader icon="📄" title="Generate Clinical Report" subtitle="Auto-generate a PDF summary of all completed assessments" />

      <h3>Patient Details</h3>
      <div className="grid-2">
        <div className="field">
          <label>Patient Name</label>
          <input type="text" value={childName} onChange={(e) => setChildName(e.target.value)} />
        </div>
        <div className="field">
          <label>Age (months)</label>
          <input type="number" min={1} max={300} value={childAge} onChange={(e) => setChildAge(+e.target.value)} />
        </div>
      </div>

      <h3>Completed Assessments</h3>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {items.map(([label, has], i) => (
          <div key={i} className="card" style={{ textAlign: "center", padding: "0.8rem" }}>
            <div style={{ fontSize: "1.5rem" }}>{has ? "✅" : "❌"}</div>
            <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {!anyResult ? (
        <div style={{ marginTop: "1.5rem" }}>
          <Alert kind="warn">Complete at least one assessment before generating a report.</Alert>
        </div>
      ) : (
        <>
          <button className="btn block" style={{ marginTop: "1.5rem" }} onClick={generate} disabled={loading}>
            {loading ? "Generating..." : "📄 Generate PDF Report"}
          </button>
          {loading && <Spinner label="Building report..." />}
          {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}
          {downloadUrl && (
            <div style={{ marginTop: "1rem" }}>
              <Alert kind="success">✅ Report generated!</Alert>
              <a
                className="btn block"
                style={{ textAlign: "center", display: "block", textDecoration: "none" }}
                href={downloadUrl}
                download={`NeuroAI_Report_${(childName || "Patient").replace(/\s+/g, "_")}.pdf`}
              >
                ⬇️ Download PDF Report
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

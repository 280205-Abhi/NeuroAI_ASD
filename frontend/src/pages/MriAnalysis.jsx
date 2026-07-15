import React, { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Card, Dropzone, PageHeader, RiskBadge, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAppState } from "../lib/AppState";

export default function MriAnalysis() {
  const { mriResult, setMriResult } = useAppState();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setMriResult(null);
    try {
      const result = await api.mriPredict(file);
      setMriResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const chartData = mriResult?.success
    ? [
        { name: "NonASD", value: +(mriResult.non_prob * 100).toFixed(1) },
        { name: "ASD", value: +(mriResult.asd_prob * 100).toFixed(1) },
      ]
    : [];

  return (
    <div>
      <PageHeader
        icon="🧠"
        title="MRI Brain Analysis"
        subtitle="Deep learning ensemble — ResNet18 + EfficientNet-B0 trained on 10,665 ABIDE scans"
      />

      <div className="grid-2" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <Dropzone accept="image/png,image/jpeg" onFile={handleFile} icon="🧠" hint="Grayscale or RGBA brain MRI slice — PNG/JPG" />
        <Card title="Model Info">
          <div style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.7 }}>
            📐 Input: 224×224 RGB<br />
            🔵 ResNet18 (60% weight)<br />
            🟢 EfficientNet-B0 (40%)<br />
            📊 Val accuracy: 83.2%<br />
            📈 AUC: 0.9024<br />
            🗂️ Val samples: 2,134
          </div>
        </Card>
      </div>

      {error && <div style={{ marginTop: "1.5rem" }}><Alert kind="error">Analysis failed: {error}. Ensure the backend is running and MRI models are in backend/models/.</Alert></div>}
      {loading && <Spinner label="Analyzing brain scan..." />}

      {mriResult?.success && (
        <>
          <div className="section-label" style={{ marginTop: "2rem" }}>Preprocessing</div>
          <div className="grid-2">
            <div>
              <img src={preview} alt="original upload" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4, textAlign: "center" }}>Original Upload</div>
            </div>
            <div>
              <img src={mriResult.preprocessed_b64} alt="preprocessed" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4, textAlign: "center" }}>CLAHE Normalised (ABIDE-style)</div>
            </div>
          </div>

          {mriResult.domain_warnings?.map((w, i) => (
            <div key={i} style={{ marginTop: 10 }}><Alert kind="warn">⚠️ {w}</Alert></div>
          ))}

          <div style={{ marginTop: 10 }}>
            <Alert kind="info">
              📌 <strong>Compatibility:</strong> Model trained on ABIDE preprocessed MRI. CLAHE
              normalisation applied to improve compatibility with external scans. Best results
              with skull-stripped axial slices.
            </Alert>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />

          <div className="grid-2" style={{ gridTemplateColumns: "2fr 2fr 1fr" }}>
            <div>
              {mriResult.prediction === "ASD" ? (
                <div className="result-box asd">
                  <div className="result-title">🔴 ASD Pattern Detected</div>
                  <div className="result-conf">Ensemble confidence: {(mriResult.confidence * 100).toFixed(1)}%</div>
                </div>
              ) : (
                <div className="result-box normal">
                  <div className="result-title">✅ Neurotypical Pattern</div>
                  <div className="result-conf">Ensemble confidence: {(mriResult.confidence * 100).toFixed(1)}%</div>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <RiskBadge label={mriResult.risk_badge} level={mriResult.risk_badge_class} />
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 10 }}>Prediction Confidence</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.name === "ASD" ? "#EF4444" : "#22C55E"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Card title="ASD Risk" value={`${(mriResult.asd_prob * 100).toFixed(1)}%`} sub="AUC 0.9024" />
          </div>

          {mriResult.effnet_prob !== null && mriResult.effnet_prob !== undefined && (
            <>
              <div className="section-label" style={{ marginTop: "1.5rem" }}>Ensemble Agreement</div>
              <EnsembleAgreement mriResult={mriResult} />
            </>
          )}

          <div className="section-label" style={{ marginTop: "1.5rem" }}>Brain Activation Visualization</div>
          <div className="grid-2">
            <div>
              <img src={mriResult.original_b64} alt="original mri" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4, textAlign: "center" }}>Original MRI Scan</div>
            </div>
            <div>
              <img src={mriResult.heatmap_b64} alt="gradcam heatmap" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4, textAlign: "center" }}>Grad-CAM++ Activation Map — Red = High attention</div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Alert kind="info">
              🔬 <strong>Reading the heatmap:</strong> Red/yellow regions indicate where the
              model focused most. Central activation around ventricular and subcortical
              structures is consistent with ASD-related neuroanatomical differences reported
              in literature.
            </Alert>
          </div>
          <div className="muted" style={{ fontSize: "0.78rem" }}>
            Model: ResNet18+EfficientNet ensemble | Trained on ABIDE dataset (10,665 images) |
            Val accuracy: 83.2% | AUC: 0.9024 | Val samples: 2,134
          </div>
        </>
      )}
    </div>
  );
}

function EnsembleAgreement({ mriResult }) {
  const rP = mriResult.resnet_prob * 100;
  const eP = mriResult.effnet_prob * 100;
  const ensP = mriResult.asd_prob * 100;
  const rPred = rP > 50 ? "ASD" : "NonASD";
  const ePred = eP > 50 ? "ASD" : "NonASD";
  const agree = rPred === ePred;

  const box = (title, pct, pred) => (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="card-title">{title}</div>
      <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: pct > 50 ? "#EF4444" : "#22C55E" }}>
        {pct.toFixed(1)}%
      </div>
      <div className="card-sub">ASD probability</div>
      <div style={{ marginTop: 8 }}>
        <RiskBadge label={pred} level={pct > 50 ? "high" : "low"} />
      </div>
    </div>
  );

  return (
    <div className="grid-3">
      {box("ResNet18", rP, rPred)}
      {box("EfficientNet-B0", eP, ePred)}
      <div className="card" style={{ textAlign: "center" }}>
        <div className="card-title">Ensemble (60/40)</div>
        <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 700, color: ensP > 50 ? "#EF4444" : "#22C55E" }}>
          {ensP.toFixed(1)}%
        </div>
        <div className="card-sub">Final prediction</div>
        <div style={{ marginTop: 8, fontSize: "0.8rem", fontWeight: 600, color: agree ? "#22C55E" : "#F97316" }}>
          {agree ? "✅ Models Agree" : "⚠️ Models Disagree — Review Recommended"}
        </div>
      </div>
    </div>
  );
}

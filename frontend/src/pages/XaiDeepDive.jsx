import React, { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Card, PageHeader, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAppState } from "../lib/AppState";

const DEFAULTS = {
  age_months: 60, gender: 1, pregnancy_problems: 0, normally_evolved_perinatal_phenomena: 0,
  birth_anomalies: 0, psychiatric_disorders_familiarity: 0, QS: 50, IQ: 90, QA_VABS: 70,
  ADOS: 7, I_intellective_impairment: 0, II_language_impairment: 0, III_known_medical_condition: 0,
  III_history_environmental_exposure: 0, III_known_genetic_condition: 0,
  IV_other_mental_behavioral_disorders: 0, other_psychiatric_comorbidities: 0, nutrition_disorders: 0,
  CGH_array_alterations: 0, DQ: 85, DQ_IQ: 1.0, n_alterated_chromosomes: 0, n_mutations: 0,
  n_dup: 0, n_del: 0,
};

const YES_NO_FIELDS = [
  ["pregnancy_problems", "Pregnancy Problems"], ["birth_anomalies", "Birth Anomalies"],
  ["psychiatric_disorders_familiarity", "Family Psychiatric History"],
  ["nutrition_disorders", "Nutrition Disorders"], ["CGH_array_alterations", "CGH Array Alterations"],
  ["normally_evolved_perinatal_phenomena", "Normally Evolved Perinatal"],
  ["I_intellective_impairment", "Intellective Impairment"], ["II_language_impairment", "Language Impairment"],
  ["III_known_medical_condition", "Known Medical Condition"],
  ["III_history_environmental_exposure", "Environmental Exposure"],
  ["III_known_genetic_condition", "Known Genetic Condition"],
  ["IV_other_mental_behavioral_disorders", "Other Mental Disorders"],
  ["other_psychiatric_comorbidities", "Other Psychiatric Comorbidities"],
];

const NUM_FIELDS = [
  ["age_months", "Age (years)"], ["IQ", "IQ Score"], ["ADOS", "ADOS Score"],
  ["QA_VABS", "QA VABS Score"], ["QS", "QS Score"], ["DQ", "DQ Score"], ["DQ_IQ", "DQ/IQ Ratio"],
  ["n_alterated_chromosomes", "No. Altered Chromosomes"], ["n_mutations", "No. Mutations"],
  ["n_dup", "No. Duplications"], ["n_del", "No. Deletions"],
];

export default function XaiDeepDive() {
  const [domain, setDomain] = useState("clinical");
  return (
    <div>
      <PageHeader icon="🔬" title="XAI Deep Dive" subtitle="Explainability analysis — SHAP values, ensemble agreement, and what-if simulation" />
      <div className="tabs">
        <button className={domain === "clinical" ? "active" : ""} onClick={() => setDomain("clinical")}>📋 Clinical Behaviour XAI</button>
        <button className={domain === "mri" ? "active" : ""} onClick={() => setDomain("mri")}>🧠 Brain MRI Scan XAI</button>
      </div>
      {domain === "clinical" ? <ClinicalXai /> : <MriXai />}
    </div>
  );
}

function MriXai() {
  const { mriResult, mriShapResult, setMriShapResult } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runShap() {
    setLoading(true);
    setError(null);
    try {
      // Re-fetch original as blob from the b64 stored in mriResult
      const blob = await (await fetch(mriResult.original_b64)).blob();
      const file = new File([blob], "mri.png", { type: "image/png" });
      const result = await api.mriShap(file);
      setMriShapResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!mriResult?.success) {
    return <Alert kind="warn">⚠️ No MRI Analysis result found. Please upload a brain MRI scan on the MRI Analysis page first.</Alert>;
  }

  return (
    <div>
      <h3>Explainability for MRI Prediction: <strong>{mriResult.prediction}</strong> (Confidence: {(mriResult.confidence * 100).toFixed(1)}%)</h3>

      {!mriShapResult && !loading && (
        <button className="btn" onClick={runShap}>🧠 Compute SHAP Pixel-level Attribution</button>
      )}
      {loading && <Spinner label="Computing SHAP pixel-level attributions..." />}
      {error && <Alert kind="error">Failed to compute SHAP: {error}</Alert>}

      {mriShapResult?.success && (
        <>
          <div className="grid-3" style={{ marginTop: "1.5rem" }}>
            <div>
              <img src={mriResult.original_b64} alt="original" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.78rem", textAlign: "center", marginTop: 4 }}>Original MRI Scan</div>
            </div>
            <div>
              <img src={mriResult.heatmap_b64} alt="gradcam" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.78rem", textAlign: "center", marginTop: 4 }}>Grad-CAM++ Activation Map</div>
            </div>
            <div>
              <img src={mriShapResult.shap_img_b64} alt="shap" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />
              <div className="muted" style={{ fontSize: "0.78rem", textAlign: "center", marginTop: 4 }}>SHAP Pixel Attribution (Red = ASD risk)</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Alert kind="info">
              🔬 <strong>SHAP Pixel Attribution Map:</strong> Red regions indicate where
              features pushed the model's prediction toward ASD, while blue regions pushed it
              toward Non-ASD. This complements the Grad-CAM++ attention map.
            </Alert>
          </div>
        </>
      )}
    </div>
  );
}

function ClinicalXai() {
  const [tab, setTab] = useState("shap");
  return (
    <div>
      <div className="tabs">
        <button className={tab === "shap" ? "active" : ""} onClick={() => setTab("shap")}>📊 SHAP Analysis</button>
        <button className={tab === "conflict" ? "active" : ""} onClick={() => setTab("conflict")}>🔀 Ensemble Conflict</button>
        <button className={tab === "whatif" ? "active" : ""} onClick={() => setTab("whatif")}>🎛️ What-If Simulator</button>
      </div>
      {tab === "shap" && <ShapTab />}
      {tab === "conflict" && <ConflictTab />}
      {tab === "whatif" && <WhatIfTab />}
    </div>
  );
}

function ShapTab() {
  const { clinicalResult, setClinicalResult } = useAppState();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.clinicalPredict(form);
      setClinicalResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sevLabels = ["No ASD", "Mild-Moderate", "Severe"];
  const sevChart = clinicalResult?.success
    ? clinicalResult.sev_prob.map((p, i) => ({ name: sevLabels[i], value: +(p * 100).toFixed(1) }))
    : [];
  const shapChart = clinicalResult?.success
    ? clinicalResult.shap.slice(0, 12).map((r) => ({ name: r.feature, value: r.shap }))
    : [];

  return (
    <div>
      <p className="muted">Enter patient data to generate a SHAP explanation.</p>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="grid-3">
          <div>
            {NUM_FIELDS.map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input type="number" step="any" value={form[key]} onChange={(e) => set(key, +e.target.value)} />
              </div>
            ))}
          </div>
          <div>
            <div className="field">
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => set("gender", +e.target.value)}>
                <option value={1}>Male</option>
                <option value={0}>Female</option>
              </select>
            </div>
            {YES_NO_FIELDS.slice(0, 6).map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <select value={form[key]} onChange={(e) => set(key, +e.target.value)}>
                  <option value={0}>No</option>
                  <option value={1}>Yes</option>
                </select>
              </div>
            ))}
          </div>
          <div>
            {YES_NO_FIELDS.slice(6).map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <select value={form[key]} onChange={(e) => set(key, +e.target.value)}>
                  <option value={0}>No</option>
                  <option value={1}>Yes</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="btn block" onClick={run} disabled={loading}>
        {loading ? <span className="spinner" /> : "Run SHAP Analysis"}
      </button>
      {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}

      {clinicalResult?.success && (
        <div style={{ marginTop: "1.5rem" }}>
          <div className="grid-2">
            {clinicalResult.bin_pred === 1 ? (
              <Alert kind="error">🔴 ASD Detected | {(clinicalResult.bin_prob[1] * 100).toFixed(1)}% confidence</Alert>
            ) : (
              <Alert kind="success">✅ No ASD | {(clinicalResult.bin_prob[0] * 100).toFixed(1)}% confidence</Alert>
            )}
            <Alert kind="info">Severity: {clinicalResult.sev_label} | {(clinicalResult.sev_prob[clinicalResult.sev_pred] * 100).toFixed(1)}%</Alert>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card-title">Severity Class Probabilities</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sevChart}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {sevChart.map((e, i) => <Cell key={i} fill={["#22C55E", "#F59E0B", "#EF4444"][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card-title">SHAP Feature Importance (Red = pushes toward ASD)</div>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={shapChart} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {shapChart.map((e, i) => <Cell key={i} fill={e.value > 0 ? "#EF4444" : "#2563EB"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="data-table" style={{ marginTop: "1rem" }}>
            <thead><tr><th>Feature</th><th>Patient Value</th><th>SHAP Impact</th><th>Direction</th></tr></thead>
            <tbody>
              {clinicalResult.shap.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td>{r.feature}</td><td>{r.value}</td><td>{r.shap}</td>
                  <td>{r.shap > 0 ? "↑ Increases ASD risk" : "↓ Decreases ASD risk"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConflictTab() {
  const { clinicalResult } = useAppState();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.clinicalConflict(clinicalResult.input_scaled, clinicalResult.features);
      setRows(result.rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!clinicalResult?.success) {
    return <Alert kind="info">Run SHAP Analysis first to see the ensemble conflict map.</Alert>;
  }

  return (
    <div>
      <p className="muted">
        Shows where individual ensemble models <strong>agree or disagree</strong> in their SHAP
        explanations — revealing which features are robustly predictive vs model-dependent.
      </p>
      {!rows && <button className="btn" onClick={run} disabled={loading}>{loading ? "Computing..." : "Compute Conflict Map"}</button>}
      {error && <div style={{ marginTop: 10 }}><Alert kind="error">{error}</Alert></div>}

      {rows && (
        <>
          <table className="data-table" style={{ marginTop: "1rem" }}>
            <thead>
              <tr><th>Feature</th><th>Agreement</th><th>Avg Impact</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.feature}</td>
                  <td>{r.agree ? "✅ Agree" : "⚠️ Conflict"}</td>
                  <td>{r.avg_impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid-2" style={{ marginTop: "1rem" }}>
            <Alert kind="success">✅ {rows.filter((r) => r.agree).length} features — all models agree on direction</Alert>
            <Alert kind="warn">⚠️ {rows.filter((r) => !r.agree).length} features — models disagree, treat with caution</Alert>
          </div>
        </>
      )}
    </div>
  );
}

function WhatIfTab() {
  const [mriProb, setMriProb] = useState(0.5);
  const [clinicalProb, setClinicalProb] = useState(0.6);
  const [qScore, setQScore] = useState(3);
  const [wMri, setWMri] = useState(0.4);
  const [wClin, setWClin] = useState(0.4);
  const [wQ, setWQ] = useState(0.2);

  const total = wMri + wClin + wQ || 1;
  const nMri = wMri / total, nClin = wClin / total, nQ = wQ / total;
  const fused = nMri * mriProb + nClin * clinicalProb + nQ * (qScore / 10);
  const level = fused < 0.25 ? ["Low Risk", "#22C55E"] : fused < 0.45 ? ["Borderline", "#EAB308"] : fused < 0.65 ? ["Moderate Risk", "#F97316"] : fused < 0.8 ? ["High Risk", "#EF4444"] : ["Very High Risk", "#DC2626"];

  const contribData = [
    { name: "MRI", value: +(nMri * mriProb * 100).toFixed(1) },
    { name: "Clinical", value: +(nClin * clinicalProb * 100).toFixed(1) },
    { name: "Screening", value: +(nQ * (qScore / 10) * 100).toFixed(1) },
  ];

  return (
    <div>
      <p className="muted">Adjust parameters and see the fused prediction change instantly. Weights auto-normalize to sum to 1.0.</p>
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Input Probabilities</div>
          <RangeField label={`MRI ASD Probability: ${mriProb.toFixed(2)}`} value={mriProb} min={0} max={1} step={0.01} onChange={setMriProb} />
          <RangeField label={`Clinical ASD Probability: ${clinicalProb.toFixed(2)}`} value={clinicalProb} min={0} max={1} step={0.01} onChange={setClinicalProb} />
          <RangeField label={`Screening Score: ${qScore}`} value={qScore} min={0} max={10} step={1} onChange={setQScore} />
        </div>
        <div className="card">
          <div className="card-title">Module Weights</div>
          <RangeField label={`MRI Weight: ${wMri.toFixed(2)}`} value={wMri} min={0} max={1} step={0.05} onChange={setWMri} />
          <RangeField label={`Clinical Weight: ${wClin.toFixed(2)}`} value={wClin} min={0} max={1} step={0.05} onChange={setWClin} />
          <RangeField label={`Screening Weight: ${wQ.toFixed(2)}`} value={wQ} min={0} max={1} step={0.05} onChange={setWQ} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: "1.5rem", alignItems: "center" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="card-title">Fused ASD Risk</div>
          <div className="mono" style={{ fontSize: "2.4rem", fontWeight: 700, color: level[1] }}>{(fused * 100).toFixed(1)}%</div>
        </div>
        <div className="card">
          <div className="card-title">Module Contribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contribData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 60]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#2563EB" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <span className="badge" style={{ background: level[1] + "22", color: level[1] }}>{level[0]} — {(fused * 100).toFixed(1)}% ASD Risk</span>
      </div>
    </div>
  );
}

function RangeField({ label, value, min, max, step, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

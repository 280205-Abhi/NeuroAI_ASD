import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Card, PageHeader, Spinner } from "../components/ui";
import { api } from "../lib/api";

export default function ModelComparison() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("clinical");

  useEffect(() => {
    api.modelsComparison().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader icon="📊" title="Model Comparison" subtitle="Complete comparison of all 17 models — 13 clinical + 4 MRI" />
      <div className="tabs">
        <button className={tab === "clinical" ? "active" : ""} onClick={() => setTab("clinical")}>🏥 Clinical Models</button>
        <button className={tab === "mri" ? "active" : ""} onClick={() => setTab("mri")}>🧠 MRI Models</button>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {!data && !error && <Spinner label="Loading model comparison data..." />}

      {data && tab === "clinical" && <ClinicalTab rows={data.clinical} />}
      {data && tab === "mri" && <MriTab rows={data.mri} />}
    </div>
  );
}

function ClinicalTab({ rows }) {
  if (!rows || rows.length === 0) {
    return <Alert kind="warn">full_results.csv not found in backend/models/ — model comparison table unavailable.</Alert>;
  }
  const tasks = [...new Set(rows.map((r) => r.task))];
  return (
    <div>
      {tasks.map((task) => {
        const taskRows = rows.filter((r) => r.task === task).sort((a, b) => b.f1 - a.f1);
        const label = task === "severity" ? "Severity Estimation (3-class)" : "Binary ASD Classification";
        return (
          <div key={task} style={{ marginBottom: "2rem" }}>
            <div className="section-label">{label}</div>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Model</th><th>Test Acc</th><th>F1</th><th>AUC</th></tr>
              </thead>
              <tbody>
                {taskRows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td><td>{r.model}</td>
                    <td>{Number(r.test_acc).toFixed(3)}</td>
                    <td>{Number(r.f1).toFixed(3)}</td>
                    <td>{Number(r.auc).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card" style={{ marginTop: "1rem" }}>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={taskRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="model" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={80} />
                  <YAxis domain={[0, 1.1]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="test_acc" name="Test Acc" fill="#2563EB" />
                  <Bar dataKey="f1" name="F1 Score" fill="#7C3AED" />
                  <Bar dataKey="auc" name="AUC" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MriTab({ rows }) {
  if (!rows || rows.length === 0) {
    return <Alert kind="warn">Model comparison data unavailable.</Alert>;
  }

  // Format data for chart
  const chartData = rows.map((r) => ({
    model: r.Model || r.model,
    subject_acc: r["Subject acc"] != null ? Number(r["Subject acc"]) : (r.test_acc != null ? Number(r.test_acc) : null),
    auc: r["Subject AUC"] != null ? Number(r["Subject AUC"]) : (r.auc != null ? Number(r.auc) : null),
    sens: r.Sensitivity != null ? Number(r.Sensitivity) : null,
    spec: r.Specificity != null ? Number(r.Specificity) : null,
  }));

  return (
    <div>
      <div style={{ marginBottom: "1rem", padding: "0.6rem 0.85rem", background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "4px solid var(--primary)", borderRadius: "var(--radius)", fontSize: "0.82rem", color: "var(--foreground)" }}>
        <strong>Research prototype, not a diagnostic tool.</strong> Trained on false-colour ABIDE slices; subject-level accuracy about 69-73%.
      </div>

      <div className="section-label">MRI Classification — Subject-Wise Validated Models (Test Set, 175 Subjects)</div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Slice Acc</th>
            <th>Subject Acc</th>
            <th>Subject AUC</th>
            <th>Sensitivity</th>
            <th>Specificity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><strong>{r.Model || r.model}</strong></td>
              <td>{r["Slice acc"] != null && r["Slice acc"] !== "" ? `${(Number(r["Slice acc"]) * 100).toFixed(1)}%` : "—"}</td>
              <td>{r["Subject acc"] != null && r["Subject acc"] !== "" ? `${(Number(r["Subject acc"]) * 100).toFixed(1)}%` : (r.test_acc != null ? `${(Number(r.test_acc) * 100).toFixed(1)}%` : "—")}</td>
              <td>{r["Subject AUC"] != null && r["Subject AUC"] !== "" ? Number(r["Subject AUC"]).toFixed(3) : (r.auc != null ? Number(r.auc).toFixed(3) : "—")}</td>
              <td>{r.Sensitivity != null && r.Sensitivity !== "" ? `${(Number(r.Sensitivity) * 100).toFixed(1)}%` : "—"}</td>
              <td>{r.Specificity != null && r.Specificity !== "" ? `${(Number(r.Specificity) * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-title">Subject-Level Performance (Accuracy & AUC)</div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="model" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={80} />
            <YAxis domain={[0, 1.05]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val) => (typeof val === "number" ? val.toFixed(3) : val)} />
            <Legend />
            <Bar dataKey="subject_acc" name="Subject Accuracy" fill="#2563EB" />
            <Bar dataKey="auc" name="Subject AUC" fill="#F59E0B" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: "1rem", borderLeft: "4px solid var(--accent)" }}>
        <div className="card-title">Subject-Wise Evaluation & Validation</div>
        <div style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.7 }}>
          Evaluated using rigorous subject-wise split on the ABIDE test set (175 subjects).
          The <strong>ResNet18 + EfficientNet-B0 ensemble</strong> achieves <strong>72.6%</strong> subject-level accuracy
          (AUC <strong>0.787</strong>) at default threshold 0.5, and <strong>68.6%</strong> accuracy with <strong>69.6% sensitivity</strong> and <strong>67.7% specificity</strong> under tuned decision threshold (0.322).
        </div>
      </div>
    </div>
  );
}

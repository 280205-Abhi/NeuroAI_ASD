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
  return (
    <div>
      <div className="section-label">MRI Classification — Current vs Previous</div>
      <table className="data-table">
        <thead><tr><th>Model</th><th>Test Acc</th><th>AUC</th><th>Approach</th><th>Semester</th><th>Val Samples</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.model}</td><td>{Number(r.test_acc).toFixed(3)}</td><td>{Number(r.auc).toFixed(3)}</td>
              <td>{r.approach}</td><td>{r.semester}</td><td>{r.val_samples}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-title">MRI Model Comparison — Previous vs Current Semester</div>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="model" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={80} />
            <YAxis domain={[0, 1.15]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="test_acc" name="Accuracy" fill="#2563EB" />
            <Line type="monotone" dataKey="auc" name="AUC" stroke="#F59E0B" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: "1rem", borderLeft: "4px solid var(--accent)" }}>
        <div className="card-title">Key Contribution This Semester</div>
        <div style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.7 }}>
          Replaced the original <strong>PCA + VotingClassifier</strong> approach (which
          flattened brain images into pixel arrays) with a <strong>ResNet18 +
          EfficientNet-B0 transfer learning ensemble</strong>. This architectural change
          improved MRI classification accuracy from <strong style={{ color: "#EF4444" }}>65.0%</strong> to{" "}
          <strong style={{ color: "#22C55E" }}>83.2%</strong> — a <strong>+18.2% improvement</strong> —
          on a statistically reliable validation set of 2,134 unseen images.
        </div>
      </div>
    </div>
  );
}

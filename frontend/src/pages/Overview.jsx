import React from "react";
import { PageHeader, Card } from "../components/ui";

const STEPS = [
  ["🧠", "MRI Analysis", "Upload brain MRI → Get ASD prediction + heatmap"],
  ["📋", "Screening", "Answer 10 questions → Get behavioural risk score"],
  ["🔬", "XAI Deep Dive", "Understand WHY the model made its prediction"],
  ["📄", "Report", "Download PDF summary of all findings"],
];

const ARCH = [
  ["🏥", "Clinical Data", "25 features\nABIDE dataset"],
  ["🧠", "Brain MRI", "10,665 images\nABIDE MPRAGE"],
  ["⚙️", "Ensemble", "Multi-level fusion\nWeighted voting"],
  ["📊", "Explainability", "SHAP + GradCAM\nCounterfactual"],
];

export default function Overview() {
  return (
    <div>
      <PageHeader
        title="NeuroAI — ASD Classification System"
        subtitle="Explainable AI based ASD Classification and Severity Estimation using Ensemble Learning"
      />

      <div className="disclaimer">
        ⚠️ <strong>Research Tool Disclaimer:</strong> This system is designed for
        academic research and clinical decision support only. It does not
        constitute a medical diagnosis. All predictions must be reviewed by a
        qualified healthcare professional.
      </div>

      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        <Card title="MRI Accuracy" value="83.2%" sub="ResNet18 + EfficientNet" />
        <Card title="Clinical Accuracy" value="96.5%" sub="Random Forest Ensemble" />
        <Card title="Models Compared" value="17" sub="Clinical + MRI combined" />
        <Card title="Training Images" value="10,665" sub="ABIDE dataset" />
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2rem 0" }} />

      <div className="grid-2" style={{ gridTemplateColumns: "3fr 2fr" }}>
        <div>
          <div className="section-label">How It Works</div>
          <p><strong>NeuroAI</strong> implements a three-level ensemble approach:</p>
          <p><strong>Level 1 — Clinical Ensemble</strong><br />
            Random Forest + Extra Trees + Gradient Boosting trained on ABIDE
            clinical assessment data. Outputs binary ASD classification + 3-class
            severity.</p>
          <p><strong>Level 2 — MRI Deep Learning Ensemble</strong><br />
            ResNet18 + EfficientNet-B0, both pretrained on ImageNet and fine-tuned
            on 10,665 ABIDE brain MRI slices. Outputs ASD probability + Grad-CAM++
            visualization.</p>
          <p><strong>Level 3 — Explainability Layer</strong><br />
            SHAP values, ensemble agreement analysis, counterfactual explanations
            and what-if simulation — making every prediction transparent and
            clinically interpretable.</p>
        </div>

        <div>
          <div className="section-label">Quick Start</div>
          {STEPS.map(([icon, title, desc], i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.3rem" }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{title}</div>
                <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2rem 0" }} />
      <div className="section-label">System Architecture</div>
      <div className="stat-grid">
        {ARCH.map(([icon, title, sub], i) => (
          <div key={i} className="card" style={{ textAlign: "center", padding: "1rem" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>{icon}</div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{title}</div>
            <div className="muted" style={{ fontSize: "0.75rem", marginTop: 2, whiteSpace: "pre-line" }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

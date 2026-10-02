import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Disclaimer, Panel, RiskBadge, SectionHeading } from "../components/clinical/primitives";
import { useCase } from "../lib/CaseStore";

export default function CaseEntry() {
  const navigate = useNavigate();
  const {
    patientName, ageMonths, sex, clinician, site, openedAt,
    mriResult, qResult, clinicalResult,
    updateCase, resetCase, completedModalitiesCount,
  } = useCase();

  const completedCount = completedModalitiesCount();

  function handleSave(e) {
    e.preventDefault();
    navigate("/mri");
  }

  return (
    <div>
      <SectionHeading
        eyebrow="STEP 1 OF 6"
        title="Open a case"
        description="NeuroAI combines three independent modalities into one reviewable picture. Enter a de-identified case reference only — no names, dates of birth or record numbers."
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={resetCase}>
              <RotateCcw size={14} />
              <span>Clear case</span>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/mri")}>
              <span>Next: MRI</span>
              <ArrowRight size={14} />
            </button>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Left: Case details form */}
        <Panel title="Case details" action={<span className="muted" style={{ fontSize: "0.75rem" }}>Stored in this browser session only.</span>}>
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.85rem" }}>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: "0.3rem" }}>Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={patientName}
                  onChange={(e) => updateCase({ patientName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: "0.3rem" }}>Age at assessment (years)</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  step={0.1}
                  className="input-field numeric"
                  value={ageMonths}
                  onChange={(e) => updateCase({ ageMonths: parseFloat(e.target.value) || 2 })}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.85rem" }}>
              <div>
                <label className="label-caps" style={{ display: "block", marginBottom: "0.3rem" }}>Sex</label>
                <select className="input-field" value={sex} onChange={(e) => updateCase({ sex: e.target.value })}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button type="submit" className="btn btn-primary" style={{ padding: "0.6rem 1.25rem" }}>
                <span>Save and continue</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <Disclaimer />
            </div>
          </form>
        </Panel>

        {/* Right: Workflow guide & Session status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Panel title="Workflow" action={<span className="muted" style={{ fontSize: "0.75rem" }}>Modalities can be completed in any order.</span>}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span className="numeric label-caps" style={{ color: "var(--primary)", fontWeight: 700 }}>01</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>MRI Imaging</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>T1-weighted slice — CNN classification with Grad-CAM++ saliency.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span className="numeric label-caps" style={{ color: "var(--primary)", fontWeight: 700 }}>02</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Behavioral screening</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>10-item M-CHAT-R with automatic risk banding.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span className="numeric label-caps" style={{ color: "var(--primary)", fontWeight: 700 }}>03</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Clinical features</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>25 phenotypic features — severity estimate with SHAP.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span className="numeric label-caps" style={{ color: "var(--primary)", fontWeight: 700 }}>04</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Fused results</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>Side-by-side agreement view and evidence-grounded suggestions.</div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Session status">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {patientName ? (
                  <>Patient <strong className="numeric" style={{ color: "var(--foreground)" }}>{patientName}</strong> {openedAt ? `opened ${openedAt}` : ""}</>
                ) : (
                  <span>No active case. Enter details on the left to begin.</span>
                )}
              </div>

              <div>
                <RiskBadge level={completedCount > 0 ? "low" : "neutral"} label={`${completedCount} of 3 modalities complete`} />
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate("/results")}>
                  Open results
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate("/report")}>
                  Report
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

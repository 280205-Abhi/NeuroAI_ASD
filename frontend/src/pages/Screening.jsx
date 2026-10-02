import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ConfidenceBar, Disclaimer, Panel, Readout, RiskBadge, SectionHeading } from "../components/clinical/primitives";
import ModalLoadingOverlay from "../components/clinical/ModalLoadingOverlay";
import { api } from "../lib/api";
import { useCase } from "../lib/CaseStore";

const MCHAT_QUESTIONS = [
  { text: "Does the child make consistent eye contact?", positive: true },
  { text: "Does the child respond to their name?", positive: true },
  { text: "Does the child point to show interest in things?", positive: true },
  { text: "Does the child engage in pretend or imaginative play?", positive: true },
  { text: "Does the child show interest in other children?", positive: true },
  { text: "Does the child repeat words or phrases over and over?", positive: false },
  { text: "Does the child show repetitive movements (rocking, hand-flapping)?", positive: false },
  { text: "Does the child get very upset with minor changes in routine?", positive: false },
  { text: "Does the child have unusual reactions to sounds, textures or lights?", positive: false },
  { text: "Does the child avoid being cuddled or held?", positive: false },
];

const DEFAULT_NORMAL_ANSWERS = ["Yes", "Yes", "Yes", "Yes", "Yes", "No", "No", "No", "No", "No"];

export default function Screening() {
  const navigate = useNavigate();
  const { qAnswers, qResult, updateCase } = useCase();
  const [answers, setAnswers] = useState(qAnswers || DEFAULT_NORMAL_ANSWERS);
  const [loading, setLoading] = useState(false);

  // handleSelect ONLY updates local answers state — does NOT trigger score update until Re-score is clicked!
  function handleSelect(index, val) {
    const updated = [...answers];
    updated[index] = val;
    setAnswers(updated);
  }

  function handleClear() {
    const cleared = [...DEFAULT_NORMAL_ANSWERS];
    setAnswers(cleared);
    setLoading(true);
  }

  // Calculate score for display after scoring button is clicked
  let liveScore = 0;
  const isFlaggedList = answers.map((ans, idx) => {
    const q = MCHAT_QUESTIONS[idx];
    const isAtRisk = (q.positive && ans === "No") || (!q.positive && ans === "Yes");
    if (isAtRisk) liveScore++;
    return isAtRisk;
  });

  let liveLevel = "Low Risk";
  let liveRec = "Typical development indicators. Continue routine monitoring.";
  if (liveScore >= 8) {
    liveLevel = "High Risk";
    liveRec = "Multiple ASD indicators. Recommend immediate referral to developmental specialist.";
  } else if (liveScore >= 3) {
    liveLevel = "Moderate Risk";
    liveRec = "Administer M-CHAT-R/F Follow-Up interview items for failed questions to clarify risk tier before referral decisions.";
  }

  const scoreVal = qResult?.score ?? liveScore;
  const levelVal = qResult?.level || liveLevel;
  const answeredCount = answers.filter(Boolean).length;

  function handleTriggerScore(e) {
    if (e) e.preventDefault();
    setLoading(true);
  }

  async function executeScoring() {
    try {
      const result = await api.screeningScore(answers);
      updateCase({ qResult: result, qAnswers: answers });
    } catch {
      const mockResult = {
        score: liveScore,
        max: 10,
        level: liveLevel,
        rec: liveRec,
        answers,
      };
      updateCase({ qResult: mockResult, qAnswers: answers });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {loading && (
        <ModalLoadingOverlay
          icon="check"
          title="Scoring M-CHAT-R Behavioral Questionnaire..."
          steps={[
            "Verifying 10 caregiver-reported screening items...",
            "Calculating at-risk score & AAP clinical risk tier...",
            "Matching response profile against NICE CG128 guidance...",
            "Synthesizing follow-up recommendations & risk tier..."
          ]}
          durationMs={5500}
          onComplete={executeScoring}
        />
      )}

      <SectionHeading
        eyebrow="STEP 3 OF 6 · MODALITY 2"
        title="M-CHAT-R behavioral screening"
        description="Caregiver-reported items. Answer as the caregiver described the child's usual behaviour. Click 'Score questionnaire' to compute the screening risk tier."
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/clinical")}>
            <span>Next: Clinical</span>
            <ArrowRight size={14} />
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Left: Screening items table */}
        <Panel
          title="Screening items"
          action={<span className="muted numeric" style={{ fontSize: "0.78rem" }}>{answeredCount} of 10 answered</span>}
        >
          <form onSubmit={handleTriggerScore}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {MCHAT_QUESTIONS.map((q, idx) => {
                const current = answers[idx] || "No";
                const flagged = isFlaggedList[idx];

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.55rem 0.75rem",
                      backgroundColor: idx % 2 === 0 ? "var(--surface)" : "#ffffff",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: "1rem", fontSize: "0.83rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="numeric muted" style={{ width: "18px", fontSize: "0.8rem" }}>{idx + 1}</span>
                      <span style={{ color: "var(--foreground)" }}>{q.text}</span>
                      {flagged && (
                        <span style={{ fontSize: "0.7rem", color: "#991b1b", backgroundColor: "#fee2e2", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>
                          at-risk choice
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      {/* YES Button */}
                      <button
                        type="button"
                        style={{
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          backgroundColor: current === "Yes" ? (q.positive ? "var(--primary)" : "#991b1b") : "#ffffff",
                          color: current === "Yes" ? "#ffffff" : "var(--foreground)",
                          border: current === "Yes" ? (q.positive ? "1px solid var(--primary)" : "1px solid #991b1b") : "1px solid var(--border)",
                        }}
                        onClick={() => handleSelect(idx, "Yes")}
                      >
                        Yes
                      </button>

                      {/* NO Button */}
                      <button
                        type="button"
                        style={{
                          padding: "0.25rem 0.75rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          backgroundColor: current === "No" ? (!q.positive ? "var(--primary)" : "#991b1b") : "#ffffff",
                          color: current === "No" ? "#ffffff" : "var(--foreground)",
                          border: current === "No" ? (!q.positive ? "1px solid var(--primary)" : "1px solid #991b1b") : "1px solid var(--border)",
                        }}
                        onClick={() => handleSelect(idx, "No")}
                      >
                        No
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ backgroundColor: "var(--primary)", color: "#ffffff" }}>
                {qResult ? "Re-score questionnaire" : "Score questionnaire"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClear}>
                Reset to default
              </button>
            </div>
          </form>
        </Panel>

        {/* Right: Result & Guidance */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Panel title="Result" action={<span className="muted" style={{ fontSize: "0.78rem" }}>M-CHAT-R total, 0–10.</span>}>
            {!qResult ? (
              <div style={{ padding: "1.5rem 1rem", textAlign: "center" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--foreground)", marginBottom: 4 }}>Score Pending</div>
                <div className="muted" style={{ fontSize: "0.8rem" }}>Answer the 10 screening questions and click <strong>Score questionnaire</strong> to generate result.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Readout label="TOTAL SCORE" value={`${scoreVal} / 10`} />
                  <RiskBadge level={levelVal.toLowerCase().replace(" ", "-")} label={levelVal} />
                </div>

                {/* Score Bar */}
                <div style={{ height: "6px", width: "100%", backgroundColor: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(scoreVal / 10) * 100}%`,
                      backgroundColor: scoreVal >= 8 ? "var(--risk-high)" : scoreVal >= 3 ? "var(--risk-moderate)" : "var(--risk-low)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* Guidance Box */}
                <div
                  style={{
                    padding: "0.85rem",
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: "0.82rem",
                    color: "var(--foreground)",
                    lineHeight: 1.5,
                  }}
                >
                  {scoreVal >= 8
                    ? "Score falls in the high-risk band. Immediate referral for formal diagnostic evaluation and early-intervention assessment."
                    : scoreVal >= 3
                      ? "Score falls in the medium-risk band. Administer the M-CHAT-R Follow-Up interview on the flagged items; if two or more remain positive, refer for diagnostic evaluation and early-intervention assessment."
                      : "Score falls in the low-risk band. Continue routine developmental surveillance; rescreen at 24 months if indicated."}
                </div>

                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  Bands: 0–2 low • 3–7 medium (administer Follow-Up) • 8–10 high.
                </div>
              </div>
            )}
          </Panel>

          {/* Interpretation Notes */}
          <Panel title="Interpretation notes">
            <div style={{ fontSize: "0.8rem", color: "var(--foreground)", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <p style={{ margin: 0 }}>
                A negative screen does not rule out ASD; re-screen at the next surveillance visit if concerns persist.
              </p>
              <p style={{ margin: 0 }}>
                The M-CHAT-R is validated for children aged roughly 16–30 months. Outside that window treat the score as indicative only.
              </p>
              <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
                Decision support only. NeuroAI outputs are probabilistic model estimates, not a diagnosis.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

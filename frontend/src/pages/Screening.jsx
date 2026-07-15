import React, { useEffect, useState } from "react";
import { Alert, Card, GaugeRing, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useAppState } from "../lib/AppState";

export default function Screening() {
  const { qResult, setQResult, childName, setChildName, childAge, setChildAge } = useAppState();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    api.screeningQuestions().then(setQuestions).catch(() => setError("Could not load questions from backend."));
  }, []);

  function setAnswer(i, val) {
    setAnswers((a) => ({ ...a, [i]: val }));
  }

  async function submit() {
    if (Object.keys(answers).length !== questions.length) {
      setError("Please answer every question before calculating a score.");
      return;
    }
    setError(null);
    const ordered = questions.map((_, i) => answers[i]);
    try {
      const result = await api.screeningScore(ordered);
      setQResult(result);
    } catch (e) {
      setError(e.message);
    }
  }

  const gaugeColor = qResult
    ? qResult.level === "Low Risk" ? "#22C55E" : qResult.level === "Moderate Risk" ? "#F97316" : "#EF4444"
    : "#22C55E";

  return (
    <div>
      <PageHeader
        icon="📋"
        title="Behavioural Screening"
        subtitle="10-question M-CHAT-R based screening — suitable for parents, teachers and caregivers"
      />

      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label>Child's name (optional)</label>
          <input type="text" value={childName} onChange={(e) => setChildName(e.target.value)} />
        </div>
        <div className="field">
          <label>Age (months)</label>
          <input type="number" min={12} max={120} value={childAge} onChange={(e) => setChildAge(+e.target.value)} />
        </div>
      </div>

      <Alert kind="info">📌 Answer based on the child's <strong>typical</strong> behaviour, not their best or worst day.</Alert>

      <div style={{ marginTop: "1.5rem" }}>
        {questions.map((q, i) => (
          <div key={i} className="card" style={{ marginBottom: "0.6rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.6rem" }}>
              Q{i + 1}. {q.text}
            </div>
            <div className="pill-radio">
              {["Yes", "No"].map((opt) => (
                <button
                  key={opt}
                  className={`${answers[i] === opt ? `selected ${opt.toLowerCase()}` : ""}`}
                  onClick={() => setAnswer(i, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <button className="btn block" onClick={submit} style={{ marginTop: "1rem" }}>
        Calculate Risk Score
      </button>

      {qResult && (
        <div className="grid-2" style={{ marginTop: "2rem", alignItems: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <GaugeRing value={qResult.score} max={10} color={gaugeColor} label="Risk Score" sublabel={`/ ${qResult.max}`} />
          </div>
          <div>
            <Alert kind={qResult.level === "Low Risk" ? "success" : qResult.level === "Moderate Risk" ? "warn" : "error"}>
              {qResult.level === "Low Risk" ? "🟢" : qResult.level === "Moderate Risk" ? "🟡" : "🔴"}{" "}
              {qResult.level} — {qResult.score}/{qResult.max}
            </Alert>
            <Card title="Clinical Recommendation">
              <div style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.6 }}>{qResult.rec}</div>
            </Card>
          </div>
        </div>
      )}

      <div className="muted" style={{ fontSize: "0.8rem", marginTop: "1.5rem" }}>
        Based on M-CHAT-R screening criteria. Not a diagnostic tool. Score ≥3 warrants
        professional evaluation.
      </div>
    </div>
  );
}

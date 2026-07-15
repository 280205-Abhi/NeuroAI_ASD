import React, { useState } from "react";
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer,
} from "recharts";
import { Alert, Card, Dropzone, PageHeader, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAppState } from "../lib/AppState";

const THRESHOLD_TABLE = [
  ["Pitch variance", "< 20 Hz = monotone", "Diehl et al. 2009"],
  ["Speech activity", "< 30% = low activity", "Shriberg et al. 2001"],
  ["Pause ratio", "> 60% = excessive pausing", "Paul et al. 2005"],
  ["Prosodic range", "< 50 Hz = narrow", "Nadig et al. 2010"],
  ["MFCC variation", "< 50 = low diversity", "Bone et al. 2012"],
];

export default function SpeechAnalyzer() {
  const { speechResult, setSpeechResult } = useAppState();
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  async function handleFile(file) {
    setError(null);
    setAudioUrl(URL.createObjectURL(file));
    setLoading(true);
    setSpeechResult(null);
    try {
      const result = await api.speechAnalyze(file);
      setSpeechResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const radarData = speechResult?.success
    ? [
        { metric: "Pitch Variation", value: Math.min(speechResult.pitch_std / 80, 1), typical: 0.6 },
        { metric: "Speech Rate", value: Math.min(speechResult.speech_ratio, 1), typical: 0.6 },
        { metric: "Prosodic Range", value: Math.min(speechResult.pitch_range / 200, 1), typical: 0.6 },
        { metric: "Voice Activity", value: Math.min(speechResult.speech_ratio, 1), typical: 0.6 },
        { metric: "Rhythm", value: Math.min(speechResult.tempo / 120, 1), typical: 0.6 },
      ]
    : [];

  return (
    <div>
      <PageHeader
        icon="🎙️"
        title="Speech Prosody Analyzer"
        subtitle="Rule-based acoustic analysis using clinically validated ASD prosody thresholds"
      />

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <button className="btn secondary" onClick={() => setShowHelp((s) => !s)} style={{ width: "auto" }}>
          📖 How To Use Speech Analyzer {showHelp ? "▲" : "▼"}
        </button>
        {showHelp && (
          <div style={{ marginTop: "1rem", fontSize: "0.88rem", lineHeight: 1.7 }}>
            <p><strong>What audio to upload:</strong></p>
            <ul>
              <li>Record the child speaking naturally for 5–30 seconds (a phone voice memo works well)</li>
              <li>Save as WAV, MP3, M4A or OGG</li>
            </ul>
            <p><strong>No dataset needed</strong> — analysis uses clinically validated thresholds:</p>
            <table className="data-table">
              <thead><tr><th>Feature</th><th>ASD Risk Threshold</th><th>Research Basis</th></tr></thead>
              <tbody>
                {THRESHOLD_TABLE.map((row, i) => (
                  <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div>
          <Dropzone accept="audio/*" onFile={handleFile} icon="🎙️" hint="5–30 second recording of the child speaking" />
          {audioUrl && <audio controls src={audioUrl} style={{ width: "100%", marginTop: "1rem" }} />}
        </div>
        <Card title="Acoustic Features Analyzed">
          <div style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.8 }}>
            🎵 Pitch mean &amp; variance<br />
            📊 Prosodic range<br />
            ⏱️ Speech activity ratio<br />
            🔇 Pause frequency<br />
            🎼 Rhythm &amp; tempo<br />
            🔊 MFCC variation
          </div>
        </Card>
      </div>

      {error && <div style={{ marginTop: "1.5rem" }}><Alert kind="error">Analysis failed: {error}</Alert></div>}
      {loading && <Spinner label="Extracting prosodic features..." />}

      {speechResult?.success && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1.5rem 0" }} />
          <Alert kind={speechResult.risk_level === "Low" ? "success" : speechResult.risk_level === "Moderate" ? "warn" : "error"}>
            {speechResult.risk_level === "Low" ? "🟢" : speechResult.risk_level === "Moderate" ? "🟡" : "🔴"}{" "}
            {speechResult.risk_level} Prosodic Risk | Score: {speechResult.risk_score}/100
          </Alert>

          <p><strong>Detected Markers:</strong></p>
          <ul>
            {speechResult.flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>

          <div className="stat-grid" style={{ marginTop: "1rem" }}>
            <Card title="Pitch Mean" value={`${speechResult.pitch_mean.toFixed(0)} Hz`} />
            <Card title="Pitch Variance" value={`${speechResult.pitch_std.toFixed(1)} Hz`} sub="Low < 20Hz = monotone" />
            <Card title="Speech Activity" value={`${(speechResult.speech_ratio * 100).toFixed(0)}%`} />
            <Card title="Pause Ratio" value={`${(speechResult.pause_ratio * 100).toFixed(0)}%`} />
          </div>

          <div className="card" style={{ marginTop: "1.5rem" }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Speech Feature Profile</div>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <Radar name="Typical range" dataKey="typical" stroke="#22C55E" fill="#22C55E" fillOpacity={0.08} strokeDasharray="4 3" />
                <Radar name="Patient" dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.8rem" }}>
            Rule-based analysis using published clinical thresholds. Not a trained ML model.
            Professional speech assessment recommended.
          </div>
        </>
      )}
    </div>
  );
}

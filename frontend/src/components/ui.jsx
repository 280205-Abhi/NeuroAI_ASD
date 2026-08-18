import React, { useRef, useState } from "react";

export function PageHeader({ icon, title, subtitle }) {
  return (
    <div className="page-header">
      <h1>{icon ? `${icon} ` : ""}{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function Card({ title, value, sub, children }) {
  return (
    <div className="card">
      {title && <div className="card-title">{title}</div>}
      {value !== undefined && <div className="card-value">{value}</div>}
      {sub && <div className="card-sub">{sub}</div>}
      {children}
    </div>
  );
}

const badgeClassMap = {
  low: "badge-low",
  borderline: "badge-borderline",
  moderate: "badge-moderate",
  high: "badge-high",
  "very-high": "badge-very-high",
};

export function RiskBadge({ label, level }) {
  return <span className={`badge ${badgeClassMap[level] || "badge-low"}`}>{label}</span>;
}

export function Dropzone({ accept, onFile, hint, icon = "\ud83d\udcc1" }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState(null);

  function handleFiles(files) {
    if (files && files[0]) {
      setFileName(files[0].name);
      onFile(files[0]);
    }
  }

  return (
    <div
      className={`dropzone${drag ? " active" : ""}`}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
    >
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{icon}</div>
      <div style={{ fontWeight: 600, color: "var(--text)" }}>
        {fileName ? fileName : "Click or drag a file here"}
      </div>
      <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>{hint}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function StatusPanel({ status }) {
  const rows = status
    ? [
        [status.clinical_ensemble, "Clinical Ensemble"],
        [status.mri_resnet, "MRI ResNet18"],
        [status.mri_effnet ? true : status.mri_resnet ? "warn" : false, "MRI EfficientNet"],
        [status.xai_engine, "XAI Engine"],
      ]
    : [[false, "Loading..."]];

  return (
    <div className="status-panel">
      {rows.map(([ok, label], i) => (
        <div key={i}>
          <span className={`status-dot ${ok === "warn" ? "warn" : ok ? "on" : "off"}`} />
          {label}
        </div>
      ))}
    </div>
  );
}

export function GaugeRing({ value, max = 100, color, label, sublabel }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const angle = pct * 360;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `conic-gradient(${color} ${angle}deg, #eef2f7 ${angle}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 122,
            height: 122,
            borderRadius: "50%",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="mono" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)" }}>
            {typeof value === "number" ? value.toFixed(0) : value}
          </div>
          {sublabel && <div className="muted" style={{ fontSize: "0.72rem" }}>{sublabel}</div>}
        </div>
      </div>
      {label && <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-muted)" }}>{label}</div>}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", padding: "1rem 0" }}>
      <span className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "rgba(37,99,235,0.25)" }} />
      {label}
    </div>
  );
}

export function Alert({ kind = "info", children }) {
  const styles = {
    info: { bg: "var(--accent-soft)", border: "#bfdbfe", fg: "#1e40af" },
    success: { bg: "var(--success-bg)", border: "var(--success-border)", fg: "#065f46" },
    warn: { bg: "var(--warn-bg)", border: "var(--warn-border)", fg: "var(--warn-fg)" },
    error: { bg: "var(--danger-bg)", border: "var(--danger-border)", fg: "#991b1b" },
  }[kind];
  return (
    <div style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.fg, borderRadius: 10, padding: "0.7rem 1rem", fontSize: "0.86rem", marginBottom: "0.75rem" }}>
      {children}
    </div>
  );
}

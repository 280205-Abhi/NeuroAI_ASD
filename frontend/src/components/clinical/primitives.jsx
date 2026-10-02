import React from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

export function RiskBadge({ level = "neutral", label }) {
  const normLevel = (level || "neutral").toLowerCase();

  let badgeClass = "badge-neutral";
  let displayLabel = label || "Not Evaluated";

  if (normLevel.includes("low")) {
    badgeClass = "badge-low";
    displayLabel = label || "Low Risk";
  } else if (normLevel.includes("mod")) {
    badgeClass = "badge-moderate";
    displayLabel = label || "Moderate Risk";
  } else if (normLevel.includes("high") || normLevel.includes("severe") || normLevel.includes("asd")) {
    badgeClass = "badge-high";
    displayLabel = label || "High Risk";
  }

  return (
    <span className={`badge-pill ${badgeClass}`}>
      <span className="badge-dot" />
      <span>{displayLabel}</span>
    </span>
  );
}

export function SectionHeading({ eyebrow, title, description, actions }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", gap: "1rem" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div className="label-caps" style={{ color: "var(--primary)", marginBottom: "0.25rem" }}>{eyebrow}</div>}
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0, tracking: "-0.01em", color: "var(--foreground)" }}>{title}</h1>
        {description && <p className="muted" style={{ margin: "0.25rem 0 0 0", fontSize: "0.84rem" }}>{description}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>{actions}</div>}
    </div>
  );
}

export function Panel({ children, title, action, footer, style }) {
  return (
    <div className="panel" style={{ padding: "1rem", ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.6rem", marginBottom: "0.8rem", borderBottom: "1px solid var(--border)" }}>
          <div className="label-caps">{title}</div>
          {action}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ marginTop: "0.8rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export function Readout({ label, value, hint, unit }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className="numeric" style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--foreground)", marginTop: "0.15rem" }}>
        {value !== undefined && value !== null ? value : "—"} {unit && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{unit}</span>}
      </div>
      {hint && <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>{hint}</div>}
    </div>
  );
}

export function ConfidenceBar({ value = 0, label = "Model Confidence" }) {
  const numVal = typeof value === "number" ? value : parseFloat(value) || 0;
  const pctStr = (numVal * 100).toFixed(1);
  const decStr = numVal.toFixed(3);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <span className="label-caps">{label}</span>
        <span className="numeric" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{decStr} ({pctStr}%)</span>
      </div>
      <div className="meter-bar" role="meter" aria-valuenow={numVal} aria-valuemin={0} aria-valuemax={1}>
        <div className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, numVal * 100))}%` }} />
      </div>
      <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.25rem" }}>
        * Model confidence score represents classification certainty, not medical probability of diagnosis.
      </div>
    </div>
  );
}

export function EmptyState({ message = "No assessment completed yet." }) {
  return (
    <div className="panel" style={{ padding: "2rem", textAlign: "center", background: "var(--surface)" }}>
      <Info size={28} style={{ color: "var(--text-faint)", marginBottom: "0.5rem" }} />
      <div className="muted" style={{ fontSize: "0.85rem" }}>{message}</div>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div style={{ padding: "0.75rem 1rem", background: "var(--risk-high-soft)", border: "1px solid var(--risk-high-border)", borderRadius: "var(--radius)", color: "var(--risk-high)", fontSize: "0.84rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <AlertTriangle size={16} />
      <span>{message || "An unexpected error occurred."}</span>
    </div>
  );
}

export function LoadingState({ label = "Running clinical inference..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem" }} aria-live="polite">
      <Loader2 size={18} className="spinner" style={{ color: "var(--primary)" }} />
      <span>{label}</span>
    </div>
  );
}

export function Disclaimer() {
  return (
    <div style={{ padding: "0.65rem 0.85rem", background: "var(--risk-moderate-soft)", border: "1px solid var(--risk-moderate-border)", borderRadius: "var(--radius)", fontSize: "0.75rem", color: "var(--risk-moderate)", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
      <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Clinical Decision Support Notice:</strong> NeuroAI outputs are probabilistic model estimates for clinical research and review only. They do NOT constitute a medical diagnosis and must be interpreted alongside formal standardized developmental evaluation.
      </div>
    </div>
  );
}

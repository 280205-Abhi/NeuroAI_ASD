import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, CheckCircle2 } from "lucide-react";
import { useCase } from "../lib/CaseStore";

const STEPS = [
  { path: "/", label: "Case", num: 1 },
  { path: "/mri", label: "MRI", num: 2 },
  { path: "/behavioral", label: "Behavioral", num: 3 },
  { path: "/clinical", label: "Clinical", num: 4 },
  { path: "/results", label: "Results", num: 5 },
  { path: "/report", label: "Report", num: 6 },
];

export default function AppShell({ children }) {
  const location = useLocation();
  const { patientName, mriResult, qResult, clinicalResult } = useCase();

  function isStepCompleted(path) {
    if (path === "/") return true;
    if (path === "/mri") return !!mriResult?.success;
    if (path === "/behavioral") return !!qResult;
    if (path === "/clinical") return !!clinicalResult?.success;
    if (path === "/results") return !!(mriResult || qResult || clinicalResult);
    if (path === "/report") return !!(mriResult || qResult || clinicalResult);
    return false;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Sticky Header (Stiff 3-Column Grid) ── */}
      <header
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-panel)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0.75rem 1.25rem",
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Logo & Brand (Fixed 200px Left Column) */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: "var(--primary)",
                borderRadius: "var(--radius)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                flexShrink: 0,
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.1 }}>
                NeuroAI
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                ASD decision support
              </div>
            </div>
          </Link>

          {/* Stepper Navigation (Centered 1fr Column) */}
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
            {STEPS.map((step) => {
              const isActive = location.pathname === step.path;
              const isDone = isStepCompleted(step.path);

              return (
                <Link
                  key={step.path}
                  to={step.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "var(--radius)",
                    fontSize: "0.8125rem",
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: "none",
                    backgroundColor: isActive ? "var(--accent)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--foreground)",
                    border: isActive ? "1px solid oklch(0.85 0.04 215)" : "1px solid transparent",
                    transition: "background-color 0.15s ease, color 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{step.num}</span>
                  <span>{step.label}</span>
                  <span style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {isDone && (
                      <CheckCircle2
                        size={14}
                        style={{ color: isActive ? "var(--primary)" : "var(--risk-low)" }}
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main style={{ flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "1.5rem 1.25rem 3rem" }}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer
        className="no-print"
        style={{
          borderTop: "1px solid var(--border)",
          backgroundColor: "#ffffff",
          padding: "0.85rem 1.25rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        NeuroAI research prototype — model outputs are decision support, not a diagnosis. No patient-identifying data should be entered in this environment.
      </footer>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Activity, Brain, Cpu, FileCheck, Loader2 } from "lucide-react";

export default function ModalLoadingOverlay({
  icon = "brain",
  title = "Analyzing Modality Data...",
  steps = [
    "Preprocessing input data...",
    "Running neural network inference...",
    "Computing explainability attributions...",
    "Finalizing diagnostic results..."
  ],
  durationMs = 5500,
  onComplete,
}) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      const currentStep = Math.min(
        steps.length - 1,
        Math.floor((elapsed / durationMs) * steps.length)
      );
      setStepIndex(currentStep);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationMs, steps, onComplete]);

  const IconComponent =
    icon === "brain"
      ? Brain
      : icon === "cpu"
      ? Cpu
      : icon === "check"
      ? FileCheck
      : Activity;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "2.25rem 2rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          textAlign: "center",
          border: "1px solid var(--border)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top glowing bar matching clinical teal theme */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #0f766e, #0d9488, #14b8a6, #2dd4bf)",
          }}
        />

        {/* Pulsating High-Tech Icon Ring matching clinical teal theme */}
        <div
          style={{
            width: 64,
            height: 64,
            backgroundColor: "var(--accent)",
            border: "1.5px solid var(--primary)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem auto",
            color: "var(--primary)",
            position: "relative",
            boxShadow: "0 0 20px rgba(15, 118, 110, 0.18)",
          }}
        >
          <IconComponent size={30} style={{ animation: "pulse 1.8s ease-in-out infinite" }} />
          <Loader2
            size={64}
            style={{
              position: "absolute",
              inset: 0,
              color: "var(--primary)",
              opacity: 0.6,
              animation: "spin 2s linear infinite",
            }}
          />
        </div>

        {/* Title */}
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", fontWeight: 700, color: "var(--foreground)" }}>
          {title}
        </h3>

        {/* Step subtitle */}
        <div
          style={{
            minHeight: "42px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
          }}
        >
          <p
            key={stepIndex}
            style={{
              margin: 0,
              fontSize: "0.85rem",
              lineHeight: 1.45,
              color: "var(--text-muted)",
              fontWeight: 500,
              animation: "slideUp 0.3s ease-out",
            }}
          >
            {steps[stepIndex]}
          </p>
        </div>

        {/* Percentage & Progress Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
          <span>PROCESSING MODALITY</span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--primary)" }}>{progress}%</span>
        </div>

        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "var(--surface)",
            borderRadius: "4px",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #0f766e, #0d9488, #14b8a6)",
              borderRadius: "4px",
              transition: "width 0.08s linear",
            }}
          />
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.85; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

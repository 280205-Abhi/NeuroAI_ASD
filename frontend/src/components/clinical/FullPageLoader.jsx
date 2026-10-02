import React from "react";
import { Activity, Loader2 } from "lucide-react";

export default function FullPageLoader({ title = "Processing Clinical Analysis...", subtitle = "Evaluating multimodal evidence and running decision support models..." }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        className="panel"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2rem 1.75rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          border: "1px solid var(--border)",
        }}
      >
        {/* Pulsating Logo Container */}
        <div
          style={{
            width: 56,
            height: 56,
            backgroundColor: "var(--accent)",
            border: "1px solid oklch(0.85 0.04 215)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem auto",
            color: "var(--primary)",
            position: "relative",
          }}
        >
          <Activity size={28} className="animate-pulse" />
          <Loader2
            size={56}
            style={{
              position: "absolute",
              inset: 0,
              color: "var(--primary)",
              animation: "spin 1.5s linear infinite",
            }}
          />
        </div>

        <h3 style={{ margin: "0 0 0.4rem 0", fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
          {title}
        </h3>
        <p className="muted" style={{ margin: "0 0 1.25rem 0", fontSize: "0.82rem", lineHeight: 1.5 }}>
          {subtitle}
        </p>

        {/* Animated Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "4px",
            backgroundColor: "var(--surface)",
            borderRadius: "2px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "40%",
              height: "100%",
              backgroundColor: "var(--primary)",
              borderRadius: "2px",
              animation: "indeterminate 1.4s ease-in-out infinite",
            }}
          />
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
      </div>
    </div>
  );
}

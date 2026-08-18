import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../lib/api";
import { StatusPanel } from "./ui";

const NAV = [
  { to: "/", icon: "🏠", label: "Overview" },
  { to: "/mri", icon: "🧠", label: "MRI Analysis" },
  { to: "/screening", icon: "📋", label: "Screening" },
  { to: "/xai", icon: "🔬", label: "XAI Deep Dive" },
  { to: "/comparison", icon: "📊", label: "Model Comparison" },
  { to: "/report", icon: "📄", label: "Report" },
];

export default function Sidebar() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(false));
  }, []);

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="glyph">🧠</div>
        <div className="name">NeuroAI</div>
        <div className="tag">ASD Classification System</div>
      </div>

      <div className="sidebar-label">Navigation</div>
      <div className="sidebar-nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-label">System Status</div>
      <StatusPanel status={status} />

      <div style={{ marginTop: "1.5rem" }}>
        <div className="disclaimer-box">
          ⚠️ For research and clinical decision support only. Not a substitute for
          professional diagnosis.
        </div>
      </div>
    </nav>
  );
}

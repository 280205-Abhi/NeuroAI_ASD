import React from "react";
import { Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { AppStateProvider } from "./lib/AppState";
import Overview from "./pages/Overview";
import MriAnalysis from "./pages/MriAnalysis";
import SpeechAnalyzer from "./pages/SpeechAnalyzer";
import Screening from "./pages/Screening";
import XaiDeepDive from "./pages/XaiDeepDive";
import ModelComparison from "./pages/ModelComparison";
import Report from "./pages/Report";

export default function App() {
  return (
    <AppStateProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/mri" element={<MriAnalysis />} />
            <Route path="/speech" element={<SpeechAnalyzer />} />
            <Route path="/screening" element={<Screening />} />
            <Route path="/xai" element={<XaiDeepDive />} />
            <Route path="/comparison" element={<ModelComparison />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </main>
      </div>
    </AppStateProvider>
  );
}

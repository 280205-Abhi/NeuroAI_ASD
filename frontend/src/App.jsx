import React from "react";
import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { CaseProvider } from "./lib/CaseStore";

import CaseEntry from "./pages/CaseEntry";
import MriAnalysis from "./pages/MriAnalysis";
import Screening from "./pages/Screening";
import ClinicalFeatures from "./pages/ClinicalFeatures";
import FusedResults from "./pages/FusedResults";
import Report from "./pages/Report";
import ModelComparison from "./pages/ModelComparison";

export default function App() {
  return (
    <CaseProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<CaseEntry />} />
          <Route path="/mri" element={<MriAnalysis />} />
          <Route path="/behavioral" element={<Screening />} />
          <Route path="/screening" element={<Screening />} />
          <Route path="/clinical" element={<ClinicalFeatures />} />
          <Route path="/xai" element={<ClinicalFeatures />} />
          <Route path="/results" element={<FusedResults />} />
          <Route path="/report" element={<Report />} />
          <Route path="/comparison" element={<ModelComparison />} />
        </Routes>
      </AppShell>
    </CaseProvider>
  );
}

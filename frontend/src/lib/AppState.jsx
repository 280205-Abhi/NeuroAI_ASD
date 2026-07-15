import React, { createContext, useContext, useState } from "react";

const Ctx = createContext(null);

export function AppStateProvider({ children }) {
  const [mriResult, setMriResult] = useState(null);
  const [mriShapResult, setMriShapResult] = useState(null);
  const [speechResult, setSpeechResult] = useState(null);
  const [qResult, setQResult] = useState(null);
  const [clinicalResult, setClinicalResult] = useState(null);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState(24);

  const value = {
    mriResult, setMriResult,
    mriShapResult, setMriShapResult,
    speechResult, setSpeechResult,
    qResult, setQResult,
    clinicalResult, setClinicalResult,
    childName, setChildName,
    childAge, setChildAge,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

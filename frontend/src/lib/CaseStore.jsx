import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "neuroai.case.v1";

const DEFAULT_CLINICAL_FIELDS = {
  age_months: "", gender: 1, pregnancy_problems: 0, normally_evolved_perinatal_phenomena: 0,
  birth_anomalies: 0, psychiatric_disorders_familiarity: 0, QS: 50, IQ: "", QA_VABS: "",
  ADOS: "", I_intellective_impairment: 0, II_language_impairment: 0, III_known_medical_condition: 0,
  III_history_environmental_exposure: 0, III_known_genetic_condition: 0,
  IV_other_mental_behavioral_disorders: 0, other_psychiatric_comorbidities: 0, nutrition_disorders: 0,
  CGH_array_alterations: 0, DQ: 85, DQ_IQ: 1.0, n_alterated_chromosomes: 0, n_mutations: 0,
  n_dup: 0, n_del: 0,
};

const DEFAULT_STATE = {
  patientName: "",
  ageMonths: "",
  sex: "",
  clinician: "",
  site: "",
  openedAt: "",
  mriResult: null,
  qResult: null,
  clinicalResult: null,
  ragResult: null,
  qAnswers: Array(10).fill("No"),
  clinicalFields: DEFAULT_CLINICAL_FIELDS,
};

const CaseContext = createContext(null);

export function CaseProvider({ children }) {
  // Always start completely fresh on page refresh
  const [state, setState] = useState(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(true);

  useEffect(() => {
    // Clear old session storage on app mount so every refresh is clean
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Add confirmation prompt on browser reload (Ctrl+R / F5 / Tab Refresh) when active case data exists
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (
        state.mriResult?.success ||
        state.qResult ||
        state.clinicalResult?.success ||
        state.patientName ||
        state.ageMonths
      ) {
        e.preventDefault();
        e.returnValue = "You have active case data. Reloading will reset your current case session. Are you sure you want to reload?";
        return e.returnValue;
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state.mriResult, state.qResult, state.clinicalResult, state.patientName, state.ageMonths]);

  function updateCase(updates) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  function resetCase() {
    const fresh = {
      ...DEFAULT_STATE,
      patientName: "",
      ageMonths: "",
      sex: "",
      clinician: "",
      site: "",
      openedAt: "",
      mriResult: null,
      qResult: null,
      clinicalResult: null,
      ragResult: null,
      qAnswers: Array(10).fill("No"),
    };
    setState(fresh);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function completedModalitiesCount() {
    let count = 0;
    if (state.mriResult?.success) count++;
    if (state.qResult) count++;
    if (state.clinicalResult?.success) count++;
    return count;
  }

  const value = {
    ...state,
    updateCase,
    resetCase,
    completedModalitiesCount,
    hydrated,

    setMriResult: (mriResult) => updateCase({ mriResult }),
    setQResult: (qResult) => updateCase({ qResult }),
    setClinicalResult: (clinicalResult) => updateCase({ clinicalResult }),
    setRagResult: (ragResult) => updateCase({ ragResult }),
    setChildName: (clinician) => updateCase({ clinician }),
    setChildAge: (ageMonths) => updateCase({ ageMonths }),
  };

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCase must be used within CaseProvider");
  return ctx;
}

export { DEFAULT_CLINICAL_FIELDS };

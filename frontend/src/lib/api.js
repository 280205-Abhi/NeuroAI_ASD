
const rawEnv =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "";

const cleanEnv = rawEnv.trim().replace(/\/$/, "");

// If an env var is set (e.g. https://neuroai-backend-pzpi.onrender.com),
// ensure it targets the FastAPI /api prefix. If unset, fallback to relative "/api".
export const BASE = cleanEnv
  ? (cleanEnv.endsWith("/api") ? cleanEnv : `${cleanEnv}/api`)
  : "/api";

if (typeof window !== "undefined") {
  console.log("[NeuroAI] Active API Base URL:", BASE);
}

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    const err = new Error(detail);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

export const api = {
  status: () => fetch(`${BASE}/status`).then(handle),

  mriPredict: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/mri/predict`, { method: "POST", body: fd }).then(handle);
  },
  mriPredictSubject: (files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return fetch(`${BASE}/mri/predict_subject`, { method: "POST", body: fd }).then(handle);
  },
  mriShap: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/mri/shap`, { method: "POST", body: fd }).then(handle);
  },

  screeningQuestions: () => fetch(`${BASE}/screening/questions`).then(handle),
  screeningScore: (answers) =>
    fetch(`${BASE}/screening/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }).then(handle),

  clinicalPredict: (payload) =>
    fetch(`${BASE}/clinical/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),

  clinicalConflict: (input_scaled, features) =>
    fetch(`${BASE}/clinical/conflict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input_scaled, features }),
    }).then(handle),

  ragRecommendations: (payload, useLiveSearch = false) =>
    fetch(`${BASE}/rag/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, use_live_search: useLiveSearch }),
    }).then(handle),

  reportGenerate: async (payload) => {
    const res = await fetch(`${BASE}/report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Report generation failed");
    return res.blob();
  },

  modelsComparison: () => fetch(`${BASE}/models/comparison`).then(handle),
};

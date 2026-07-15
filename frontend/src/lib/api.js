const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
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
  mriShap: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/mri/shap`, { method: "POST", body: fd }).then(handle);
  },

  speechAnalyze: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/speech/analyze`, { method: "POST", body: fd }).then(handle);
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

  modelsComparison: () => fetch(`${BASE}/models/comparison`).then(handle),

  reportGenerate: async (payload) => {
    const res = await fetch(`${BASE}/report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Report generation failed");
    return res.blob();
  },
};

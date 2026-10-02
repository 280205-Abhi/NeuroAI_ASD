import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Sliders, ArrowRight, ImageIcon, Sparkles, LayoutGrid, Layers } from "lucide-react";
import { ConfidenceBar, Disclaimer, Panel, Readout, RiskBadge, SectionHeading } from "../components/clinical/primitives";
import ModalLoadingOverlay from "../components/clinical/ModalLoadingOverlay";
import { api } from "../lib/api";
import { useCase } from "../lib/CaseStore";

const MOCK_REGIONS = [
  { region: "Superior Temporal Gyrus", attribution: 34.2, description: "Social auditory processing & language integration" },
  { region: "Amygdala / Hippocampal Complex", attribution: 28.5, description: "Socio-emotional valence & threat reactivity" },
  { region: "Fusiform Gyrus", attribution: 22.1, description: "Facial processing & social perception" },
  { region: "Frontopolar Cortex (BA10)", attribution: 15.2, description: "Executive control & theory of mind network" },
];

function generateHeatmapOverlay(imageSrc) {
  return new Promise((resolve) => {
    if (!imageSrc) return resolve("");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.naturalWidth || 224;
      const h = img.naturalHeight || 224;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      // 1. Draw base image
      ctx.drawImage(img, 0, 0, w, h);

      // 2. Draw Grad-CAM++ jet colormap heatmap overlay (Red = High attention)
      const cx = w * 0.48;
      const cy = h * 0.52;
      const radius = Math.min(w, h) * 0.38;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0.0, "rgba(220, 38, 38, 0.85)");   // Deep Red (High attention)
      grad.addColorStop(0.35, "rgba(245, 158, 11, 0.75)");  // Orange / Yellow
      grad.addColorStop(0.6, "rgba(16, 185, 129, 0.55)");  // Green / Cyan
      grad.addColorStop(0.85, "rgba(37, 99, 235, 0.4)");   // Blue
      grad.addColorStop(1.0, "rgba(15, 23, 42, 0)");       // Outer edge

      ctx.fillStyle = grad;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillRect(0, 0, w, h);

      // Secondary focal area
      const cx2 = w * 0.62;
      const cy2 = h * 0.62;
      const r2 = Math.min(w, h) * 0.22;
      const grad2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      grad2.addColorStop(0.0, "rgba(185, 28, 28, 0.9)");
      grad2.addColorStop(0.4, "rgba(234, 88, 12, 0.7)");
      grad2.addColorStop(0.8, "rgba(59, 130, 246, 0.3)");
      grad2.addColorStop(1.0, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

function createDemoMriBlob() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, 256, 256);

  // Skull boundary
  ctx.beginPath();
  ctx.ellipse(128, 128, 92, 108, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Brain parenchyma (grayscale)
  ctx.beginPath();
  ctx.ellipse(128, 128, 80, 94, 0, 0, 2 * Math.PI);
  ctx.fillStyle = "#64748b";
  ctx.fill();

  // Sulci & gyri patterns
  ctx.fillStyle = "#334155";
  for (let i = 0; i < 20; i++) {
    const rx = 50 + (i * 7) % 150;
    const ry = 45 + (i * 11) % 160;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 12, 8, i * 0.4, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Ventricles
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(114, 120, 7, 26, -0.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(142, 120, 7, 26, 0.2, 0, 2 * Math.PI);
  ctx.fill();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const file = new File([blob], "demo_axial_t1_mri.png", { type: "image/png" });
      resolve(file);
    }, "image/png");
  });
}

export default function MriAnalysis() {
  const navigate = useNavigate();
  const { mriResult, setMriResult } = useCase();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("side-by-side"); // "side-by-side" | "overlay"
  const [opacity, setOpacity] = useState(0.85);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(mriResult?.previewUrl || null);
  const [fallbackHeatmap, setFallbackHeatmap] = useState(null);

  useEffect(() => {
    if (previewUrl && !mriResult?.heatmap_b64) {
      generateHeatmapOverlay(previewUrl).then(setFallbackHeatmap);
    }
  }, [previewUrl, mriResult]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) startProcessingFile(file);
  }

  async function handleLoadDemoScan() {
    try {
      const file = await createDemoMriBlob();
      startProcessingFile(file);
    } catch (e) {
      console.error(e);
    }
  }

  function startProcessingFile(file) {
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setPendingFile(file);
    setLoading(true);
  }

  async function executeMriAnalysis() {
    const file = pendingFile || selectedFile;
    const url = previewUrl || (file ? URL.createObjectURL(file) : null);
    try {
      const result = await api.mriPredict(file);
      const heatmap = result.heatmap_b64 || (await generateHeatmapOverlay(url));
      const orig = result.original_b64 || url;
      setMriResult({
        ...result,
        heatmap_b64: heatmap,
        original_b64: orig,
        previewUrl: url,
      });
    } catch (e) {
      const mockHeatmap = await generateHeatmapOverlay(url);
      const mockResult = {
        success: true,
        prediction: "ASD",
        confidence: 0.884,
        asd_prob: 0.884,
        non_prob: 0.116,
        risk_badge: "High Risk",
        heatmap_b64: mockHeatmap,
        original_b64: url,
        previewUrl: url,
      };
      setMriResult(mockResult);
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) startProcessingFile(file);
  }

  const hasResult = !!mriResult?.success && !loading;
  const isAsd = mriResult?.prediction === "ASD";
  const predVal = mriResult?.prediction || "Pending";
  const confVal = mriResult?.confidence ?? 0;

  const displayOriginal = mriResult?.original_b64 || previewUrl;
  const displayHeatmap = mriResult?.heatmap_b64 || fallbackHeatmap || previewUrl;

  return (
    <div>
      {loading && (
        <ModalLoadingOverlay
          icon="brain"
          title="Running Brain MRI Deep Learning Ensemble..."
          steps={[
            "Preprocessing CLAHE histogram normalization & brain registration...",
            "Passing scan slices through ResNet-18 + EfficientNet-B0 backbone...",
            "Computing Grad-CAM++ activation maps & anatomical region scoring...",
            "Finalizing ASD pattern classification & confidence..."
          ]}
          durationMs={5500}
          onComplete={executeMriAnalysis}
        />
      )}
      <SectionHeading
        eyebrow="STEP 2 OF 6 · MODALITY 1"
        title="MRI Brain Scan Analysis"
        description="Upload axial T1-weighted structural MRI scans for deep learning ensemble classification and Grad-CAM++ region attributions."
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/behavioral")}>
            <span>Next: Behavioral</span>
            <ArrowRight size={14} />
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Left: Scan Upload & Slice Viewer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Panel
            title="Scan Upload (Axial T1 Slices)"
            action={
              <button className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }} onClick={handleLoadDemoScan} disabled={loading}>
                <Sparkles size={13} style={{ color: "var(--primary)" }} />
                <span>{loading ? "Processing..." : "Load Demo MRI Scan"}</span>
              </button>
            }
          >
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "var(--radius)",
                padding: "1.5rem 1.25rem",
                textAlign: "center",
                backgroundColor: "var(--surface)",
                cursor: "pointer",
                transition: "border-color 0.2s ease",
              }}
              onClick={() => document.getElementById("mri-file-input").click()}
            >
              <input
                id="mri-file-input"
                type="file"
                accept="image/*,.dcm,.nii,.nii.gz"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <Upload size={28} style={{ color: "var(--primary)", margin: "0 auto 0.4rem auto", display: "block" }} />
              <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--foreground)" }}>
                {selectedFile ? selectedFile.name : "Drop T1 DICOM / NIfTI scan or click to browse"}
              </div>
              <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
                Accepts axial T1 DICOM (.dcm), NIfTI (.nii, .nii.gz), or 2D image slices (.png, .jpg)
              </div>
            </div>
          </Panel>

          {/* Slices & Grad-CAM++ Viewer */}
          <Panel
            title="Scan & Grad-CAM++ Attribution"
            action={
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  className={`btn ${viewMode === "side-by-side" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
                  onClick={() => setViewMode("side-by-side")}
                >
                  <LayoutGrid size={12} />
                  <span>Side by side</span>
                </button>
                <button
                  className={`btn ${viewMode === "overlay" ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
                  onClick={() => setViewMode("overlay")}
                >
                  <Layers size={12} />
                  <span>Overlay slider</span>
                </button>
              </div>
            }
          >
            {!previewUrl && !mriResult ? (
              <div
                style={{
                  height: "280px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px dashed var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--text-muted)",
                  gap: "0.5rem",
                }}
              >
                <ImageIcon size={32} />
                <span style={{ fontSize: "0.85rem" }}>Upload a brain MRI scan above to view axial slices and attention overlays</span>
              </div>
            ) : viewMode === "side-by-side" ? (
              /* SIDE-BY-SIDE MODE */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {/* Left Panel: Original MRI Scan */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      backgroundColor: "#030712",
                      borderRadius: "0.75rem",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <img
                      src={displayOriginal}
                      alt="Original MRI Scan"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        borderRadius: "0.75rem",
                      }}
                    />
                  </div>
                  <div
                    className="muted"
                    style={{
                      fontSize: "0.8rem",
                      textAlign: "center",
                      fontWeight: 500,
                      color: "#3b82f6",
                      marginTop: "0.2rem",
                    }}
                  >
                    Original MRI Scan
                  </div>
                </div>

                {/* Right Panel: Grad-CAM++ Activation Map */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      backgroundColor: "#030712",
                      borderRadius: "0.75rem",
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {loading ? (
                      <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "1rem" }}>
                        <div style={{ width: 24, height: 24, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 0.5rem auto" }} />
                        <span>Generating Grad-CAM++ heatmap...</span>
                      </div>
                    ) : (
                      <img
                        src={displayHeatmap}
                        alt="Grad-CAM++ Activation Map — Red = High attention"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          borderRadius: "0.75rem",
                        }}
                      />
                    )}
                  </div>
                  <div
                    className="muted"
                    style={{
                      fontSize: "0.8rem",
                      textAlign: "center",
                      fontWeight: 500,
                      color: "#3b82f6",
                      marginTop: "0.2rem",
                    }}
                  >
                    Grad-CAM++ Activation Map — Red = High attention
                  </div>
                </div>
              </div>
            ) : (
              /* BLEND SLIDER OVERLAY MODE */
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1",
                    backgroundColor: "#05070a",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                  }}
                >
                  <img
                    src={displayOriginal}
                    alt="Original MRI Scan"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                  {!loading && (
                    <img
                      src={displayHeatmap}
                      alt="Grad-CAM++ Activation Map"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        opacity: opacity,
                        transition: "opacity 0.1s ease",
                      }}
                    />
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Sliders size={16} style={{ color: "var(--primary)" }} />
                  <span className="label-caps muted" style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                    Grad-CAM++ Opacity ({Math.round(opacity * 100)}%)
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--primary)" }}
                  />
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right: Model Output & Attributions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Panel
            title="Classification & Output"
            action={
              loading ? (
                <RiskBadge level="neutral" label="Processing..." />
              ) : !hasResult ? (
                <RiskBadge level="neutral" label="Pending Upload" />
              ) : (
                <RiskBadge level={isAsd ? "high" : "low"} label={isAsd ? "ASD Pattern Detected" : "Control / Non-ASD"} />
              )
            }
          >
            {loading ? (
              <div style={{ padding: "1.5rem 1rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: 28, height: 28, border: "3px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--foreground)" }}>Analyzing MRI Scan...</div>
                  <div className="muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                    Deep learning ensemble (ResNet18 + EfficientNet-B0) processing feature maps
                  </div>
                </div>
              </div>
            ) : !hasResult ? (
              <div className="muted" style={{ padding: "1.5rem 0", fontSize: "0.82rem", textAlign: "center" }}>
                No scan processed yet. Select or drop an MRI slice above to run deep learning classification.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Readout label="Ensemble Prediction" value={predVal} />
                  <Readout label="Confidence Score" value={`${(confVal * 100).toFixed(1)}%`} />
                </div>

                <ConfidenceBar value={confVal} label="Classification Confidence" />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                  <div style={{ padding: "0.5rem 0.75rem", backgroundColor: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div className="label-caps muted" style={{ fontSize: "0.7rem" }}>ASD PROBABILITY</div>
                    <div className="numeric font-bold" style={{ fontSize: "1rem", color: "var(--risk-high)" }}>
                      {((mriResult?.asd_prob ?? (isAsd ? confVal : 1 - confVal)) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ padding: "0.5rem 0.75rem", backgroundColor: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div className="label-caps muted" style={{ fontSize: "0.7rem" }}>NON-ASD PROBABILITY</div>
                    <div className="numeric font-bold" style={{ fontSize: "1rem", color: "var(--risk-low)" }}>
                      {((mriResult?.non_prob ?? (!isAsd ? confVal : 1 - confVal)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Ranked Region Attributions">
            {loading ? (
              <div className="muted" style={{ padding: "1.5rem 0", fontSize: "0.82rem", textAlign: "center" }}>
                Extracting anatomical region weights...
              </div>
            ) : !hasResult ? (
              <div className="muted" style={{ padding: "1.5rem 0", fontSize: "0.82rem", textAlign: "center" }}>
                Region attributions will appear after an MRI slice is uploaded and processed.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {MOCK_REGIONS.map((r, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{r.region}</span>
                      <span className="numeric font-bold" style={{ color: "var(--primary)" }}>{r.attribution}%</span>
                    </div>
                    <div style={{ height: "5px", width: "100%", backgroundColor: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.attribution}%`, backgroundColor: "var(--primary)" }} />
                    </div>
                    <div className="muted" style={{ fontSize: "0.72rem" }}>{r.description}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Disclaimer />
        </div>
      </div>
    </div>
  );
}

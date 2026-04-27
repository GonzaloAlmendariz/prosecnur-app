import { X } from "lucide-react";
import { useEffect } from "react";
import { useDashboardStore } from "../store";

// Diálogo "Personalizar" — controles avanzados de visualización del
// dashboard. Por ahora cubre dos parámetros de la pestaña Dimensiones:
//   - Modo del semáforo: cortes discretos vs gradiente continuo.
//   - Límite inferior del eje radial del radar (radar_min, 0–95).
// Persistido en `dashboard_config` vía store autosave.

export function DashboardCustomizeDialog({ onClose }: { onClose: () => void }) {
  const config = useDashboardStore((s) => s.config);
  const setSemaforoModo = useDashboardStore((s) => s.setSemaforoModo);
  const setRadarMin = useDashboardStore((s) => s.setRadarMin);

  const semaforoModo = config.semaforo_modo ?? "cortes";
  const radarMin = config.radar_min ?? 0;

  // Cierre con Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dash-modal-backdrop" onClick={onClose}>
      <div
        className="dash-modal"
        style={{ width: "min(540px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Personalizar visualización"
      >
        <div className="dash-modal-head">
          <div>
            <h2>Personalizar</h2>
            <p>Ajustes finos de la pestaña Dimensiones.</p>
          </div>
          <button
            type="button"
            className="dash-icon-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 18, display: "grid", gap: 18 }}>
          {/* ── Semáforo ── */}
          <section>
            <h3 className="dash-customize-section-title">Semáforo del heatmap</h3>
            <p className="dash-customize-help">
              En <strong>cortes</strong> los colores cambian abruptamente al cruzar los
              umbrales. En <strong>gradiente</strong> se interpolan continuamente entre
              rojo, ámbar y verde.
            </p>
            <div
              className="dash-source-segments"
              role="tablist"
              aria-label="Modo del semáforo"
              style={{ marginTop: 8 }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={semaforoModo === "cortes"}
                className={`dash-source-segment ${semaforoModo === "cortes" ? "is-active" : ""}`}
                onClick={() => setSemaforoModo("cortes")}
              >
                Cortes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={semaforoModo === "gradiente"}
                className={`dash-source-segment ${semaforoModo === "gradiente" ? "is-active" : ""}`}
                onClick={() => setSemaforoModo("gradiente")}
              >
                Gradiente
              </button>
            </div>
            <SemaforoPreview modo={semaforoModo} />
          </section>

          {/* ── Radar ── */}
          <section>
            <h3 className="dash-customize-section-title">Eje del radar</h3>
            <p className="dash-customize-help">
              Subir el límite inferior amplifica las diferencias visuales cuando todos
              los scores son altos. Solo afecta al modo <strong>Radar</strong>.
            </p>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-radar-min" className="dash-filtro-label">
                Mínimo
              </label>
              <input
                id="dash-radar-min"
                type="range"
                min={0}
                max={95}
                step={5}
                value={radarMin}
                onChange={(e) => setRadarMin(Number(e.target.value))}
                className="dash-customize-slider"
                aria-valuetext={`${radarMin}`}
              />
              <span className="dash-customize-slider-value">
                {radarMin} – 100
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SemaforoPreview({ modo }: { modo: "cortes" | "gradiente" }) {
  const red = "#D84B55";
  const amber = "#E0B44C";
  const green = "#3A9A5B";
  const bg = modo === "gradiente"
    ? `linear-gradient(90deg, ${red} 0%, ${amber} 60%, ${green} 100%)`
    : `linear-gradient(
        to right,
        ${red} 0%,
        ${red} 60%,
        ${amber} 60%,
        ${amber} 80%,
        ${green} 80%,
        ${green} 100%
      )`;
  return (
    <div className="dash-customize-preview" aria-hidden="true">
      <div className="dash-customize-preview-bar" style={{ background: bg }} />
      <div className="dash-customize-preview-marks">
        <span>0</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
}

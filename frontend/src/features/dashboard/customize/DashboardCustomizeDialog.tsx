import { Image, X } from "lucide-react";
import { useEffect } from "react";
import { useDashboardStore } from "../store";

// Diálogo "Personalizar" — controles avanzados de visualización del
// dashboard. Por ahora cubre dos parámetros de la pestaña Dimensiones:
//   - Modo del semáforo: cortes discretos vs gradiente continuo.
//   - Límite inferior del eje radial del radar (radar_min, 0–95).
//   - Iconos de FODA: uso, tinte, tamaño y leyenda.
// Persistido en `dashboard_config` vía store autosave.

export function DashboardCustomizeDialog({ onClose }: { onClose: () => void }) {
  const config = useDashboardStore((s) => s.config);
  const setSemaforoModo = useDashboardStore((s) => s.setSemaforoModo);
  const setSemaforoRedColor = useDashboardStore((s) => s.setSemaforoRedColor);
  const setSemaforoAmberColor = useDashboardStore((s) => s.setSemaforoAmberColor);
  const setSemaforoGreenColor = useDashboardStore((s) => s.setSemaforoGreenColor);
  const setSemaforoRedMax = useDashboardStore((s) => s.setSemaforoRedMax);
  const setSemaforoAmberMax = useDashboardStore((s) => s.setSemaforoAmberMax);
  const setRadarMin = useDashboardStore((s) => s.setRadarMin);
  const setFodaIconosEnabled = useDashboardStore((s) => s.setFodaIconosEnabled);
  const setFodaIconTint = useDashboardStore((s) => s.setFodaIconTint);
  const setFodaIconSize = useDashboardStore((s) => s.setFodaIconSize);
  const setFodaIconLegend = useDashboardStore((s) => s.setFodaIconLegend);
  const setFodaScoreMin = useDashboardStore((s) => s.setFodaScoreMin);
  const setFodaScoreMax = useDashboardStore((s) => s.setFodaScoreMax);
  const setFodaShowTotal = useDashboardStore((s) => s.setFodaShowTotal);
  const setFodaSpacing = useDashboardStore((s) => s.setFodaSpacing);
  const setFodaGridIntensity = useDashboardStore((s) => s.setFodaGridIntensity);

  const semaforoModo = config.semaforo_modo ?? "cortes";
  const semRed = config.semaforo_red_color ?? "#D84B55";
  const semAmber = config.semaforo_amber_color ?? "#E0B44C";
  const semGreen = config.semaforo_green_color ?? "#3A9A5B";
  const semRedMax = config.semaforo_red_max ?? 60;
  const semAmberMax = config.semaforo_amber_max ?? 80;
  const radarMin = config.radar_min ?? 0;
  const fodaIconosEnabled = config.foda_iconos_enabled ?? true;
  const fodaIconTint = config.foda_icon_tint ?? "#FFFFFF";
  const fodaIconSize = config.foda_icon_size ?? 1;
  const fodaIconLegend = config.foda_icon_legend ?? true;
  const fodaScoreMin = config.foda_score_min ?? 0;
  const fodaScoreMax = config.foda_score_max ?? 120;
  const fodaShowTotal = config.foda_show_total ?? true;
  const fodaSpacing = config.foda_spacing ?? 1.15;
  const fodaGridIntensity = config.foda_grid_intensity ?? 0.42;

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
            <h3 className="dash-customize-section-title">Semáforo</h3>
            <p className="dash-customize-help">
              Aplica a <strong>todos</strong> los gráficos (heatmap, chips de barras,
              FODA). En <strong>cortes</strong> los colores cambian al cruzar los
              umbrales; en <strong>gradiente</strong> se interpolan continuamente.
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
            <div className="dash-customize-sem-grid">
              <label className="dash-customize-color-field">
                <span className="dash-filtro-label">Bajo</span>
                <input
                  type="color"
                  value={semRed}
                  onChange={(e) => setSemaforoRedColor(e.target.value)}
                  aria-label="Color del rango bajo"
                />
              </label>
              <label className="dash-customize-color-field">
                <span className="dash-filtro-label">Medio</span>
                <input
                  type="color"
                  value={semAmber}
                  onChange={(e) => setSemaforoAmberColor(e.target.value)}
                  aria-label="Color del rango medio"
                />
              </label>
              <label className="dash-customize-color-field">
                <span className="dash-filtro-label">Alto</span>
                <input
                  type="color"
                  value={semGreen}
                  onChange={(e) => setSemaforoGreenColor(e.target.value)}
                  aria-label="Color del rango alto"
                />
              </label>
            </div>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-sem-red-max" className="dash-filtro-label">
                Bajo &lt;
              </label>
              <input
                id="dash-sem-red-max"
                type="range"
                min={5}
                max={95}
                step={1}
                value={semRedMax}
                onChange={(e) => setSemaforoRedMax(Number(e.target.value))}
                className="dash-customize-slider"
              />
              <span className="dash-customize-slider-value">{semRedMax}</span>
            </div>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-sem-amber-max" className="dash-filtro-label">
                Medio &lt;
              </label>
              <input
                id="dash-sem-amber-max"
                type="range"
                min={semRedMax + 1}
                max={99}
                step={1}
                value={semAmberMax}
                onChange={(e) => setSemaforoAmberMax(Number(e.target.value))}
                className="dash-customize-slider"
              />
              <span className="dash-customize-slider-value">{semAmberMax}</span>
            </div>
            <SemaforoPreview
              modo={semaforoModo}
              red={semRed}
              amber={semAmber}
              green={semGreen}
              redMax={semRedMax}
              amberMax={semAmberMax}
            />
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

          {/* ── FODA ── */}
          <section>
            <h3 className="dash-customize-section-title">Iconos FODA</h3>
            <p className="dash-customize-help">
              Los iconos representan la dimensión o conductor. El color de cada
              bloque viene de la comparación seleccionada.
            </p>
            <label className="dash-dim-checkbox" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={fodaIconosEnabled}
                onChange={(e) => setFodaIconosEnabled(e.target.checked)}
              />
              Usar iconos de dimensión
            </label>
            <label className="dash-dim-checkbox" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={fodaIconLegend}
                disabled={!fodaIconosEnabled}
                onChange={(e) => setFodaIconLegend(e.target.checked)}
              />
              Mostrar leyenda de iconos
            </label>
            <label className="dash-dim-checkbox" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={fodaShowTotal}
                onChange={(e) => setFodaShowTotal(e.target.checked)}
              />
              Mostrar Total en FODA
            </label>
            <div className="dash-customize-foda-grid">
              <label className="dash-customize-color-field">
                <span className="dash-filtro-label">Color icono</span>
                <input
                  type="color"
                  value={fodaIconTint}
                  disabled={!fodaIconosEnabled}
                  onChange={(e) => setFodaIconTint(e.target.value)}
                  aria-label="Color del icono FODA"
                />
              </label>
              <div className="dash-customize-slider-row">
                <label htmlFor="dash-foda-icon-size" className="dash-filtro-label">
                  Tamaño
                </label>
                <input
                  id="dash-foda-icon-size"
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.05}
                  value={fodaIconSize}
                  disabled={!fodaIconosEnabled}
                  onChange={(e) => setFodaIconSize(Number(e.target.value))}
                  className="dash-customize-slider"
                  aria-valuetext={`${fodaIconSize.toFixed(1)}x`}
                />
                <span className="dash-customize-slider-value">
                  {fodaIconSize.toFixed(1)}x
                </span>
              </div>
            </div>
            <div className="dash-customize-foda-preview" aria-hidden="true">
              <span style={{ background: "#4A9377" }}>
                <Image size={Math.round(18 * fodaIconSize)} color={fodaIconTint} />
              </span>
              <span style={{ background: "#D18755" }}>
                <Image size={Math.round(18 * fodaIconSize)} color={fodaIconTint} />
              </span>
              <span style={{ background: "#4F8195" }}>
                <Image size={Math.round(18 * fodaIconSize)} color={fodaIconTint} />
              </span>
            </div>
            <div className="dash-customize-foda-limits">
              <div className="dash-customize-slider-row">
                <label htmlFor="dash-foda-spacing" className="dash-filtro-label">
                  Separación
                </label>
                <input
                  id="dash-foda-spacing"
                  type="range"
                  min={0.7}
                  max={1.8}
                  step={0.05}
                  value={fodaSpacing}
                  onChange={(e) => setFodaSpacing(Number(e.target.value))}
                  className="dash-customize-slider"
                  aria-valuetext={`${fodaSpacing.toFixed(2)}x`}
                />
                <span className="dash-customize-slider-value">
                  {fodaSpacing.toFixed(2)}x
                </span>
              </div>
              <div className="dash-customize-slider-row">
                <label htmlFor="dash-foda-grid-intensity" className="dash-filtro-label">
                  Grilla
                </label>
                <input
                  id="dash-foda-grid-intensity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={fodaGridIntensity}
                  onChange={(e) => setFodaGridIntensity(Number(e.target.value))}
                  className="dash-customize-slider"
                  aria-valuetext={`${Math.round(fodaGridIntensity * 100)}%`}
                />
                <span className="dash-customize-slider-value">
                  {Math.round(fodaGridIntensity * 100)}%
                </span>
              </div>
            </div>
            <div className="dash-customize-foda-limits">
              <div className="dash-customize-slider-row">
                <label htmlFor="dash-foda-score-min" className="dash-filtro-label">
                  Puntaje mín.
                </label>
                <input
                  id="dash-foda-score-min"
                  type="range"
                  min={0}
                  max={95}
                  step={5}
                  value={fodaScoreMin}
                  onChange={(e) => setFodaScoreMin(Number(e.target.value))}
                  className="dash-customize-slider"
                  aria-valuetext={`${fodaScoreMin}`}
                />
                <span className="dash-customize-slider-value">{fodaScoreMin}</span>
              </div>
              <div className="dash-customize-slider-row">
                <label htmlFor="dash-foda-score-max" className="dash-filtro-label">
                  Puntaje máx.
                </label>
                <input
                  id="dash-foda-score-max"
                  type="range"
                  min={60}
                  max={140}
                  step={5}
                  value={fodaScoreMax}
                  onChange={(e) => setFodaScoreMax(Number(e.target.value))}
                  className="dash-customize-slider"
                  aria-valuetext={`${fodaScoreMax}`}
                />
                <span className="dash-customize-slider-value">{fodaScoreMax}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SemaforoPreview({
  modo,
  red,
  amber,
  green,
  redMax,
  amberMax,
}: {
  modo: "cortes" | "gradiente";
  red: string;
  amber: string;
  green: string;
  redMax: number;
  amberMax: number;
}) {
  const bg = modo === "gradiente"
    ? `linear-gradient(90deg, ${red} 0%, ${amber} ${redMax}%, ${green} ${amberMax}%, ${green} 100%)`
    : `linear-gradient(
        to right,
        ${red} 0%,
        ${red} ${redMax}%,
        ${amber} ${redMax}%,
        ${amber} ${amberMax}%,
        ${green} ${amberMax}%,
        ${green} 100%
      )`;
  return (
    <div className="dash-customize-preview" aria-hidden="true">
      <div className="dash-customize-preview-bar" style={{ background: bg }} />
      <div
        className="dash-customize-preview-marks"
        style={{
          gridTemplateColumns: `${redMax}fr ${amberMax - redMax}fr ${100 - amberMax}fr`,
        }}
      >
        <span>0–{redMax}</span>
        <span>{redMax}–{amberMax}</span>
        <span>{amberMax}–100</span>
      </div>
    </div>
  );
}

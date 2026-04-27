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
  const addSemaforoStop = useDashboardStore((s) => s.addSemaforoStop);
  const removeSemaforoStop = useDashboardStore((s) => s.removeSemaforoStop);
  const updateSemaforoStop = useDashboardStore((s) => s.updateSemaforoStop);
  const setRadarMin = useDashboardStore((s) => s.setRadarMin);
  const setRadarMax = useDashboardStore((s) => s.setRadarMax);
  const setRadarGridshape = useDashboardStore((s) => s.setRadarGridshape);
  const setRadarModo = useDashboardStore((s) => s.setRadarModo);
  const setRadarAnimado = useDashboardStore((s) => s.setRadarAnimado);
  const setBarrasOrientacion = useDashboardStore((s) => s.setBarrasOrientacion);
  const setBarrasXMin = useDashboardStore((s) => s.setBarrasXMin);
  const setBarrasXMax = useDashboardStore((s) => s.setBarrasXMax);
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
  const semStopsExtra = config.semaforo_stops_extra ?? [];
  const radarMin = config.radar_min ?? 0;
  const radarMax = config.radar_max ?? 100;
  const radarGridshape = config.radar_gridshape ?? "linear";
  const radarModo = config.radar_modo ?? "uno";
  const radarAnimado = config.radar_animado ?? true;
  const barrasOrientacion = config.barras_orientacion ?? "horizontal";
  const barrasXMin = config.barras_x_min ?? 0;
  const barrasXMax = config.barras_x_max ?? 100;
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
              stopsExtra={semStopsExtra}
            />
            <div className="dash-customize-stops">
              <div className="dash-customize-stops-head">
                <span className="dash-filtro-label">Cortes finos (no se muestran en la leyenda)</span>
                <button
                  type="button"
                  className="dash-quick-btn"
                  onClick={() => addSemaforoStop({ value: 50, color: "#FFFFFF" })}
                  title="Agregar un corte para fineza de color"
                >
                  + Agregar
                </button>
              </div>
              {semStopsExtra.length === 0 ? (
                <p className="dash-customize-help" style={{ marginTop: 6 }}>
                  Sin cortes extra. Los 3 colores base controlan toda la escala.
                </p>
              ) : (
                <ul className="dash-customize-stops-list">
                  {semStopsExtra.map((stop, i) => (
                    <li key={i} className="dash-customize-stops-item">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={stop.value}
                        onChange={(e) => updateSemaforoStop(i, { value: Number(e.target.value) })}
                        className="dash-input"
                        style={{ width: 70 }}
                        aria-label={`Valor del corte ${i + 1}`}
                      />
                      <input
                        type="color"
                        value={stop.color}
                        onChange={(e) => updateSemaforoStop(i, { color: e.target.value })}
                        aria-label={`Color del corte ${i + 1}`}
                      />
                      <button
                        type="button"
                        className="dash-customize-stops-remove"
                        onClick={() => removeSemaforoStop(i)}
                        aria-label={`Quitar corte ${i + 1}`}
                        title="Quitar"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── Barras ── */}
          <section>
            <h3 className="dash-customize-section-title">Barras</h3>
            <p className="dash-customize-help">
              Orientación y rango del eje numérico. <strong>Facet</strong> divide
              las dimensiones en dos columnas para evitar colas largas.
            </p>
            <div
              className="dash-source-segments"
              role="tablist"
              aria-label="Orientación de barras"
              style={{ marginTop: 8 }}
            >
              {(["horizontal", "vertical", "facet"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={barrasOrientacion === m}
                  className={`dash-source-segment ${barrasOrientacion === m ? "is-active" : ""}`}
                  onClick={() => setBarrasOrientacion(m)}
                >
                  {m === "horizontal" ? "Horizontal" : m === "vertical" ? "Vertical" : "Facet"}
                </button>
              ))}
            </div>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-barras-min" className="dash-filtro-label">Mín</label>
              <input
                id="dash-barras-min"
                type="range"
                min={0}
                max={90}
                step={5}
                value={barrasXMin}
                onChange={(e) => setBarrasXMin(Number(e.target.value))}
                className="dash-customize-slider"
              />
              <span className="dash-customize-slider-value">{barrasXMin}</span>
            </div>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-barras-max" className="dash-filtro-label">Máx</label>
              <input
                id="dash-barras-max"
                type="range"
                min={Math.max(barrasXMin + 10, 50)}
                max={200}
                step={5}
                value={barrasXMax}
                onChange={(e) => setBarrasXMax(Number(e.target.value))}
                className="dash-customize-slider"
              />
              <span className="dash-customize-slider-value">{barrasXMax}</span>
            </div>
          </section>

          {/* ── Radar ── */}
          <section>
            <h3 className="dash-customize-section-title">Radar</h3>
            <p className="dash-customize-help">
              Forma de la grilla, rango del eje radial y comportamiento de la animación
              y comparación entre niveles.
            </p>
            <label className="dash-filtro-label" style={{ marginTop: 8 }}>Forma de grilla</label>
            <div
              className="dash-source-segments"
              role="tablist"
              aria-label="Forma de la grilla del radar"
            >
              <button
                type="button"
                role="tab"
                aria-selected={radarGridshape === "linear"}
                className={`dash-source-segment ${radarGridshape === "linear" ? "is-active" : ""}`}
                onClick={() => setRadarGridshape("linear")}
              >
                Polígono
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={radarGridshape === "circular"}
                className={`dash-source-segment ${radarGridshape === "circular" ? "is-active" : ""}`}
                onClick={() => setRadarGridshape("circular")}
              >
                Circular
              </button>
            </div>
            <label className="dash-filtro-label" style={{ marginTop: 10 }}>Modo</label>
            <div
              className="dash-source-segments"
              role="tablist"
              aria-label="Modo del radar"
            >
              <button
                type="button"
                role="tab"
                aria-selected={radarModo === "uno"}
                className={`dash-source-segment ${radarModo === "uno" ? "is-active" : ""}`}
                onClick={() => setRadarModo("uno")}
              >
                Uno
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={radarModo === "facet"}
                className={`dash-source-segment ${radarModo === "facet" ? "is-active" : ""}`}
                onClick={() => setRadarModo("facet")}
              >
                Facet
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={radarModo === "alternante"}
                className={`dash-source-segment ${radarModo === "alternante" ? "is-active" : ""}`}
                onClick={() => setRadarModo("alternante")}
              >
                Alternante
              </button>
            </div>
            <label className="dash-dim-checkbox" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={radarAnimado}
                onChange={(e) => setRadarAnimado(e.target.checked)}
              />
              Animar entrada (mayor → menor)
            </label>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-radar-min" className="dash-filtro-label">Mín</label>
              <input
                id="dash-radar-min"
                type="range"
                min={0}
                max={95}
                step={5}
                value={radarMin}
                onChange={(e) => setRadarMin(Number(e.target.value))}
                className="dash-customize-slider"
              />
              <span className="dash-customize-slider-value">{radarMin}</span>
            </div>
            <div className="dash-customize-slider-row">
              <label htmlFor="dash-radar-max" className="dash-filtro-label">Máx</label>
              <input
                id="dash-radar-max"
                type="range"
                min={Math.max(radarMin + 5, 50)}
                max={200}
                step={5}
                value={radarMax}
                onChange={(e) => setRadarMax(Number(e.target.value))}
                className="dash-customize-slider"
              />
              <span className="dash-customize-slider-value">{radarMax}</span>
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
  stopsExtra = [],
}: {
  modo: "cortes" | "gradiente";
  red: string;
  amber: string;
  green: string;
  redMax: number;
  amberMax: number;
  stopsExtra?: { value: number; color: string }[];
}) {
  // Combina los stops base con los extras y arma un linear-gradient con
  // todos. Para "cortes" duplicamos cada stop para hacer saltos abruptos.
  const stops = [
    { value: 0, color: red },
    { value: redMax, color: amber },
    { value: amberMax, color: green },
    { value: 100, color: green },
    ...stopsExtra.map((s) => ({
      value: Math.max(0, Math.min(100, s.value)),
      color: s.color,
    })),
  ].sort((a, b) => a.value - b.value);

  let bg: string;
  if (modo === "gradiente") {
    bg = `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.value}%`).join(", ")})`;
  } else {
    const parts: string[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      parts.push(`${stops[i].color} ${stops[i].value}%`);
      if (stops[i + 1].value > stops[i].value) {
        parts.push(`${stops[i].color} ${stops[i + 1].value}%`);
      }
    }
    parts.push(`${stops[stops.length - 1].color} 100%`);
    bg = `linear-gradient(to right, ${parts.join(", ")})`;
  }
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

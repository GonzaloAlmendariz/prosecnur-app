import {
  BarChart3,
  Image,
  LayoutGrid,
  Plus,
  Radar,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DashboardFodaViewConfig, DashboardTabId } from "../../../api/client";
import {
  DEFAULT_FODA_SERVICE_CATEGORIES,
  DEFAULT_FODA_VIEWS,
  DEFAULT_TABS_ENABLED,
  MAX_DASHBOARD_LOGOS,
  useDashboardStore,
} from "../store";

type CustomizePanel = "marca" | "pestanas" | "foda" | "graficos" | "semaforo";

const PANELS: Array<{ id: CustomizePanel; label: string; icon: typeof SlidersHorizontal }> = [
  { id: "marca", label: "Marca", icon: Tag },
  { id: "pestanas", label: "Pestañas", icon: LayoutGrid },
  { id: "foda", label: "FODA", icon: Image },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "semaforo", label: "Semáforo", icon: SlidersHorizontal },
];

const TAB_LABELS: Record<DashboardTabId, string> = {
  resumen: "Resumen",
  relaciones: "Relaciones",
  base_datos: "Base de datos",
  dimensiones: "Dimensiones",
};

const TAB_ORDER: DashboardTabId[] = ["resumen", "relaciones", "base_datos", "dimensiones"];

export function DashboardCustomizeDialog({ onClose }: { onClose: () => void }) {
  const config = useDashboardStore((s) => s.config);
  const setTitulo = useDashboardStore((s) => s.setTitulo);
  const setSubtitulo = useDashboardStore((s) => s.setSubtitulo);
  const setLogoHeight = useDashboardStore((s) => s.setLogoHeight);
  const setLogoSlot = useDashboardStore((s) => s.setLogoSlot);
  const removeLogoSlot = useDashboardStore((s) => s.removeLogoSlot);
  const setTabEnabled = useDashboardStore((s) => s.setTabEnabled);
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
  const setFodaVista = useDashboardStore((s) => s.setFodaVista);
  const addFodaView = useDashboardStore((s) => s.addFodaView);
  const updateFodaView = useDashboardStore((s) => s.updateFodaView);
  const removeFodaView = useDashboardStore((s) => s.removeFodaView);
  const setFodaViewAlias = useDashboardStore((s) => s.setFodaViewAlias);
  const setFodaViewIcon = useDashboardStore((s) => s.setFodaViewIcon);

  const [panel, setPanel] = useState<CustomizePanel>("marca");
  const logoInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function handleLogoUpload(slot: number, file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setLogoSlot(slot, { data_uri: result, alt: file.name });
    };
    reader.readAsDataURL(file);
  }

  const logos = config.logos ?? [];
  const tabsEnabled = { ...DEFAULT_TABS_ENABLED, ...(config.tabs_enabled ?? {}) };

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
  const fodaVista = config.foda_vista ?? "conductores";
  const fodaViews = config.foda_views ?? DEFAULT_FODA_VIEWS;
  const activeView = useMemo(
    () => fodaViews.find((view) => view.id === fodaVista) ?? fodaViews[0] ?? DEFAULT_FODA_VIEWS[0],
    [fodaViews, fodaVista],
  );
  const activeCategories = useMemo(() => fodaCategoriesForView(activeView), [activeView]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addCategory(view: DashboardFodaViewConfig) {
    const base = view.variable === "servicio" ? "Nuevo servicio" : "Nueva categoria";
    let label = base;
    let i = 2;
    const used = new Set(fodaCategoriesForView(view));
    while (used.has(label)) {
      label = `${base} ${i}`;
      i += 1;
    }
    setFodaViewAlias(view.id, label, view.card_mode === "alias" ? initialsAlias(label) : label);
    if (view.card_mode === "iconos") setFodaViewIcon(view.id, label, "");
  }

  return (
    <div className="dash-modal-backdrop" onClick={onClose}>
      <div
        className="dash-modal dash-customize-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Personalizar dashboard"
      >
        <div className="dash-modal-head">
          <div>
            <h2>Personalizar</h2>
            <p>Configura vistas, tarjetas y escalas del dashboard.</p>
          </div>
          <button type="button" className="dash-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="dash-customize-shell">
          <nav className="dash-customize-nav" aria-label="Secciones de personalización">
            {PANELS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={panel === id ? "is-active" : ""}
                onClick={() => setPanel(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="dash-customize-body">
            {panel === "marca" && (
              <section className="dash-customize-panel">
                <PanelTitle
                  title="Marca del dashboard"
                  text="Título, subtítulo y hasta 3 logos que aparecen en el header. Estos campos forman parte del producto final exportable."
                />

                <div className="dash-customize-field-grid">
                  <label>
                    <span className="dash-filtro-label">Título</span>
                    <input
                      className="dash-input"
                      value={config.titulo ?? ""}
                      placeholder="Dashboard"
                      onChange={(e) => setTitulo(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="dash-filtro-label">Subtítulo</span>
                    <input
                      className="dash-input"
                      value={config.subtitulo ?? ""}
                      placeholder="Estudio, periodo, equipo…"
                      onChange={(e) => setSubtitulo(e.target.value)}
                    />
                  </label>
                </div>

                <SettingBlock title="Logos" icon={<Image size={16} />}>
                  <div className="dash-customize-logo-grid">
                    {Array.from({ length: MAX_DASHBOARD_LOGOS }).map((_, slot) => {
                      const logo = logos[slot] ?? null;
                      return (
                        <div key={slot} className="dash-customize-logo-slot">
                          <div className="dash-customize-logo-preview">
                            {logo ? (
                              <img
                                src={logo.data_uri}
                                alt={logo.alt || `Logo ${slot + 1}`}
                                style={{
                                  height: Math.min(56, config.logo_height_px ?? 36),
                                  width: "auto",
                                  objectFit: "contain",
                                }}
                              />
                            ) : (
                              <span className="dash-customize-logo-empty">Slot {slot + 1}</span>
                            )}
                          </div>
                          <div className="dash-customize-logo-actions">
                            <button
                              type="button"
                              className="dash-quick-btn"
                              onClick={() => logoInputRefs.current[slot]?.click()}
                            >
                              <Upload size={13} /> {logo ? "Cambiar" : "Subir"}
                            </button>
                            {logo && (
                              <button
                                type="button"
                                className="dash-customize-danger"
                                onClick={() => removeLogoSlot(slot)}
                                title="Quitar logo"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <input
                              ref={(el) => { logoInputRefs.current[slot] = el; }}
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml,image/webp"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                handleLogoUpload(slot, e.target.files?.[0]);
                                e.target.value = "";
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <label style={{ display: "block", marginTop: 12, maxWidth: 220 }}>
                    <span className="dash-filtro-label">Altura común (px)</span>
                    <input
                      className="dash-input"
                      type="number"
                      min={16}
                      max={120}
                      step={2}
                      value={config.logo_height_px ?? 36}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n > 0) setLogoHeight(n);
                      }}
                    />
                  </label>
                  <p className="dash-customize-help">
                    Hasta {MAX_DASHBOARD_LOGOS} logos, ordenados de izquierda a derecha. PNG / JPG / SVG / WEBP. Quedan embebidos en el .pulso (data URI).
                  </p>
                </SettingBlock>
              </section>
            )}

            {panel === "pestanas" && (
              <section className="dash-customize-panel">
                <PanelTitle
                  title="Pestañas visibles"
                  text="Decide qué pestañas aparecen en el dashboard final. Las pestañas deshabilitadas se ocultan y el lector va directo a la primera disponible."
                />

                <div className="dash-customize-tabs-list">
                  {TAB_ORDER.map((id) => {
                    const enabled = tabsEnabled[id];
                    const enabledCount = TAB_ORDER.filter((t) => tabsEnabled[t]).length;
                    const isLastEnabled = enabled && enabledCount === 1;
                    return (
                      <label
                        key={id}
                        className={`dash-customize-tab-row ${enabled ? "is-on" : "is-off"}`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={isLastEnabled}
                          onChange={(e) => setTabEnabled(id, e.target.checked)}
                        />
                        <span className="dash-customize-tab-name">{TAB_LABELS[id]}</span>
                        {isLastEnabled && (
                          <span className="dash-customize-tab-hint">Mínimo una activa</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {panel === "foda" && (
              <section className="dash-customize-panel">
                <PanelTitle
                  title="Tarjetas FODA"
                  text="Elige qué compara la matriz y cómo se ven sus tarjetas: conductores, servicios, municipios o cualquier variable categórica."
                />

                <div className="dash-customize-foda-layout">
                  <div className="dash-customize-view-list">
                    <div className="dash-customize-stops-head">
                      <span className="dash-filtro-label">Vistas disponibles</span>
                      <button type="button" className="dash-quick-btn" onClick={addFodaView}>
                        <Plus size={14} /> Vista
                      </button>
                    </div>
                    {fodaViews.map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        className={`dash-customize-view-card ${view.id === activeView.id ? "is-active" : ""}`}
                        onClick={() => setFodaVista(view.id)}
                      >
                        <span className="dash-customize-view-name">{view.label}</span>
                        <span className="dash-customize-view-meta">
                          {view.variable ? view.variable : "Dimensiones"} · {view.card_mode === "alias" ? "Alias" : "Iconos"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="dash-customize-view-editor">
                    <div className="dash-customize-editor-head">
                      <div>
                        <span className="dash-filtro-label">Vista activa</span>
                        <strong>{activeView.label}</strong>
                      </div>
                      {activeView.id !== "conductores" && (
                        <button
                          type="button"
                          className="dash-customize-danger"
                          onClick={() => removeFodaView(activeView.id)}
                          title="Quitar vista"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="dash-customize-field-grid">
                      <label>
                        <span className="dash-filtro-label">Nombre visible</span>
                        <input
                          className="dash-input"
                          value={activeView.label}
                          onChange={(e) => updateFodaView(activeView.id, { label: e.target.value })}
                        />
                      </label>
                      <label>
                        <span className="dash-filtro-label">Variable categórica</span>
                        <input
                          className="dash-input"
                          value={activeView.variable}
                          disabled={activeView.id === "conductores"}
                          placeholder="servicio, distrito, sede..."
                          onChange={(e) => updateFodaView(activeView.id, { variable: e.target.value })}
                        />
                      </label>
                      <label>
                        <span className="dash-filtro-label">Métrica</span>
                        <input
                          className="dash-input"
                          value={activeView.metric_var ?? ""}
                          disabled={activeView.id === "conductores"}
                          placeholder="idx_indice_general"
                          onChange={(e) => updateFodaView(activeView.id, { metric_var: e.target.value })}
                        />
                      </label>
                      <label>
                        <span className="dash-filtro-label">Representación</span>
                        <select
                          className="dash-select"
                          value={activeView.card_mode}
                          disabled={activeView.id === "conductores"}
                          onChange={(e) => updateFodaView(activeView.id, { card_mode: e.target.value as "iconos" | "alias" })}
                        >
                          <option value="iconos">Iconos / logos</option>
                          <option value="alias">Alias de texto</option>
                        </select>
                      </label>
                    </div>

                    <div className="dash-customize-foda-toggles">
                      <label className="dash-dim-checkbox">
                        <input
                          type="checkbox"
                          checked={fodaIconosEnabled}
                          onChange={(e) => setFodaIconosEnabled(e.target.checked)}
                        />
                        Usar iconos cuando la vista lo permita
                      </label>
                      <label className="dash-dim-checkbox">
                        <input
                          type="checkbox"
                          checked={fodaIconLegend}
                          disabled={!fodaIconosEnabled}
                          onChange={(e) => setFodaIconLegend(e.target.checked)}
                        />
                        Mostrar leyenda de iconos
                      </label>
                      <label className="dash-dim-checkbox">
                        <input
                          type="checkbox"
                          checked={fodaShowTotal}
                          onChange={(e) => setFodaShowTotal(e.target.checked)}
                        />
                        Mostrar Total
                      </label>
                    </div>

                    <div className="dash-customize-field-grid">
                      <label className="dash-customize-color-field">
                        <span className="dash-filtro-label">Color icono</span>
                        <input
                          type="color"
                          value={fodaIconTint}
                          disabled={!fodaIconosEnabled}
                          onChange={(e) => setFodaIconTint(e.target.value)}
                        />
                      </label>
                      <SliderField
                        id="dash-foda-icon-size"
                        label="Tamaño"
                        min={0.5}
                        max={1.8}
                        step={0.05}
                        value={fodaIconSize}
                        suffix="x"
                        disabled={!fodaIconosEnabled}
                        onChange={setFodaIconSize}
                      />
                    </div>

                    <div className="dash-customize-foda-limits">
                      <SliderField id="dash-foda-score-min" label="Puntaje mín." min={0} max={95} step={5} value={fodaScoreMin} onChange={setFodaScoreMin} />
                      <SliderField id="dash-foda-score-max" label="Puntaje máx." min={60} max={140} step={5} value={fodaScoreMax} onChange={setFodaScoreMax} />
                      <SliderField id="dash-foda-spacing" label="Separación" min={0.7} max={1.8} step={0.05} value={fodaSpacing} suffix="x" onChange={setFodaSpacing} />
                      <SliderField id="dash-foda-grid-intensity" label="Grilla" min={0} max={1} step={0.05} value={fodaGridIntensity} suffix="%" format={(v) => `${Math.round(v * 100)}%`} onChange={setFodaGridIntensity} />
                    </div>

                    {activeView.id === "conductores" ? (
                      <p className="dash-customize-help">
                        Conductores usa las dimensiones curadas del módulo Analítica. Sus iconos salen de cada dimensión.
                      </p>
                    ) : (
                      <div className="dash-customize-category-editor">
                        <div className="dash-customize-stops-head">
                          <span className="dash-filtro-label">
                            Categorías de {activeView.variable || "la variable"}
                          </span>
                          <button type="button" className="dash-quick-btn" onClick={() => addCategory(activeView)}>
                            <Plus size={14} /> Categoría
                          </button>
                        </div>
                        {activeCategories.length === 0 ? (
                          <p className="dash-customize-help">Agrega categorías para definir sus alias o logos.</p>
                        ) : (
                          <div className="dash-customize-category-list">
                            {activeCategories.map((category) => (
                              <CategoryEditorRow
                                key={category}
                                view={activeView}
                                category={category}
                                onAlias={setFodaViewAlias}
                                onIcon={setFodaViewIcon}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {panel === "graficos" && (
              <section className="dash-customize-panel">
                <PanelTitle
                  title="Gráficos"
                  text="Controla orientación de barras y comportamiento del radar sin tocar los datos."
                />
                <SettingBlock title="Barras" icon={<BarChart3 size={16} />}>
                  <Segmented
                    label="Orientación de barras"
                    value={barrasOrientacion}
                    options={[
                      ["horizontal", "Horizontal"],
                      ["vertical", "Vertical"],
                      ["facet", "Facet"],
                    ]}
                    onChange={(v) => setBarrasOrientacion(v as "horizontal" | "vertical" | "facet")}
                  />
                  <SliderField id="dash-barras-min" label="Mín" min={0} max={90} step={5} value={barrasXMin} onChange={setBarrasXMin} />
                  <SliderField id="dash-barras-max" label="Máx" min={Math.max(barrasXMin + 10, 50)} max={200} step={5} value={barrasXMax} onChange={setBarrasXMax} />
                </SettingBlock>
                <SettingBlock title="Radar" icon={<Radar size={16} />}>
                  <Segmented
                    label="Forma de grilla"
                    value={radarGridshape}
                    options={[
                      ["linear", "Polígono"],
                      ["circular", "Circular"],
                    ]}
                    onChange={(v) => setRadarGridshape(v as "linear" | "circular")}
                  />
                  <Segmented
                    label="Modo"
                    value={radarModo}
                    options={[
                      ["uno", "Uno"],
                      ["facet", "Facet"],
                      ["alternante", "Alternante"],
                    ]}
                    onChange={(v) => setRadarModo(v as "uno" | "facet" | "alternante")}
                  />
                  <label className="dash-dim-checkbox">
                    <input
                      type="checkbox"
                      checked={radarAnimado}
                      onChange={(e) => setRadarAnimado(e.target.checked)}
                    />
                    Animar entrada de mayor a menor
                  </label>
                  <SliderField id="dash-radar-min" label="Mín" min={0} max={95} step={5} value={radarMin} onChange={setRadarMin} />
                  <SliderField id="dash-radar-max" label="Máx" min={Math.max(radarMin + 5, 50)} max={200} step={5} value={radarMax} onChange={setRadarMax} />
                </SettingBlock>
              </section>
            )}

            {panel === "semaforo" && (
              <section className="dash-customize-panel">
                <PanelTitle
                  title="Semáforo"
                  text="Ajusta colores y cortes para los indicadores de score. Los cortes finos no ensucian la leyenda."
                />
                <Segmented
                  label="Modo del semáforo"
                  value={semaforoModo}
                  options={[
                    ["cortes", "Cortes"],
                    ["gradiente", "Gradiente"],
                  ]}
                  onChange={(v) => setSemaforoModo(v as "cortes" | "gradiente")}
                />
                <div className="dash-customize-sem-grid">
                  <ColorField label="Bajo" value={semRed} onChange={setSemaforoRedColor} />
                  <ColorField label="Medio" value={semAmber} onChange={setSemaforoAmberColor} />
                  <ColorField label="Alto" value={semGreen} onChange={setSemaforoGreenColor} />
                </div>
                <SliderField id="dash-sem-red-max" label="Bajo <" min={5} max={95} step={1} value={semRedMax} onChange={setSemaforoRedMax} />
                <SliderField id="dash-sem-amber-max" label="Medio <" min={semRedMax + 1} max={99} step={1} value={semAmberMax} onChange={setSemaforoAmberMax} />
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
                    <span className="dash-filtro-label">Cortes finos</span>
                    <button
                      type="button"
                      className="dash-quick-btn"
                      onClick={() => addSemaforoStop({ value: 50, color: "#FFFFFF" })}
                    >
                      <Plus size={14} /> Corte
                    </button>
                  </div>
                  {semStopsExtra.length === 0 ? (
                    <p className="dash-customize-help">Sin cortes extra.</p>
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
                          />
                          <input
                            type="color"
                            value={stop.color}
                            onChange={(e) => updateSemaforoStop(i, { color: e.target.value })}
                          />
                          <button
                            type="button"
                            className="dash-customize-stops-remove"
                            onClick={() => removeSemaforoStop(i)}
                            aria-label={`Quitar corte ${i + 1}`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="dash-customize-panel-title">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function SettingBlock({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="dash-customize-setting-block">
      <div className="dash-customize-setting-title">
        {icon}
        <strong>{title}</strong>
      </div>
      {children}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className="dash-filtro-label">{label}</span>
      <div
        className="dash-source-segments"
        role="tablist"
        aria-label={label}
        style={{ marginTop: 8, gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map(([id, labelText]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value === id}
            className={`dash-source-segment ${value === id ? "is-active" : ""}`}
            onClick={() => onChange(id)}
          >
            {labelText}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderField({
  id,
  label,
  min,
  max,
  step,
  value,
  suffix,
  disabled,
  format,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  disabled?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const text = format ? format(value) : `${Number.isInteger(value) ? value : value.toFixed(2)}${suffix ?? ""}`;
  return (
    <div className="dash-customize-slider-row">
      <label htmlFor={id} className="dash-filtro-label">{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dash-customize-slider"
      />
      <span className="dash-customize-slider-value">{text}</span>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="dash-customize-color-field">
      <span className="dash-filtro-label">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CategoryEditorRow({
  view,
  category,
  onAlias,
  onIcon,
}: {
  view: DashboardFodaViewConfig;
  category: string;
  onAlias: (id: string, category: string, alias: string) => void;
  onIcon: (id: string, category: string, icon: string) => void;
}) {
  const alias = view.aliases?.[category] ?? "";
  const icon = view.icons?.[category] ?? "";
  const isIconMode = view.card_mode === "iconos";

  function readIconFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onIcon(view.id, category, reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="dash-customize-category-row">
      <div className="dash-customize-category-key">
        <span>{category}</span>
        <small>valor real</small>
      </div>
      <label>
        <span className="dash-filtro-label">Alias</span>
        <input
          className="dash-input"
          value={alias}
          placeholder={initialsAlias(category)}
          onChange={(e) => onAlias(view.id, category, e.target.value)}
        />
      </label>
      <label>
        <span className="dash-filtro-label">Logo / icono</span>
        <div className="dash-customize-icon-field">
          <span className="dash-customize-icon-preview">
            {icon ? <img src={icon} alt="" /> : <Image size={16} />}
          </span>
          <input
            className="dash-input"
            value={icon}
            disabled={!isIconMode}
            placeholder="URL, ruta o data:image"
            onChange={(e) => onIcon(view.id, category, e.target.value)}
          />
          <label className={`dash-customize-upload ${!isIconMode ? "is-disabled" : ""}`}>
            <Upload size={14} />
            <input
              type="file"
              accept="image/*"
              disabled={!isIconMode}
              onChange={(e) => readIconFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </label>
      <button
        type="button"
        className="dash-customize-danger"
        onClick={() => {
          onAlias(view.id, category, "");
          onIcon(view.id, category, "");
        }}
        title="Limpiar categoría"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function fodaCategoriesForView(view: DashboardFodaViewConfig): string[] {
  const seed =
    view.variable === "distrito"
      ? Object.keys(DEFAULT_FODA_VIEWS.find((v) => v.id === "municipios")?.aliases ?? {})
      : view.variable === "servicio"
      ? DEFAULT_FODA_SERVICE_CATEGORIES
      : [];
  return [...new Set([
    ...seed,
    ...Object.keys(view.aliases ?? {}),
    ...Object.keys(view.icons ?? {}),
  ])].filter(Boolean);
}

function initialsAlias(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "CAT";
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]?.toUpperCase() ?? "").join("");
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
        style={{ gridTemplateColumns: `${redMax}fr ${amberMax - redMax}fr ${100 - amberMax}fr` }}
      >
        <span>0-{redMax}</span>
        <span>{redMax}-{semAmberMaxSafe(redMax, amberMax)}</span>
        <span>{amberMax}-100</span>
      </div>
    </div>
  );
}

function semAmberMaxSafe(redMax: number, amberMax: number) {
  return Math.max(redMax + 1, amberMax);
}

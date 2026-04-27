import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  HandHeart,
  Info,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Grid3x3,
  ScatterChart,
  type LucideIcon,
} from "lucide-react";
import type {
  DashboardDimFodaCuadrante,
  DashboardDimFodaItem,
  DashboardDimFodaPayload,
  DashboardDimPayload,
  DashboardDimSeccionesPayload,
} from "../../../../api/client";
import {
  useDashboardStore,
  type DashboardDimVisualMode,
} from "../../store";
import {
  useDimCatalogo,
  useDimCategoriasVar,
  useDimFoda,
  useDimPayload,
  useDimSeccionesVars,
} from "../../useDashboardData";
import { EmptyState } from "../../shared/EmptyState";
import { FiltrosMultiRow } from "../ResumenTab/FiltrosMultiRow";
import { PlotlyChart } from "../../shared/PlotlyChart";
import { FullscreenWrapper } from "../../shared/FullscreenWrapper";
import {
  colorOfScore as semColorOfScore,
  plotlyColorscale,
  semaforoFromConfig,
} from "../../shared/semaforo";
import "./dimensiones.css";
import "./foda.css";

// Tab Dimensiones — heatmap semáforo + barras / radar / FODA en un único
// visualizador con segmented control. Sidebar consolidado a 2 cards
// (Configuración con segmented Vista/Comparación/Iterar + Filtros).

type ConfigTab = "vista" | "comparacion" | "iterar";

export function DimensionesTab() {
  const filtros = useDashboardStore((s) => s.filtros);
  const setFiltros = useDashboardStore((s) => s.setFiltros);
  const dim = useDashboardStore((s) => s.dimensiones);
  const fodaIconosEnabled = useDashboardStore((s) => s.config.foda_iconos_enabled ?? true);
  const fodaIconTint = useDashboardStore((s) => s.config.foda_icon_tint ?? "#FFFFFF");
  const fodaIconSize = useDashboardStore((s) => s.config.foda_icon_size ?? 1);
  const fodaIconLegend = useDashboardStore((s) => s.config.foda_icon_legend ?? true);
  const fodaScoreMin = useDashboardStore((s) => s.config.foda_score_min ?? 0);
  const fodaScoreMax = useDashboardStore((s) => s.config.foda_score_max ?? 120);
  const fodaShowTotal = useDashboardStore((s) => s.config.foda_show_total ?? true);
  const fodaSpacing = useDashboardStore((s) => s.config.foda_spacing ?? 1.15);
  const fodaGridIntensity = useDashboardStore((s) => s.config.foda_grid_intensity ?? 0.42);
  const setDim = useDashboardStore((s) => s.setDimensiones);

  const { loading: loadingCat, error: errCat, payload: catalogo } = useDimCatalogo();
  const { payload: seccionesVars } = useDimSeccionesVars();
  const [configTab, setConfigTab] = useState<ConfigTab>("vista");

  const objetivos = useMemo(() => {
    if (!catalogo) return [];
    return dim.modo === "general" ? catalogo.general : catalogo.indicadores;
  }, [catalogo, dim.modo]);

  // Auto-seleccionar primer objetivo del modo activo si vacío.
  useEffect(() => {
    if (!objetivos.length) return;
    if (dim.objetivo && objetivos.some((o) => o.id === dim.objetivo)) return;
    setDim({ objetivo: objetivos[0].id });
  }, [objetivos, dim.objetivo, setDim]);

  const filtrosActivos = dim.filtrosOn ? filtros : [];
  const iter = dim.iterarOn && dim.iterarVar
    ? { var: dim.iterarVar, level: dim.iterarLevel || undefined }
    : null;
  const fodaConfig = useMemo(() => ({
    foda_iconos_enabled: fodaIconosEnabled,
    foda_icon_tint: fodaIconTint,
    foda_icon_size: fodaIconSize,
    foda_icon_legend: fodaIconLegend,
    foda_score_min: fodaScoreMin,
    foda_score_max: fodaScoreMax,
    foda_show_total: fodaShowTotal,
    foda_spacing: fodaSpacing,
    foda_grid_intensity: fodaGridIntensity,
  }), [
    fodaIconosEnabled,
    fodaIconTint,
    fodaIconSize,
    fodaIconLegend,
    fodaScoreMin,
    fodaScoreMax,
    fodaShowTotal,
    fodaSpacing,
    fodaGridIntensity,
  ]);

  const { loading, error, payload } = useDimPayload({
    modo: dim.modo,
    objetivo: dim.objetivo,
    cruce: dim.cruce,
    incluirTotal: dim.incluirTotal,
    iter,
    filtros: filtrosActivos,
  });

  const fodaQuery = useDimFoda({
    enabled: dim.visualMode === "foda" && Boolean(dim.objetivo),
    modo: dim.modo,
    objetivo: dim.objetivo,
    cruce: dim.cruce,
    incluirTotal: dim.incluirTotal,
    iter,
    filtros: filtrosActivos,
    fodaConfig,
  });

  if (catalogo && !catalogo.ready) {
    return (
      <EmptyState
        title="Genera dimensiones primero"
        subtitle="Esta pestaña requiere índices y subíndices construidos. Ve a Analítica → Dimensiones."
      />
    );
  }

  return (
    <div className="dash-resumen-layout">
      {/* ───── Sidebar — 2 cards ───── */}
      <aside className="dash-sidebar">
        <ConfiguracionCard
          tab={configTab}
          onTab={setConfigTab}
          dim={dim}
          setDim={setDim}
          objetivos={objetivos}
          loadingCat={loadingCat}
          errCat={errCat}
          secciones={seccionesVars?.secciones ?? []}
        />

        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">Filtros</h2>
          </div>
          <FiltrosMultiRow
            secciones={(seccionesVars?.secciones ?? []).map((s) => ({
              nombre: s.nombre,
              vars: s.vars.map((v) => ({ name: v.name, label: v.label, tipo: "so" as const })),
            }))}
            enabled={dim.filtrosOn}
            onToggleEnabled={(on) => setDim({ filtrosOn: on })}
            onChange={setFiltros}
          />
        </section>
      </aside>

      {/* ───── Main — VisualizadorCard ───── */}
      <main>
        {!dim.objetivo ? (
          <EmptyState
            icon={<Target size={32} aria-hidden="true" />}
            title="Selecciona un objetivo"
            subtitle="Elige un índice o subíndice del panel izquierdo para ver las dimensiones."
          />
        ) : (
          <VisualizadorCard
            dim={dim}
            setDim={setDim}
            payload={payload}
            payloadLoading={loading}
            payloadError={error}
            foda={fodaQuery.payload}
            fodaLoading={fodaQuery.loading}
            fodaError={fodaQuery.error}
          />
        )}
        <div style={{ height: 48 }} aria-hidden="true" />
      </main>
    </div>
  );
}

// =============================================================================
// Sidebar — Card Configuración con segmented Vista/Comparación/Iterar
// =============================================================================

function ConfiguracionCard({
  tab,
  onTab,
  dim,
  setDim,
  objetivos,
  loadingCat,
  errCat,
  secciones,
}: {
  tab: ConfigTab;
  onTab: (t: ConfigTab) => void;
  dim: ReturnType<typeof useDashboardStore.getState>["dimensiones"];
  setDim: (p: Partial<typeof dim>) => void;
  objetivos: { id: string; label: string; n_axes: number }[];
  loadingCat: boolean;
  errCat: string | null;
  secciones: DashboardDimSeccionesPayload["secciones"];
}) {
  return (
    <section className="dash-cardbox dash-dim-config">
      <div className="dash-dim-config-tabs" role="tablist" aria-label="Configuración">
        {(["vista", "comparacion", "iterar"] as ConfigTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`dash-dim-config-tab ${tab === t ? "is-active" : ""}`}
            onClick={() => onTab(t)}
          >
            {t === "vista" ? "Vista" : t === "comparacion" ? "Comparación" : "Iterar"}
          </button>
        ))}
      </div>

      <div className="dash-dim-config-panel">
        {tab === "vista" && (
          <PanelVista
            modo={dim.modo}
            objetivo={dim.objetivo}
            objetivos={objetivos}
            loading={loadingCat}
            error={errCat}
            onModo={(m) => setDim({ modo: m, objetivo: "" })}
            onObjetivo={(id) => setDim({ objetivo: id })}
          />
        )}
        {tab === "comparacion" && (
          <PanelComparacion
            secciones={secciones}
            cruce={dim.cruce}
            incluirTotal={dim.incluirTotal}
            onCruce={(v) => setDim({ cruce: v })}
            onIncluirTotal={(b) => setDim({ incluirTotal: b })}
          />
        )}
        {tab === "iterar" && (
          <PanelIterar
            secciones={secciones}
            enabled={dim.iterarOn}
            variable={dim.iterarVar}
            level={dim.iterarLevel}
            excludeVar={dim.cruce}
            onToggle={(on) => setDim({ iterarOn: on })}
            onVariable={(v) => setDim({ iterarVar: v, iterarLevel: "" })}
            onLevel={(l) => setDim({ iterarLevel: l })}
          />
        )}
      </div>
    </section>
  );
}

function PanelVista({
  modo,
  objetivo,
  objetivos,
  loading,
  error,
  onModo,
  onObjetivo,
}: {
  modo: "general" | "indicadores";
  objetivo: string;
  objetivos: { id: string; label: string; n_axes: number }[];
  loading: boolean;
  error: string | null;
  onModo: (m: "general" | "indicadores") => void;
  onObjetivo: (id: string) => void;
}) {
  return (
    <>
      <label className="dash-dim-label">Modo</label>
      <div className="dash-source-segments" role="tablist" aria-label="Modo de vista">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "general"}
          className={`dash-source-segment ${modo === "general" ? "is-active" : ""}`}
          onClick={() => onModo("general")}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "indicadores"}
          className={`dash-source-segment ${modo === "indicadores" ? "is-active" : ""}`}
          onClick={() => onModo("indicadores")}
        >
          Indicadores
        </button>
      </div>
      <label htmlFor="dim-objetivo" className="dash-dim-label" style={{ marginTop: 12 }}>
        Objetivo
      </label>
      {loading ? (
        <p className="dash-cardbox-help">Cargando catálogo…</p>
      ) : error ? (
        <p className="dash-cardbox-help">{error}</p>
      ) : !objetivos.length ? (
        <p className="dash-cardbox-help">Sin objetivos en este modo.</p>
      ) : (
        <select
          id="dim-objetivo"
          className="dash-select"
          value={objetivo}
          onChange={(e) => onObjetivo(e.target.value)}
        >
          {objetivos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.n_axes} ejes)
            </option>
          ))}
        </select>
      )}
    </>
  );
}

function PanelComparacion({
  secciones,
  cruce,
  incluirTotal,
  onCruce,
  onIncluirTotal,
}: {
  secciones: DashboardDimSeccionesPayload["secciones"];
  cruce: string;
  incluirTotal: boolean;
  onCruce: (v: string) => void;
  onIncluirTotal: (b: boolean) => void;
}) {
  const seccionDeVar = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sec of secciones) for (const v of sec.vars) m[v.name] = sec.nombre;
    return m;
  }, [secciones]);

  const [seccionLocal, setSeccionLocal] = useState<string>("");
  const seccion = seccionLocal || seccionDeVar[cruce] || (secciones[0]?.nombre ?? "");
  const seccionActiva = secciones.find((s) => s.nombre === seccion);

  if (!secciones.length) {
    return <p className="dash-cardbox-help">Sin variables de cruce.</p>;
  }

  return (
    <>
      <label htmlFor="dim-cmp-seccion" className="dash-dim-label">Sección</label>
      <select
        id="dim-cmp-seccion"
        className="dash-select"
        value={seccion}
        onChange={(e) => {
          setSeccionLocal(e.target.value);
          onCruce("");
        }}
      >
        {secciones.map((s) => (
          <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
        ))}
      </select>
      <label htmlFor="dim-cmp-var" className="dash-dim-label" style={{ marginTop: 8 }}>
        Comparar por
      </label>
      <select
        id="dim-cmp-var"
        className="dash-select"
        value={cruce}
        onChange={(e) => onCruce(e.target.value)}
      >
        <option value="">— Sin cruce —</option>
        {seccionActiva?.vars.map((v) => (
          <option key={v.name} value={v.name}>{v.label}</option>
        ))}
      </select>
      <label className="dash-dim-checkbox">
        <input
          type="checkbox"
          checked={incluirTotal}
          onChange={(e) => onIncluirTotal(e.target.checked)}
        />
        Incluir total
      </label>
    </>
  );
}

function PanelIterar({
  secciones,
  enabled,
  variable,
  level,
  excludeVar,
  onToggle,
  onVariable,
  onLevel,
}: {
  secciones: DashboardDimSeccionesPayload["secciones"];
  enabled: boolean;
  variable: string;
  level: string;
  excludeVar: string;
  onToggle: (on: boolean) => void;
  onVariable: (v: string) => void;
  onLevel: (l: string) => void;
}) {
  const seccionesElegibles = useMemo(
    () => secciones.map((s) => ({
      ...s,
      vars: s.vars.filter((v) => v.name !== excludeVar),
    })).filter((s) => s.vars.length > 0),
    [secciones, excludeVar],
  );

  const seccionDeVar = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sec of seccionesElegibles) for (const v of sec.vars) m[v.name] = sec.nombre;
    return m;
  }, [seccionesElegibles]);

  const [seccionLocal, setSeccionLocal] = useState<string>("");
  const seccion = seccionLocal || seccionDeVar[variable] || (seccionesElegibles[0]?.nombre ?? "");
  const seccionActiva = seccionesElegibles.find((s) => s.nombre === seccion);

  const { valores: niveles } = useDimCategoriasVar(enabled && variable ? variable : null);

  useEffect(() => {
    if (!enabled || !variable) return;
    if (level && niveles.some((n) => n.value === level)) return;
    if (niveles.length) onLevel(niveles[0].value);
  }, [enabled, variable, level, niveles, onLevel]);

  return (
    <>
      <label className="dash-dim-checkbox" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Activar iteración
      </label>
      {enabled && (
        <>
          <label htmlFor="dim-it-seccion" className="dash-dim-label">Sección</label>
          <select
            id="dim-it-seccion"
            className="dash-select"
            value={seccion}
            onChange={(e) => {
              setSeccionLocal(e.target.value);
              onVariable("");
            }}
          >
            {seccionesElegibles.map((s) => (
              <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
            ))}
          </select>
          <label htmlFor="dim-it-var" className="dash-dim-label" style={{ marginTop: 8 }}>
            Variable
          </label>
          <select
            id="dim-it-var"
            className="dash-select"
            value={variable}
            onChange={(e) => onVariable(e.target.value)}
          >
            <option value="">— Sin iteración —</option>
            {seccionActiva?.vars.map((v) => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
          {variable && niveles.length > 0 && (
            <>
              <label htmlFor="dim-it-level" className="dash-dim-label" style={{ marginTop: 8 }}>
                Nivel
              </label>
              <select
                id="dim-it-level"
                className="dash-select"
                value={level}
                onChange={(e) => onLevel(e.target.value)}
              >
                {niveles.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label} (n={Math.round(n.base)})
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}
    </>
  );
}

// =============================================================================
// VisualizadorCard — header con segmented [Heatmap | Barras | Radar | FODA]
// + body que renderiza el modo activo. Reúne lo que antes eran HeatmapCard
// y MainPlotCard en un solo container.
// =============================================================================

function VisualizadorCard({
  dim,
  setDim,
  payload,
  payloadLoading,
  payloadError,
  foda,
  fodaLoading,
  fodaError,
}: {
  dim: ReturnType<typeof useDashboardStore.getState>["dimensiones"];
  setDim: (p: Partial<typeof dim>) => void;
  payload: DashboardDimPayload | null;
  payloadLoading: boolean;
  payloadError: string | null;
  foda: DashboardDimFodaPayload | null;
  fodaLoading: boolean;
  fodaError: string | null;
}) {
  const visualMode: DashboardDimVisualMode = dim.visualMode;

  // Modo informativo del payload (sugerencia inicial). Si el usuario no
  // cambió aún, podríamos respetarla; de momento el toggle es libre.
  return (
    <section className="dash-cardbox dash-dim-vis">
      <div className="dash-dim-vis-header">
        <div className="dash-dim-vis-title">
          <h2 className="dash-cardbox-title">
            {visualMode === "heatmap"
              ? "Heatmap"
              : visualMode === "radar"
              ? "Radar de dimensiones"
              : visualMode === "foda"
              ? "Matriz FODA"
              : "Scores por dimensión"}
          </h2>
          {payload && payload.ready && <SubtituloDim payload={payload} />}
          {dim.iterarOn && dim.iterarVar && (
            <IterStepper
              variable={dim.iterarVar}
              level={dim.iterarLevel}
              onLevel={(l) => setDim({ iterarLevel: l })}
            />
          )}
        </div>
        <div className="dash-dim-vis-segmented" role="tablist" aria-label="Modo de visualización">
          <SegmentedItem
            active={visualMode === "heatmap"}
            onClick={() => setDim({ visualMode: "heatmap" })}
            icon={<Grid3x3 size={13} />}
            label="Heatmap"
          />
          <SegmentedItem
            active={visualMode === "barras"}
            onClick={() => setDim({ visualMode: "barras" })}
            icon={<BarChart3 size={13} />}
            label="Barras"
          />
          <SegmentedItem
            active={visualMode === "radar"}
            onClick={() => setDim({ visualMode: "radar" })}
            icon={<Compass size={13} />}
            label="Radar"
          />
          <SegmentedItem
            active={visualMode === "foda"}
            onClick={() => setDim({ visualMode: "foda" })}
            icon={<ScatterChart size={13} />}
            label="FODA"
          />
        </div>
      </div>

      <FullscreenWrapper
        title={
          visualMode === "heatmap" ? "Heatmap"
          : visualMode === "barras" ? "Scores por dimensión"
          : visualMode === "radar" ? "Radar de dimensiones"
          : "Matriz FODA"
        }
        className="dash-dim-vis-body"
      >
      <div key={visualMode}>
        {visualMode === "foda" ? (
          fodaLoading && !foda ? (
            <DimSkeleton mode="foda" />
          ) : fodaError ? (
            <EmptyState title="No se pudo calcular FODA" subtitle={fodaError} />
          ) : !foda || !foda.ready ? (
            <DimSkeleton mode="foda" />
          ) : foda.error ? (
            <EmptyState title="Sin datos para FODA" subtitle={foda.error} />
          ) : (
            <FodaView payload={foda} />
          )
        ) : payloadLoading && !payload ? (
          <DimSkeleton mode={visualMode} />
        ) : payloadError ? (
          <EmptyState title="No se pudieron calcular las dimensiones" subtitle={payloadError} />
        ) : !payload || !payload.ready ? (
          <DimSkeleton mode={visualMode} />
        ) : payload.error ? (
          <EmptyState title="Sin datos para esta vista" subtitle={payload.error} />
        ) : visualMode === "heatmap" ? (
          <HeatmapView payload={payload} />
        ) : (
          <MainPlotView payload={payload} visualMode={visualMode} />
        )}
      </div>
      </FullscreenWrapper>
    </section>
  );
}

// Stepper compacto prev/next del nivel actual de iteración. Reemplaza
// la fricción de tener que ir al sidebar para cambiar de nivel.
function IterStepper({
  variable,
  level,
  onLevel,
}: {
  variable: string;
  level: string;
  onLevel: (l: string) => void;
}) {
  const { valores } = useDimCategoriasVar(variable || null);
  const idx = Math.max(0, valores.findIndex((v) => v.value === level));
  const prev = valores[(idx - 1 + Math.max(1, valores.length)) % Math.max(1, valores.length)];
  const next = valores[(idx + 1) % Math.max(1, valores.length)];
  const current = valores[idx];

  // Shortcut Alt+← / Alt+→ para ciclar niveles desde cualquier sitio.
  useEffect(() => {
    if (!valores.length) return;
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onLevel(prev.value);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onLevel(next.value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [valores, prev, next, onLevel]);

  if (!valores.length) return null;
  return (
    <div className="dash-iter-stepper" role="group" aria-label="Cambiar nivel de iteración">
      <button
        type="button"
        className="dash-iter-stepper-btn"
        onClick={() => onLevel(prev.value)}
        aria-label={`Anterior: ${prev.label}`}
        title={`Anterior: ${prev.label}`}
      >
        <ChevronLeft size={14} />
      </button>
      <div className="dash-iter-stepper-info">
        <span className="dash-iter-stepper-label">{current?.label ?? "—"}</span>
        <span className="dash-iter-stepper-meta">
          {idx + 1} / {valores.length}
          {current?.base ? ` · n=${Math.round(current.base)}` : ""}
        </span>
      </div>
      <button
        type="button"
        className="dash-iter-stepper-btn"
        onClick={() => onLevel(next.value)}
        aria-label={`Siguiente: ${next.label}`}
        title={`Siguiente: ${next.label}`}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function SegmentedItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`dash-dim-vis-segment ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// =============================================================================
// HeatmapView — sigue mostrando matriz semáforo, pero ahora dentro del
// VisualizadorCard. Misma lógica de antes.
// =============================================================================

function HeatmapView({ payload }: { payload: DashboardDimPayload }) {
  const heat = payload.score_heat ?? [];
  const semaforo = payload.semaforo!;
  const config = useDashboardStore((s) => s.config);
  const sem = useMemo(
    () =>
      semaforoFromConfig(config, {
        red_color: semaforo.red_color,
        amber_color: semaforo.amber_color,
        green_color: semaforo.green_color,
        red_max: semaforo.red_max,
        amber_max: semaforo.amber_max,
      }),
    [config, semaforo],
  );

  const { traces, layout, axes } = useMemo(() => {
    if (!heat.length) {
      return { traces: [] as unknown[], layout: {}, axes: { x: [] as string[], y: [] as string[] } };
    }
    const xVals = uniqueOrdered(heat.map((r) => r.grupo));
    const yVals = payload.axis_order_heat?.length
      ? [...payload.axis_order_heat]
      : uniqueOrdered(heat.map((r) => r.axis_label));

    const z: (number | null)[][] = yVals.map((axis) =>
      xVals.map((g) => {
        const row = heat.find((r) => r.axis_label === axis && r.grupo === g);
        return row?.score_round ?? null;
      }),
    );
    const text: string[][] = z.map((row) =>
      row.map((v) => (v == null ? "—" : String(Math.round(v)))),
    );

    // Colorscale unificado vía helper compartido (modo y umbrales del config).
    const cs = plotlyColorscale(sem);

    const traces = [
      {
        type: "heatmap" as const,
        x: xVals,
        y: yVals,
        z,
        text,
        texttemplate: "%{text}",
        // Texto blanco con sombra para garantizar contraste sobre ámbar
        // (legibilidad WCAG AA aunque el color base no llegue a ratio puro).
        textfont: { color: "#fff", size: 12, family: "system-ui, sans-serif" },
        hovertemplate:
          "<b>%{y}</b><br>%{x}: %{z:.0f}<extra></extra>",
        zmin: 0,
        zmax: 100,
        colorscale: cs,
        showscale: false,
        xgap: 2,
        ygap: 2,
      },
    ];
    const layout = {
      xaxis: { side: "top", tickfont: { size: 11 }, automargin: true, fixedrange: true },
      yaxis: { autorange: "reversed", tickfont: { size: 11 }, automargin: true, fixedrange: true },
      margin: { t: 40, r: 16, b: 16, l: 16 },
    };
    return { traces, layout, axes: { x: xVals, y: yVals } };
  }, [heat, payload.axis_order_heat, sem]);

  if (!heat.length) {
    return <p className="dash-cardbox-help">Sin datos para mostrar.</p>;
  }

  const altura = Math.min(560, Math.max(280, axes.y.length * 36 + 80));

  return (
    <>
      <PlotlyChart
        data={traces}
        layout={layout}
        height={altura}
        ariaLabel="Heatmap semáforo de dimensiones"
      />
      <div className="dash-dim-heat-legend" aria-label="Leyenda semáforo">
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: sem.red }} />
          0–{sem.redMax - 1} bajo
        </span>
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: sem.amber }} />
          {sem.redMax}–{sem.amberMax - 1} medio
        </span>
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: sem.green }} />
          {sem.amberMax}–100 alto
        </span>
      </div>
    </>
  );
}

// =============================================================================
// MainPlotView — barras horizontales o radar.
// =============================================================================

function MainPlotView({
  payload,
  visualMode,
}: {
  payload: DashboardDimPayload;
  visualMode: "barras" | "radar";
}) {
  const rows = payload.score_plot ?? [];
  const groups = useMemo(() => uniqueOrdered(rows.map((r) => r.grupo)), [rows]);

  // En modo barras: ordenar ejes por score descendente del primer grupo
  // (el grupo de referencia, típicamente "Total"). En modo radar: respetar
  // el orden del payload para no romper la simetría angular.
  const axes = useMemo(() => {
    const fallback = payload.axis_order_plot?.length
      ? [...payload.axis_order_plot]
      : uniqueOrdered(rows.map((r) => r.axis_label));
    if (visualMode !== "barras") return fallback;
    const refGroup = groups[0];
    if (!refGroup) return fallback;
    const scoreByAxis = new Map<string, number>();
    for (const axis of fallback) {
      const row = rows.find((r) => r.axis_label === axis && r.grupo === refGroup);
      scoreByAxis.set(axis, row?.score_round ?? -Infinity);
    }
    // Sort desc por score; los axes sin score (-Infinity) van al final.
    return [...fallback].sort((a, b) => (scoreByAxis.get(b)! - scoreByAxis.get(a)!));
  }, [rows, payload.axis_order_plot, groups, visualMode]);

  const groupColors = payload.group_colors ?? {};
  const semaforo = payload.semaforo;
  const config = useDashboardStore((s) => s.config);
  const radarMin = config.radar_min ?? 0;
  const radarMax = config.radar_max ?? 100;
  const radarGridshape = config.radar_gridshape ?? "linear";
  const radarModo = config.radar_modo ?? "uno";
  const radarAnimado = config.radar_animado ?? true;
  const barrasOrientacion = config.barras_orientacion ?? "horizontal";
  const barrasXMin = config.barras_x_min ?? 0;
  const barrasXMax = config.barras_x_max ?? 100;
  // Para modo radar "alternante": índice del grupo activo (cicla entre grupos).
  const [alternanteIdx, setAlternanteIdx] = useState(0);

  // Color del semáforo según el score (cortes/gradiente y umbrales del
  // config personalizable). Helper compartido que también usan heatmap y FODA.
  const colorOfScore = useMemo(() => {
    const sem = semaforoFromConfig(config, semaforo
      ? {
          red_color: semaforo.red_color,
          amber_color: semaforo.amber_color,
          green_color: semaforo.green_color,
          red_max: semaforo.red_max,
          amber_max: semaforo.amber_max,
        }
      : null);
    return (v: number | null | undefined) => semColorOfScore(v, sem);
  }, [config, semaforo]);

  if (!rows.length) {
    return <p className="dash-cardbox-help">Sin datos para graficar.</p>;
  }

  // ── Modo BARRAS ────────────────────────────────────────────────────────
  if (visualMode === "barras") {
    if (barrasOrientacion === "facet") {
      // Facet: divide los axes en dos mitades y renderiza dos sub-plots
      // horizontales lado a lado (top half / bottom half).
      const half = Math.ceil(axes.length / 2);
      const left = axes.slice(0, half);
      const right = axes.slice(half);
      return (
        <div className="dash-dim-bars-facet">
          <BarrasPlot
            axes={left}
            groups={groups}
            rows={rows}
            groupColors={groupColors}
            orientation="horizontal"
            xMin={barrasXMin}
            xMax={barrasXMax}
            colorOfScore={colorOfScore}
            ariaLabel="Barras facet izquierda"
          />
          <BarrasPlot
            axes={right}
            groups={groups}
            rows={rows}
            groupColors={groupColors}
            orientation="horizontal"
            xMin={barrasXMin}
            xMax={barrasXMax}
            colorOfScore={colorOfScore}
            ariaLabel="Barras facet derecha"
          />
        </div>
      );
    }
    return (
      <BarrasPlot
        axes={axes}
        groups={groups}
        rows={rows}
        groupColors={groupColors}
        orientation={barrasOrientacion}
        xMin={barrasXMin}
        xMax={barrasXMax}
        colorOfScore={colorOfScore}
        ariaLabel="Barras de scores"
      />
    );
  }

  // ── Modo RADAR ─────────────────────────────────────────────────────────
  // Si está animado, ordenar axes por score desc del primer grupo (Total).
  const radarAxes = (() => {
    if (!radarAnimado) {
      return payload.axis_order_plot?.length
        ? [...payload.axis_order_plot]
        : uniqueOrdered(rows.map((r) => r.axis_label));
    }
    return [...axes];
  })();

  if (radarModo === "facet" && groups.length > 1) {
    return (
      <div className="dash-dim-radar-facet">
        {groups.map((g) => (
          <RadarPlot
            key={g}
            axes={radarAxes}
            groups={[g]}
            rows={rows}
            groupColors={groupColors}
            radarMin={radarMin}
            radarMax={radarMax}
            gridshape={radarGridshape}
            animado={radarAnimado}
            title={g}
            height={360}
          />
        ))}
      </div>
    );
  }

  if (radarModo === "alternante" && groups.length > 1) {
    const safeIdx = ((alternanteIdx % groups.length) + groups.length) % groups.length;
    const activeGroup = groups[safeIdx];
    return (
      <>
        <RadarAlternanteToolbar
          groups={groups}
          activeIdx={safeIdx}
          onIdx={setAlternanteIdx}
          colors={groupColors}
        />
        <RadarPlot
          axes={radarAxes}
          groups={[activeGroup]}
          rows={rows}
          groupColors={groupColors}
          radarMin={radarMin}
          radarMax={radarMax}
          gridshape={radarGridshape}
          animado={radarAnimado}
          height={560}
        />
      </>
    );
  }

  return (
    <RadarPlot
      axes={radarAxes}
      groups={groups}
      rows={rows}
      groupColors={groupColors}
      radarMin={radarMin}
      radarMax={radarMax}
      gridshape={radarGridshape}
      animado={radarAnimado}
      height={600}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente Barras (h | v) con chip rectangular del semáforo.
// ─────────────────────────────────────────────────────────────────────────────
function BarrasPlot({
  axes,
  groups,
  rows,
  groupColors,
  orientation,
  xMin,
  xMax,
  colorOfScore,
  ariaLabel,
}: {
  axes: string[];
  groups: string[];
  rows: { grupo: string; axis_label: string; score_round: number | null }[];
  groupColors: Record<string, string>;
  orientation: "horizontal" | "vertical";
  xMin: number;
  xMax: number;
  colorOfScore: (v: number | null | undefined) => string | null;
  ariaLabel: string;
}) {
  const isV = orientation === "vertical";
  const traces = groups.map((g) => {
    const vals = axes.map((a) => {
      const row = rows.find((x) => x.grupo === g && x.axis_label === a);
      return row?.score_round ?? null;
    });
    return isV
      ? {
          type: "bar" as const,
          name: g,
          orientation: "v" as const,
          x: axes,
          y: vals,
          marker: { color: groupColors[g] ?? undefined },
          hovertemplate: `${g}<br>%{x}: %{y:.0f}<extra></extra>`,
        }
      : {
          type: "bar" as const,
          name: g,
          orientation: "h" as const,
          x: vals,
          y: axes,
          marker: { color: groupColors[g] ?? undefined },
          hovertemplate: `${g}<br>%{y}: %{x:.0f}<extra></extra>`,
        };
  });

  // Chips semáforo al final de cada barra. Plotly barmode="group":
  // ancho_barra = (1 - bargap) / n, offset = (gi - (n-1)/2) * ancho.
  const annotations: unknown[] = [];
  const nGroups = Math.max(1, groups.length);
  const bargap = 0.2;
  const widthPerBar = (1 - bargap) / nGroups;
  for (let gi = 0; gi < groups.length; gi++) {
    const offset = (gi - (nGroups - 1) / 2) * widthPerBar;
    for (let ai = 0; ai < axes.length; ai++) {
      const row = rows.find((r) => r.grupo === groups[gi] && r.axis_label === axes[ai]);
      const v = row?.score_round ?? null;
      if (v == null) continue;
      const color = colorOfScore(v) ?? "#5f6b7a";
      annotations.push({
        x: isV ? ai + offset : v,
        y: isV ? v : ai + offset,
        xref: "x",
        yref: "y",
        text: `<b>${Math.round(v)}</b>`,
        showarrow: false,
        xanchor: isV ? "center" : "left",
        yanchor: isV ? "bottom" : "middle",
        xshift: isV ? 0 : 5,
        yshift: isV ? 4 : 0,
        font: { color: "#fff", size: 10, family: "system-ui, sans-serif" },
        bgcolor: color,
        bordercolor: color,
        borderpad: 3,
        borderwidth: 0,
        opacity: 0.96,
      });
    }
  }

  // Buffer al final del eje numérico para que quepan los chips.
  const buffer = (xMax - xMin) * 0.12;
  const numericRange: [number, number] = [xMin, xMax + buffer];
  const numericTicks = computeTicks(xMin, xMax);

  const layout = isV
    ? {
        barmode: "group",
        xaxis: {
          tickfont: { size: 11 },
          automargin: true,
          tickmode: "array" as const,
          tickvals: axes,
          ticktext: axes,
        },
        yaxis: { range: numericRange, fixedrange: true, tickfont: { size: 11 }, tickvals: numericTicks },
        showlegend: groups.length > 1,
        legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18 },
        margin: { t: 16, r: 24, b: 80, l: 40 },
        annotations,
        bargap: 0.2,
        bargroupgap: 0,
      }
    : {
        barmode: "group",
        xaxis: { range: numericRange, fixedrange: true, tickfont: { size: 11 }, tickvals: numericTicks },
        yaxis: {
          autorange: "reversed",
          tickfont: { size: 11 },
          automargin: true,
          tickmode: "array" as const,
          tickvals: axes,
          ticktext: axes,
        },
        showlegend: groups.length > 1,
        legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18 },
        margin: { t: 16, r: 24, b: 50, l: 24 },
        annotations,
        bargap: 0.2,
        bargroupgap: 0,
      };

  const altura = isV
    ? Math.max(380, axes.length * Math.max(40, groups.length * 22 + 14) * 0.6 + 120)
    : Math.max(360, axes.length * Math.max(40, groups.length * 22 + 14) + 100);

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      height={altura}
      ariaLabel={ariaLabel}
    />
  );
}

// Calcula tick values bonitos en un rango [min, max].
function computeTicks(min: number, max: number): number[] {
  const span = max - min;
  const step = span <= 30 ? 5 : span <= 60 ? 10 : 20;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  if (!out.length || out[out.length - 1] !== max) out.push(max);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente RadarPlot.
// ─────────────────────────────────────────────────────────────────────────────
function RadarPlot({
  axes,
  groups,
  rows,
  groupColors,
  radarMin,
  radarMax,
  gridshape,
  animado,
  title,
  height = 600,
}: {
  axes: string[];
  groups: string[];
  rows: { grupo: string; axis_label: string; score_round: number | null }[];
  groupColors: Record<string, string>;
  radarMin: number;
  radarMax: number;
  gridshape: "linear" | "circular";
  animado: boolean;
  title?: string;
  height?: number;
}) {
  const traces = groups.map((g) => {
    const r = axes.map((a) => {
      const row = rows.find((x) => x.grupo === g && x.axis_label === a);
      return row?.score_round ?? null;
    });
    const closedTheta = [...axes, axes[0]];
    const closedR = [...r, r[0]];
    const color = groupColors[g] ?? "#0E3B74";
    return {
      type: "scatterpolar" as const,
      mode: "lines+markers",
      name: g,
      theta: closedTheta,
      r: closedR,
      fill: "toself",
      fillcolor: colorToRgba(color, 0.1),
      opacity: 1,
      line: { color, width: 3.2, shape: "linear" as const },
      marker: { color, size: 7, line: { color: "#fff", width: 1.2 } },
      hovertemplate: `<b>${g}</b><br>%{theta}: %{r:.0f}<extra></extra>`,
    };
  });

  const layout = {
    polar: {
      radialaxis: {
        range: [radarMin, radarMax],
        tickfont: { size: 10 },
        fixedrange: true,
        showline: false,
        gridcolor: "rgba(15, 23, 42, 0.08)",
      },
      angularaxis: {
        tickfont: { size: 11 },
        fixedrange: true,
        gridcolor: "rgba(15, 23, 42, 0.08)",
      },
      gridshape,
      bgcolor: "rgba(0,0,0,0)",
    },
    showlegend: groups.length > 1,
    legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.08 },
    margin: { t: title ? 36 : 24, r: 24, b: 50, l: 24 },
    title: title ? { text: title, font: { size: 12 }, x: 0.5, xanchor: "center", y: 0.97 } : undefined,
    transition: animado
      ? { duration: 500, easing: "cubic-in-out" }
      : undefined,
  };

  return (
    <div className={animado ? "dash-dim-radar dash-dim-radar-animado" : "dash-dim-radar"}>
      <PlotlyChart
        data={traces}
        layout={layout}
        height={height}
        ariaLabel={title ? `Radar ${title}` : "Radar de dimensiones"}
      />
    </div>
  );
}

// Toolbar para modo radar alternante: chips clickeables para cada grupo.
function RadarAlternanteToolbar({
  groups,
  activeIdx,
  onIdx,
  colors,
}: {
  groups: string[];
  activeIdx: number;
  onIdx: (i: number) => void;
  colors: Record<string, string>;
}) {
  return (
    <div className="dash-dim-radar-alt-toolbar" role="tablist" aria-label="Alternar grupo del radar">
      {groups.map((g, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={active}
            className={`dash-dim-radar-alt-chip ${active ? "is-active" : ""}`}
            onClick={() => onIdx(i)}
            style={active && colors[g] ? { ["--alt-accent" as string]: colors[g] } : undefined}
          >
            <span
              className="dash-dim-radar-alt-dot"
              style={{ background: colors[g] ?? "var(--dash-primario)" }}
            />
            {g}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// FodaView — matriz 2×2 + scatter de dispersión, con sub-segmented.
// =============================================================================

const CUADRANTE_LABELS: Record<DashboardDimFodaCuadrante, string> = {
  fortaleza: "Fortalezas",
  oportunidad: "Oportunidades",
  debilidad: "Debilidades",
  amenaza: "Amenazas",
};

const CUADRANTE_DESC: Record<DashboardDimFodaCuadrante, string> = {
  fortaleza: "Score alto · variabilidad baja",
  oportunidad: "Score alto · variabilidad alta",
  debilidad: "Score bajo · variabilidad baja",
  amenaza: "Score bajo · variabilidad alta",
};

function FodaView({
  payload,
}: {
  payload: DashboardDimFodaPayload;
}) {
  const items = payload.items ?? [];
  const showTotal = useDashboardStore((s) => s.config.foda_show_total ?? true);
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");
  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const it of items) {
      if (!showTotal && isFodaTotalItem(it)) continue;
      const label = it.grupo || "Total";
      const key = it.grupo_key || label;
      if (!seen.has(key)) seen.set(key, label);
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [items, showTotal]);
  useEffect(() => {
    if (selectedGroup === "__all__") return;
    if (groupOptions.some((g) => g.key === selectedGroup)) return;
    setSelectedGroup("__all__");
  }, [groupOptions, selectedGroup]);
  const visibleItems = useMemo(
    () => items.filter((it) => {
      if (!showTotal && isFodaTotalItem(it)) return false;
      if (selectedGroup === "__all__") return true;
      return (it.grupo_key || it.grupo || "Total") === selectedGroup;
    }),
    [items, selectedGroup, showTotal],
  );
  const counts = useMemo(
    () => countFodaQuadrants(visibleItems),
    [visibleItems],
  );

  return (
    <div className="dash-foda">
      <div className="dash-foda-toolbar">
        <div className="dash-foda-cortes" aria-label="Cortes FODA">
          <span><strong>Corte score:</strong> {payload.cortes?.score ?? 80}</span>
          <span className="dash-foda-cortes-sep">·</span>
          <span><strong>Corte SD:</strong> {payload.cortes?.sd ?? 0}</span>
        </div>
        {groupOptions.length > 1 && (
          <FodaGroupNav
            options={groupOptions}
            selected={selectedGroup}
            onSelect={setSelectedGroup}
          />
        )}
        <FodaCounts counts={counts} payload={payload} />
      </div>
      <FodaDispersion items={visibleItems} payload={payload} />
    </div>
  );
}

// Navegador de grupos del FODA — modo doble:
// - Si hay ≤4 grupos: chips horizontales con scroll (no se tapan).
// - Si hay >4 grupos: stepper [‹] [grupo · idx/total] [›] como el de
//   iteración para que no se solapen.
function FodaGroupNav({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const ALL: { key: string; label: string } = { key: "__all__", label: "Todos" };
  const all = [ALL, ...options];
  const useStepper = options.length > 4;

  if (useStepper) {
    const idx = Math.max(0, all.findIndex((o) => o.key === selected));
    const prev = all[(idx - 1 + all.length) % all.length];
    const next = all[(idx + 1) % all.length];
    const current = all[idx];
    return (
      <div className="dash-iter-stepper" role="group" aria-label="Cambiar grupo del FODA">
        <button
          type="button"
          className="dash-iter-stepper-btn"
          onClick={() => onSelect(prev.key)}
          aria-label={`Anterior: ${prev.label}`}
          title={`Anterior: ${prev.label}`}
        >
          <ChevronLeft size={14} />
        </button>
        <div className="dash-iter-stepper-info">
          <span className="dash-iter-stepper-label">{current.label}</span>
          <span className="dash-iter-stepper-meta">
            {idx + 1} / {all.length}
          </span>
        </div>
        <button
          type="button"
          className="dash-iter-stepper-btn"
          onClick={() => onSelect(next.key)}
          aria-label={`Siguiente: ${next.label}`}
          title={`Siguiente: ${next.label}`}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="dash-foda-group-filter" aria-label="Filtrar FODA por grupo">
      <span>Ver</span>
      <button
        type="button"
        className={selected === "__all__" ? "is-active" : ""}
        onClick={() => onSelect("__all__")}
      >
        Todos
      </button>
      {options.map((g) => (
        <button
          key={g.key}
          type="button"
          className={selected === g.key ? "is-active" : ""}
          onClick={() => onSelect(g.key)}
          title={g.label}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

// Mini-leyenda con counts por cuadrante (reemplaza el header de la matriz).
function FodaCounts({
  counts,
  payload,
}: {
  counts: Record<DashboardDimFodaCuadrante, number>;
  payload: DashboardDimFodaPayload;
}) {
  const semaforo = payload.semaforo!;
  const accent: Record<DashboardDimFodaCuadrante, string> = {
    fortaleza: semaforo.green_color,
    oportunidad: "#1B679D",
    debilidad: semaforo.amber_color,
    amenaza: semaforo.red_color,
  };
  const orden: DashboardDimFodaCuadrante[] = ["fortaleza", "oportunidad", "debilidad", "amenaza"];
  return (
    <div className="dash-foda-counts" aria-label="Conteo por cuadrante">
      {orden.map((q) => (
        <span key={q} className="dash-foda-count-chip">
          <span
            className="dash-foda-count-dot"
            style={{ background: accent[q] }}
            aria-hidden="true"
          />
          <span className="dash-foda-count-label">{CUADRANTE_LABELS[q]}</span>
          <strong>{counts[q] ?? 0}</strong>
        </span>
      ))}
    </div>
  );
}

function FodaDispersion({
  items,
  payload,
}: {
  items: DashboardDimFodaItem[];
  payload: DashboardDimFodaPayload;
}) {
  const semaforo = payload.semaforo!;
  const corteScore = payload.cortes?.score ?? 80;
  const corteSd = payload.cortes?.sd ?? 0;
  const config = useDashboardStore((s) => s.config);
  const fodaIconosEnabled = config.foda_iconos_enabled ?? true;
  const fodaIconTint = config.foda_icon_tint ?? "#FFFFFF";
  const fodaIconSize = config.foda_icon_size ?? 1;
  const fodaIconLegend = config.foda_icon_legend ?? true;
  const fodaScoreMin = config.foda_score_min ?? 0;
  const fodaScoreMax = config.foda_score_max ?? 120;
  const fodaSpacing = config.foda_spacing ?? 1.15;
  const fodaGridIntensity = config.foda_grid_intensity ?? 0.42;
  const sem = useMemo(
    () => semaforoFromConfig(config, {
      red_color: semaforo.red_color,
      amber_color: semaforo.amber_color,
      green_color: semaforo.green_color,
      red_max: semaforo.red_max,
      amber_max: semaforo.amber_max,
    }),
    [config, semaforo],
  );

  const plot = useMemo(
    () => buildFodaLegacyPlot(
      items,
      payload.group_colors ?? {},
      corteScore,
      corteSd,
      fodaScoreMin,
      fodaScoreMax,
      fodaSpacing,
    ),
    [items, payload.group_colors, corteScore, corteSd, fodaScoreMin, fodaScoreMax, fodaSpacing],
  );
  const iconScale = Math.max(0.5, Math.min(1.8, fodaIconSize));
  const gridAlpha = (0.012 + Math.max(0, Math.min(1, fodaGridIntensity)) * 0.045).toFixed(3);
  const iconLegend = useMemo(
    () => buildFodaIconLegend(items, payload.icon_legend ?? []),
    [items, payload.icon_legend],
  );

  if (!items.length) {
    return <p className="dash-cardbox-help">Sin datos para la dispersión.</p>;
  }

  return (
    <>
      <div className="dash-foda-legacy" role="img" aria-label="Dispersión FODA de puntaje y variabilidad">
        <div className="dash-foda-axis-note is-y-high">Mayor puntaje</div>
        <div className="dash-foda-axis-note is-y-low">Menor puntaje</div>
        <div
          className="dash-foda-legacy-panel"
          style={{ ["--dash-foda-grid-alpha" as string]: gridAlpha }}
        >
          <div className="dash-foda-legacy-area-label is-fortaleza">Fortaleza</div>
          <div className="dash-foda-legacy-area-label is-oportunidad">Oportunidad</div>
          <div className="dash-foda-legacy-area-label is-debilidad">Debilidad</div>
          <div className="dash-foda-legacy-area-label is-amenaza">Amenaza</div>
          <div
            className="dash-foda-legacy-cut is-vertical"
            style={{ left: `${plot.cutX}%` }}
            aria-hidden="true"
          />
          <div
            className="dash-foda-legacy-cut is-horizontal"
            style={{ top: `${plot.cutY}%` }}
            aria-hidden="true"
          />
          {plot.points.map((p) => (
            <div
              key={p.key}
              className={`dash-foda-legacy-card ${isFodaTotalItem(p) ? "is-total" : ""}`}
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                background: p.color,
                ["--dash-foda-icon-scale" as string]: iconScale,
                ["--dash-foda-card-scale" as string]: iconScale,
              }}
              title={`${p.axis_label}${p.grupo ? ` · ${p.grupo}` : ""}\nPuntaje: ${p.score_mean}\nSD: ${p.score_sd}\nn: ${p.n_valid}`}
            >
              <span className="dash-foda-legacy-title">
                {fodaIconosEnabled ? (
                  <FodaAxisIcon
                    label={p.axis_label}
                    src={p.icono_url}
                    tint={fodaIconTint}
                    scale={iconScale}
                  />
                ) : (
                  shortAxisLabel(p.axis_label)
                )}
              </span>
              <span
                className="dash-foda-legacy-score"
                style={{ background: semColorOfScore(p.score_mean, sem) ?? sem.green }}
              >
                {Math.round(p.score_mean)}
              </span>
            </div>
          ))}
        </div>
        <div className="dash-foda-axis-note is-x-low">Menor dispersión</div>
        <div className="dash-foda-axis-note is-x-high">Mayor dispersión</div>
        <div className="dash-foda-legacy-xaxis">
          <span>0</span>
          <span>{formatFodaTick(corteSd)}</span>
          <span>{formatFodaTick(plot.xMax)}</span>
        </div>
        <div className="dash-foda-legacy-xtitle">Variabilidad</div>
      </div>
      {plot.groups.length > 1 && (
        <div className="dash-foda-group-legend" aria-label="Leyenda por comparación">
          {plot.groups.map((g) => (
            <span key={g.label} className="dash-foda-group-legend-item">
              <span style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      )}
      {fodaIconosEnabled && fodaIconLegend && Boolean(iconLegend.length) && (
        <div className="dash-foda-icon-legend" aria-label="Leyenda de iconos FODA">
          {iconLegend.map((it) => {
            // Reúne TODOS los scores reales de esta dimensión (uno por
            // grupo del cruce). El usuario quiere ver los valores reales,
            // no solo el extremo. Si solo hay 1, mostramos el número
            // simple; si hay varios, mostramos un rango compacto.
            const scores = items
              .filter((x) => x.var === it.var && Number.isFinite(x.score_mean))
              .map((x) => Math.round(x.score_mean));
            const min = scores.length ? Math.min(...scores) : null;
            const max = scores.length ? Math.max(...scores) : null;
            const same = min !== null && min === max;
            return (
              <span key={it.var} className="dash-foda-icon-legend-item">
                <FodaAxisIcon
                  label={it.label}
                  src={it.icono_url}
                  tint="var(--dash-primario)"
                  scale={0.75}
                />
                <span className="dash-foda-icon-legend-text">{it.label}</span>
                {min !== null && (
                  <span className="dash-foda-icon-legend-vals">
                    {same
                      ? min
                      : `${min}–${max}`}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}

type FodaIconLegendUiItem = {
  var: string;
  label: string;
  icono_url?: string;
};

const FODA_FALLBACK_ICONS: Record<string, LucideIcon> = {
  trato: HandHeart,
  tiempo: Clock3,
  informacion: Info,
  accesibilidad: Accessibility,
  ambiente: Building2,
  confianza: ShieldCheck,
  comunicacion: MessageCircle,
  calidad: Sparkles,
  default: Target,
};

function FodaAxisIcon({
  label,
  src,
  tint,
  scale,
}: {
  label: string;
  src?: string;
  tint: string;
  scale: number;
}) {
  if (src) return <img src={src} alt="" />;
  const Icon = FODA_FALLBACK_ICONS[fodaIconKey(label)] ?? FODA_FALLBACK_ICONS.default;
  const size = Math.round(18 + Math.max(0.6, Math.min(1.8, scale)) * 8);
  return (
    <Icon
      className="dash-foda-fallback-icon"
      color={tint}
      size={size}
      strokeWidth={2.35}
      aria-hidden="true"
    />
  );
}

function buildFodaIconLegend(
  items: DashboardDimFodaItem[],
  payloadLegend: NonNullable<DashboardDimFodaPayload["icon_legend"]>,
): FodaIconLegendUiItem[] {
  const iconByVar = new Map(payloadLegend.map((it) => [it.var, it.icono_url]));
  const out = new Map<string, FodaIconLegendUiItem>();
  for (const it of items) {
    if (out.has(it.var)) continue;
    out.set(it.var, {
      var: it.var,
      label: it.axis_label,
      icono_url: it.icono_url ?? iconByVar.get(it.var),
    });
  }
  return [...out.values()];
}

function fodaIconKey(label: string): string {
  const s = normalizeSearchText(label);
  if (/trato|atencion|servicio|amabilidad|respeto|personal/.test(s)) return "trato";
  if (/tiempo|espera|rapidez|demora|horario|puntual/.test(s)) return "tiempo";
  if (/info|informacion|comunicacion|orientacion|claridad/.test(s)) return "informacion";
  if (/acces|facil|discap|inclusion|tramite/.test(s)) return "accesibilidad";
  if (/ambi|ambiente|infra|espacio|local|instalac|comodidad/.test(s)) return "ambiente";
  if (/confianza|seguridad|transparen|cumpl/.test(s)) return "confianza";
  if (/calidad|satisf|resultado|efectiv/.test(s)) return "calidad";
  return "default";
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isFodaTotalItem(it: Pick<DashboardDimFodaItem, "grupo" | "grupo_key" | "is_total_global">): boolean {
  return Boolean(it.is_total_global) || it.grupo_key === "__total__" || (it.grupo || "").toLowerCase() === "total";
}

function countFodaQuadrants(items: DashboardDimFodaItem[]): Record<DashboardDimFodaCuadrante, number> {
  const counts: Record<DashboardDimFodaCuadrante, number> = {
    fortaleza: 0,
    oportunidad: 0,
    debilidad: 0,
    amenaza: 0,
  };
  for (const it of items) {
    if (it.cuadrante) counts[it.cuadrante] += 1;
  }
  return counts;
}

function buildFodaLegacyPlot(
  items: DashboardDimFodaItem[],
  groupColors: Record<string, string>,
  corteScore: number,
  corteSd: number,
  scoreMin: number,
  scoreMax: number,
  spacing: number,
) {
  const maxSd = Math.max(...items.map((it) => it.score_sd), corteSd, 1);
  const xMax = Math.max(1, maxSd * 1.22, corteSd * 2.05);
  const yMin = Math.max(0, Math.min(95, scoreMin));
  const yMax = Math.max(yMin + 5, Math.min(140, scoreMax));
  const clampPct = (v: number) => Math.max(5, Math.min(95, v));
  const groupLabels = uniqueOrdered(items.map((it) => it.grupo || "Total"));
  const groups = groupLabels.map((label) => {
    const item = items.find((it) => (it.grupo || "Total") === label);
    return { label, color: groupColors[label] ?? item?.color ?? "#2F4A66" };
  });
  const rawPoints = items.map((it, i) => {
    const jitterX = Math.sin((i + 1) * 2.399 + 0.7) * 2.6 * spacing;
    const jitterY = Math.cos((i + 1) * 1.913 + 0.2) * 1.9 * spacing;
    const left = clampPct((it.score_sd / xMax) * 100 + jitterX);
    const top = clampPct(100 - ((it.score_mean - yMin) / (yMax - yMin)) * 100 + jitterY);
    const group = it.grupo || "Total";
    return {
      ...it,
      key: `${it.var}-${it.grupo_key ?? group}-${i}`,
      left,
      top,
      color: groupColors[group] ?? it.color ?? "#2F4A66",
    };
  });
  const points = repelFodaPoints(rawPoints, spacing);
  return {
    xMax,
    cutX: clampPct((corteSd / xMax) * 100),
    cutY: clampPct(100 - ((corteScore - yMin) / (yMax - yMin)) * 100),
    groups,
    points,
  };
}

function repelFodaPoints<T extends { left: number; top: number; cuadrante?: DashboardDimFodaCuadrante | null }>(
  points: T[],
  spacing: number,
): T[] {
  const out = points.map((p) => ({ ...p }));
  const minX = 7.5;
  const maxX = 92.5;
  const minY = 7;
  const maxY = 93;
  const k = Math.max(0.7, Math.min(1.8, spacing));
  const minDistX = 7.6 + k * 3.2;
  const minDistY = 5.2 + k * 2.6;
  for (let iter = 0; iter < 34 + Math.round(k * 12); iter += 1) {
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const dx = out[j].left - out[i].left;
        const dy = out[j].top - out[i].top;
        if (Math.abs(dx) >= minDistX || Math.abs(dy) >= minDistY) continue;
        const pushX = (minDistX - Math.abs(dx)) / 2;
        const pushY = (minDistY - Math.abs(dy)) / 2;
        const sx = dx >= 0 ? 1 : -1;
        const sy = dy >= 0 ? 1 : -1;
        out[i].left -= sx * pushX * 0.46;
        out[j].left += sx * pushX * 0.46;
        out[i].top -= sy * pushY * 0.52;
        out[j].top += sy * pushY * 0.52;
        out[i].left = Math.max(minX, Math.min(maxX, out[i].left));
        out[j].left = Math.max(minX, Math.min(maxX, out[j].left));
        out[i].top = Math.max(minY, Math.min(maxY, out[i].top));
        out[j].top = Math.max(minY, Math.min(maxY, out[j].top));
      }
    }
  }
  return laneFodaPoints(out, minDistX, minDistY, minX, maxX, minY, maxY);
}

function laneFodaPoints<T extends { left: number; top: number; cuadrante?: DashboardDimFodaCuadrante | null }>(
  points: T[],
  minDistX: number,
  minDistY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): T[] {
  const out = points.map((p) => ({ ...p }));
  const quadrants: Array<DashboardDimFodaCuadrante | "none"> = [
    "fortaleza",
    "oportunidad",
    "debilidad",
    "amenaza",
    "none",
  ];
  for (const q of quadrants) {
    const members = out
      .map((p) => ({ p }))
      .filter(({ p }) => (p.cuadrante ?? "none") === q)
      .sort((a, b) => (a.p.top - b.p.top) || (a.p.left - b.p.left));
    const placed: Array<{ left: number; top: number }> = [];
    for (const { p } of members) {
      let tries = 0;
      while (
        tries < 24 &&
        placed.some((prev) => Math.abs(prev.left - p.left) < minDistX && Math.abs(prev.top - p.top) < minDistY)
      ) {
        const lane = Math.ceil((tries + 1) / 2) * (tries % 2 === 0 ? 1 : -1);
        p.left = Math.max(minX, Math.min(maxX, p.left + lane * minDistX * 0.34));
        p.top = Math.max(minY, Math.min(maxY, p.top + ((tries % 3) - 1) * minDistY * 0.28));
        tries += 1;
      }
      placed.push({ left: p.left, top: p.top });
    }
  }
  return out;
}

function shortAxisLabel(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const words = clean.split(" ");
  if (words.length === 1) return clean.slice(0, 4).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function semaforoColor(score: number, semaforo: NonNullable<DashboardDimPayload["semaforo"]>): string {
  if (score < semaforo.red_max) return semaforo.red_color;
  if (score < semaforo.amber_max) return semaforo.amber_color;
  return semaforo.green_color;
}

function colorToRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split("").map((x) => parseInt(`${x}${x}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (full) {
    const n = parseInt(full[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return `rgba(14, 59, 116, ${alpha})`;
}

function formatFodaTick(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (v >= 10) return String(Math.round(v));
  return v.toFixed(1).replace(/\.0$/, "");
}

// =============================================================================
// Subtítulo dinámico con chip badges.
// =============================================================================

function SubtituloDim({ payload }: { payload: DashboardDimPayload }) {
  const parts: { label: string; value?: string; chip?: boolean }[] = [];
  if (payload.principal_label) parts.push({ label: "Cruce", value: payload.principal_label });
  if (payload.iter_active && payload.iter_var_label && payload.iter_level_label) {
    parts.push({ label: payload.iter_var_label, value: payload.iter_level_label });
  }
  if ((payload.principal_hidden ?? 0) > 0) {
    parts.push({ label: `+${payload.principal_hidden} categorías ocultas`, chip: true });
  }
  if ((payload.iter_hidden_levels ?? 0) > 0) {
    parts.push({ label: `+${payload.iter_hidden_levels} niveles ocultos`, chip: true });
  }
  if (!parts.length) return null;
  return (
    <div className="dash-dim-subtitle">
      {parts.map((p, i) => (
        <span
          key={i}
          className={`dash-dim-subtitle-item ${p.chip ? "is-chip" : ""}`}
        >
          {p.value ? (
            <>
              <span className="dash-dim-subtitle-key">{p.label}:</span>
              <span>{p.value}</span>
            </>
          ) : (
            p.label
          )}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Skeleton loader con shimmer.
// =============================================================================

function DimSkeleton({ mode }: { mode: DashboardDimVisualMode }) {
  if (mode === "foda") {
    return (
      <div className="dash-dim-skeleton dash-dim-skeleton-foda">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-dim-skel-block" />
        ))}
      </div>
    );
  }
  if (mode === "radar") {
    return (
      <div className="dash-dim-skeleton">
        <div className="dash-dim-skel-circle" />
      </div>
    );
  }
  // heatmap o barras: 5 barras horizontales.
  return (
    <div className="dash-dim-skeleton">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="dash-dim-skel-bar"
          style={{ width: `${60 + (i * 7) % 35}%` }}
        />
      ))}
    </div>
  );
}

function uniqueOrdered<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Compass, Grid3x3, ScatterChart, Target } from "lucide-react";
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

      <div className="dash-dim-vis-body" key={visualMode}>
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
    </section>
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
  const semaforoModo = useDashboardStore((s) => s.config.semaforo_modo ?? "cortes");

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

    // Colorscale: en modo "cortes" hay saltos abruptos en los umbrales;
    // en modo "gradiente" se interpola linealmente entre los 3 colores.
    const cs: [number, string][] = semaforoModo === "gradiente"
      ? [
          [0, semaforo.red_color],
          [semaforo.red_max / 100, semaforo.amber_color],
          [semaforo.amber_max / 100, semaforo.green_color],
          [1, semaforo.green_color],
        ]
      : [
          [0, semaforo.red_color],
          [(semaforo.red_max - 0.001) / 100, semaforo.red_color],
          [semaforo.red_max / 100, semaforo.amber_color],
          [(semaforo.amber_max - 0.001) / 100, semaforo.amber_color],
          [semaforo.amber_max / 100, semaforo.green_color],
          [1, semaforo.green_color],
        ];

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
      xaxis: { side: "top", tickfont: { size: 11 }, automargin: true },
      yaxis: { autorange: "reversed", tickfont: { size: 11 }, automargin: true },
      margin: { t: 40, r: 16, b: 16, l: 16 },
    };
    return { traces, layout, axes: { x: xVals, y: yVals } };
  }, [heat, payload.axis_order_heat, semaforo, semaforoModo]);

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
          <span className="dash-dim-heat-legend-swatch" style={{ background: semaforo.red_color }} />
          0–{semaforo.red_max - 1} bajo
        </span>
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: semaforo.amber_color }} />
          {semaforo.red_max}–{semaforo.amber_max - 1} medio
        </span>
        <span className="dash-dim-heat-legend-item">
          <span className="dash-dim-heat-legend-swatch" style={{ background: semaforo.green_color }} />
          {semaforo.amber_max}–100 alto
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
  const radarMin = useDashboardStore((s) => s.config.radar_min ?? 0);

  // Chip de semáforo por axis (solo en modo barras): color rojo/ámbar/verde
  // según el score del grupo de referencia vs los cortes del semáforo.
  const semColorByAxis = useMemo(() => {
    if (visualMode !== "barras" || !semaforo) return new Map<string, string>();
    const m = new Map<string, string>();
    const refGroup = groups[0];
    if (!refGroup) return m;
    for (const axis of axes) {
      const row = rows.find((r) => r.axis_label === axis && r.grupo === refGroup);
      const v = row?.score_round;
      if (v == null) continue;
      const color =
        v < semaforo.red_max
          ? semaforo.red_color
          : v < semaforo.amber_max
          ? semaforo.amber_color
          : semaforo.green_color;
      m.set(axis, color);
    }
    return m;
  }, [visualMode, axes, rows, groups, semaforo]);

  const traces = useMemo(() => {
    if (visualMode === "radar") {
      return groups.map((g) => {
        const r = axes.map((a) => {
          const row = rows.find((x) => x.grupo === g && x.axis_label === a);
          return row?.score_round ?? null;
        });
        const closedTheta = [...axes, axes[0]];
        const closedR = [...r, r[0]];
        return {
          type: "scatterpolar" as const,
          mode: "lines+markers",
          name: g,
          theta: closedTheta,
          r: closedR,
          fill: "toself",
          opacity: 0.6,
          line: { color: groupColors[g] ?? undefined, width: 2 },
          marker: { color: groupColors[g] ?? undefined, size: 6 },
          hovertemplate: `${g}<br>%{theta}: %{r:.0f}<extra></extra>`,
        };
      });
    }
    return groups.map((g) => {
      const xv = axes.map((a) => {
        const row = rows.find((x) => x.grupo === g && x.axis_label === a);
        return row?.score_round ?? null;
      });
      return {
        type: "bar" as const,
        name: g,
        orientation: "h" as const,
        x: xv,
        y: axes,
        marker: { color: groupColors[g] ?? undefined },
        hovertemplate: `${g}<br>%{y}: %{x:.0f}<extra></extra>`,
      };
    });
  }, [visualMode, groups, axes, rows, groupColors]);

  const layout = useMemo(() => {
    if (visualMode === "radar") {
      return {
        polar: {
          radialaxis: { range: [radarMin, 100], tickfont: { size: 10 } },
          angularaxis: { tickfont: { size: 11 } },
        },
        showlegend: true,
        legend: { orientation: "h", y: -0.1 },
        margin: { t: 24, r: 24, b: 50, l: 24 },
      };
    }
    // Modo barras: chip semáforo prefijado al label del eje Y
    // (Plotly acepta <span style="color:..."> en ticktext).
    const ticktext = axes.map((axis) => {
      const color = semColorByAxis.get(axis);
      const dot = color
        ? `<span style="color:${color}">●</span> `
        : "";
      return `${dot}${axis}`;
    });
    return {
      barmode: "group",
      xaxis: { range: [0, 100], fixedrange: true, tickfont: { size: 11 } },
      yaxis: {
        autorange: "reversed",
        tickfont: { size: 11 },
        automargin: true,
        tickmode: "array",
        tickvals: axes,
        ticktext,
      },
      showlegend: groups.length > 1,
      legend: { orientation: "h", y: -0.15 },
      margin: { t: 16, r: 16, b: 50, l: 24 },
    };
  }, [visualMode, groups, axes, semColorByAxis, radarMin]);

  if (!rows.length) {
    return <p className="dash-cardbox-help">Sin datos para graficar.</p>;
  }

  const altura = visualMode === "radar" ? 600 : Math.max(360, axes.length * 36 + 100);

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      height={altura}
      ariaLabel={visualMode === "radar" ? "Radar de dimensiones" : "Barras de scores"}
    />
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
  const counts = payload.counts ?? { fortaleza: 0, oportunidad: 0, debilidad: 0, amenaza: 0 };

  return (
    <div className="dash-foda">
      <div className="dash-foda-toolbar">
        <div className="dash-foda-cortes" aria-label="Cortes FODA">
          <span><strong>Corte score:</strong> {payload.cortes?.score ?? 80}</span>
          <span className="dash-foda-cortes-sep">·</span>
          <span><strong>Corte SD:</strong> {payload.cortes?.sd ?? 0}</span>
        </div>
        <FodaCounts counts={counts} payload={payload} />
      </div>
      <FodaDispersion items={items} payload={payload} />
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

  const colorMap: Record<DashboardDimFodaCuadrante, string> = {
    fortaleza: semaforo.green_color,
    oportunidad: "#1B679D",
    debilidad: semaforo.amber_color,
    amenaza: semaforo.red_color,
  };

  const traces = useMemo(() => {
    const grupos: Record<DashboardDimFodaCuadrante, DashboardDimFodaItem[]> = {
      fortaleza: [],
      oportunidad: [],
      debilidad: [],
      amenaza: [],
    };
    for (const it of items) {
      if (it.cuadrante) grupos[it.cuadrante].push(it);
    }
    return (Object.keys(grupos) as DashboardDimFodaCuadrante[]).map((q) => {
      const subset = grupos[q];
      return {
        type: "scatter" as const,
        mode: "markers+text",
        name: CUADRANTE_LABELS[q],
        x: subset.map((it) => it.score_mean),
        y: subset.map((it) => it.score_sd),
        text: subset.map((it) => it.axis_label),
        textposition: "top center",
        textfont: { size: 10 },
        marker: { color: colorMap[q], size: 12, line: { color: "#fff", width: 1 } },
        hovertemplate: subset.map((it) =>
          `<b>${it.axis_label}</b><br>Score: ${it.score_mean}<br>SD: ${it.score_sd}<br>n: ${it.n_valid}<extra>${CUADRANTE_LABELS[q]}</extra>`,
        ),
      };
    });
  }, [items, colorMap]);

  const maxSd = Math.max(...items.map((it) => it.score_sd), corteSd, 1);
  const layout = {
    xaxis: {
      title: { text: "Score (0–100)", font: { size: 11 } },
      range: [0, 100],
      tickfont: { size: 10 },
      zeroline: false,
    },
    yaxis: {
      title: { text: "Variabilidad (SD)", font: { size: 11 } },
      range: [0, maxSd * 1.1],
      tickfont: { size: 10 },
      zeroline: false,
    },
    shapes: [
      // Línea vertical en corte_score.
      {
        type: "line",
        x0: corteScore,
        x1: corteScore,
        y0: 0,
        y1: maxSd * 1.1,
        line: { color: "rgba(15,23,42,0.18)", width: 1, dash: "dash" },
      },
      // Línea horizontal en corte_sd.
      {
        type: "line",
        x0: 0,
        x1: 100,
        y0: corteSd,
        y1: corteSd,
        line: { color: "rgba(15,23,42,0.18)", width: 1, dash: "dash" },
      },
    ],
    annotations: [
      { x: 100, y: maxSd * 1.05, xanchor: "right", showarrow: false, text: "Oportunidad", font: { size: 10, color: colorMap.oportunidad } },
      { x: 100, y: 0, xanchor: "right", yanchor: "bottom", showarrow: false, text: "Fortaleza", font: { size: 10, color: colorMap.fortaleza } },
      { x: 0, y: maxSd * 1.05, xanchor: "left", showarrow: false, text: "Amenaza", font: { size: 10, color: colorMap.amenaza } },
      { x: 0, y: 0, xanchor: "left", yanchor: "bottom", showarrow: false, text: "Debilidad", font: { size: 10, color: colorMap.debilidad } },
    ],
    showlegend: true,
    legend: { orientation: "h", y: -0.18 },
    margin: { t: 16, r: 16, b: 60, l: 56 },
  };

  if (!items.length) {
    return <p className="dash-cardbox-help">Sin datos para la dispersión.</p>;
  }

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      height={520}
      ariaLabel="Dispersión FODA score vs variabilidad"
    />
  );
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

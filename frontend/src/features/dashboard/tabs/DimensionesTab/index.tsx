import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type {
  DashboardDimPayload,
  DashboardDimScoreRow,
  DashboardDimSeccionesPayload,
} from "../../../../api/client";
import { useDashboardStore } from "../../store";
import {
  useDimCatalogo,
  useDimCategoriasVar,
  useDimPayload,
  useDimSeccionesVars,
} from "../../useDashboardData";
import { EmptyState } from "../../shared/EmptyState";
import { FiltrosMultiRow } from "../ResumenTab/FiltrosMultiRow";
import { PlotlyChart } from "../../shared/PlotlyChart";
import "./dimensiones.css";

// Tab Dimensiones — heatmap semáforo + gráfico principal (barras o radar)
// con catálogo de objetivos (general | indicadores). Reproduce la pestaña
// "Dimensiones" del legacy `prosecnur::reporte_interactivo()`.

export function DimensionesTab() {
  const filtros = useDashboardStore((s) => s.filtros);
  const setFiltros = useDashboardStore((s) => s.setFiltros);
  const dim = useDashboardStore((s) => s.dimensiones);
  const setDim = useDashboardStore((s) => s.setDimensiones);

  const { loading: loadingCat, error: errCat, payload: catalogo } = useDimCatalogo();
  const { payload: seccionesVars } = useDimSeccionesVars();

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
      {/* ───── Sidebar ───── */}
      <aside className="dash-sidebar">
        <VistaCard
          modo={dim.modo}
          objetivo={dim.objetivo}
          objetivos={objetivos}
          loading={loadingCat}
          error={errCat}
          onModo={(m) => setDim({ modo: m, objetivo: "" })}
          onObjetivo={(id) => setDim({ objetivo: id })}
        />

        <ComparacionCard
          secciones={seccionesVars?.secciones ?? []}
          cruce={dim.cruce}
          incluirTotal={dim.incluirTotal}
          onCruce={(v) => setDim({ cruce: v })}
          onIncluirTotal={(b) => setDim({ incluirTotal: b })}
        />

        <IterarCard
          secciones={seccionesVars?.secciones ?? []}
          enabled={dim.iterarOn}
          variable={dim.iterarVar}
          level={dim.iterarLevel}
          excludeVar={dim.cruce}
          onToggle={(on) => setDim({ iterarOn: on })}
          onVariable={(v) => setDim({ iterarVar: v, iterarLevel: "" })}
          onLevel={(l) => setDim({ iterarLevel: l })}
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

      {/* ───── Main ───── */}
      <main>
        {!dim.objetivo ? (
          <EmptyState
            title="Selecciona un objetivo"
            subtitle="Elige un índice o subíndice del panel izquierdo para ver las dimensiones."
          />
        ) : loading && !payload ? (
          <EmptyState title="Calculando dimensiones…" />
        ) : error ? (
          <EmptyState title="No se pudieron calcular las dimensiones" subtitle={error} />
        ) : !payload || !payload.ready ? (
          <EmptyState
            title="Genera dimensiones primero"
            subtitle="Ve a Analítica → Dimensiones para construir índices y subíndices."
          />
        ) : payload.error ? (
          <EmptyState title="Sin datos para esta vista" subtitle={payload.error} />
        ) : (
          <DimensionesView payload={payload} />
        )}
        <div style={{ height: 48 }} aria-hidden="true" />
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Card "Vista" — modo (General/Indicadores) + objetivo.
// -----------------------------------------------------------------------------
function VistaCard({
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
    <section className="dash-cardbox">
      <div className="dash-cardbox-header">
        <h2 className="dash-cardbox-title">Vista</h2>
      </div>
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
      <label className="dash-filtro-label" style={{ marginTop: 10 }}>Objetivo</label>
      {loading ? (
        <p className="dash-cardbox-help">Cargando catálogo…</p>
      ) : error ? (
        <p className="dash-cardbox-help">{error}</p>
      ) : !objetivos.length ? (
        <p className="dash-cardbox-help">Sin objetivos en este modo.</p>
      ) : (
        <select
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
    </section>
  );
}

// -----------------------------------------------------------------------------
// Card "Comparación" — sección + variable de cruce + toggle "Incluir total".
// -----------------------------------------------------------------------------
function ComparacionCard({
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

  return (
    <section className="dash-cardbox">
      <div className="dash-cardbox-header">
        <h2 className="dash-cardbox-title">Comparación</h2>
      </div>
      {!secciones.length ? (
        <p className="dash-cardbox-help">Sin variables de cruce.</p>
      ) : (
        <>
          <label className="dash-filtro-label">Sección</label>
          <select
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
          <label className="dash-filtro-label" style={{ marginTop: 8 }}>Comparar por</label>
          <select
            className="dash-select"
            value={cruce}
            onChange={(e) => onCruce(e.target.value)}
          >
            <option value="">— Sin cruce —</option>
            {seccionActiva?.vars.map((v) => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
          <label
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 12,
              gap: 8,
              marginTop: 10,
            }}
          >
            <input
              type="checkbox"
              checked={incluirTotal}
              onChange={(e) => onIncluirTotal(e.target.checked)}
            />
            Incluir total
          </label>
        </>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Card "Iterar" — toggle + sección + variable + selector de nivel.
// -----------------------------------------------------------------------------
function IterarCard({
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

  // Auto-seleccionar primer nivel si no hay seleccionado.
  useEffect(() => {
    if (!enabled || !variable) return;
    if (level && niveles.some((n) => n.value === level)) return;
    if (niveles.length) onLevel(niveles[0].value);
  }, [enabled, variable, level, niveles, onLevel]);

  return (
    <section className="dash-cardbox">
      <div className="dash-cardbox-header">
        <h2 className="dash-cardbox-title">Iterar</h2>
        <label className="dash-switch" aria-label="Activar iteración">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="dash-switch-slider"></span>
        </label>
      </div>
      {enabled && (
        <>
          <label className="dash-filtro-label">Sección</label>
          <select
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
          <label className="dash-filtro-label" style={{ marginTop: 8 }}>Variable</label>
          <select
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
              <label className="dash-filtro-label" style={{ marginTop: 8 }}>Nivel</label>
              <select
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
    </section>
  );
}

// -----------------------------------------------------------------------------
// Vista principal — heatmap + gráfico principal (barras o radar).
// -----------------------------------------------------------------------------
function DimensionesView({ payload }: { payload: DashboardDimPayload }) {
  return (
    <div className="dash-dim-stack">
      <HeatmapCard payload={payload} />
      <MainPlotCard payload={payload} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Heatmap semáforo (legacy: graficador_dimensiones.R, .heat_colorscale).
// -----------------------------------------------------------------------------
function HeatmapCard({ payload }: { payload: DashboardDimPayload }) {
  const heat = payload.score_heat ?? [];
  const semaforo = payload.semaforo!;

  const { traces, layout, axes } = useMemo(() => {
    if (!heat.length) {
      return { traces: [] as unknown[], layout: {}, axes: { x: [] as string[], y: [] as string[] } };
    }
    const xVals = uniqueOrdered(heat.map((r) => r.grupo));
    const yVals = payload.axis_order_heat?.length
      ? [...payload.axis_order_heat]
      : uniqueOrdered(heat.map((r) => r.axis_label));

    // Matriz Z = filas axis_label × columnas grupo.
    const z: (number | null)[][] = yVals.map((axis) =>
      xVals.map((g) => {
        const row = heat.find((r) => r.axis_label === axis && r.grupo === g);
        return row?.score_round ?? null;
      }),
    );
    const text: string[][] = z.map((row) =>
      row.map((v) => (v == null ? "—" : String(Math.round(v)))),
    );

    // Colorscale: na→gris no se usa en colorscale (Plotly maneja null como
    // gap); construimos escala roja → ámbar → verde según semaforo.
    const cs: [number, string][] = [
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
        textfont: { color: "#fff", size: 12 },
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
  }, [heat, payload.axis_order_heat, semaforo]);

  if (!heat.length) {
    return (
      <section className="dash-cardbox dash-dim-card">
        <div className="dash-cardbox-header">
          <h2 className="dash-cardbox-title">Heatmap semáforo</h2>
        </div>
        <p className="dash-cardbox-help">Sin datos para mostrar.</p>
      </section>
    );
  }

  const altura = Math.max(280, axes.y.length * 36 + 80);

  return (
    <section className="dash-cardbox dash-dim-card">
      <div className="dash-cardbox-header">
        <h2 className="dash-cardbox-title">Heatmap</h2>
        <SubtituloDim payload={payload} />
      </div>
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
    </section>
  );
}

// -----------------------------------------------------------------------------
// Gráfico principal: barras horizontales o radar (según visual_mode).
// -----------------------------------------------------------------------------
function MainPlotCard({ payload }: { payload: DashboardDimPayload }) {
  const rows = payload.score_plot ?? [];
  const groups = useMemo(() => uniqueOrdered(rows.map((r) => r.grupo)), [rows]);
  const axes = useMemo(
    () =>
      payload.axis_order_plot?.length
        ? [...payload.axis_order_plot]
        : uniqueOrdered(rows.map((r) => r.axis_label)),
    [rows, payload.axis_order_plot],
  );

  const groupColors = payload.group_colors ?? {};
  const visual = payload.visual_mode ?? "barras";

  const traces = useMemo(() => {
    if (visual === "radar") {
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
    // barras horizontales.
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
  }, [visual, groups, axes, rows, groupColors]);

  const layout = useMemo(() => {
    if (visual === "radar") {
      return {
        polar: {
          radialaxis: { range: [0, 100], tickfont: { size: 10 } },
          angularaxis: { tickfont: { size: 11 } },
        },
        showlegend: true,
        legend: { orientation: "h", y: -0.1 },
        margin: { t: 24, r: 24, b: 50, l: 24 },
      };
    }
    return {
      barmode: "group",
      xaxis: { range: [0, 100], fixedrange: true, tickfont: { size: 11 } },
      yaxis: { autorange: "reversed", tickfont: { size: 11 }, automargin: true },
      showlegend: groups.length > 1,
      legend: { orientation: "h", y: -0.15 },
      margin: { t: 16, r: 16, b: 50, l: 24 },
    };
  }, [visual, groups]);

  if (!rows.length) {
    return (
      <section className="dash-cardbox dash-dim-card">
        <div className="dash-cardbox-header">
          <h2 className="dash-cardbox-title">{visual === "radar" ? "Radar" : "Barras"}</h2>
        </div>
        <p className="dash-cardbox-help">Sin datos para graficar.</p>
      </section>
    );
  }

  const altura = visual === "radar" ? 600 : Math.max(360, axes.length * 36 + 100);

  return (
    <section className="dash-cardbox dash-dim-card">
      <div className="dash-cardbox-header">
        <h2 className="dash-cardbox-title">
          {visual === "radar" ? "Radar de dimensiones" : "Scores por dimensión"}
        </h2>
        <SubtituloDim payload={payload} />
      </div>
      <PlotlyChart
        data={traces}
        layout={layout}
        height={altura}
        ariaLabel={visual === "radar" ? "Radar de dimensiones" : "Barras de scores"}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Subtítulo dinámico (legacy: hint con modo, objetivo, cruce, iteración).
// -----------------------------------------------------------------------------
function SubtituloDim({ payload }: { payload: DashboardDimPayload }) {
  const parts: string[] = [];
  if (payload.principal_label) {
    parts.push(`Cruce: ${payload.principal_label}`);
  }
  if (payload.iter_active && payload.iter_var_label && payload.iter_level_label) {
    parts.push(`${payload.iter_var_label} = ${payload.iter_level_label}`);
  }
  if ((payload.principal_hidden ?? 0) > 0) {
    parts.push(`+${payload.principal_hidden} categorías ocultas`);
  }
  if ((payload.iter_hidden_levels ?? 0) > 0) {
    parts.push(`+${payload.iter_hidden_levels} niveles ocultos`);
  }
  if (!parts.length) return null;
  return (
    <span className="dash-dim-subtitle">{parts.join(" · ")}</span>
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

import { Fragment, useMemo, useState } from "react";
import { type DashboardRelacionCruce } from "../../../../api/client";
import { useDashboardSecciones, useRelacionCross } from "../../useDashboardData";
import { useDashboardStore } from "../../store";
import { EmptyState } from "../../shared/EmptyState";
import {
  FullscreenButton,
  FullscreenScope,
  useFullscreen,
} from "../../shared/FullscreenWrapper";
import { FiltrosMultiRow } from "../ResumenTab/FiltrosMultiRow";
import { PlotlyChart } from "../../shared/PlotlyChart";
import "./relacion.css";

// Tab Relaciones — cruce var_principal × var_segmento, opcionalmente
// iterado por una tercera variable. Reproduce la pestaña "Relaciones"
// del legacy `prosecnur::reporte_interactivo()`.

export function RelacionTab() {
  const filtros = useDashboardStore((s) => s.filtros);
  const setFiltros = useDashboardStore((s) => s.setFiltros);
  const relacion = useDashboardStore((s) => s.relacion);
  const setRelacion = useDashboardStore((s) => s.setRelacion);

  const { secciones, loading: loadingSecs, error: errSecs } = useDashboardSecciones();

  const iterar = relacion.iterarOn && relacion.iterarVar
    ? { var: relacion.iterarVar }
    : null;
  const filtrosActivos = relacion.filtrosOn ? filtros : [];

  const { loading, error, payload } = useRelacionCross(
    relacion.varPrincipal,
    relacion.varSegmento,
    filtrosActivos,
    iterar,
  );

  // Variables elegibles: SO y SM. (Las "otro" se descartan.)
  const seccionesElegibles = useMemo(
    () =>
      secciones
        .map((sec) => ({
          nombre: sec.nombre,
          vars: sec.vars.filter((v) => v.tipo === "so" || v.tipo === "sm"),
        }))
        .filter((sec) => sec.vars.length > 0),
    [secciones],
  );

  const fs = useFullscreen();
  const fsTitle = payload ? relacionFullscreenTitle(payload) : "Relaciones";

  return (
    <div className="dash-resumen-layout">
      {/* ───── Sidebar unificado — espejo del de Dimensiones ─────
          Un solo card con secciones apiladas y header propio. Las secciones
          opcionales (Filtros / Iterar) llevan switch que actúa de título
          a la vez. Reemplaza los 4 cards-isla anteriores. */}
      <aside className="dash-sidebar">
        <section className="dash-cardbox dash-dim-sidebar-card">
          <div className="dash-dim-sidebar-head">
            <div className="dash-dim-sidebar-head-text">
              <h2 className="dash-cardbox-title">Configuración</h2>
              <p className="dash-dim-sidebar-head-help">
                Elige dos variables para cruzar; filtra o itera si lo necesitas.
              </p>
            </div>
          </div>

          <div className="dash-dim-sidebar-section">
            <div className="dash-dim-sidebar-section-head">
              <div className="dash-dim-sidebar-section-head-text">
                <h3 className="dash-dim-sidebar-section-title">Variable principal</h3>
                <p className="dash-dim-sidebar-section-help">
                  La pregunta cuyas respuestas se distribuirán dentro del cruce.
                </p>
              </div>
            </div>
            <div className="dash-dim-sidebar-section-body">
              <SelectorVariable
                inline
                variableLabel="Variable"
                secciones={seccionesElegibles}
                loading={loadingSecs}
                error={errSecs}
                value={relacion.varPrincipal}
                onChange={(v) => setRelacion({ varPrincipal: v })}
              />
            </div>
          </div>

          <div className="dash-dim-sidebar-section">
            <div className="dash-dim-sidebar-section-head">
              <div className="dash-dim-sidebar-section-head-text">
                <h3 className="dash-dim-sidebar-section-title">Cruzar contra</h3>
                <p className="dash-dim-sidebar-section-help">
                  Cada categoría de esta variable arma una columna del cruce.
                </p>
              </div>
            </div>
            <div className="dash-dim-sidebar-section-body">
              <SelectorVariable
                inline
                variableLabel="Segmento"
                secciones={seccionesElegibles}
                loading={loadingSecs}
                error={null}
                value={relacion.varSegmento}
                onChange={(v) => setRelacion({ varSegmento: v })}
              />
            </div>
          </div>

          <div className={`dash-dim-sidebar-section ${relacion.iterarOn ? "is-on" : ""}`}>
            <div className="dash-dim-sidebar-section-body">
              <IterarCard
                inline
                secciones={seccionesElegibles}
                value={relacion.iterarVar}
                enabled={relacion.iterarOn}
                onToggle={(on) => setRelacion({ iterarOn: on })}
                onChange={(v) => setRelacion({ iterarVar: v })}
              />
            </div>
          </div>

          <div className={`dash-dim-sidebar-section ${relacion.filtrosOn ? "is-on" : ""}`}>
            <div className="dash-dim-sidebar-section-body">
              <p className="dash-dim-sidebar-section-help" style={{ marginTop: 0 }}>
                Filtros: restringe el cruce a un subgrupo (ej. solo mujeres de Lima).
              </p>
              <FiltrosMultiRow
                secciones={secciones}
                enabled={relacion.filtrosOn}
                onToggleEnabled={(on) => setRelacion({ filtrosOn: on })}
                onChange={setFiltros}
              />
            </div>
          </div>
        </section>
      </aside>

      {/* ───── Main ───── */}
      <main>
        {!relacion.varPrincipal || !relacion.varSegmento ? (
          <EmptyState
            title="Selecciona dos variables"
            subtitle="Elige una variable principal y una variable de segmento para ver el cruce."
          />
        ) : loading ? (
          <EmptyState title="Calculando cruce…" />
        ) : error ? (
          <EmptyState title="No se pudo calcular el cruce" subtitle={error} />
        ) : payload && payload.cruces.length > 0 ? (
          <section className="dash-cardbox">
            <div className="dash-cardbox-header">
              <h2 className="dash-cardbox-title">Cruce</h2>
              <FullscreenButton ctx={fs} />
            </div>
            <FullscreenScope ctx={fs} title={fsTitle}>
              <CrucesView payload={payload} maxed={fs.maxed} />
            </FullscreenScope>
          </section>
        ) : (
          <EmptyState title="Sin datos para cruzar" />
        )}
      </main>
    </div>
  );
}

function relacionFullscreenTitle(payload: {
  iterado: boolean;
  iter_label?: string;
  cruces: DashboardRelacionCruce[];
}) {
  if (!payload.iterado) return "Relaciones";
  const iterLabel = payload.iter_label ?? "Iteración";
  if (payload.cruces.length === 1 && payload.cruces[0]?.nivel) {
    return `Relaciones — ${iterLabel}: ${payload.cruces[0].nivel}`;
  }
  return `Relaciones — ${iterLabel} (${payload.cruces.length} niveles)`;
}

// -----------------------------------------------------------------------------
// Selector "Sección + variable" en card.
// -----------------------------------------------------------------------------
function SelectorVariable({
  titulo,
  inline = false,
  variableLabel = "Variable",
  secciones,
  loading,
  error,
  value,
  onChange,
}: {
  titulo?: string;
  inline?: boolean;
  variableLabel?: string;
  secciones: { nombre: string; vars: { name: string; label: string; tipo: string }[] }[];
  loading: boolean;
  error: string | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const seccionDeVar = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sec of secciones) for (const v of sec.vars) m[v.name] = sec.nombre;
    return m;
  }, [secciones]);

  const [seccionLocal, setSeccionLocal] = useState<string>("");
  const seccion = seccionLocal || seccionDeVar[value] || (secciones[0]?.nombre ?? "");
  const seccionActiva = secciones.find((s) => s.nombre === seccion);

  // En modo inline (sidebar unificado) NO renderizamos el card wrapper —
  // el contenedor padre ya da el frame. Devolvemos solo los selects.
  const Wrap = inline
    ? (({ children }: { children: React.ReactNode }) => <>{children}</>)
    : (({ children }: { children: React.ReactNode }) => (
        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">{titulo}</h2>
          </div>
          {children}
        </section>
      ));

  return (
    <Wrap>
      {loading ? (
        <p className="dash-cardbox-help">Cargando secciones…</p>
      ) : error ? (
        <p className="dash-cardbox-help" style={{ color: "var(--dash-texto)" }}>{error}</p>
      ) : !secciones.length ? (
        <p className="dash-cardbox-help">No hay variables seleccionables.</p>
      ) : (
        <>
          <label className="dash-filtro-label">Sección</label>
          <select
            className="dash-select"
            value={seccion}
            onChange={(e) => {
              setSeccionLocal(e.target.value);
              onChange("");
            }}
          >
            {secciones.map((s) => (
              <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
            ))}
          </select>
          <label className="dash-filtro-label" style={{ marginTop: 8 }}>{variableLabel}</label>
          <select
            className="dash-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— Selecciona —</option>
            {seccionActiva?.vars.map((v) => (
              <option key={v.name} value={v.name}>{v.label}</option>
            ))}
          </select>
        </>
      )}
    </Wrap>
  );
}

// -----------------------------------------------------------------------------
// "Iterar" — toggle + selects visibles. Evita esconder la configuración en
// un popover y deja el estado actual escaneable. En modo `inline` (sidebar
// unificado) renderiza sin card wrapper, usando el switch como propio
// título de la sección.
// -----------------------------------------------------------------------------
function IterarCard({
  inline = false,
  secciones,
  value,
  enabled,
  onToggle,
  onChange,
}: {
  inline?: boolean;
  secciones: { nombre: string; vars: { name: string; label: string; tipo: string }[] }[];
  value: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onChange: (v: string) => void;
}) {
  // Resolver sección de la var actual.
  const seccionDeVar = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sec of secciones) for (const v of sec.vars) m[v.name] = sec.nombre;
    return m;
  }, [secciones]);
  const [seccionLocal, setSeccionLocal] = useState<string>("");
  const seccion = seccionLocal || seccionDeVar[value] || (secciones[0]?.nombre ?? "");
  const seccionActiva = secciones.find((s) => s.nombre === seccion);

  // Header del toggle: en inline ejerce de propio título de la sección
  // (espejo del patrón de Dimensiones).
  const headerRow = (
    <div className={inline ? "dash-dim-sidebar-section-head" : "dash-cardbox-header"}>
      {inline ? (
        <div className="dash-dim-sidebar-section-head-text">
          <h3 className="dash-dim-sidebar-section-title">Iterar</h3>
          <p className="dash-dim-sidebar-section-help">
            Repite el cruce para cada nivel de otra variable (ej. por distrito).
          </p>
        </div>
      ) : (
        <h2 className="dash-cardbox-title">Iterar</h2>
      )}
      <label className="dash-switch" aria-label="Activar iteración">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="dash-switch-slider"></span>
      </label>
    </div>
  );

  const body = enabled ? (
    <div className="dash-iter-direct">
      <label className="dash-filtro-label">Sección</label>
      <select
        className="dash-select"
        value={seccion}
        onChange={(e) => {
          setSeccionLocal(e.target.value);
          onChange("");
        }}
      >
        {secciones.map((s) => (
          <option key={s.nombre} value={s.nombre}>{s.nombre}</option>
        ))}
      </select>
      <label className="dash-filtro-label" style={{ marginTop: 8 }}>Variable</label>
      <select
        className="dash-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Sin iteración —</option>
        {seccionActiva?.vars.map((v) => (
          <option key={v.name} value={v.name}>{v.label}</option>
        ))}
      </select>
    </div>
  ) : null;

  if (inline) {
    return (
      <>
        {headerRow}
        {body}
      </>
    );
  }
  return (
    <section className="dash-cardbox dash-iter-card">
      {headerRow}
      {body}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Vista de cruces (uno o varios si itera).
// -----------------------------------------------------------------------------
// Decide texto blanco vs oscuro según luminancia perceptual (BT.601).
// Usado para que el % escrito sobre la barra apilada se lea siempre.
function contrastTextColor(bgHex: string): string {
  const c = (bgHex || "").replace("#", "");
  if (c.length < 6) return "#ffffff";
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "#ffffff";
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1f2933" : "#ffffff";
}

function CrucesView({
  payload,
  maxed = false,
}: {
  payload: { iterado: boolean; iter_label?: string; cruces: DashboardRelacionCruce[] };
  maxed?: boolean;
}) {
  return (
    <div className="dash-relacion-cruces">
      {payload.cruces.map((cruce, idx) => {
        // Transformar las traces verticales del backend a horizontales:
        // - swap x ↔ y (categorías al eje Y, % al eje X)
        // - orientation "h"
        // - texto con % solo cuando el segmento tiene ancho suficiente
        // - hover muestra n + % completo
        // - color de texto contrastante con el color del segmento
        const horizontalTraces = cruce.plot_traces.map((t, fi) => {
          const segColor = t.marker?.color || "#1f77b4";
          const ns = (cruce.celdas[fi] ?? []).map((c) => c?.n ?? 0);
          const pcts = t.y as number[];
          return {
            ...t,
            x: pcts,
            y: t.x,
            orientation: "h" as const,
            // Solo mostramos el % dentro de la barra cuando el segmento
            // es ancho (>=6%). Para los chicos queda vacío y el detalle
            // aparece en el hover, evitando texto apelmazado e ilegible
            // sobre segmentos finos.
            text: pcts.map((v) => (v >= 0.06 ? `${(v * 100).toFixed(1)}%` : "")),
            textposition: "inside" as const,
            insidetextanchor: "middle" as const,
            textfont: { color: contrastTextColor(segColor), size: 11 },
            cliponaxis: false,
            constraintext: "none" as const,
            customdata: ns,
            hovertemplate:
              "%{fullData.name}<br>n: %{customdata}<br>%: %{x:.1%}<extra></extra>",
          };
        });
        // Altura mínima generosa: pretendemos llenar al menos la altura
        // del sidebar (~520 px sobre desktop). Cada fila aporta 56 px
        // para que las categorías largas (etiquetas con tildes y dos
        // líneas) respiren sin que las barras se aplasten.
        const filasCount = cruce.columnas.length || 1;
        const baseHeight = Math.max(540, filasCount * 56 + 120);
        return (
          <section key={`${idx}-${cruce.nivel ?? "all"}`} className="dash-cardbox dash-relacion-cruce">
            {payload.iterado && (
              <div className="dash-cardbox-header">
                <h2 className="dash-cardbox-title">
                  {payload.iter_label ?? "Iteración"}: {cruce.nivel}
                </h2>
                <span className="dash-relacion-n">n = {cruce.n_total}</span>
              </div>
            )}
            {cruce.plot_traces.length > 0 && cruce.columnas.length > 0 ? (
              <PlotlyChart
                data={horizontalTraces}
                layout={{
                  barmode: "stack",
                  xaxis: { tickformat: ".0%", range: [0, 1], fixedrange: true },
                  yaxis: { fixedrange: true, automargin: true },
                  showlegend: true,
                  legend: {
                    orientation: "h",
                    x: 0.5,
                    xanchor: "center",
                    y: -0.18,
                    traceorder: "normal",
                  },
                  margin: { t: 10, r: 18, b: 50, l: 80 },
                }}
                height={maxed ? Math.max(720, baseHeight + 200) : baseHeight}
                ariaLabel="Cruce de variables"
              />
            ) : (
              <p className="dash-cardbox-help">Sin datos suficientes para graficar.</p>
            )}
            <ContingenciaTable cruce={cruce} />
          </section>
        );
      })}
    </div>
  );
}

// Encabezado multinivel del legacy (interactivo_relacion.R:1239-1279):
//   Fila 1:  [Cruce*] [Total*] [Estrato 1     ] [Estrato 2     ] ...
//   Fila 2:  [      ] [   *  ] [    n   |  %  ] [    n   |  %  ] ...
//   * = celdas con rowspan; "Total" tiene colspan 2 sobre n y % implícitos
function ContingenciaTable({ cruce }: { cruce: DashboardRelacionCruce }) {
  const fmtPct = (pct: number) => `${(pct * 100).toFixed(1)}%`;

  return (
    <div className="dash-cross-table-wrap">
      <table className="dash-cross-table dash-cross-table-multi">
        <thead>
          <tr>
            <th rowSpan={2} className="dash-cross-corner">Cruce</th>
            {cruce.columnas.map((c) => (
              <th key={c.code} colSpan={2} className="dash-cross-col-group">
                {c.label}
              </th>
            ))}
            <th colSpan={2} className="dash-cross-col-total">Total</th>
          </tr>
          <tr>
            {cruce.columnas.map((c) => (
              <Fragment key={c.code}>
                <th className="dash-cross-subhdr">n</th>
                <th className="dash-cross-subhdr">%</th>
              </Fragment>
            ))}
            <th className="dash-cross-subhdr">n</th>
            <th className="dash-cross-subhdr">%</th>
          </tr>
        </thead>
        <tbody>
          {cruce.filas.map((f, i) => (
            <tr key={f.code}>
              <th scope="row" className="dash-cross-rowhdr">{f.label}</th>
              {cruce.columnas.map((c, j) => {
                const cell = cruce.celdas[i]?.[j];
                const n = cell?.n ?? 0;
                const pct = cell?.pct_col ?? 0;
                return (
                  <Fragment key={c.code}>
                    <td>{n}</td>
                    <td className="dash-cross-pct">{fmtPct(pct)}</td>
                  </Fragment>
                );
              })}
              <td>{f.n_total}</td>
              <td className="dash-cross-pct">
                {fmtPct(cruce.n_total > 0 ? f.n_total / cruce.n_total : 0)}
              </td>
            </tr>
          ))}
          <tr className="dash-cross-table-total">
            <th scope="row" className="dash-cross-rowhdr">Total</th>
            {cruce.columnas.map((c) => (
              <Fragment key={c.code}>
                <td>{c.n_total}</td>
                <td className="dash-cross-pct">
                  {fmtPct(cruce.n_total > 0 ? c.n_total / cruce.n_total : 0)}
                </td>
              </Fragment>
            ))}
            <td>{cruce.n_total}</td>
            <td className="dash-cross-pct">100.0%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

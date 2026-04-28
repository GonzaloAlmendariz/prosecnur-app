import { Download } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { apiDashboardRelacionDescargar, type DashboardRelacionCruce } from "../../../../api/client";
import { useDashboardSecciones, useRelacionCross } from "../../useDashboardData";
import { useDashboardStore } from "../../store";
import { EmptyState } from "../../shared/EmptyState";
import {
  FullscreenButton,
  FullscreenWrapper,
  type FullscreenCtx,
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

  const [downloadBusy, setDownloadBusy] = useState(false);

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

  function handleDescargar() {
    if (!relacion.varPrincipal || !relacion.varSegmento) return;
    setDownloadBusy(true);
    apiDashboardRelacionDescargar({
      var_principal: relacion.varPrincipal,
      var_segmento: relacion.varSegmento,
      filtros: filtrosActivos,
      iterar: iterar,
    })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `relacion_${relacion.varPrincipal}_x_${relacion.varSegmento}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .finally(() => setDownloadBusy(false));
  }

  return (
    <FullscreenWrapper title={payload ? relacionFullscreenTitle(payload) : "Relaciones"}>
      {(fsCtx) => (
    <div className="dash-resumen-layout">
      {/* ───── Sidebar ───── */}
      <aside className="dash-sidebar">
        <SelectorVariable
          titulo="Variable principal"
          variableLabel="Variable"
          secciones={seccionesElegibles}
          loading={loadingSecs}
          error={errSecs}
          value={relacion.varPrincipal}
          onChange={(v) => setRelacion({ varPrincipal: v })}
        />

        <SelectorVariable
          titulo="Cruce"
          variableLabel="Segmento"
          secciones={seccionesElegibles}
          loading={loadingSecs}
          error={null}
          value={relacion.varSegmento}
          onChange={(v) => setRelacion({ varSegmento: v })}
        />

        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">Filtros</h2>
          </div>
          <FiltrosMultiRow
            secciones={secciones}
            enabled={relacion.filtrosOn}
            onToggleEnabled={(on) => setRelacion({ filtrosOn: on })}
            onChange={setFiltros}
          />
        </section>

        <IterarCard
          secciones={seccionesElegibles}
          value={relacion.iterarVar}
          enabled={relacion.iterarOn}
          onToggle={(on) => setRelacion({ iterarOn: on })}
          onChange={(v) => setRelacion({ iterarVar: v })}
        />

        <button
          type="button"
          className="dash-subtle-btn dash-sidebar-action"
          disabled={!relacion.varPrincipal || !relacion.varSegmento || downloadBusy}
          onClick={handleDescargar}
        >
          <Download size={14} aria-hidden="true" />
          {downloadBusy ? "Generando…" : "Descargar Excel"}
        </button>
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
              <FullscreenButton ctx={fsCtx} />
            </div>
            <CrucesView payload={payload} maxed={fsCtx.maxed} />
          </section>
        ) : (
          <EmptyState title="Sin datos para cruzar" />
        )}
      </main>
    </div>
      )}
    </FullscreenWrapper>
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
  variableLabel = "Variable",
  secciones,
  loading,
  error,
  value,
  onChange,
}: {
  titulo: string;
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

  return (
    <section className="dash-cardbox">
      <div className="dash-cardbox-header">
        <h2 className="dash-cardbox-title">{titulo}</h2>
      </div>
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
    </section>
  );
}

// -----------------------------------------------------------------------------
// Card "Iterar" directa: toggle + selects visibles. Evita esconder la
// configuración en un popover y deja el estado actual escaneable.
// -----------------------------------------------------------------------------
function IterarCard({
  secciones,
  value,
  enabled,
  onToggle,
  onChange,
}: {
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

  return (
    <section className="dash-cardbox dash-iter-card">
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
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Vista de cruces (uno o varios si itera).
// -----------------------------------------------------------------------------
function CrucesView({
  payload,
  maxed = false,
}: {
  payload: { iterado: boolean; iter_label?: string; cruces: DashboardRelacionCruce[] };
  maxed?: boolean;
}) {
  return (
    <div className="dash-relacion-cruces">
      {payload.cruces.map((cruce, idx) => (
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
              data={cruce.plot_traces}
              layout={{
                barmode: "stack",
                yaxis: { tickformat: ".0%", range: [0, 1], fixedrange: true },
                xaxis: { fixedrange: true },
                showlegend: true,
                legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18 },
                margin: { t: 10, r: 18, b: 50, l: 40 },
              }}
              height={maxed ? 720 : 320}
              ariaLabel="Cruce de variables"
            />
          ) : (
            <p className="dash-cardbox-help">Sin datos suficientes para graficar.</p>
          )}
          <ContingenciaTable cruce={cruce} />
        </section>
      ))}
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

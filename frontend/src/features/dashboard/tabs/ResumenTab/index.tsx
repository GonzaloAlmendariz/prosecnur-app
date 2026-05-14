import { useEffect, useState } from "react";
import { useDashboardStore } from "../../store";
import {
  useDashboardSecciones,
  useResumenKpis,
  useResumenSeccion,
} from "../../useDashboardData";
import { EmptyState } from "../../shared/EmptyState";
import { SeccionSelector } from "./SeccionSelector";
import { PreguntaRow } from "./PreguntaRow";
import { KpiCard } from "./KpiCard";
import { FiltrosMultiRow } from "./FiltrosMultiRow";

// Tab Resumen — alineado al legacy `reporte_interactivo()` (tab 1):
//   ┌────────────────────────────────────────────────────────────┐
//   │ ┌─ Sidebar ─────────┐  ┌─ Main ───────────────────────────┐ │
//   │ │ Resumen           │  │ Resumen de sección: [select]    │ │
//   │ │  Filtros [switch] │  │                                 │ │
//   │ │   Filtro 1: ...   │  │                                 │ │
//   │ │  Perfil muestra   │  │ ─────────────────────────────── │ │
//   │ │   N: 1,234        │  │  Pregunta 1   ▆▆▆▆▆▆▆▆▆▆▆      │ │
//   │ │   Donut KPI 1     │  │  Pregunta 2   ▆▆▆▆▆▆▆▆▆▆▆      │ │
//   │ │   Donut KPI 2     │  │  ...                            │ │
//   │ └───────────────────┘  └─────────────────────────────────┘ │
//   └────────────────────────────────────────────────────────────┘

export function ResumenTab() {
  const seccionActiva = useDashboardStore((s) => s.seccionActiva);
  const setSeccionActiva = useDashboardStore((s) => s.setSeccionActiva);
  const filtros = useDashboardStore((s) => s.filtros);
  const setFiltros = useDashboardStore((s) => s.setFiltros);

  const [filtrosEnabled, setFiltrosEnabled] = useState(false);

  const { loading: loadingSecs, error: errSecs, secciones } = useDashboardSecciones();
  const { payload: kpisPayload } = useResumenKpis(filtros);
  const { loading: loadingPay, error: errPay, payload } = useResumenSeccion(
    seccionActiva,
    filtros,
  );

  // Auto-select primera sección.
  useEffect(() => {
    if (!seccionActiva && secciones.length > 0) {
      setSeccionActiva(secciones[0].nombre);
    }
  }, [secciones, seccionActiva, setSeccionActiva]);

  // Renderizamos siempre el shell (sidebar + main) para que la
  // estructura sea evaluable. Cada panel muestra su propio empty/loading
  // state según el caso.
  const noHayDatos = !loadingSecs && !errSecs && secciones.length === 0;

  return (
    <div className="dash-resumen-layout">
      {/* ───── Sidebar ───── */}
      <aside className="dash-sidebar">
        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <h2 className="dash-cardbox-title">
              Resumen
            </h2>
          </div>
          <p className="dash-cardbox-help">
            Selecciona una sección y aplica filtros para analizar resultados.
          </p>

          <div className="dash-resumen-filter-panel">
            <FiltrosMultiRow
              secciones={secciones}
              enabled={filtrosEnabled}
              onToggleEnabled={(v) => {
                setFiltrosEnabled(v);
                if (!v) setFiltros([]);
              }}
              onChange={setFiltros}
            />
          </div>
        </section>

        {/* Perfil de la muestra: N + KPIs medio-donut */}
        <section className="dash-cardbox">
          <div className="dash-cardbox-header dash-cardbox-header--compact">
            <h3 className="dash-cardbox-title dash-cardbox-title--small">
              Perfil de la muestra
            </h3>
          </div>
          <div className="dash-kpi-stack">
            <div className="dash-kpi-n">
              N:{" "}
              {(kpisPayload?.n_total ?? payload?.n_total ?? 0).toLocaleString("es-PE")}
            </div>
            {kpisPayload?.kpis?.length === 0 && (
              <div className="dash-kpi-empty">
                Sin indicadores configurados.
              </div>
            )}
            {kpisPayload?.kpis?.map((kpi) => (
              <KpiCard key={kpi.var} kpi={kpi} />
            ))}
          </div>
        </section>
      </aside>

      {/* ───── Main ───── */}
      <main>
        <section className="dash-cardbox">
          <div className="dash-cardbox-header">
            <div className="dash-section-title-inline">
              <span className="dash-cardbox-title">Resumen de sección:</span>
              <SeccionSelector
                secciones={secciones}
                active={seccionActiva}
                onSelect={setSeccionActiva}
              />
            </div>
          </div>

          {loadingSecs && <EmptyState title="Cargando secciones…" />}
          {errSecs && (
            <EmptyState title="No se pudo cargar el dashboard" subtitle={errSecs} />
          )}
          {noHayDatos && (
            <EmptyState
              title="No hay secciones disponibles"
              subtitle="El instrumento aún no se cargó o no tiene grupos definidos. Carga XLSForm + base en Procesamiento."
            />
          )}
          {!loadingSecs && !errSecs && !noHayDatos && (
            <>
              {loadingPay && <EmptyState title="Cargando…" />}
              {errPay && <EmptyState title="Error" subtitle={errPay} />}
              {!loadingPay && !errPay && payload && payload.rows.length === 0 && (
                <EmptyState
                  title="Sin preguntas en esta sección"
                  subtitle="No hay variables disponibles para mostrar."
                />
              )}
              {!loadingPay && payload && payload.rows.length > 0 && (
                <div>
                  {payload.rows.map((row) => (
                    <PreguntaRow key={row.var} row={row} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

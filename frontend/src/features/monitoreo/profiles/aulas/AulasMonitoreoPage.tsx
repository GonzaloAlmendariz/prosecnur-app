import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, CalendarRange, CheckCircle2 } from "lucide-react";
import {
  apiMonitoreoAulasImportFromCalcMuestra,
  apiMonitoreoAulasSync,
  apiMonitoreoState,
  type MonitoreoAulasDashboard,
  type MonitoreoRow,
  type MonitoreoState,
} from "../../../../api/client";
import { AulasOperationsPanel, aulasPlanImported } from "./AulasOperationsPanel";
import { AULAS_SAMPLE_ROUTE, AulasApplicationFlow, type AulasFlowMetric } from "../../../aulasFlow/AulasApplicationFlow";
import { MODULE_TONES } from "../../../../lib/modules";
import {
  modoIdDesdeFamily, AULAS_WORKBENCH_VIEWS, MONITOREO_MODOS, type MonitoreoSeccion } from "../../core/monitoreoRegistry";
import {
  seccionInicialMonitoreo,
  useMonitoreoDireccion,
} from "../../useMonitoreoDireccion";
import { MonitoreoModuleChrome } from "../../shell/MonitoreoModuleChrome";
import {
  aulasFieldLabel,
  presentAulasRow,
  summarizeAulasValidation,
} from "./aulasPresentation";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";
import "../../shell/monitoreoShell.css";
import "./aulasMonitoreo.css";
import { recorteTabla } from "../../corte/corteContract";

const AULAS_ROUTE = MONITOREO_MODOS.find((route) => route.family === "aulas_universitarias") ?? MONITOREO_MODOS[2];

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}

function scopeForView(view: MonitoreoSeccion): MonitoreoReportScope {
  if (view === "calidad") return "validation_summary";
  if (view === "consultas") return "queries_summary";
  if (view === "fuentes" || view === "modelo") return "source";
  return "advance_summary";
}

function dashboardFromState(state: MonitoreoState | null) {
  return state?.dashboard?.aulas_universitarias_reports ?? null;
}

// El límite deja de estar incrustado: quien llama decide, y el recorte se
// declara en la vista (antes se perdían columnas sin aviso).
function compactColumns(
  rows: Array<Record<string, unknown>>,
  preferred: string[] = [],
  maxColumns = 8,
) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, maxColumns);
}

type AulasKpi = { label: string; value: string; tone?: "neutral" | "warn" };

// Banda canonica: unifica los KPIs que antes estaban repartidos entre la
// cabecera (3) y la fila de stats de avance (5). El color semantico (warn)
// se reserva para brechas/cuotas con deficit real; el resto queda neutral
// para no meter ruido verde en conteos que aun estan en 0.
function aulasKpis(dashboard: MonitoreoAulasDashboard | null): AulasKpi[] {
  const kpis = dashboard?.kpis;
  const quotaOk = Number(kpis?.quota_cells_ok ?? 0);
  const quotaAll = Number(kpis?.quota_cells ?? 0);
  const quotaPending = Number(kpis?.quota_cells_pending ?? 0);
  const brechas = Number(kpis?.brechas ?? 0);
  return [
    { label: "Cursos-horario", value: fmt(kpis?.total_aulas) },
    { label: "Aplicadas", value: fmt(kpis?.aulas_aplicadas) },
    { label: "Válidas", value: fmt(kpis?.respuestas_validas) },
    { label: "Representatividad", value: pct(kpis?.representativity_effective_score) },
    { label: "Cuotas sexo/facultad", value: `${fmt(quotaOk)}/${fmt(quotaAll)}`, tone: quotaPending ? "warn" : "neutral" },
    { label: "Brechas", value: fmt(kpis?.brechas), tone: brechas ? "warn" : "neutral" },
  ];
}

function AulasKpiBand({ dashboard }: { dashboard: MonitoreoAulasDashboard | null }) {
  return (
    <div
      className="aulas-kpi-band"
      role="group"
      aria-label="Indicadores de cursos-horario"
      data-qa-geometry-group="monitoring-aulas-kpis"
      data-qa-geometry-contract="equal"
    >
      {aulasKpis(dashboard).map((kpi) => (
        <div key={kpi.label} className={`aulas-kpi aulas-kpi--${kpi.tone ?? "neutral"}`}>
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  rows,
  empty,
  preferredColumns = [],
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
}) {
  if (!rows.length) {
    return (
      <div
        className="mon-profile-table-wrap"
        data-qa-geometry-capacity="owned"
        data-qa-geometry-member
      >
        <p className="mon-profile-muted">{empty}</p>
      </div>
    );
  }
  // La tabla recortaba a ocho columnas y ochenta filas sin decirlo, y Agenda
  // pide nueve: origen y recopilador desaparecían de la vista sin dejar rastro.
  // Ahora todo recorte se declara.
  const todasLasColumnas = compactColumns(rows, preferredColumns, Number.MAX_SAFE_INTEGER);
  const recorteColumnas = recorteTabla(todasLasColumnas, 8, "columna");
  const columns = recorteColumnas.visibles;
  const recorteFilas = recorteTabla(rows.map(presentAulasRow), 80);
  const avisos = [recorteFilas.etiqueta, recorteColumnas.etiqueta].filter(Boolean);
  return (
    <div
      className="mon-profile-table-wrap"
      data-qa-geometry-capacity="owned"
      data-qa-geometry-member
    >
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{aulasFieldLabel(column)}</th>)}</tr>
        </thead>
        <tbody>
          {recorteFilas.visibles.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {avisos.length ? (
        <p className="mon-profile-table-recorte">{avisos.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mon-profile-empty">
      <span className="mon-profile-empty__icon"><CalendarRange size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function agendaRows(dashboard: MonitoreoAulasDashboard | null) {
  return (dashboard?.agenda ?? []) as unknown as Array<Record<string, unknown>>;
}

function cleanCell(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function hasCell(row: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => cleanCell(row[key]).length > 0);
}

function packagePrepared(row: Record<string, unknown>) {
  const status = cleanCell(row.package_status).toLowerCase();
  return hasCell(row, ["pdf_link", "pdf_url", "pdf", "ficha_pdf"]) || status === "pdf_preparado";
}

function handoffSummary(dashboard: MonitoreoAulasDashboard | null) {
  const rows = agendaRows(dashboard);
  const kpiTotal = Number(dashboard?.kpis.total_aulas ?? 0);
  const total = rows.length || (Number.isFinite(kpiTotal) ? kpiTotal : 0);
  const linked = rows.filter((row) => hasCell(row, ["link", "url", "collector_link"])).length;
  const pdf = rows.filter(packagePrepared).length;
  const word = rows.filter((row) => hasCell(row, ["word_link", "word_url", "word", "docx", "ficha_word"])).length;
  return { rows, total, linked, pdf, word };
}

function coverageLabel(done: number, total: number, unit = "cursos-horario") {
  if (!total) return "pendiente";
  return `${fmt(done)}/${fmt(total)} ${unit}`;
}

function metricTone(done: number, total: number): AulasFlowMetric["tone"] {
  if (!total) return "neutral";
  if (done >= total) return "ready";
  if (done > 0) return "current";
  return "warning";
}

function HandoffTracePanel({ dashboard }: { dashboard: MonitoreoAulasDashboard | null }) {
  const handoff = handoffSummary(dashboard);
  const cards = [
    {
      label: "Plan de muestra",
      value: dashboard?.selection_run_id ? "importado" : "pendiente",
      detail: `${fmt(handoff.total)} cursos-horario de la selección del cálculo de muestra`,
      tone: dashboard?.selection_run_id ? "ready" : "waiting",
    },
    {
      label: "Kobo + QR",
      value: coverageLabel(handoff.linked, handoff.total),
      detail: "enlace de aplicación guardado por curso-horario",
      tone: metricTone(handoff.linked, handoff.total) === "ready" ? "ready" : handoff.linked ? "current" : "waiting",
    },
    {
      label: "Fichas PDF",
      value: handoff.pdf ? coverageLabel(handoff.pdf, handoff.total, "fichas") : handoff.linked ? "listas para preparar" : "pendiente",
      detail: handoff.word ? `${fmt(handoff.word)} fichas Word enlazadas` : "QR, Word y PDF se preparan desde Fichas QR",
      tone: handoff.pdf ? "ready" : handoff.linked ? "current" : "waiting",
    },
    {
      label: "Monitoreo",
      value: handoff.linked ? "trazable" : "sin enlaces",
      detail: "lee agenda y enlaces; no recalcula la muestra",
      tone: handoff.linked ? "ready" : "waiting",
    },
  ];

  return (
    <section className="mon-profile-panel mon-aulas-handoff-panel">
      <div className="mon-profile-panel-head">
        <h3>Aplicación por cursos-horario</h3>
        <span>muestra, fichas QR y monitoreo</span>
      </div>
      <div
        className="mon-aulas-handoff-grid"
        data-qa-geometry-group="monitoring-aulas-handoff"
        data-qa-geometry-contract="equal"
      >
        {cards.map((card) => (
          <article key={card.label} className={`is-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function renderAulasView(view: MonitoreoSeccion, dashboard: MonitoreoAulasDashboard | null, operations?: ReactNode) {
  if (view === "fuentes") {
    // Las operaciones (importar plan / sincronizar campo) se muestran incluso
    // sin dashboard: importar el plan es justamente la acción de arranque.
    const rows: MonitoreoRow[] = dashboard
      ? [
        { campo: "corrida", valor: dashboard.selection_run_id ?? "S/D" },
        { campo: "marco", valor: dashboard.frame_hash ?? "S/D" },
        { campo: "anonimas", valor: Boolean(dashboard.anonymous_responses) },
        { campo: "generado", valor: dashboard.generated_at },
      ]
      : [];
    return (
      <div className="mon-profile-stack aulas-fuentes-stack">
        {operations}
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Fuente y plan</h3>
            <span>{fmt(rows.length)} campos</span>
          </div>
          <DataTable
            rows={rows as Array<Record<string, unknown>>}
            empty="No hay metadatos del plan de cursos-horario. Importa el plan desde el cálculo de muestra."
            preferredColumns={["campo", "valor"]}
          />
        </section>
      </div>
    );
  }
  if (!dashboard) {
    return <EmptyPanel title="Resumen pendiente" detail="Todavía no hay un panel local preparado para cursos-horario." />;
  }
  if (view === "modelo") {
    return (
      <div className="mon-profile-stack">
        <HandoffTracePanel dashboard={dashboard} />
        <section
          className="mon-profile-panel"
          data-qa-geometry-group="monitoring-aulas-table"
          data-qa-geometry-contract="intrinsic"
        >
          <div className="mon-profile-panel-head">
            <h3>Agenda de cursos-horario</h3>
            <span>{fmt(dashboard.agenda?.length ?? 0)} cursos-horario</span>
          </div>
          <DataTable
            rows={agendaRows(dashboard)}
            empty="No hay agenda importada para cursos-horario."
            preferredColumns={["operational_code", "label", "course_name", "section", "schedule", "link", "package_status", "responsible", "collector_id"]}
          />
        </section>
      </div>
    );
  }
  if (view === "calidad") {
    const rows = (dashboard.validation ?? []) as Array<Record<string, unknown>>;
    const summary = summarizeAulasValidation(rows);
    return (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Validación de cursos-horario</h3>
          <span>{summary.label}</span>
        </div>
        <DataTable
          rows={rows}
          empty="No hay controles de validación para este corte."
          preferredColumns={["check", "status", "detail"]}
        />
      </section>
    );
  }
  if (view === "consultas") {
    const rows = [
      ...((dashboard.course_status ?? []) as Array<Record<string, unknown>>),
      ...((dashboard.reemplazos ?? []) as Array<Record<string, unknown>>),
      ...((dashboard.brechas ?? []) as Array<Record<string, unknown>>),
    ];
    return (
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>Reemplazos y brechas</h3>
          <span>{fmt(rows.length)} filas</span>
        </div>
        <DataTable rows={rows} empty="No hay consultas internas preparadas para cursos-horario." />
      </section>
    );
  }
  const quotaRows = (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>;
  const avanceRows = (quotaRows.length ? quotaRows : dashboard.avance_por_estrato ?? []) as Array<Record<string, unknown>>;
  return (
    <div className="mon-profile-stack">
      <section
        className="mon-profile-panel"
        data-qa-geometry-group="monitoring-aulas-table"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="mon-profile-panel-head">
          <h3>{quotaRows.length ? "Cuota sexo por facultad" : "Avance por estrato"}</h3>
          <span>{fmt(avanceRows.length)} filas</span>
        </div>
        <DataTable rows={avanceRows} empty="No hay avance por estrato preparado." />
      </section>
    </div>
  );
}

export default function AulasMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [seccionActiva, setActiveView] = useState<MonitoreoSeccion>(() => seccionInicialMonitoreo("avance", AULAS_WORKBENCH_VIEWS));
  // Cursos-horario no tiene pestañas: sus secciones son hojas del árbol.
  useMonitoreoDireccion(seccionActiva, undefined, "aulas", {
    onSeccionPedida: setActiveView,
  });
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");

  const activeDef = useMemo(
    () => AULAS_WORKBENCH_VIEWS.find((item) => item.key === seccionActiva) ?? AULAS_WORKBENCH_VIEWS[0],
    [seccionActiva],
  );
  const dashboard = dashboardFromState(state);
  const aulasConfig = state?.config?.aulas_universitarias ?? null;
  const imported = aulasPlanImported(aulasConfig);
  const sourceTotal = state?.sources?.length ?? 0;
  const activeSources = (state?.sources ?? []).filter((source) => source.enabled).length;
  const busy = loading || mutating;
  const refreshTitle = busy
    ? "Actualizando vista de cursos-horario..."
    : `Recargar ${activeDef.shortLabel ?? activeDef.label} desde la memoria local del proyecto`;
  const advanceTitle = imported
    ? "Recalcular el corte de campo de cursos-horario con el snapshot y la agenda locales"
    : "Primero importa el plan desde el cálculo de muestra (sección Fuentes)";

  const loadView = useCallback(async (view: MonitoreoSeccion, force = false) => {
    setLoading(true);
    try {
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: scopeForView(view),
        warmupCache: !force,
        force,
      });
      setState(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadView(seccionActiva);
  }, [seccionActiva, loadView]);

  // Flujos movidos del monolito (unidad 4.1) sin reescribir la lógica:
  // importAulasFromCalcMuestra / syncAulasUniversitarias de MonitoreoPage.tsx.
  const importPlan = useCallback(async () => {
    setMutating(true);
    setError("");
    try {
      const result = await apiMonitoreoAulasImportFromCalcMuestra();
      setState(result.state);
      // El monolito aterrizaba en la agenda tras importar; se conserva.
      setActiveView("modelo");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutating(false);
    }
  }, []);

  const syncField = useCallback(async () => {
    setMutating(true);
    setError("");
    try {
      const result = await apiMonitoreoAulasSync();
      setState(result.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMutating(false);
    }
  }, []);

  return (
    <div className="mon-profile-page is-aulas-flow" style={MODULE_TONES.monitoreo as CSSProperties}>
      <span
        hidden
        data-audit-ready="monitoreo-aulas"
        data-audit-has-dashboard={dashboard ? "true" : "false"}
      />
      <MonitoreoModuleChrome
        routes={[AULAS_ROUTE]}
        route={AULAS_ROUTE}
        routeSelected
        seccionActiva={seccionActiva}
        saving={busy}
        syncedAt={state?.synced_at ?? ""}
        generatedAt={state?.generated_at ?? state?.synced_at ?? ""}
        generationStatus={state?.generation_status ?? ""}
        pendingRegeneration={Boolean(state?.pending_regeneration)}
        syncErrors={state?.sync_errors ?? state?.errors ?? []}
        sourceTotal={sourceTotal}
        activeSources={activeSources}
        nRows={state?.n_rows ?? 0}
        hasSnapshot={Boolean(state?.has_snapshot)}
        syncing={busy}
        advanceSyncDisabled={busy || !imported}
        advanceSyncLabel="Avance"
        advanceSyncTitle={advanceTitle}
        onSyncAdvance={() => { void syncField(); }}
        syncDisabled={busy}
        syncLabel="Recargar"
        syncTitle={refreshTitle}
        onSyncAll={() => { void loadView(seccionActiva, true); }}
        onCambioSeccion={(view) => {
          if (view !== seccionActiva) setActiveView(view);
        }}
      />

      <main className="mon-profile-workbench">
        <aside className="mon-profile-sidebar">
          <div className="mon-profile-context">
            <span>SECCIÓN ACTIVA</span>
            <strong>Cursos-horario</strong>
            <small>{activeDef.label}</small>
          </div>
          <div className="mon-profile-readiness">
            <span>{dashboard ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span>
            <div>
              <strong>{dashboard ? "Vista lista" : "Preparando vista"}</strong>
              <small>{dashboard?.schema ?? "Memoria local"}</small>
            </div>
          </div>
        </aside>

        <section className={`mon-profile-content${seccionActiva === "fuentes" ? " has-aulas-flow" : ""}`}>
          <AulasKpiBand dashboard={dashboard} />
          {seccionActiva === "fuentes" ? (
            <AulasApplicationFlow
              tone="monitoreo"
              current="monitoreo"
              compact
              title="Seguimiento de la intervención por cursos-horario"
              summary="Este monitoreo lee el plan del cálculo de muestra de cursos-horario y sus enlaces QR/PDF para medir avance, caídas, reemplazos y brechas sin rediseñar la muestra."
              secondaryAction={{ to: AULAS_SAMPLE_ROUTE, label: "Ver muestra de cursos-horario" }}
              action={{ to: "/recopiladores", label: "Abrir fichas QR" }}
            />
          ) : null}
          <div className="aulas-mon-view">
            {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
            {loading ? (
              <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." />
            ) : renderAulasView(
              seccionActiva,
              dashboard,
              <AulasOperationsPanel
                config={aulasConfig}
                sources={state?.sources ?? []}
                busy={busy}
                onImportPlan={() => { void importPlan(); }}
                onSyncField={() => { void syncField(); }}
              />,
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

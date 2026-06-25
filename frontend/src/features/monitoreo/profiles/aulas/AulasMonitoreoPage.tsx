import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, CalendarRange, CheckCircle2, RefreshCw } from "lucide-react";
import {
  apiMonitoreoState,
  type MonitoreoAulasDashboard,
  type MonitoreoRow,
  type MonitoreoState,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import { AULAS_WORKBENCH_VIEWS, type WorkbenchView } from "../../core/monitoreoRegistry";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";

const AULAS_VIEWS: WorkbenchView[] = ["avance", "modelo", "calidad", "consultas", "fuentes"];

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

function scopeForView(view: WorkbenchView): MonitoreoReportScope {
  if (view === "calidad") return "validation_summary";
  if (view === "consultas") return "queries_summary";
  if (view === "fuentes" || view === "modelo") return "source";
  return "advance_summary";
}

function dashboardFromState(state: MonitoreoState | null) {
  return state?.dashboard?.aulas_universitarias_reports ?? null;
}

function rowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function compactColumns(rows: Array<Record<string, unknown>>, preferred: string[] = []) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, 8);
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className={`mon-profile-stat mon-profile-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
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
  if (!rows.length) return <p className="mon-profile-muted">{empty}</p>;
  const columns = compactColumns(rows, preferredColumns);
  return (
    <div className="mon-profile-table-wrap">
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{rowValue(row, column)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
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

function renderAulasView(view: WorkbenchView, dashboard: MonitoreoAulasDashboard | null) {
  if (!dashboard) {
    return <EmptyPanel title="Resumen pendiente" detail="Todavia no hay dashboard local preparado para aulas." />;
  }
  if (view === "fuentes") {
    const rows: MonitoreoRow[] = [
      { campo: "corrida", valor: dashboard.selection_run_id ?? "S/D" },
      { campo: "marco", valor: dashboard.frame_hash ?? "S/D" },
      { campo: "anonimas", valor: Boolean(dashboard.anonymous_responses) },
      { campo: "generado", valor: dashboard.generated_at },
    ];
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Fuente y plan</h3>
          <span>{fmt(rows.length)} campos</span>
        </div>
        <DataTable rows={rows as Array<Record<string, unknown>>} empty="No hay metadatos del plan de aulas." preferredColumns={["campo", "valor"]} />
      </section>
    );
  }
  if (view === "modelo") {
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Agenda de aulas</h3>
          <span>{fmt(dashboard.agenda?.length ?? 0)} aulas</span>
        </div>
        <DataTable
          rows={agendaRows(dashboard)}
          empty="No hay agenda importada para aulas."
          preferredColumns={["operational_code", "label", "course_name", "section", "schedule", "responsable", "collector_name"]}
        />
      </section>
    );
  }
  if (view === "calidad") {
    const rows = (dashboard.validation ?? []) as Array<Record<string, unknown>>;
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Validacion de aulas</h3>
          <span>{fmt(rows.length)} alertas</span>
        </div>
        <DataTable rows={rows} empty="No hay alertas de validacion para este corte." />
      </section>
    );
  }
  if (view === "consultas") {
    const rows = [
      ...((dashboard.reemplazos ?? []) as Array<Record<string, unknown>>),
      ...((dashboard.brechas ?? []) as Array<Record<string, unknown>>),
    ];
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Reemplazos y brechas</h3>
          <span>{fmt(rows.length)} filas</span>
        </div>
        <DataTable rows={rows} empty="No hay consultas internas preparadas para aulas." />
      </section>
    );
  }
  const avanceRows = (dashboard.avance_por_estrato ?? []) as Array<Record<string, unknown>>;
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row">
        <StatTile label="Aulas" value={fmt(dashboard.kpis.total_aulas)} />
        <StatTile label="Aplicadas" value={fmt(dashboard.kpis.aulas_aplicadas)} tone="good" />
        <StatTile label="Validas" value={fmt(dashboard.kpis.respuestas_validas)} tone="good" />
        <StatTile label="Brechas" value={fmt(dashboard.kpis.brechas)} tone={dashboard.kpis.brechas ? "warn" : "good"} />
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Avance por estrato</h3>
          <span>{fmt(avanceRows.length)} filas</span>
        </div>
        <DataTable rows={avanceRows} empty="No hay avance por estrato preparado." />
      </section>
    </div>
  );
}

export default function AulasMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>("avance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeDef = useMemo(
    () => AULAS_WORKBENCH_VIEWS.find((item) => item.key === activeView) ?? AULAS_WORKBENCH_VIEWS[0],
    [activeView],
  );
  const dashboard = dashboardFromState(state);

  const loadView = useCallback(async (view: WorkbenchView, force = false) => {
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
    void loadView(activeView);
  }, [activeView, loadView]);

  return (
    <div className="mon-profile-page" style={MODULE_TONES.monitoreo as CSSProperties}>
      <header className="mon-profile-topbar">
        <div className="mon-profile-brand">
          <span className="mon-profile-brand__icon"><CalendarRange size={18} /></span>
          <div>
            <strong>Aulas universitarias</strong>
            <span>{fmt(state?.n_rows)} registros</span>
          </div>
        </div>
        <nav className="mon-profile-rail" aria-label="Secciones de monitoreo de aulas">
          {AULAS_VIEWS.map((view, index) => {
            const def = AULAS_WORKBENCH_VIEWS.find((item) => item.key === view);
            const Icon = def?.icon ?? CalendarRange;
            return (
              <button key={view} type="button" className={view === activeView ? "is-active" : ""} onClick={() => setActiveView(view)}>
                <span>{index + 1}</span>
                <Icon size={14} />
                {def?.shortLabel ?? def?.label ?? view}
              </button>
            );
          })}
        </nav>
        <div className="mon-profile-actions">
          <button type="button" onClick={() => void loadView(activeView, true)}>
            <RefreshCw size={14} />
            Actualizar vista
          </button>
        </div>
      </header>

      <main className="mon-profile-workbench">
        <aside className="mon-profile-sidebar">
          <div className="mon-profile-context">
            <span>PATH ACTIVO</span>
            <strong>Aulas</strong>
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

        <section className="mon-profile-content">
          <div className="mon-profile-head">
            <div>
              <span>Aulas universitarias · flujo actual</span>
              <h2>{activeDef.label}</h2>
              <p>{activeDef.desc}</p>
            </div>
            <div className="mon-profile-kpis">
              <StatTile label="Aulas" value={fmt(dashboard?.kpis.total_aulas)} />
              <StatTile label="Aplicadas" value={fmt(dashboard?.kpis.aulas_aplicadas)} tone="good" />
              <StatTile label="Representatividad" value={pct(dashboard?.kpis.representativity_effective_score)} />
            </div>
          </div>
          {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
          {loading ? <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." /> : renderAulasView(activeView, dashboard)}
        </section>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, CheckCircle2, ClipboardCheck, RefreshCw } from "lucide-react";
import {
  apiMonitoreoState,
  type MonitoreoAcreditacionReports,
  type MonitoreoReportSheet,
  type MonitoreoRow,
  type MonitoreoState,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import { WORKBENCH_VIEWS, type WorkbenchView } from "../../core/monitoreoRegistry";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";

const ACREDITACION_VIEWS: WorkbenchView[] = ["fuentes", "modelo", "consultas", "telefonico", "avance"];

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
  if (view === "consultas" || view === "modelo") return "queries_summary";
  if (view === "fuentes") return "source";
  return "advance_summary";
}

function reportsFromState(state: MonitoreoState | null) {
  return state?.dashboard?.acreditacion_reports ?? null;
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

function rowsFromSheets(sheets: MonitoreoReportSheet[] = [], terms: string[] = []) {
  const filters = terms.map((term) => term.toLowerCase());
  return sheets.flatMap((sheet) => (
    sheet.blocks.flatMap((block) => {
      const haystack = `${sheet.id} ${sheet.title} ${block.id} ${block.title}`.toLowerCase();
      if (filters.length && !filters.some((term) => haystack.includes(term))) return [];
      return block.rows.map((row) => ({
        _sheet: sheet.title,
        _block: block.title,
        ...row,
      }));
    })
  ));
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
      <span className="mon-profile-empty__icon"><ClipboardCheck size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function renderAcreditacionView(view: WorkbenchView, reports: MonitoreoAcreditacionReports | null) {
  if (!reports) {
    return <EmptyPanel title="Resumen pendiente" detail="Todavia no hay reporte local preparado para esta vista." />;
  }
  const client = reports.client_report;
  const queries = reports.internal_queries;
  if (view === "fuentes") {
    const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source"]);
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Fuentes configuradas</h3>
          <span>{fmt(sourceRows.length)} filas</span>
        </div>
        <DataTable rows={sourceRows as Array<Record<string, unknown>>} empty="No hay fuentes en el resumen local." />
      </section>
    );
  }
  if (view === "consultas" || view === "modelo") {
    const cases = (queries?.cases ?? []) as Array<Record<string, unknown>>;
    const issues = (queries?.issues ?? []) as Array<Record<string, unknown>>;
    return (
      <div className="mon-profile-stack">
        <div className="mon-profile-stat-row">
          <StatTile label="Casos" value={fmt(cases.length)} tone={cases.length ? "warn" : "good"} />
          <StatTile label="Salidas pendientes" value={fmt(queries?.pending_exit?.length ?? 0)} />
          <StatTile label="Alertas" value={fmt(issues.length)} />
          <StatTile label="Bloques" value={fmt(reports.sheets?.length ?? 0)} />
        </div>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Casos accionables</h3>
            <span>{fmt(cases.length)} registros</span>
          </div>
          <DataTable rows={cases} empty="No hay casos accionables en este corte." preferredColumns={["actor", "person_label", "issue_type", "decision", "advancement"]} />
        </section>
      </div>
    );
  }
  if (view === "telefonico") {
    const phoneRows = rowsFromSheets(reports.sheets, ["telefono", "telefon", "llamada", "responsable"]);
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Seguimiento telefonico</h3>
          <span>{fmt(phoneRows.length)} filas</span>
        </div>
        <DataTable rows={phoneRows} empty="No hay bloque telefonico preparado en el resumen local." />
      </section>
    );
  }
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports.sheets, ["actor", "avance", "brecha"]);
  const dailyRows = client?.daily_general ?? [];
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-grid">
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Avance por actor</h3>
            <span>{fmt(actorRows.length)} filas</span>
          </div>
          <DataTable rows={actorRows as Array<Record<string, unknown>>} empty="No hay avance por actor preparado." />
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Ritmo diario</h3>
            <span>{fmt(dailyRows.length)} dias</span>
          </div>
          <DataTable rows={dailyRows as Array<Record<string, unknown>>} empty="No hay serie diaria preparada." />
        </section>
      </div>
    </div>
  );
}

export default function AcreditacionMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>("fuentes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeDef = useMemo(
    () => WORKBENCH_VIEWS.find((item) => item.key === activeView) ?? WORKBENCH_VIEWS[0],
    [activeView],
  );
  const reports = reportsFromState(state);
  const kpis = state?.dashboard?.kpis ?? null;

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
          <span className="mon-profile-brand__icon"><ClipboardCheck size={18} /></span>
          <div>
            <strong>Acreditacion</strong>
            <span>{fmt(state?.n_rows)} registros</span>
          </div>
        </div>
        <nav className="mon-profile-rail" aria-label="Secciones de monitoreo de acreditacion">
          {ACREDITACION_VIEWS.map((view, index) => {
            const def = WORKBENCH_VIEWS.find((item) => item.key === view);
            const Icon = def?.icon ?? ClipboardCheck;
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
            <strong>Acreditacion</strong>
            <small>{activeDef.label}</small>
          </div>
          <div className="mon-profile-readiness">
            <span>{reports ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span>
            <div>
              <strong>{reports ? "Vista lista" : "Preparando vista"}</strong>
              <small>{reports?.report_scope ?? "Memoria local"}</small>
            </div>
          </div>
        </aside>

        <section className="mon-profile-content">
          <div className="mon-profile-head">
            <div>
              <span>Acreditacion · flujo actual</span>
              <h2>{activeDef.label}</h2>
              <p>{activeDef.desc}</p>
            </div>
            <div className="mon-profile-kpis">
              <StatTile label="Total" value={fmt(kpis?.total ?? state?.n_rows)} />
              <StatTile label="Validas" value={fmt(kpis?.valid)} tone="good" />
              <StatTile label="Avance" value={pct(kpis?.avance_pct)} />
            </div>
          </div>
          {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
          {loading ? <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." /> : renderAcreditacionView(activeView, reports)}
        </section>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, CheckCircle2, PhoneCall, RefreshCw } from "lucide-react";
import {
  apiMonitoreoState,
  type MonitoreoAcreditacionReports,
  type MonitoreoReportSheet,
  type MonitoreoState,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import { WORKBENCH_VIEWS, type WorkbenchView } from "../../core/monitoreoRegistry";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";

const TELEFONICO_VIEWS = ["telefonico", "avance", "modelo", "fuentes"] as const satisfies readonly WorkbenchView[];

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "S/D";
  const normalized = Math.abs(n) <= 1 ? n * 100 : n;
  return `${normalized.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scopeForView(view: WorkbenchView): MonitoreoReportScope {
  if (view === "telefonico") return "full";
  if (view === "avance") return "advance_summary";
  return "source";
}

function needsReports(view: WorkbenchView) {
  return view === "telefonico" || view === "avance";
}

function reportsFromState(state: MonitoreoState | null) {
  return state?.dashboard?.acreditacion_reports ?? null;
}

function phoneSheet(reports: MonitoreoAcreditacionReports | null): MonitoreoReportSheet | null {
  return reports?.sheets.find((sheet) => sheet.id === "monitoreo_telefonico") ?? null;
}

function rowsForBlock(
  reports: MonitoreoAcreditacionReports | null,
  blockIds: string[],
) {
  const wanted = new Set(blockIds.map((id) => id.toLowerCase()));
  return (phoneSheet(reports)?.blocks ?? []).flatMap((block) => {
    if (!wanted.has(String(block.id).toLowerCase())) return [];
    return block.rows.map((row) => ({
      _block: block.title,
      ...row,
    }));
  }) as Array<Record<string, unknown>>;
}

function rowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  const n = Number(value);
  const normalizedColumn = normalizeKey(key);
  if (Number.isFinite(n) && (key.includes("%") || normalizedColumn.includes("ratio"))) return pct(n);
  return String(value);
}

function rowNumber(row: Record<string, unknown>, keys: string[], fallback: number | null = null) {
  const index = new Map(Object.keys(row).map((key) => [normalizeKey(key), key]));
  for (const key of keys) {
    const hit = index.get(normalizeKey(key));
    if (!hit) continue;
    const parsed = Number(String(row[hit]).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function sumRows(rows: Array<Record<string, unknown>>, keys: string[]) {
  return rows.reduce((acc, row) => acc + (rowNumber(row, keys, 0) ?? 0), 0);
}

function metricFromSummary(rows: Array<Record<string, unknown>>, labels: string[]) {
  const wanted = new Set(labels.map(normalizeKey));
  for (const row of rows) {
    const label = normalizeKey(row.Indicador ?? row.indicador ?? row.Metrica ?? row.metric);
    if (wanted.has(label)) return rowNumber(row, ["Casos", "Total", "Valor"], null);
  }
  return null;
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
      <span className="mon-profile-empty__icon"><PhoneCall size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function phoneMetrics(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const summaryRows = rowsForBlock(reports, ["resumen_telefonico"]);
  const operationRows = rowsForBlock(reports, ["operacion_responsable"]);
  const retryRows = rowsForBlock(reports, ["reintentos_responsable"]);
  const total = metricFromSummary(summaryRows, ["Total telefónico", "Total telefonico"]) ?? state?.dashboard?.kpis.total ?? state?.n_rows ?? 0;
  const swept = metricFromSummary(summaryRows, ["Casos barridos"]) ?? sumRows(operationRows, ["Barridos"]);
  const pendingSweep = metricFromSummary(summaryRows, ["No barridos"]) ?? sumRows(operationRows, ["No barridos"]);
  const effective = sumRows(operationRows, ["Efectivas", "Efectivas telefónicas"]) || state?.dashboard?.kpis.valid || 0;
  const retryable = sumRows(retryRows, ["Casos reintentables", "Reintentos bajos"]);
  return { total, swept, pendingSweep, effective, retryable };
}

function renderPhoneView(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const metrics = phoneMetrics(state, reports);
  const summaryRows = rowsForBlock(reports, ["resumen_telefonico"]);
  const statusRows = rowsForBlock(reports, ["estatus_telefonico"]);
  const dailyRows = rowsForBlock(reports, ["avance_efectivo_dia", "produccion_dia"]);
  const operationRows = rowsForBlock(reports, ["operacion_responsable"]);
  const retryRows = rowsForBlock(reports, ["reintentos_responsable", "insistencia_no_contesta", "no_barridos_responsable"]);

  if (!reports) {
    return <EmptyPanel title="Seguimiento pendiente" detail="El resumen telefónico se prepara al abrir esta vista." />;
  }

  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row mon-profile-stat-row--phone">
        <StatTile label="Base telefónica" value={fmt(metrics.total)} />
        <StatTile label="Barridos" value={fmt(metrics.swept)} tone="good" />
        <StatTile label="Efectivas" value={fmt(metrics.effective)} tone="good" />
        <StatTile label="Por barrer" value={fmt(metrics.pendingSweep)} tone={metrics.pendingSweep ? "warn" : "good"} />
        <StatTile label="Reintentos" value={fmt(metrics.retryable)} tone={metrics.retryable ? "warn" : "neutral"} />
      </div>
      <div className="mon-profile-grid">
        <section className="mon-profile-panel mon-profile-panel--compact-table">
          <div className="mon-profile-panel-head">
            <h3>Estado de llamadas</h3>
            <span>{fmt(statusRows.length || summaryRows.length)} filas</span>
          </div>
          <DataTable
            rows={statusRows.length ? statusRows : summaryRows}
            empty="No hay estados telefónicos en el corte actual."
            preferredColumns={statusRows.length
              ? ["Estatus", "Casos", "% del total telefónico"]
              : ["Indicador", "Casos", "% del total telefónico"]}
          />
        </section>
        <section className="mon-profile-panel mon-profile-panel--compact-table">
          <div className="mon-profile-panel-head">
            <h3>Ritmo diario</h3>
            <span>{fmt(dailyRows.length)} cortes</span>
          </div>
          <DataTable
            rows={dailyRows}
            empty="No hay producción diaria del barrido telefónico."
            preferredColumns={["Fecha", "Efectivas", "Barridos", "Sin efectiva", "Incidencias", "Ratio incidencias"]}
          />
        </section>
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Equipo asignado</h3>
          <span>{fmt(operationRows.length)} responsables</span>
        </div>
        <DataTable
          rows={operationRows}
          empty="No hay responsables asignados para el barrido telefónico."
          preferredColumns={["Responsable", "Casos asignados", "Barridos", "No barridos", "Efectivas", "Sin efectiva", "% no barrido", "Ratio incidencias"]}
        />
      </section>
      <section className="mon-profile-panel mon-profile-panel--compact-table">
        <div className="mon-profile-panel-head">
          <h3>Reintentos y pendientes</h3>
          <span>{fmt(retryRows.length)} filas</span>
        </div>
        <DataTable
          rows={retryRows}
          empty="No hay pendientes de insistencia en este corte."
          preferredColumns={["Responsable", "Casos reintentables", "No contesta", "Contactar después", "No barridos", "Reintentos bajos", "Promedio intentos"]}
        />
      </section>
    </div>
  );
}

function renderAdvanceView(state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  const kpis = state?.dashboard?.kpis;
  const actors = (reports?.client_report?.actors ?? []) as Array<Record<string, unknown>>;
  const daily = (reports?.client_report?.daily_general ?? []) as Array<Record<string, unknown>>;
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row">
        <StatTile label="Registros" value={fmt(kpis?.total ?? state?.n_rows)} />
        <StatTile label="Válidas" value={fmt(kpis?.valid)} tone="good" />
        <StatTile label="Meta" value={fmt(kpis?.target, "S/D")} />
        <StatTile label="Avance" value={pct(kpis?.avance_pct)} tone="good" />
      </div>
      <div className="mon-profile-grid">
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Avance por unidad</h3>
            <span>{fmt(actors.length)} filas</span>
          </div>
          <DataTable rows={actors} empty="No hay avance agregado por unidad." />
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Corte diario</h3>
            <span>{fmt(daily.length)} cortes</span>
          </div>
          <DataTable rows={daily} empty="No hay cortes diarios para este seguimiento." />
        </section>
      </div>
    </div>
  );
}

function renderModelView(state: MonitoreoState | null) {
  const model = state?.config.operational_model;
  const targets = (model?.targets ?? []) as unknown as Array<Record<string, unknown>>;
  const strategies = (model?.strategies ?? []) as unknown as Array<Record<string, unknown>>;
  const rules = (model?.state_rules ?? []) as unknown as Array<Record<string, unknown>>;
  return (
    <div className="mon-profile-grid">
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Metas operativas</h3>
          <span>{fmt(targets.length)} metas</span>
        </div>
        <DataTable rows={targets} empty="No hay metas operativas definidas." preferredColumns={["label", "stratum_id", "meta", "notes"]} />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Estrategias telefónicas</h3>
          <span>{fmt(strategies.length)} fases</span>
        </div>
        <DataTable rows={strategies} empty="No hay fases telefónicas configuradas." preferredColumns={["label", "modality", "start_week", "end_week", "target_rule"]} />
      </section>
      <section className="mon-profile-panel mon-profile-panel--compact-table">
        <div className="mon-profile-panel-head">
          <h3>Estados válidos</h3>
          <span>{fmt(rules.length)} reglas</span>
        </div>
        <DataTable rows={rules} empty="No hay reglas de estado para el seguimiento." preferredColumns={["label", "final_state", "priority", "stop_contact"]} />
      </section>
    </div>
  );
}

function renderSourcesView(state: MonitoreoState | null) {
  const sources = (state?.sources ?? state?.source_metadata?.sources ?? []) as unknown as Array<Record<string, unknown>>;
  return (
    <section className="mon-profile-panel">
      <div className="mon-profile-panel-head">
        <h3>Fuentes conectadas</h3>
        <span>{fmt(sources.length)} fuentes</span>
      </div>
      <DataTable
        rows={sources}
        empty="No hay fuentes activas para este seguimiento telefónico."
        preferredColumns={["label", "role", "kind", "integration_mode", "enabled", "last_sync_at"]}
      />
    </section>
  );
}

function renderActiveView(view: WorkbenchView, state: MonitoreoState | null, reports: MonitoreoAcreditacionReports | null) {
  if (view === "telefonico") return renderPhoneView(state, reports);
  if (view === "avance") return renderAdvanceView(state, reports);
  if (view === "modelo") return renderModelView(state);
  return renderSourcesView(state);
}

export default function TelefonicoMonitoreoPage() {
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>("telefonico");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeDef = useMemo(
    () => WORKBENCH_VIEWS.find((item) => item.key === activeView) ?? WORKBENCH_VIEWS.find((item) => item.key === "telefonico")!,
    [activeView],
  );
  const reports = reportsFromState(state);
  const metrics = useMemo(() => phoneMetrics(state, reports), [state, reports]);

  const loadView = useCallback(async (view: WorkbenchView, force = false) => {
    setLoading(true);
    try {
      const includeReports = needsReports(view);
      const next = await apiMonitoreoState({
        includeReports,
        reportScope: includeReports ? scopeForView(view) : undefined,
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
          <span className="mon-profile-brand__icon"><PhoneCall size={18} /></span>
          <div>
            <strong>Monitoreo telefónico</strong>
            <span>{fmt(metrics.total)} casos</span>
          </div>
        </div>
        <nav className="mon-profile-rail" aria-label="Secciones de monitoreo telefónico">
          {TELEFONICO_VIEWS.map((view, index) => {
            const def = WORKBENCH_VIEWS.find((item) => item.key === view);
            const Icon = def?.icon ?? PhoneCall;
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
            <strong>Telefónico</strong>
            <small>{activeDef.label}</small>
          </div>
          <div className="mon-profile-readiness">
            <span>{reports || !needsReports(activeView) ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span>
            <div>
              <strong>{reports || !needsReports(activeView) ? "Vista lista" : "Preparando vista"}</strong>
              <small>{reports ? "Reporte telefónico" : "Estado local"}</small>
            </div>
          </div>
        </aside>

        <section className="mon-profile-content">
          <div className="mon-profile-head">
            <div>
              <span>Telefónico · operación actual</span>
              <h2>{activeDef.label}</h2>
              <p>{activeDef.desc}</p>
            </div>
            <div className="mon-profile-kpis">
              <StatTile label="Barridos" value={fmt(metrics.swept)} tone="good" />
              <StatTile label="Efectivas" value={fmt(metrics.effective)} tone="good" />
              <StatTile label="Por barrer" value={fmt(metrics.pendingSweep)} tone={metrics.pendingSweep ? "warn" : "good"} />
            </div>
          </div>
          {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
          {loading
            ? <EmptyPanel title="Preparando vista" detail="Leyendo estado local del proyecto..." />
            : renderActiveView(activeView, state, reports)}
        </section>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CalendarRange, CheckCircle2, QrCode, RefreshCw } from "lucide-react";
import {
  apiMonitoreoState,
  type MonitoreoAulasDashboard,
  type MonitoreoRow,
  type MonitoreoState,
} from "../../../../api/client";
import { AULAS_SAMPLE_ROUTE, AulasApplicationFlow, type AulasFlowMetric } from "../../../aulasFlow/AulasApplicationFlow";
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

function columnLabel(column: string) {
  const labels: Record<string, string> = {
    operational_code: "Código de ficha",
    label: "Aula",
    course_name: "Curso",
    section: "Sección",
    schedule: "Horario",
    link: "Enlace Kobo",
    package_status: "Ficha PDF",
    responsible: "Responsable",
    collector_id: "Origen",
    classroom_id: "ID de aula",
    teacher: "Docente",
    faculty: "Facultad",
    program: "Carrera",
  };
  return labels[column] ?? column.replaceAll("_", " ");
}

function packageStatusText(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return "";
  const labels: Record<string, string> = {
    pdf_preparado: "PDF preparado",
    listo_para_pdf: "Listo para PDF",
    pendiente_enlace: "Falta enlace",
  };
  return labels[status] ?? String(value);
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
  if (key === "package_status") return packageStatusText(value);
  if (key === "link") return String(value).trim() ? "Guardado" : "";
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
          <tr>{columns.map((column) => <th key={column}>{columnLabel(column)}</th>)}</tr>
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

function coverageLabel(done: number, total: number, unit = "aulas") {
  if (!total) return "pendiente";
  return `${fmt(done)}/${fmt(total)} ${unit}`;
}

function metricTone(done: number, total: number): AulasFlowMetric["tone"] {
  if (!total) return "neutral";
  if (done >= total) return "ready";
  if (done > 0) return "current";
  return "warning";
}

function aulasFlowMetrics(dashboard: MonitoreoAulasDashboard | null): AulasFlowMetric[] {
  const handoff = handoffSummary(dashboard);
  const applied = Number(dashboard?.kpis.aulas_aplicadas ?? 0);
  const totalAulas = handoff.total || Number(dashboard?.kpis.total_aulas ?? 0);
  return [
    { label: "Plan", value: dashboard?.selection_run_id ? "importado" : "pendiente", tone: dashboard?.selection_run_id ? "ready" : "warning" },
    { label: "Kobo + QR", value: coverageLabel(handoff.linked, handoff.total), tone: metricTone(handoff.linked, handoff.total) },
    {
      label: "Fichas PDF",
      value: handoff.pdf ? coverageLabel(handoff.pdf, handoff.total, "fichas") : handoff.linked ? "por generar" : "pendiente",
      tone: handoff.pdf ? metricTone(handoff.pdf, handoff.total) : handoff.linked ? "current" : "warning",
    },
    { label: "Aplicadas", value: coverageLabel(applied, totalAulas), tone: metricTone(applied, totalAulas) },
    { label: "Brechas", value: fmt(dashboard?.kpis.brechas), tone: dashboard?.kpis.brechas ? "warning" : "ready" },
  ];
}

function HandoffTracePanel({ dashboard }: { dashboard: MonitoreoAulasDashboard | null }) {
  const handoff = handoffSummary(dashboard);
  const cards = [
    {
      label: "Plan de muestra",
      value: dashboard?.selection_run_id ? "importado" : "pendiente",
      detail: `${fmt(handoff.total)} aulas de la selección del cálculo de muestra`,
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
        <h3>Aplicación en aulas</h3>
        <span>muestra, fichas QR y monitoreo</span>
      </div>
      <div className="mon-aulas-handoff-grid">
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
      <div className="mon-profile-stack">
        <HandoffTracePanel dashboard={dashboard} />
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Agenda de aulas</h3>
            <span>{fmt(dashboard.agenda?.length ?? 0)} aulas</span>
          </div>
          <DataTable
            rows={agendaRows(dashboard)}
            empty="No hay agenda importada para aulas."
            preferredColumns={["operational_code", "label", "course_name", "section", "schedule", "link", "package_status", "responsible", "collector_id"]}
          />
        </section>
      </div>
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
      ...((dashboard.course_status ?? []) as Array<Record<string, unknown>>),
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
  const quotaRows = (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>;
  const avanceRows = (quotaRows.length ? quotaRows : dashboard.avance_por_estrato ?? []) as Array<Record<string, unknown>>;
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row">
        <StatTile label="Aulas" value={fmt(dashboard.kpis.total_aulas)} />
        <StatTile label="Aplicadas" value={fmt(dashboard.kpis.aulas_aplicadas)} tone="good" />
        <StatTile label="Validas" value={fmt(dashboard.kpis.respuestas_validas)} tone="good" />
        <StatTile label="Cuotas sexo/facultad" value={fmt(dashboard.kpis.quota_cells_ok ?? 0) + "/" + fmt(dashboard.kpis.quota_cells ?? quotaRows.length)} tone={(dashboard.kpis.quota_cells_pending ?? 0) ? "warn" : "good"} />
        <StatTile label="Brechas" value={fmt(dashboard.kpis.brechas)} tone={dashboard.kpis.brechas ? "warn" : "good"} />
      </div>
      <section className="mon-profile-panel">
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
    <div className="mon-profile-page is-aulas-flow" style={MODULE_TONES.monitoreo as CSSProperties}>
      <header className="mon-profile-topbar">
        <div className="mon-profile-brand">
          <span className="mon-profile-brand__icon"><CalendarRange size={18} /></span>
          <div>
            <strong>Aplicación en aulas</strong>
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
          <Link to="/recopiladores">
            <QrCode size={14} />
            Fichas QR
          </Link>
          <button type="button" onClick={() => void loadView(activeView, true)}>
            <RefreshCw size={14} />
            Actualizar vista
          </button>
        </div>
      </header>

      <main className="mon-profile-workbench">
        <aside className="mon-profile-sidebar">
          <div className="mon-profile-context">
            <span>SECCIÓN ACTIVA</span>
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
              <span>Hostigamiento en aulas · flujo actual</span>
              <h2>{activeDef.label}</h2>
              <p>{activeDef.desc}</p>
            </div>
            <div className="mon-profile-kpis">
              <StatTile label="Aulas" value={fmt(dashboard?.kpis.total_aulas)} />
              <StatTile label="Aplicadas" value={fmt(dashboard?.kpis.aulas_aplicadas)} tone="good" />
              <StatTile label="Representatividad" value={pct(dashboard?.kpis.representativity_effective_score)} />
            </div>
          </div>
          <AulasApplicationFlow
            tone="monitoreo"
            current="monitoreo"
            compact
            title="Seguimiento del estudio de hostigamiento en aulas"
            summary="Este monitoreo lee el plan del cálculo de muestra de aulas y los enlaces QR/PDF del estudio de hostigamiento para medir avance, caídas, reemplazos y brechas sin rediseñar la muestra."
            metrics={aulasFlowMetrics(dashboard)}
            secondaryAction={{ to: AULAS_SAMPLE_ROUTE, label: "Ver muestra de aulas" }}
            action={{ to: "/recopiladores", label: "Abrir fichas QR" }}
          />
          {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
          {loading ? <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." /> : renderAulasView(activeView, dashboard)}
        </section>
      </main>
    </div>
  );
}

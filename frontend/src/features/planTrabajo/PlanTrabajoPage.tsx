import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  apiPlanTrabajoExport,
  apiPlanTrabajoImport,
  apiPlanTrabajoReset,
  apiPlanTrabajoState,
  apiPlanTrabajoTaskUpdate,
  apiUpload,
  type PlanTrabajoState,
  type PlanTrabajoTask,
  type PlanTrabajoTaskPatch,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { moduleChromeVars, PROSECNUR_MODULES } from "../../lib/modules";
import "./planTrabajo.css";

const PLAN_MODULE = PROSECNUR_MODULES.find((module) => module.slug === "plan-trabajo") ?? PROSECNUR_MODULES[0];
const CRONOGRAMA_TITLE = "Cronograma del proyecto";
const DAY_MS = 24 * 60 * 60 * 1000;

function fmt(value: number | null | undefined) {
  return Intl.NumberFormat("es-PE").format(Number(value ?? 0));
}

function dateValue(value: string) {
  if (!value) return null;
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function dateLabel(task: PlanTrabajoTask) {
  if (task.start_date && task.end_date) {
    if (task.start_date === task.end_date) return task.start_date;
    return `${task.start_date} - ${task.end_date}`;
  }
  if (task.start_day_index && task.end_day_index) {
    if (task.start_day_index === task.end_day_index) return `Dia ${task.start_day_index}`;
    return `Dias ${task.start_day_index}-${task.end_day_index}`;
  }
  return "Sin fecha";
}

function statusLabel(status: string) {
  if (status === "planned") return "Planificado";
  if (status === "active") return "En curso";
  if (status === "done") return "Cumplido";
  if (status === "blocked") return "Bloqueado";
  if (status === "risk") return "Riesgo";
  return status || "Planificado";
}

function kindLabel(kind: string) {
  if (kind === "fieldwork_window") return "Campo";
  if (kind === "milestone") return "Hito";
  if (kind === "deliverable") return "Entrega";
  return "Actividad";
}

function moduleLabel(moduleId: string) {
  const labels: Record<string, string> = {
    monitoreo: "Monitoreo",
    reportes: "Reportes",
    carga: "Carga",
    "calc-muestra": "Muestra",
    "editor-xlsform": "Formulario",
    validacion: "Validacion",
    "plan-trabajo": "Cronograma",
  };
  return labels[moduleId] ?? moduleId;
}

function taskScale(tasks: PlanTrabajoTask[]) {
  const dated = tasks.some((task) => dateValue(task.start_date) != null && dateValue(task.end_date) != null);
  const values = tasks.flatMap((task) => {
    if (dated) {
      const start = dateValue(task.start_date);
      const end = dateValue(task.end_date);
      return start != null && end != null ? [start, end] : [];
    }
    return [
      Number(task.start_day_index || 0),
      Number(task.end_day_index || task.start_day_index || 0),
    ].filter((value) => Number.isFinite(value) && value > 0);
  });
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  return { dated, min, max, unit: dated ? DAY_MS : 1 };
}

function barStyle(task: PlanTrabajoTask, scale: ReturnType<typeof taskScale>): CSSProperties {
  const start = scale.dated ? dateValue(task.start_date) : Number(task.start_day_index || 0);
  const end = scale.dated ? dateValue(task.end_date) : Number(task.end_day_index || task.start_day_index || 0);
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return { left: "0%", width: "8%" };
  }
  const span = Math.max(scale.max - scale.min + scale.unit, scale.unit);
  const left = Math.max(0, ((start - scale.min) / span) * 100);
  const width = Math.max(4, ((end - start + scale.unit) / span) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

function emptyDraft(task: PlanTrabajoTask | null): PlanTrabajoTaskPatch {
  return {
    activity: task?.activity ?? "",
    responsible: task?.responsible ?? "",
    product: task?.product ?? "",
    phase: task?.phase ?? "",
    start_date: task?.start_date ?? "",
    end_date: task?.end_date ?? "",
    status: task?.status ?? "planned",
    notes: task?.notes ?? "",
  };
}

export default function PlanTrabajoPage() {
  const [state, setState] = useState<PlanTrabajoState | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PlanTrabajoTaskPatch>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExportUrl, setLastExportUrl] = useState("");

  const tasks = state?.plan.tasks ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;
  const scale = useMemo(() => taskScale(tasks), [tasks]);
  const readinessMetrics = [
    { label: "Actividades", value: fmt(state?.readiness.task_count) },
    { label: "Hitos", value: fmt(state?.readiness.milestone_count) },
    { label: "Ventanas", value: fmt(state?.readiness.window_count) },
    { label: "Consistencia", value: `${state?.readiness.score ?? 0}%` },
  ];

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const next = await apiPlanTrabajoState();
      setState(next);
      if (!selectedId && next.plan.tasks[0]) setSelectedId(next.plan.tasks[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el cronograma del proyecto.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDraft(emptyDraft(selectedTask));
  }, [selectedTask?.id]);

  async function importFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const meta = await apiUpload(file, "plan_trabajo");
      const next = await apiPlanTrabajoImport(meta.file_id);
      setState(next);
      setSelectedId(next.plan.tasks[0]?.id ?? "");
      setLastExportUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el cronograma.");
    } finally {
      setUploading(false);
    }
  }

  async function saveTask() {
    if (!selectedTask) return;
    setSaving(true);
    setError(null);
    try {
      setState(await apiPlanTrabajoTaskUpdate(selectedTask.id, draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la actividad.");
    } finally {
      setSaving(false);
    }
  }

  async function exportPlan() {
    setExporting(true);
    setError(null);
    try {
      const result = await apiPlanTrabajoExport();
      setLastExportUrl(result.download_url);
      window.open(result.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el cronograma.");
    } finally {
      setExporting(false);
    }
  }

  async function resetPlan() {
    setSaving(true);
    setError(null);
    try {
      const next = await apiPlanTrabajoReset();
      setState(next);
      setSelectedId("");
      setLastExportUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo limpiar el cronograma.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !state) {
    return <LoadingBlock label="Abriendo cronograma del proyecto..." />;
  }

  return (
    <PageFrame
      title={CRONOGRAMA_TITLE}
      headerMode="sr-only"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      className="plan-frame"
    >
      <div className="plan-shell" style={moduleChromeVars(PLAN_MODULE)}>
        <div className="plan-commandbar" aria-label="Contexto operativo del cronograma">
          <div className="plan-commandbar-main plan-command-side" aria-label="Cronograma activo">
            <span className="plan-module-mark" aria-hidden="true">
              <CalendarRange size={17} />
            </span>
            <div>
              <strong>{state?.plan.title || CRONOGRAMA_TITLE}</strong>
              <span>{state?.plan.source?.original_name || "Cronograma local"}</span>
            </div>
          </div>

          <div className="plan-command-metrics plan-command-side" aria-label="Resumen del cronograma">
            {readinessMetrics.map((metric) => (
              <span key={metric.label} className="plan-command-token">
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </span>
            ))}
          </div>

          <div className="plan-commandbar-actions plan-command-side" aria-label="Acciones del cronograma">
            <label className="plan-button plan-button--primary">
              {uploading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
              <span>Importar</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void importFile(file);
                }}
              />
            </label>
            <button type="button" className="plan-button" onClick={exportPlan} disabled={!tasks.length || exporting}>
              {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
              <span>Exportar</span>
            </button>
            <button type="button" className="plan-icon-button" onClick={load} title="Actualizar" aria-label="Actualizar cronograma">
              {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            </button>
            <button type="button" className="plan-icon-button" onClick={resetPlan} disabled={!tasks.length || saving} title="Limpiar cronograma" aria-label="Limpiar cronograma">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        {!tasks.length ? (
          <div className="plan-empty">
            <FileSpreadsheet size={36} />
            <strong>Sin cronograma importado</strong>
            <label className="plan-button plan-button--primary">
              {uploading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
              <span>Importar Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void importFile(file);
                }}
              />
            </label>
          </div>
        ) : (
          <div className="plan-workbench">
            <aside className="plan-sidebar is-collapsible" aria-label="Hitos y sincronización del cronograma">
              <section className="plan-panel plan-rail-panel">
                <div className="plan-panel-head">
                  <strong>Hitos</strong>
                  <span>{fmt(state?.plan.milestones.length)}</span>
                </div>
                <div className="plan-milestone-list">
                  {(state?.plan.milestones ?? []).slice(0, 8).map((task, index) => (
                    <button
                      type="button"
                      key={task.id}
                      className={`plan-rail-item${task.id === selectedTask?.id ? " is-active" : ""}`}
                      aria-current={task.id === selectedTask?.id ? "page" : undefined}
                      aria-label={`${task.activity}. ${kindLabel(task.kind)}, ${dateLabel(task)}`}
                      data-rail-tip={`${task.activity} · ${kindLabel(task.kind)} · ${dateLabel(task)}`}
                      title={`${task.activity}: ${dateLabel(task)}`}
                      onClick={() => setSelectedId(task.id)}
                    >
                      <span className="plan-rail-glyph" aria-hidden="true">{index + 1}</span>
                      <span className="plan-rail-copy">
                        <span>{kindLabel(task.kind)}</span>
                        <strong>{task.activity}</strong>
                        <small>{dateLabel(task)}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="plan-panel plan-rail-panel">
                <div className="plan-panel-head">
                  <strong>Sincronización</strong>
                  <span>{fmt(state?.sync.length)}</span>
                </div>
                <div className="plan-sync-list">
                  {(state?.sync ?? []).map((item) => (
                    <div
                      key={item.module_id}
                      className={`plan-sync-card plan-rail-item is-${item.evidence_state}`}
                      aria-label={`${moduleLabel(item.module_id)}. ${item.task_count} actividades. ${item.start_date || "sin fecha"} a ${item.end_date || "sin fecha"}`}
                      data-rail-tip={`${moduleLabel(item.module_id)} · ${item.task_count} actividad(es) · ${item.start_date || "s/f"}-${item.end_date || "s/f"}`}
                      title={`${moduleLabel(item.module_id)}: ${item.task_count} actividad(es)`}
                    >
                      <span className="plan-rail-glyph" aria-hidden="true">{moduleLabel(item.module_id).slice(0, 2)}</span>
                      <div className="plan-rail-copy">
                        <strong>{moduleLabel(item.module_id)}</strong>
                        <span>{item.task_count} actividad(es)</span>
                      </div>
                      <small>{item.start_date || "s/f"} - {item.end_date || "s/f"}</small>
                    </div>
                  ))}
                </div>
              </section>
            </aside>

            <section className="plan-timeline-panel">
              <div className="plan-panel-head">
                <strong>Gantt operativo</strong>
                <span>{scale.dated ? "Fechas calendario" : "Días relativos"}</span>
              </div>
              <div className="plan-timeline">
                {tasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`plan-timeline-row is-${task.status}${task.id === selectedTask?.id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(task.id)}
                  >
                    <span className="plan-task-label">
                      <strong>{task.activity}</strong>
                      <small>{task.responsible || task.phase || "Sin responsable"}</small>
                    </span>
                    <span className="plan-lane">
                      <i style={barStyle(task, scale)} />
                    </span>
                    <span className="plan-task-date">{dateLabel(task)}</span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="plan-inspector">
              <div className="plan-panel-head">
                <strong>Actividad</strong>
                <span>{selectedTask ? statusLabel(selectedTask.status) : ""}</span>
              </div>
              {selectedTask && (
                <div className="plan-form">
                  <label>
                    <span>Actividad</span>
                    <input value={draft.activity ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, activity: event.target.value }))} />
                  </label>
                  <label>
                    <span>Responsable</span>
                    <input value={draft.responsible ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, responsible: event.target.value }))} />
                  </label>
                  <label>
                    <span>Producto</span>
                    <textarea value={draft.product ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, product: event.target.value }))} />
                  </label>
                  <div className="plan-form-grid">
                    <label>
                      <span>Inicio</span>
                      <input type="date" value={draft.start_date ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, start_date: event.target.value }))} />
                    </label>
                    <label>
                      <span>Fin</span>
                      <input type="date" value={draft.end_date ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, end_date: event.target.value }))} />
                    </label>
                  </div>
                  <label>
                    <span>Estado</span>
                    <select value={draft.status ?? "planned"} onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}>
                      <option value="planned">Planificado</option>
                      <option value="active">En curso</option>
                      <option value="done">Cumplido</option>
                      <option value="risk">Riesgo</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </label>
                  <label>
                    <span>Notas</span>
                    <textarea value={draft.notes ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
                  </label>
                  <button type="button" className="plan-button plan-button--primary" onClick={saveTask} disabled={saving}>
                    {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    <span>Guardar</span>
                  </button>
                </div>
              )}
              {lastExportUrl && (
                <a className="plan-export-link" href={lastExportUrl} download>
                  <Download size={14} />
                  <span>Descargar XLSX</span>
                </a>
              )}
            </aside>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  apiPlanTrabajoExport,
  apiPlanTrabajoImport,
  apiPlanTrabajoReset,
  apiPlanTrabajoTaskCreate,
  apiPlanTrabajoTaskDelete,
  apiPlanTrabajoTaskUpdate,
  apiUpload,
  type PlanTrabajoState,
  type PlanTrabajoTask,
  type PlanTrabajoTaskPatch,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import {
  barStyle,
  kindLabel,
  planModuleLabel,
  statusLabel,
  taskDateLabel,
  taskScale,
  toISODate,
} from "./dateUtils";

function fmt(value: number | null | undefined) {
  return Intl.NumberFormat("es-PE").format(Number(value ?? 0));
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

export function CronogramaSection({
  state,
  onChange,
  onReload,
}: {
  state: PlanTrabajoState;
  onChange: (next: PlanTrabajoState) => void;
  onReload: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PlanTrabajoTaskPatch>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExportUrl, setLastExportUrl] = useState("");

  const tasks = state.plan.tasks ?? [];
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;
  const scale = useMemo(() => taskScale(tasks), [tasks]);
  const readinessMetrics = [
    { label: "Actividades", value: fmt(state.readiness.task_count) },
    { label: "Hitos", value: fmt(state.readiness.milestone_count) },
    { label: "Ventanas", value: fmt(state.readiness.window_count) },
    { label: "Consistencia", value: `${state.readiness.score ?? 0}%` },
  ];

  useEffect(() => {
    setDraft(emptyDraft(selectedTask));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.id]);

  async function importFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const meta = await apiUpload(file, "plan_trabajo");
      const next = await apiPlanTrabajoImport(meta.file_id);
      onChange(next);
      setSelectedId(next.plan.tasks[0]?.id ?? "");
      setLastExportUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar el cronograma.");
    } finally {
      setUploading(false);
    }
  }

  async function createTask() {
    setSaving(true);
    setError(null);
    try {
      const today = toISODate(new Date());
      const next = await apiPlanTrabajoTaskCreate({
        activity: "Nueva actividad",
        start_date: today,
        end_date: today,
      });
      onChange(next);
      const created = next.plan.tasks[next.plan.tasks.length - 1];
      if (created) setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la actividad.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTask() {
    if (!selectedTask) return;
    setSaving(true);
    setError(null);
    try {
      onChange(await apiPlanTrabajoTaskUpdate(selectedTask.id, draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la actividad.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!selectedTask) return;
    setSaving(true);
    setError(null);
    try {
      const next = await apiPlanTrabajoTaskDelete(selectedTask.id);
      onChange(next);
      setSelectedId(next.plan.tasks[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la actividad.");
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
      onChange(next);
      setSelectedId("");
      setLastExportUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo limpiar el cronograma.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="plan-shell plan-shell--embedded">
      <div className="pulso-command-bar plan-commandbar" aria-label="Acciones del cronograma">
        <div className="plan-command-metrics plan-command-side" aria-label="Resumen del cronograma">
          {readinessMetrics.map((metric) => (
            <span key={metric.label} className="plan-command-token">
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </div>

        <div className="plan-commandbar-actions plan-command-side" aria-label="Acciones del cronograma">
          <button type="button" className="plan-button plan-button--primary" onClick={createTask} disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            <span>Nueva actividad</span>
          </button>
          <label className="plan-button">
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
          <button type="button" className="plan-icon-button" onClick={onReload} title="Actualizar" aria-label="Actualizar cronograma">
            <RefreshCw size={15} />
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
          <strong>Sin cronograma todavía</strong>
          <p>Crea actividades a mano o importa un cronograma Excel con grilla de días.</p>
          <div className="plan-empty-actions">
            <button type="button" className="plan-button plan-button--primary" onClick={createTask} disabled={saving}>
              {saving ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
              <span>Nueva actividad</span>
            </button>
            <label className="plan-button">
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
        </div>
      ) : (
        <div className="plan-workbench">
          <aside className="plan-sidebar is-collapsible" aria-label="Hitos y sincronización del cronograma">
            <section className="plan-panel plan-rail-panel">
              <div className="plan-panel-head">
                <strong>Hitos</strong>
                <span>{fmt(state.plan.milestones.length)}</span>
              </div>
              <div className="plan-milestone-list">
                {(state.plan.milestones ?? []).slice(0, 8).map((task, index) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`plan-rail-item${task.id === selectedTask?.id ? " is-active" : ""}`}
                    aria-current={task.id === selectedTask?.id ? "page" : undefined}
                    title={`${task.activity}: ${taskDateLabel(task)}`}
                    onClick={() => setSelectedId(task.id)}
                  >
                    <span className="plan-rail-glyph" aria-hidden="true">{index + 1}</span>
                    <span className="plan-rail-copy">
                      <span>{kindLabel(task.kind)}</span>
                      <strong>{task.activity}</strong>
                      <small>{taskDateLabel(task)}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="plan-panel plan-rail-panel">
              <div className="plan-panel-head">
                <strong>Sincronización</strong>
                <span>{fmt(state.sync.length)}</span>
              </div>
              <div className="plan-sync-list">
                {(state.sync ?? []).map((item) => (
                  <div
                    key={item.module_id}
                    className={`plan-sync-card plan-rail-item is-${item.evidence_state}`}
                    title={`${planModuleLabel(item.module_id)}: ${item.task_count} actividad(es)`}
                  >
                    <span className="plan-rail-glyph" aria-hidden="true">{planModuleLabel(item.module_id).slice(0, 2)}</span>
                    <div className="plan-rail-copy">
                      <strong>{planModuleLabel(item.module_id)}</strong>
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
                  <span className="plan-task-date">{taskDateLabel(task)}</span>
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
                <div className="plan-inspector-actions">
                  <button type="button" className="plan-button plan-button--primary" onClick={saveTask} disabled={saving}>
                    {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    <span>Guardar</span>
                  </button>
                  <button type="button" className="plan-icon-button" onClick={deleteTask} disabled={saving} title="Eliminar actividad" aria-label="Eliminar actividad">
                    <Trash2 size={15} />
                  </button>
                </div>
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
  );
}

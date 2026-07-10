import type { CSSProperties } from "react";
import type { PlanTrabajoTask } from "../../api/client";

export const DAY_MS = 24 * 60 * 60 * 1000;

// Parsear fechas date-only como medianoche LOCAL (`...T00:00:00`) evita el
// drift de zona horaria que produce `new Date("YYYY-MM-DD")` (parseado en UTC).
export function dateValue(value: string): number | null {
  if (!value) return null;
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function parseLocalDate(value: string): Date | null {
  const ms = dateValue(value);
  return ms == null ? null : new Date(ms);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function taskDateLabel(task: PlanTrabajoTask): string {
  if (task.start_date && task.end_date) {
    if (task.start_date === task.end_date) return task.start_date;
    return `${task.start_date} - ${task.end_date}`;
  }
  if (task.start_day_index && task.end_day_index) {
    if (task.start_day_index === task.end_day_index) return `Día ${task.start_day_index}`;
    return `Días ${task.start_day_index}-${task.end_day_index}`;
  }
  return "Sin fecha";
}

export type TaskScale = { dated: boolean; min: number; max: number; unit: number };

export function taskScale(tasks: PlanTrabajoTask[]): TaskScale {
  const dated = tasks.some(
    (task) => dateValue(task.start_date) != null && dateValue(task.end_date) != null,
  );
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

export function barStyle(task: PlanTrabajoTask, scale: TaskScale): CSSProperties {
  const start = scale.dated ? dateValue(task.start_date) : Number(task.start_day_index || 0);
  const end = scale.dated
    ? dateValue(task.end_date)
    : Number(task.end_day_index || task.start_day_index || 0);
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return { left: "0%", width: "8%" };
  }
  const span = Math.max(scale.max - scale.min + scale.unit, scale.unit);
  const left = Math.max(0, ((start - scale.min) / span) * 100);
  const width = Math.max(4, ((end - start + scale.unit) / span) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

// --- Horas (para la vista semana time-slotted) -----------------------------
export function parseTimeMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function taskHasTime(task: { start_time?: string }): boolean {
  return parseTimeMinutes(task.start_time) != null;
}

export function statusLabel(status: string): string {
  if (status === "planned") return "Planificado";
  if (status === "active") return "En curso";
  if (status === "done") return "Cumplido";
  if (status === "blocked") return "Bloqueado";
  if (status === "risk") return "Riesgo";
  return status || "Planificado";
}

export function kindLabel(kind: string): string {
  if (kind === "fieldwork_window") return "Campo";
  if (kind === "milestone") return "Hito";
  if (kind === "deliverable") return "Entrega";
  return "Actividad";
}

export function planModuleLabel(moduleId: string): string {
  const labels: Record<string, string> = {
    monitoreo: "Monitoreo",
    reportes: "Reportes",
    carga: "Carga",
    "calc-muestra": "Muestra",
    "editor-xlsform": "Formulario",
    validacion: "Validación",
    "plan-trabajo": "Cronograma",
  };
  return labels[moduleId] ?? moduleId;
}

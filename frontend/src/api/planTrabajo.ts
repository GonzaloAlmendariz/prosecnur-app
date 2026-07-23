// planTrabajo.ts — plan de trabajo / bitácora.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, downloadUrl, handle, headers } from "./core";

// ============================================================================
// Plan de trabajo
// ============================================================================

export type PlanTrabajoTaskStatus = "planned" | "active" | "done" | "blocked" | "risk" | string;
export type PlanTrabajoTaskKind = "activity" | "milestone" | "deliverable" | "fieldwork_window" | string;

export type PlanTrabajoSource = {
  file_id: string;
  original_name: string;
  uploaded_at: string;
  sheets: string[];
} | null;

export type PlanTrabajoTask = {
  id: string;
  sheet: string;
  row: number;
  phase: string;
  activity: string;
  responsible: string;
  product: string;
  status: PlanTrabajoTaskStatus;
  kind: PlanTrabajoTaskKind;
  start_date: string;
  end_date: string;
  /** Hora "HH:MM" opcional; "" o ausente = evento de todo el día. */
  start_time?: string;
  end_time?: string;
  start_day_index: number;
  end_day_index: number;
  duration_days: number;
  grid_start_col: number;
  grid_end_col: number;
  sync_targets: string[];
  notes: string;
};

export type PlanTrabajoWindow = {
  module_id: string;
  task_count: number;
  start_date: string;
  end_date: string;
  activities: string[];
};

export type PlanTrabajoSyncWindow = PlanTrabajoWindow & {
  evidence_state: "planned_only" | "evidence_available" | string;
  direction: "sync" | string;
};

export type PlanTrabajoPlan = {
  ok: true;
  schema: "plan_trabajo_v1" | string;
  title: string;
  source: PlanTrabajoSource;
  updated_at: string;
  tasks: PlanTrabajoTask[];
  phases: string[];
  milestones: PlanTrabajoTask[];
  windows: PlanTrabajoWindow[];
  warnings: string[];
};

export type PlanTrabajoState = {
  ok: true;
  schema: "plan_trabajo_state_v1" | string;
  generated_at: string;
  plan: PlanTrabajoPlan;
  readiness: {
    score: number;
    task_count: number;
    milestone_count: number;
    window_count: number;
  };
  sync: PlanTrabajoSyncWindow[];
};

export type PlanTrabajoExport = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  ext: string;
  download_url: string;
};

export type PlanTrabajoTaskPatch = Partial<Pick<
  PlanTrabajoTask,
  "activity" | "responsible" | "product" | "phase" | "start_date" | "end_date" | "start_time" | "end_time" | "status" | "notes"
>>;

export type PlanTrabajoTaskCreateInput = PlanTrabajoTaskPatch & {
  activity: string;
  kind?: PlanTrabajoTaskKind;
};

export async function apiPlanTrabajoState() {
  return handle<PlanTrabajoState>(
    await apiFetch("/api/plan-trabajo/state", { headers: headers() }),
  );
}

export async function apiPlanTrabajoTaskCreate(task: PlanTrabajoTaskCreateInput) {
  return handle<PlanTrabajoState>(
    await apiFetch("/api/plan-trabajo/tasks", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ task }),
    }),
  );
}

export async function apiPlanTrabajoTaskDelete(id: string) {
  return handle<PlanTrabajoState>(
    await apiFetch(`/api/plan-trabajo/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

export async function apiPlanTrabajoImport(fileId: string) {
  return handle<PlanTrabajoState>(
    await apiFetch("/api/plan-trabajo/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: fileId }),
    }),
  );
}

export async function apiPlanTrabajoTaskUpdate(id: string, task: PlanTrabajoTaskPatch) {
  return handle<PlanTrabajoState>(
    await apiFetch(`/api/plan-trabajo/tasks/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ task }),
    }),
  );
}

export async function apiPlanTrabajoExport() {
  const result = await handle<Omit<PlanTrabajoExport, "download_url">>(
    await apiFetch("/api/plan-trabajo/export", {
      method: "POST",
      headers: headers(),
    }),
  );
  return { ...result, download_url: downloadUrl(result.file_id) };
}

export async function apiPlanTrabajoReset() {
  return handle<PlanTrabajoState>(
    await apiFetch("/api/plan-trabajo", {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

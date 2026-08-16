// disenoEstudio.ts — diseño del estudio.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, handle, headers } from "./core";
import type { BitacoraVinculo } from "./planTrabajo";

// ============================================================================
// Diseño del estudio
// ============================================================================

export type DisenoEstudioSourceState = "ready" | "active" | "pending" | "warning";
export type DisenoEstudioBitacoraTone = "nota" | "decision" | "riesgo" | "bloqueo" | "avance";

export type DisenoEstudioProtocol = {
  title: string;
  client: string;
  client_type: string;
  description: string;
  processing_mode: string;
  active_base: string;
  bases_count: number;
  instruments_count: number;
  records_count: number;
  variables_count: number;
  sample_components_count: number;
  sample_target_n: number;
  sample_operational_n: number;
  classroom_units_count: number;
  route_phase: string;
  route_outputs_count: number;
  workplan_title: string;
  workplan_tasks_count: number;
  workplan_milestones_count: number;
  workplan_windows_count: number;
  monitoring_family: string;
  monitoring_sources_count: number;
  project_file: string;
};

export type DisenoEstudioSource = {
  id: string;
  label: string;
  route: string;
  state: DisenoEstudioSourceState;
  summary: string;
  evidence: string[];
  owner: string;
  category: string;
};

export type DisenoEstudioRisk = {
  title: string;
  detail: string;
  route: string;
  severity: "ready" | "warning" | "danger" | string;
};

export type DisenoEstudioNextAction = {
  label: string;
  route: string;
  reason: string;
  state: DisenoEstudioSourceState;
};

/** Una edición conservada: la bitácora es un registro, no un borrador. */
export type DisenoEstudioBitacoraRevision = {
  revised_at: string;
  title: string;
  body: string;
  tone: string;
  module_id: string;
};

export type DisenoEstudioBitacoraEntry = {
  id: string;
  module_id: string;
  tone: DisenoEstudioBitacoraTone;
  title: string;
  body: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  tags: string[];

  // ---- ADR 0047 ------------------------------------------------------------
  // Opcionales porque un payload de un backend anterior no los trae.
  /** Más reciente primero. Editar empuja la versión anterior acá. */
  revisions?: DisenoEstudioBitacoraRevision[];
  /** Las entradas se archivan; el borrado permanente es explícito. */
  archived_at?: string;
  links?: BitacoraVinculo[];
};

export type DisenoEstudioBitacoraInput = {
  id?: string;
  module_id?: string;
  tone?: DisenoEstudioBitacoraTone;
  title: string;
  body: string;
  occurred_at?: string;
  tags?: string[];
  links?: BitacoraVinculo[];
};

// El ADR 0027 modelaba el estudio como un «expediente»; el ADR 0029 lo
// reemplazó por el módulo Bitácora. El 2026-08-16 se retiró lo que quedaba de
// esa superficie: `apiDisenoEstudioState`, `...BitacoraUpsert` y
// `...BitacoraDelete` —cero consumidores— junto con sus tres endpoints y los
// cuatro tipos que sólo describían ese payload. Los que quedan arriba siguen
// usándose desde el módulo Bitácora y desde el overview del Home.

// ---- Bitácora (alias canónico, payload liviano solo-entradas) --------------
export type BitacoraStateResponse = {
  ok: true;
  schema: "bitacora_v1" | string;
  generated_at: string;
  bitacora: DisenoEstudioBitacoraEntry[];
};

export async function apiBitacoraState() {
  return handle<BitacoraStateResponse>(
    await apiFetch("/api/bitacora", { headers: headers() }),
  );
}

export async function apiBitacoraUpsert(entry: DisenoEstudioBitacoraInput) {
  return handle<BitacoraStateResponse>(
    await apiFetch("/api/bitacora", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ entry }),
    }),
  );
}

export async function apiBitacoraDelete(id: string) {
  return handle<BitacoraStateResponse>(
    await apiFetch(`/api/bitacora/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

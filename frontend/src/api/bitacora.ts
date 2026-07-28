// bitacora.ts — subsistema Bitácora (ADR 0047).
//
// Endpoint consolidado: las cuatro secciones se hidratan con un solo viaje.
// `/api/plan-trabajo/*` y `/api/bitacora` siguen existiendo con su contrato
// intacto; lo de acá es aditivo.

import { apiFetch, handle, headers } from "./core";
import type { DisenoEstudioBitacoraEntry } from "./disenoEstudio";
import type {
  BitacoraRecordatorio,
  BitacoraRecurrencia,
  BitacoraVinculo,
  PlanTrabajoPlan,
  PlanTrabajoPrioridad,
  PlanTrabajoTaskKind,
  PlanTrabajoTaskStatus,
} from "./planTrabajo";

/** Las seis fases del estudio. El usuario elige de acá; no se escribe texto. */
export const BITACORA_FASES = [
  "diseno",
  "muestra",
  "instrumento",
  "campo",
  "procesamiento",
  "entregables",
] as const;

export type BitacoraFase = (typeof BITACORA_FASES)[number];

export type BitacoraFaseCatalogo = {
  id: BitacoraFase;
  label: string;
  /** Módulos que la fase cubre; sostienen el contraste con evidencia real. */
  modulos: string[];
};

export type BitacoraFaseVista = BitacoraFaseCatalogo & {
  task_count: number;
  /** El usuario declaró esta fase, en vez de que se derivara de una actividad. */
  declarada: boolean;
  start_date: string;
  end_date: string;
  evidence_state: "planned_only" | "evidence_available" | string;
  task_ids: string[];
};

export type BitacoraPreferencias = {
  schema: "bitacora_prefs_v1" | string;
  cronograma: {
    vista: "fases" | "gantt" | "lista" | string;
    estados: string[];
    prioridades: string[];
    fases: string[];
    etiquetas: string[];
    desde: string;
    hasta: string;
    texto: string;
    mostrar_archivadas: boolean;
  };
  bitacora: {
    tonos: string[];
    modulos: string[];
    etiquetas: string[];
    texto: string;
    mostrar_archivadas: boolean;
  };
  canvas: { snap: boolean; grid: number; guias: boolean };
};

export type BitacoraEstado = {
  ok: true;
  schema: "bitacora_estado_v1" | string;
  generated_at: string;
  /** Fecha del reloj del servidor: permite detectar un desfase con el cliente. */
  hoy_servidor: string;
  plan: PlanTrabajoPlan;
  fases: BitacoraFaseVista[];
  catalogo_fases: BitacoraFaseCatalogo[];
  bitacora: DisenoEstudioBitacoraEntry[];
  preferencias: BitacoraPreferencias;
  contadores: { tareas: number; archivadas: number; entradas: number };
};

/** Lo que el compositor manda al crear o editar una fila del cronograma. */
export type BitacoraTareaInput = {
  activity?: string;
  fase?: BitacoraFase;
  kind?: PlanTrabajoTaskKind;
  status?: PlanTrabajoTaskStatus;
  responsible?: string;
  product?: string;
  phase?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  priority?: PlanTrabajoPrioridad;
  tags?: string[];
  blocked_by?: string[];
  reminders?: BitacoraRecordatorio[];
  links?: BitacoraVinculo[];
  recurrence?: BitacoraRecurrencia | null;
};

export async function apiBitacoraEstado() {
  return handle<BitacoraEstado>(
    await apiFetch("/api/bitacora/estado", { headers: headers() }),
  );
}

export async function apiBitacoraSembrarFases(fases?: BitacoraFase[]) {
  return handle<BitacoraEstado>(
    await apiFetch("/api/bitacora/cronograma/sembrar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ fases }),
    }),
  );
}

export async function apiBitacoraTareaCrear(tarea: BitacoraTareaInput) {
  return handle<BitacoraEstado>(
    await apiFetch("/api/bitacora/cronograma/tareas", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tarea }),
    }),
  );
}

export async function apiBitacoraTareaEditar(id: string, tarea: BitacoraTareaInput) {
  return handle<BitacoraEstado>(
    await apiFetch(`/api/bitacora/cronograma/tareas/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tarea }),
    }),
  );
}

export async function apiBitacoraTareaArchivar(id: string, archivar = true) {
  return handle<BitacoraEstado>(
    await apiFetch(`/api/bitacora/cronograma/tareas/${encodeURIComponent(id)}/archivar`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ archivar }),
    }),
  );
}

export async function apiBitacoraTareaDuplicar(id: string) {
  return handle<BitacoraEstado>(
    await apiFetch(`/api/bitacora/cronograma/tareas/${encodeURIComponent(id)}/duplicar`, {
      method: "POST",
      headers: headers(),
    }),
  );
}

/** Borrado permanente. La ruta normal es archivar; esto exige confirmación. */
export async function apiBitacoraTareaBorrar(id: string) {
  return handle<BitacoraEstado>(
    await apiFetch(`/api/bitacora/cronograma/tareas/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

/** Parche por sección: manda solo la que cambió y el resto se conserva. */
export async function apiBitacoraPreferencias(
  preferencias: Partial<BitacoraPreferencias>,
) {
  return handle<BitacoraEstado>(
    await apiFetch("/api/bitacora/preferencias", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ preferencias }),
    }),
  );
}

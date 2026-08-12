// validacion.ts — validación v2 scopeada por base (limpieza, instrumento, explorar, reglas).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import type { ExploradorVariablesList, InstrumentoEstado, InstrumentoOperationalConfig, InstrumentoVariablesExcluidas, LimpiezaBeforeAfterPreview, LimpiezaDecision, LimpiezaSummary, ReglaCustom, ReglaSemilla, ReglasCustomList, ViewDescriptor } from "../features/validacion/types";
import { apiFetch, handle, headers } from "./core";

// =============================================================================
// Fase 2 v2 — Validación (scoped por base)
// =============================================================================
// Todas las llamadas viajan con header `X-Base-Nombre` cuando el usuario
// ya seleccionó una base explícita. Si viaja vacío, el backend resuelve
// a la primera base del estudio (o modo legacy single-base).

function v2Headers(baseNombre?: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h = headers(extra);
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  return h;
}

export async function apiV2Limpieza(baseNombre?: string | null) {
  return handle<LimpiezaSummary>(
    await apiFetch("/api/validacion/v2/limpieza", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaDecisions(baseNombre?: string | null) {
  return handle<{ ok: true; base_nombre: string | null; decisions: LimpiezaDecision[] }>(
    await apiFetch("/api/validacion/v2/limpieza/decisions", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaDecisionSave(
  payload: Partial<LimpiezaDecision> & {
    source_id: string;
    action_type: LimpiezaDecision["action_type"];
  },
  baseNombre?: string | null,
) {
  return handle<{
    ok: true;
    decision: LimpiezaDecision;
    decision_draft: LimpiezaDecision[];
    before_after_preview: LimpiezaBeforeAfterPreview | null;
    summary: LimpiezaSummary["summary"];
  }>(
    await apiFetch("/api/validacion/v2/limpieza/decision", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiV2LimpiezaDecisionDelete(
  id: string,
  baseNombre?: string | null,
) {
  return handle<{
    ok: true;
    id: string;
    decision_draft: LimpiezaDecision[];
    summary: LimpiezaSummary["summary"];
  }>(
    await apiFetch(`/api/validacion/v2/limpieza/decision/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaPreview(baseNombre?: string | null) {
  return handle<{ ok: true; base_nombre: string | null; before_after_preview: LimpiezaBeforeAfterPreview | null }>(
    await apiFetch("/api/validacion/v2/limpieza/preview", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2LimpiezaFinalize(baseNombre?: string | null) {
  return handle<{
    ok: true;
    summary: LimpiezaSummary["summary"];
    before_after_preview: LimpiezaBeforeAfterPreview | null;
    artifacts: LimpiezaSummary["artifacts"];
  }>(
    await apiFetch("/api/validacion/v2/limpieza/finalize", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

// Exporta el reporte HTML autocontenido de la base actual. Devuelve un
// file_id que se consume con downloadUrl() — el backend ya guarda el
// archivo en el file store con original_name "reporte_validacion.html".
export async function apiV2ReportHtml(baseNombre?: string | null) {
  return handle<{ ok: true; file_id: string; size: number; original_name: string }>(
    await apiFetch("/api/validacion/v2/report/html", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2MethodologyReportPdf(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: "validacion.v2.methodology_report_pdf" | string }>(
    await apiFetch("/api/validacion/v2/report/methodology/pdf", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2MethodologyReportBundle(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: "validacion.v2.methodology_report_bundle" | string }>(
    await apiFetch("/api/validacion/v2/report/methodology/bundle", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoEstado(baseNombre?: string | null) {
  return handle<InstrumentoEstado>(
    await apiFetch("/api/validacion/v2/instrumento/estado", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoVariablesExcluidas(baseNombre?: string | null) {
  return handle<InstrumentoVariablesExcluidas>(
    await apiFetch("/api/validacion/v2/instrumento/variables-excluidas", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoVariablesExcluidasSave(
  variables: string[],
  baseNombre?: string | null,
) {
  return handle<InstrumentoVariablesExcluidas>(
    await apiFetch("/api/validacion/v2/instrumento/variables-excluidas", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ variables }),
    }),
  );
}

/**
 * Fuente de datos del explorador:
 *  - "raw" (default): data original cargada, antes de limpieza.
 *  - "final": data tras aplicar todas las decisiones de Limpieza. Requiere
 *    que Limpieza ya se haya finalizado — si no, el backend responde 409
 *    E_NOT_FINALIZED.
 */
export type ExplorarFuente = "raw" | "final";

export async function apiV2ExplorarVariables(
  baseNombre?: string | null,
  fuente: ExplorarFuente = "raw",
) {
  const qs = fuente === "raw" ? "" : `?fuente=${encodeURIComponent(fuente)}`;
  return handle<ExploradorVariablesList>(
    await apiFetch(`/api/validacion/v2/explorar/variables${qs}`, {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ReglasCustomList(baseNombre?: string | null) {
  return handle<ReglasCustomList>(
    await apiFetch("/api/validacion/v2/reglas_custom", {
      headers: v2Headers(baseNombre),
    }),
  );
}

// --- Instrumento (Sprint 2) -------------------------------------------------

export type IncluirReglas = {
  required?: boolean;
  other?: boolean;
  relevant?: boolean;
  constraint?: boolean;
  calculate?: boolean;
  choice_filter?: boolean;
  repeat_min1?: boolean;
  tiempo_ventana?: boolean;
};

// Surfacing relacional (Fase 4, ADR 0030): madre + hija son UN instrumento con
// base relacionada. El backend anota cada regla del plan con flags relacionales
// y expone un resumen para el encabezado de la familia "coherencia relacional
// del repeat" (ver api/R/validacion_relational_surface.R). Se normalizan de
// forma defensiva en el feature (relationalPlan.ts).
export type InstrumentoRelationalRepeat = {
  repeat_group: string;
  sm_conductor: string | null;
  identity_var: string | null;
  repeat_count: string | null;
};

export type InstrumentoRelationalSummary = {
  n_relational: number;
  n_requires_external_dataset: number;
  repeat_groups: string[];
  external_datasets: string[];
  repeats: InstrumentoRelationalRepeat[];
};

// Fila de `plan_preview` con los flags relacionales inline por regla.
export type InstrumentoPlanRuleRow = Record<string, unknown> & {
  relational?: boolean;
  repeat_group?: string | null;
  depends_on_child_base?: boolean;
  requires_external_dataset?: boolean;
  external_datasets?: string[];
  roster_subtype?: string | null;
};

export type InstrumentoPlanResult = {
  ok: true;
  base_nombre: string | null;
  n_reglas: number;
  resumen: Array<Record<string, unknown>>;
  plan_preview: InstrumentoPlanRuleRow[];
  // Opcionales para compatibilidad con backends previos al surfacing relacional.
  relational_summary?: InstrumentoRelationalSummary | null;
  relational_suppressed_legacy?: string[];
};

export type InstrumentoResultado = {
  ok: true;
  base_nombre: string | null;
  kpis: ViewDescriptor[];
  top_reglas: ViewDescriptor;
  heatmap: ViewDescriptor;
  resumen_tabla: Array<Record<string, unknown>>;
};

export type ReglaInstrumento = {
  id: string;
  nombre: string;
  nombre_tecnico?: string | null;
  objetivo: string | null;
  tipo_observacion: string | null;
  seccion: string | null;
  categoria: string | null;
  tabla: string | null;
  variables: string[];
  variable_roles?: {
    target?: string | null;
    drivers?: string | Array<string | null> | null;
    compare?: string | Array<string | null> | null;
    gate?: string | Array<string | null> | null;
    all?: string | Array<string | null> | null;
    labels?: Record<string, string | null>;
    tables?: Record<string, string | null>;
  } | null;
  value_labels?: Record<string, Record<string, string | null> | null> | null;
  other_context?: {
    target_var?: string | null;
    target_label?: string | null;
    parent_var?: string | null;
    parent_label?: string | null;
    choice_code?: string | null;
    choice_label?: string | null;
  } | null;
  presentation?: {
    gate_humano?: string | null;
    detalle_condicion?: string | null;
    subtipo_semantico?: string | null;
  } | null;
  procesamiento: string | null;
  activa: boolean;
  n_inconsistencias: number | null;
  porcentaje: number | null;
};

export type InstrumentoDrillResult = {
  ok: true;
  regla: ReglaInstrumento;
  uuid_col: string | null;
  case_ids?: string[];
  casos: Array<Record<string, unknown>>;
};

export async function apiV2InstrumentoBuildPlan(
  baseNombre?: string | null,
  incluir?: IncluirReglas,
  operationalConfig?: InstrumentoOperationalConfig,
) {
  return handle<InstrumentoPlanResult>(
    await apiFetch("/api/validacion/v2/instrumento/plan", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(incluir ? { incluir } : {}),
        ...(operationalConfig ? { operational_config: operationalConfig } : {}),
      }),
    }),
  );
}

export async function apiV2InstrumentoExportPlan(baseNombre?: string | null) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/validacion/v2/instrumento/plan/export", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoImportPlan(
  file_id: string,
  baseNombre?: string | null,
) {
  return handle<{
    ok: true;
    n_reglas: number;
    plan_preview: Array<Record<string, unknown>>;
  }>(
    await apiFetch("/api/validacion/v2/instrumento/plan/import", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    }),
  );
}

export async function apiV2InstrumentoAuditoria(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await apiFetch("/api/validacion/v2/instrumento/auditoria", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoResultado(baseNombre?: string | null) {
  return handle<InstrumentoResultado>(
    await apiFetch("/api/validacion/v2/instrumento/resultado", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2InstrumentoDrill(
  id_regla: string,
  baseNombre?: string | null,
) {
  return handle<InstrumentoDrillResult>(
    await apiFetch("/api/validacion/v2/instrumento/regla", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ id_regla }),
    }),
  );
}

export async function apiV2InstrumentoReglaToggleActiva(
  id_regla: string,
  activa: boolean,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; id_regla: string; activa: boolean; n_desactivadas: number }>(
    await apiFetch(
      `/api/validacion/v2/instrumento/regla/${encodeURIComponent(id_regla)}/activa`,
      {
        method: "PATCH",
        headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
        body: JSON.stringify({ activa }),
      },
    ),
  );
}

export type ReglaAtributosPatch = Partial<{
  nombre: string;
  objetivo: string;
  tipo_observacion: string;
  categoria: string;
  mensaje: string;
}>;

export async function apiV2InstrumentoReglaPatchAtributos(
  id_regla: string,
  patch: ReglaAtributosPatch,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; id_regla: string; fila: Array<Record<string, unknown>> }>(
    await apiFetch(
      `/api/validacion/v2/instrumento/regla/${encodeURIComponent(id_regla)}/atributos`,
      {
        method: "PATCH",
        headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
        body: JSON.stringify(patch),
      },
    ),
  );
}

// --- Explorar (Sprint 3) ----------------------------------------------------
export type FiltroRango = { min?: number | string; max?: number | string };
export type ExplorarFiltros = Record<string, string[] | FiltroRango>;

export type ExplorarTextResponseRow = {
  row: number;
  respondent_id: string;
  response: string;
};

export type ExplorarUnivariadoResult = {
  ok: true;
  base_nombre: string | null;
  var: string;
  tipo: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  label: string;
  kpis: ViewDescriptor[];
  chart: ViewDescriptor & {
    samples?: string[];
    text_rows?: ExplorarTextResponseRow[];
  };
  n_tras_filtro: number;
  n_total: number;
  filtros_aplicados: number;
};

export type ExplorarBivariadoResult = {
  ok: true;
  base_nombre: string | null;
  view: ViewDescriptor;
};

export async function apiV2ExplorarUnivariado(
  vari: string,
  baseNombre?: string | null,
  filtros?: ExplorarFiltros,
  fuente: ExplorarFuente = "raw",
) {
  return handle<ExplorarUnivariadoResult>(
    await apiFetch("/api/validacion/v2/explorar/univariado", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ var: vari, filtros: filtros ?? {}, fuente }),
    }),
  );
}

export async function apiV2ExplorarBivariado(
  var_x: string,
  var_y: string,
  baseNombre?: string | null,
  filtros?: ExplorarFiltros,
  fuente: ExplorarFuente = "raw",
) {
  return handle<ExplorarBivariadoResult>(
    await apiFetch("/api/validacion/v2/explorar/bivariado", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify({ var_x, var_y, filtros: filtros ?? {}, fuente }),
    }),
  );
}

export type ExplorarValoresRango = {
  min: number | string;
  max: number | string;
  p1?: number;
  p99?: number;
  q1?: number;
  q3?: number;
  mediana?: number;
  n_validos: number;
};

export type ExplorarValoresResult = {
  ok: true;
  var: string;
  tipo: string;
  opciones: Array<{ code: string; label: string; n: number }>;
  rango: ExplorarValoresRango | null;
};

export async function apiV2ExplorarValores(
  vari: string,
  baseNombre?: string | null,
  fuente: ExplorarFuente = "raw",
) {
  const qs = new URLSearchParams({ var: vari });
  if (fuente !== "raw") qs.set("fuente", fuente);
  return handle<ExplorarValoresResult>(
    await apiFetch(
      `/api/validacion/v2/explorar/valores?${qs.toString()}`,
      { headers: v2Headers(baseNombre) },
    ),
  );
}

// --- Reglas custom (Sprint 4) -----------------------------------------------

export async function apiV2ReglasCustomCreate(
  regla: Omit<ReglaCustom, "id" | "created_at">,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; regla: ReglaCustom }>(
    await apiFetch("/api/validacion/v2/reglas_custom", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(regla),
    }),
  );
}

export async function apiV2ReglasCustomUpdate(
  id: string,
  patch: Partial<ReglaCustom>,
  baseNombre?: string | null,
) {
  return handle<{ ok: true; regla: ReglaCustom }>(
    await apiFetch(`/api/validacion/v2/reglas_custom/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    }),
  );
}

export async function apiV2ReglasCustomDelete(id: string, baseNombre?: string | null) {
  return handle<{ ok: true; id: string }>(
    await apiFetch(`/api/validacion/v2/reglas_custom/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: v2Headers(baseNombre),
    }),
  );
}

/**
 * Criterios que el backend propone a partir de la base. Read-only: nada se
 * guarda hasta que el analista adopta una propuesta con `apiV2ReglasCustomCreate`.
 */
export async function apiV2ReglasCustomSemillas(baseNombre?: string | null) {
  return handle<{ ok: true; base_nombre: string | null; semillas: ReglaSemilla[] }>(
    await apiFetch("/api/validacion/v2/reglas_custom/semillas", {
      headers: v2Headers(baseNombre),
    }),
  );
}

export async function apiV2ReglasCustomEjecutar(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string; n_custom: number }>(
    await apiFetch("/api/validacion/v2/reglas_custom/ejecutar", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

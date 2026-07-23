// estudio.ts — estudio multi-base (gestor de bases, v0.2+).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import type { RepeatGrain } from "../lib/repeatIdentity";
import { apiFetch, handle, headers } from "./core";
import type { SurveyMonkeyDecisionAudit, SurveyMonkeyDecisionPolicy, SurveyMonkeyMultibaseSurveyInput, SurveyMonkeySavBundleChangePlan } from "./surveymonkey";
import type { KoboIndependentAssetInput, KoboSourceSpec } from "./xlsformEditor";

// ============================================================================
// Estudio (multi-base, v0.2+)
// ============================================================================
// Un "estudio" agrupa 1 a 16 bases (pares XLSForm + data) que se analizan
// como un todo. La Fase 1 del frontend es el gestor de bases del estudio.

export type EstudioBase = {
  nombre: string;
  xlsform_file_id: string;
  xlsform_file_name?: string;
  data_file_id: string;
  data_file_name?: string;
  data_ext: string;
  n_filas: number | null;
  n_columnas: number | null;
  added_at: string;
  processing_mode?: "multibase" | "independent_siblings" | string | null;
  source_kind?: "manual" | "surveymonkey" | "kobo_repeat" | string | null;
  // --- Grupos repeat (ADR 0030). Presentes solo en bases hija `kobo_repeat`:
  // metadata one-to-many que alimenta la identidad visual naranja. ---
  /** Base madre (ancha) a la que enlaza esta base hija long. */
  parent_base?: string | null;
  /** Nombre del begin_repeat del que proviene la base hija. */
  repeat_group?: string | null;
  /** `relevant` del begin_repeat, preservado para reglas padre↔hija. */
  repeat_relevant?: string | null;
  /** Llave canónica ODK/Kobo de enlace hija→madre (`_parent_index`). */
  link_key?: string | null;
  /** Fallback de enlace cuando falta `link_key` (`_submission__id`). */
  link_key_fallback?: string | null;
  /** Llave del padre a la que apunta `link_key` (`_index`). */
  parent_index_key?: string | null;
  /** Grano de instancia, si el backend lo adjunta a la base. */
  grain?: RepeatGrain | null;
  survey_id?: string | null;
  source_alias?: string | null;
  source_title?: string | null;
  source_channel?: string | null;
  consent_var?: string | null;
  consent_candidates?: string[];
  xlsform_variables?: Array<{
    name: string;
    label?: string | null;
    type?: string | null;
    choice_list?: string | null;
    positive_choices?: Array<{ name: string; label?: string | null }>;
  }>;
  sibling_family_id?: string | null;
  imported_at?: string | null;
  surveymonkey_source_spec?: SurveyMonkeyMultibaseSurveyInput | null;
  surveymonkey_raw_snapshot_file_id?: string | null;
  surveymonkey_effective_data_file_id?: string | null;
  surveymonkey_workbook_file_id?: string | null;
  surveymonkey_workbook_snapshot_file_id?: string | null;
  surveymonkey_workbook_import?: {
    version?: number;
    imported_at?: string;
    workbook_file_id?: string;
    snapshot_file_id?: string;
    sheet_name?: string;
    n_rows?: number;
    n_columns?: number;
    warnings?: string[];
    missing_variables?: string[];
    unknown_headers?: string[];
  } | null;
  surveymonkey_sav_bundle_file_id?: string | null;
  surveymonkey_sav_bundle_snapshot_file_id?: string | null;
  surveymonkey_sav_bundle_import?: {
    version?: number;
    imported_at?: string;
    bundle_file_id?: string;
    snapshot_file_id?: string;
    file_name?: string;
    entry_name?: string;
    n_rows?: number;
    n_columns?: number;
    warnings?: string[];
    missing_variables?: string[];
    all_empty_variables?: string[];
    change_plan?: SurveyMonkeySavBundleChangePlan;
  } | null;
  surveymonkey_decision_policy?: SurveyMonkeyDecisionPolicy | null;
  surveymonkey_decision_audit?: SurveyMonkeyDecisionAudit | null;
  surveymonkey_decision_updated_at?: string | null;
  surveymonkey_refreshed_at?: string | null;
  surveymonkey_last_refresh?: Record<string, unknown> | null;
  surveymonkey_source_summary?: SurveyMonkeyBaseSourceSummary | null;
  surveymonkey_sources?: SurveyMonkeySourceSummary[];
  kobo_source_spec?: KoboSourceSpec | null;
  kobo_effective_data_file_id?: string | null;
  kobo_refreshed_at?: string | null;
  kobo_last_refresh?: Record<string, unknown> | null;
  logic_template_base?: string | null;
  logic_template_applied_at?: string | null;
  logic_template_status?: "updated" | "unchanged" | string | null;
  response_filter?: Record<string, unknown> | null;
  status?: {
    imported?: boolean;
    validacion?: boolean;
    codificacion?: boolean;
    codificacion_adaptada?: boolean;
    analitica?: boolean;
    graficos?: boolean;
    shared_logic_from?: string | null;
  } | null;
  multi_integrated?: EstudioMultiIntegrated | null;
};

export type SurveyMonkeySourceSummary = {
  index?: number | null;
  survey_id?: string | null;
  source_alias?: string | null;
  source_title?: string | null;
  channel?: string | null;
  channel_key?: string | null;
  collection_strategy?: string | null;
  collector_ids?: string[];
  collector_count?: number | null;
  consent_var?: string | null;
  raw_records?: number | null;
  completed_records?: number | null;
  effective_records?: number | null;
  included_records?: number | null;
  valid_records?: number | null;
  excluded_records?: number | null;
  enters_data?: boolean | null;
};

export type SurveyMonkeyBaseSourceSummary = {
  kind?: string;
  source_count?: number | null;
  main_survey_id?: string | null;
  channel_label?: string | null;
  channels?: string[];
  has_phone?: boolean;
  has_email?: boolean;
  phone_active?: boolean;
  email_active?: boolean;
  total_raw_records?: number | null;
  total_effective_records?: number | null;
  total_included_records?: number | null;
  total_valid_records?: number | null;
  total_excluded_records?: number | null;
  active_data_rows?: number | null;
  active_data_columns?: number | null;
  sources?: SurveyMonkeySourceSummary[];
};

export type EstudioMultiIntegratedOrigin = {
  id?: string;
  source_kind?: "manual" | "surveymonkey" | string;
  key_value?: string;
  label?: string;
  xlsform_file_id?: string;
  xlsform_file_name?: string;
  data_file_id?: string;
  data_file_name?: string;
  survey_id?: string;
};

export type EstudioMultiIntegratedVariant = {
  from?: string;
  to?: string;
  origin_key?: string;
  ref_origin_key?: string;
  replace_source?: boolean;
  kind?: string;
};

export type EstudioMultiIntegratedLabelOverrides = Record<string, string | Record<string, string>>;

export type EstudioMultiIntegrated = {
  version?: number;
  kind?: string;
  origin_key_name?: string;
  guide_xlsform_file_id?: string;
  guide?: { file_id?: string; filename?: string; kind?: string };
  origins?: EstudioMultiIntegratedOrigin[];
  variant_map?: EstudioMultiIntegratedVariant[];
  label_overrides_standard?: Record<string, string>;
  label_overrides_by_key?: EstudioMultiIntegratedLabelOverrides;
  imported_at?: string;
};

export type EstudioPayload = {
  nombre: string | null;
  processing_mode?: "multibase" | "independent_siblings" | string | null;
  active_base?: string | null;
  independent_siblings?: {
    version?: number;
    sibling_family_id?: string;
    template_base?: string;
    logic_policy?: string;
    shared_logic?: boolean;
    status?: string;
    updated_at?: string;
    logic_applied_at?: string;
    logic_sync?: EstudioLogicSyncResult | null;
    audit?: unknown;
  } | null;
  n_bases: number;
  bases: Record<string, EstudioBase>;
  max_bases: number;
};

export type EstudioProcessingSuggestionSource = {
  source_id: string;
  kind: "surveymonkey" | "kobo" | string;
  label: string;
  title: string;
  actor: string;
  actor_key: string;
  channel: string;
  collection_strategy: string;
  role: string;
  integration_mode: string;
  survey_id: string;
  asset_uid: string;
  base_url: string;
  connection_profile_id: string;
  version_id?: string;
  deployment_active?: boolean;
  response_count?: number | null;
  collector_ids?: string[];
  enabled: boolean;
  last_sync_at: string;
};

export type EstudioProcessingSuggestionGroup = {
  id: string;
  project_kind: "acreditacion" | string;
  actor: string;
  actor_key: string;
  platform: "surveymonkey" | "kobo" | string;
  label: string;
  recommended_base_name: string;
  source_count: number;
  response_count?: number | null;
  importable: boolean;
  import_mode: "surveymonkey_independent_sibling" | "kobo_independent_sibling" | "kobo_detected" | string;
  confidence: "high" | "medium" | "low" | string;
  survey_input?: SurveyMonkeyMultibaseSurveyInput | null;
  kobo_input?: KoboIndependentAssetInput | null;
  sources: EstudioProcessingSuggestionSource[];
};

export type EstudioProcessingSuggestions = {
  ok: true;
  source: "monitoreo" | string;
  project_kind?: "acreditacion" | string | null;
  profile_family?: "acreditacion" | string | null;
  profile_variant?: string | null;
  has_suggestions: boolean;
  message: string;
  summary: {
    monitoring_sources_count: number;
    survey_sources_count: number;
    actors_count: number;
    surveymonkey_groups: number;
    kobo_groups: number;
  };
  warnings?: string[];
  groups: EstudioProcessingSuggestionGroup[];
};

export type EstudioLogicSyncResult = {
  ok: boolean;
  template_base: string;
  targets: string[];
  updated_bases: string[];
  n_targets: number;
  n_updated_bases: number;
  error?: string;
  results?: Array<{
    base: string;
    applied_variables: string[];
    skipped_missing_variables: string[];
    missing_references: Array<{ variable: string; reference: string }>;
    n_applied_variables: number;
    n_skipped_missing_variables: number;
    n_missing_references: number;
    changed_cells: number;
    logic_columns: string[];
  }>;
  estudio?: EstudioPayload;
};

export async function apiEstudioGet() {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio", { headers: headers() }),
  );
}

export async function apiEstudioProcessingSuggestions() {
  return handle<EstudioProcessingSuggestions>(
    await apiFetch("/api/estudio/processing-suggestions", { headers: headers() }),
  );
}

export async function apiEstudioSetNombre(nombre: string) {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio", {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre }),
    }),
  );
}

// Nombre es opcional: si no se envía (o va vacío), el backend genera
// `base_1, base_2, …` automáticamente. Esto habilita el flujo de
// "+ Agregar otra base" sin fricción — el usuario puede renombrar
// después desde la vista de edición de bases.
export async function apiEstudioAddBase(payload: {
  nombre?: string;
  xlsform_file_id: string;
  data_file_id: string;
}) {
  return handle<{
    ok: true;
    base: EstudioBase;
    n_bases: number;
    max_bases: number;
  }>(
    await apiFetch("/api/estudio/base", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiEstudioRemoveBase(nombre: string) {
  return handle<{ ok: true; n_bases: number }>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

// Convierte un single-base legacy (cargado via apiCargaInstrumento +
// apiCargaData) en un estudio multi-base con UNA base inicial. Si no
// se especifica nombre, el backend genera "base_1" automáticamente.
// Reutiliza los archivos ya subidos al file store — no hay re-upload.
// Tras esto el frontend debe refrescar session/state y el usuario
// puede agregar más bases via BasesPanel.
export async function apiEstudioFromSession(nombre?: string) {
  return handle<{
    ok: true;
    base: EstudioBase;
    n_bases: number;
    max_bases: number;
  }>(
    await apiFetch("/api/estudio/from-session", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre }),
    }),
  );
}

export async function apiEstudioRenameBase(nombre_actual: string, nombre_nuevo: string) {
  return handle<EstudioPayload>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre_actual)}`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre_nuevo }),
    }),
  );
}

export async function apiEstudioUpdateBaseMetadata(
  nombre: string,
  payload: {
    source_alias?: string;
    source_title?: string;
    source_channel?: string;
    source_kind?: string;
    survey_id?: string;
    consent_var?: string;
    response_filter?: Record<string, unknown> | null;
    surveymonkey_source_spec?: SurveyMonkeyMultibaseSurveyInput | null;
  },
) {
  return handle<EstudioPayload>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre)}/metadata`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// Reemplaza el XLSForm y/o la data de una base existente. Cualquiera
// de los dos file_ids puede ir vacío — al menos uno debe venir.
// Invalida evaluación y plan_result de la analítica porque la base
// cambió bajo los pies.
export async function apiEstudioReplaceBaseFiles(
  nombre: string,
  payload: { xlsform_file_id?: string; data_file_id?: string },
) {
  return handle<EstudioPayload>(
    await apiFetch(`/api/estudio/base/${encodeURIComponent(nombre)}/files`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// Crea un estudio vacío (sin bases aún) para que el usuario pueda
// activar "varias bases" antes de subir ningún archivo. Idempotente:
// si ya hay un estudio, no hace nada y devuelve el payload actual.
export async function apiEstudioInit() {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio/init", {
      method: "POST",
      headers: headers(),
    }),
  );
}

// Vuelve al modo single-base si el estudio tiene exactamente 1 base.
// Destruye el estudio y restaura s$instrumento + s$data_raw_meta del
// single-base legacy, preservando los archivos. Falla si hay 0 o >1
// bases (debe resolverse manualmente antes).
export async function apiEstudioDowngradeToSingle() {
  return handle<{ ok: true }>(
    await apiFetch("/api/estudio/downgrade-to-single", {
      method: "POST",
      headers: headers(),
    }),
  );
}

export type EstudioActiveBaseState = {
  active: string | null;
  options: string[];
  processing_mode?: "multibase" | "independent_siblings" | string | null;
};

export async function apiEstudioActiveBaseGet() {
  return handle<EstudioActiveBaseState>(
    await apiFetch("/api/estudio/active-base", { headers: headers() }),
  );
}

export async function apiEstudioActiveBaseSet(base_nombre: string) {
  return handle<{ ok: true } & EstudioActiveBaseState>(
    await apiFetch("/api/estudio/active-base", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ base_nombre }),
    }),
  );
}

export async function apiEstudioPromoteIndependentSiblings(payload: {
  active_base?: string;
  base_nombre?: string;
  nombre_nuevo?: string;
  source_alias?: string;
  source_title?: string;
  survey_id?: string;
  source_kind?: string;
  sibling_family_id?: string;
}) {
  return handle<EstudioPayload>(
    await apiFetch("/api/estudio/independent-siblings/promote", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiEstudioApplyIndependentTemplateLogic(payload: {
  template_base?: string;
  targets?: string[];
  clear_target_logic?: boolean;
} = {}) {
  return handle<EstudioLogicSyncResult>(
    await apiFetch("/api/estudio/independent-siblings/apply-template-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// Base activa para codificación (v0.2+). Devuelve y setea cuál de las
// bases del estudio está siendo codificada en ese momento. Al cambiar,
// el backend sirve el estado scoped de esa base (familias, grupos,
// marcadas, etc. que son independientes entre bases).
export type CodifSourceState = EstudioActiveBaseState;

export async function apiCodifSourceGet() {
  return handle<CodifSourceState>(
    await apiFetch("/api/estudio/codif-source", { headers: headers() }),
  );
}

export async function apiCodifSourceSet(source: string) {
  return handle<{ ok: true } & CodifSourceState>(
    await apiFetch("/api/estudio/codif-source", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ source }),
    }),
  );
}

export type UploadKind = "xlsform" | "data" | "sav" | "sav_bundle" | "plan_limpieza" | "plantilla_codif" | "universo_muestra" | "graficos_share" | "monitoreo_operational_package" | "monitoreo_reference_drift" | "plan_trabajo";

export function isSavLikeFileName(name: string) {
  return /\.sav(?:\s+\d+)?$/i.test(name.trim());
}

export function isZipLikeFileName(name: string) {
  return /\.zip$/i.test(name.trim());
}

export function uploadKindForDataFile(file: File): UploadKind {
  if (isSavLikeFileName(file.name)) return "sav";
  if (isZipLikeFileName(file.name)) return "sav_bundle";
  return "data";
}

export async function apiUpload(file: File, kind: UploadKind) {
  const fd = new FormData();
  fd.append("file", file);
  return handle<{
    file_id: string;
    kind: UploadKind;
    original_name: string;
    size: number;
    ext: string;
  }>(
    await apiFetch(`/api/files/upload?kind=${encodeURIComponent(kind)}`, {
      method: "POST",
      headers: headers(),
      body: fd,
    })
  );
}

const SESSION_KEY = "pulso.sessionId";
const APP_BASE = import.meta.env.BASE_URL || "/";

export function apiPath(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const normalizedBase = APP_BASE === "./" ? "/" : APP_BASE;
  const base = normalizedBase.endsWith("/")
    ? normalizedBase.slice(0, -1)
    : normalizedBase;

  if (path === "/api" || path.startsWith("/api/")) {
    return `${base}${path}`;
  }
  if (path === "api" || path.startsWith("api/")) {
    return `${base}/${path}`;
  }
  return path;
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string") {
    const method = String(init?.method ?? "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && /^\/?api\/monitoreo(?:\/|$)/.test(input)) {
      invalidateMonitoreoStateWarmCache();
    }
  }
  if (typeof input === "string") {
    return globalThis.fetch(apiPath(input), init);
  }
  return globalThis.fetch(input, init);
}

function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(id: string) {
  const prev = getSession();
  localStorage.setItem(SESSION_KEY, id);
  if (prev !== id && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pulso:session-changed", {
      detail: { old_sid: prev, new_sid: id },
    }));
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const sid = getSession();
  if (sid) h["X-Pulso-Session"] = sid;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  const sidHeader = res.headers.get("X-Pulso-Session");
  if (sidHeader) {
    setSession(sidHeader);
    // Cuando el backend cambia el sid (típicamente al cargar un demo o
    // al responder a /api/session si la sesión vieja ya no existía),
    // emitimos un evento global para que el SessionContext y los hooks
    // con cache module-level se enteren y se invaliden / re-hidraten.
    // Sin esto, al cambiar de demo el frontend quedaba con variables,
    // presets y templates del demo anterior porque los caches son por
    // módulo y nadie los reciclaba.
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let body: any = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
    }
    const code = body?.error?.code ?? body?.code ?? `HTTP_${res.status}`;
    const fallbackMessage = raw.trim() || res.statusText || `HTTP ${res.status}`;
    const message = body?.error?.message ?? body?.message ?? fallbackMessage;
    // E_NO_SESSION: el backend no reconoce el sid que tenemos en
    // localStorage. Típicamente porque el backend se reinició (sesiones
    // en memoria, no persistidas). Disparamos un evento global que
    // SessionContext captura para mostrar un banner claro al usuario
    // en vez de dejar el error crudo contaminando los pickers.
    if (code === "E_NO_SESSION" && typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new CustomEvent("pulso:session-lost"));
    }
    throw new Error(`[${code}] ${message}`);
  }
  return res.json();
}

export async function apiHealth() {
  return handle<{ ok: boolean; version: string; prosecnur_version: string; time: string }>(
    await apiFetch("/api/system/health", { headers: headers() })
  );
}

// Bootstrap session: si el backend arrancó con PULSO_BOOTSTRAP_PROJECT,
// devuelve el sid de la sesión pre-cargada. Útil para que herramientas
// externas (Claude Code, scripts) levanten el stack con un .pulso ya
// abierto sin pasar por la UI. El backend "consume" el sid una vez —
// recargas posteriores reciben sid=null y se comportan normalmente.
export async function apiSystemBootstrap() {
  return handle<{ sid: string | null }>(
    await apiFetch("/api/system/bootstrap", { headers: headers() })
  );
}

export type DiagnosticInfo = {
  ok: boolean;
  quarto: {
    available: boolean;
    r_package: boolean;
    cli_path: string | null;
    cli_version: string | null;
    install_url: string;
    required_for: string;
  };
};

export async function apiSystemDiagnostic() {
  return handle<DiagnosticInfo>(
    await apiFetch("/api/system/diagnostic", { headers: headers() })
  );
}

export async function apiCreateSession(options: { fresh?: boolean } = {}) {
  const path = options.fresh ? "/api/session?fresh=1" : "/api/session";
  const res = await apiFetch(path, { method: "POST", headers: headers() });
  const body = await handle<{ session_id: string; reused: boolean }>(res);
  setSession(body.session_id);
  return body;
}

export type SessionState = {
  session_id: string;
  created_at: string;
  xlsform: boolean;
  data: boolean;
  instrumento_parsed: boolean;
  data_previewed: boolean;
  plan_built: boolean;
  auditoria_run: boolean;
  codif_familias_generated: boolean;
  codif_familias_loaded: boolean;
  codif_plantilla_template: boolean;
  codif_plantilla_codigos_loaded: boolean;
  codif_aplicado: boolean;
  analitica_prep_ok: boolean;
  analitica_codebook_ok: boolean;
  analitica_frecuencias_ok: boolean;
  analitica_cruces_ok: boolean;
  analitica_spss_ok: boolean;
  analitica_enumeradores_ok: boolean;
  analitica_dim_ok: boolean;
  analitica_multibase_available: boolean;
  analitica_multibase_ok: boolean;
  analitica_panel_ok: boolean;
  analitica_ficha_tecnica_ok: boolean;
  analitica_fuente: string | null;
  analitica_fuente_detalle?: AnaliticaFuenteDetalle | null;
  hojas_ruta_ok: boolean;
  graficos_ppt_ok: boolean;
  graficos_word_ok: boolean;
  // --- Estudio (multi-base, v0.2+) ---
  estudio_nombre: string | null;
  /** TRUE si la sesión tiene un estudio inicializado (aunque esté
      vacío). Distingue "usuario activó multi-base upfront" de
      "todavía no decide". */
  has_estudio: boolean;
  estudio_processing_mode?: "multibase" | "independent_siblings" | string | null;
  active_base?: string | null;
  n_bases: number;
  bases_nombres: string[];
};

export type AnaliticaFuenteFile = {
  file_id: string;
  filename: string;
  kind: string;
  ext: string;
};

export type AnaliticaFuenteBase = {
  nombre: string;
  xlsform: AnaliticaFuenteFile | null;
  data: AnaliticaFuenteFile | null;
  available: boolean;
};

export type AnaliticaFuenteDetalle = {
  actual: string | null;
  original: {
    label: string;
    available: boolean;
    bases: AnaliticaFuenteBase[];
  };
  codificada: {
    label: string;
    available: boolean;
    bases: AnaliticaFuenteBase[];
  };
};

export async function apiSessionState() {
  return handle<SessionState>(await apiFetch("/api/session/state", { headers: headers() }));
}

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
  source_kind?: string | null;
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

// ============================================================================
// SurveyMonkey multibase contra XLSForm canonico
// ============================================================================

export type SurveyMonkeyMultibaseSurveyInput = {
  survey_id: string;
  pais?: string;
  label?: string;
  source_alias?: string;
  source_title?: string;
  channel?: string;
  canal?: string;
  source_channel?: string;
  consent_var?: string;
  consentimiento_var?: string;
  data_file_id?: string;
  response_statuses?: string[];
  keep_missing_status?: boolean;
  collector_id?: string;
  collector_ids?: string[];
  date_modified_gte?: string;
  date_modified_lte?: string;
  collection_strategy?: "campo" | "whatsapp_link" | "web_link" | "email" | "otro" | string;
  validation_exclusion_profile?: string;
  excluded_validation_vars?: string[];
  sources?: SurveyMonkeyMultibaseSurveyInput[];
  campaigns?: SurveyMonkeyMultibaseSurveyInput[];
};

export type SurveyMonkeyDecisionPolicy = {
  version?: number;
  edited?: boolean;
  statuses?: string[];
  collector_ids?: string[];
  consent_var?: string;
  consent_yes_values?: string[];
  rejection_var?: string;
  rejection_values?: string[];
  include_partials?: boolean;
  partial_min_answers?: number;
  include_rejections?: boolean;
  duplicate_key_vars?: string[];
  include_duplicates?: boolean;
  duplicate_keep?: "first" | "latest" | "most_answered" | string;
  manual_include_case_uids?: string[];
  saved_at?: string;
};

export type SurveyMonkeyDecisionCaseAudit = {
  source_label?: string;
  case_uid?: string;
  survey_id?: string;
  source_title?: string;
  source_channel?: string;
  collector_id?: string;
  response_id?: string;
  recipient_id?: string;
  custom_value?: string;
  cv_id?: string;
  p4?: string;
  response_status?: string;
  date_created?: string;
  date_modified?: string;
  answered_questions_count?: string;
  answered_required_count?: string;
  answerable_required_count?: string;
  answer_completion_ratio?: string;
  answer_completion_label?: string;
  near_complete?: string;
  decision_class?: string;
  decision_included?: string;
  decision_manual_include?: string;
  duplicate_status?: string;
  duplicate_key_var?: string;
  duplicate_key?: string;
  duplicate_group_size?: string;
  duplicate_rank?: string;
  duplicate_kept_case_uid?: string;
  duplicate_kept_response_id?: string;
  duplicate_code_match?: string;
  duplicate_career_match?: string;
  duplicate_evidence?: string;
  observed?: boolean;
  observation_reason?: string;
};

export type SurveyMonkeyDecisionSourceAudit = {
  source_label?: string;
  survey_id?: string;
  source_title?: string;
  source_alias?: string;
  raw_total?: number;
  completed?: number;
  completed_with_consent?: number;
  partials_revisable?: number;
  rejections?: number;
  unclear_consent?: number;
  duplicate_groups?: number;
  duplicate_rows?: number;
  duplicate_extra_rows?: number;
  duplicates_excluded?: number;
  duplicates_included?: number;
  manual_included?: number;
  near_complete_cases?: number;
  observed_cases?: number;
  included?: number;
  excluded?: number;
  collectors_included?: number;
  partial_min_answers?: number;
  consent_var?: string;
  rejection_var?: string;
  consent_available?: boolean;
  duplicate_key_vars?: string[];
  duplicate_keep?: string;
  include_duplicates?: boolean;
  status_counts?: Record<string, number>;
  collector_counts?: Record<string, number>;
  collectors?: Array<{
    id?: string;
    name?: string;
    type?: string;
    response_count?: number | null;
  }>;
  cases?: SurveyMonkeyDecisionCaseAudit[];
  case_rows_omitted?: number;
};

export type SurveyMonkeyDecisionAudit = {
  version?: number;
  audited_at?: string;
  raw_total?: number;
  completed?: number;
  completed_with_consent?: number;
  partials_revisable?: number;
  rejections?: number;
  unclear_consent?: number;
  duplicate_groups?: number;
  duplicate_rows?: number;
  duplicate_extra_rows?: number;
  duplicates_excluded?: number;
  duplicates_included?: number;
  manual_included?: number;
  near_complete_cases?: number;
  observed_cases?: number;
  case_rows_omitted?: number;
  included?: number;
  excluded?: number;
  collectors_included?: number;
  sources?: SurveyMonkeyDecisionSourceAudit[];
  policy?: SurveyMonkeyDecisionPolicy;
};

export type SurveyMonkeyMultibaseListItem = {
  id: string;
  title: string;
  nickname: string | null;
  date_modified: string | null;
  pais_guess: string | null;
  response_count?: number | null;
};

export type SurveyMonkeyMultibaseCollector = {
  id: string;
  name: string;
  type: string;
  response_count: number | null;
  date_created: string | null;
  date_modified: string | null;
};

export type SurveyMonkeyMultibaseInspection = {
  ok: true;
  survey_id: string;
  title: string;
  language: string;
  n_pages: number;
  n_questions: number;
  n_required: number;
  n_validation: number;
  pages: Array<{
    page_id: string;
    title: string;
    range_label: string;
    question_count: number;
  }>;
  questions: Array<{
    pos: number;
    page: number;
    qid: string;
    family: string;
    subtype: string;
    heading: string;
    n_choices: number;
    n_rows: number;
    n_cols: number;
  }>;
  responses: {
    available: boolean;
    total: number | null;
    returned: number;
    error: string;
  };
  columns: Array<{
    name: string;
    non_empty: number;
    examples: string[];
  }>;
  sample_rows: Array<Record<string, string>>;
};

export type SurveyMonkeyMultibaseSurveySummary = {
  survey_id: string;
  title: string;
  pais: string;
  label: string;
  n_pages: number;
  n_questions: number;
  n_responses: number | null;
  responses_available: boolean;
  responses_error: string;
  data_file_id?: string;
};

export type SurveyMonkeyMultibaseDiff = {
  survey_id: string;
  pos: number;
  variable: string;
  severity: "blocking" | "review" | "special";
  kind: "missing_or_extra" | "structure" | "options" | "wording" | "company_list" | "company_logic" | string;
  message: string;
  ref: string;
  current: string;
};

export type SurveyMonkeyMultibaseAudit = {
  ok: boolean;
  surveys: SurveyMonkeyMultibaseSurveySummary[];
  ref_survey_id: string;
  n_blocking: number;
  n_review: number;
  n_special: number;
  company_positions: number[];
  company_variables: string[];
  diffs: SurveyMonkeyMultibaseDiff[];
};

export type SurveyMonkeyWorkbookMappedHeader = {
  source: string;
  kind: "metadata" | "question" | "select_multiple" | string;
  variable?: string;
  code?: string;
  columns?: string[];
};

export type SurveyMonkeyWorkbookCellError = {
  source: string;
  kind: string;
  variable?: string;
  code?: string;
  n_errors: number;
  rows?: number[];
};

export type SurveyMonkeyWorkbookSheetInspection = {
  sheet_name: string;
  base_name?: string | null;
  matched: boolean;
  blocking: boolean;
  n_rows: number;
  n_columns: number;
  n_output_columns?: number;
  recognized_headers: number;
  mapped_headers?: SurveyMonkeyWorkbookMappedHeader[];
  unknown_headers: string[];
  ambiguous_headers: string[];
  missing_variables: string[];
  blank_filled_variables?: string[];
  cell_errors?: SurveyMonkeyWorkbookCellError[];
  n_cell_errors?: number;
  warnings: string[];
};

export type SurveyMonkeyWorkbookInspection = {
  ok: boolean;
  file_id: string;
  filename: string;
  n_sheets: number;
  n_matched: number;
  n_blocking: number;
  blocking_sheets: string[];
  sheets: SurveyMonkeyWorkbookSheetInspection[];
  warnings: string[];
};

export type SurveyMonkeyWorkbookImportResult = {
  ok: true;
  file_id: string;
  filename: string;
  imported_bases: number;
  results: Array<{
    base_name: string;
    sheet_name: string;
    data_file_id: string;
    snapshot_file_id: string;
    n_rows: number;
    n_columns: number;
    warnings: string[];
    base?: EstudioBase;
  }>;
  inspection: SurveyMonkeyWorkbookInspection;
  estudio: EstudioPayload;
};

export type SurveyMonkeySavBundleChangePlan = {
  action: "replace_data" | string;
  base_name: string;
  source_file: string;
  current: {
    n_rows?: number | null;
    n_columns?: number | null;
    data_file_id?: string;
    xlsform_file_id?: string;
  };
  incoming: {
    raw_rows: number;
    raw_columns: number;
    normalized_rows: number;
    normalized_columns: number;
  };
  impact: {
    rows_delta?: number | null;
    columns_delta?: number | null;
    expected_variables: number;
    matched_variables: number;
    missing_variables: string[];
    blank_filled_variables: string[];
    all_empty_variables: string[];
    metadata_columns: string[];
  };
  effects: {
    xlsform: "preserved" | string;
    data: "replaced" | string;
    invalidates: string[];
  };
};

export type SurveyMonkeySavBundleFileInspection = {
  file_name: string;
  entry_name: string;
  base_name?: string | null;
  matched: boolean;
  blocking: boolean;
  action: "replace_data" | string;
  n_rows: number;
  n_columns: number;
  n_output_columns: number;
  expected_variables: number;
  matched_variables: number;
  missing_variables: string[];
  blank_filled_variables: string[];
  all_empty_variables: string[];
  metadata_columns: string[];
  warnings: string[];
  change_plan: SurveyMonkeySavBundleChangePlan;
};

export type SurveyMonkeySavBundleInspection = {
  ok: boolean;
  file_id: string;
  filename: string;
  n_files: number;
  n_matched: number;
  n_blocking: number;
  blocking_files: string[];
  files: SurveyMonkeySavBundleFileInspection[];
  change_plan: SurveyMonkeySavBundleFileInspection[];
  warnings: string[];
};

export type SurveyMonkeySavBundleImportResult = {
  ok: true;
  file_id: string;
  filename: string;
  imported_bases: number;
  results: Array<{
    base_name: string;
    file_name: string;
    entry_name: string;
    data_file_id: string;
    snapshot_file_id: string;
    n_rows: number;
    n_columns: number;
    warnings: string[];
    change_plan: SurveyMonkeySavBundleChangePlan;
    base?: EstudioBase;
  }>;
  inspection: SurveyMonkeySavBundleInspection;
  estudio: EstudioPayload;
};

export type SurveyMonkeyRefreshCampaignSuggestion = {
  survey_id: string;
  title: string;
  nickname?: string | null;
  label?: string;
  channel?: string;
  source_channel?: string;
  date_modified?: string | null;
  response_count?: number | null;
  score: number;
  preselected: boolean;
  reason?: string;
};

export type SurveyMonkeyRefreshBasePlan = {
  base_name: string;
  source_alias?: string;
  source_title?: string;
  survey_id?: string;
  source_count?: number;
  existing_campaigns?: string[];
  accepted_campaigns?: string[];
  campaign_suggestions?: SurveyMonkeyRefreshCampaignSuggestion[];
  current_rows?: number | null;
  remote_rows?: number | null;
  new_rows?: number | null;
  edited_rows?: number | null;
  edited_case_uids?: string[];
  structure?: {
    ok?: boolean;
    n_blocking?: number;
    n_review?: number;
    diffs?: SurveyMonkeyMultibaseDiff[];
  };
  codificacion?: {
    has_state?: boolean;
  };
  source_spec?: SurveyMonkeyMultibaseSurveyInput;
  ok: boolean;
  updateable: boolean;
  refresh_action?: "update" | "noop" | "noop_structure_warning" | "blocked" | "error" | string;
  needs_update?: boolean;
  structure_warning_only?: boolean;
  issues?: string[];
};

export type SurveyMonkeyRefreshPlan = {
  ok: boolean;
  bases: SurveyMonkeyRefreshBasePlan[];
  campaign_suggestions?: Record<string, SurveyMonkeyRefreshCampaignSuggestion[]>;
  catalog?: {
    from_cache?: boolean;
    cache_status?: string;
    refresh_error?: string;
    catalog_fetched_at?: string | null;
  };
  message?: string;
};

export type SurveyMonkeyRefreshSelection = {
  base_name: string;
  campaigns?: SurveyMonkeyMultibaseSurveyInput[];
};

export type SurveyMonkeyRefreshResult = {
  ok: boolean;
  results: Array<{
    base_name: string;
    ok: boolean;
    skipped?: boolean;
    noop?: boolean;
    refresh_action?: string;
    reason?: string;
    n_new?: number;
    current_rows_before?: number | null;
    rows_after?: number | null;
    edited_rows_reported?: number | null;
    source_count?: number;
    raw_snapshot_regenerated?: boolean;
    raw_snapshot_file_id?: string | null;
    raw_snapshot_only?: boolean;
    data_refresh_blocked?: boolean;
    sources?: Array<{
      index?: number;
      survey_id?: string | null;
      source_title?: string | null;
      source_alias?: string | null;
      channel?: string | null;
      refreshed?: boolean;
      status?: string | null;
      reason?: string | null;
    }>;
    codificacion_job?: { ok?: boolean; job_id?: string; kind?: string; base_name?: string; error?: string } | null;
  }>;
  codificacion_jobs?: Array<{ ok?: boolean; job_id?: string; kind?: string; base_name?: string; error?: string }>;
  plan: SurveyMonkeyRefreshPlan;
  estudio: EstudioPayload;
};

export async function apiSurveyMonkeyMultibaseListSurveys(
  q = "",
  limit = 200,
  months = 6,
  options: { forceRefresh?: boolean; profile_id?: string; connection_profile_id?: string } = {},
) {
  const payload: Record<string, unknown> = { q, limit, months };
  if (options.forceRefresh) payload.force_refresh = true;
  if (options.profile_id || options.connection_profile_id) {
    payload.profile_id = options.profile_id ?? options.connection_profile_id;
  }
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/surveys", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.surveys) ? (r.surveys as Record<string, unknown>[]) : [];
  return {
    ok: true as const,
    from_cache: Boolean(r.from_cache),
    cache_status: String(r.cache_status ?? ""),
    refresh_error: String(r.refresh_error ?? ""),
    catalog_fetched_at: r.catalog_fetched_at == null || r.catalog_fetched_at === "NA" ? null : String(r.catalog_fetched_at),
    catalog_age_seconds: r.catalog_age_seconds == null || r.catalog_age_seconds === "NA" ? null : Number(r.catalog_age_seconds),
    catalog_count: Number(r.catalog_count ?? r.total_visible ?? arr.length),
    total_visible: Number(r.total_visible ?? arr.length),
    total_recent: Number(r.total_recent ?? arr.length),
    months: Number(r.months ?? months),
    count: Number(r.count ?? arr.length),
    surveys: arr.map((s): SurveyMonkeyMultibaseListItem => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? "(sin título)"),
      nickname: s.nickname == null || s.nickname === "NA" ? null : String(s.nickname),
      date_modified: s.date_modified == null || s.date_modified === "NA" ? null : String(s.date_modified),
      pais_guess: s.pais_guess == null || s.pais_guess === "NA" ? null : String(s.pais_guess),
      response_count: s.response_count == null || s.response_count === "NA" ? null : Number(s.response_count),
    })),
  };
}

export async function apiSurveyMonkeyMultibaseInspectSurvey(
  survey_id: string,
  response_limit = 5,
  base_url = "https://api.surveymonkey.com/v3",
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const payload: Record<string, unknown> = { survey_id, response_limit, base_url };
  if (options.profile_id || options.connection_profile_id) {
    payload.profile_id = options.profile_id ?? options.connection_profile_id;
  }
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const response = (r.responses ?? {}) as Record<string, unknown>;
  const pages = normalizeRecordArray(r.pages).map((page) => ({
    page_id: String(page.page_id ?? ""),
    title: String(page.title ?? ""),
    range_label: String(page.range_label ?? ""),
    question_count: Number(page.question_count ?? 0),
  }));
  const questions = normalizeRecordArray(r.questions).map((q) => ({
    pos: Number(q.pos ?? 0),
    page: Number(q.page ?? 0),
    qid: String(q.qid ?? ""),
    family: String(q.family ?? ""),
    subtype: String(q.subtype ?? ""),
    heading: String(q.heading ?? ""),
    n_choices: Number(q.n_choices ?? 0),
    n_rows: Number(q.n_rows ?? 0),
    n_cols: Number(q.n_cols ?? 0),
  }));
  const columns = normalizeRecordArray(r.columns).map((column) => ({
    name: String(column.name ?? ""),
    non_empty: Number(column.non_empty ?? 0),
    examples: Array.isArray(column.examples) ? column.examples.map(String) : [],
  }));
  const sampleRows = normalizeRecordArray(r.sample_rows).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")])),
  );
  return {
    ok: true as const,
    survey_id: String(r.survey_id ?? survey_id),
    title: String(r.title ?? ""),
    language: String(r.language ?? ""),
    n_pages: Number(r.n_pages ?? pages.length),
    n_questions: Number(r.n_questions ?? questions.length),
    n_required: Number(r.n_required ?? 0),
    n_validation: Number(r.n_validation ?? 0),
    pages,
    questions,
    responses: {
      available: Boolean(response.available),
      total: response.total == null || response.total === "NA" ? null : Number(response.total),
      returned: Number(response.returned ?? sampleRows.length),
      error: String(response.error ?? ""),
    },
    columns,
    sample_rows: sampleRows,
  };
}

export async function apiSurveyMonkeyMultibaseCollectors(
  survey_id: string,
  base_url = "https://api.surveymonkey.com/v3",
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const payload: Record<string, unknown> = { survey_id, base_url };
  if (options.profile_id || options.connection_profile_id) {
    payload.profile_id = options.profile_id ?? options.connection_profile_id;
  }
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/collectors", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const collectors = normalizeRecordArray(r.collectors).map((collector): SurveyMonkeyMultibaseCollector => ({
    id: String(collector.id ?? ""),
    name: String(collector.name ?? collector.id ?? ""),
    type: String(collector.type ?? ""),
    response_count: collector.response_count == null || collector.response_count === "NA" ? null : Number(collector.response_count),
    date_created: collector.date_created == null || collector.date_created === "NA" ? null : String(collector.date_created),
    date_modified: collector.date_modified == null || collector.date_modified === "NA" ? null : String(collector.date_modified),
  }));
  return {
    ok: true as const,
    survey_id: String(r.survey_id ?? survey_id),
    total: Number(r.total ?? collectors.length),
    collectors,
  };
}

export async function apiSurveyMonkeyMultibaseAudit(
  surveys: SurveyMonkeyMultibaseSurveyInput[],
  canonical_xlsform_file_id = "",
) {
  return handle<SurveyMonkeyMultibaseAudit>(
    await apiFetch("/api/surveymonkey/multibase/audit", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ surveys, canonical_xlsform_file_id }),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseImport(payload: {
  surveys: SurveyMonkeyMultibaseSurveyInput[];
  base_name?: string;
  wording_decisions?: Record<string, string>;
  canonical_xlsform_file_id?: string;
}) {
  return handle<{
    ok: true;
    base: EstudioBase;
    estudio: EstudioPayload;
    audit: SurveyMonkeyMultibaseAudit;
    n_filas: number;
    n_columnas: number;
  }>(
    await apiFetch("/api/surveymonkey/multibase/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseImportIndependent(payload: {
  surveys: SurveyMonkeyMultibaseSurveyInput[];
  response_statuses?: string[];
  keep_missing_status?: boolean;
  canonical_xlsform_file_id?: string;
  use_canonical_xlsform_logic?: boolean;
  surveymonkey_logic_rules?: string;
  surveymonkey_logic_rules_by_survey?: Record<string, string>;
  logic_pages?: Record<string, string[]>;
  choice_order_overrides?: Record<string, string[]>;
  choice_code_maps?: ChoiceCodeMap[];
  replace_existing_logic?: boolean;
}) {
  return handle<{
    ok: true;
    processing_mode: "independent_siblings";
    active_base: string | null;
    bases: EstudioBase[];
    n_bases: number;
    estudio: EstudioPayload;
    audit: SurveyMonkeyMultibaseAudit;
    xlsform_logic_sync?: EstudioLogicSyncResult | null;
  }>(
    await apiFetch("/api/surveymonkey/multibase/import-independent", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseApplyCanonicalXlsformLogic(payload: {
  canonical_xlsform_file_id?: string;
  targets?: string[];
  clear_target_logic?: boolean;
}) {
  return handle<EstudioLogicSyncResult>(
    await apiFetch("/api/surveymonkey/multibase/apply-canonical-xlsform-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

function normalizeWorkbookStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "")).filter(Boolean);
}

function normalizeWorkbookNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function normalizeWorkbookInspection(raw: unknown): SurveyMonkeyWorkbookInspection {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sheets = normalizeRecordArray(r.sheets).map((sheet): SurveyMonkeyWorkbookSheetInspection => ({
    sheet_name: String(sheet.sheet_name ?? ""),
    base_name: sheet.base_name == null || sheet.base_name === "NA" ? null : String(sheet.base_name),
    matched: Boolean(sheet.matched),
    blocking: Boolean(sheet.blocking),
    n_rows: Number(sheet.n_rows ?? 0),
    n_columns: Number(sheet.n_columns ?? 0),
    n_output_columns: sheet.n_output_columns == null || sheet.n_output_columns === "NA" ? undefined : Number(sheet.n_output_columns),
    recognized_headers: Number(sheet.recognized_headers ?? 0),
    mapped_headers: normalizeRecordArray(sheet.mapped_headers).map((header): SurveyMonkeyWorkbookMappedHeader => ({
      source: String(header.source ?? ""),
      kind: String(header.kind ?? ""),
      variable: header.variable == null || header.variable === "NA" ? undefined : String(header.variable),
      code: header.code == null || header.code === "NA" ? undefined : String(header.code),
      columns: normalizeWorkbookStringArray(header.columns),
    })),
    unknown_headers: normalizeWorkbookStringArray(sheet.unknown_headers),
    ambiguous_headers: normalizeWorkbookStringArray(sheet.ambiguous_headers),
    missing_variables: normalizeWorkbookStringArray(sheet.missing_variables),
    blank_filled_variables: normalizeWorkbookStringArray(sheet.blank_filled_variables),
    cell_errors: normalizeRecordArray(sheet.cell_errors).map((err): SurveyMonkeyWorkbookCellError => ({
      source: String(err.source ?? ""),
      kind: String(err.kind ?? ""),
      variable: err.variable == null || err.variable === "NA" ? undefined : String(err.variable),
      code: err.code == null || err.code === "NA" ? undefined : String(err.code),
      n_errors: Number(err.n_errors ?? 0),
      rows: normalizeWorkbookNumberArray(err.rows),
    })),
    n_cell_errors: sheet.n_cell_errors == null || sheet.n_cell_errors === "NA" ? undefined : Number(sheet.n_cell_errors),
    warnings: normalizeWorkbookStringArray(sheet.warnings),
  }));
  return {
    ok: Boolean(r.ok),
    file_id: String(r.file_id ?? ""),
    filename: String(r.filename ?? ""),
    n_sheets: Number(r.n_sheets ?? sheets.length),
    n_matched: Number(r.n_matched ?? sheets.filter((sheet) => sheet.matched && !sheet.blocking).length),
    n_blocking: Number(r.n_blocking ?? sheets.filter((sheet) => sheet.blocking).length),
    blocking_sheets: normalizeWorkbookStringArray(r.blocking_sheets),
    sheets,
    warnings: normalizeWorkbookStringArray(r.warnings),
  };
}

export async function apiSurveyMonkeyMultibaseWorkbookInspect(payload: {
  file_id: string;
  sheet_base_map?: Record<string, string>;
  missing_required_policy?: "fill_blank_warn" | string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/workbook/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return normalizeWorkbookInspection(raw);
}

export async function apiSurveyMonkeyMultibaseWorkbookImport(payload: {
  file_id: string;
  sheet_base_map?: Record<string, string>;
  missing_required_policy?: "fill_blank_warn" | string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/workbook/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(r.ok) as true,
    file_id: String(r.file_id ?? payload.file_id),
    filename: String(r.filename ?? ""),
    imported_bases: Number(r.imported_bases ?? 0),
    results: normalizeRecordArray(r.results).map((row) => ({
      base_name: String(row.base_name ?? ""),
      sheet_name: String(row.sheet_name ?? ""),
      data_file_id: String(row.data_file_id ?? ""),
      snapshot_file_id: String(row.snapshot_file_id ?? ""),
      n_rows: Number(row.n_rows ?? 0),
      n_columns: Number(row.n_columns ?? 0),
      warnings: normalizeWorkbookStringArray(row.warnings),
      base: row.base as EstudioBase | undefined,
    })),
    inspection: normalizeWorkbookInspection(r.inspection),
    estudio: r.estudio as EstudioPayload,
  } satisfies SurveyMonkeyWorkbookImportResult;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === "NA") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSavBundleChangePlan(raw: unknown): SurveyMonkeySavBundleChangePlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const current = (r.current ?? {}) as Record<string, unknown>;
  const incoming = (r.incoming ?? {}) as Record<string, unknown>;
  const impact = (r.impact ?? {}) as Record<string, unknown>;
  const effects = (r.effects ?? {}) as Record<string, unknown>;
  return {
    action: String(r.action ?? "replace_data"),
    base_name: String(r.base_name ?? ""),
    source_file: String(r.source_file ?? ""),
    current: {
      n_rows: nullableNumber(current.n_rows),
      n_columns: nullableNumber(current.n_columns),
      data_file_id: String(current.data_file_id ?? ""),
      xlsform_file_id: String(current.xlsform_file_id ?? ""),
    },
    incoming: {
      raw_rows: Number(incoming.raw_rows ?? 0),
      raw_columns: Number(incoming.raw_columns ?? 0),
      normalized_rows: Number(incoming.normalized_rows ?? 0),
      normalized_columns: Number(incoming.normalized_columns ?? 0),
    },
    impact: {
      rows_delta: nullableNumber(impact.rows_delta),
      columns_delta: nullableNumber(impact.columns_delta),
      expected_variables: Number(impact.expected_variables ?? 0),
      matched_variables: Number(impact.matched_variables ?? 0),
      missing_variables: normalizeWorkbookStringArray(impact.missing_variables),
      blank_filled_variables: normalizeWorkbookStringArray(impact.blank_filled_variables),
      all_empty_variables: normalizeWorkbookStringArray(impact.all_empty_variables),
      metadata_columns: normalizeWorkbookStringArray(impact.metadata_columns),
    },
    effects: {
      xlsform: String(effects.xlsform ?? "preserved"),
      data: String(effects.data ?? "replaced"),
      invalidates: normalizeWorkbookStringArray(effects.invalidates),
    },
  };
}

function normalizeSavBundleInspection(raw: unknown): SurveyMonkeySavBundleInspection {
  const r = (raw ?? {}) as Record<string, unknown>;
  const files = normalizeRecordArray(r.files).map((file): SurveyMonkeySavBundleFileInspection => ({
    file_name: String(file.file_name ?? ""),
    entry_name: String(file.entry_name ?? ""),
    base_name: file.base_name == null || file.base_name === "NA" ? null : String(file.base_name),
    matched: Boolean(file.matched),
    blocking: Boolean(file.blocking),
    action: String(file.action ?? "replace_data"),
    n_rows: Number(file.n_rows ?? 0),
    n_columns: Number(file.n_columns ?? 0),
    n_output_columns: Number(file.n_output_columns ?? 0),
    expected_variables: Number(file.expected_variables ?? 0),
    matched_variables: Number(file.matched_variables ?? 0),
    missing_variables: normalizeWorkbookStringArray(file.missing_variables),
    blank_filled_variables: normalizeWorkbookStringArray(file.blank_filled_variables),
    all_empty_variables: normalizeWorkbookStringArray(file.all_empty_variables),
    metadata_columns: normalizeWorkbookStringArray(file.metadata_columns),
    warnings: normalizeWorkbookStringArray(file.warnings),
    change_plan: normalizeSavBundleChangePlan(file.change_plan),
  }));
  return {
    ok: Boolean(r.ok),
    file_id: String(r.file_id ?? ""),
    filename: String(r.filename ?? ""),
    n_files: Number(r.n_files ?? files.length),
    n_matched: Number(r.n_matched ?? files.filter((file) => file.matched && !file.blocking).length),
    n_blocking: Number(r.n_blocking ?? files.filter((file) => file.blocking).length),
    blocking_files: normalizeWorkbookStringArray(r.blocking_files),
    files,
    change_plan: files,
    warnings: normalizeWorkbookStringArray(r.warnings),
  };
}

export async function apiSurveyMonkeyMultibaseSavBundleInspect(payload: {
  file_id: string;
  file_base_map?: Record<string, string>;
  missing_required_policy?: "fill_blank_warn" | string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/sav-bundle/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return normalizeSavBundleInspection(raw);
}

export async function apiSurveyMonkeyMultibaseSavBundleImport(payload: {
  file_id: string;
  file_base_map?: Record<string, string>;
  missing_required_policy?: "fill_blank_warn" | string;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/surveymonkey/multibase/sav-bundle/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(r.ok) as true,
    file_id: String(r.file_id ?? payload.file_id),
    filename: String(r.filename ?? ""),
    imported_bases: Number(r.imported_bases ?? 0),
    results: normalizeRecordArray(r.results).map((row) => ({
      base_name: String(row.base_name ?? ""),
      file_name: String(row.file_name ?? ""),
      entry_name: String(row.entry_name ?? ""),
      data_file_id: String(row.data_file_id ?? ""),
      snapshot_file_id: String(row.snapshot_file_id ?? ""),
      n_rows: Number(row.n_rows ?? 0),
      n_columns: Number(row.n_columns ?? 0),
      warnings: normalizeWorkbookStringArray(row.warnings),
      change_plan: normalizeSavBundleChangePlan(row.change_plan),
      base: row.base as EstudioBase | undefined,
    })),
    inspection: normalizeSavBundleInspection(r.inspection),
    estudio: r.estudio as EstudioPayload,
  } satisfies SurveyMonkeySavBundleImportResult;
}

export async function apiSurveyMonkeyMultibaseDecisionPreview(payload: {
  base_name: string;
  policy?: SurveyMonkeyDecisionPolicy | null;
}) {
  return handle<{
    ok: true;
    base_name: string;
    policy: SurveyMonkeyDecisionPolicy;
    audit: SurveyMonkeyDecisionAudit;
    n_filas_preview: number;
    n_columnas_preview: number;
  }>(
    await apiFetch("/api/surveymonkey/multibase/decision-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseDecisionApply(payload: {
  base_name: string;
  policy?: SurveyMonkeyDecisionPolicy | null;
  regenerate_data?: boolean;
  force_replace_adapted?: boolean;
}) {
  return handle<{
    ok: true;
    base_name: string;
    policy: SurveyMonkeyDecisionPolicy;
    audit: SurveyMonkeyDecisionAudit;
    generated_file_id?: string | null;
    replaced_active?: boolean;
    kept_adapted_data?: boolean;
    kept_downstream_data?: boolean;
    estudio: EstudioPayload;
  }>(
    await apiFetch("/api/surveymonkey/multibase/decision-apply", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseRefreshPlan(payload: {
  bases?: SurveyMonkeyRefreshSelection[];
  months?: number;
  force_refresh?: boolean;
} = {}) {
  return handle<SurveyMonkeyRefreshPlan>(
    await apiFetch("/api/surveymonkey/multibase/refresh-plan", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiSurveyMonkeyMultibaseRefresh(payload: {
  bases?: SurveyMonkeyRefreshSelection[];
  months?: number;
  force_refresh?: boolean;
  reapply_codificacion?: boolean;
  regenerate_raw_snapshot?: boolean;
  raw_snapshot_only?: boolean;
}) {
  return handle<SurveyMonkeyRefreshResult>(
    await apiFetch("/api/surveymonkey/multibase/refresh", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

// ============================================================================
// Multi integrado generico: instrumentos hermanos -> una base + XLSForm comun
// ============================================================================

export type MultiIntegratedOrigin = {
  source_kind: "manual" | "surveymonkey";
  key_value: string;
  label?: string;
  xlsform_file_id?: string;
  data_file_id?: string;
  survey_id?: string;
};

export type MultiIntegratedDiff = {
  id: string;
  origin_id: string;
  source_kind: "manual" | "surveymonkey" | string;
  origin_key: string;
  ref_origin_id?: string;
  ref_origin_key?: string;
  variable: string;
  pos: number | null;
  kind: string;
  severity: "info" | "review" | "blocking" | string;
  message: string;
  ref: string;
  current: string;
  needs_decision: boolean;
  suggested_name: string;
  suggested_label: string;
};

export type MultiIntegratedAudit = {
  ok: boolean;
  origin_key_name: string;
  guide: { file_id: string; original_name: string };
  origins: Array<MultiIntegratedOrigin & { id: string }>;
  n_origins: number;
  n_pending: number;
  n_blocking: number;
  n_info: number;
  company_variables: string[];
  diffs: MultiIntegratedDiff[];
};

export type MultiIntegratedDecisions = {
  resolved_ids?: string[];
  label_overrides?: Record<string, string>;
  variant_names?: Record<string, string>;
};

export type MultiIntegratedDraft = {
  version?: number;
  source_mode?: "manual" | "surveymonkey";
  guide_xlsform_file_id?: string;
  guide_options?: Array<{ fileId?: string; file_id?: string; label?: string }>;
  guide_survey_id?: string;
  origin_key_name?: string;
  base_name?: string;
  query?: string;
  rows?: Array<MultiIntegratedOrigin & {
    localId?: string;
    local_id?: string;
    xlsformFileName?: string;
    xlsform_file_name?: string;
    dataFileName?: string;
    data_file_name?: string;
    surveyTitle?: string;
    survey_title?: string;
  }>;
  audit?: MultiIntegratedAudit | null;
  decisions?: MultiIntegratedDecisions;
  updated_at?: string;
};

function normalizeMultiIntegratedAudit(raw: unknown): MultiIntegratedAudit {
  const r = (raw ?? {}) as Record<string, unknown>;
  const diffsRaw = Array.isArray(r.diffs) ? r.diffs as Record<string, unknown>[] : [];
  const originsRaw = Array.isArray(r.origins) ? r.origins as Record<string, unknown>[] : [];
  return {
    ok: Boolean(r.ok),
    origin_key_name: String(r.origin_key_name ?? "origen"),
    guide: {
      file_id: String((r.guide as Record<string, unknown> | undefined)?.file_id ?? ""),
      original_name: String((r.guide as Record<string, unknown> | undefined)?.original_name ?? ""),
    },
    origins: originsRaw.map((o) => ({
      id: String(o.id ?? ""),
      source_kind: (String(o.source_kind ?? "manual") as "manual" | "surveymonkey"),
      key_value: String(o.key_value ?? ""),
      label: String(o.label ?? ""),
      xlsform_file_id: String(o.xlsform_file_id ?? ""),
      data_file_id: String(o.data_file_id ?? ""),
      survey_id: String(o.survey_id ?? ""),
    })),
    n_origins: Number(r.n_origins ?? originsRaw.length),
    n_pending: Number(r.n_pending ?? 0),
    n_blocking: Number(r.n_blocking ?? 0),
    n_info: Number(r.n_info ?? 0),
    company_variables: Array.isArray(r.company_variables) ? r.company_variables.map(String) : [],
    diffs: diffsRaw.map((d) => ({
      id: String(d.id ?? ""),
      origin_id: String(d.origin_id ?? ""),
      source_kind: String(d.source_kind ?? ""),
      origin_key: String(d.origin_key ?? ""),
      ref_origin_id: String(d.ref_origin_id ?? ""),
      ref_origin_key: String(d.ref_origin_key ?? ""),
      variable: String(d.variable ?? ""),
      pos: d.pos == null ? null : Number(d.pos),
      kind: String(d.kind ?? ""),
      severity: String(d.severity ?? "review"),
      message: String(d.message ?? ""),
      ref: String(d.ref ?? ""),
      current: String(d.current ?? ""),
      needs_decision: Boolean(d.needs_decision),
      suggested_name: String(d.suggested_name ?? ""),
      suggested_label: String(d.suggested_label ?? ""),
    })),
  };
}

function normalizeMultiIntegratedDraft(raw: unknown): MultiIntegratedDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rowsRaw = Array.isArray(r.rows) ? r.rows as Record<string, unknown>[] : [];
  const guideOptionsRaw = Array.isArray(r.guide_options) ? r.guide_options as Record<string, unknown>[] : [];
  const audit = r.audit && typeof r.audit === "object" ? normalizeMultiIntegratedAudit(r.audit) : null;
  const decisionsRaw = (r.decisions ?? {}) as Record<string, unknown>;
  return {
    version: Number(r.version ?? 1),
    source_mode: String(r.source_mode ?? "manual") === "surveymonkey" ? "surveymonkey" : "manual",
    guide_xlsform_file_id: String(r.guide_xlsform_file_id ?? ""),
    guide_options: guideOptionsRaw.map((option) => ({
      fileId: String(option.fileId ?? option.file_id ?? ""),
      file_id: String(option.file_id ?? option.fileId ?? ""),
      label: String(option.label ?? ""),
    })),
    guide_survey_id: String(r.guide_survey_id ?? ""),
    origin_key_name: String(r.origin_key_name ?? "origen"),
    base_name: String(r.base_name ?? "base_integrada"),
    query: String(r.query ?? ""),
    rows: rowsRaw.map((row) => ({
      source_kind: String(row.source_kind ?? "manual") === "surveymonkey" ? "surveymonkey" : "manual",
      key_value: String(row.key_value ?? ""),
      label: String(row.label ?? ""),
      xlsform_file_id: String(row.xlsform_file_id ?? ""),
      data_file_id: String(row.data_file_id ?? ""),
      survey_id: String(row.survey_id ?? ""),
      localId: String(row.localId ?? row.local_id ?? ""),
      xlsformFileName: String(row.xlsformFileName ?? row.xlsform_file_name ?? ""),
      dataFileName: String(row.dataFileName ?? row.data_file_name ?? ""),
      surveyTitle: String(row.surveyTitle ?? row.survey_title ?? ""),
    })),
    audit,
    decisions: {
      resolved_ids: Array.isArray(decisionsRaw.resolved_ids) ? decisionsRaw.resolved_ids.map(String) : [],
      label_overrides: (decisionsRaw.label_overrides ?? {}) as Record<string, string>,
      variant_names: (decisionsRaw.variant_names ?? {}) as Record<string, string>,
    },
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function apiMultiIntegratedAudit(payload: {
  guide_xlsform_file_id: string;
  origin_key_name: string;
  origins: MultiIntegratedOrigin[];
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/multi/integrated/audit", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return normalizeMultiIntegratedAudit(raw);
}

export async function apiMultiIntegratedImport(payload: {
  guide_xlsform_file_id: string;
  origin_key_name: string;
  origins: MultiIntegratedOrigin[];
  base_name?: string;
  decisions?: MultiIntegratedDecisions;
}) {
  const raw = await handle<unknown>(
    await apiFetch("/api/multi/integrated/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  ) as Record<string, unknown>;
  return {
    ok: true as const,
    base: raw.base as EstudioBase,
    estudio: raw.estudio as EstudioPayload,
    audit: normalizeMultiIntegratedAudit(raw.audit),
    n_filas: Number(raw.n_filas ?? 0),
    n_columnas: Number(raw.n_columnas ?? 0),
  };
}

export async function apiMultiIntegratedDecisionsDocx(payload: {
  audit: MultiIntegratedAudit;
  decisions?: MultiIntegratedDecisions;
}): Promise<Blob> {
  const res = await apiFetch("/api/multi/integrated/decisions-docx", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(raw || `Descarga falló (${res.status})`);
  }
  return await res.blob();
}

export async function apiMultiIntegratedDraftGet() {
  const raw = await handle<{ ok: true; draft?: unknown }>(
    await apiFetch("/api/multi/integrated/draft", { headers: headers() }),
  );
  return normalizeMultiIntegratedDraft(raw.draft);
}

export async function apiMultiIntegratedDraftSave(draft: MultiIntegratedDraft, persistProject = false) {
  const raw = await handle<{ ok: true; draft?: unknown; project?: { saved?: boolean; error?: string; reason?: string; saved_at?: string } }>(
    await apiFetch("/api/multi/integrated/draft", {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ draft, persist_project: persistProject }),
    }),
  );
  return {
    ok: true as const,
    draft: normalizeMultiIntegratedDraft(raw.draft),
    project: raw.project ?? null,
  };
}

export async function apiMultiIntegratedDraftClear(persistProject = false) {
  return handle<{ ok: true }>(
    await apiFetch(`/api/multi/integrated/draft?persist_project=${persistProject ? "true" : "false"}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

export type XlsformEditorSheet = {
  name?: string | null;
  columns: string[];
  rows: string[][];
};

export type SurveyMonkeyVisualLogicAction =
  | { kind: "none" }
  | { kind: "page_top"; pageId: string; pageLabel: string }
  | { kind: "question"; pageId: string; pageLabel: string; targetRef: string; targetLabel: string }
  | { kind: "end" };

export type SurveyMonkeyVisualLogicRule = {
  id: string;
  variableRef: string;
  variableLabel: string;
  choices: Array<{
    choiceName: string;
    choiceLabel: string;
    choiceIndex: number;
    action: SurveyMonkeyVisualLogicAction;
  }>;
};

export type SurveyMonkeyLogicState = {
  rules?: Array<{
    id: string;
    texto: string;
    texto_humano: string;
    kobo_expr?: string;
  }>;
  advanced_rules: Array<{
    id: string;
    texto: string;
    texto_humano: string;
    kobo_expr?: string;
  }>;
  visual_rules: SurveyMonkeyVisualLogicRule[];
  choice_order_overrides: Record<string, string[]>;
  choice_code_maps?: ChoiceCodeMap[];
};

export type XlsformEditorWorkbook = {
  survey: XlsformEditorSheet;
  choices: XlsformEditorSheet;
  settings: XlsformEditorSheet;
  paper?: XlsformEditorSheet | null;
  diagnostico?: XlsformEditorSheet | null;
  surveyMonkeyLogic?: SurveyMonkeyLogicState | null;
};

export type XlsformEditorPayload = {
  ok: true;
  workbook: XlsformEditorWorkbook;
  summary: {
    survey_rows: number;
    choices_rows: number;
    settings_rows: number;
    paper_rows?: number;
    diagnostico_rows: number;
  };
  source: {
    kind: string | null;
    original_name: string | null;
    survey_id?: string | null;
    survey_title?: string | null;
    translated_at?: string | null;
  };
  warnings: string[];
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => (item == null ? "" : String(item)));
  if (value == null) return [];
  return [String(value)];
}

function normalizeSheet(value: unknown, fallbackName?: string): XlsformEditorSheet {
  const raw = (value ?? {}) as Record<string, unknown>;
  const rowsRaw = Array.isArray(raw.rows) ? raw.rows : [];
  return collapseMultilingualColumns({
    name: typeof raw.name === "string" ? raw.name : (fallbackName ?? null),
    columns: asStringArray(raw.columns),
    rows: rowsRaw.map((row) => asStringArray(row)),
  });
}

function collapseMultilingualColumns(sheet: XlsformEditorSheet): XlsformEditorSheet {
  const multilingualBases = new Set(["label", "hint", "constraint_message", "required_message"]);
  const aliasEntries = sheet.columns
    .map((column) => {
      const match = /^(label|hint|constraint_message|required_message)::(.+)$/i.exec(column);
      if (!match) return null;
      const base = match[1].toLowerCase();
      if (!multilingualBases.has(base)) return null;
      return { from: column, to: base, lang: match[2].toLowerCase() };
    })
    .filter((entry): entry is { from: string; to: string; lang: string } => Boolean(entry));
  if (!aliasEntries.length) return sheet;

  const columns = [...sheet.columns];
  for (const { to } of aliasEntries) {
    if (!columns.includes(to)) columns.push(to);
  }
  const drop = new Set(aliasEntries.map(({ from }) => from));
  const keptColumns = columns.filter((column) => !drop.has(column));

  const originalIndex = new Map(sheet.columns.map((column, index) => [column, index]));
  const rows = sheet.rows.map((row) => {
    const values = new Map<string, string>();
    sheet.columns.forEach((column, index) => {
      values.set(column, row[index] ?? "");
    });
    const grouped = new Map<string, Array<{ from: string; lang: string }>>();
    for (const entry of aliasEntries) {
      grouped.set(entry.to, [...(grouped.get(entry.to) ?? []), { from: entry.from, lang: entry.lang }]);
    }
    for (const [to, candidatesRaw] of grouped) {
      const candidates = [...candidatesRaw].sort((a, b) => {
        if (a.lang === "es") return -1;
        if (b.lang === "es") return 1;
        return a.from.localeCompare(b.from);
      });
      const firstValue = candidates
        .map(({ from }) => row[originalIndex.get(from) ?? -1] ?? "")
        .find((cell) => Boolean(cell));
      if (firstValue) {
        values.set(to, firstValue);
      } else if (!values.get(to)) {
        values.set(to, "");
      }
    }
    return keptColumns.map((column) => values.get(column) ?? "");
  });

  return { ...sheet, columns: keptColumns, rows };
}

function normalizeEditorPayload(value: unknown): XlsformEditorPayload {
  const raw = (value ?? {}) as Record<string, unknown>;
  const workbookRaw = (raw.workbook ?? {}) as Record<string, unknown>;
  const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>;
  const sourceRaw = (raw.source ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    workbook: {
      survey: normalizeSheet(workbookRaw.survey, "survey"),
      choices: normalizeSheet(workbookRaw.choices, "choices"),
      settings: normalizeSheet(workbookRaw.settings, "settings"),
      paper: workbookRaw.paper ? normalizeSheet(workbookRaw.paper, "paper") : null,
      diagnostico: workbookRaw.diagnostico ? normalizeSheet(workbookRaw.diagnostico, "diagnostico") : null,
      surveyMonkeyLogic: normalizeSurveyMonkeyLogicState(workbookRaw.surveyMonkeyLogic ?? workbookRaw.survey_monkey_logic),
    },
    summary: {
      survey_rows: Number(summaryRaw.survey_rows ?? 0),
      choices_rows: Number(summaryRaw.choices_rows ?? 0),
      settings_rows: Number(summaryRaw.settings_rows ?? 0),
      paper_rows: Number(summaryRaw.paper_rows ?? 0),
      diagnostico_rows: Number(summaryRaw.diagnostico_rows ?? 0),
    },
    source: {
      kind: sourceRaw.kind == null ? null : String(sourceRaw.kind),
      original_name: sourceRaw.original_name == null ? null : String(sourceRaw.original_name),
      survey_id: sourceRaw.survey_id == null ? null : String(sourceRaw.survey_id),
      survey_title: sourceRaw.survey_title == null ? null : String(sourceRaw.survey_title),
      translated_at: sourceRaw.translated_at == null ? null : String(sourceRaw.translated_at),
    },
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => String(item))
      : [],
  };
}

export async function apiXlsformEditorImport(file_id: string) {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
  return normalizeEditorPayload(raw);
}

export async function apiXlsformEditorImportSurveyMonkey(file_id: string, lang = "es") {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import-surveymonkey", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id, lang }),
    })
  );
  return normalizeEditorPayload(raw);
}

export type SurveyMonkeyChoice = { code: string; label: string };
export type SurveyMonkeyQuestion = {
  name: string;
  name_raw: string;
  group: string;
  label: string | null;
  kind: string;
  choices: SurveyMonkeyChoice[];
};

export type SurveyMonkeyMeta = {
  ok: true;
  n_filas: number;
  preguntas: SurveyMonkeyQuestion[];
};

export async function apiXlsformEditorSavMeta(file_id: string): Promise<SurveyMonkeyMeta> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sav-meta", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    n_filas: Number(r.n_filas ?? 0),
    preguntas: Array.isArray(r.preguntas)
      ? (r.preguntas as Record<string, unknown>[]).map((p) => ({
          name: String(p.name ?? ""),
          name_raw: String(p.name_raw ?? ""),
          group: String(p.group ?? ""),
          label: p.label == null ? null : String(p.label),
          kind: String(p.kind ?? ""),
          choices: Array.isArray(p.choices)
            ? (p.choices as Record<string, unknown>[]).map((c) => ({
                code: String(c.code ?? ""),
                label: String(c.label ?? ""),
              }))
            : [],
        }))
      : [],
  };
}

export type Hallazgo = {
  target: string;
  severity: "warn" | "info";
  kind: "regla_violada" | "baja_completitud";
  mensaje: string;
  coverage_oculta: number | null;
  tasa_respuesta: number | null;
  inconsistencias: number[];
};

export type EditorPayloadWithHallazgos = XlsformEditorPayload & {
  hallazgos: Hallazgo[];
};

// El token vive en backend: persistido cifrado en disco local o efímero por
// sesión. El frontend solo muestra estado/máscara y nunca recibe el secreto.
export type SurveyMonkeyTokenState = {
  ok: true;
  has_token: boolean;
  masked_token: string;
  persisted: boolean;
  ephemeral: boolean;
  active_profile_id?: string;
  active_profile_alias?: string;
  active_profile_base_url?: string;
  active_profile_server_label?: string;
  profile_count?: number;
  profiles?: ConnectionProfileState[];
};

export type ConnectionProvider = "surveymonkey" | "kobo" | "google_sheets";

export type ConnectionProfileState = {
  id: string;
  alias: string;
  is_default: boolean;
  has_token: boolean;
  masked_token: string;
  base_url?: string;
  server_label?: string;
  updated_at?: string;
  legacy?: boolean;
};

export type ConnectionTokenState = SurveyMonkeyTokenState & {
  provider: ConnectionProvider;
  label: string;
};

export type ConnectionCheckResult =
  | {
      ok: true;
      provider?: ConnectionProvider;
      status_code: number;
      n_surveys_visible?: number | null;
      count?: number | null;
      base_url?: string;
      profile_id?: string;
    }
  | {
      ok: false;
      provider?: ConnectionProvider;
      status_code?: number;
      error: string;
    };

function normalizeConnectionProvider(value: unknown): ConnectionProvider {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "kobo" || raw === "kobotoolbox") return "kobo";
  if (raw === "google_sheets" || raw === "googlesheets" || raw === "sheets" || raw === "google") return "google_sheets";
  return "surveymonkey";
}

function normalizeConnectionTokenState(raw: unknown, providerHint: ConnectionProvider): ConnectionTokenState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const provider = normalizeConnectionProvider(r.provider ?? providerHint);
  const profiles = Array.isArray(r.profiles) ? r.profiles.map(normalizeConnectionProfileState) : [];
  return {
    ok: true,
    provider,
    label: String(r.label ?? (provider === "kobo" ? "KoboToolbox" : provider === "google_sheets" ? "Google Sheets" : "SurveyMonkey")),
    has_token: r.has_token === true,
    masked_token: String(r.masked_token ?? ""),
    persisted: r.persisted === true,
    ephemeral: r.ephemeral === true,
    active_profile_id: r.active_profile_id == null ? "" : String(r.active_profile_id),
    active_profile_alias: r.active_profile_alias == null ? "" : String(r.active_profile_alias),
    active_profile_base_url: r.active_profile_base_url == null ? "" : String(r.active_profile_base_url),
    active_profile_server_label: r.active_profile_server_label == null ? "" : String(r.active_profile_server_label),
    profile_count: r.profile_count == null ? profiles.length : Number(r.profile_count),
    profiles,
  };
}

function normalizeConnectionProfileState(raw: unknown): ConnectionProfileState {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    alias: String(r.alias ?? "Principal"),
    is_default: r.is_default === true,
    has_token: r.has_token === true,
    masked_token: String(r.masked_token ?? ""),
    base_url: r.base_url == null ? "" : String(r.base_url),
    server_label: r.server_label == null ? "" : String(r.server_label),
    updated_at: r.updated_at == null ? "" : String(r.updated_at),
    legacy: r.legacy === true,
  };
}

function normalizeSurveyMonkeyTokenState(raw: unknown): SurveyMonkeyTokenState {
  const state = normalizeConnectionTokenState(raw, "surveymonkey");
  return {
    ok: true,
    has_token: state.has_token,
    masked_token: state.masked_token,
    persisted: state.persisted,
    ephemeral: state.ephemeral,
    active_profile_id: state.active_profile_id,
    active_profile_alias: state.active_profile_alias,
    active_profile_base_url: state.active_profile_base_url,
    active_profile_server_label: state.active_profile_server_label,
    profile_count: state.profile_count,
    profiles: state.profiles,
  };
}

export async function apiConnectionsList(): Promise<{ ok: true; connections: ConnectionTokenState[] }> {
  const raw = await handle<unknown>(
    await apiFetch("/api/connections", {
      method: "GET",
      headers: headers(),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.connections) ? r.connections : [];
  return {
    ok: true,
    connections: arr.map((item) =>
      normalizeConnectionTokenState(item, normalizeConnectionProvider((item as Record<string, unknown> | null)?.provider)),
    ),
  };
}

export async function apiConnectionTokenLoad(provider: ConnectionProvider): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/token`, {
      method: "GET",
      headers: headers(),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionTokenSave(
  provider: ConnectionProvider,
  token: string,
  options: { persist?: boolean } = {},
): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/token`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ token, persist: options.persist !== false }),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionGoogleSheetsConnect(oauth: unknown, redirectUri?: string) {
  return handle<MonitoreoSheetsConnectResult>(
    await apiFetch("/api/connections/google_sheets/oauth", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ oauth, redirect_uri: redirectUri }),
    }),
  );
}

export async function apiConnectionTokenClear(provider: ConnectionProvider): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/token`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionProfilesList(
  provider: ConnectionProvider,
): Promise<{ ok: true; provider: ConnectionProvider; default_profile_id: string; profiles: ConnectionProfileState[] }> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles`, {
      method: "GET",
      headers: headers(),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    provider,
    default_profile_id: String(r.default_profile_id ?? ""),
    profiles: Array.isArray(r.profiles) ? r.profiles.map(normalizeConnectionProfileState) : [],
  };
}

export async function apiConnectionProfileSave(
  provider: ConnectionProvider,
  token: string,
  options: { alias?: string; profile_id?: string; make_default?: boolean; base_url?: string; server_label?: string } = {},
): Promise<ConnectionTokenState> {
  const body: Record<string, unknown> = {
    token,
    alias: options.alias ?? "",
    profile_id: options.profile_id ?? "",
    make_default: options.make_default !== false,
  };
  if (options.base_url != null) body.base_url = options.base_url;
  if (options.server_label != null) body.server_label = options.server_label;
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionProfileSetDefault(
  provider: ConnectionProvider,
  profileId: string,
): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles/${encodeURIComponent(profileId)}/default`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: "{}",
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionProfileDelete(
  provider: ConnectionProvider,
  profileId: string,
): Promise<ConnectionTokenState> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/profiles/${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
  return normalizeConnectionTokenState(raw, provider);
}

export async function apiConnectionCheck(
  provider: ConnectionProvider,
  options: { base_url?: string; profile_id?: string } = {},
): Promise<ConnectionCheckResult> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/connections/${provider}/check`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(options),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      provider,
      status_code: Number(r.status_code ?? 200),
      n_surveys_visible: r.n_surveys_visible == null || r.n_surveys_visible === "NA"
        ? null
        : Number(r.n_surveys_visible),
      count: r.count == null || r.count === "NA" ? null : Number(r.count),
      base_url: r.base_url == null ? "" : String(r.base_url),
      profile_id: r.profile_id == null ? "" : String(r.profile_id),
    };
  }
  return {
    ok: false,
    provider,
    status_code: r.status_code == null ? undefined : Number(r.status_code),
    error: String(r.error ?? "No se pudo verificar la conexión"),
  };
}

export async function apiXlsformEditorSmTokenLoad(): Promise<SurveyMonkeyTokenState> {
  return normalizeSurveyMonkeyTokenState(await apiConnectionTokenLoad("surveymonkey"));
}

export async function apiXlsformEditorSmTokenSave(
  token: string,
  options: { persist?: boolean } = {},
): Promise<SurveyMonkeyTokenState> {
  return normalizeSurveyMonkeyTokenState(await apiConnectionTokenSave("surveymonkey", token, options));
}

export async function apiXlsformEditorSmTokenClear(): Promise<SurveyMonkeyTokenState> {
  return normalizeSurveyMonkeyTokenState(await apiConnectionTokenClear("surveymonkey"));
}

export type SurveyMonkeyTokenInfo =
  | { ok: true; status_code: number; n_surveys_visible: number | null }
  | { ok: false; status_code?: number; error: string };

export async function apiXlsformEditorSmCheckToken(): Promise<SurveyMonkeyTokenInfo> {
  const raw = await apiConnectionCheck("surveymonkey");
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      status_code: Number(r.status_code ?? 200),
      n_surveys_visible: r.n_surveys_visible == null || r.n_surveys_visible === "NA"
        ? null
        : Number(r.n_surveys_visible),
    };
  }
  return {
    ok: false,
    status_code: r.status_code == null ? undefined : Number(r.status_code),
    error: String(r.error ?? "Token inválido"),
  };
}

export type SurveyMonkeyListItem = {
  id: string;
  title: string;
  nickname: string | null;
  date_modified: string | null;
};

export async function apiXlsformEditorSmListSurveys(
  limit = 500,
  months = 6,
  options: { forceRefresh?: boolean } = {},
): Promise<{
  ok: true;
  count: number;
  total_visible: number;
  total_recent: number;
  months: number;
  from_cache: boolean;
  cache_status: string;
  refresh_error: string;
  catalog_fetched_at: string | null;
  catalog_age_seconds: number | null;
  catalog_count: number;
  surveys: SurveyMonkeyListItem[];
}> {
  const payload: Record<string, unknown> = { limit, months };
  if (options.forceRefresh) payload.force_refresh = true;
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-list-surveys", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.surveys) ? (r.surveys as Record<string, unknown>[]) : [];
  return {
    ok: true,
    count: Number(r.count ?? arr.length),
    total_visible: Number(r.total_visible ?? arr.length),
    total_recent: Number(r.total_recent ?? arr.length),
    months: Number(r.months ?? months),
    from_cache: Boolean(r.from_cache),
    cache_status: String(r.cache_status ?? ""),
    refresh_error: String(r.refresh_error ?? ""),
    catalog_fetched_at: r.catalog_fetched_at == null || r.catalog_fetched_at === "NA" ? null : String(r.catalog_fetched_at),
    catalog_age_seconds: r.catalog_age_seconds == null || r.catalog_age_seconds === "NA" ? null : Number(r.catalog_age_seconds),
    catalog_count: Number(r.catalog_count ?? r.total_visible ?? arr.length),
    surveys: arr.map((s) => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? "(sin título)"),
      nickname: s.nickname == null || s.nickname === "NA" ? null : String(s.nickname),
      date_modified: s.date_modified == null || s.date_modified === "NA" ? null : String(s.date_modified),
    })),
  };
}

export type SurveyMonkeyApiInfo = {
  ok: true;
  paginas: Record<string, string[]>;
  pages: Array<{
    page_id: string;
    title: string | null;
    label: string;
    range_label: string;
    question_count: number;
    notes: string[];
    questions: string[];
    question_details: Array<{
      name: string;
      heading: string | null;
      family: string | null;
      subtype: string | null;
      choices: SurveyMonkeyChoice[];
      children: Array<{
        name: string;
        heading: string | null;
        type: string | null;
        list_name: string | null;
      }>;
    }>;
  }>;
  summary: {
    title: string | null;
    language: string | null;
    n_paginas: number;
    n_preguntas: number;
    n_required: number;
    n_validation: number;
  };
  style: { prefix: string; pad: number };
};

export async function apiXlsformEditorSmFetchSurveyInfo(
  file_id: string | null,
  survey_id: string,
): Promise<SurveyMonkeyApiInfo> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-fetch-survey-info", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: file_id ?? "", survey_id }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  const paginasRaw = (r.paginas ?? {}) as Record<string, unknown>;
  const pagesRaw = Array.isArray(r.pages) ? (r.pages as Record<string, unknown>[]) : [];
  const summaryRaw = (r.summary ?? {}) as Record<string, unknown>;
  const styleRaw = (r.style ?? {}) as Record<string, unknown>;
  const paginas: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(paginasRaw)) {
    paginas[k] = normalizeStringArray(v);
  }
  return {
    ok: true,
    paginas,
    pages: pagesRaw.map((p) => {
      const details = normalizeRecordArray(p.question_details).map((q) => ({
        name: String(q.name ?? ""),
        heading: q.heading == null || q.heading === "NA" ? null : String(q.heading),
        family: q.family == null || q.family === "NA" ? null : String(q.family),
        subtype: q.subtype == null || q.subtype === "NA" ? null : String(q.subtype),
        choices: normalizeRecordArray(q.choices).map((c) => ({
          code: String(c.code ?? ""),
          label: String(c.label ?? ""),
        })),
        children: normalizeRecordArray(q.children).map((c) => ({
          name: String(c.name ?? ""),
          heading: c.heading == null || c.heading === "NA" ? null : String(c.heading),
          type: c.type == null || c.type === "NA" ? null : String(c.type),
          list_name: c.list_name == null || c.list_name === "NA" ? null : String(c.list_name),
        })),
      }));
      const questions = normalizeStringArray(p.questions);
      const normalizedQuestions = questions.length > 0
        ? questions
        : details.map((q) => q.name).filter(Boolean);
      return {
        page_id: String(p.page_id ?? ""),
        title: p.title == null || p.title === "NA" ? null : String(p.title),
        label: String(p.label ?? ""),
        range_label: String(p.range_label ?? ""),
        question_count: Number(p.question_count ?? normalizedQuestions.length),
        notes: normalizeStringArray(p.notes),
        questions: normalizedQuestions,
        question_details: details,
      };
    }),
    summary: {
      title: summaryRaw.title == null ? null : String(summaryRaw.title),
      language: summaryRaw.language == null ? null : String(summaryRaw.language),
      n_paginas: Number(summaryRaw.n_paginas ?? 0),
      n_preguntas: Number(summaryRaw.n_preguntas ?? 0),
      n_required: Number(summaryRaw.n_required ?? 0),
      n_validation: Number(summaryRaw.n_validation ?? 0),
    },
    style: {
      prefix: String(styleRaw.prefix ?? "p"),
      pad: Number(styleRaw.pad ?? 0),
    },
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
  if (value == null || value === "NA") return [];
  const str = String(value);
  return str ? [str] : [];
}

function normalizeRecordArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

// Estado persistido del editor xlsform en el backend (viaja con el .pulso
// cuando el usuario lo guarda). Es la fuente de verdad cuando hay proyecto
// abierto; sessionStorage queda como cache local del lado del navegador.
export type PersistedXlsformState = {
  workbook: XlsformEditorWorkbook;
  source: { kind: string | null; original_name: string | null } | null;
  hallazgos: Hallazgo[];
  saved_at: number;
};

export async function apiXlsformEditorStateLoad(): Promise<{
  ok: true;
  has_state: boolean;
  state: PersistedXlsformState | null;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/state", { method: "GET", headers: headers() }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    has_state: r.has_state === true,
    state: r.has_state === true ? (r.state as PersistedXlsformState) : null,
  };
}

export async function apiXlsformEditorStateSave(state: PersistedXlsformState): Promise<{
  ok: true;
  saved_at: string;
}> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/state", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(state),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return { ok: true, saved_at: String(r.saved_at ?? "") };
}

export async function apiXlsformEditorStateClear(): Promise<{ ok: true }> {
  await handle<unknown>(
    await apiFetch("/api/xlsform-editor/state", { method: "DELETE", headers: headers() }),
  );
  return { ok: true };
}

export type RuleInterpretation =
  | {
      ok: true;
      regla_parseada: {
	        when_var: string;
	        when_op: "eq" | "ne" | "in" | "not_in";
	        when_codes: string[];
	        actions: string[];
	        n_actions: number;
	      };
	      resolucion: {
	        when_var_label: string;
	        when_var_xlsform: string;
	        kobo_expr: string;
	        when_codes_resueltos: { code: string; label: string }[];
	        targets_resueltos: Array<
	          | { kind: "hide_question"; target: string; label: string }
	          | { kind: "hide_page"; page_id: string; page_label: string; preguntas: string[] }
	          | { kind: "jump_hidden_question"; target: string; label: string; jump_target: string; jump_target_label: string }
	          | { kind: "end_survey" }
	        >;
        choices_disponibles: Array<{
          code: string;
          position: number;
          label: string;
          is_other: boolean;
          is_none: boolean;
        }>;
      };
      texto_humano: string;
      diagrama: {
        origen: { id: string; label: string; condicion: string };
        edges: Array<{ target_id: string; target_label: string; action: string }>;
      };
      warnings: string[];
    }
  | { ok: false; error: string };

// jsonlite (R) serializa vectores de 1 elemento como string suelto en lugar
// de array. Esto rompe cualquier `.map()` en el frontend. El helper coerce
// a array siempre.
function ensureArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  return [v as T];
}

export async function apiXlsformEditorSmInterpretRule(
  regla: string,
	  opts: {
	    survey_id?: string;
		    workbook?: XlsformEditorWorkbook | null;
		    paginas?: Record<string, string[]>;
		    paginas_labels?: Record<string, string>;
		    choice_order_overrides?: Record<string, string[]>;
		    choice_code_maps?: ChoiceCodeMap[];
	  } = {},
): Promise<RuleInterpretation> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-interpret-rule", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
	        regla,
	        workbook: opts.workbook ?? undefined,
	        survey_id: opts.survey_id ?? "",
	        paginas: opts.paginas ?? {},
	        paginas_labels: opts.paginas_labels ?? {},
	        choice_order_overrides: opts.choice_order_overrides ?? {},
	        choice_code_maps: opts.choice_code_maps ?? [],
	      }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.ok !== true) {
    return { ok: false, error: String(r.error ?? "No pude interpretar la regla.") };
  }
  // Normalizar arrays que jsonlite puede haber colapsado a scalar (1 item).
  const reglaP = (r.regla_parseada ?? {}) as Record<string, unknown>;
  const reso = (r.resolucion ?? {}) as Record<string, unknown>;
  const diag = (r.diagrama ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    regla_parseada: {
	      when_var: String(reglaP.when_var ?? ""),
	      when_op: (reglaP.when_op ?? "eq") as "eq" | "ne" | "in" | "not_in",
	      when_codes: ensureArray<string>(reglaP.when_codes).map((x) => String(x)),
	      actions: ensureArray<string>(reglaP.actions).map((x) => String(x)),
	      n_actions: Number(reglaP.n_actions ?? 0),
	    },
	    resolucion: {
	      when_var_label: String(reso.when_var_label ?? ""),
	      when_var_xlsform: String(reso.when_var_xlsform ?? ""),
	      kobo_expr: String(reso.kobo_expr ?? ""),
	      when_codes_resueltos: ensureArray<Record<string, unknown>>(reso.when_codes_resueltos).map((c) => ({
	        code: String(c.code ?? ""),
	        label: String(c.label ?? ""),
      })),
      targets_resueltos: ensureArray<Record<string, unknown>>(reso.targets_resueltos).map((t) => {
        const kind = String(t.kind ?? "");
        if (kind === "hide_question") {
          return { kind: "hide_question" as const, target: String(t.target ?? ""), label: String(t.label ?? "") };
        }
	        if (kind === "hide_page") {
	          return {
	            kind: "hide_page" as const,
            page_id: String(t.page_id ?? ""),
            page_label: String(t.page_label ?? ""),
	            preguntas: ensureArray<string>(t.preguntas).map((x) => String(x)),
	          };
	        }
	        if (kind === "jump_hidden_question") {
	          return {
	            kind: "jump_hidden_question" as const,
	            target: String(t.target ?? ""),
	            label: String(t.label ?? ""),
	            jump_target: String(t.jump_target ?? ""),
	            jump_target_label: String(t.jump_target_label ?? ""),
	          };
	        }
	        return { kind: "end_survey" as const };
	      }),
      choices_disponibles: ensureArray<Record<string, unknown>>(reso.choices_disponibles).map((c) => ({
        code: String(c.code ?? ""),
        position: Number(c.position ?? 0),
        label: String(c.label ?? ""),
        is_other: c.is_other === true || c.is_other === "TRUE",
        is_none: c.is_none === true || c.is_none === "TRUE",
      })),
    },
    texto_humano: String(r.texto_humano ?? ""),
    diagrama: {
      origen: {
        id: String((diag.origen as Record<string, unknown> | undefined)?.id ?? ""),
        label: String((diag.origen as Record<string, unknown> | undefined)?.label ?? ""),
        condicion: String((diag.origen as Record<string, unknown> | undefined)?.condicion ?? ""),
      },
      edges: ensureArray<Record<string, unknown>>(diag.edges).map((e) => ({
        target_id: String(e.target_id ?? ""),
        target_label: String(e.target_label ?? ""),
        action: String(e.action ?? ""),
      })),
    },
    warnings: ensureArray<string>(r.warnings).map((w) => String(w)),
  };
}

export async function apiXlsformEditorSmApplyLogic(
  workbook: XlsformEditorWorkbook,
  reglas: string,
  paginas: Record<string, string[]> = {},
  choice_order_overrides: Record<string, string[]> = {},
  sourceName = "XLSForm actual",
  choice_code_maps: ChoiceCodeMap[] = [],
  replace_existing = false,
): Promise<XlsformEditorPayload> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/sm-apply-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        workbook,
        reglas,
	        paginas,
		        choice_order_overrides,
		        source_name: sourceName,
		        choice_code_maps,
		        replace_existing,
		      }),
    }),
  );
  return normalizeEditorPayload(raw);
}

export async function apiXlsformEditorImportSurveyMonkeyWithLogic(
  file_id: string | null,
  reglas: string,
  paginas: Record<string, string[]>,
  paginas_labels: Record<string, string>,
  lang = "es",
  smApi?: { survey_id: string },
  choice_order_overrides?: Record<string, string[]>,
  choice_code_maps: ChoiceCodeMap[] = [],
): Promise<EditorPayloadWithHallazgos> {
  const raw = await handle<unknown>(
    await apiFetch("/api/xlsform-editor/import-surveymonkey-with-logic", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: file_id ?? "",
        reglas,
        paginas,
        paginas_labels,
        lang,
        survey_id: smApi?.survey_id ?? "",
        choice_order_overrides: choice_order_overrides ?? {},
        choice_code_maps,
      }),
    })
  );
  const base = normalizeEditorPayload(raw);
  const r = (raw ?? {}) as Record<string, unknown>;
  // ensureArray cubre el caso de jsonlite-collapsed-to-scalar (1 hallazgo).
  const hallazgosRaw = ensureArray<Record<string, unknown>>(r.hallazgos);
  return {
    ...base,
    hallazgos: hallazgosRaw.map((h) => ({
      target: String(h.target ?? ""),
      severity: (h.severity === "info" ? "info" : "warn") as "warn" | "info",
      kind: (h.kind === "baja_completitud" ? "baja_completitud" : "regla_violada") as Hallazgo["kind"],
      mensaje: String(h.mensaje ?? ""),
      coverage_oculta: h.coverage_oculta == null ? null : Number(h.coverage_oculta),
      tasa_respuesta: h.tasa_respuesta == null ? null : Number(h.tasa_respuesta),
      inconsistencias: ensureArray<number>(h.inconsistencias).map((n) => Number(n)),
    })),
  };
}

function normalizeSurveyMonkeyLogicState(value: unknown): SurveyMonkeyLogicState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const rulesRaw = Array.isArray(raw.advanced_rules)
    ? raw.advanced_rules
    : Array.isArray(raw.rules)
      ? raw.rules
      : [];
  const visualRaw = Array.isArray(raw.visual_rules) ? raw.visual_rules : [];
  const overridesRaw = raw.choice_order_overrides;
  const choice_order_overrides: Record<string, string[]> = {};
  if (overridesRaw && typeof overridesRaw === "object" && !Array.isArray(overridesRaw)) {
    for (const [key, val] of Object.entries(overridesRaw as Record<string, unknown>)) {
      choice_order_overrides[key] = Array.isArray(val) ? val.map((item) => String(item)) : [];
    }
  }
  const choice_code_maps = normalizeChoiceCodeMaps(raw.choice_code_maps ?? raw.choiceCodeMaps);
  const rules = rulesRaw
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        texto: String(r.texto ?? ""),
        texto_humano: String(r.texto_humano ?? ""),
        kobo_expr: r.kobo_expr == null ? undefined : String(r.kobo_expr),
      };
    })
    .filter((rule) => rule.texto.trim());
  const visual_rules: SurveyMonkeyVisualLogicRule[] = visualRaw
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      const choicesRaw = Array.isArray(r.choices) ? r.choices : [];
      return {
        id: String(r.id ?? ""),
        variableRef: String(r.variableRef ?? r.variable_ref ?? ""),
        variableLabel: String(r.variableLabel ?? r.variable_label ?? ""),
        choices: choicesRaw.map((choice) => {
          const c = (choice ?? {}) as Record<string, unknown>;
          return {
            choiceName: String(c.choiceName ?? c.choice_name ?? ""),
            choiceLabel: String(c.choiceLabel ?? c.choice_label ?? ""),
            choiceIndex: Number(c.choiceIndex ?? c.choice_index ?? 0),
            action: normalizeSurveyMonkeyVisualAction(c.action),
          };
        }),
      };
    })
    .filter((rule) => rule.variableRef.trim());
  if (!rules.length && !visual_rules.length && Object.keys(choice_order_overrides).length === 0 && choice_code_maps.length === 0) return null;
  return { rules, advanced_rules: rules, visual_rules, choice_order_overrides, choice_code_maps };
}

function normalizeChoiceCodeMaps(value: unknown): ChoiceCodeMap[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const mappingsRaw = Array.isArray(raw.mappings) ? raw.mappings : [];
      return {
        variable: String(raw.variable ?? ""),
        label: String(raw.label ?? ""),
        type: String(raw.type ?? ""),
        list_name: String(raw.list_name ?? raw.listName ?? ""),
        status: String(raw.status ?? ""),
        high_confidence: Boolean(raw.high_confidence ?? raw.highConfidence),
        requires_confirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation),
        mappings: mappingsRaw.map((mapping) => {
          const m = (mapping ?? {}) as Record<string, unknown>;
          return {
            source_code: String(m.source_code ?? m.sourceCode ?? ""),
            source_column: String(m.source_column ?? m.sourceColumn ?? ""),
            source_label: String(m.source_label ?? m.sourceLabel ?? ""),
            xls_code: String(m.xls_code ?? m.xlsCode ?? ""),
            xls_label: String(m.xls_label ?? m.xlsLabel ?? ""),
            match: String(m.match ?? ""),
          };
        }),
      };
    })
    .filter((map) => map.variable && map.mappings.length > 0);
}

function normalizeSurveyMonkeyVisualAction(value: unknown): SurveyMonkeyVisualLogicAction {
  if (!value || typeof value !== "object") return { kind: "none" };
  const raw = value as Record<string, unknown>;
  const kind = String(raw.kind ?? "none");
  if (kind === "page_top") {
    return {
      kind: "page_top",
      pageId: String(raw.pageId ?? raw.page_id ?? ""),
      pageLabel: String(raw.pageLabel ?? raw.page_label ?? ""),
    };
  }
  if (kind === "question") {
    return {
      kind: "question",
      pageId: String(raw.pageId ?? raw.page_id ?? ""),
      pageLabel: String(raw.pageLabel ?? raw.page_label ?? ""),
      targetRef: String(raw.targetRef ?? raw.target_ref ?? ""),
      targetLabel: String(raw.targetLabel ?? raw.target_label ?? ""),
    };
  }
  if (kind === "end") return { kind: "end" };
  return { kind: "none" };
}

export async function apiXlsformEditorExport(
  workbook: XlsformEditorWorkbook,
  filename?: string,
  source?: XlsformEditorPayload["source"] | null,
) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    size: number;
  }>(
    await apiFetch("/api/xlsform-editor/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook, filename, source }),
    })
  );
}

export async function apiXlsformEditorExportPdf(
  workbook: XlsformEditorWorkbook,
  filename?: string,
  options: { title?: string; footer_title?: string } = {},
) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    size: number;
    summary: {
      n_blocks: number;
      n_questions: number;
      n_sections: number;
      n_matrices: number;
    };
    warnings: string[];
  }>(
    await apiFetch("/api/xlsform-editor/export-pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook, filename, options }),
    })
  );
}

/**
 * Diagnostic estructural devuelto por el validador de R. La forma coincide
 * con `BuilderDiagnostic` del frontend para que el badge pueda renderizarlos
 * directo, sin transformación. `rowIndex` y `catalogName` son opcionales.
 */
export type XlsformEditorRemoteDiagnostic = {
  id: string;
  level: "warn" | "info";
  title: string;
  detail: string;
  rowIndex?: number;
  catalogName?: string;
};

/**
 * Llama al validador estructural en R. El frontend lo invoca debounced
 * (~1 s después de la última edición) para refrescar diagnostics que
 * conviene calcular en R (balance de begin/end, integridad de catálogos,
 * regex de form_id, etc.).
 */
export async function apiXlsformEditorValidate(workbook: XlsformEditorWorkbook) {
  return handle<{
    ok: true;
    diagnostics: XlsformEditorRemoteDiagnostic[];
    count: number;
  }>(
    await apiFetch("/api/xlsform-editor/validate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ workbook }),
    })
  );
}

export async function apiCargaInstrumento(file_id: string) {
  return handle<{
    ok: true;
    resumen: {
      n_preguntas: number;
      n_calculos?: number;
      n_notas?: number;
      n_filas_survey?: number;
      n_secciones: number;
      secciones: string[];
      n_listas_opciones: number;
    };
  }>(
    await apiFetch("/api/carga/instrumento", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export type Seccion = {
  name: string;
  label: string;
  is_repeat: boolean;
  is_conditional: boolean;
  relevant: string | null;
  prefix: string;
};

export type Pregunta = {
  row_index?: number;
  name: string;
  label: string;
  hint?: string;
  appearance?: string;
  tipo: string;
  type_raw?: string;
  list_name?: string;
  seccion: string;
  required: boolean;
  relevant: boolean;
  constraint: boolean;
  calculate: boolean;
  choice_filter?: boolean;
  relevant_expr?: string | null;
  constraint_expr?: string | null;
  calculation_expr?: string | null;
  choice_filter_expr?: string | null;
  choices?: Array<{ name: string; label: string }>;
};

export async function apiInstrumentoEstructura() {
  return handle<{ secciones: Seccion[]; preguntas: Pregunta[] }>(
    await apiFetch("/api/carga/instrumento/estructura", { headers: headers() })
  );
}

export type ChoiceCodeMapItem = {
  source_code: string;
  source_column: string;
  source_label: string;
  xls_code: string;
  xls_label: string;
  match: string;
};

export type ChoiceCodeMap = {
  variable: string;
  label: string;
  type: string;
  list_name: string;
  status: string;
  high_confidence: boolean;
  requires_confirmation: boolean;
  mappings: ChoiceCodeMapItem[];
};

export type ChoiceCodeMapReview = {
  applied: boolean;
  requires_confirmation: boolean;
  n_questions: number;
  maps: ChoiceCodeMap[];
};

export async function apiCargaData(file_id: string) {
  return handle<{
    ok: true;
    preview: {
      n_filas: number;
      n_columnas: number;
      columnas: { nombre: string; tipo: string; origen?: "xlsform" | "extra" }[];
      normalizacion?: {
        applied: boolean;
        aliases: number;
        select_multiple: number;
        single_child_collapses?: number;
        dropped_columns: number;
        xlsform_columns?: number;
        extra_columns?: number;
        alias_columns?: Record<string, string>;
        select_multiple_columns?: Record<string, string[]>;
        single_child_collapse_columns?: Record<string, string>;
        choice_code_maps?: ChoiceCodeMapReview;
      };
      compatibilidad?: {
        applied: boolean;
        ok: boolean | null;
        status: string;
        expected_columns?: number;
        matched_columns: number;
        missing_columns: string[];
        extra_columns: string[];
        n_missing?: number;
        n_extra?: number;
        message: string;
      };
      preview_filas: Record<string, unknown>[];
    };
  }>(
    await apiFetch("/api/carga/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export type CargaPlatformProvider = "surveymonkey" | "kobo";

export type KoboSourceSpec = {
  asset_uid: string;
  base_url: string;
  connection_profile_id: string;
  version_id: string;
  date_modified: string;
  deployment_active: boolean;
  total_remote: number;
  imported_at: string;
  xlsform_file_id: string;
  data_file_id: string;
  source_title?: string;
  source_alias?: string;
};

export type KoboIndependentAssetInput = {
  asset_uid: string;
  title?: string;
  name?: string;
  label?: string;
  source_alias?: string;
  source_title?: string;
  source_channel?: string;
  channel?: string;
  collection_strategy?: string;
  base_url?: string;
  connection_profile_id?: string;
};

export type CargaPlatformImportResult = {
  ok: true;
  provider: CargaPlatformProvider;
  xlsform_file_id: string;
  data_file_id: string;
  source: Record<string, unknown> | KoboSourceSpec;
  resumen: Awaited<ReturnType<typeof apiCargaInstrumento>>["resumen"];
  preview: Awaited<ReturnType<typeof apiCargaData>>["preview"];
  estudio?: EstudioPayload | null;
};

export async function apiCargaImportSurveyMonkey(payload: {
  survey_id: string;
  title?: string;
  base_url?: string;
  connection_profile_id?: string;
  source_alias?: string;
  source_channel?: string;
  response_statuses?: string[];
  keep_missing_status?: boolean;
}): Promise<CargaPlatformImportResult> {
  return handle<CargaPlatformImportResult>(
    await apiFetch("/api/carga/platform/surveymonkey/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCargaImportKobo(payload: {
  asset_uid: string;
  title?: string;
  base_url?: string;
  connection_profile_id?: string;
}): Promise<CargaPlatformImportResult> {
  return handle<CargaPlatformImportResult>(
    await apiFetch("/api/carga/platform/kobo/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCargaImportKoboIndependent(payload: {
  assets: KoboIndependentAssetInput[];
}) {
  return handle<{
    ok: true;
    provider: "kobo";
    processing_mode: "independent_siblings";
    active_base: string | null;
    bases: EstudioBase[];
    n_bases: number;
    estudio: EstudioPayload;
    xlsform_logic_sync?: EstudioLogicSyncResult | null;
  }>(
    await apiFetch("/api/carga/platform/kobo/import-independent", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type KoboIndependentRefreshResult = {
  ok: true;
  provider: "kobo";
  processing_mode: "independent_siblings";
  active_base: string | null;
  results: Array<{
    ok: true;
    base_name: string;
    asset_uid: string;
    rows_before: number;
    rows_after: number;
    total_remote: number;
    xlsform_file_id: string;
    data_file_id: string;
    refreshed_at: string;
  }>;
  updated_bases: string[];
  n_updated_bases: number;
  bases?: EstudioBase[];
  estudio: EstudioPayload;
  message?: string;
};

export async function apiCargaRefreshKoboIndependent(payload: {
  base_names?: string[];
  bases?: Array<string | { base_name?: string; nombre?: string; name?: string }>;
} = {}) {
  return handle<KoboIndependentRefreshResult>(
    await apiFetch("/api/carga/platform/kobo/refresh-independent", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

function normalizeKoboAssets(raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(r.assets) ? r.assets as Record<string, unknown>[] : [];
  return {
    ok: true as const,
    count: Number(r.count ?? arr.length),
    assets: arr
      .map((item): MonitoreoKoboAssetItem => ({
        uid: String(item.uid ?? ""),
        name: String(item.name ?? item.uid ?? ""),
        version_id: item.version_id == null || item.version_id === "NA" ? "" : String(item.version_id),
        date_modified: item.date_modified == null || item.date_modified === "NA" ? null : String(item.date_modified),
        deployment_active: item.deployment_active === true,
      }))
      .filter((item) => item.uid),
  };
}

export async function apiCargaKoboAssets(
  base_url = "https://kf.kobotoolbox.org",
  limit = 100,
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/platform/kobo/assets", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        base_url,
        limit,
        profile_id: options.profile_id ?? options.connection_profile_id ?? "",
      }),
    }),
  );
  return normalizeKoboAssets(raw);
}

export async function apiCargaKoboDetectedSource() {
  return handle<(KoboSourceSpec & {
    ok: true;
    detected: true;
    provider: "kobo";
    phase: string;
    name: string;
  }) | {
    ok: false;
    detected: false;
  }>(
    await apiFetch("/api/carga/platform/kobo/detected-source", {
      headers: headers(),
    }),
  );
}

export async function apiCargaConfirmChoiceMapping() {
  return handle<{
    ok: true;
    confirmed: boolean;
    n_questions?: number;
    confirmed_at?: string;
    message?: string;
  }>(
    await apiFetch("/api/carga/choice-mapping/confirm", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
}

export type NormalizedExportFormat = "xlsx" | "csv" | "sav";

export async function apiCargaExportNormalized(
  format: NormalizedExportFormat = "xlsx",
  baseNombre?: string | null,
) {
  const qs = new URLSearchParams({ format });
  if (baseNombre) qs.set("base_nombre", baseNombre);
  return handle<{
    ok: true;
    file_id: string;
    size: number;
    original_name: string;
    format: string;
  }>(
    await apiFetch(`/api/carga/data/normalized-export?${qs.toString()}`, {
      headers: headers(),
    }),
  );
}

export type ProcessingSheetMode = "codigos" | "etiquetas";
export type ProcessingSheetTypeKind = "integer" | "sm" | "so" | "text" | "other";

export type ProcessingSheetCategory = { code: string; label: string; count: number };

export type ProcessingSheetColumn = {
  key: string;
  label: string;
  type: string;
  type_base: string;
  type_kind: ProcessingSheetTypeKind;
  source_type_base?: string | null;
  source_type_kind?: ProcessingSheetTypeKind | "" | null;
  coded: boolean;
  is_recoded?: boolean;
  raw_parent?: string | null;
  dummy_parent?: string | null;
  dummy_code?: string | null;
  categories?: ProcessingSheetCategory[] | null;
  value_min?: number | null;
  value_max?: number | null;
};

// Filtro por columna: string (substring, retrocompat) u objeto estructurado.
export type ProcessingSheetColumnFilter =
  | string
  | { op: "in"; values: string[] }
  | { op: "range"; min?: number | null; max?: number | null }
  | { op: "contains"; value: string };

export type ProcessingSheetPayload = {
  ok: true;
  source: "carga" | "analitica" | string;
  modo: ProcessingSheetMode;
  columns: ProcessingSheetColumn[];
  rows: Record<string, string>[];
  total: number;
  page: number;
  page_size: number;
  n_columns: number;
  coded: boolean;
};

export type ProcessingSheetRequest = {
  modo?: ProcessingSheetMode;
  page?: number;
  page_size?: number;
  pageSize?: number;
  search?: string;
  column_filters?: Record<string, ProcessingSheetColumnFilter>;
  columnFilters?: Record<string, ProcessingSheetColumnFilter>;
  sort?: { col: string; desc: boolean } | null;
  base_nombre?: string | null;
  baseNombre?: string | null;
};

export async function apiCargaBaseSheet(opts: ProcessingSheetRequest = {}) {
  return handle<ProcessingSheetPayload>(
    await apiFetch("/api/carga/base-sheet", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

// Limpia el XLSForm cargado + todos los artefactos derivados
// (rp_inst, rp_data, validación, estudio). Deja la sesión viva pero
// vacía de insumos — el usuario puede cargar otro XLSForm.
export async function apiQuitarInstrumento() {
  return handle<{ ok: true }>(
    await apiFetch("/api/carga/instrumento", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Limpia solo la base de datos cargada. El XLSForm se mantiene — es
// el caso común "probé con esta data, ahora quiero otra usando el
// mismo formulario". También resetea rp_data + validación.
export async function apiQuitarData() {
  return handle<{ ok: true }>(
    await apiFetch("/api/carga/data", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

export type DemoMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  etiqueta_estudio: string;
  n_bases: number;  // 1 para demos single-base, >1 para multi-base (v0.2+)
};

export async function apiListDemos() {
  return handle<{ demos: DemoMeta[] }>(
    await apiFetch("/api/system/demos", { headers: headers() }),
  );
}

export async function apiLoadDemo(name?: string) {
  const url = name
    ? `/api/system/demo?name=${encodeURIComponent(name)}`
    : "/api/system/demo";
  return handle<{
    ok: true;
    session_id: string;
    demo_name: string;
    demo_titulo: string;
    n_bases: number;  // v0.2+: cuántas bases cargó (1 para single-base demos)
    bases: { nombre: string; n_filas: number; n_columnas: number }[];
    // Legacy (primera base, para back-compat con UI v0.1):
    resumen_instrumento: {
      n_preguntas: number;
      n_calculos?: number;
      n_notas?: number;
      n_filas_survey?: number;
      n_secciones: number;
      secciones: string[];
      n_listas_opciones: number;
    };
    n_filas: number;
    n_columnas: number;
  }>(await apiFetch(url, { method: "POST", headers: headers() }));
}

export async function apiShutdown() {
  return handle<{ ok: boolean; message: string }>(
    await apiFetch("/api/system/shutdown", { method: "POST", headers: headers() })
  );
}

// ---------- Jobs (async queue) ----------

export type JobStatus = "running" | "done" | "error" | "cancelled";
export type JobStart = { ok: true; job_id: string; kind: string };
export type FileJobResult = { ok: true; file_id: string; filename?: string; size: number };

// The API unboxed-JSON serializer turns R's NULL into {}.
// result_data / error are therefore either the real payload or an empty object.
export type JobProgress = {
  phase?: string;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
  ts?: string;
};

export type JobSnapshot<T = unknown> = {
  id: string;
  kind: string;
  status: JobStatus;
  started_at: string;
  finished_at: string | null;
  has_file_result: boolean;
  result_filename: string | null;
  result_data: T | Record<string, never>;
  progress?: JobProgress | Record<string, never> | null;
  error: string | Record<string, never>;
};

export async function apiJobStatus<T = unknown>(id: string) {
  return handle<JobSnapshot<T>>(
    await apiFetch(`/api/jobs/${encodeURIComponent(id)}`, { headers: headers() })
  );
}

export async function apiJobCancel(id: string) {
  return handle<{ ok: boolean }>(
    await apiFetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: headers() })
  );
}

export function jobResultUrl(id: string) {
  return apiPath(`/api/jobs/${encodeURIComponent(id)}/result`);
}

// ---------- Monitoreo digital ----------

export type MonitoreoSourceKind = "kobo" | "surveymonkey" | "google_sheets";

export type MonitoreoSourceRole =
  | "universo"
  | "barrido"
  | "respuestas"
  | "avance_interno"
  | "reporte_cliente"
  | "hoja_ruta"
  | "ocurrencias_campo";

export type MonitoreoIntegrationMode = "file" | "connected_read" | "controlled_write";

export type MonitoreoSheetBinding = {
  spreadsheet_id: string;
  sheet_name: string;
  header_row: number;
  range: string;
  last_read_at: string;
  snapshot_hash: string;
};

export type MonitoreoSourceCollector = {
  id?: string;
  source_id?: string;
  source_label?: string;
  survey_id?: string;
  collector_id: string;
  collector_name?: string;
  name?: string;
  collector_type?: string;
  type?: string;
  enabled?: boolean;
  response_count?: number;
  active_response_count?: number;
  last_sync_at?: string;
  synced_at?: string;
  metadata_source?: string;
  [key: string]: unknown;
};

export type MonitoreoSource = {
  id: string;
  kind: MonitoreoSourceKind;
  label: string;
  enabled: boolean;
  role?: MonitoreoSourceRole;
  integration_mode?: MonitoreoIntegrationMode;
  sheet_binding?: MonitoreoSheetBinding;
  asset_uid?: string;
  survey_id?: string;
  survey_title?: string;
  base_url?: string;
  connection_profile_id?: string;
  declared_person_code_var?: string;
  declared_person_code_label?: string;
  dimensions?: Record<string, string>;
  collectors?: MonitoreoSourceCollector[];
  created_at?: string;
  last_sync_at?: string;
  last_sync_mode?: "full" | "incremental" | string;
  sync_cursor?: {
    kobo_max_id?: number;
    updated_at?: string;
    mode?: string;
    fetched_count?: number;
    remote_total?: number;
    [key: string]: unknown;
  };
};

export type MonitoreoKoboAssetItem = {
  uid: string;
  name: string;
  version_id?: string;
  date_modified: string | null;
  deployment_active: boolean;
};

export type MonitoreoKoboSurveyLink = {
  ok: true;
  asset_uid: string;
  name: string;
  base_url: string;
  survey_url: string;
  landing_url: string;
  version_id: string;
  deployment_active: boolean;
  resolved_from: string;
};

export type MonitoreoGoal = {
  filters: Record<string, string>;
  meta: number;
  meta_pct?: number | null;
};

export type MonitoreoReportWeekday = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export type MonitoreoStrategyReportException = {
  week: number | null;
  weekday: MonitoreoReportWeekday | "";
  date?: string;
  note?: string;
};

export type MonitoreoStrategyPhase = {
  id: string;
  stratum: string;
  modality: "email" | "whatsapp" | "sms" | "telefono" | "presencial" | "mixto";
  start_week: number | null;
  end_week: number | null;
  start_date?: string;
  end_date?: string;
  client_report_weekday?: MonitoreoReportWeekday | "";
  client_report_exceptions?: MonitoreoStrategyReportException[];
  target_rule: string;
  kpi_focus: string[];
  kpi_modules: string[];
  breakdown_vars: string[];
  attempts_var: string;
  outcome_var: string;
};

export type MonitoreoOperationalStratum = {
  id: string;
  label: string;
  source_id: string;
  variable: string;
  value: string;
  notes: string;
};

export type MonitoreoOperationalTarget = {
  id: string;
  label: string;
  stratum_id: string;
  filters: Record<string, string>;
  meta: number;
  notes: string;
};

export type MonitoreoOperationalCases = {
  enabled: boolean;
  case_id_var: string;
  person_label_var: string;
  status_var: string;
  contact_vars: string[];
  sensitive_vars: string[];
  roster_source: "none" | "uploaded" | "responses" | "external_local";
  notes: string;
};

export type MonitoreoOperationalStrategy = {
  id: string;
  label: string;
  objective: string;
  owner: string;
  status: "draft" | "active" | "paused" | "closed";
};

export type MonitoreoCollectorUse =
  | "correo_autoaplicado"
  | "telefono_asistido"
  | "presencial_qr"
  | "enlace_abierto"
  | "sms"
  | "mixto"
  | "sin_clasificar";

export type MonitoreoLinkCollector = {
  id: string;
  source_id: string;
  source_label: string;
  survey_id: string;
  collector_id: string;
  collector_name: string;
  collector_type: string;
  enabled?: boolean;
  channel?: string;
  operational_use: MonitoreoCollectorUse;
  modality: MonitoreoStrategyPhase["modality"];
  roster_required: boolean;
};

export type MonitoreoCollectorRecipientSummary = {
  available: boolean;
  total: number;
  scanned: number;
  truncated: boolean;
  personalized_link_count: number;
  mail_status_counts: Record<string, number>;
  response_status_counts: Record<string, number>;
  error?: string;
};

export type MonitoreoSurveyMonkeyCollector = MonitoreoLinkCollector & {
  response_count: number;
  active_response_count: number;
  recipient_summary: MonitoreoCollectorRecipientSummary;
  suggested_use: MonitoreoCollectorUse;
  configured_use: MonitoreoCollectorUse;
  url_present: boolean;
  metadata_source?: "surveymonkey_sync" | "responses_snapshot" | "config" | string;
  warnings: string[];
};

export type MonitoreoSourceVariableStat = {
  name: string;
  label: string;
  kind?: "pucp" | "cell" | "email" | "name" | "other" | string;
  non_empty: number;
  total: number;
  coverage_pct?: number | null;
  examples?: string[];
  score?: number;
  selected?: boolean;
};

export type MonitoreoSourceMetadata = {
  schema?: string;
  generated_at?: string;
  source_count?: number;
  survey_count?: number;
  sources?: Array<{
    id: string;
    kind: MonitoreoSourceKind | string;
    label: string;
    survey_id?: string;
    survey_title?: string;
    last_sync_at?: string;
    last_sync_mode?: string;
    role?: string;
  }>;
  surveys?: Record<string, {
    source_id: string;
    survey_id: string;
    title: string;
    label?: string;
    actor?: string;
    channel?: string;
    response_count?: number;
    declared_person_code_var?: string;
    declared_person_code_label?: string;
    collector_count?: number;
  }>;
  collectors?: MonitoreoSurveyMonkeyCollector[];
  variables_by_source?: Record<string, MonitoreoSourceVariableStat[]>;
  sync_summary?: Record<string, unknown>;
  error?: string;
};

export type MonitoreoChartModels = {
  schema?: string;
  generated_at?: string;
  client?: Record<string, unknown>;
  internal?: Record<string, unknown>;
  daily_progress?: MonitoreoDailyProgressModel | Record<string, unknown>;
  empty_reason?: string;
  error?: string;
};

export type MonitoreoOperationalEvent = {
  id: string;
  label: string;
  modality: MonitoreoStrategyPhase["modality"];
  outcome: string;
  counts_attempt: boolean;
  counts_contact: boolean;
  counts_complete: boolean;
  stop_contact: boolean;
};

export type MonitoreoStateRule = {
  id: string;
  label: string;
  final_state: string;
  priority: number;
  outcome_values: string[];
  stop_contact: boolean;
};

export type MonitoreoOperationalModel = {
  schema_version: string;
  strata: MonitoreoOperationalStratum[];
  targets: MonitoreoOperationalTarget[];
  cases: MonitoreoOperationalCases;
  strategies: MonitoreoOperationalStrategy[];
  link_collectors: MonitoreoLinkCollector[];
  events: MonitoreoOperationalEvent[];
  state_rules: MonitoreoStateRule[];
  privacy: {
    local_sensitive: boolean;
    export_policy: "aggregate_or_redacted" | "aggregate_only" | "allow_case_level_local";
  };
};

export type MonitoreoCumplimientoEstado =
  | "cumple_meta"
  | "brecha_menor_documentada"
  | "brecha_relevante"
  | "sin_objetivo";

export type MonitoreoAcreditacionIntentos = {
  email: number;
  whatsapp: number;
  sms: number;
  telefono: number;
  presencial: number;
};

export type MonitoreoAcreditacionSubcuota = {
  cuota: number;
  logrado: number;
  estado: "completa" | "parcial" | "vacia";
};

export type MonitoreoAcreditacionBolsa = {
  id: string;
  tipo: "titular" | "reemplazo";
  prioridad: number;
  estado: "pendiente" | "activado" | "completado" | "descartado";
  fecha_activacion?: string;
  motivo_descarte?: string;
};

export type MonitoreoAcreditacionCumplimiento = {
  estado: MonitoreoCumplimientoEstado;
  brecha_absoluta: number | null;
  brecha_porcentual: number | null;
  benchmark_comparado?: {
    rango?: string;
    promedio_historico: number;
    mediana_historica: number;
    cobertura_actual: number;
    desviacion_actual: number;
  } | null;
};

export type MonitoreoAcreditacionComponente = {
  id: string;
  actor: string;
  actor_id: string;
  tecnica: string;
  variable_control: string;
  habilita_margen: boolean;
  marco: {
    universo_bruto: number | null;
    marco_actualizado: number | null;
    marco_contactable: number | null;
    meta_efectiva: number | null;
    tasa_respuesta_esperada: number | null;
  };
  meta: {
    n_objetivo: number | null;
    tipo: string;
    variable_control: string;
  };
  seguimiento: {
    n_efectivo: number;
    fecha_actualizacion: string;
    notas_campo: string;
    intentos_canal: MonitoreoAcreditacionIntentos;
    tasa_contacto_efectiva: number | null;
    cumplimiento: MonitoreoAcreditacionCumplimiento;
    bolsa_operativa: MonitoreoAcreditacionBolsa[];
    sub_cuotas_progreso: Record<string, MonitoreoAcreditacionSubcuota>;
  };
};

export type MonitoreoAcreditacionCard = {
  id: string;
  actor: string;
  actor_id: string;
  tecnica: string;
  n_efectivo: number;
  n_objetivo: number | null;
  avance_pct: number | null;
  estado: MonitoreoCumplimientoEstado;
  brecha_absoluta: number | null;
  brecha_porcentual: number | null;
  benchmark_comparado?: MonitoreoAcreditacionCumplimiento["benchmark_comparado"];
  ultima_actualizacion: string;
};

export type MonitoreoAcreditacionAlerta = {
  severidad: "bloqueante" | "advertencia";
  componente_id: string;
  actor: string;
  tipo: string;
  mensaje: string;
};

export type MonitoreoAcreditacion = {
  enabled: boolean;
  modo_trabajo: "seguimiento_campo" | "cierre_campo";
  estudio: {
    id: string;
    titulo: string;
    cliente: string;
    macro_familia: string;
    creado_desde_calc_muestra: boolean;
  };
  componentes: MonitoreoAcreditacionComponente[];
  plan_refuerzo: string;
  aprobacion_metodologica: boolean;
  cierre_at: string;
  dashboard: {
    cards: MonitoreoAcreditacionCard[];
    alertas: MonitoreoAcreditacionAlerta[];
    cierre_habilitado: boolean;
    bloqueos: number;
  };
};

export type MonitoreoTerritorialPhase = "pilot" | "field";

export type MonitoreoTerritorialPhaseCoherenceStatus =
  | "source_not_applied"
  | "source_applied_not_synced"
  | "source_synced_with_rows"
  | "source_synced_zero_rows"
  | "dashboard_stale"
  | "source_snapshot_mismatch"
  | "sync_error"
  | string;

export type MonitoreoTerritorialPhaseCoherenceItem = {
  phase: MonitoreoTerritorialPhase;
  label: string;
  status: MonitoreoTerritorialPhaseCoherenceStatus;
  message: string;
  source_applied: boolean;
  source_exists: boolean;
  asset_uid: string;
  version_id: string;
  asset_name: string;
  source_id: string;
  source_asset_uid?: string;
  local_rows: number;
  dashboard_rows?: number | null;
  snapshot_total_rows: number;
  snapshot_synced_at: string;
  last_sync_at: string;
  snapshot_has_source: boolean;
  snapshot_matches_source: boolean;
  dashboard_active_phase: boolean;
  dashboard_matches_source?: boolean | null;
};

export type MonitoreoTerritorialPhaseCoherence = {
  schema: "monitoreo_territorial_phase_coherence_v1" | string;
  generated_at: string;
  active_route_phase: MonitoreoTerritorialPhase;
  snapshot_total_rows: number;
  snapshot_synced_at: string;
  phases: Record<MonitoreoTerritorialPhase, MonitoreoTerritorialPhaseCoherenceItem>;
  active: MonitoreoTerritorialPhaseCoherenceItem;
};

export type MonitoreoTerritorialPhaseSource = {
  asset_uid: string;
  kobo_version_id: string;
  kobo_asset_name: string;
  source_id: string;
  inspected_at: string;
  base_url?: string;
  connection_profile_id?: string;
};

export type MonitoreoTerritorialPhaseWindow = {
  start_at: string;
};

export type MonitoreoTerritorialVariableRef = {
  name?: string;
  original_name?: string;
  normalized_name?: string;
  path?: string;
  xpath?: string;
  label?: string;
  type?: string;
  group?: string;
};

export type MonitoreoTerritorialVariableRefs = Partial<Record<
  "district" | "ump" | "geo" | "age" | "sex" | "enumerator_pulso_code" | "valid_filter_question",
  MonitoreoTerritorialVariableRef
>>;

export type MonitoreoTerritorialPhaseMapping = {
  district_var: string;
  ump_var: string;
  pulso_code_var: string;
  gps_var: string;
  consent_var: string;
  age_var: string;
  sex_var: string;
  status_var: string;
  territorial_status_var: string;
  coherence_status_var: string;
  id_var: string;
  submitted_by_var: string;
  supervisor_var: string;
  kobo_user_var: string;
  submission_time_var: string;
  start_var: string;
  end_var: string;
  duration_var: string;
  platform_effective_var: string;
  platform_effective_values: string[];
  variable_refs?: MonitoreoTerritorialVariableRefs;
  valid_statuses: string[];
};

export type MonitoreoTerritorialConfig = {
  schema_version: string;
  active_route_phase: MonitoreoTerritorialPhase;
  asset_uid: string;
  kobo_version_id: string;
  kobo_asset_name: string;
  source_id: string;
  inspected_at: string;
  phase_sources?: Record<MonitoreoTerritorialPhase, MonitoreoTerritorialPhaseSource>;
  phase_windows?: Record<MonitoreoTerritorialPhase, MonitoreoTerritorialPhaseWindow>;
  phase_mappings?: Record<MonitoreoTerritorialPhase, MonitoreoTerritorialPhaseMapping>;
  snapshot_hash: string;
  district_var: string;
  ump_var: string;
  pulso_code_var: string;
  gps_var: string;
  consent_var: string;
  age_var: string;
  sex_var: string;
  status_var: string;
  territorial_status_var: string;
  coherence_status_var: string;
  id_var: string;
  submitted_by_var: string;
  supervisor_var: string;
  kobo_user_var: string;
  submission_time_var: string;
  start_var: string;
  end_var: string;
  duration_var: string;
  platform_effective_var: string;
  platform_effective_values: string[];
  valid_statuses: string[];
  district_crosswalk: Array<{ kobo_code: string; kobo_label: string; ubigeo: string; distrito: string }>;
  geo_thresholds_m: { cerca: number; revision: number };
  min_duration_seconds: number;
  max_duration_seconds: number;
  high_age_review: number;
  count_review_in_official_progress: boolean;
  enumerator_roster?: MonitoreoTerritorialEnumeratorRoster;
  enumerator_code_reconciliation?: Partial<Record<MonitoreoTerritorialPhase, MonitoreoTerritorialCodeReconciliation[]>>;
  ump_reconciliation?: Partial<Record<MonitoreoTerritorialPhase, MonitoreoTerritorialUmpReconciliation[]>>;
  spatial_reconciliation?: Partial<Record<MonitoreoTerritorialPhase, {
    dismissed_candidates?: MonitoreoTerritorialSpatialReconciliationDismissal[];
    dismissed_patterns?: MonitoreoTerritorialSpatialReconciliationDismissal[];
  }>>;
  operational_adjustments?: Partial<Record<MonitoreoTerritorialPhase, MonitoreoTerritorialOperationalAdjustment[]>>;
  production_annulments?: Partial<Record<MonitoreoTerritorialPhase, MonitoreoTerritorialProductionAnnulment[]>>;
  validation_decisions: MonitoreoTerritorialValidationDecisions;
  field_occurrences?: MonitoreoFieldOccurrenceConfig;
};

export type MonitoreoAulasEstado =
  | "planificada"
  | "contactada"
  | "agendada"
  | "en_campo"
  | "aplicada"
  | "parcial"
  | "sin_acceso"
  | "cancelada"
  | "reemplazo_pendiente"
  | "reemplazada"
  | "cerrada"
  | string;

export type MonitoreoAulasPlanRow = {
  selection_run_id: string;
  operational_code?: string;
  titular_operational_code?: string;
  replacement_chain_code?: string;
  operational_sequence?: number;
  selection_slot_id?: string;
  sample_role?: "titular" | "chain_reserve" | "extra_reserve_pool" | string;
  wave: string;
  replacement_order?: number;
  orden: number;
  classroom_id: string;
  label: string;
  course_id: string;
  course_name: string;
  section: string;
  schedule: string;
  teacher: string;
  teacher_email: string;
  faculty: string;
  program: string;
  level: string;
  stratum: string;
  eligible_n: number;
  expected_valid: number;
  link: string;
  qr: string;
  word_link?: string;
  pdf_link?: string;
  package_label?: string;
  package_status?: string;
  collector_id: string;
  responsible: string;
  operational_status: MonitoreoAulasEstado;
  replacement_for: string;
  replacement_reason: string;
  replacement_note: string;
  equivalence_level?: string;
  chain_score?: number;
  chain_depth?: number;
  activation_weight_status?: string;
  analysis_weight_warning?: string;
  updated_at: string;
  [key: string]: string | number | boolean | null | undefined;
};

export type MonitoreoAulasConfig = {
  schema: "monitoreo_aulas_universitarias_v1" | string;
  enabled: boolean;
  selection_run_id: string;
  frame_hash: string;
  imported_at: string;
  anonymous_responses: boolean;
  source_mapping: {
    classroom_id_var: string;
    collector_var: string;
    link_var: string;
    date_var: string;
    status_var: string;
    valid_statuses: string[];
  };
  plan: MonitoreoAulasPlanRow[];
  quotas: unknown;
  variables_control: unknown;
  methodology: Record<string, unknown>;
  alerts: {
    min_valid_per_class: number;
    warn_partial_under_valid: number;
  };
  [key: string]: unknown;
};

export type MonitoreoAulasDashboard = {
  schema: "monitoreo_aulas_dashboard_v1" | string;
  generated_at: string;
  selection_run_id?: string;
  frame_hash?: string;
  anonymous_responses?: boolean;
  kpis: {
    total_aulas: number;
    aulas_titulares?: number;
    aulas_aplicadas: number;
    aulas_parciales?: number;
	    reemplazos_usados?: number;
	    respuestas_total?: number;
	    respuestas_validas: number;
	    filter_passed?: number;
	    filter_rejected?: number;
	    brechas: number;
	    quota_cells?: number;
	    quota_cells_ok?: number;
	    quota_cells_pending?: number;
	    representativity_effective_score?: number;
	    representativity_score_loss?: number;
	  };
	  agenda: MonitoreoAulasPlanRow[];
	  course_status?: MonitoreoRow[];
	  avance_por_estrato: MonitoreoRow[];
	  quotas_sex_faculty?: MonitoreoRow[];
	  brechas: MonitoreoRow[];
	  reemplazos: MonitoreoRow[];
	  representativity?: {
	    planned_score?: number;
	    effective_score?: number;
	    effective_distance?: number;
	    score_loss?: number;
	    planned_aulas?: number;
	    effective_aulas?: number;
	    distribution?: MonitoreoRow[];
	    warning?: string;
	  };
	  validation: MonitoreoRow[];
	};

export type MonitoreoTerritorialCodeReconciliation = {
  response_id?: string;
  response_id_field?: string;
  raw_code: string;
  normalized_code: string;
  assigned_code: string;
  assigned_name?: string;
  ump?: string;
  district?: string;
  phase?: MonitoreoTerritorialPhase;
  note?: string;
  created_at?: string;
  scope?: "response" | "code_legacy" | string;
};

export type MonitoreoTerritorialUmpReconciliation = {
  response_id?: string;
  response_id_field?: string;
  raw_ump: string;
  assigned_block_id: string;
  assigned_ump: string;
  assigned_district?: string;
  assigned_ubigeo?: string;
  phase?: MonitoreoTerritorialPhase;
  note?: string;
  created_at?: string;
  scope?: "response" | "ump_value" | string;
};

export type MonitoreoTerritorialSpatialReconciliationDismissal = {
  candidate_id?: string;
  pattern_key?: string;
  phase?: MonitoreoTerritorialPhase;
  reason?: string;
  evidence_hash?: string;
  dismissed_at?: string;
  scope?: "candidate" | "pattern" | string;
};

export type MonitoreoTerritorialSpatialReconciliationEvidence = {
  key: string;
  label: string;
  tone?: "positive" | "warning" | "danger" | "neutral" | string;
};

export type MonitoreoTerritorialSpatialQuotaSideImpact = {
  before_validas: number;
  after_validas: number;
  target: number;
  missing_before: number;
  missing_after: number;
  would_break_quota?: boolean;
  would_complete_quota?: boolean;
  status_before?: string;
};

export type MonitoreoTerritorialSpatialQuotaImpact = {
  source: MonitoreoTerritorialSpatialQuotaSideImpact;
  target: MonitoreoTerritorialSpatialQuotaSideImpact;
};

export type MonitoreoTerritorialSpatialReconciliationCandidate = {
  candidate_id: string;
  response_id: string;
  row_index?: number;
  phase: MonitoreoTerritorialPhase;
  raw_ump: string;
  declared_ump?: string;
  declared_block_id?: string;
  declared_district?: string;
  declared_ubigeo?: string;
  declared_zona?: string;
  declared_manzana?: string;
  declared_responsible?: string;
  target_block_id: string;
  target_ump?: string;
  target_district?: string;
  target_ubigeo?: string;
  target_zona?: string;
  target_manzana?: string;
  target_responsible?: string;
  responsible?: string;
  responsible_match?: boolean;
  responsible_source_match?: boolean;
  distance_m?: number | null;
  geo_estado?: string;
  gps_primary_source?: string;
  gps_primary_estado?: string;
  gps_primary_distance_m?: number | null;
  gps_effective_source?: string;
  gps_effective_estado?: string;
  gps_effective_distance_m?: number | null;
  gps_reclassified?: boolean;
  gps_reclassification_note?: string;
  score: number;
  confidence: "alta" | "media" | "baja" | string;
  evidence?: MonitoreoTerritorialSpatialReconciliationEvidence[];
  evidence_hash?: string;
  pattern_key?: string;
  impact?: MonitoreoTerritorialSpatialQuotaImpact;
  reconciliation: MonitoreoTerritorialUmpReconciliation;
};

export type MonitoreoTerritorialSpatialReconciliationPattern = {
  pattern_key: string;
  phase: MonitoreoTerritorialPhase;
  count: number;
  candidate_ids: string[];
  raw_ump?: string;
  declared_block_id?: string;
  declared_ump?: string;
  target_block_id?: string;
  target_ump?: string;
  target_manzana?: string;
  target_district?: string;
  responsible?: string;
  target_responsible?: string;
  score: number;
  confidence: "alta" | "media" | "baja" | string;
  evidence_hash?: string;
  impact?: {
    target_complete_count?: number;
    source_break_count?: number;
    target_missing_after_min?: number;
  };
};

export type MonitoreoTerritorialSpatialReconciliationSummary = {
  schema?: string;
  reason?: string;
  candidates: MonitoreoTerritorialSpatialReconciliationCandidate[];
  patterns: MonitoreoTerritorialSpatialReconciliationPattern[];
  metrics: {
    total_candidates?: number;
    candidates: number;
    patterns: number;
    high_confidence?: number;
    dismissed_candidates?: number;
    dismissed_patterns?: number;
    in_queue?: number;
  };
};

export type MonitoreoTerritorialOperationalAdjustment = {
  id?: string;
  phase?: MonitoreoTerritorialPhase | string;
  status?: "active" | "reverted" | string;
  created_at?: string;
  reverted_at?: string;
  created_by?: string;
  district: string;
  ubigeo?: string;
  sex: string;
  age_group: string;
  source_block_id: string;
  source_ump?: string;
  source_manzana?: string;
  source_responsible?: string;
  target_block_id: string;
  target_ump?: string;
  target_manzana?: string;
  target_responsible?: string;
  target_latest_activity?: string;
  source_response_ids: string[];
  count: number;
  completion_package?: boolean;
  package_id?: string;
  package_index?: number;
  package_movements?: number;
  package_target_missing?: number;
  adjustments?: MonitoreoTerritorialOperationalAdjustment[];
  deficit_ids?: string[];
  max_distance_km?: number | null;
  reason?: string;
  note?: string;
  source_latest_activity?: string;
  latest_activity?: string;
  distance_km?: number | null;
};

export type MonitoreoTerritorialOperationalAdjustmentDeficit = {
  id: string;
  phase?: MonitoreoTerritorialPhase | string;
  district: string;
  ubigeo?: string;
  sex: string;
  age_group: string;
  target_block_id: string;
  target_ump?: string;
  target_manzana?: string;
  target_responsible?: string;
  target_latest_activity?: string;
  missing: number;
  active_adjustments?: number;
  status?: string;
  match_status?: "eligible" | "blocked" | string;
};

export type MonitoreoTerritorialOperationalAdjustmentSurplus = {
  id: string;
  phase?: MonitoreoTerritorialPhase | string;
  district: string;
  ubigeo?: string;
  sex: string;
  age_group: string;
  source_block_id: string;
  source_ump?: string;
  source_manzana?: string;
  source_responsible?: string;
  count: number;
  response_ids?: string[];
  source_latest_activity?: string;
  latest_activity?: string;
};

export type MonitoreoTerritorialOperationalAdjustmentSuggestion = MonitoreoTerritorialOperationalAdjustment & {
  id: string;
  reason: string;
};

export type MonitoreoTerritorialOperationalAdjustmentsPayload = {
  schema: "monitoreo_territorial_operational_adjustments_v1" | string;
  reason?: string;
  summary?: {
    active?: number;
    reverted?: number;
    operational_gain?: number;
    pending_cells?: number;
    eligible_surplus?: number;
    suggestions?: number;
    blocked_cells?: number;
  };
  deficits?: MonitoreoTerritorialOperationalAdjustmentDeficit[];
  surplus?: MonitoreoTerritorialOperationalAdjustmentSurplus[];
  suggestions?: MonitoreoTerritorialOperationalAdjustmentSuggestion[];
  applied?: MonitoreoTerritorialOperationalAdjustment[];
};

export type MonitoreoTerritorialOperationalPackageFile = {
  file_id: string;
  filename: string;
  size?: number;
  download_url?: string;
};

export type MonitoreoProcessingHandoffUniverse = "processable" | "strict_validada";

export type MonitoreoProcessingHandoffCounts = {
  raw_rows?: number;
  audit_rows?: number;
  exported_rows?: number;
  selected_audit_rows?: number;
  validada?: number;
  revision?: number;
  no_defendible?: number;
  missing_raw_matches?: number;
  active_annulments?: number;
  annulled_responses?: number;
};

export type MonitoreoProcessingHandoffResult = {
  ok: true;
  schema: "monitoreo_processing_handoff_v1" | string;
  universe: MonitoreoProcessingHandoffUniverse | string;
  included_statuses?: string[];
  counts?: MonitoreoProcessingHandoffCounts;
  file_id: string;
  filename?: string;
  size?: number;
  download_url?: string;
  files?: {
    package?: MonitoreoTerritorialOperationalPackageFile;
    data_xlsx?: MonitoreoTerritorialOperationalPackageFile;
    xlsform?: MonitoreoTerritorialOperationalPackageFile;
  };
  would_mutate_pulso?: boolean;
};

export type MonitoreoProcessingHandoffFilterReport = {
  universe?: string;
  included_statuses?: string[];
  validada?: number;
  revision?: number;
  no_defendible_excluidos?: number;
  filas_incluidas?: number;
  tachas_activas_excluidas?: number;
  respuestas_tachadas_excluidas?: number;
};

export type MonitoreoProcessingHandoffPromoteResult = {
  ok: true;
  schema: "monitoreo_processing_handoff_promote_v1" | string;
  base_nombre: string;
  universe: MonitoreoProcessingHandoffUniverse | string;
  included_statuses?: string[];
  counts?: MonitoreoProcessingHandoffCounts;
  filter_report?: MonitoreoProcessingHandoffFilterReport;
  xlsform?: { file_id: string; source?: string };
  data?: { file_id: string; n_filas?: number; n_columnas?: number };
  would_mutate_pulso?: boolean;
};

export type MonitoreoTerritorialOperationalPackageReview = {
  schema: "monitoreo_deliverables_territorial_operational_package_review_v1" | string;
  generated_at?: string;
  project?: string;
  source?: string;
  cut?: string;
  status: "missing_package" | "blocked" | "review_ready" | string;
  publication_gate?: "critical_reference_drift" | "operational_package_review_ready" | "ready" | string;
  blocks_publication?: boolean;
  would_mutate_pulso?: boolean;
  apply_ready?: boolean;
  requires_revalidation?: boolean;
  publication_ready?: boolean;
  safe_to_apply?: boolean;
  application_plan?: {
    schema?: "monitoreo_deliverables_territorial_application_plan_v1" | string;
    would_mutate_pulso?: boolean;
    status?: "missing_package" | "blocked" | "ready" | string;
    payload_ready?: boolean;
    ready_rows?: number;
    blocked_rows?: number;
    rows?: Array<{
      package_item?: string;
      item_type?: string;
      safe_adjustment_action?: string;
      application_status?: "blocked_review_fields" | "blocked_missing_apply_payload" | "ready_to_apply" | string;
      missing_fields?: string[];
      endpoint?: string;
    }>;
  };
  required?: {
    ump_items?: string[];
    tachas?: number;
    fields?: string[];
  };
  coverage?: {
    package_rows?: number;
    reviewable_rows?: number;
    missing_ump_items?: string[];
    extra_ump_items?: string[];
    missing_tachas?: number;
    incomplete_rows?: number;
  };
  review_csv?: string;
  template_csv?: string;
  json?: string;
  markdown?: string;
  rows?: Array<Record<string, unknown>>;
};

export type MonitoreoTerritorialOperationalPackageReviewResult = {
  ok: true;
  review: MonitoreoTerritorialOperationalPackageReview;
  files?: {
    template?: MonitoreoTerritorialOperationalPackageFile;
    review_csv?: MonitoreoTerritorialOperationalPackageFile;
    report_json?: MonitoreoTerritorialOperationalPackageFile;
    report_md?: MonitoreoTerritorialOperationalPackageFile;
  };
  status: MonitoreoTerritorialOperationalPackageReview["status"];
  publication_gate?: string;
  blocks_publication?: boolean;
  apply_ready?: boolean;
  requires_revalidation?: boolean;
  publication_ready?: boolean;
  safe_to_apply?: boolean;
  application_plan?: MonitoreoTerritorialOperationalPackageReview["application_plan"];
  would_mutate_pulso?: boolean;
};

export type MonitoreoTerritorialProductionAnnulmentImpact = {
  schema?: string;
  scope?: "all_production" | "response" | string;
  responsible_key?: string;
  responsible_label?: string;
  response_id?: string;
  response_label?: string;
  responses_excluded?: number;
  valid_responses_excluded?: number;
  umps_affected?: number;
  blocks_affected?: number;
  before?: {
    total_responses?: number;
    valid_responses?: number;
    progress_pct?: number | null;
  };
  after?: {
    total_responses?: number;
    valid_responses?: number;
    progress_pct?: number | null;
  };
  blocks?: Array<{
    id_manzana?: string;
    ump?: string;
    manzana?: string;
    distrito?: string;
    tipo_manzana?: string;
    responsable?: string;
    respuestas_anuladas?: number;
    validas_anuladas?: number;
    estado_antes?: string;
    estado_despues?: string;
    validas_antes?: number;
    validas_despues?: number;
    meta?: number;
    brecha_despues?: number;
  }>;
  rows?: MonitoreoRow[];
};

export type MonitoreoTerritorialProductionAnnulment = {
  id: string;
  phase?: MonitoreoTerritorialPhase | string;
  status?: "active" | "reverted" | string;
  scope?: "all_production" | "response" | string;
  responsible_key?: string;
  responsible_label?: string;
  response_id?: string;
  response_id_field?: string;
  response_label?: string;
  reason?: string;
  note?: string;
  created_at?: string;
  created_by?: string;
  reverted_at?: string;
  reverted_by?: string;
  revert_reason?: string;
  impact?: MonitoreoTerritorialProductionAnnulmentImpact;
};

export type MonitoreoTerritorialProductionAnnulmentsPayload = {
  schema?: string;
  phase?: MonitoreoTerritorialPhase | string;
  summary?: {
    active?: number;
    reverted?: number;
    annulled_responses?: number;
    affected_umps?: number;
    affected_blocks?: number;
  };
  responsibles?: Array<{
    key: string;
    label: string;
    pulso_code?: string;
    responses?: number;
    valid_responses?: number;
    umps?: number;
    districts?: string;
    latest_activity?: string;
    status?: "activo" | "anulado" | string;
  }>;
  entries?: MonitoreoTerritorialProductionAnnulment[];
  rows?: MonitoreoRow[];
  affected_blocks?: MonitoreoTerritorialProductionAnnulmentImpact["blocks"];
};

export type MonitoreoTerritorialReconciliationBatchChange =
  | { client_id: string; kind: "code"; reconciliation: MonitoreoTerritorialCodeReconciliation }
  | { client_id: string; kind: "ump"; reconciliation: MonitoreoTerritorialUmpReconciliation };

export type MonitoreoTerritorialReconciliationBatchFailure = {
  client_id: string;
  kind: "code" | "ump" | string;
  code: string;
  message: string;
};

export type MonitoreoTerritorialReconciliationBatchApplied = {
  client_id: string;
  kind: "code" | "ump" | string;
  reconciliation: MonitoreoTerritorialCodeReconciliation | MonitoreoTerritorialUmpReconciliation;
};

export type MonitoreoTerritorialEnumeratorReconciliationResponse = {
  row_index: number;
  response_id: string;
  response_id_field?: string;
  raw_code: string;
  normalized_code: string;
  code?: string;
  ump?: string;
  ump_status?: "ok" | "not_configured" | "unresolved" | string;
  district?: string;
  district_code?: string;
  ubigeo?: string;
  assigned_code?: string;
  assigned_name?: string;
  reconciled?: boolean;
  status?: "pending" | "reconciled" | string;
  geo_estado?: string;
  source_filter_missing?: boolean;
};

export type MonitoreoTerritorialEnumeratorAssignment = {
  codigo_pulso: string;
  nombre: string;
  nombre_normalizado?: string;
  dni?: string;
  source_row?: number;
};

export type MonitoreoTerritorialEnumeratorRoster = {
  enabled: boolean;
  generated_at: string;
  uploaded_at: string;
  file_name: string;
  source_file_id: string;
  total: number;
  code_format: string;
  code_var: string;
  ump_var: string;
  assignments: MonitoreoTerritorialEnumeratorAssignment[];
};

export type MonitoreoFieldOccurrenceConfig = {
  enabled: boolean;
  form_title: string;
  form_id: string;
  asset_uid: string;
  asset_name: string;
  version_id: string;
  source_id: string;
  base_url: string;
  survey_url: string;
  asset_url: string;
  connection_profile_id: string;
  status: "not_configured" | "generated" | "deployed" | "synced" | string;
  generated_at: string;
  uploaded_at: string;
  last_sync_at: string;
  xlsform_file_id: string;
  xlsform_filename: string;
  code_var: string;
  start_time_var: string;
  end_time_var: string;
  route_phase: "pilot" | "field" | string;
  route_choices?: MonitoreoRow[];
};

export type MonitoreoTerritorialValidationDecisions = {
  approved_response_ids: string[];
  approval_reasons?: Record<string, string>;
  approved_at?: Record<string, string>;
};

export type MonitoreoConfig = {
  enumerator_var: string;
  date_var: string;
  start_var: string;
  end_var: string;
  duration_var: string;
  status_var: string;
  valid_statuses: string[];
  id_var: string;
  contact_var: string;
  control_vars: string[];
  critical_vars: string[];
  goals: MonitoreoGoal[];
  strategy_phases: MonitoreoStrategyPhase[];
  operational_model: MonitoreoOperationalModel;
  objetivo_total: number | null;
  min_duration_seconds: number;
  max_duration_seconds: number;
  supervision_n: number;
  supervision_seed: number;
  monitoreo_profile: MonitoreoProfile;
  acreditacion: MonitoreoAcreditacion;
  client_report: MonitoreoClientReportConfig;
  territorial: MonitoreoTerritorialConfig;
  aulas_universitarias: MonitoreoAulasConfig;
};

export type MonitoreoClientReportConfig = {
  channel_labels?: Record<string, string>;
};

export type MonitoreoManualCaseReconciliation = {
  response_id: string;
  actor: string;
  action: "keep_excluded" | "include_with_caveat" | string;
  declared_code: string;
  declared_email: string;
  assigned_person_label: string;
  assigned_case_key: string;
  assigned_base_source: string;
  assigned_base_row: number;
  match_type: string;
  previous_status: string;
  new_status: string;
  note: string;
  decided_at: string;
};

export type MonitoreoAssistedReviewCandidate = {
  candidate_id: string;
  person_label: string;
  case_key: string;
  base_record: string;
  base_source: string;
  base_row: number;
  base_status: string;
  match_type: string;
  match_label: string;
  evidence_level?: string;
  evidence_label?: string;
  evidence_score?: number;
  evidence_fields?: string[];
  current_status: string;
  already_effective: boolean | string;
  assignment_allowed?: boolean | string;
  suggested?: boolean | string;
};

export type MonitoreoAssistedReview = {
  eligible?: boolean | string;
  primary_key?: string;
  declared_code?: string;
  declared_email?: string;
  declared_name?: string;
  candidates?: MonitoreoAssistedReviewCandidate[];
  assignment_candidates?: MonitoreoAssistedReviewCandidate[];
  warnings?: string[];
  manual_decision?: MonitoreoManualCaseReconciliation | null;
};

export type MonitoreoProfile = {
  family: "acreditacion" | "territorial" | "aulas_universitarias" | "telefonico" | "digital_general";
  variant: "multi_actor" | "segmentada_por_carrera";
  status: "active" | "planned" | string;
  route_selected?: boolean;
  locked_at?: string;
  units: Array<Record<string, unknown>>;
  segments: Array<Record<string, unknown>>;
  groups: Array<Record<string, unknown>>;
  minimums: Record<string, number>;
  rejection_rules: Array<Record<string, unknown>>;
  platform_effective_filter?: {
    enabled?: boolean;
    variable?: string;
    values?: string[];
    label?: string;
    value_label?: string;
    source_kind?: string;
  };
  platform_test_filter?: {
    enabled?: boolean;
    variable?: string;
    values?: string[];
    real_values?: string[];
    label?: string;
    value_label?: string;
  };
  key_rules: {
    universe_fields: string[];
    response_fields: string[];
    use_name_fallback: boolean;
    automatic_detection: boolean;
  };
  deduplication: {
    priority: string[];
  };
  alerts: Record<string, number>;
  reconciliation_decisions?: {
    include_response_ids?: string[];
    exclude_response_ids?: string[];
    manual_case_reconciliations?: Record<string, MonitoreoManualCaseReconciliation>;
  };
};

export type MonitoreoVariable = {
  name: string;
  label?: string;
  tipo: string;
  n_missing: number;
  n_unique: number;
  values?: string[];
};

export type MonitoreoKpis = {
  total: number;
  valid: number;
  invalid: number;
  target: number | null;
  avance_pct: number | null;
  ritmo_diario: number | null;
  duration_median: number | null;
  duration_p95: number | null;
  inconsistencies: number;
};

export type MonitoreoTerritorialUpdateHistoryEntry = {
  id: string;
  type: "inspect" | "sync" | string;
  asset_uid: string;
  asset_name: string;
  version_id: string;
  source_id: string;
  response_count: number;
  status: "ok" | "warning" | "error" | string;
  message: string;
  created_at: string;
};

export type MonitoreoRow = Record<string, string | number | boolean | null>;

export type MonitoreoReportBlock = {
  id: string;
  title: string;
  columns: string[];
  rows: MonitoreoRow[];
  note?: string;
};

export type MonitoreoReportSheet = {
  id: string;
  title: string;
  description: string;
  scope: "interno" | "cliente" | string;
  blocks: MonitoreoReportBlock[];
};

export type MonitoreoClientReport = {
  schema: string;
  generated_at: string;
  title: string;
  summary: MonitoreoRow[];
  actors: MonitoreoRow[];
  daily_general: MonitoreoRow[];
  daily_actor: MonitoreoRow[];
  sources: MonitoreoRow[];
  collector_sources?: MonitoreoRow[];
  controls?: MonitoreoRow[];
  has_targets: boolean;
  sheets?: MonitoreoReportSheet[];
};

export type MonitoreoPublicationSection = {
  id: string;
  title: string;
  description?: string;
  columns?: string[];
  rows?: MonitoreoRow[];
  n_rows?: number;
};

export type MonitoreoDailyReference = {
  label?: string;
  value?: number | string | null;
  configured?: boolean;
  universe?: number | string | null;
};

export type MonitoreoDailyProgressModel = {
  schema?: "monitoreo_daily_progress_v1" | string;
  family?: string;
  by_date_status?: MonitoreoRow[];
  daily_effective?: MonitoreoRow[];
  cumulative_effective?: MonitoreoRow[];
  cumulative_by_status?: MonitoreoRow[];
  by_date_actor?: MonitoreoRow[];
  by_date_segment?: MonitoreoRow[];
  by_date_district?: MonitoreoRow[];
  by_date_ump?: MonitoreoRow[];
  target_reference?: MonitoreoDailyReference;
  universe_reference?: MonitoreoDailyReference;
  status_palette?: Record<string, string>;
  empty_state?: Record<string, string>;
};

export type MonitoreoPublicationModel = {
  schema: "monitoreo_publication_model_v1" | string;
  audience: "client" | "internal" | string;
  family:
    | "acreditacion"
    | "territorial"
    | "aulas_universitarias"
    | "accreditation_monitoring"
    | "territorial_fieldwork"
    | "university_classroom_fieldwork"
    | "generic_monitoring"
    | string;
  generated_at: string;
  synced_at?: string;
  tab_order?: string[];
  daily_progress?: MonitoreoDailyProgressModel;
  accreditation_progress?: {
    client?: {
      overall_coverage?: MonitoreoRow[];
      by_actor_coverage?: MonitoreoRow[];
      by_segment_coverage?: MonitoreoRow[];
      daily_progress?: MonitoreoRow[];
      cumulative_progress?: MonitoreoRow[];
    };
    internal?: {
      actor_targets?: MonitoreoRow[];
      minimum_targets?: MonitoreoRow[];
      gaps_to_minimum?: MonitoreoRow[];
      internal_target_status?: MonitoreoRow[];
    };
  };
  implementation_map?: MonitoreoRow[];
  portada?: MonitoreoPublicationSection;
  resumen_avance?: MonitoreoPublicationSection;
  avance_por_distrito?: MonitoreoPublicationSection;
  avance_por_ump?: MonitoreoPublicationSection;
  avance_diario?: MonitoreoPublicationSection;
  avance_por_responsable?: MonitoreoPublicationSection;
  cuotas_resumen?: MonitoreoPublicationSection;
  resumen_ejecutivo?: MonitoreoPublicationSection;
  avance_general?: MonitoreoPublicationSection;
  avance_por_actor?: MonitoreoPublicationSection;
  avance_por_segmento?: MonitoreoPublicationSection;
  cobertura_pendientes?: MonitoreoPublicationSection;
  brechas_cumplimiento?: MonitoreoPublicationSection;
  resumen_operativo?: MonitoreoPublicationSection;
  metas_internas_actor?: MonitoreoPublicationSection;
  pendientes_por_actor?: MonitoreoPublicationSection;
  control_seguimiento?: MonitoreoPublicationSection;
  avance_campo?: MonitoreoPublicationSection;
  encuestadores_rutas?: MonitoreoPublicationSection;
  cuotas_ump?: MonitoreoPublicationSection;
  validacion_tiempos?: MonitoreoPublicationSection;
  ocurrencias_campo?: MonitoreoPublicationSection;
  casos_accionables?: MonitoreoPublicationSection;
  gps_territorio?: MonitoreoPublicationSection;
  fuentes_actualizacion?: MonitoreoPublicationSection;
  auditoria_tecnica?: MonitoreoPublicationSection;
  base_tecnica?: MonitoreoPublicationSection;
  [key: string]: unknown;
};

export type PublicArtifactKind = "dashboard" | "monitoreo" | string;

export type PublicArtifactDescriptor = {
  kind: PublicArtifactKind;
  title: string;
  module: string;
  public_scope: string;
  audience?: "client" | "internal" | string;
  profile_family?: "acreditacion" | "territorial" | "aulas_universitarias" | string;
  publication_family?: "accreditation_monitoring" | "territorial_fieldwork" | "university_classroom_fieldwork" | "generic_monitoring" | string;
  monitoring_family?: "accreditation_monitoring" | "territorial_fieldwork" | "university_classroom_fieldwork" | "generic_monitoring" | string;
  destination?: "hugging_face_space" | "google_sheets" | string;
  source?: string;
  namespace?: string;
  space_name?: string;
  repo_id?: string;
  app_url?: string;
  space_url?: string;
  sheet_url?: string;
  last_used_at?: string;
  publication_sections?: Array<{ id?: string; title?: string; n_rows?: number } | string>;
  report_scope?: string;
  published_at?: string;
};

export type MonitoreoLastSheetsPublication = {
  ok?: true;
  spreadsheet_id: string;
  spreadsheet_url?: string;
  controlled_tabs?: string[];
  tabs?: string[];
  updated_at?: string;
  mode?: "controlled_write" | string;
  audience?: "client" | "internal" | string;
  include_targets?: boolean;
  confirmed_full_data?: boolean;
};

export type MonitoreoPublicReportPayload = {
  ok: true;
  generated_at: string;
  synced_at: string;
  n_rows?: number;
  audience?: "client" | "internal" | string;
  profile: {
    family: "acreditacion" | "territorial" | string;
    variant?: string;
    status?: string;
  };
  publication_model?: MonitoreoPublicationModel;
  internal?: {
    schema: string;
    family?: string;
    generated_at?: string;
    synced_at?: string;
    n_rows?: number;
    dashboard?: MonitoreoDashboard | null;
    reports?: Record<string, unknown>;
    snapshot?: { synced_at?: string; errors?: unknown[]; rows?: MonitoreoRow[] };
  };
  accreditation?: {
    schema: string;
    title: string;
    generated_at: string;
    has_targets: boolean;
    summary: MonitoreoRow[];
    actors: MonitoreoRow[];
    daily_general: MonitoreoRow[];
    daily_actor: MonitoreoRow[];
    sources: MonitoreoRow[];
  };
  territorial?: {
    schema: string;
    generated_at: string;
    active_route_phase: "pilot" | "field" | string;
    phase_note?: string;
    kpis: MonitoreoRow | Record<string, string | number | boolean | null>;
    advance: MonitoreoRow | Record<string, string | number | boolean | null>;
    district_progress: MonitoreoRow[];
    daily: MonitoreoRow[];
    route_quota_progress?: {
      configured: boolean;
      summary?: Record<string, string | number | boolean | null> | null;
      district_summary?: Record<string, string | number | boolean | null> | null;
      districts?: MonitoreoRow[];
    };
  };
};

export type MonitoreoInternalQueryCase = {
  actor: string;
  person_label: string;
  case_key: string;
  response_id: string;
  date: string;
  response_datetime?: string;
  source_id: string;
  source_label: string;
  channel: string;
  collector_id: string;
  collector_name: string;
  platform_state: string;
  base_result: string;
  base_record: string;
  base_source: string;
  base_status: string;
  decision: string;
  decision_reason: string;
  advancement: "effective" | "partial" | "refusal" | "pending" | "included_review" | "excluded" | string;
  issue_type: string;
  rule: string;
  pending_exit: boolean | string;
  recovery_collector: boolean | string;
  response_row: number;
  duplicate_count: number;
  duplicate_group_key?: string;
  duplicate_group_size?: number;
  counts_in_advance?: boolean | string;
  duplicate_counting_status?: string;
  partial_answered_questions?: number;
  partial_total_questions?: number;
  partial_completion_pct?: number;
  partial_last_question?: string;
  partial_next_question?: string;
  identity_status?: string;
  identity_label?: string;
  channel_key_strategy?: string;
  channel_key_strategy_label?: string;
  primary_identity_label?: string;
  primary_identity_value?: string;
  secondary_identity_label?: string;
  secondary_identity_value?: string;
  review_priority?: number;
  phone_audit?: {
    cv_id?: string;
    final_codpulso?: string;
    declared_phone?: string;
    responsible?: string;
    phone_match_level?: string;
    phone_number_evidence?: string;
    recommended_action?: string;
    link_base?: {
      record?: string;
      person_label?: string;
      case_key?: string;
      status?: string;
      responsible?: string;
      source?: string;
    };
    manual_code_base?: {
      record?: string;
      person_label?: string;
      case_key?: string;
      status?: string;
      responsible?: string;
      source?: string;
    };
  } | null;
  assisted_review?: MonitoreoAssistedReview | null;
};

export type MonitoreoInternalQueryTotal = {
  actor?: string;
  date?: string;
  channel?: string;
  source?: string;
  collector?: string;
  total: number;
  efectivas: number;
  parciales: number;
  rechazos: number;
  pendientes: number;
  revision: number;
  salen_de_pendientes: number;
};

export type MonitoreoInternalQueryIssue = {
  issue_type: string;
  label: string;
  severity: string;
  actor: string;
  case_key: string;
  response_id: string;
  count: number;
  detail: string;
};

export type MonitoreoInternalQueryFlow = {
  nodes: Array<{ id: string; label: string }>;
  links: Array<{ source: string; target: string; value: number }>;
};

export type MonitoreoInternalQueries = {
  schema: string;
  cases: MonitoreoInternalQueryCase[];
  case_rollup?: MonitoreoInternalQueryCase[];
  totals: {
    actor: MonitoreoInternalQueryTotal[];
    date: MonitoreoInternalQueryTotal[];
    channel: MonitoreoInternalQueryTotal[];
    source: MonitoreoInternalQueryTotal[];
    collector: MonitoreoInternalQueryTotal[];
  };
  pending_exit: MonitoreoInternalQueryCase[];
  issues: MonitoreoInternalQueryIssue[];
  flow: MonitoreoInternalQueryFlow;
};

export type MonitoreoAcreditacionReports = {
  schema: string;
  report_scope?: "source" | "advance_summary" | "queries_summary" | "phone_summary" | "full" | string;
  generated_at: string;
  reference_tabs: string[];
  internal_queries?: MonitoreoInternalQueries | null;
  client_report?: MonitoreoClientReport | null;
  sheets: MonitoreoReportSheet[];
};

export type TerritorialDistrictProgress = {
  ubigeo: string;
  distrito: string;
  meta: number | null;
  total: number;
  validas: number;
  revision: number;
  no_defendibles: number;
  avance_pct: number | null;
  brecha: number | null;
};

export type TerritorialBlockProgress = {
  id_manzana: string;
  ubigeo: string;
  distrito: string;
  zona: string;
  manzana: string;
  tipo_manzana: string;
  departamento?: string;
  provincia?: string;
  viviendas?: number | null;
  poblacion?: number | null;
  territorio_muestral?: string;
  metodo?: string;
  responsable?: string;
  orden_seleccion?: number | null;
  hoja_num?: number | null;
  rango_inicio?: number | null;
  rango_fin?: number | null;
  entrevistas?: number | null;
  medida_tamano?: number | null;
  lat?: number | null;
  lon?: number | null;
  ump?: string;
  replacement_policy?: string;
  replacement_order?: number | null;
  replacement_total?: number | null;
  titular_id_manzana?: string;
  titular_orden_seleccion?: number | null;
  titular_ubigeo?: string;
  titular_zona?: string;
  titular_hoja_num?: number | null;
  titular_rango_inicio?: number | null;
  titular_rango_fin?: number | null;
  replacement_label?: string;
  replacement_fallback?: string | boolean | null;
  esquina_codigo?: number | null;
  esquina_inicio?: string;
  esquina_coordenada?: string;
  sentido_recorrido?: string;
  vivienda_inicio?: number | null;
  domicilio_inicio?: number | null;
  constante_salto?: number | null;
  constante_salto_unidad?: string;
  constante_salto_modo?: string;
  modo_seleccion_vivienda?: string;
  nse_codigo?: string | number | null;
  nse_nivel?: string | null;
  meta: number | null;
  validas: number;
  revision: number;
  no_defendibles: number;
  avance_pct: number | null;
  brecha: number | null;
};

export type TerritorialResponseAuditRow = {
  row_index: number;
  response_id: string;
  district_code: string;
  distrito: string;
  ubigeo: string;
  consent: string;
  age: number | null;
  sex?: string;
  status: string;
  submitted_by: string;
  pulso_code?: string;
  pulso_code_raw?: string;
  pulso_code_normalized?: string;
  enumerator_assigned?: string;
  responsible_display?: string;
  pulso_code_recognized?: boolean;
  pulso_code_reconciled?: boolean;
  pulso_code_range_warning?: boolean;
  submission_time: string;
  submission_time_source?: string;
  submission_date_iso?: string;
  submission_date?: string;
  submission_hour?: string;
  submission_datetime?: string;
  duration_seconds: number | null;
  duration_status?: "sin_dato" | "muy_corta" | "corta" | "esperada" | "larga" | "extrema" | string;
  duration_operational_status?: "normal" | "corto" | "muy_corto" | string;
  duration_operational_label?: "Normal" | "Corto" | "Muy corto" | string;
  duration_source?: string;
  duration_source_type?: "duration_field" | "start_end" | "missing" | string;
  lat: number | null;
  lon: number | null;
  gps_parseable: boolean;
  geo_estado: "geo_ok" | "geo_cerca" | "geo_revision" | "geo_no_defendible" | "geo_sin_cruce" | "geo_sin_gps" | string;
  distance_m: number | null;
  nearest_block_id: string;
  nearest_block_type: string;
  geometry_match?: string;
  gps_primary_source?: string;
  gps_primary_lat?: number | null;
  gps_primary_lon?: number | null;
  gps_primary_altitude?: number | null;
  gps_primary_accuracy_m?: number | null;
  gps_primary_parseable?: boolean;
  gps_primary_estado?: "geo_ok" | "geo_cerca" | "geo_revision" | "geo_no_defendible" | "geo_sin_cruce" | "geo_sin_gps" | string;
  gps_primary_distance_m?: number | null;
  gps_primary_nearest_block_id?: string;
  gps_primary_nearest_block_type?: string;
  gps_primary_geometry_match?: string;
  gps_effective_source?: string;
  gps_effective_lat?: number | null;
  gps_effective_lon?: number | null;
  gps_effective_altitude?: number | null;
  gps_effective_accuracy_m?: number | null;
  gps_effective_estado?: "geo_ok" | "geo_cerca" | "geo_revision" | "geo_no_defendible" | "geo_sin_cruce" | "geo_sin_gps" | string;
  gps_effective_distance_m?: number | null;
  gps_effective_nearest_block_id?: string;
  gps_effective_nearest_block_type?: string;
  gps_effective_geometry_match?: string;
  gps_reclassified?: boolean;
  gps_reclassification_note?: string;
  gps_nearest_differs_operational?: boolean;
  declared_ump_raw?: string;
  declared_ump_normalized?: string;
  advance_block_id?: string;
  advance_block_ump?: string;
  advance_block_ubigeo?: string;
  advance_block_distrito?: string;
  advance_block_zona?: string;
  advance_block_manzana?: string;
  advance_block_type?: string;
  advance_block_match?: boolean;
  advance_block_match_status?: "recognized" | "reconciled" | "review" | "missing" | string;
  advance_valid?: boolean;
  advance_status?: "validada" | "revision" | "no_defendible" | string;
  advance_date?: string;
  observation_status?: "sin_observacion" | "en_observacion" | "aprobada" | "no_valida" | string;
  observation_reasons?: string;
  validation_decision?: "visto_bueno" | string;
  validation_decision_reason?: string;
  validation_decision_at?: string;
  validation_status: "validada" | "revision" | "no_defendible" | string;
  source_effective?: boolean;
  source_filter_missing?: boolean;
  issues: string;
};

export type TerritorialInternalReviewCase = {
  id: string;
  type: "record" | "gps" | "duration" | "ump" | string;
  reason: string;
  action: "record" | "map" | "duration" | "ump" | string;
  phase?: MonitoreoTerritorialPhase | string;
  response_id?: string;
  row_index?: number | null;
  age?: number | null;
  sex?: string;
  district: string;
  ubigeo?: string;
  ump?: string;
  block_id?: string;
  block_type?: string;
  zona?: string;
  manzana?: string;
  responsible: string;
  submitted_by?: string;
  pulso_code?: string;
  pulso_code_raw?: string;
  pulso_code_recognized?: boolean;
  pulso_code_reconciled?: boolean;
  submission_date_iso?: string;
  submission_date?: string;
  submission_hour?: string;
  submission_datetime?: string;
  duration_seconds?: number | null;
  duration_status?: string;
  duration_operational_status?: "normal" | "corto" | "muy_corto" | string;
  duration_operational_label?: "Normal" | "Corto" | "Muy corto" | string;
  distance_m?: number | null;
  geo_estado?: string;
  validas?: number | null;
  meta?: number | null;
  observation_status?: string;
  validation_status?: string;
  validation_decision?: string;
  advance_valid?: boolean;
  source_effective?: boolean;
  status?: "sin_observacion" | "pendiente" | "en_observacion" | "visto_bueno" | string;
  issues?: string;
};

export type MonitoreoTerritorialRouteSheetAssignment = MonitoreoRow & {
  source_id?: string;
  source_label?: string;
  source_row?: number;
  phase?: MonitoreoTerritorialPhase | string;
  ruta?: string;
  distrito?: string;
  zona?: string;
  manzana?: string;
  codigo_manzana?: string;
  tipo_manzana?: string;
  reemplaza_a?: string;
  rango_encuestas?: string;
  rango_inicio?: number | null;
  rango_fin?: number | null;
  encuestas?: number | null;
  ump?: string;
  encuestador?: string;
  expected_code?: string;
  fecha_salida?: string;
  fecha_entrega?: string;
  estado?: string;
  matched_block_id?: string;
  matched_ump?: string;
  matched_distrito?: string;
  matched_zona?: string;
  matched_manzana?: string;
  match_method?: string;
  match_status?: "matched" | "unmatched" | string;
  response_count?: number;
  started?: boolean;
  validas?: number;
  revision?: number;
  no_defendibles?: number;
  last_response?: string;
};

export type MonitoreoTerritorialRouteSheetProgress = {
  encuestador: string;
  encuestador_key?: string;
  expected_code?: string;
  assigned_blocks: number;
  matched_blocks: number;
  started: number;
  no_response: number;
  total_responses: number;
  validas: number;
  revision: number;
  no_defendibles: number;
  last_response?: string;
};

export type MonitoreoTerritorialRouteSheetRecommendation =
  | { client_id: string; kind: "code"; reconciliation: MonitoreoTerritorialCodeReconciliation }
  | { client_id: string; kind: "ump"; reconciliation: MonitoreoTerritorialUmpReconciliation };

export type MonitoreoTerritorialRouteSheet = {
  schema: "monitoreo_territorial_route_sheet_v1" | string;
  phase: MonitoreoTerritorialPhase | string;
  connected: boolean;
  source_id?: string;
  source_label?: string;
  headers_ok: boolean;
  reason?: string;
  metrics: {
    rows: number;
    assignments: number;
    matched_rows: number;
    unmatched_rows: number;
    assigned_encuestadores: number;
    assigned_without_response: number;
    wrong_ump_candidates: number;
    wrong_code_candidates: number;
    orphan_responses: number;
  };
  warnings?: Array<{ level?: string; code?: string; message?: string }>;
  assignments: MonitoreoTerritorialRouteSheetAssignment[];
  assignment_progress: MonitoreoTerritorialRouteSheetProgress[];
  diagnostics: {
    sheet_assigned_no_response: MonitoreoTerritorialRouteSheetAssignment[];
    wrong_ump_candidates: MonitoreoRow[];
    wrong_code_candidates: MonitoreoRow[];
    unmatched_sheet_rows: MonitoreoTerritorialRouteSheetAssignment[];
    orphan_responses: MonitoreoRow[];
  };
  recommendations: {
    ump: MonitoreoTerritorialRouteSheetRecommendation[];
    code: MonitoreoTerritorialRouteSheetRecommendation[];
    batch: MonitoreoTerritorialRouteSheetRecommendation[];
  };
  review_cases?: TerritorialInternalReviewCase[];
};

export type MonitoreoTerritorialMapCacheLayerStatus = "valid" | "stale" | "missing" | "refreshing" | string;

export type MonitoreoTerritorialMapCacheLayerMeta = {
  layer?: "route_geometry" | "gps_points" | string;
  status: MonitoreoTerritorialMapCacheLayerStatus;
  hash?: string;
  expected_hash?: string;
  route_hash?: string;
  expected_route_hash?: string;
  created_at?: string;
  invalidated_at?: string;
  invalidated_reason?: string;
  stale?: boolean;
  usable?: boolean;
  bounds?: Record<string, number | string | null>;
  counts?: Record<string, number | string | null>;
};

export type MonitoreoTerritorialMapPhaseCacheMeta = {
  phase: "pilot" | "field" | string;
  route_geometry?: MonitoreoTerritorialMapCacheLayerMeta;
  gps_points?: MonitoreoTerritorialMapCacheLayerMeta;
};

export type MonitoreoTerritorialMapCacheMeta = {
  schema: string;
  generated_at?: string;
  active_route_phase?: "pilot" | "field" | string;
  phases?: Partial<Record<"pilot" | "field", MonitoreoTerritorialMapPhaseCacheMeta>>;
  active?: MonitoreoTerritorialMapPhaseCacheMeta;
};

export type MonitoreoTerritorialReportCacheMeta = {
  schema?: string;
  status?: "hit" | "miss" | string;
  cache_hit?: boolean;
  cache_source?: "session" | "snapshot" | "project" | "build" | string;
  key?: string;
  phase?: "pilot" | "field" | string;
  source_id?: string;
  report_scope?: "source" | "route_summary" | "advance_summary" | "validation_summary" | "queries_summary" | "phone_summary" | "full" | string;
  snapshot_hash?: string;
  route_hash?: string;
  config_hash?: string;
  backend_ms?: number;
  total_ms?: number;
  payload_size?: number;
  created_at?: string;
};

export type MonitoreoTerritorialPrewarmScopeResult = {
  scope: "source" | "route_summary" | "advance_summary" | "validation_summary" | "queries_summary" | "phone_summary" | "full" | string;
  status: "ready" | "error" | "stale" | string;
  cache_hit?: boolean;
  cache_source?: "session" | "snapshot" | "project" | "build" | "error" | string;
  backend_ms?: number | null;
  total_ms?: number | null;
  payload_size?: number | null;
  error?: string;
};

export type MonitoreoTerritorialPrewarmResult = {
  ok: true;
  phase: "pilot" | "field" | string;
  scopes: MonitoreoTerritorialPrewarmScopeResult[];
  map_cache?: MonitoreoTerritorialMapCacheMeta | { error?: string } | null;
  state?: MonitoreoState | null;
};

export type MonitoreoPerformanceMeta = {
  view?: string;
  phase?: string;
  source_id?: string;
  report_scope?: string;
  cache_hit?: boolean;
  cache_source?: string;
  backend_ms?: number;
  total_ms?: number;
  payload_size?: number;
};

export type TerritorialMapPayload = {
  phase: "pilot" | "field" | string;
  blocks: TerritorialBlockProgress[];
  points: Array<Pick<TerritorialResponseAuditRow, "response_id" | "submitted_by" | "pulso_code" | "pulso_code_raw" | "pulso_code_normalized" | "enumerator_assigned" | "responsible_display" | "pulso_code_recognized" | "pulso_code_reconciled" | "pulso_code_range_warning" | "submission_time_source" | "submission_date_iso" | "submission_date" | "submission_hour" | "submission_datetime" | "duration_seconds" | "duration_status" | "duration_operational_status" | "duration_operational_label" | "ubigeo" | "distrito" | "age" | "sex" | "lat" | "lon" | "gps_parseable" | "geo_estado" | "distance_m" | "nearest_block_id" | "nearest_block_type" | "gps_primary_source" | "gps_primary_lat" | "gps_primary_lon" | "gps_primary_altitude" | "gps_primary_accuracy_m" | "gps_primary_parseable" | "gps_primary_estado" | "gps_primary_distance_m" | "gps_primary_nearest_block_id" | "gps_primary_nearest_block_type" | "gps_primary_geometry_match" | "gps_effective_source" | "gps_effective_lat" | "gps_effective_lon" | "gps_effective_altitude" | "gps_effective_accuracy_m" | "gps_effective_estado" | "gps_effective_distance_m" | "gps_effective_nearest_block_id" | "gps_effective_nearest_block_type" | "gps_effective_geometry_match" | "gps_reclassified" | "gps_reclassification_note" | "declared_ump_raw" | "declared_ump_normalized" | "advance_block_id" | "advance_block_ump" | "advance_block_ubigeo" | "advance_block_distrito" | "advance_block_zona" | "advance_block_manzana" | "advance_block_type" | "advance_block_match" | "advance_block_match_status" | "advance_valid" | "observation_status" | "observation_reasons" | "validation_status" | "issues">>;
  cache?: MonitoreoTerritorialMapPhaseCacheMeta | null;
  alerts: Array<{ severity: string; code: string; message: string }>;
  legend: Array<{ key: string; label: string }>;
};

export type TerritorialDeclaredUmpStatus = "recognized" | "reconciled" | "review" | "missing" | string;

export type TerritorialDeclaredUmpRow = {
  raw_ump: string;
  normalized_ump: string;
  response_count: number;
  route_match: boolean | null;
  response_id?: string;
  response_id_field?: string;
  assigned_block_id?: string;
  assigned_ump?: string;
  assigned_district?: string;
  assigned_ubigeo?: string;
  assigned_responsible?: string;
  reconciliation_scope?: "response" | "ump_value" | string;
  route_block_count?: number | null;
  route_blocks?: Array<{
    route_ump?: string;
    id_manzana?: string;
    distrito?: string;
    ubigeo?: string;
    zona?: string;
    manzana?: string;
    tipo_manzana?: string;
    responsable?: string;
    label?: string;
  }>;
  responsible?: string;
  responsible_source?: "route" | "codigo_pulso" | string;
  status: TerritorialDeclaredUmpStatus;
  status_label?: string;
};

export type TerritorialDeclaredUmpSummary = {
  schema: string;
  phase: "pilot" | "field" | string;
  field: string;
  field_resolved?: string;
  configured: boolean;
  route_ump_count: number;
  metrics: {
    recognized_ump_count: number;
    review_ump_count: number;
    responses_with_ump: number;
    responses_without_ump: number;
    reconciled_ump_count?: number;
  };
  route_options?: Array<{
    route_ump?: string;
    id_manzana?: string;
    distrito?: string;
    ubigeo?: string;
    zona?: string;
    manzana?: string;
    tipo_manzana?: string;
    responsable?: string;
    label?: string;
  }>;
  rows: TerritorialDeclaredUmpRow[];
};

export type MonitoreoFieldOccurrenceSummary = {
  total_records: number;
  days_reported: number;
  responsables: number;
  manzanas_reportadas: number;
  efectivas: number;
  no_efectivas: number;
  intentos: number;
  tasa_no_efectiva: number | null;
};

export type MonitoreoFieldOccurrenceRecord = MonitoreoRow & {
  row_id: string;
  codigo_pulso: string;
  date: string;
  date_label: string;
  hora_inicio: string;
  hora_final: string;
  hora_label: string;
  datetime_label: string;
  phase: string;
  responsable: string;
  distrito: string;
  ubigeo: string;
  zona: string;
  manzana: string;
  manzana_key: string;
  tipo_manzana: string;
  ump: string;
  route_label: string;
  route_match_status?: string;
  route_match_message?: string;
  total_manzanas_recorridas: number;
  no_efectivas: number;
  efectivas: number;
  intentos: number;
  tasa_no_efectiva: number | null;
  observaciones: string;
};

export type MonitoreoFieldOccurrenceUmpSummary = {
  key: string;
  ump: string;
  manzana: string;
  manzana_key: string;
  route_label: string;
  distrito: string;
  zona: string;
  responsable: string;
  route_match_status?: string;
  route_match_message?: string;
  has_report?: boolean;
  estado_consolidado?: "sin_reporte" | "iniciada_sin_reporte" | "completa_sin_reporte" | "incompleta_sin_reporte" | "reportada_efectiva" | "reportada_no_efectiva" | "revisar_cruce" | string;
  motivo_principal?: string;
  reportes: number;
  efectivas: number;
  no_efectivas: number;
  intentos: number;
  avance_validas?: number;
  avance_meta?: number;
  avance_iniciada?: boolean;
  avance_completa?: boolean;
  avance_estado_cuota?: string;
  avance_ultimo_ingreso?: string;
  tasa_no_efectiva: number | null;
  ultimo_reporte: string;
  outcomes: Array<{ key: string; label: string; total: number }>;
};

export type MonitoreoFieldOccurrenceDistrictSummary = {
  distrito: string;
  ump_reportadas: number;
  ump_sin_reporte: number;
  ump_iniciadas_sin_reporte?: number;
  ump_completas_sin_reporte?: number;
  ump_incompletas_sin_reporte?: number;
  validas_sin_reporte?: number;
  ultimo_ingreso_sin_reporte?: string;
  efectivas: number;
  no_efectivas: number;
  intentos: number;
  outcomes: Array<{ key: string; label: string; total: number }>;
  motivo_principal: string;
  tasa_no_efectiva: number | null;
};

export type MonitoreoFieldOccurrenceDashboard = {
  schema: string;
  generated_at: string;
  config: MonitoreoFieldOccurrenceConfig;
  snapshot?: {
    synced_at: string;
    n_rows: number;
    source_id: string;
    asset_uid: string;
  };
  history?: MonitoreoTerritorialUpdateHistoryEntry[];
  summary: MonitoreoFieldOccurrenceSummary;
  by_outcome: Array<{ key: string; label: string; total: number }>;
  by_day: Array<{ date: string; date_label: string; intentos: number; efectivas: number; no_efectivas: number }>;
  by_responsable: Array<{
    responsable: string;
    reportes: number;
    manzanas: number;
    efectivas: number;
    no_efectivas: number;
    intentos: number;
    ultimo_codigo_pulso: string;
    ultimo_reporte: string;
    route_labels: string[];
  }>;
  by_ump?: MonitoreoFieldOccurrenceUmpSummary[];
  by_district?: MonitoreoFieldOccurrenceDistrictSummary[];
  records: MonitoreoFieldOccurrenceRecord[];
  alerts: {
    missing_blocks: MonitoreoRow[];
    started_missing_ump?: MonitoreoFieldOccurrenceUmpSummary[];
    high_non_effective: MonitoreoFieldOccurrenceRecord[];
    observations: MonitoreoFieldOccurrenceRecord[];
    outside_route: MonitoreoFieldOccurrenceRecord[];
  };
};

export type MonitoreoFieldOccurrenceFieldCheckItem = {
  key: string;
  label: string;
  required: boolean;
  ok: boolean;
  found_name: string;
  found_type: string;
  expected: string[];
  note?: string;
};

export type MonitoreoFieldOccurrenceFieldCheck = {
  status: "ready" | "missing_required" | string;
  ok: boolean;
  required_ok: boolean;
  message: string;
  field_count: number;
  missing_required: string[];
  items: MonitoreoFieldOccurrenceFieldCheckItem[];
};

export type MonitoreoFieldOccurrenceInspectResult = {
  ok: true;
  asset_uid: string;
  base_url: string;
  inspected_at: string;
  schema: {
    asset_uid: string;
    name: string;
    version_id: string;
    deployment_active: boolean;
    survey_count: number;
    choices_count: number;
    survey_fields?: Array<{ name: string; type: string; label?: string; xpath?: string; list_name?: string }>;
    all_fields?: Array<{ name: string; type: string; label?: string; xpath?: string; list_name?: string }>;
    [key: string]: unknown;
  };
  field_check: MonitoreoFieldOccurrenceFieldCheck;
};

export type MonitoreoFieldOccurrenceUploadResult = {
  ok: true;
  file?: { file_id: string; original_name: string; size: number; ext?: string };
  download_url?: string;
  upload?: { asset_uid: string; version_id: string; survey_url?: string; asset_url?: string; deployment?: unknown };
  source?: MonitoreoSource;
  config?: MonitoreoConfig;
  field_occurrences: MonitoreoFieldOccurrenceDashboard;
  state: MonitoreoState;
};

export type TerritorialQuotaProgressItem = {
  label: string;
  target: number;
  achieved: number;
  missing: number;
  operational_adjustment_delta?: number;
  operational_adjustment_gain?: number;
  operational_adjustment_loss?: number;
  observed_achieved?: number;
};

export type TerritorialQuotaObservedCrossCell = {
  label: string;
  age?: string;
  value: number;
  adjustment_delta?: number;
  adjusted_value?: number;
};

export type TerritorialQuotaObservedCrossRow = {
  label: string;
  target?: number;
  total: number;
  adjustment_delta?: number;
  adjusted_total?: number;
  cells: TerritorialQuotaObservedCrossCell[];
};

export type TerritorialQuotaObservedCrossColumn = {
  label: string;
  target?: number;
  total: number;
  adjustment_delta?: number;
  adjusted_total?: number;
};

export type TerritorialQuotaObservedCross = {
  schema?: string;
  source?: string;
  total?: number;
  total_consentido?: number;
  adjustment_delta?: number;
  adjusted_total?: number;
  rows: TerritorialQuotaObservedCrossRow[];
  columns: TerritorialQuotaObservedCrossColumn[];
  note?: string;
};

export type TerritorialQuotaProgressBlock = {
  id_manzana: string;
  ubigeo?: string;
  distrito?: string;
  zona?: string;
  manzana?: string;
  tipo_manzana?: string;
  ump?: string | number | null;
  titular_id_manzana?: string;
  titular_manzana?: string;
  titular_hoja_num?: string | number | null;
  replacement_order?: string | number | null;
  replacement_total?: string | number | null;
  replacement_label?: string;
  responsable?: string;
  responsible?: string;
  configured: boolean;
  status: "complete" | "in_field" | "pending" | "partial" | "missing" | "exceeded" | "not_configured" | string;
  operational_group_status?: "complete" | "in_field" | "pending" | "partial" | "missing" | "exceeded" | "not_configured" | string;
  operational_group_selected?: boolean;
  target: number;
  validas: number;
  observed_validas?: number;
  operational_adjustment_gain?: number;
  operational_adjustment_loss?: number;
  operational_adjustment_delta?: number;
  missing_total: number;
  sex_missing_total?: number;
  age_missing_total?: number;
  demographic_missing_total?: number;
  last_response_date_iso?: string;
  last_response_date_label?: string;
  has_field_activity?: boolean;
  activity_status?: "today" | "previous" | "none" | string;
  sex: TerritorialQuotaProgressItem[];
  age: TerritorialQuotaProgressItem[];
  cross: TerritorialQuotaProgressItem[];
  observed_cross?: TerritorialQuotaObservedCross | null;
  missing: TerritorialQuotaProgressItem[];
};

export type TerritorialQuotaProgressDistrict = {
  ubigeo?: string;
  distrito?: string;
  configured: boolean;
  status: "complete" | "in_field" | "pending" | "partial" | "missing" | "exceeded" | "not_configured" | string;
  target: number;
  validas: number;
  missing_total: number;
  sex_missing_total?: number;
  age_missing_total?: number;
  demographic_missing_total?: number;
  last_response_date_iso?: string;
  last_response_date_label?: string;
  has_field_activity?: boolean;
  activity_status?: "today" | "previous" | "none" | string;
  ump_complete?: number;
  ump_in_field?: number;
  ump_pending?: number;
  ump_missing?: number;
  ump_exceeded?: number;
  ump_not_configured?: number;
  sex: TerritorialQuotaProgressItem[];
  age: TerritorialQuotaProgressItem[];
  missing: TerritorialQuotaProgressItem[];
  source?: string;
};

export type TerritorialQuotaProgressPayload = {
  schema: "monitoreo_territorial_quota_progress_v1" | string;
  configured: boolean;
  reason?: string;
  variables?: {
    age_var?: string;
    sex_var?: string;
    age_available?: boolean;
    sex_available?: boolean;
  };
  summary?: {
    total: number;
    complete: number;
    in_field?: number;
    pending?: number;
    partial: number;
    missing: number;
    exceeded: number;
    not_configured: number;
    sex_missing_total?: number;
    age_missing_total?: number;
    demographic_missing_total?: number;
    districts_with_gap?: number;
  };
  ump_summary?: {
    total: number;
    complete: number;
    subsanada?: number;
    in_field?: number;
    pending?: number;
    partial?: number;
    missing: number;
    exceeded: number;
    not_configured: number;
    sex_missing_total?: number;
    age_missing_total?: number;
    demographic_missing_total?: number;
  };
  ump_groups?: Array<{
    ump: string;
    status: string;
    selected_id_manzana?: string;
    selected_tipo_manzana?: string;
    selected_replacement_order?: string | number | null;
    block_count?: number;
    replacement_count?: number;
    target?: number;
    validas?: number;
    missing_total?: number;
    sex_missing_total?: number;
    age_missing_total?: number;
    demographic_missing_total?: number;
  }>;
  blocks: TerritorialQuotaProgressBlock[];
  districts?: TerritorialQuotaProgressDistrict[];
  district_summary?: {
    total: number;
    complete: number;
    in_field?: number;
    pending?: number;
    partial: number;
    missing: number;
    exceeded: number;
    not_configured: number;
    sex_missing_total?: number;
    age_missing_total?: number;
    demographic_missing_total?: number;
    districts_with_gap?: number;
  };
  alerts?: Array<{ level?: string; code?: string; id_manzana?: string; message?: string }>;
};

export type MonitoreoTerritorialDashboard = {
  schema: string;
  report_scope?: "source" | "route_summary" | "advance_summary" | "validation_summary" | "queries_summary" | "phone_summary" | "full" | string;
  generated_at: string;
  active_route_phase: "pilot" | "field" | string;
  phase_note: string;
  phase_source_status?: "configured" | "missing_source" | string;
  phase_source_message?: string;
  phase_coherence?: MonitoreoTerritorialPhaseCoherence | null;
  kpis: {
    total_respuestas: number;
    consentidas: number;
    validas: number;
    revision: number;
    no_defendibles: number;
    meta: number | null;
    avance_pct: number | null;
    gps_crossable: number;
    geo_ok: number;
    geo_cerca: number;
    geo_revision: number;
    geo_no_defendible: number;
    geo_sin_cruce: number;
    geo_sin_gps?: number;
    duration_median: number | null;
    duration_p95: number | null;
  };
  advance?: {
    total_respuestas: number;
    validas: number;
    observacion: number;
    observacion_aprobada: number;
    no_validas: number;
    meta: number | null;
    avance_pct: number | null;
    brecha: number | null;
    district_progress: TerritorialDistrictProgress[];
    block_progress: TerritorialBlockProgress[];
    daily: Array<{ date: string; date_label?: string; total: number; validas: number; revision: number }>;
  };
  source_coherence: {
    asset_uid: string;
    asset_name: string;
    version_id: string;
    date_modified?: string;
    deployment_active: boolean | null;
    survey_count?: number;
    choices_count?: number;
    district_field: string;
    district_list_name: string;
    district_choices: Array<{ name: string; label: string }>;
    survey_fields?: Array<{ name: string; xpath: string; type: string; list_name: string; label: string }>;
    choices_by_list?: Record<string, Array<{ name: string; label: string }>>;
    detected_fields: Record<string, { name: string; present: boolean }>;
    drift: Array<{ severity: string; code: string; message: string }>;
  };
  source_validity: {
    field: string;
    field_resolved?: string;
    field_label?: string;
    values: string[];
    effective_count: number | null;
    non_effective_count: number | null;
    missing_count: number | null;
    total_responses: number;
    options: Array<{ value: string; label: string; count?: number }>;
  };
  route_sheet?: MonitoreoTerritorialRouteSheet | null;
  ump_declared_summary?: TerritorialDeclaredUmpSummary;
  enumerator_code_summary?: {
    field: string;
    field_resolved?: string;
    ump_field?: string;
    ump_field_resolved?: string;
    configured: boolean;
    roster_total: number;
    response_with_code_count?: number;
    response_code_count: number;
    recognized_code_count: number;
    auto_recognized_code_count?: number;
    reconciled_code_count?: number;
    unrecognized_code_count: number;
    recognized_response_count: number;
    auto_recognized_response_count?: number;
    reconciled_response_count?: number;
    unrecognized_response_count: number;
    missing_response_count: number;
    top_unrecognized?: Array<{ code: string; raw_code?: string; normalized_code?: string; count: number }>;
    unrecognized_codes?: Array<{ code: string; raw_code?: string; normalized_code?: string; count: number }>;
    unrecognized_responses?: MonitoreoTerritorialEnumeratorReconciliationResponse[];
    reconciliation_responses?: MonitoreoTerritorialEnumeratorReconciliationResponse[];
    assigned_summary?: Array<{
      code: string;
      name: string;
      response_count: number;
      auto_response_count?: number;
      reconciled_response_count?: number;
      appears_in_base?: boolean;
      last_record?: string;
      status?: string;
    }>;
    reconciliation_entries?: MonitoreoTerritorialCodeReconciliation[];
    response_examples?: string[];
    roster_examples?: string[];
  };
  route_overview?: {
    phase: string;
    route_count: number;
    operational_block_count: number;
    replacement_count: number;
    replacement_per_route: number | null;
    district_count: number;
    blocks_by_district: Array<{ distrito: string; blocks: number }>;
    responsible_count: number;
    total_entrevistas: number | null;
    total_replacement_interviews: number | null;
  };
  responsible_summary?: {
    field: string;
    field_label?: string;
    configured: boolean;
    distinct_count: number;
    total_with_value: number;
    top: Array<{ value: string; label: string; count: number }>;
  };
  route_blocks?: TerritorialBlockProgress[];
  selected_block_context?: { default_block_id?: string };
  route_population?: {
    cells: Record<string, string | number | null>[];
    table: Record<string, string | number | null>[];
    total_poblacion?: number | null;
    n_cells?: number;
    alerts?: Array<Record<string, unknown>>;
  };
  route_quota?: {
    cells: Record<string, string | number | null>[];
    table: Record<string, string | number | null>[];
    total_poblacion?: number | null;
    n_cells?: number;
    alerts?: Array<Record<string, unknown>>;
  };
  route_quota_progress?: TerritorialQuotaProgressPayload;
  spatial_reconciliation?: MonitoreoTerritorialSpatialReconciliationSummary;
  operational_adjustments?: MonitoreoTerritorialOperationalAdjustmentsPayload;
  production_annulments?: MonitoreoTerritorialProductionAnnulmentsPayload;
  route_quota_marginals?: {
    blocks: Array<{
      id_manzana?: string;
      ubigeo?: string;
      distrito?: string;
      zona?: string;
      manzana?: string;
      territorio?: string;
      tipo_manzana?: string;
      ump?: string | number | null;
      rango?: string;
      rango_inicio?: number | null;
      rango_fin?: number | null;
      total: number;
      age_totals: Array<{ label: string; value: number; order?: number }>;
      sex_totals: Array<{ label: string; value: number; order?: number }>;
      source?: string;
    }>;
    n_blocks?: number;
    alerts?: Array<Record<string, unknown>>;
  };
  district_progress: TerritorialDistrictProgress[];
  block_progress: TerritorialBlockProgress[];
  operational_preview?: TerritorialResponseAuditRow[];
  response_audit: TerritorialResponseAuditRow[];
  team: Array<{ submitted_by: string; raw_submitted_by?: string; total: number; validas: number; revision: number; no_defendibles: number; duration_median: number | null; duration_p95?: number | null; duration_normal?: number; duration_short?: number; duration_very_short?: number; duration_review?: number; last_record?: string }>;
  daily: Array<{ date: string; date_label?: string; total: number; validas: number; revision: number }>;
  map_cache?: MonitoreoTerritorialMapPhaseCacheMeta | MonitoreoTerritorialMapCacheMeta | null;
  map: TerritorialMapPayload;
  internal_queries: {
    incomplete_blocks: TerritorialBlockProgress[];
    exceeded_blocks?: TerritorialBlockProgress[];
    far_gps: TerritorialMapPayload["points"];
    duration_review?: TerritorialMapPayload["points"];
    lagging_districts: TerritorialDistrictProgress[];
    review_cases?: TerritorialInternalReviewCase[];
    route_sheet_assigned_no_response?: MonitoreoTerritorialRouteSheetAssignment[];
    route_sheet_wrong_ump_candidates?: MonitoreoRow[];
    route_sheet_wrong_code_candidates?: MonitoreoRow[];
    route_sheet_unmatched_rows?: MonitoreoTerritorialRouteSheetAssignment[];
    route_sheet_orphan_responses?: MonitoreoRow[];
  };
  field_occurrences?: MonitoreoFieldOccurrenceDashboard | null;
};

export type MonitoreoDashboard = {
  ok: boolean;
  kpis: MonitoreoKpis;
  progress: MonitoreoRow[];
  production: MonitoreoRow[];
  inconsistencies: MonitoreoRow[];
  acreditacion_reports?: MonitoreoAcreditacionReports | null;
  territorial_reports?: MonitoreoTerritorialDashboard | null;
  aulas_universitarias_reports?: MonitoreoAulasDashboard | null;
};

export type MonitoreoState = {
  ok: true;
  sources: MonitoreoSource[];
  config: MonitoreoConfig;
  monitoreo_profile?: MonitoreoProfile;
  has_snapshot: boolean;
  synced_at: string;
  generated_at?: string;
  generation_version?: string;
  generation_status?: "complete" | "partial" | "stale" | "failed" | string;
  source_metadata?: MonitoreoSourceMetadata | null;
  reports?: Record<string, unknown> | null;
  chart_models?: MonitoreoChartModels | null;
  sync_errors?: { source_id?: string; source_label?: string; message: string }[];
  pending_regeneration?: boolean;
  n_rows: number;
  variables: MonitoreoVariable[];
  dashboard: MonitoreoDashboard | null;
  territorial_phase_coherence?: MonitoreoTerritorialPhaseCoherence | null;
  territorial_map_cache?: MonitoreoTerritorialMapCacheMeta | null;
  territorial_report_cache?: MonitoreoTerritorialReportCacheMeta | null;
  monitoreo_perf?: MonitoreoPerformanceMeta | null;
  territorial_update_history?: MonitoreoTerritorialUpdateHistoryEntry[];
  publication?: {
    client_last_sheets?: MonitoreoLastSheetsPublication | null;
    internal_last_sheets?: MonitoreoLastSheetsPublication | null;
  };
  acreditacion: MonitoreoAcreditacion;
  aulas_universitarias?: MonitoreoAulasConfig;
  errors: { source_id?: string; source_label?: string; message: string }[];
};

export type MonitoreoSyncResult = {
  ok: true;
  synced_at: string;
  n_rows: number;
  n_sources: number;
  sync_mode?: "full" | "advance" | string;
  report_scope?: string;
  dashboard: MonitoreoDashboard;
  sync_summary?: Record<string, unknown>;
  errors: { source_id?: string; source_label?: string; message: string }[];
};

export type MonitoreoSourcePayload = {
  id?: string;
  kind: MonitoreoSourceKind;
  label?: string;
  enabled?: boolean;
  role?: MonitoreoSourceRole;
  integration_mode?: MonitoreoIntegrationMode;
  sheet_binding?: Partial<MonitoreoSheetBinding>;
  asset_uid?: string;
  survey_id?: string;
  survey_title?: string;
  base_url?: string;
  connection_profile_id?: string;
  declared_person_code_var?: string;
  declared_person_code_label?: string;
  dimensions?: Record<string, string>;
};

export type MonitoreoSheetsStatus = {
  ok: true;
  provider: "google_sheets";
  label: string;
  has_token: boolean;
  masked_token: string;
  persisted: boolean;
  ephemeral: boolean;
};

export type MonitoreoSheetsConnectResult =
  | MonitoreoSheetsStatus
  | {
      ok: true;
      provider: "google_sheets";
      authorization_required: true;
      auth_url: string;
      redirect_uri: string;
      scopes: string[];
      status: MonitoreoSheetsStatus;
    };

export type MonitoreoSheetsInspectResult = {
  ok: true;
  spreadsheet_id: string;
  title: string;
  sheets: Array<{ sheet_id: number; title: string; row_count: number; column_count: number }>;
  headers: string[];
};

export type MonitoreoSheetsListResult = {
  ok: true;
  spreadsheets: Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>;
};

export type MonitoreoSheetsSyncResult = {
  ok: true;
  synced_at: string;
  n_rows: number;
  n_sources: number;
  state: MonitoreoState;
};

export type MonitoreoSheetsPublishResult = {
  ok: true;
  spreadsheet_id: string;
  spreadsheet_url?: string;
  controlled_tabs: string[];
  updated_at: string;
  mode: "controlled_write";
  audience?: "client" | "internal" | string;
  preflight?: MonitoreoDeliverablesPreflight;
};

export type MonitoreoDeliverablesIssue = {
  code: string;
  severity?: "blocking" | "warning" | string;
  message: string;
  evidence?: unknown;
};

export type MonitoreoDeliverablesPreflight = {
  schema: "monitoreo_deliverables_preflight_v1" | string;
  generated_at: string;
  family: "acreditacion" | "territorial" | "aulas_universitarias" | "telefonico" | string;
  audience: "client" | "internal" | string;
  project: string;
  cut: string;
  source: string;
  status: "ready" | "warnings" | "blocked" | string;
  score: number;
  blocking_issues: MonitoreoDeliverablesIssue[];
  warnings: MonitoreoDeliverablesIssue[];
  checks?: Record<string, boolean | string | number | null>;
  evidence?: unknown;
  scorecard?: {
    status: "ready" | "warnings" | "blocked" | string;
    score: number;
    blocking_count: number;
    warning_count: number;
  };
};

export type MonitoreoPublicationPreflightResult = {
  ok: true;
  audience: "client" | "internal" | string;
  family: string;
  report_scope?: string;
  tabs: string[];
  preflight: MonitoreoDeliverablesPreflight;
};

export type MonitoreoPublicationEvidencePackResult = MonitoreoPublicationPreflightResult & {
  evidence_pack: {
    schema: "monitoreo_deliverables_evidence_pack_result_v1" | string;
    out_dir?: string;
    report_json?: string;
    report_md?: string;
    manifest?: string;
    cut_snapshot?: string;
    operational_package_status?: string;
    operational_package_request?: string;
    operational_package_request_csv?: string;
    publication_decision?: string;
    format_validation?: string;
    data_validation?: string;
    reference_validation?: string;
    performance?: string;
    artifacts?: Record<string, unknown>;
  };
  files?: {
    operational_package_request_csv?: MonitoreoTerritorialOperationalPackageFile;
    operational_package_request?: MonitoreoTerritorialOperationalPackageFile;
    operational_package_status?: MonitoreoTerritorialOperationalPackageFile;
    publication_decision?: MonitoreoTerritorialOperationalPackageFile;
  };
  zip?: {
    file_id: string;
    filename: string;
    size?: number;
  };
  file_id: string;
  filename: string;
  size?: number;
  download_url?: string;
};

export type MonitoreoAcreditacionSeguimientoPayload = {
  id: string;
  n_efectivo?: number;
  notas_campo?: string;
  intentos_canal?: Partial<MonitoreoAcreditacionIntentos>;
  tasa_contacto_efectiva?: number | null;
  sub_cuotas_progreso?: Record<string, MonitoreoAcreditacionSubcuota>;
  bolsa_operativa?: MonitoreoAcreditacionBolsa[];
};

type MonitoreoStateRequestOptions = {
  includeReports?: boolean;
  reportScope?: string;
  warmupCache?: boolean;
  force?: boolean;
};

type WarmMonitoreoStateCacheItem = {
  promise?: Promise<MonitoreoState>;
  value?: MonitoreoState;
  expiresAt: number;
  usesRemaining: number;
};

const MONITOREO_STATE_WARM_CACHE_MS = 30000;
const monitoreoStateWarmCache = new Map<string, WarmMonitoreoStateCacheItem>();

type MonitoreoTerritorialMapResponse = {
  ok: true;
  layer?: "route_geometry" | "gps_points" | "full" | string;
  not_modified?: boolean;
  cache?: MonitoreoTerritorialMapCacheLayerMeta | MonitoreoTerritorialMapPhaseCacheMeta;
  payload: TerritorialMapPayload & {
    features?: unknown[];
    bounds?: Record<string, number | string | null>;
    ump_index?: Array<Record<string, unknown>>;
  };
};

const monitoreoTerritorialMapInflight = new Map<string, Promise<MonitoreoTerritorialMapResponse>>();

function monitoreoStateWarmCacheKey(options: MonitoreoStateRequestOptions) {
  return [
    getSession() ?? "",
    options.includeReports == null ? "auto" : options.includeReports ? "reports" : "light",
    options.reportScope ?? "",
  ].join("|");
}

export function invalidateMonitoreoStateWarmCache() {
  monitoreoStateWarmCache.clear();
  monitoreoTerritorialMapInflight.clear();
}

function clearMonitoreoStateWarmCache() {
  invalidateMonitoreoStateWarmCache();
}

if (typeof window !== "undefined") {
  window.addEventListener("pulso:session-changed", clearMonitoreoStateWarmCache);
  window.addEventListener("pulso:session-lost", clearMonitoreoStateWarmCache);
}

export async function apiMonitoreoState(options: MonitoreoStateRequestOptions = {}) {
  const params = new URLSearchParams();
  if (options.includeReports != null) params.set("include_reports", options.includeReports ? "1" : "0");
  if (options.reportScope) params.set("report_scope", options.reportScope);
  const query = params.toString();
  const path = query ? `/api/monitoreo/state?${query}` : "/api/monitoreo/state";
  const cacheKey = monitoreoStateWarmCacheKey(options);
  if (options.force) {
    monitoreoStateWarmCache.clear();
  }
  const cached = monitoreoStateWarmCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.value) {
      if (!options.warmupCache) {
        cached.usesRemaining -= 1;
        if (cached.usesRemaining <= 0) monitoreoStateWarmCache.delete(cacheKey);
      }
      return cached.value;
    }
    if (cached.promise) return cached.promise;
  } else if (cached) {
    monitoreoStateWarmCache.delete(cacheKey);
  }

  const promise = apiFetch(path, { headers: headers() })
    .then((res) => handle<MonitoreoState>(res))
    .then((value) => {
      if (options.warmupCache) {
        monitoreoStateWarmCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + MONITOREO_STATE_WARM_CACHE_MS,
          usesRemaining: 2,
        });
      } else {
        const current = monitoreoStateWarmCache.get(cacheKey);
        if (current?.promise === promise) monitoreoStateWarmCache.delete(cacheKey);
      }
      return value;
    }, (error) => {
    const current = monitoreoStateWarmCache.get(cacheKey);
    if (current?.promise === promise) monitoreoStateWarmCache.delete(cacheKey);
    throw error;
  });

  if (options.warmupCache) {
    monitoreoStateWarmCache.set(cacheKey, {
      promise,
      expiresAt: Date.now() + MONITOREO_STATE_WARM_CACHE_MS,
      usesRemaining: 2,
    });
  }
  return promise;
}

export async function apiPublicArtifact() {
  return handle<PublicArtifactDescriptor>(
    await apiFetch("/api/public/artifact", { headers: headers() }),
  );
}

export async function apiMonitoreoPublicReport() {
  return handle<MonitoreoPublicReportPayload>(
    await apiFetch("/api/monitoreo/public-report", { headers: headers() }),
  );
}

type MonitoreoPublicationRequestOptions = {
  audience?: "client" | "internal";
  includeTargets?: boolean;
  confirmedFullData?: boolean;
  config?: Partial<MonitoreoConfig>;
  referenceDriftFileId?: string;
  operationalPackageReview?: MonitoreoTerritorialOperationalPackageReview | MonitoreoTerritorialOperationalPackageReviewResult | Record<string, unknown>;
};

function monitoreoPublicationRequestBody(spreadsheetId: string, options: MonitoreoPublicationRequestOptions = {}) {
  return {
    spreadsheet_id: spreadsheetId,
    audience: options.audience ?? "client",
    include_targets: !!options.includeTargets,
    ...(options.confirmedFullData != null ? { confirmed_full_data: !!options.confirmedFullData } : {}),
    ...(options.config ? { config: options.config } : {}),
    ...(options.referenceDriftFileId ? { reference_drift_file_id: options.referenceDriftFileId } : {}),
    ...(options.operationalPackageReview ? { operational_package_review: options.operationalPackageReview } : {}),
  };
}

export async function apiMonitoreoPublicationSheetsPublish(
  spreadsheetId = "",
  options: MonitoreoPublicationRequestOptions = {},
) {
  return handle<MonitoreoSheetsPublishResult>(
    await apiFetch("/api/monitoreo/publication/sheets", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(monitoreoPublicationRequestBody(spreadsheetId, options)),
    }),
  );
}

export async function apiMonitoreoPublicationPreflight(
  spreadsheetId = "",
  options: MonitoreoPublicationRequestOptions = {},
) {
  return handle<MonitoreoPublicationPreflightResult>(
    await apiFetch("/api/monitoreo/publication/preflight", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(monitoreoPublicationRequestBody(spreadsheetId, options)),
    }),
  );
}

export async function apiMonitoreoPublicationEvidencePack(
  spreadsheetId = "",
  options: MonitoreoPublicationRequestOptions = {},
) {
  const result = await handle<MonitoreoPublicationEvidencePackResult>(
    await apiFetch("/api/monitoreo/publication/evidence-pack", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(monitoreoPublicationRequestBody(spreadsheetId, options)),
    }),
  );
  const withUrl = (file?: MonitoreoTerritorialOperationalPackageFile) =>
    file?.file_id ? { ...file, download_url: downloadUrl(file.file_id) } : file;
  return {
    ...result,
    ...(result.file_id ? { download_url: downloadUrl(result.file_id) } : {}),
    ...(result.files ? {
      files: {
        ...result.files,
        operational_package_request_csv: withUrl(result.files.operational_package_request_csv),
        operational_package_request: withUrl(result.files.operational_package_request),
        operational_package_status: withUrl(result.files.operational_package_status),
        publication_decision: withUrl(result.files.publication_decision),
      },
    } : {}),
  };
}

export async function apiMonitoreoTerritorialPrewarm(options: { phase?: string; scopes?: string[] } = {}) {
  return handle<JobStart>(
    await apiFetch("/api/monitoreo/territorial/prewarm", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(options),
    }),
  );
}

export async function apiMonitoreoSheetsStatus() {
  return handle<MonitoreoSheetsStatus>(
    await apiFetch("/api/monitoreo/sheets/status", { headers: headers() }),
  );
}

export async function apiMonitoreoSheetsList(limit = 50) {
  return handle<MonitoreoSheetsListResult>(
    await apiFetch("/api/monitoreo/sheets/list", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ limit }),
    }),
  );
}

export async function apiMonitoreoSheetsInspect(binding: Partial<MonitoreoSheetBinding>) {
  return handle<MonitoreoSheetsInspectResult>(
    await apiFetch("/api/monitoreo/sheets/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sheet_binding: binding }),
    }),
  );
}

export async function apiMonitoreoSheetsSource(payload: MonitoreoSourcePayload) {
  return handle<{ ok: true; source: MonitoreoSource; validation: unknown; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/sheets/source", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoSheetsSync(sourceIds: string[] = []) {
  return handle<MonitoreoSheetsSyncResult>(
    await apiFetch("/api/monitoreo/sheets/sync", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ source_ids: sourceIds }),
    }),
  );
}

export async function apiMonitoreoSheetsPublish(spreadsheetId: string, config?: Partial<MonitoreoConfig>) {
  return handle<MonitoreoSheetsPublishResult>(
    await apiFetch("/api/monitoreo/sheets/publish", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ spreadsheet_id: spreadsheetId, ...(config ? { config } : {}) }),
    }),
  );
}

export async function apiMonitoreoClientReportSheetsPublish(
  spreadsheetId: string,
  options: { includeTargets?: boolean; config?: Partial<MonitoreoConfig> } = {},
) {
  return handle<MonitoreoSheetsPublishResult>(
    await apiFetch("/api/monitoreo/client-report/sheets/publish", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        spreadsheet_id: spreadsheetId,
        include_targets: !!options.includeTargets,
        ...(options.config ? { config: options.config } : {}),
      }),
    }),
  );
}

export async function apiMonitoreoClientReportPdf(
  options: { includeTargets?: boolean; config?: Partial<MonitoreoConfig> } = {},
) {
  return handle<JobStart>(
    await apiFetch("/api/monitoreo/client-report/pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        include_targets: !!options.includeTargets,
        ...(options.config ? { config: options.config } : {}),
      }),
    }),
  );
}

export function monitoreoClientReportPdfDownloadUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/monitoreo/client-report/pdf/download${qs ? `?${qs}` : ""}`);
}

export async function apiMonitoreoProductionReportPdf(
  options: { includeTargets?: boolean; config?: Partial<MonitoreoConfig>; title?: string } = {},
) {
  return handle<JobStart>(
    await apiFetch("/api/monitoreo/production-report/pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        include_targets: !!options.includeTargets,
        ...(options.title ? { title: options.title } : {}),
        ...(options.config ? { config: options.config } : {}),
      }),
    }),
  );
}

export function monitoreoProductionReportPdfDownloadUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/monitoreo/production-report/pdf/download${qs ? `?${qs}` : ""}`);
}

export async function apiMonitoreoDemo(options: { seed?: number; n?: number } = {}) {
  return handle<{ ok: true; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/demo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(options),
    }),
  );
}

export async function apiMonitoreoKoboAssets(
  base_url = "https://kf.kobotoolbox.org",
  limit = 100,
  options: { profile_id?: string; connection_profile_id?: string } = {},
) {
  const raw = await handle<unknown>(
    await apiFetch("/api/monitoreo/kobo/assets", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        base_url,
        limit,
        profile_id: options.profile_id ?? options.connection_profile_id ?? "",
      }),
    }),
  );
  return normalizeKoboAssets(raw);
}

export async function apiMonitoreoKoboSurveyLink(payload: {
  asset_uid: string;
  base_url?: string;
  profile_id?: string;
  connection_profile_id?: string;
}): Promise<MonitoreoKoboSurveyLink> {
  const raw = await handle<unknown>(
    await apiFetch("/api/monitoreo/kobo/survey-link", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        asset_uid: payload.asset_uid,
        base_url: payload.base_url ?? "",
        profile_id: payload.profile_id ?? payload.connection_profile_id ?? "",
      }),
    }),
  );
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    asset_uid: String(r.asset_uid ?? payload.asset_uid ?? ""),
    name: String(r.name ?? ""),
    base_url: String(r.base_url ?? payload.base_url ?? ""),
    survey_url: String(r.survey_url ?? ""),
    landing_url: String(r.landing_url ?? ""),
    version_id: String(r.version_id ?? ""),
    deployment_active: r.deployment_active === true,
    resolved_from: String(r.resolved_from ?? ""),
  };
}

export type MonitoreoTerritorialKoboInspection = {
  ok: true;
  schema: {
    asset_uid: string;
    name: string;
    version_id: string;
    date_modified: string;
    deployment_active: boolean;
    survey_count: number;
    choices_count: number;
    district_field: string;
    district_list_name: string;
    district_choices: Array<{ name: string; label: string }>;
    survey_fields?: Array<{ name: string; xpath: string; type: string; list_name: string; label: string }>;
    choices_by_list?: Record<string, Array<{ name: string; label: string }>>;
    district_crosswalk: Array<{ kobo_code: string; kobo_label: string; ubigeo: string; distrito: string; present_in_kobo: boolean }>;
    assertions: { district_field: boolean; has_sjm: boolean; has_vmt: boolean; kobo_is_canonical: boolean };
    inspected_at: string;
    base_url: string;
  };
  config: MonitoreoConfig;
  state: MonitoreoState;
};

export async function apiMonitoreoTerritorialInspectKobo(payload: {
  source_id?: string;
  asset_uid?: string;
  base_url?: string;
  connection_profile_id?: string;
  phase?: MonitoreoTerritorialPhase;
  config?: Partial<MonitoreoConfig>;
} = {}) {
  return handle<MonitoreoTerritorialKoboInspection>(
    await apiFetch("/api/monitoreo/territorial/inspect-kobo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialConfig(territorial: Partial<MonitoreoTerritorialConfig>) {
  return handle<{ ok: true; config: MonitoreoConfig; state: MonitoreoState; saved_project?: boolean }>(
    await apiFetch("/api/monitoreo/territorial/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ territorial }),
    }),
  );
}

export async function apiMonitoreoTerritorialEnumeratorCodeReconciliation(entry: MonitoreoTerritorialCodeReconciliation) {
  return handle<{
    ok: true;
    reconciliation: MonitoreoTerritorialCodeReconciliation;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/enumerators/reconcile-code", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(entry),
    }),
  );
}

export async function apiMonitoreoTerritorialUmpReconciliation(entry: MonitoreoTerritorialUmpReconciliation) {
  return handle<{
    ok: true;
    reconciliation: MonitoreoTerritorialUmpReconciliation;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/umps/reconcile", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(entry),
    }),
  );
}

export async function apiMonitoreoTerritorialReconciliationBatch(changes: MonitoreoTerritorialReconciliationBatchChange[]) {
  return handle<{
    ok: true;
    applied: MonitoreoTerritorialReconciliationBatchApplied[];
    failed: MonitoreoTerritorialReconciliationBatchFailure[];
    config: MonitoreoConfig;
    state?: MonitoreoState | null;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/reconciliation/batch", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ changes }),
    }),
  );
}

export async function apiMonitoreoTerritorialSpatialReconciliationDismiss(payload: {
  candidate_id: string;
  phase?: MonitoreoTerritorialPhase;
  reason?: string;
  evidence_hash?: string;
}) {
  return handle<{
    ok: true;
    dismissal: MonitoreoTerritorialSpatialReconciliationDismissal;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/spatial-reconciliation/dismiss", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialSpatialReconciliationDismissPattern(payload: {
  pattern_key: string;
  phase?: MonitoreoTerritorialPhase;
  reason?: string;
  evidence_hash?: string;
}) {
  return handle<{
    ok: true;
    dismissal: MonitoreoTerritorialSpatialReconciliationDismissal;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/spatial-reconciliation/dismiss-pattern", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

function withOperationalPackageDownloadUrls(
  result: MonitoreoTerritorialOperationalPackageReviewResult,
): MonitoreoTerritorialOperationalPackageReviewResult {
  if (!result.files) return result;
  const withUrl = (file?: MonitoreoTerritorialOperationalPackageFile) =>
    file?.file_id ? { ...file, download_url: downloadUrl(file.file_id) } : file;
  return {
    ...result,
    files: {
      ...result.files,
      template: withUrl(result.files.template),
      review_csv: withUrl(result.files.review_csv),
      report_json: withUrl(result.files.report_json),
      report_md: withUrl(result.files.report_md),
    },
  };
}

export async function apiMonitoreoTerritorialOperationalPackageReview(payload: {
  packageRows?: Array<Record<string, unknown>>;
  packageFileId?: string;
  drift?: Record<string, unknown>;
  driftRows?: Array<Record<string, unknown>>;
  driftFileId?: string;
  requiredOperationalPackage?: Record<string, unknown>;
  requiredTachas?: number;
  expectedUmps?: Array<Record<string, unknown>>;
  metrics?: Array<Record<string, unknown>>;
  source?: string;
  cut?: string;
  project?: string;
  config?: Partial<MonitoreoConfig>;
} = {}) {
  const result = await handle<MonitoreoTerritorialOperationalPackageReviewResult>(
    await apiFetch("/api/monitoreo/territorial/operational-package/review", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(payload.packageRows ? { package_rows: payload.packageRows } : {}),
        ...(payload.packageFileId ? { package_file_id: payload.packageFileId } : {}),
        ...(payload.drift ? { drift: payload.drift } : {}),
        ...(payload.driftRows ? { drift_rows: payload.driftRows } : {}),
        ...(payload.driftFileId ? { drift_file_id: payload.driftFileId } : {}),
        ...(payload.requiredOperationalPackage ? { required_operational_package: payload.requiredOperationalPackage } : {}),
        ...(payload.requiredTachas !== undefined ? { required_tachas: payload.requiredTachas } : {}),
        ...(payload.expectedUmps ? { expected_umps: payload.expectedUmps } : {}),
        ...(payload.metrics ? { metrics: payload.metrics } : {}),
        ...(payload.source ? { source: payload.source } : {}),
        ...(payload.cut ? { cut: payload.cut } : {}),
        ...(payload.project ? { project: payload.project } : {}),
        ...(payload.config ? { config: payload.config } : {}),
      }),
    }),
  );
  return withOperationalPackageDownloadUrls(result);
}

export async function apiMonitoreoTerritorialOperationalAdjustmentApply(
  adjustment: MonitoreoTerritorialOperationalAdjustment,
) {
  return handle<{
    ok: true;
    adjustment: MonitoreoTerritorialOperationalAdjustment;
    adjustments?: MonitoreoTerritorialOperationalAdjustment[];
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/operational-adjustments/apply", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ adjustment }),
    }),
  );
}

export async function apiMonitoreoTerritorialOperationalAdjustmentReset(payload: {
  phase?: MonitoreoTerritorialPhase | string;
  reason?: string;
} = {}) {
  return handle<{
    ok: true;
    phase: MonitoreoTerritorialPhase | string;
    active_before: number;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/operational-adjustments/reset", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialOperationalAdjustmentRevert(payload: {
  id: string;
  phase?: MonitoreoTerritorialPhase;
  reason?: string;
}) {
  return handle<{
    ok: true;
    adjustment_id: string;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/operational-adjustments/revert", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialProductionAnnulmentPreview(payload: {
  phase?: MonitoreoTerritorialPhase;
  scope?: "all_production" | "response" | string;
  responsible_key?: string;
  responsible_label?: string;
  response_id?: string;
  response_label?: string;
  reason?: string;
  note?: string;
}) {
  return handle<{
    ok: true;
    annulment_id: string;
    impact: MonitoreoTerritorialProductionAnnulmentImpact;
    production_annulments?: MonitoreoTerritorialProductionAnnulmentsPayload;
  }>(
    await apiFetch("/api/monitoreo/territorial/annulments/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialProductionAnnulmentApply(payload: {
  phase?: MonitoreoTerritorialPhase;
  scope?: "all_production" | "response" | string;
  responsible_key?: string;
  responsible_label?: string;
  response_id?: string;
  response_label?: string;
  reason: string;
  note?: string;
}) {
  return handle<{
    ok: true;
    annulment_id: string;
    annulment?: MonitoreoTerritorialProductionAnnulment;
    impact: MonitoreoTerritorialProductionAnnulmentImpact;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/annulments/apply", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialProductionAnnulmentRevert(payload: {
  id: string;
  phase?: MonitoreoTerritorialPhase;
  reason?: string;
}) {
  return handle<{
    ok: true;
    annulment_id: string;
    impact?: MonitoreoTerritorialProductionAnnulmentImpact | Record<string, unknown>;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/annulments/revert", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialPhase(activeRoutePhase: MonitoreoTerritorialPhase) {
  return handle<{
    ok: true;
    config: MonitoreoConfig;
    active_route_phase: MonitoreoTerritorialPhase;
    phase_source_status: "configured" | "missing_source" | string;
    message: string;
  }>(
    await apiFetch("/api/monitoreo/territorial/phase", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ active_route_phase: activeRoutePhase }),
    }),
  );
}

export async function apiMonitoreoTerritorialSource(payload: {
  phase: MonitoreoTerritorialPhase;
  asset_uid: string;
  name?: string;
  version_id?: string;
  base_url?: string;
  connection_profile_id?: string;
  source_id?: string;
}) {
  return handle<{
    ok: true;
    source: MonitoreoSource;
    config: MonitoreoConfig;
    state: MonitoreoState;
    active_route_phase: MonitoreoTerritorialPhase;
    phase_source_status: "configured" | "missing_source" | string;
    message: string;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/territorial/source", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialEnumeratorsUpload(
  file: File,
  options: { code_var?: string; ump_var?: string; code_format?: string } = {},
) {
  const fd = new FormData();
  fd.append("file", file);
  if (options.code_var) fd.append("code_var", options.code_var);
  if (options.ump_var) fd.append("ump_var", options.ump_var);
  if (options.code_format) fd.append("code_format", options.code_format);
  return handle<{
    ok: true;
    enumerator_roster: MonitoreoTerritorialEnumeratorRoster;
    config: MonitoreoConfig;
    state: MonitoreoState;
  }>(
    await apiFetch("/api/monitoreo/territorial/enumerators/upload", {
      method: "POST",
      headers: headers(),
      body: fd,
    }),
  );
}

export async function apiMonitoreoTerritorialEnumeratorsTemplate() {
  const result = await handle<{
    ok: true;
    file_id: string;
    filename: string;
    size: number;
    rows: number;
  }>(
    await apiFetch("/api/monitoreo/territorial/enumerators/template", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
  return { ...result, download_url: downloadUrl(result.file_id) };
}

export async function apiMonitoreoTerritorialEnumeratorsCodes() {
  const result = await handle<{
    ok: true;
    file_id: string;
    filename: string;
    size: number;
    rows: number;
  }>(
    await apiFetch("/api/monitoreo/territorial/enumerators/codes", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
  return { ...result, download_url: downloadUrl(result.file_id) };
}

export async function apiMonitoreoTerritorialMap(options: {
  phase?: "pilot" | "field";
  ubigeo?: string;
  layer?: "route_geometry" | "gps_points" | "full";
  hash?: string;
  allowStale?: boolean;
  prepare?: boolean;
} = {}) {
  const params = new URLSearchParams();
  if (options.phase) params.set("phase", options.phase);
  if (options.ubigeo) params.set("ubigeo", options.ubigeo);
  if (options.layer) params.set("layer", options.layer);
  if (options.hash) params.set("hash", options.hash);
  if (typeof options.allowStale === "boolean") params.set("allow_stale", options.allowStale ? "1" : "0");
  if (typeof options.prepare === "boolean") params.set("prepare", options.prepare ? "1" : "0");
  const qs = params.toString();
  const path = `/api/monitoreo/territorial/map${qs ? `?${qs}` : ""}`;
  const inflightKey = `${getSession() ?? ""}|${path}`;
  const inflight = monitoreoTerritorialMapInflight.get(inflightKey);
  if (inflight) return inflight;
  const promise = apiFetch(path, { headers: headers() })
    .then((res) => handle<MonitoreoTerritorialMapResponse>(res))
    .finally(() => {
      if (monitoreoTerritorialMapInflight.get(inflightKey) === promise) {
        monitoreoTerritorialMapInflight.delete(inflightKey);
      }
    });
  monitoreoTerritorialMapInflight.set(inflightKey, promise);
  return promise;
}

export async function apiMonitoreoTerritorialMapPrepare(options: {
  phase?: "pilot" | "field";
  layers?: Array<"route_geometry" | "gps_points">;
  force?: boolean;
} = {}) {
  return handle<JobStart & { cache_hit?: boolean }>(
    await apiFetch("/api/monitoreo/territorial/map/prepare", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        phase: options.phase,
        layers: options.layers,
        force: options.force,
      }),
    }),
  );
}

export async function apiMonitoreoTerritorialOccurrencesConfig(config: Partial<MonitoreoFieldOccurrenceConfig>) {
  return handle<{ ok: true; config: MonitoreoConfig; field_occurrences: MonitoreoFieldOccurrenceDashboard; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/territorial/occurrences/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ field_occurrences: config }),
    }),
  );
}

export async function apiMonitoreoTerritorialOccurrencesInspect(payload: Partial<MonitoreoFieldOccurrenceConfig> = {}) {
  return handle<MonitoreoFieldOccurrenceInspectResult>(
    await apiFetch("/api/monitoreo/territorial/occurrences/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialOccurrencesXlsform(payload: Partial<MonitoreoFieldOccurrenceConfig> = {}) {
  const result = await handle<MonitoreoFieldOccurrenceUploadResult>(
    await apiFetch("/api/monitoreo/territorial/occurrences/xlsform", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
  return result.file?.file_id ? { ...result, download_url: downloadUrl(result.file.file_id) } : result;
}

export async function apiMonitoreoTerritorialOccurrencesUploadKobo(payload: Partial<MonitoreoFieldOccurrenceConfig> = {}) {
  return handle<MonitoreoFieldOccurrenceUploadResult>(
    await apiFetch("/api/monitoreo/territorial/occurrences/upload-kobo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoTerritorialOccurrencesSync(payload: { source_id?: string; asset_uid?: string } = {}) {
  return handle<{ ok: true; synced_at: string; n_rows: number; field_occurrences: MonitoreoFieldOccurrenceDashboard; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/territorial/occurrences/sync", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type MonitoreoUmpExportResult = {
  ok: true;
  file_id: string;
  filename: string;
  size?: number;
  counts?: { ump?: number; sin_ocurrencias?: number };
  filters?: { only_missing?: boolean; responsable?: string; distrito?: string };
};

export async function apiMonitoreoTerritorialUmpExport(payload: {
  only_missing?: boolean;
  responsable?: string;
  distrito?: string;
  config?: Partial<MonitoreoConfig>;
} = {}) {
  return handle<MonitoreoUmpExportResult>(
    await apiFetch("/api/monitoreo/territorial/occurrences/ump-export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoSource(payload: MonitoreoSourcePayload) {
  return handle<{ ok: true; source: MonitoreoSource; validation: unknown; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/source", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoSources(sources: MonitoreoSourcePayload[]) {
  return handle<{ ok: true; sources: MonitoreoSource[]; validations: Record<string, unknown>; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/sources", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ sources }),
    }),
  );
}

export async function apiMonitoreoConfig(config: Partial<MonitoreoConfig>) {
  return handle<{ ok: true; config: MonitoreoConfig; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiMonitoreoAcreditacionCaseReconciliation(payload: {
  response_id: string;
  action: "keep_excluded" | "include_with_caveat";
  candidate_id?: string;
  note?: string;
}) {
  return handle<{
    ok: true;
    decision: MonitoreoManualCaseReconciliation;
    config: MonitoreoConfig;
    state: MonitoreoState;
    saved_project?: boolean;
  }>(
    await apiFetch("/api/monitoreo/acreditacion/case-reconciliation", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoSurveyMonkeyCollectors(
  sourceIds: string[] = [],
  options: { remote?: boolean; includeRecipients?: boolean; includeDetails?: boolean } = {},
) {
  return handle<{
    ok: true;
    generated_at: string;
    mode: "local_snapshot" | "surveymonkey";
    source_count: number;
    collectors: MonitoreoSurveyMonkeyCollector[];
  }>(
    await apiFetch("/api/monitoreo/surveymonkey/collectors", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        source_ids: sourceIds,
        remote: Boolean(options.remote),
        include_recipients: Boolean(options.includeRecipients),
        include_details: Boolean(options.includeDetails),
      }),
    }),
  );
}

export async function apiMonitoreoCollectorsConfig(collectors: MonitoreoLinkCollector[]) {
  return handle<{ ok: true; config: MonitoreoConfig; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/collectors/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ collectors }),
    }),
  );
}

export async function apiMonitoreoImportFromCalcMuestra(estudio?: CalcMuestraEstudio) {
  return handle<{ ok: true; acreditacion: MonitoreoAcreditacion; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/import-from-calc-muestra", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(estudio ? { estudio } : {}),
    }),
  );
}

export async function apiMonitoreoAulasImportFromCalcMuestra(payload: {
  estudio?: CalcMuestraEstudio;
  selection?: CalcMuestraAulasSelection;
  frame?: CalcMuestraAulasFrame;
  config?: Partial<MonitoreoAulasConfig>;
} = {}) {
  return handle<{ ok: true; aulas_universitarias: MonitoreoAulasConfig; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/aulas/import-from-calc-muestra", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoAulasConfig(config: Partial<MonitoreoAulasConfig>) {
  return handle<{ ok: true; aulas_universitarias: MonitoreoAulasConfig; config: MonitoreoConfig; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/aulas/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiMonitoreoAulasAgenda(updates: Partial<MonitoreoAulasPlanRow> | Partial<MonitoreoAulasPlanRow>[]) {
  return handle<{ ok: true; agenda: MonitoreoAulasPlanRow[]; aulas_universitarias: MonitoreoAulasConfig; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/aulas/agenda", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ updates: Array.isArray(updates) ? updates : [updates] }),
    }),
  );
}

export async function apiMonitoreoAulasReemplazo(payload: {
  classroom_id: string;
  replacement_id: string;
  reason?: string;
  note?: string;
}) {
  return handle<{ ok: true; agenda: MonitoreoAulasPlanRow[]; aulas_universitarias: MonitoreoAulasConfig; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/aulas/reemplazo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiMonitoreoAulasSync(responses?: MonitoreoRow[]) {
  return handle<{ ok: true; synced_at: string; dashboard: MonitoreoAulasDashboard; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/aulas/sync", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(responses ? { responses } : {}),
    }),
  );
}

export async function apiMonitoreoAulasState() {
  return handle<MonitoreoState>(
    await apiFetch("/api/monitoreo/aulas/state", { headers: headers() }),
  );
}

export async function apiMonitoreoAcreditacionSeguimiento(payload: MonitoreoAcreditacionSeguimientoPayload) {
  return handle<{ ok: true; acreditacion: MonitoreoAcreditacion; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/acreditacion/seguimiento", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ seguimiento: payload }),
    }),
  );
}

export async function apiMonitoreoCierre(options: { plan_refuerzo?: string; aprobar_brechas?: boolean } = {}) {
  return handle<{ ok: true; acreditacion: MonitoreoAcreditacion; state: MonitoreoState }>(
    await apiFetch("/api/monitoreo/cierre", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(options),
    }),
  );
}

export async function apiMonitoreoSync(
  config?: Partial<MonitoreoConfig>,
  sourceIds: string[] = [],
  options: { syncMode?: "full" | "advance" | string } = {},
) {
  return handle<JobStart>(
    await apiFetch("/api/monitoreo/sync", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(config ? { config } : {}),
        ...(sourceIds.length ? { source_ids: sourceIds } : {}),
        ...(options.syncMode ? { sync_mode: options.syncMode } : {}),
      }),
    }),
  );
}

export async function apiMonitoreoSupervisionSample(options: {
  config?: Partial<MonitoreoConfig>;
  n?: number;
  seed?: number;
  only_risk?: boolean;
} = {}) {
  return handle<{ ok: true; sample: MonitoreoRow[]; n: number }>(
    await apiFetch("/api/monitoreo/supervision/sample", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(options),
    }),
  );
}

export async function apiMonitoreoExport(config?: Partial<MonitoreoConfig>) {
  return handle<FileJobResult>(
    await apiFetch("/api/monitoreo/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(config ? { config } : {}),
    }),
  );
}

function withProcessingHandoffDownloadUrls(
  result: MonitoreoProcessingHandoffResult,
): MonitoreoProcessingHandoffResult {
  const withUrl = (file?: MonitoreoTerritorialOperationalPackageFile) =>
    file?.file_id ? { ...file, download_url: downloadUrl(file.file_id) } : file;
  return {
    ...result,
    ...(result.file_id ? { download_url: downloadUrl(result.file_id) } : {}),
    ...(result.files ? {
      files: {
        ...result.files,
        package: withUrl(result.files.package),
        data_xlsx: withUrl(result.files.data_xlsx),
        xlsform: withUrl(result.files.xlsform),
      },
    } : {}),
  };
}

export async function apiMonitoreoProcessingHandoffExport(options: {
  universe?: MonitoreoProcessingHandoffUniverse | string;
  config?: Partial<MonitoreoConfig>;
} = {}) {
  const result = await handle<MonitoreoProcessingHandoffResult>(
    await apiFetch("/api/monitoreo/processing-handoff/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(options.universe ? { universe: options.universe } : {}),
        ...(options.config ? { config: options.config } : {}),
      }),
    }),
  );
  return withProcessingHandoffDownloadUrls(result);
}

export async function apiMonitoreoProcessingHandoffPromote(options: {
  universe?: MonitoreoProcessingHandoffUniverse | string;
  config?: Partial<MonitoreoConfig>;
  base_nombre?: string;
} = {}) {
  return handle<MonitoreoProcessingHandoffPromoteResult>(
    await apiFetch("/api/monitoreo/processing-handoff/promote", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(options.universe ? { universe: options.universe } : {}),
        ...(options.config ? { config: options.config } : {}),
        ...(options.base_nombre ? { base_nombre: options.base_nombre } : {}),
      }),
    }),
  );
}

// ---------- Hojas de ruta para campo ----------

export type HojasRutaFieldStatus = {
  nombre: string;
  estado: "listo" | "faltante";
  tipo: string | null;
};

export type HojasRutaIssue = {
  campo: string;
  mensaje: string;
};

export type HojasRutaVariable = {
  nombre: string;
  tipo: string;
};

export type HojasRutaConfig = {
  row_var: string;
  col_var: string;
  value_var: string;
  count_mode: "frecuencia" | "suma";
  cartografia_dir: string;
  project_code: string;
  max_umps: number | null;
};

export type HojasRutaAgeRange = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

export type SamplingMethod = "pps" | "sistematico" | "conglomerado_fijo";
export type SampleSizeMode = "calculator" | "external_total" | "external_district";
export type HojasRutaAgeRangeMode = "manual" | "terciles" | "cuartiles" | "quintiles" | "deciles";
export type HojasRutaAgeRangeScope = "selected" | "frame";
export type HojasRutaZoneAllocation = "proportional";
export type HojasRutaRandomPreference = "balanced" | "population" | "urban";
export type HojasRutaRouteStartCorner = "auto" | "1" | "2" | "3" | "4";
export type HojasRutaRouteJumpMode = "auto" | "off" | "manual";
export type HojasRutaFrameSource = "current" | "inei2017_official";
export type HojasRutaReplacementPolicy = "paired_by_titular_zone" | "alternate_zone_same_district";

export type AllocationMode = "proportional" | "uniform" | "compromise";

export type HojasRutaSampleSizeConfig = {
  confidence_level: number;
  margin_total: number;
  margin_district: number;
  margin_district_overrides?: Record<string, number>;
  expected_proportion: number;
  design_effect: number;
  design_effect_overrides?: Record<string, number>;
  allocation_mode?: AllocationMode;
  enforce_district_floor?: boolean;
  response_rate: number;
  apply_fpc: boolean;
};

export type HojasRutaIntegratedConfig = {
  frame_source: HojasRutaFrameSource;
  n_objetivo: number;
  n_mode: "total" | "por_distrito";
  n_por_distrito: Record<string, number>;
  replacement_routes_per_district: Record<string, number>;
  replacement_policy: HojasRutaReplacementPolicy;
  replacements_per_titular: number;
  territorios: string[];
  row_var: "departamento" | "provincia" | "distrito" | "ubigeo" | "zona";
  col_var: "rango_edad";
  subquota_var: "sexo" | "ninguna";
  measure_var: "viviendas" | "poblacion";
  sampling_method: SamplingMethod;
  seed: number;
  max_per_manzana: number;
  entrevistas_por_manzana: number;
  route_start_corner: HojasRutaRouteStartCorner;
  route_jump_mode: HojasRutaRouteJumpMode;
  route_jump_manual: number;
  age_range_mode: HojasRutaAgeRangeMode;
  age_range_scope: HojasRutaAgeRangeScope;
  zone_allocation: HojasRutaZoneAllocation;
  age_ranges: HojasRutaAgeRange[];
  sample_size_mode: SampleSizeMode;
  sample_size: HojasRutaSampleSizeConfig;
  excluded_titular_ids?: string[];
  random_preference?: HojasRutaRandomPreference;
};

export type HojasRutaUiStage = "territorio" | "poblacion" | "muestra" | "manzanas" | "entrega";

export type HojasRutaUiState = {
  active_stage: HojasRutaUiStage;
  draft_territories: string[];
  map_ubigeo: string;
  map_zona: string;
  map_level: "distritos" | "zonas" | "manzanas";
  map_selection_mode: boolean;
  route_history: HojasRutaRouteSnapshot[];
};

export type TerritorialFrameMeta = {
  ok: boolean;
  active_source?: HojasRutaFrameSource;
  source: string;
  year: number;
  version: string;
  packaged_at: string;
  checksum: string | null;
  coverage: string;
  pilot: boolean;
  granularity?: string;
  path: string;
  n_departamentos: number;
  n_provincias: number;
  n_distritos: number;
  n_manzanas: number;
  viviendas: number;
  poblacion: number;
  current?: Partial<TerritorialFrameMeta>;
  official?: Partial<TerritorialFrameMeta> & { available?: boolean };
  frame?: {
    current?: Partial<TerritorialFrameMeta>;
    official?: Partial<TerritorialFrameMeta> & { available?: boolean };
    active_source?: HojasRutaFrameSource;
  };
  age_data?: TerritorialAgeSimpleMeta;
  zone_cartography?: {
    ok: boolean;
    available: boolean;
    source: string;
    year: number;
    version: string;
    coverage: string;
    districts: number;
    zones: number;
    packaged_districts?: number;
    packaged_zones?: number;
    note?: string;
  };
  audit?: {
    ok: boolean;
    available: boolean;
    summary_path?: string;
    audit_path?: string;
    rows?: number;
    status_counts?: Record<string, number>;
    major_differences?: unknown[];
    message?: string;
  };
  block_cartography?: TerritorialBlockCartographyMeta;
  street_cartography?: StreetCartographyMeta;
  context_cartography?: ContextCartographyMeta;
  nse_data?: {
    ok: boolean;
    available: boolean;
    source?: string;
    message?: string;
    coverage?: string;
    matched_blocks?: number;
    input_points?: number;
    coverage_rate?: number;
    levels?: string[];
    callao_available?: boolean;
  };
  note: string;
  methods: { id: SamplingMethod; label: string; description: string }[];
};

export type StreetCartographyMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  provider: string;
  provider_url: string;
  license: string;
  license_url: string;
  attribution: string;
  extraction_date: string | null;
  packaged_at: string | null;
  coverage: string;
  format: string;
  mode: string;
  packaged_districts: number;
  packaged_streets: number;
  checksum: string | null;
  manifest_path: string;
  note: string;
};

export type ContextCartographyMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  provider: string;
  license: string;
  license_url: string;
  attribution: string;
  packaged_at: string | null;
  coverage: string;
  format: string;
  geometry: string;
  mode: string;
  packaged_districts: number;
  packaged_features: number;
  counts_by_class?: Record<string, number>;
  included_classes?: string[];
  checksum: string | null;
  manifest_path: string;
  curated_path?: string;
  note: string;
};

export type TerritorialBlockCartographyMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  layer_url: string;
  query_url: string;
  year: number;
  years?: number[];
  provider: string;
  version: string;
  packaged_at: string | null;
  coverage: string;
  geometry: string;
  id_field: string;
  district_field: string;
  source_field: string;
  area_field: string;
  mode: string;
  manifest_path: string;
  checksum: string | null;
  packaged_districts?: number;
  packaged_blocks?: number;
  sources?: Record<string, TerritorialBlockCartographyMeta>;
  note: string;
};

export type HojasRutaStreetMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  } | null;
  properties: {
    id?: string;
    osm_id?: string | number;
    name?: string;
    display_name?: string;
    highway?: string;
    class_group?: "major" | "detail" | string;
    rank?: number;
    avenue_like?: boolean;
    ubigeo?: string;
  };
};

export type HojasRutaStreetMap = {
  ok: boolean;
  source: StreetCartographyMeta;
  ubigeo: string;
  count: number;
  returned: number;
  cache: boolean;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaStreetMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type HojasRutaContextMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";
    coordinates: unknown;
  } | null;
  properties: {
    id?: string;
    osm_id?: string | number;
    name?: string;
    display_name?: string;
    feature_class?: "water" | "coast" | "waterway" | "green" | "square" | "public" | "transit" | "landmark" | string;
    kind?: string;
    rank?: number;
    area_m2?: number;
    length_m?: number;
    source_kind?: "osm" | "curated" | string;
    source?: string;
    source_url?: string;
    confidence?: string;
    aliases?: string[];
  };
};

export type HojasRutaContextMap = {
  ok: boolean;
  source: ContextCartographyMeta;
  ubigeo: string;
  count: number;
  returned: number;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaContextMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type TerritorialAgeSimpleMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  query_url: string;
  year: number;
  version: string;
  packaged_at: string | null;
  checksum: string | null;
  granularity: string;
  variable_edad: string;
  variable_sexo: string;
  min_age: number | null;
  max_age: number | null;
  n_ubigeos: number;
  rows: number;
  poblacion: number;
  poblacion_18_plus: number;
  path: string;
};

export type HojasRutaAgeSource = {
  type: string;
  label?: string;
  granularity?: string;
  variable_edad?: string;
  variable_sexo?: string;
  version?: string;
  reason?: string;
};

export type HojasRutaTerritory = {
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  viviendas: number;
  poblacion: number;
  manzanas: number;
};

export type HojasRutaAlert = {
  level: "info" | "warn" | "error";
  code: string;
  message: string;
};

export type QuotaPlan = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  n_objetivo: number;
  total_asignado: number;
  route_size?: number;
  route_multiple_ok?: boolean;
  age_source?: HojasRutaAgeSource;
  territories: HojasRutaTerritory[];
  cells: Record<string, string | number | null>[];
  table: Record<string, string | number | null>[];
  alerts: HojasRutaAlert[];
};

export type PopulationPlan = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  total_poblacion: number;
  age_source?: HojasRutaAgeSource;
  territories: HojasRutaTerritory[];
  cells: Record<string, string | number | null>[];
  table: Record<string, string | number | null>[];
  alerts: HojasRutaAlert[];
};

export type HojasRutaSampleSizeDistrictRow = {
  ubigeo: string;
  distrito: string;
  poblacion: number;
  viviendas: number;
  n_recommended: number;
  n_min_district: number;
  n_used: number;
  margin_estimated: number | null;
  target_margin: number;
  sampling_fraction: number | null;
  design_effect: number;
  status: "ok" | "alerta" | "faltante";
  message: string;
};

export type HojasRutaSampleSizePreview = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  sample_size: HojasRutaSampleSizeConfig;
  mode: SampleSizeMode;
  total_population: number;
  n_recommended: number;
  n_recommended_route?: number;
  n_total_min: number;
  n_total_min_raw?: number;
  n_district_floor: number;
  n_district_floor_raw?: number;
  route_size?: number;
  route_multiple_ok?: boolean;
  n_route_previous?: number;
  n_route_next?: number;
  allocation_mode: AllocationMode;
  enforce_district_floor: boolean;
  n_used: number;
  contacts_suggested: number;
  margin_total_estimated: number | null;
  margin_total_target: number;
  district_rows: HojasRutaSampleSizeDistrictRow[];
  alerts: HojasRutaAlert[];
};

export type HojasRutaPopulationExportResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  total_poblacion: number;
  n_territorios: number;
  n_cells: number;
};

export type SelectedBlock = {
  id_manzana: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ubigeo: string;
  zona: string;
  manzana: string;
  viviendas: number;
  poblacion: number;
  territorio_muestral: string;
  metodo: SamplingMethod;
  orden_seleccion: number;
  hoja_num?: number;
  rango_inicio?: number;
  rango_fin?: number;
  entrevistas: number;
  medida_tamano: number;
  lat: number | null;
  lon: number | null;
  tipo_manzana?: "titular" | "reemplazo" | string;
  replacement_policy?: string;
  replacement_order?: number;
  replacement_total?: number;
  titular_id_manzana?: string;
  titular_orden_seleccion?: number;
  titular_ubigeo?: string;
  titular_zona?: string;
  titular_hoja_num?: number;
  titular_rango_inicio?: number;
  titular_rango_fin?: number;
  replacement_label?: string;
  replacement_fallback?: boolean | string;
  esquina_codigo?: number;
  esquina_inicio?: string;
  esquina_coordenada?: string;
  sentido_recorrido?: string;
  vivienda_inicio?: number;
  domicilio_inicio?: number;
  constante_salto?: number;
  constante_salto_raw?: number;
  constante_salto_formula?: string;
  constante_salto_unidad?: string;
  constante_salto_modo?: HojasRutaRouteJumpMode | string;
  salto_operativo?: number;
  modo_seleccion_vivienda?: string;
  nse_codigo?: string | number | null;
  nse_nivel?: string | null;
  nse_match_method?: string | null;
  nse_distance_m?: number | null;
  nse_income_per_capita?: number | null;
  nse_personas?: number | null;
  nse_hogares?: number | null;
  nse_idmz18?: string | null;
};

export type HojasRutaSamplePreview = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  quota: QuotaPlan;
  method: SamplingMethod;
  seed: number;
  blocks: SelectedBlock[];
  replacement_blocks: SelectedBlock[];
  n_blocks: number;
  n_replacement_blocks: number;
  total_entrevistas: number;
  total_replacement_interviews: number;
  unassigned: number;
  alerts: HojasRutaAlert[];
};

export type HojasRutaWorkspaceOutputs = {
  population?: PopulationPlan | null;
  sample_size_preview?: HojasRutaSampleSizePreview | null;
  quota?: QuotaPlan | null;
  sample?: HojasRutaSamplePreview | null;
};

export type HojasRutaPhase = "pilot" | "field";
export type HojasRutaPilotExclusionMode = "exclude_titulars" | "ignore";

export type HojasRutaRun = {
  config: HojasRutaIntegratedConfig;
  ui_state: HojasRutaUiState;
  workspace_outputs: HojasRutaWorkspaceOutputs;
  locked?: boolean;
  role: HojasRutaPhase;
  pilot_exclusion_mode?: HojasRutaPilotExclusionMode;
};

export type HojasRutaPhaseNotice = {
  kind: string;
  message?: string;
  migrated_at?: string;
  pilot_total_entrevistas?: number;
  pilot_titulars?: number;
};

export type HojasRutaRouteDistrictSummary = {
  ubigeo: string;
  distrito: string;
  n: number;
  manzanas: number;
  reemplazos: number;
};

export type HojasRutaRouteSnapshot = {
  id: string;
  label: string;
  created_at: string;
  seed: number;
  method: SamplingMethod;
  route_size: number;
  n_final: number;
  n_blocks: number;
  n_replacement_blocks: number;
  total_entrevistas: number;
  total_replacement_interviews: number;
  territories: string[];
  distribution: HojasRutaRouteDistrictSummary[];
  config: HojasRutaIntegratedConfig;
  sample: HojasRutaSamplePreview;
};

export type HojasRutaBlockMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  } | null;
  properties: {
    OBJECTID?: number;
    ID_MANZANA?: string;
    NOMBDIST?: string;
    NOMBPROV?: string;
    NOMBDEP?: string;
    FTE_MZNA?: string;
    AREA_M2?: number;
    ubigeo?: string;
    cartografia_id?: string;
    manzana_label?: string;
    fuente_anio?: number;
    inei_zona?: string;
    inei_manzana?: string;
    inei_id_manzana?: string;
    inei_viviendas?: number;
    inei_poblacion?: number;
    inei_pob_hombres?: number;
    inei_pob_mujeres?: number;
    inei_pob_18_plus?: number;
    inei_age_breakdown?: Record<string, number>;
    nse_codigo?: number | string | null;
    nse_nivel?: string | null;
    nse_match_method?: string | null;
    nse_distance_m?: number | null;
  };
};

export type HojasRutaZoneMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][] | number[][][][][];
  } | null;
  properties: {
    id?: string;
    ubigeo?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    zona?: string;
    zona_label?: string;
    n_manzanas?: number;
    viviendas?: number;
    poblacion?: number;
  };
};

export type HojasRutaZoneMap = {
  ok: boolean;
  source: TerritorialBlockCartographyMeta;
  ubigeo: string;
  territory: {
    ubigeo: string;
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
  };
  count: number;
  returned: number;
  cache: boolean;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaZoneMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type HojasRutaBlockMap = {
  ok: boolean;
  source: TerritorialBlockCartographyMeta;
  ubigeo: string;
  territory: {
    ubigeo: string;
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
  };
  count: number;
  returned: number;
  truncated: boolean;
  feature_limit: number;
  cache: boolean;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaBlockMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type HojasRutaCampos = {
  ok: boolean;
  required: string[];
  present: string[];
  missing: string[];
  columns: HojasRutaFieldStatus[];
  invalid: HojasRutaIssue[];
  n_filas: number;
  n_columnas: number;
};

export type HojasRutaPreviewRow = {
  index: number;
  ump: string;
  idmanzana: string;
  ubigeo: string | null;
  cod_zona: string | null;
  cod_manzana: string | null;
  mapa: string | null;
  mapa_encontrado: boolean;
  mapa_path: string | null;
  filename: string;
  cuota: Record<string, string | number | null>[];
};

export type HojasRutaReporteDecisionalMeta = {
  disponible: boolean;
  generated_at?: string | null;
  formato?: "html" | "pdf" | null;
  job_id?: string | null;
};

export type HojasRutaState = {
  ok: boolean;
  has_data: boolean;
  cache_dir: string;
  config: HojasRutaConfig;
  integrated_config: HojasRutaIntegratedConfig;
  ui_state: HojasRutaUiState;
  workspace_outputs?: HojasRutaWorkspaceOutputs;
  runs?: Partial<Record<HojasRutaPhase, HojasRutaRun>>;
  active_phase?: HojasRutaPhase;
  phase_notice?: HojasRutaPhaseNotice | null;
  frame_meta: TerritorialFrameMeta;
  territories: HojasRutaTerritory[];
  campos: HojasRutaCampos | null;
  variables: HojasRutaVariable[];
  reporte_decisional?: HojasRutaReporteDecisionalMeta;
  reporte_decisional_listo_para_generar?: boolean;
};

export type HojasRutaWarmupTargets = {
  ok: boolean;
  frame_ok: boolean;
  has_data: boolean;
  active_phase?: HojasRutaPhase;
  ubigeos: string[];
  territories_count: number;
};

export type HojasRutaPreview = HojasRutaState & {
  config_issues: HojasRutaIssue[];
  n_umps: number;
  mapas_faltantes: number;
  rows: HojasRutaPreviewRow[];
};

export type HojasRutaJobResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  n_pdfs: number;
  n_zone_pdfs?: number;
  n_blocks: number;
  n_replacement_blocks?: number;
  n_zones?: number;
  total_entrevistas: number;
  total_replacement_interviews?: number;
  frame_version: string;
  alerts: HojasRutaAlert[];
  mapas_faltantes: number;
};

export type HojasRutaWorkbookResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  n_blocks: number;
  n_replacement_blocks: number;
  total_entrevistas: number;
  total_replacement_interviews?: number;
  frame_version: string;
  alerts: HojasRutaAlert[];
};

export type HojasRutaManualReplacementResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  n_titulars: number;
  n_replacement_blocks: number;
  replacements_per_titular: number;
  replacement_blocks: SelectedBlock[];
  alerts: HojasRutaAlert[];
  frame_version: string;
};

export type HojasRutaRandomPdfResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  distrito: string;
  ubigeo: string;
  zona: string;
  manzana: string;
  id_manzana: string;
  entrevistas: number;
  hoja_num: number;
  rango_inicio: number;
  rango_fin: number;
  frame_version: string;
  random_preference: HojasRutaRandomPreference;
  alerts: HojasRutaAlert[];
};

export async function apiHojasRutaState() {
  return handle<HojasRutaState>(
    await apiFetch("/api/hojas-ruta/state", { headers: headers() }),
  );
}

export async function apiHojasRutaWarmupTargets(options: { maxUbigeos?: number } = {}) {
  const params = new URLSearchParams();
  if (options.maxUbigeos != null) params.set("max_ubigeos", String(options.maxUbigeos));
  const qs = params.toString();
  return handle<HojasRutaWarmupTargets>(
    await apiFetch(`/api/hojas-ruta/warmup-targets${qs ? `?${qs}` : ""}`, { headers: headers() }),
  );
}

export async function apiHojasRutaPersistWorkspace(
  config: Partial<HojasRutaIntegratedConfig>,
  uiState: Partial<HojasRutaUiState>,
  outputs?: Partial<HojasRutaWorkspaceOutputs>,
  phase?: HojasRutaPhase,
  pilotExclusionMode?: HojasRutaPilotExclusionMode,
) {
  return handle<{ ok: true; integrated_config: HojasRutaIntegratedConfig; ui_state: HojasRutaUiState; workspace_outputs?: HojasRutaWorkspaceOutputs; active_phase?: HojasRutaPhase; runs?: Partial<Record<HojasRutaPhase, HojasRutaRun>> }>(
    await apiFetch("/api/hojas-ruta/workspace", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        config,
        ui_state: uiState,
        workspace_outputs: outputs ?? {},
        ...(phase ? { phase } : {}),
        ...(pilotExclusionMode ? { pilot_exclusion_mode: pilotExclusionMode } : {}),
      }),
    }),
  );
}

export async function apiHojasRutaSetPhase(phase: HojasRutaPhase) {
  return handle<HojasRutaState>(
    await apiFetch("/api/hojas-ruta/phase", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ phase }),
    }),
  );
}

export async function apiHojasRutaCreateFieldFromPilot(pilotExclusionMode: HojasRutaPilotExclusionMode = "exclude_titulars") {
  return handle<HojasRutaState>(
    await apiFetch("/api/hojas-ruta/field/from-pilot", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ pilot_exclusion_mode: pilotExclusionMode }),
    }),
  );
}

export async function apiHojasRutaSaveConfig(config: Partial<HojasRutaConfig>) {
  return handle<{ ok: true; config: HojasRutaConfig }>(
    await apiFetch("/api/hojas-ruta/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaPreview(config: Partial<HojasRutaConfig>) {
  return handle<HojasRutaPreview>(
    await apiFetch("/api/hojas-ruta/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaQuotaPreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<QuotaPlan>(
    await apiFetch("/api/hojas-ruta/quota-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaPopulationPreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<PopulationPlan>(
    await apiFetch("/api/hojas-ruta/population-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaPopulationExport(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<HojasRutaPopulationExportResult>(
    await apiFetch("/api/hojas-ruta/population-export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaSampleSizePreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<HojasRutaSampleSizePreview>(
    await apiFetch("/api/hojas-ruta/sample-size-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaSamplePreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<HojasRutaSamplePreview>(
    await apiFetch("/api/hojas-ruta/sample-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaRandomPdf(
  config: Partial<HojasRutaIntegratedConfig>,
  randomPreference: HojasRutaRandomPreference = "balanced",
) {
  return handle<HojasRutaRandomPdfResult>(
    await apiFetch("/api/hojas-ruta/random-pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, random_preference: randomPreference }),
    }),
  );
}

export async function apiHojasRutaBlockMap(ubigeo: string, limit = 0, refresh = false, allowOnline = false) {
  const params = new URLSearchParams({ ubigeo, limit: String(limit) });
  if (refresh) params.set("refresh", "1");
  if (allowOnline) params.set("allow_online", "1");
  return handle<HojasRutaBlockMap>(
    await apiFetch(`/api/hojas-ruta/block-map?${params.toString()}`),
  );
}

export async function apiHojasRutaZoneMap(ubigeo: string) {
  const params = new URLSearchParams({ ubigeo });
  return handle<HojasRutaZoneMap>(
    await apiFetch(`/api/hojas-ruta/zone-map?${params.toString()}`),
  );
}

export async function apiHojasRutaStreetMap(ubigeo: string) {
  const params = new URLSearchParams({ ubigeo });
  return handle<HojasRutaStreetMap>(
    await apiFetch(`/api/hojas-ruta/street-map?${params.toString()}`),
  );
}

export async function apiHojasRutaContextMap(ubigeo: string) {
  const params = new URLSearchParams({ ubigeo });
  return handle<HojasRutaContextMap>(
    await apiFetch(`/api/hojas-ruta/context-map?${params.toString()}`),
  );
}

export async function apiHojasRutaGenerate(
  config: Partial<HojasRutaIntegratedConfig>,
  sample?: HojasRutaSamplePreview | null,
) {
  return handle<JobStart>(
    await apiFetch("/api/hojas-ruta/generate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, sample }),
    }),
  );
}

export async function apiHojasRutaRouteWorkbook(
  config: Partial<HojasRutaIntegratedConfig>,
  sample?: HojasRutaSamplePreview | null,
) {
  return handle<HojasRutaWorkbookResult>(
    await apiFetch("/api/hojas-ruta/route-workbook", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, sample }),
    }),
  );
}

export async function apiHojasRutaManualReplacementsPdf(
  config: Partial<HojasRutaIntegratedConfig>,
  sample: HojasRutaSamplePreview,
  titularIds: string[],
  replacementsPerTitular: number,
) {
  return handle<JobStart>(
    await apiFetch("/api/hojas-ruta/manual-replacements-pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        config,
        sample,
        titular_ids: titularIds,
        replacements_per_titular: replacementsPerTitular,
      }),
    }),
  );
}

export async function apiHojasRutaReporteDecisionalIniciar(
  formato: "html" | "pdf" = "html",
) {
  return handle<{ ok: true; job_id: string; formato: "html" | "pdf" }>(
    await apiFetch("/api/hojas-ruta/reporte-decisional", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    }),
  );
}

export function hojasRutaReporteDecisionalUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/hojas-ruta/reporte-decisional/descargar${qs ? `?${qs}` : ""}`);
}

// ---------- Validación ----------
// Los bindings v1 (apiValidacionBuildPlan, apiValidacionExportPlan,
// apiValidacionImportPlan, apiValidacionAuditoria,
// apiValidacionAuditoriaRegla, graficoSeccionesUrl, graficoPreguntasUrl)
// se removieron tras el cutover a Validación v2. Los reemplazos viven
// en los endpoints /api/validacion/v2/... consumidos por
// features/validacion/* directamente.

export function downloadUrl(file_id: string) {
  // Pasamos el sid como query param porque los <a href> nativos del
  // browser no mandan headers custom. El endpoint backend acepta ambos
  // (header o ?sid=), con el header teniendo prioridad.
  const sid = getSession();
  const qs = sid ? `?sid=${encodeURIComponent(sid)}` : "";
  return apiPath(`/api/files/${file_id}/download${qs}`);
}

// ---------- Codificación ----------

// ---------- Codificación: modelo canónico JSON ----------

export type FamiliaRow = {
  use: boolean;
  q_order: number;
  tipo: "select_one" | "select_multiple" | "integer" | "text" | string;
  modo_so: "" | "padre" | "hijo";
  parent: string;
  parent_label: string;
  list_norm: string;
  parent_col: string;
  other_dummy_col: string;
  text_col: string;
  parent_col_cands?: string;
  other_dummy_cands?: string;
  text_col_cands?: string;
  dummy_cands?: string;
};

export type FamiliasDraftResponse = {
  ok: true;
  rows: FamiliaRow[];
  source: "suggestion" | "draft";
  updated_at: string;
};

export type FamiliasCommitResumen = {
  total_filas_excel: number;
  aceptadas_total: number;
  aceptadas_sm: number;
  aceptadas_so: number;
  aceptadas_int: number;
  aceptadas_text: number;
  excluidas: number;
  textos_adoptados: number;
  textos_huerfanos: number;
};

export type FamiliasCommitResponse = {
  ok: true;
  n_select_one: number;
  n_select_multiple: number;
  n_integer: number;
  n_text: number;
  n_huerfanos: number;
  resumen: FamiliasCommitResumen[];
};

export async function apiCodifColumnas() {
  return handle<{ ok: true; columnas: string[] }>(
    await apiFetch("/api/codificacion/columnas", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftGet() {
  return handle<FamiliasDraftResponse>(
    await apiFetch("/api/codificacion/familias/draft", { headers: headers() })
  );
}

export async function apiCodifFamiliasDraftSave(rows: FamiliaRow[]) {
  return handle<{ ok: true; n_rows: number; updated_at: string }>(
    await apiFetch("/api/codificacion/familias/draft", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ rows }),
    })
  );
}

export async function apiCodifFamiliasCommit() {
  return handle<FamiliasCommitResponse>(
    await apiFetch("/api/codificacion/familias/commit", { method: "POST", headers: headers() })
  );
}

// ---------- Codificación: modelo task-oriented ----------

export type PreguntaStatus =
  | "no-aplica"
  | "requiere-config"
  | "sin-datos"
  | "no-iniciado"
  | "en-curso"
  | "completo";

export type PreguntaSubtipo =
  | "select_one_padre"
  | "select_one_hijo"
  | "select_one_sin_modo"
  | "select_multiple"
  | "integer"
  | "text";

export type CandidatoTexto = {
  col: string;
  parent_detectado: string;
  confianza: number; // 0-1
};

export type ParejaCommitteada = {
  child_col: string;
  modo_so: "" | "padre" | "hijo";
  dummy_col: string;
};

export type OpcionSM = {
  codigo: string;
  label: string;
  col_dummy: string;
  existe_en_data: boolean;
  es_otros_sugerido: boolean;
};

export type PreguntaAbierta = {
  parent: string;
  parent_label: string;
  tipo: "select_one" | "select_multiple" | "integer" | "text" | string;
  subtipo: PreguntaSubtipo;
  modo_so: "" | "padre" | "hijo";
  text_col: string;
  parent_col: string;
  list_norm: string;
  col_efectiva: string;
  n_respuestas: number;
  n_unicas: number;
  n_codificadas: number;
  status: PreguntaStatus;
  habilitada: boolean;
  preview: string[];
  section: string;
  section_label: string;
  q_order: number | null;
  candidatos_texto: CandidatoTexto[];
  pareja: ParejaCommitteada | Record<string, never> | null;
  opciones_sm?: OpcionSM[];
  marcada: boolean;
  marcada_auto: boolean;
};

export async function apiCodifMarcar(parent: string, marcada: boolean) {
  return handle<{ ok: true; parent: string; marcada: boolean }>(
    await apiFetch("/api/codificacion/marcar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, marcada }),
    })
  );
}

export type Arquetipo = "auto" | "solitaria" | "pareja-so" | "pareja-sm" | "huerfana" | "adoptada" | "config-so" | "no-aplica";

export function arquetipoOf(p: PreguntaAbierta, adoptedBy?: Map<string, PreguntaAbierta>): Arquetipo {
  if (p.status === "no-aplica") return "no-aplica";
  if (p.tipo === "integer") return "auto";
  if (p.tipo === "select_multiple") return "pareja-sm";
  if (p.tipo === "select_one") {
    if (p.modo_so === "padre" || p.modo_so === "hijo") return "pareja-so";
    if (p.candidatos_texto && p.candidatos_texto.length > 0) return "pareja-so";
    return "config-so";
  }
  if (p.tipo === "text") {
    // If this text column has been adopted by an SO/SM parent, it's no
    // longer orphan — it's officially a child. Check via reverse lookup.
    const col = p.col_efectiva || p.parent;
    if (adoptedBy && adoptedBy.has(col)) return "adoptada";
    if (/_(otros?|especifique|detail|desc(ripcion)?)$/i.test(p.parent)) return "huerfana";
    return "solitaria";
  }
  return "solitaria";
}

// Infer dummy_col for an SM from its opciones: prefer the option flagged
// es_otros_sugerido. In normalized ODK data this can be a virtual pN/code
// marker backed by the parent column instead of a physical dummy column.
export function guessDummyColFromOpciones(opciones: OpcionSM[] | undefined): string {
  if (!opciones || opciones.length === 0) return "";
  const sugerida = opciones.find((o) => o.es_otros_sugerido && o.col_dummy);
  return sugerida?.col_dummy ?? "";
}

export async function apiCodifPreguntasAbiertas(base?: string) {
  const query = base ? `?base=${encodeURIComponent(base)}` : "";
  return handle<{ ok: true; preguntas: PreguntaAbierta[] }>(
    await apiFetch(`/api/codificacion/preguntas-abiertas${query}`, { headers: headers() })
  );
}

export async function apiCodifPareja(
  parent: string,
  child_col: string,
  modo_so?: "padre" | "hijo",
  dummy_col?: string,
  opts?: { clear_dummy?: boolean },
) {
  return handle<{ ok: true; parent: string; child_col: string; modo_so: string; dummy_col: string }>(
    await apiFetch("/api/codificacion/pareja", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, child_col, modo_so, dummy_col, clear_dummy: opts?.clear_dummy }),
    })
  );
}

// ---------- Codificación: agrupamiento de respuestas ----------

export type RespuestaUnica = {
  texto_normalizado: string;
  texto: string;
  label?: string; // Human label from inst$choices when SO/SM
  variantes: number;
  frecuencia: number;
  uuids: string[];
};

// Reglas de rango para preguntas numéricas. Siempre rangos, nunca valores
// sueltos. Tres formas con lenguaje humano:
//   between — "de X a Y" (ambos inclusive; ambos obligatorios)
//   gte     — "X o más" (mínimo inclusive, sin tope superior)
//   lte     — "X o menos" (máximo inclusive, sin tope inferior)
// Si un valor requerido está ausente, la regla no cubre nada (no hay
// "sin límite implícito": una regla incompleta es una regla no confirmada).
export type ReglaIntegerBetween = { tipo: "between"; min: number | null; max: number | null };
export type ReglaIntegerGte = { tipo: "gte"; value: number | null };
export type ReglaIntegerLte = { tipo: "lte"; value: number | null };
export type ReglaInteger = ReglaIntegerBetween | ReglaIntegerGte | ReglaIntegerLte;

// Backwards compat type alias (not used by new code but kept for legacy grupos)
export type ReglaIntegerRango = ReglaIntegerBetween;

export type Grupo = {
  id: string;
  codigo: string;
  etiqueta: string;
  respuestas: string[]; // texto_normalizado. Para integer con regla, lo
                        // calcula el cliente como preview (cubre X valores)
                        // y el backend usa este campo para status.
  regla?: ReglaInteger; // Solo para integer. Cuando existe, respuestas se
                        // computa desde la regla en el frontend.
  origen?: "existente" | "nuevo"; // "existente" = viene del choice list
                                  // original (read-only código/etiqueta).
                                  // "nuevo" = creado por el analista.
};

export type OpcionExistente = { codigo: string; etiqueta: string };

export type RespuestasResponse = {
  ok: true;
  parent: string;
  parent_label?: string;
  col_efectiva: string;
  tipo: string;
  modo_so: string;
  respuestas: RespuestaUnica[];
  grupos: Grupo[];
  opciones_existentes?: OpcionExistente[];
  // Stats del dummy "Otros" para SM: cuántas personas marcaron la opción
  // "Otros, especifique" en total (dummy=1). Permite mostrar un contador
  // "X otros marcados" vs "Y con texto libre" en el codificador.
  sm_otros?: {
    dummy_col: string;
    n_otros_marcados: number;
  } | null;
};

export async function apiCodifRespuestas(parent: string) {
  return handle<RespuestasResponse>(
    await apiFetch(`/api/codificacion/respuestas?parent=${encodeURIComponent(parent)}`, { headers: headers() })
  );
}

export async function apiCodifGrupos(parent: string, grupos: Grupo[]) {
  return handle<{ ok: true; parent: string; n_grupos: number; n_codificadas: number; updated_at: string }>(
    await apiFetch("/api/codificacion/grupos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parent, grupos }),
    })
  );
}

export async function apiCodifDesemparejar(parent: string) {
  return handle<{ ok: true; parent: string }>(
    await apiFetch(`/api/codificacion/pareja?parent=${encodeURIComponent(parent)}`, {
      method: "DELETE",
      headers: headers(),
    })
  );
}

export type CodigosSheetMeta = { name: string; tipo: string; n: number };

export type CodigosColRole = "id" | "ref" | "recod" | "control" | "aux" | "computed" | "pad";

export type CodigosColMeta = { name: string; role: CodigosColRole };

export type CodigosSheetResponse = {
  ok: true;
  name: string;
  tech_row: string[];
  label_row: string[];
  rows: string[][];
  col_meta: CodigosColMeta[];
};

export type CodigoPatch = { row: number; col_index: number; value: string };

export async function apiCodifPlantillaCodigosGenerar() {
  return handle<{ ok: true; file_id: string; size: number; sheets: CodigosSheetMeta[] }>(
    await apiFetch("/api/codificacion/plantilla-codigos/generar", { method: "POST", headers: headers() })
  );
}

export async function apiCodifCodigosSheets() {
  return handle<{ ok: true; sheets: CodigosSheetMeta[] }>(
    await apiFetch("/api/codificacion/codigos/sheets", { headers: headers() })
  );
}

export async function apiCodifCodigosSheet(name: string) {
  return handle<CodigosSheetResponse>(
    await apiFetch(`/api/codificacion/codigos/sheet?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

export async function apiCodifCodigosPatches(name: string, patches: CodigoPatch[]) {
  return handle<{ ok: true; applied: number; updated_at: string }>(
    await apiFetch("/api/codificacion/codigos/sheet/patches", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, patches }),
    })
  );
}

export async function apiCodifPlantillaFamilias() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/codificacion/plantilla-familias", { method: "POST", headers: headers() })
  );
}

export async function apiCodifFamiliasAplicar(file_id: string) {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/codificacion/familias/aplicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

export async function apiCodifPlantillaCodigosSubir(file_id: string) {
  return handle<{ ok: true; original_name: string; size: number }>(
    await apiFetch("/api/codificacion/plantilla-codigos/subir", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    })
  );
}

// ---------- Analítica ----------

// Config es opaca a nivel API — el frontend define el schema (store.ts) y
// el backend solo la persiste como kv. `unknown` acá evita duplicar la
// definición; los panes la tipan con `AnaliticaConfig` via import directo.
export async function apiAnaliticaConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await apiFetch("/api/analitica/config", { headers: headers() })
  );
}

export async function apiAnaliticaConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/analitica/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiAnaliticaConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await apiFetch("/api/analitica/config/export", { headers: headers() })
  );
}

export async function apiAnaliticaConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await apiFetch("/api/analitica/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(bundle),
    })
  );
}

export async function apiAnaliticaPreparar() {
  return handle<{ ok: true; fuente: string; n_filas: number; n_columnas: number }>(
    await apiFetch("/api/analitica/preparar", { method: "POST", headers: headers() })
  );
}

export type SeccionDetectada = {
  id: string;
  nombre: string;
  variables: string[];
  oculto: boolean;
  orden: number;
};

export async function apiAnaliticaDetectSecciones() {
  return handle<{ ok: true; secciones: SeccionDetectada[] }>(
    await apiFetch("/api/analitica/detect-secciones", { method: "POST", headers: headers() })
  );
}

export type VariableInstrumento = {
  name: string;
  label: string;
  tipo: string;
  list_name: string;
  categorica?: boolean;
  numerica?: boolean;
  declarada_numerica?: boolean;
  analisis?: boolean;
};

export async function apiAnaliticaVariables() {
  return handle<{ ok: true; variables: VariableInstrumento[] }>(
    await apiFetch("/api/analitica/variables", { headers: headers() })
  );
}

export type DataReviewOption = {
  code: string;
  label: string;
  count: number;
};

export type DataReviewVariable = {
  name: string;
  tipo_xlsform: string;
  seccion: string;
  included: boolean;
  label_actual: string;
  label_original: string;
  n_non_missing: number;
  n_missing: number;
  opciones: DataReviewOption[];
  dummy_parent?: string | null;
  dummy_parent_label?: string | null;
  dummy_option_code?: string | null;
  dummy_option_label?: string | null;
};

export async function apiAnaliticaDataReview() {
  return handle<{ ok: true; variables: DataReviewVariable[] }>(
    await apiFetch("/api/analitica/data-review", { headers: headers() })
  );
}

export async function apiAnaliticaBaseSheet(opts: ProcessingSheetRequest = {}) {
  return handle<ProcessingSheetPayload>(
    await apiFetch("/api/analitica/base-sheet", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export type ValorColumna = { value: string; label: string };

export async function apiAnaliticaColumnValues(name: string) {
  return handle<{ ok: true; column: string; n_total: number; truncated: boolean; values: ValorColumna[] }>(
    await apiFetch(`/api/analitica/column-values?name=${encodeURIComponent(name)}`, { headers: headers() })
  );
}

// Respuesta de reporte multi-base (v0.2+):
//   - Single base (n_bases=1): `file_id` directo al archivo.
//   - Multi (n_bases>1): `zip` al zip agregador + `bases[]` con file_id
//     individual de cada archivo para descarga suelta.
// Los campos `file_id` / `size` legacy a nivel top se mantienen vacíos
// en multi — el frontend debe mirar `zip` y `bases`.
export type BasePerOutput = {
  nombre: string;
  file_id?: string;
  filename: string;
  size: number;
  // Para bases/sav con sps: puede no tener file_id si viene del worker
  // de sav (los archivos individuales solo se registran en el zip).
  sav?: string;
  sps?: string | null;
  // Para enumeradores: bases skipped por falta de col_enumerador.
  skipped?: boolean;
  reason?: string;
};

export type MultiBaseResult = {
  ok: true;
  n_bases: number;
  fuente?: string;
  // Single-base
  file_id?: string;
  filename?: string;
  size?: number;
  // Multi-base
  zip?: { file_id: string; filename: string; size: number };
  bases?: BasePerOutput[];
  xlsform?: MultiBaseResult;
  unified?: {
    alias_var: string;
    origin_id_var?: string;
    unique_id_var?: string;
    n_filas: number;
    n_columnas: number;
    n_variables_comunes: number;
    n_variables_no_comunes: number;
  };
};

export async function apiAnaliticaCodebook() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/codebook", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaFrecuencias() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/frecuencias", { method: "POST", headers: headers() })
  );
}

export type AnaliticaMultibaseKey = {
  value: string;
  label: string;
  n: number;
};

export async function apiAnaliticaMultibaseInfo() {
  return handle<{
    ok: true;
    available: boolean;
    reason?: string;
    base_name?: string;
    origin_key_name?: string;
    keys?: AnaliticaMultibaseKey[];
    n_keys?: number;
    has_metadata?: boolean;
  }>(
    await apiFetch("/api/analitica/multibase/info", { headers: headers() })
  );
}

export async function apiAnaliticaMultibaseTablas() {
  return handle<JobStart>(
    await apiFetch("/api/analitica/multibase/tablas", { method: "POST", headers: headers() })
  );
}

export type AnaliticaFichaTecnicaField = {
  key: string;
  label: string;
  group: string;
  hint?: string;
  min_lines?: number;
  value?: string;
  suggested?: string;
  has_suggestion?: boolean;
};

export type AnaliticaFichaTecnicaKpi = {
  label: string;
  value: string;
  source: string;
  detail?: string;
};

export type AnaliticaFichaTecnicaSource = {
  key: string;
  label: string;
  available: boolean;
  detail?: string;
};

export type AnaliticaFichaTecnicaInfo = {
  ok: true;
  fields: AnaliticaFichaTecnicaField[];
  kpis: AnaliticaFichaTecnicaKpi[];
  sources: AnaliticaFichaTecnicaSource[];
  tables?: {
    subtables?: string[];
    appendices?: string[];
  };
  layout?: "pulso_oficial" | "template" | "simple" | string;
};

export async function apiAnaliticaFichaTecnicaInfo() {
  return handle<AnaliticaFichaTecnicaInfo>(
    await apiFetch("/api/analitica/ficha-tecnica/info", { headers: headers() })
  );
}

export async function apiAnaliticaFichaTecnicaExport(ficha_tecnica?: Record<string, unknown>) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/ficha-tecnica/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ficha_tecnica }),
    })
  );
}

export type AnaliticaPanelWaveConfig = {
  base: string;
  label?: string;
  suffix?: string;
  order?: number;
};

export type AnaliticaPanelConfig = {
  key?: string;
  waves?: AnaliticaPanelWaveConfig[];
  nse?: {
    enabled?: boolean;
    variables?: string[];
  };
  outputs?: {
    codebook?: boolean;
    frecuencias?: boolean;
    cruces?: boolean;
    auditoria?: boolean;
    cobertura_nse?: boolean;
  };
  formatos?: {
    sav?: BasesSavBody;
    csv?: BasesCsvBody;
    xlsx?: BasesXlsxBody;
  };
};

export type AnaliticaPanelCandidate = {
  name: string;
  normalized?: string;
  recommended?: boolean;
  present_bases: number;
  per_base?: Array<{
    base: string;
    present: boolean;
    n: number;
    non_missing: number;
    unique: number;
    duplicates: number;
  }>;
};

export type AnaliticaPanelWaveInfo = {
  base: string;
  label: string;
  suffix: string;
  order: number;
  n_filas: number;
  n_columnas?: number;
  n_llaves: number;
  n_llaves_duplicadas: number;
  n_llaves_vacias: number;
};

export type AnaliticaPanelSummary = {
  ok: boolean;
  available: boolean;
  key: string;
  n_bases: number;
  n_panel_keys: number;
  n_complete_keys: number;
  n_incomplete_keys: number;
  n_duplicate_keys: number;
  n_audit_rows: number;
  nse_detected: boolean;
  waves: AnaliticaPanelWaveInfo[];
};

export type AnaliticaPanelNseCoverage = {
  variable_nse: string;
  casos_con_nse: number;
  casos_sin_data: number;
  casos_vacios: number;
  cobertura: number;
  observacion: string;
};

export type AnaliticaPanelInfo = {
  ok: true;
  available: boolean;
  reason?: string;
  key?: string;
  candidates?: AnaliticaPanelCandidate[];
  waves?: AnaliticaPanelWaveInfo[];
  summary?: AnaliticaPanelSummary;
  n_bases?: number;
  fuente?: string;
};

export async function apiAnaliticaPanelInfo() {
  return handle<AnaliticaPanelInfo>(
    await apiFetch("/api/analitica/panel/info", { headers: headers() })
  );
}

export async function apiAnaliticaPanelPreview(config?: AnaliticaPanelConfig, rows = 25) {
  return handle<{
    ok: true;
    summary: AnaliticaPanelSummary;
    preview: Record<string, unknown>[];
    audit_preview: Record<string, unknown>[];
    cobertura_nse: AnaliticaPanelNseCoverage[];
    columns: string[];
  }>(
    await apiFetch("/api/analitica/panel/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, rows }),
    })
  );
}

export type AnaliticaPanelExportOptions = {
  formato?: "paquete" | "xlsx" | "csv" | "sav" | "libro_codigos" | "frecuencias" | "cruces" | "auditoria";
  valores?: "codigos" | "etiquetas" | "ambos";
  separador?: "," | ";";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  incluir_sps?: boolean;
};

export async function apiAnaliticaPanelExport(
  config?: AnaliticaPanelConfig,
  options: AnaliticaPanelExportOptions = {},
) {
  return handle<JobStart>(
    await apiFetch("/api/analitica/panel/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, options }),
    })
  );
}

export async function apiAnaliticaPanelFichaTecnica(config?: AnaliticaPanelConfig) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/panel/ficha-tecnica", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

// El backend lee `cruces_vars`, modo, show_sig, etc. del config autosaveado.
// `cruces` y `modo` quedan opcionales para backcompat con tests manuales.
export async function apiAnaliticaCruces(cruces?: string, modo?: "estandar" | "dimensiones") {
  return handle<JobStart>(
    await apiFetch("/api/analitica/cruces", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cruces ? { cruces, modo: modo ?? "estandar" } : {}),
    })
  );
}

// /api/analitica/spss (alias legacy): zip con .sav + niveles_medida.sps. Hoy
// sincrónico, ya no devuelve JobStart. Los panes modernos deben usar los
// endpoints /bases/{sav,csv,xlsx} directos. Se mantiene solo para integraciones
// externas antiguas.
export async function apiAnaliticaSpss() {
  return handle<{ ok: true; file_id: string; size: number }>(
    await apiFetch("/api/analitica/spss", { method: "POST", headers: headers() })
  );
}

// ----- Bases (Analítica · Fase 4) -----
// Los 3 formatos corren sincrónicos (datasets de encuesta son pequeños;
// no merece la pena callr). Cada uno acepta un body JSON con su
// sub-config.

export type BasesSavBody = {
  incluir_sps?: boolean;
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
};
export type BasesCsvBody = {
  valores?: "codigos" | "etiquetas";
  separador?: "," | ";";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
};
export type BasesXlsxBody = {
  valores?: "codigos" | "etiquetas" | "ambos";
  multi_select?: "codigos_crudos" | "etiquetas_unidas" | "dummy_01";
  omitir_identificadores_directos?: boolean;
  omitir_metadatos_operativos?: boolean;
};

export async function apiAnaliticaBasesData() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/data", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaBasesInstrumento() {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/instrumento", { method: "POST", headers: headers() })
  );
}

export async function apiAnaliticaBasesSav(body: BasesSavBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/sav", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesCsv(body: BasesCsvBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/csv", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesXlsx(body: BasesXlsxBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/xlsx", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiAnaliticaBasesXlsxUnificada(body: BasesXlsxBody = {}) {
  return handle<MultiBaseResult>(
    await apiFetch("/api/analitica/bases/xlsx-unificada", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

// Metadatos SPSS inferidos por variable (para el editor de BasesPane).
// El backend devuelve la inferencia + los overrides ya aplicados en
// session. La UI usa ambos para el display: si hay override lo muestra
// con badge "editado", sino muestra la inferencia.
export type MeasureSpss = "nominal" | "ordinal" | "scale";

export type BasesMetadataVariable = {
  name: string;
  label: string;
  tipo_xlsform: string | null;
  inferred_measure: MeasureSpss;
  inferred_format_spss: string;  // "auto" significa que el escritor SAV lo infiere al exportar
  has_labels: boolean;
};

export type BasesMetadataOverride = {
  measure?: MeasureSpss;
  format_spss?: string;
};

export type BasesSavWriterInfo = {
  engine: "pyreadstat" | "haven";
  ok: boolean;
  python?: string | null;
  fallback?: boolean;
  message?: string;
};

export async function apiAnaliticaBasesMetadata() {
  return handle<{
    ok: true;
    variables: BasesMetadataVariable[];
    overrides: Record<string, BasesMetadataOverride>;
    sav_writer?: BasesSavWriterInfo;
  }>(
    await apiFetch("/api/analitica/bases/metadata", { headers: headers() })
  );
}

// ---------- Gráficos (PPT/Word) ----------
//
// El registry backend es ahora un catálogo RICO con copy humano, tipos
// de input por arg, agrupación semántica y choices. La UI construye todo
// el editor dinámicamente a partir de este metadata.
// La fuente de verdad vive en `api/R/graficos_metadata.R`.

// Nombres canónicos de los tipos de slide en prosecnur (en español).
// Reemplaza los nombres viejos en inglés (p_slide_title, p_slide_1, etc.).
export type SlideType =
  // Estructurales (sin slots de gráfico)
  | "p_slide_portada"
  | "p_slide_indice"
  | "p_slide_seccion"
  | "p_slide_objetivo_icono"
  | "p_slide_texto"
  | "p_slide_tabla_tecnica"
  | "p_slide_top_two_box"
  // 1 gráfico
  | "p_slide_1_grafico"
  | "p_slide_1_grafico_narrativo"
  | "p_slide_grafico_texto_derecha"
  | "p_slide_grafico_texto_izquierda"
  // 2 gráficos
  | "p_slide_2_graficos"
  | "p_slide_2_graficos_narrativo"
  | "p_slide_2_graficos_texto_izquierda"
  | "p_slide_2_graficos_texto_derecha"
  // Grid 4
  | "p_slide_4_graficos"
  // Población (con ícono central)
  | "p_slide_2_graficos_poblacion"
  | "p_slide_4_graficos_poblacion"
  | "p_slide_5_graficos_poblacion"
  | "p_slide_6_graficos_poblacion";

export type SlideCategoria =
  | "estructural"
  | "1grafico"
  | "2graficos"
  | "4graficos"
  | "poblacion"
  | "otro";

export type GraficadorRef = {
  graficador: string;
  args: Record<string, unknown>;
};

export type SlidePayload = Record<string, unknown>;

export type Slide = {
  id: string;
  tipo: SlideType;
  payload: SlidePayload;
};

export type PlanJson = {
  slides: Slide[];
};

// Tipos de input que el editor reconoce. Cada `tipo_input` mapea a un
// control UI específico en GraficadorForm/SlideEditor.
export type ArgTipoInput =
  | "variable"
  | "variable_opt"
  | "variables_list"
  | "string"
  | "textarea"
  | "number"
  | "bool"
  | "choice"
  | "codigos_list"
  // multiflag: multi-select de tokens con opciones cerradas.
  // El valor es un array de strings (mismos value que en `opciones`).
  // Ej. textos_negrita = c("titulo", "leyenda"). Se renderiza como
  // chips toggleables — ni texto libre ni radio exclusivo.
  | "multiflag"
  // color: picker de color (swatch + hex + popover con paletas del
  // estudio y presets comunes). Acepta hex (#RRGGBB / #RGB) o
  // keywords CSS (white, black, transparent). Se renderiza con
  // <input type="color"> nativo como fallback al popover custom.
  | "color"
  // series_colors: editor visual de pares serie → color. El valor viaja
  // como objeto nombrado { "Serie": "#RRGGBB" }, sin edición JSON.
  | "series_colors"
  // criteria_config: editor visual de criterios/conductores, cada uno
  // con titulo y variables asociadas.
  | "criteria_config"
  | "icono"
  | "overrides"
  | "filtros"
  | "base_config"
  | "meta";

export type ArgGrupo =
  | "datos"
  | "lectura"
  | "valores"
  | "leyenda"
  | "espacio"
  | "diagnostico"
  | "textos"
  | "estilo"
  | "filtro"
  | "semaforo"
  | "canvas"   // dimensiones del canvas interno (canvas_w_*, canvas_h_*,
               // alto_por_categoria…) — concentra ~10 args por preset que
               // antes iban a "avanzado" y lo saturaban.
  | "tabla"    // específico de radar_tabla: todo lo que afecta la tabla
               // derecha (tabla_header_fill, tabla_body_size, …).
  | "avanzado";

export type ArgChoice = {
  value: string;
  label: string;
  hint?: string;
};

export type ArgMetadata = {
  name: string;
  label: string;
  tipo_input: ArgTipoInput;
  grupo: ArgGrupo;
  descripcion?: string;
  unidad?: string;
  min?: number;
  max?: number;
  step?: number;
  control?: "stepper" | "slider" | string;
  relacionados?: string[];
  efecto?: string;
  choices?: ArgChoice[];
  // Opciones para `multiflag` (multi-select cerrado). Cada entry define
  // un token aceptable. Si el arg es `multiflag` y `opciones` no viene,
  // el UI lo degrada a texto libre como fallback de compat.
  opciones?: ArgChoice[];
  // Valor por defecto documentado en el registry. Puede ser string/number/
  // bool. Usado por el PresetsEditor como placeholder visual.
  default?: unknown;
};

export type SlideMetadata = {
  name: SlideType;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  categoria: SlideCategoria;
  slots: string[];
  args: ArgMetadata[];
  // args del formals() de la función R que no están en el catálogo curado
  // (el backend los usa con defaults; el frontend normalmente no los expone)
  args_extra: string[];
};

export type GraficadorMetadata = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  // "dimensiones" indica que requiere reporte_dimensiones() ejecutado primero
  requisito?: string;
  feature_kind?: string;
  available?: boolean;
  disabled_reason?: string;
  args: ArgMetadata[];
  args_extra: string[];
};

export type Registry = {
  slides: SlideMetadata[];
  graficadores: GraficadorMetadata[];
};

export type VarInfo = {
  name: string;
  label: string;
  tipo: string;
  seccion: string;
  list_name?: string;
  choices?: { name: string; label: string }[];
  scale_signature?: string;
  graphable?: boolean;
  exclusion_reason?: string;
  is_recoded?: boolean;
  raw_parent?: string | null;
  preferred_variable?: string | null;
  covered_by?: string | null;
  integrated_in?: string | null;
  is_preferred?: boolean;
  data_available?: boolean;
  n_non_empty?: number;
  source_kind?: string;
  group_path?: string;
  section_reliable?: boolean;
  status?: string;
  coverage_countable?: boolean;
};

export async function apiGraficosRegistry() {
  return handle<Registry>(await apiFetch("/api/graficos/registry", { headers: headers() }));
}

// Metadata de los presets globales (p_presets). Cada entrada es un tipo
// (base, barras_apiladas, pie, dim_radar, …) con args curados para el
// PresetsEditor. Complementa a /registry (que cubre slides y graficadores,
// no presets globales).
export type PresetMetadata = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  args: ArgMetadata[];
};

export type PresetsRegistry = {
  presets: PresetMetadata[];
};

export async function apiGraficosPresetsMetadata() {
  return handle<PresetsRegistry>(
    await apiFetch("/api/graficos/presets-metadata", { headers: headers() })
  );
}

// "Guardar como default" / "Restaurar fábrica" para los presets.
//
// El backend mantiene dos niveles de default:
//   1. factory: `.PRESETS_DEFAULT_PULSO` (hardcoded, del QMD).
//   2. user: lo que el analista guardó con POST /presets-defaults.
// El `apiGraficosConfigGet` inicial usa (2) si existe, sino (1).

export async function apiGraficosPresetsDefaultsGet() {
  return handle<{ ok: true; presets: Record<string, Record<string, unknown>>; es_custom: boolean }>(
    await apiFetch("/api/graficos/presets-defaults", { headers: headers() })
  );
}

export async function apiGraficosPresetsDefaultsSave(presets?: Record<string, Record<string, unknown>>) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/presets-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(presets ? { presets } : {}),
    })
  );
}

export async function apiGraficosPresetsDefaultsReset() {
  return handle<{ ok: true }>(
    await apiFetch("/api/graficos/presets-defaults", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Overrides defaults — mismo contrato que presets defaults, pero para
// la lista de overrides reusables que arrancan en cualquier estudio
// nuevo. El shape es un array (no un record) porque los overrides
// tienen id propio y pueden duplicarse por `tipo_preset`.
export type OverrideDefaultEntry = {
  id: string;
  nombre: string;
  tipo_preset: string;
  args: Record<string, unknown>;
};

export async function apiGraficosOverridesDefaultsGet() {
  return handle<{ ok: true; overrides: OverrideDefaultEntry[]; es_custom: boolean }>(
    await apiFetch("/api/graficos/overrides-defaults", { headers: headers() })
  );
}

export async function apiGraficosOverridesDefaultsSave(overrides?: OverrideDefaultEntry[]) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/overrides-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(overrides ? { overrides } : {}),
    })
  );
}

export async function apiGraficosOverridesDefaultsReset() {
  return handle<{ ok: true }>(
    await apiFetch("/api/graficos/overrides-defaults", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Templates de plan (planes pre-armados). Lo trae el backend como
// JSON plano; los ids de los slides son placeholders que el frontend
// regenera al aplicar el template para evitar colisiones.
export type TemplateMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  n_slides: number;
  plan: PlanJson;
};

export async function apiGraficosTemplates() {
  return handle<{ templates: TemplateMeta[] }>(
    await apiFetch("/api/graficos/templates", { headers: headers() })
  );
}

// Perfiles visuales de presentación. No modifican el plan de slides:
// aplican presets PPT, paletas, overrides y reglas de alcance al estado actual.
export type PptStyleProfileMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  preview_colors: string[];
  presets: Record<string, Record<string, unknown>>;
  paletas?: Record<string, Record<string, string>>;
  overrides_reusables?: OverrideDefaultEntry[];
  scope_rules?: Record<string, unknown>;
};

export async function apiGraficosPptStyleProfiles() {
  return handle<{ style_profiles: PptStyleProfileMeta[] }>(
    await apiFetch("/api/graficos/ppt-style-profiles", { headers: headers() })
  );
}

// Config persistida del plan de gráficos. Patrón idéntico a /analitica/config.
// Autosave debounced 2s vía `useGraficosAutosave`. Export/import como respaldo.
export async function apiGraficosConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await apiFetch("/api/graficos/config", { headers: headers() })
  );
}

export async function apiGraficosConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiGraficosConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await apiFetch("/api/graficos/config/export", { headers: headers() })
  );
}

export async function apiGraficosConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await apiFetch("/api/graficos/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(normalizeGraficosConfigBundle(bundle, { includeLegacyAliases: true })),
    })
  );
}

export type GraficosShareMissingVariable = {
  code: string;
  label: string;
};

export type GraficosShareSkippedSlide = {
  slide_id: string;
  slide_title: string;
  tipo: string;
  missing_variables: GraficosShareMissingVariable[];
};

export type GraficosShareAffectedSlide = GraficosShareSkippedSlide;

export type GraficosShareBasePlan = {
  base_name: string;
  base_label?: string;
  action: "replace_graficos_plan" | string;
  selected_default: boolean;
  blocking: boolean;
  current: {
    n_slides: number;
    xlsform?: string;
    data?: string;
  };
  incoming: {
    n_slides_total: number;
    n_slides_applicable: number;
    n_slides_skipped: number;
  };
  impact: {
    variables_expected: number;
    variables_available: number;
    variables_missing: number;
    missing_variables: GraficosShareMissingVariable[];
    skipped_slides: GraficosShareSkippedSlide[];
    affected_slides: GraficosShareAffectedSlide[];
    effects: string[];
  };
  warnings: string[];
};

export type GraficosShareInspectResult = {
  ok: true;
  package_file_id: string;
  filename: string;
  manifest: {
    version: string;
    source_project_name: string;
    source_active_base?: string;
    created_at: string;
    n_slides: number;
    n_assets: number;
  };
  summary: {
    n_bases: number;
    n_compatible: number;
    n_blocking: number;
    n_warnings: number;
  };
  default_selected_bases: string[];
  bases: GraficosShareBasePlan[];
};

export type GraficosShareExportResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  exported_at: string;
};

export type GraficosShareImportResult = {
  ok: true;
  imported_at: string;
  applied_bases: Array<{
    base_name: string;
    n_slides_applicable: number;
    n_slides_skipped: number;
    missing_variables: GraficosShareMissingVariable[];
    skipped_slides: GraficosShareSkippedSlide[];
    affected_slides: GraficosShareAffectedSlide[];
  }>;
  inspection: GraficosShareInspectResult;
};

function normalizeShareArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeGraficosShareSlideWarnings(value: unknown): GraficosShareAffectedSlide[] {
  return normalizeShareArray<any>(value).map((slide) => ({
    slide_id: String(slide.slide_id ?? ""),
    slide_title: String(slide.slide_title ?? "Slide"),
    tipo: String(slide.tipo ?? ""),
    missing_variables: normalizeShareArray<any>(slide.missing_variables).map((v) => ({
      code: String(v.code ?? ""),
      label: String(v.label ?? v.code ?? ""),
    })),
  }));
}

function normalizeGraficosShareInspect(raw: any): GraficosShareInspectResult {
  const bases = normalizeShareArray<any>(raw.bases).map((base): GraficosShareBasePlan => ({
    base_name: String(base.base_name ?? ""),
    base_label: base.base_label == null ? undefined : String(base.base_label),
    action: String(base.action ?? "replace_graficos_plan"),
    selected_default: Boolean(base.selected_default),
    blocking: Boolean(base.blocking),
    current: {
      n_slides: Number(base.current?.n_slides ?? 0),
      xlsform: base.current?.xlsform == null ? undefined : String(base.current.xlsform),
      data: base.current?.data == null ? undefined : String(base.current.data),
    },
    incoming: {
      n_slides_total: Number(base.incoming?.n_slides_total ?? 0),
      n_slides_applicable: Number(base.incoming?.n_slides_applicable ?? 0),
      n_slides_skipped: Number(base.incoming?.n_slides_skipped ?? 0),
    },
    impact: {
      variables_expected: Number(base.impact?.variables_expected ?? 0),
      variables_available: Number(base.impact?.variables_available ?? 0),
      variables_missing: Number(base.impact?.variables_missing ?? 0),
      missing_variables: normalizeShareArray<any>(base.impact?.missing_variables).map((v) => ({
        code: String(v.code ?? ""),
        label: String(v.label ?? v.code ?? ""),
      })),
      skipped_slides: normalizeGraficosShareSlideWarnings(base.impact?.skipped_slides),
      affected_slides: normalizeGraficosShareSlideWarnings(base.impact?.affected_slides),
      effects: normalizeShareArray<any>(base.impact?.effects).map(String),
    },
    warnings: normalizeShareArray<any>(base.warnings).map(String),
  }));

  return {
    ok: true,
    package_file_id: String(raw.package_file_id ?? ""),
    filename: String(raw.filename ?? ""),
    manifest: {
      version: String(raw.manifest?.version ?? ""),
      source_project_name: String(raw.manifest?.source_project_name ?? ""),
      source_active_base: raw.manifest?.source_active_base == null ? undefined : String(raw.manifest.source_active_base),
      created_at: String(raw.manifest?.created_at ?? ""),
      n_slides: Number(raw.manifest?.n_slides ?? 0),
      n_assets: Number(raw.manifest?.n_assets ?? 0),
    },
    summary: {
      n_bases: Number(raw.summary?.n_bases ?? bases.length),
      n_compatible: Number(raw.summary?.n_compatible ?? bases.filter((b) => !b.blocking).length),
      n_blocking: Number(raw.summary?.n_blocking ?? bases.filter((b) => b.blocking).length),
      n_warnings: Number(raw.summary?.n_warnings ?? 0),
    },
    default_selected_bases: normalizeShareArray<any>(raw.default_selected_bases).map(String),
    bases,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function apiGraficosShareExport() {
  return handle<GraficosShareExportResult>(
    await apiFetch("/api/graficos/share/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    })
  );
}

export async function apiGraficosShareInspect(input: File | { file_id?: string; filename?: string; data_base64?: string }) {
  const payload = typeof File !== "undefined" && input instanceof File
    ? { filename: input.name, data_base64: await fileToBase64(input) }
    : input;
  const raw = await handle<any>(
    await apiFetch("/api/graficos/share/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    })
  );
  return normalizeGraficosShareInspect(raw);
}

export async function apiGraficosShareImport(packageFileId: string, selectedBases: string[]) {
  const raw = await handle<any>(
    await apiFetch("/api/graficos/share/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ package_file_id: packageFileId, selected_bases: selectedBases }),
    })
  );
  return {
    ok: true,
    imported_at: String(raw.imported_at ?? ""),
    applied_bases: normalizeShareArray<any>(raw.applied_bases).map((base) => ({
      base_name: String(base.base_name ?? ""),
      n_slides_applicable: Number(base.n_slides_applicable ?? 0),
      n_slides_skipped: Number(base.n_slides_skipped ?? 0),
      missing_variables: normalizeShareArray<any>(base.missing_variables).map((v) => ({
        code: String(v.code ?? ""),
        label: String(v.label ?? v.code ?? ""),
      })),
      skipped_slides: normalizeGraficosShareSlideWarnings(base.skipped_slides),
      affected_slides: normalizeGraficosShareSlideWarnings(base.affected_slides),
    })),
    inspection: normalizeGraficosShareInspect(raw.inspection ?? {}),
  } as GraficosShareImportResult;
}

// Paletas sugeridas: el backend devuelve las listas de choices del
// instrumento XLSForm para que la UI pre-pueble el editor de paletas con
// los value-labels reales. El analista asigna colores y el store guarda
// `paletas: { list_name: { label: hex } }`.
export type PaletaChoiceItem = { name: string; label: string };
export type PaletaSugeridaEntry = { list_name: string; choices: PaletaChoiceItem[] };

export async function apiGraficosPaletasSugeridas() {
  return handle<{ listas: PaletaSugeridaEntry[] }>(
    await apiFetch("/api/graficos/paletas-sugeridas", { headers: headers() })
  );
}

// Upload de ícono PNG. El frontend lee el archivo, lo pasa a base64,
// manda POST con `{nombre, data_base64}`. Respuesta: `{id, file_id, nombre}`.
// El store guarda la referencia en `iconos`; el archivo vive en
// `session/$sid/icons/*.png` y se sirve via `downloadUrl(file_id)`.
export type IconoUploadResponse = {
  ok: true;
  id: string;
  file_id: string;
  nombre: string;
  uploaded_at: string;
};

export async function apiGraficosIconoUpload(nombre: string, dataBase64: string) {
  return handle<IconoUploadResponse>(
    await apiFetch("/api/graficos/icons/upload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre, data_base64: dataBase64 }),
    })
  );
}

// Preview de UN slide: genera un mini-PPTX de 1 slide usando el mismo
// pipeline que el export completo. El backend intenta rasterizar ese PPTX
// con un renderer headless; si no hay renderer, mantiene el PPTX interno
// como fallback técnico pero la UI no obliga a descargarlo.
// Imagen PNG embebida en el .pptx del preview — una por slot de
// graficador (prosecnur con `usar_canvas=TRUE` renderiza cada slot como
// un PNG dentro del ZIP). El backend las extrae y devuelve inline como
// data-URL para que el frontend las muestre como <img> sin otra request.
export type PreviewImage = {
  filename: string;           // "image1.png", "image2.png", …
  png_base64: string;          // data:image/png;base64,…
  size: number;
};

export type SlideRenderedPreview = {
  png_base64: string;          // data:image/png;base64,… del slide completo
  width: number | null;
  height: number | null;
  renderer: string;            // "soffice+pdftoppm", "soffice+magick", …
};

export type PreviewSlideOptions = {
  preview_quality?: "quick" | "normal";
  include_images?: boolean;
  render_slide_preview?: boolean;
};

export type PreviewSlideResponse = {
  ok: true;
  file_id: string;             // id interno del mini-PPTX generado
  size: number;
  type: "pptx";
  images: PreviewImage[];      // vacío si el slide no tiene gráficos (ej. portada)
  slide_preview?: SlideRenderedPreview | null;
};

export type GraficosPreviewRendererStatus = {
  ok: true;
  available: boolean;
  renderer: string | null;
  platform: string | null;
  desktop_automation: boolean;
  message: string;
  renderers: Array<{
    id: string;
    available: boolean;
    configured: boolean;
    command?: string | null;
    script?: string | null;
    module?: string | null;
  }>;
};

export type GraficosSlideLayoutPlaceholder = {
  key: string;
  payload_key?: string | null;
  label?: string | null;
  role?: "chart" | "text" | "note" | "icon" | "shape" | string;
  type?: string | null;
  type_idx?: number | null;
  hidden?: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type GraficosSlideLayoutPreview = {
  ok: true;
  tipo: string;
  contract?: string | null;
  layout?: string | null;
  aspectRatio: number;
  source?: "template" | "reference_local" | string;
  reason?: string | null;
  placeholders: GraficosSlideLayoutPlaceholder[];
};

export async function apiGraficosPreviewSlide(
  slide: Slide,
  config?: unknown,
  options?: PreviewSlideOptions
) {
  return handle<PreviewSlideResponse>(
    await apiFetch("/api/graficos/preview-slide", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slide, config, ...options }),
    })
  );
}

export async function apiGraficosPreviewRenderer() {
  return handle<GraficosPreviewRendererStatus>(
    await apiFetch("/api/graficos/preview-renderer", {
      headers: headers(),
    })
  );
}

export async function apiGraficosSlideLayoutPreview(tipo: string) {
  return handle<GraficosSlideLayoutPreview>(
    await apiFetch(`/api/graficos/slide-layout-preview?tipo=${encodeURIComponent(tipo)}`, {
      headers: headers(),
    })
  );
}

// Respuesta del endpoint de variables: agrupada por fuente (multi-base).
// Cuando hay una sola base, `multi` es false y el frontend puede mostrar
// los pickers sin dropdown de fuente.
export type VariablesBySource = {
  sources: { name: string; source_kind?: string; variables: VarInfo[] }[];
  multi: boolean;
  active_base?: string | null;
  processing_mode?: string | null;
};

export async function apiGraficosVariables() {
  return handle<VariablesBySource>(
    await apiFetch("/api/graficos/variables", { headers: headers() })
  );
}

export type GraficosCoverageStatus =
  | "cubierta"
  | "sin_usar"
  | "no_graficable"
  | "cubierta_por_recodificada"
  | "integrada_en_otra_variable"
  | "excluida_intencionalmente"
  | "vacía"
  | string;

export type GraficosCoverageVariable = VarInfo & {
  status: GraficosCoverageStatus;
  coverage_countable?: boolean;
};

export type GraficosCoverageSource = {
  name: string;
  source_kind?: string;
  variables: GraficosCoverageVariable[];
};

export type GraficosCoverageSummary = {
  total_variables: number;
  graphable_variables: number;
  included_graphable: number;
  unused_graphable: number;
  not_graphable: number;
  empty: number;
  covered_by_recod: number;
  integrated: number;
  excluded_intentionally: number;
  included_refs: number;
};

export type GraficosCoverageResponse = {
  ok: true;
  summary: GraficosCoverageSummary;
  sources: GraficosCoverageSource[];
  warnings: string[];
};

export type GraficosSuggestedPlanResponse = {
  ok: true;
  plan: PlanJson;
  coverage: GraficosCoverageResponse;
  warnings: string[];
};

export async function apiGraficosPlanCoverage(plan: PlanJson, config?: unknown) {
  return handle<GraficosCoverageResponse>(
    await apiFetch("/api/graficos/plan/coverage", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, config }),
    })
  );
}

export async function apiGraficosPlanSugerido(config?: unknown) {
  return handle<GraficosSuggestedPlanResponse>(
    await apiFetch("/api/graficos/plan/sugerido", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiGraficosValidar(plan: PlanJson) {
  return handle<{ ok: boolean; errors: string[]; warnings: string[]; n_slides: number }>(
    await apiFetch("/api/graficos/validar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan }),
    })
  );
}

export async function apiGraficosPpt(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>, config?: unknown) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/ppt", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets, config }),
    })
  );
}

export async function apiGraficosWord(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>, config?: unknown) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/word", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets, config }),
    })
  );
}

/** Exporta el PPT de TODAS las bases de un proyecto multi-base en un solo ZIP.
    Usa la config ya guardada por base (no el `plan` que esté abierto en el
    editor); requiere >= 2 bases con datos. */
export async function apiGraficosPptAll() {
  return handle<JobStart>(
    await apiFetch("/api/graficos/ppt-all", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      // El proxy de Vite reenvia POST con Content-Type JSON pero sin body
      // (Content-Length: 0 explicito) de forma distinta a una request
      // directa sin ese header — Plumber responde 400 antes de llegar al
      // handler. Un body explicito evita esa ambiguedad.
      body: JSON.stringify({}),
    })
  );
}

export async function apiAnaliticaEnumeradores(col_enumerador: string) {
  return handle<JobStart>(
    await apiFetch("/api/analitica/enumeradores", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ col_enumerador }),
    })
  );
}

// ---- Dimensiones (tab Analítica → Dimensiones) ---------------------------

export type DimensionesChoice = {
  code: string;
  label: string;
};

export type DimensionesEscalaDetectada = {
  list_name: string;
  n: number;
  vars: string[];
  // Choices del list_name en orden tentativo (numérico cuando aplica,
  // si no alfabético). El usuario reordena en el wizard para fijar la
  // dirección ascendente 0→100.
  choices: DimensionesChoice[];
  // TRUE si esta lista coincide con el whitelist evaluativo estándar
  // (satisfaccion, acuerdo, si_no, …). El wizard usa este flag para
  // pre-marcar automáticamente solo las "típicas" y dejar el resto al
  // usuario.
  es_default_evaluativa: boolean;
};

export type DimensionesBaseExistente =
  | { detected: false }
  | {
      detected: true;
      n_r100: number;
      n_sub: number;
      n_idx: number;
      vars_r100: string[];
      vars_sub: string[];
      vars_idx: string[];
      has_config_attr: boolean;
      has_indices_meta: boolean;
    };

export async function apiAnaliticaDimensionesDetect() {
  return handle<{
    ok: true;
    escalas: DimensionesEscalaDetectada[];
    base_dimensionada: DimensionesBaseExistente;
    listas_objetivo_disponibles: string[];
  }>(await apiFetch("/api/analitica/dimensiones/detect", { headers: headers() }));
}

export async function apiAnaliticaDimensionesBuild() {
  return handle<{
    ok: true;
    n_filas: number;
    n_r100: number;
    n_sub: number;
    n_idx: number;
    vars_idx: string[];
    vars_sub: string[];
  }>(
    await apiFetch("/api/analitica/dimensiones/build", { method: "POST", headers: headers() }),
  );
}

export type DimensionesCobertura = {
  var: string;
  n: number;
  n_validos: number;
  pct_validos: number;
  media: number | null;
  sd: number | null;
};

export async function apiAnaliticaDimensionesPreview() {
  return handle<{
    ok: true;
    preview: {
      filas: Array<Record<string, number | null>>;
      cobertura: DimensionesCobertura[];
      columnas: string[];
    };
  }>(await apiFetch("/api/analitica/dimensiones/preview", { headers: headers() }));
}

export async function apiAnaliticaDimensionesStatus() {
  return handle<{
    ok: true;
    built: boolean;
    n_filas: number;
    n_idx: number;
    n_sub: number;
  }>(await apiFetch("/api/analitica/dimensiones/status", { headers: headers() }));
}

export type BloqueSugerido = {
  nombre: string;
  etiqueta: string;
  vars: string[];
};

export async function apiAnaliticaDimensionesSugerir() {
  return handle<{
    ok: true;
    bloques: BloqueSugerido[];
  }>(await apiFetch("/api/analitica/dimensiones/sugerir", { headers: headers() }));
}

export type ValidacionSubindice = {
  nombre: string;
  etiqueta: string;
  vars_solicitadas: string[];
  vars_ok: string[];
  vars_faltantes: string[];
  ok: boolean;
  n_solicitadas: number;
  n_ok: number;
};

export type ValidacionIndice = {
  nombre: string;
  etiqueta: string;
  subindices_solicitados: string[];
  subindices_ok: string[];
  subindices_faltantes: string[];
  ok: boolean;
};

export type ValidacionSubcriterio = {
  nombre: string;
  // Etiqueta humana del subcriterio (ej. "Diligencia"). Si el JSON no la
  // provee, el backend cae al `nombre` técnico para no devolver vacío.
  etiqueta: string;
  fuente: string[];
  ok: boolean;
  vars_fuente_faltantes: string[];
};

export type ValidacionReporte = {
  listas: { coincidentes: string[]; no_usadas: string[] };
  subindices: ValidacionSubindice[];
  indices: ValidacionIndice[];
  subcriterios: ValidacionSubcriterio[];
  resumen: {
    n_listas_ok: number;
    n_listas_no_usadas: number;
    n_vars_ok: number;
    n_vars_faltantes: number;
    n_subindices_completos: number;
    n_subindices_parciales: number;
    n_indices_completos: number;
    n_indices_parciales: number;
    n_subcriterios_resueltos: number;
    n_subcriterios_incompletos: number;
  };
};

export async function apiAnaliticaDimensionesValidarJson(jsonConfig: unknown) {
  return handle<{ ok: true; reporte: ValidacionReporte }>(
    await apiFetch("/api/analitica/dimensiones/validar-json", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(jsonConfig),
    }),
  );
}

// ---- Dashboard module ----------------------------------------------------
//
// El módulo Dashboard renderiza la estructura definida por el paquete
// legacy `prosecnur::reporte_interactivo()`: pestañas fijas (Resumen,
// Relaciones, Base de datos, Dimensiones opcional). El usuario solo
// twitchea estética (logo, paleta, título, subtítulo) — no toca
// estructura ni contenido. Endpoints en api/R/router_dashboard.R.

export type DashboardTabId = "resumen" | "relaciones" | "base_datos" | "dimensiones";

export type DashboardTabManifest = {
  id: DashboardTabId;
  label: string;
  available: boolean;
  reason: string | null;
};

export type DashboardThemeDefault = {
  color_primario: string;
  color_fondo_app: string;
  color_borde: string;
  color_texto: string;
  color_texto_suave: string;
  color_superficie: string;
  color_superficie_2: string;
  color_header_tabla: string;
};

export type DashboardManifest = {
  tabs: DashboardTabManifest[];
  estado: {
    tiene_data: boolean;
    tiene_dim: boolean;
    n_secciones: number;
    curacion_confirmed: boolean;
  };
};

export async function apiDashboardManifest() {
  return handle<{
    ok: true;
    manifest: DashboardManifest;
    theme_default: DashboardThemeDefault;
  }>(await apiFetch("/api/dashboard/manifest", { headers: headers() }));
}

export type DashboardVarTipo = "so" | "sm" | "otro";
export type DashboardVar = {
  name: string;
  label: string;
  tipo: DashboardVarTipo;
};
export type DashboardSeccion = {
  nombre: string;
  vars: DashboardVar[];
};

export async function apiDashboardSecciones() {
  return handle<{
    ok: true;
    secciones: DashboardSeccion[];
    kpi_vars: string[];
  }>(await apiFetch("/api/dashboard/secciones", { headers: headers() }));
}

export type DashboardCurationVar = {
  name: string;
  label: string;
  raw_type: string;
  tipo: DashboardVarTipo;
  n_unique: number | null;
  default_include: boolean;
  suggested_exclude: boolean;
  reason: string | null;
  excluded: boolean;
};

export type DashboardCurationSection = {
  nombre: string;
  n_vars: number;
  suggested_exclude: boolean;
  reason: string | null;
  excluded: boolean;
  vars: DashboardCurationVar[];
};

export type DashboardCurationPayload = {
  confirmed: boolean;
  exclude_sections: string[];
  exclude_vars: string[];
  secciones: DashboardCurationSection[];
};

export async function apiDashboardCurationGet() {
  return handle<{ ok: true; payload: DashboardCurationPayload }>(
    await apiFetch("/api/dashboard/curacion", { headers: headers() }),
  );
}

export async function apiDashboardCurationPut(payload: {
  exclude_sections: string[];
  exclude_vars: string[];
}) {
  return handle<{ ok: true; curacion: { confirmed: boolean; saved_at: string } }>(
    await apiFetch("/api/dashboard/curacion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type DashboardFiltro = {
  var: string;
  valores: string[];
};

export type DashboardCategoriaValor = { value: string; label: string };

export async function apiDashboardCategoriasVar(varName: string) {
  return handle<{ ok: true; valores: DashboardCategoriaValor[] }>(
    await apiFetch("/api/dashboard/categorias-var", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ var: varName }),
    }),
  );
}

export type DashboardDistSO = {
  code: string;
  label: string;
  n: number;
  pct: number;
  color?: string | null;
};
export type DashboardDistSMOption = {
  code: string;
  label: string;
  col_dummy: string;
  n_yes: number;
  n_total: number;
  pct_yes: number;
  color?: string | null;
};
export type DashboardResumenRow =
  | {
      type: "so";
      var: string;
      label: string;
      list_name?: string | null;
      dist: DashboardDistSO[];
      options: never[];
    }
  | {
      type: "sm";
      var: string;
      label: string;
      list_name?: string | null;
      options: DashboardDistSMOption[];
    };

export type DashboardResumenPayload = {
  seccion: string;
  n_total: number;
  rows: DashboardResumenRow[];
};

export async function apiDashboardResumenSeccion(opts: {
  seccion: string;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardResumenPayload }>(
    await apiFetch("/api/dashboard/resumen/seccion", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        seccion: opts.seccion,
        filtros: opts.filtros ?? [],
      }),
    }),
  );
}

export type DashboardKpi = {
  var: string;
  list_name?: string | null;
  label: string;
  dist: DashboardDistSO[];
};
export type DashboardKpisPayload = {
  n_total: number;
  kpis: DashboardKpi[];
};

export async function apiDashboardResumenKpis(opts?: {
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardKpisPayload }>(
    await apiFetch("/api/dashboard/resumen/kpis", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ filtros: opts?.filtros ?? [] }),
    }),
  );
}

export type DashboardConfig = {
  titulo: string;
  subtitulo: string;
  logo_data_uri: string | null;
  logo_alt: string;
  logo_height_px: number;
  paleta_id: string | null;
  paletas_listas: Record<string, Record<string, string>>;
  color_primario_override: string | null;
  notas: string;
  // Personalización visual avanzada (Dimensiones).
  semaforo_modo?: "cortes" | "gradiente";
  semaforo_red_color?: string;
  semaforo_amber_color?: string;
  semaforo_green_color?: string;
  semaforo_red_max?: number;
  semaforo_amber_max?: number;
  // Cortes/paradas adicionales para ajuste fino del color sin aparecer
  // en la leyenda. Cada entrada es un par {value: 0-100, color: "#hex"}.
  semaforo_stops_extra?: { value: number; color: string }[];
  radar_min?: number;
  radar_max?: number;
  radar_gridshape?: "linear" | "circular";
  radar_modo?: "uno" | "facet" | "alternante";
  radar_animado?: boolean;
  barras_orientacion?: "horizontal" | "vertical" | "facet";
  barras_x_min?: number;
  barras_x_max?: number;
  foda_iconos_enabled?: boolean;
  foda_icon_tint?: string;
  foda_icon_size?: number;
  foda_icon_legend?: boolean;
  foda_score_min?: number;
  foda_score_max?: number;
  foda_show_total?: boolean;
  foda_spacing?: number;
  foda_grid_intensity?: number;
  foda_vista?: string;
  foda_views?: DashboardFodaViewConfig[];
  foda_aliases?: Record<string, Record<string, string>>;
  foda_service_icons?: Record<string, string>;
  // Layout del desglose en la pestaña Dimensiones.
  //   "paginado" — un nivel a la vez con stepper prev/next (default)
  //   "apilado"  — todos los niveles uno debajo del otro
  dim_desglose_layout?: "paginado" | "apilado";
  // Matriz por unidad — variables que definen las filas. La de color
  // determina el color de fondo + ícono de la 1ª columna; la de nombre
  // (opcional) concatena texto adicional ("Lima · ULE Lurigancho").
  matriz_var_color?: string;
  matriz_var_nombre?: string;
  // Overrides de íconos por conductor (axis_label → data-uri base64).
  // Persiste en .pulso. Si está vacío, el backend cae a los íconos del
  // paquete prosecnur (defaults bonitos por dimensión).
  dim_axis_icons?: Record<string, string>;
  // Logos del header — hasta 3 slots. Cada uno opcional (data URI base64).
  // Si está vacío, el header se hidrata desde el legacy `logo_data_uri`.
  logos?: DashboardLogoConfig[];
  // Habilitar/deshabilitar pestañas individualmente. Las pestañas no
  // listadas se consideran habilitadas (default true). Permite que el
  // editor recorte el dashboard final sin tocar el manifest del backend.
  tabs_enabled?: Partial<Record<DashboardTabId, boolean>>;
  // Modo de presentación para cada variable que tenga recodificación.
  // Las variables ausentes del mapa NO tienen decisión y disparan el
  // gate `RecodGate` antes de renderizar el dashboard.
  dashboard_var_modes?: Record<string, DashboardVarMode>;
  // Overrides de presentación por variable: incluir/excluir y label
  // custom. Permite ocultar variables del dashboard sin tocar el XLSForm
  // y diferenciar variables que comparten label (ej. p10_ule vs p10_ciam).
  dashboard_var_overrides?: Record<string, DashboardVarOverride>;
  // Cantidad de decimales para los porcentajes mostrados en las barras
  // del Resumen (SO y SM). Rango 0–2. Default 0.
  bar_decimals?: number;
  // Orden de las opciones en barras de select_multiple (Resumen).
  //   "questionnaire" — orden original del XLSForm (default)
  //   "desc"          — de mayor a menor porcentaje
  sm_order?: "questionnaire" | "desc";
  // Última publicación a HF Space (set por `dashboard_publish_space`).
  // Permite mostrar "Última publicación: hace X" en el botón Deploy y
  // pre-llenar el modal con el space_name actual al re-publicar.
  last_deploy?: DashboardLastDeploy;
};

export type DashboardVarMode = {
  // Para variables que tienen tanto opciones del XLSForm original como
  // recodificación: cuál mostrar. NO se permite mostrar ambas — siempre
  // una sola versión por variable. Default "original" si no hay decisión.
  modo: "original" | "recod";
};

export type DashboardVarOverride = {
  // false = la variable se oculta de los resúmenes del dashboard.
  enabled: boolean;
  // Si no vacío, reemplaza el label del XLSForm en los resúmenes.
  // Útil cuando varias variables comparten label (p10_ule, p10_ciam…).
  label: string;
};

// Catálogo de variables disponibles del dataset, agrupadas por sección
// del XLSForm. Devuelto por `apiDashboardAllVars` para que el panel
// "Datos" liste qué se puede incluir/excluir/renombrar.
export type DashboardSeccionVars = {
  seccion: string;
  vars: Array<{ name: string; label: string }>;
};

// Variable del estudio que tiene grupos de recodificación creados desde
// el módulo Codificación. Devuelta por `apiDashboardRecodVars` para que
// el frontend liste qué variables requieren decisión del usuario.
export type DashboardRecodVar = {
  name: string;
  label: string;
  n_grupos: number;
  grupos: Array<{ codigo: string; etiqueta: string }>;
};

export type DashboardLogoConfig = {
  data_uri: string;
  alt: string;
};

export type DashboardFodaViewConfig = {
  id: string;
  label: string;
  variable: string;
  metric_var?: string;
  card_mode: "iconos" | "alias";
  aliases?: Record<string, string>;
  icons?: Record<string, string>;
};

// Lista de variables que tienen grupos de recodificación creados en el
// módulo Codificación. El gate `RecodGate` la usa para saber qué
// variables aún no tienen decisión en `dashboard_var_modes`.
export async function apiDashboardRecodVars() {
  return handle<{ ok: true; vars: DashboardRecodVar[] }>(
    await apiFetch("/api/dashboard/recod-vars", { headers: headers() }),
  );
}

// Catálogo completo de variables del dataset agrupadas por sección del
// XLSForm. Lo usa el panel "Datos" para listar qué incluir/excluir y
// para renombrar variables individualmente.
export async function apiDashboardAllVars() {
  return handle<{ ok: true; secciones: DashboardSeccionVars[] }>(
    await apiFetch("/api/dashboard/all-vars", { headers: headers() }),
  );
}

export type DashboardPublishRequest = {
  hf_username: string;
  hf_token: string;
  space_name: string;
  private?: boolean;
};

export type DashboardPublishFile = {
  path: string;
  size: number;
};

export type DashboardLastDeploy = {
  repo_id: string;
  space_name: string;
  hf_username?: string;
  url: string;
  app_url: string;
  published_at: string;
  private?: boolean;
};

export type DashboardPublishResponse = {
  ok: true;
  repo_id: string;
  space_name: string;
  url: string;
  app_url: string;
  published_at: string;
  files_uploaded: number;
  total_bytes: number;
  project_size: number;
  uploaded: DashboardPublishFile[];
};

export async function apiDashboardPublish(payload: DashboardPublishRequest) {
  return handle<DashboardPublishResponse>(
    await apiFetch("/api/dashboard/publish", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiDashboardConfigGet() {
  return handle<{ ok: true; config: DashboardConfig }>(
    await apiFetch("/api/dashboard/config", { headers: headers() }),
  );
}

export async function apiDashboardConfigPut(config: DashboardConfig) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/dashboard/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export type DashboardSourceFileCandidate = {
  id: string;
  origin: "project" | "session" | string;
  kind: "xlsform" | "data" | string;
  file_id: string | null;
  path: string | null;
  name: string;
  ext: string;
  size: number | null;
  modified_at: string | null;
  suggested: boolean;
};

export type DashboardSourceMeta = {
  ready: boolean;
  source_kind: string | null;
  xlsform_file_id?: string | null;
  data_file_id?: string | null;
  xlsform_name: string | null;
  data_name: string | null;
  data_ext?: string | null;
  n_filas: number | null;
  n_columnas: number | null;
  loaded_at: string | null;
};

export type DashboardSourcePayload = {
  has_source: boolean;
  source: DashboardSourceMeta;
  project_dir: string | null;
  candidates: {
    project: {
      xlsforms: DashboardSourceFileCandidate[];
      data: DashboardSourceFileCandidate[];
    };
    session: {
      xlsforms: DashboardSourceFileCandidate[];
      data: DashboardSourceFileCandidate[];
    };
  };
};

export async function apiDashboardSourceGet() {
  return handle<{ ok: true; payload: DashboardSourcePayload }>(
    await apiFetch("/api/dashboard/source", { headers: headers() }),
  );
}

export async function apiDashboardSourceImport(payload:
  | { xlsform_file_id: string; data_file_id: string }
  | { xlsform_path: string; data_path: string }
) {
  return handle<{ ok: true; source: DashboardSourceMeta; manifest: DashboardManifest }>(
    await apiFetch("/api/dashboard/source/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export type DashboardChoiceList = {
  list_name: string;
  choices: Array<{ name: string; label: string }>;
};

export async function apiDashboardPaletasListas() {
  return handle<{ ok: true; listas: DashboardChoiceList[] }>(
    await apiFetch("/api/dashboard/paletas-listas", { headers: headers() }),
  );
}

// =============================================================================
// Dashboard — Tab Relaciones
// =============================================================================

export type DashboardRelacionFila = {
  code: string;
  label: string;
  n_total: number;
};

export type DashboardRelacionColumna = {
  code: string;
  label: string;
  n_total: number;
};

export type DashboardRelacionCelda = {
  n: number;
  pct_col: number;
  pct_row: number;
};

export type DashboardRelacionPlotTrace = {
  type: "bar";
  name: string;
  x: string[];
  y: number[];
  text: string[];
  hoverinfo?: string;
  marker?: { color: string };
};

export type DashboardRelacionCruce = {
  nivel: string | null;
  nivel_code?: string;
  n_total: number;
  filas: DashboardRelacionFila[];
  columnas: DashboardRelacionColumna[];
  celdas: DashboardRelacionCelda[][];
  plot_traces: DashboardRelacionPlotTrace[];
};

export type DashboardRelacionPayload = {
  n_total: number;
  iterado: boolean;
  iter_var?: string;
  iter_label?: string;
  cruces: DashboardRelacionCruce[];
};

export async function apiDashboardRelacionCross(opts: {
  var_principal: string;
  var_segmento: string;
  filtros?: DashboardFiltro[];
  iterar?: { var: string } | null;
}) {
  return handle<{ ok: true; payload: DashboardRelacionPayload }>(
    await apiFetch("/api/dashboard/relacion/cross", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardRelacionDescargar(opts: {
  var_principal: string;
  var_segmento: string;
  filtros?: DashboardFiltro[];
  iterar?: { var: string } | null;
}): Promise<Blob> {
  const res = await apiFetch("/api/dashboard/relacion/descargar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(`Descarga falló (${res.status})`);
  }
  return await res.blob();
}

// =============================================================================
// Dashboard — Tab Base de datos
// =============================================================================

export type DashboardBaseDatosDummy = {
  name: string;
  label: string;
  opt_code: string;
  opt_label: string;
};

export type DashboardBaseDatosVariable = {
  name: string;
  label: string;
  tipo: DashboardVarTipo;
  dummies?: DashboardBaseDatosDummy[];
};

export type DashboardBaseDatosSeccion = {
  id: string;
  label: string;
  variables: DashboardBaseDatosVariable[];
};

export type DashboardBaseDatosEstructura = {
  secciones: DashboardBaseDatosSeccion[];
};

export async function apiDashboardBaseDatosEstructura() {
  return handle<{ ok: true; payload: DashboardBaseDatosEstructura }>(
    await apiFetch("/api/dashboard/base-datos", { headers: headers() }),
  );
}

export type DashboardBaseDatosColumna = { key: string; label: string };

export type DashboardBaseDatosData = {
  rows: Record<string, string>[];
  columnas: DashboardBaseDatosColumna[];
  total: number;
};

export async function apiDashboardBaseDatosData(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  page?: number;
  page_size?: number;
  search?: string;
  sort?: { col: string; desc: boolean } | null;
}) {
  return handle<{ ok: true; payload: DashboardBaseDatosData }>(
    await apiFetch("/api/dashboard/base-datos/data", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardBaseDatosDescargar(opts: {
  modo: "codigos" | "etiquetas";
  variables: string[];
  formato: "xlsx" | "csv";
}): Promise<Blob> {
  const res = await apiFetch("/api/dashboard/base-datos/descargar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(`Descarga falló (${res.status})`);
  }
  return await res.blob();
}

export type DashboardBaseDatosOpcion = { codigo: string; etiqueta: string };

export type DashboardBaseDatosDiccionario = {
  variable: string;
  etiqueta: string;
  tipo: DashboardVarTipo | string;
  tipo_medicion: string;
  opciones: DashboardBaseDatosOpcion[];
};

export async function apiDashboardBaseDatosDiccionario(variable: string) {
  return handle<{ ok: true; payload: DashboardBaseDatosDiccionario }>(
    await apiFetch(
      `/api/dashboard/base-datos/diccionario?variable=${encodeURIComponent(variable)}`,
      { headers: headers() },
    ),
  );
}

// =============================================================================
// Dashboard — Tab Dimensiones
// =============================================================================

export type DashboardDimObjetivo = {
  id: string;
  label: string;
  n_axes: number;
};

export type DashboardDimCatalogo = {
  ready: boolean;
  general: DashboardDimObjetivo[];
  indicadores: DashboardDimObjetivo[];
};

export type DashboardDimSeccionVar = {
  nombre: string;
  vars: { name: string; label: string }[];
};

export type DashboardDimSeccionesPayload = {
  secciones: DashboardDimSeccionVar[];
};

export type DashboardDimScoreRow = {
  grupo: string;
  axis_label: string;
  score_raw: number | null;
  score_round: number | null;
  base: number | null;
  [key: string]: unknown;
};

export type DashboardDimPayload = {
  ready: boolean;
  error?: string;
  mode?: "general" | "indicadores";
  objective?: string;
  objective_id?: string;
  visual_mode?: "barras" | "radar";
  principal_var?: string | null;
  principal_label?: string | null;
  principal_hidden?: number;
  iter_active?: boolean;
  iter_var?: string | null;
  iter_var_label?: string | null;
  iter_level?: string | null;
  iter_level_label?: string | null;
  iter_hidden_levels?: number;
  axis_order_plot?: string[];
  axis_order_heat?: string[];
  score_plot?: DashboardDimScoreRow[];
  score_heat?: DashboardDimScoreRow[];
  group_colors?: Record<string, string>;
  // Mapa axis_label → data-uri PNG/SVG. Vacío si el objetivo no
  // declara iconos en su config.
  axis_icons?: Record<string, string>;
  semaforo?: {
    red_max: number;
    amber_max: number;
    red_color: string;
    amber_color: string;
    green_color: string;
    na_color: string;
  };
};

export type DashboardDimCategoria = { value: string; label: string; base: number };

export async function apiDashboardDimCatalogo() {
  return handle<{ ok: true; payload: DashboardDimCatalogo }>(
    await apiFetch("/api/dashboard/dimensiones/catalogo", { headers: headers() }),
  );
}

export async function apiDashboardDimSeccionesVars() {
  return handle<{ ok: true; payload: DashboardDimSeccionesPayload }>(
    await apiFetch("/api/dashboard/dimensiones/secciones-vars", { headers: headers() }),
  );
}

export async function apiDashboardDimPayload(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce?: string;
  incluir_total?: boolean;
  iter?: { var: string; level?: string } | null;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardDimPayload }>(
    await apiFetch("/api/dashboard/dimensiones/payload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardDimCategoriasVar(varName: string) {
  return handle<{ ok: true; valores: DashboardDimCategoria[] }>(
    await apiFetch("/api/dashboard/dimensiones/categorias-var", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ var: varName }),
    }),
  );
}

export type DashboardDimFodaCuadrante =
  | "fortaleza"
  | "oportunidad"
  | "debilidad"
  | "amenaza";

export type DashboardDimFodaItem = {
  var: string;
  axis_label: string;
  card_label?: string;
  item_kind?: string;
  card_mode?: "iconos" | "alias";
  grupo?: string;
  grupo_key?: string;
  color?: string;
  score_mean: number;
  score_sd: number;
  n_valid: number;
  cuadrante: DashboardDimFodaCuadrante | null;
  icono_url?: string;
  is_total_global?: boolean;
};

export type DashboardDimFodaIconLegendItem = {
  var: string;
  label: string;
  icono_url: string;
};

export type DashboardDimFodaPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  item_kind?: string;
  item_label?: string;
  card_mode?: "iconos" | "alias";
  item_var?: string;
  item_var_label?: string;
  metric_var?: string;
  metric_label?: string;
  items?: DashboardDimFodaItem[];
  cortes?: { score: number; sd: number };
  counts?: Record<DashboardDimFodaCuadrante, number>;
  group_colors?: Record<string, string>;
  icon_legend?: DashboardDimFodaIconLegendItem[];
  semaforo?: DashboardDimPayload["semaforo"];
};

export type DashboardDimMatrizFila = {
  key: string;
  color_key: string;
  color_label: string;
  // nombre_* solo se llenan cuando la 2da variable es DISTINTA de la 1ª
  // (cruce real). Si las dos son iguales, vienen vacíos — la card no
  // concatena texto duplicado.
  nombre_key: string;
  nombre_label: string;
  // icono_key se usa para buscar en `icons`. Cuando la 2da var es igual
  // a la 1ª, icono_key == color_key. Cuando son distintas, icono_key
  // == nombre_key. Vacío si no se eligió 2da variable.
  icono_key: string;
  icono_label: string;
  n: number;
  indicador_general: number | null;
  // Mapa axis_label → score promedio para esta fila. Algunas claves
  // pueden faltar si la combinación no tuvo casos válidos para ese
  // conductor.
  scores: Record<string, number | null>;
};

export type DashboardDimMatrizIconLegendItem = {
  key: string;
  label: string;
  icono_url: string;
};

export type DashboardDimMatrizPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  var_color?: string;
  var_color_label?: string;
  var_nombre?: string;
  var_nombre_label?: string;
  // var_icono = la variable usada para mapear íconos (puede coincidir con
  // var_color cuando el usuario eligió la misma en ambos selects).
  var_icono?: string;
  var_icono_label?: string;
  conductores?: Array<{ var: string; label: string }>;
  filas?: DashboardDimMatrizFila[];
  group_colors?: Record<string, string>;
  // Mapa icono_key → data-uri.
  icons?: Record<string, string>;
  // Solo entradas con ícono real — listo para renderizar la leyenda.
  icon_legend?: DashboardDimMatrizIconLegendItem[];
  semaforo?: DashboardDimPayload["semaforo"];
};

export type DashboardDimIconosDefaultsConductor = {
  var: string;
  label: string;
  // data-uri base64 vacío "" si el paquete no expone icono para esta dim.
  icono_url: string;
};

export type DashboardDimIconosDefaultsPayload = {
  ready: boolean;
  error?: string;
  objetivo?: string;
  objetivo_id?: string;
  modo?: "general" | "indicadores";
  conductores?: DashboardDimIconosDefaultsConductor[];
};

export async function apiDashboardDimIconosDefaults(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
}) {
  const params = new URLSearchParams({ modo: opts.modo, objetivo: opts.objetivo });
  return handle<{ ok: true; payload: DashboardDimIconosDefaultsPayload }>(
    await apiFetch(`/api/dashboard/dimensiones/iconos-defaults?${params.toString()}`, {
      headers: headers(),
    }),
  );
}

export async function apiDashboardDimMatriz(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  var_color: string;
  var_nombre?: string;
  filtros?: DashboardFiltro[];
}) {
  return handle<{ ok: true; payload: DashboardDimMatrizPayload }>(
    await apiFetch("/api/dashboard/dimensiones/matriz_unidades", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export async function apiDashboardDimFoda(opts: {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce?: string;
  incluir_total?: boolean;
  iter?: { var: string; level?: string } | null;
  filtros?: DashboardFiltro[];
  foda_config?: Pick<DashboardConfig, "foda_iconos_enabled" | "foda_icon_tint" | "foda_icon_size" | "foda_icon_legend" | "foda_score_min" | "foda_score_max" | "foda_show_total" | "foda_spacing" | "foda_grid_intensity" | "foda_vista" | "foda_views" | "foda_aliases" | "foda_service_icons">;
}) {
  return handle<{ ok: true; payload: DashboardDimFodaPayload }>(
    await apiFetch("/api/dashboard/dimensiones/foda", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(opts),
    }),
  );
}

export type AplicarResult = {
  ok: true;
  data_adaptada: { file_id: string; size: number };
  instrumento_adaptado: { file_id: string; size: number };
};

export async function apiCodifAplicar() {
  return handle<{ ok: true; job_id: string; kind: string }>(
    await apiFetch("/api/codificacion/aplicar", { method: "POST", headers: headers() })
  );
}

// ---- Plan de adaptación (paso 3) ------------------------------------------

export type PlanCodigoItem = {
  codigo: string;
  etiqueta: string;
  n_respuestas: number;
};

export type PlanPregunta = {
  parent: string;
  parent_label: string;
  tipo: string;
  modo_so: string;
  text_col: string;
  nueva_variable: string;
  n_grupos: number;
  n_codigos_nuevos: number;
  n_codigos_reutilizados: number;
  n_respuestas_afectadas: number;
  codigos_nuevos: PlanCodigoItem[];
  codigos_reutilizados: PlanCodigoItem[];
  bridge_soportado: boolean;
};

export type PlanAdaptacion = {
  ok: true;
  preguntas: PlanPregunta[];
  totales: {
    n_preguntas: number;
    n_variables_nuevas: number;
    n_codigos_nuevos: number;
    n_codigos_reutilizados: number;
  };
};

export async function apiCodifPlanAdaptacion() {
  return handle<PlanAdaptacion>(
    await apiFetch("/api/codificacion/plan-adaptacion", { headers: headers() })
  );
}

// ---- Export / Import JSON de configuración --------------------------------
// Exporta configuración portable versionada. Importar siempre pasa por preview
// antes de aplicar cambios sobre el estado de codificación del .pulso.

export type CodifConfigStatus = "compatible" | "needs_confirmation" | "conflict" | "missing";
export type CodifConfigConfidence = "strong" | "medium" | "weak" | "none";
export type CodifConfigImportStrategy = "keep" | "merge_missing" | "replace" | "duplicate";

export type CodifConfigOption = {
  code: string;
  label: string;
};

export type CodifConfigCategory = {
  code: string;
  label: string;
  description?: string;
  origin?: string;
};

export type CodifConfigVariable = {
  id: string;
  role: string;
  base_id: string;
  base_label?: string;
  scope?: string;
  name: string;
  label: string;
  type: string;
  list_norm?: string;
  parent_col?: string;
  text_col?: string;
  mode_so?: string;
  fingerprint?: string;
  options_fingerprint?: string;
  options?: CodifConfigOption[];
  categories?: CodifConfigCategory[];
  rules?: unknown[];
  recodes?: unknown[];
  bins?: unknown[];
  configuration?: unknown;
};

export type CodifMatrixSummary = {
  source_sheet?: string;
  total?: {
    carrera?: string;
    filas?: number;
    puestos_categorizados?: number;
    puestos_revision?: number;
    funciones_categorizadas?: number;
    funciones_revision?: number;
    filas_revision?: number;
  } | null;
  by_career?: Array<{
    carrera?: string;
    filas?: number;
    puestos_categorizados?: number;
    puestos_revision?: number;
    funciones_categorizadas?: number;
    funciones_revision?: number;
    filas_revision?: number;
  }>;
};

export type CodifConfigBundle = {
  ok: true;
  schema_version: "prosecnur.coding_config.v1" | string;
  exported_at: string;
  app_version: string;
  project_label: string;
  mode: "unibase" | "multibase" | string;
  processing_mode?: string;
  suggested_filename?: string;
  variables: CodifConfigVariable[];
  metadata?: {
    source?: string;
    notes?: string;
    exported_bases?: string[];
    matrix_layouts?: string[];
    matrix_summary?: CodifMatrixSummary | null;
    normalization?: {
      adopted_text_duplicates?: Array<{
        base_id: string;
        parent: string;
        text_col: string;
        mode_so: string;
        child: string;
        parent_groups_before: number;
        child_groups: number;
        parent_groups_after: number;
        action: string;
      }>;
    };
    contains_case_rows?: boolean;
    contains_response_match_values?: boolean;
    warnings?: string[];
  };
};

export type CodifImportPreviewItem = {
  match_id: string;
  source: {
    id: string;
    base_id: string;
    name: string;
    label: string;
    type: string;
    mode_so?: string;
    text_col?: string;
  };
  target: {
    base_id: string;
    name: string;
    label: string;
    type: string;
    fingerprint?: string;
  };
  status: CodifConfigStatus;
  confidence: CodifConfigConfidence;
  existing_state: boolean;
  reason: string;
  changes: {
    categories_new: number;
    categories_overwrite: number;
    rules_add: number;
    recodes_add: number;
  };
  matrix_layout?: "case_code_matrix" | "paired_category_matrix" | string;
  matrix_diagnostics?: {
    rows?: number;
    unique_cases?: number;
    unique_texts?: number;
    duplicate_case_rows?: number;
    matched_cases?: number;
    unmatched_cases?: number;
    review_rows?: number;
    categorized?: number;
    blocking?: boolean;
    code_label_conflicts?: string[];
  };
  default_strategy: CodifConfigImportStrategy;
  can_apply: boolean;
};

export type CodifImportPreview = {
  ok: true;
  schema_version: string;
  file_name?: string;
  source: {
    project_label?: string;
    exported_at?: string;
    mode?: string;
    variables: number;
    variables_after_normalization?: number;
    variables_effective_after_normalization?: number;
    normalization?: {
      adopted_text_duplicates?: Array<{
        base_id: string;
        parent: string;
        text_col: string;
        mode_so: string;
        child: string;
        parent_groups_before: number;
        child_groups: number;
        parent_groups_after: number;
        action: string;
      }>;
    };
  };
  target: {
    project_label?: string;
    mode?: string;
    bases: string[];
  };
  items: CodifImportPreviewItem[];
  summary: {
    compatible: string[];
    needs_confirmation: string[];
    missing: string[];
    conflicts: string[];
    n_compatible: number;
    n_needs_confirmation: number;
    n_missing: number;
    n_conflicts: number;
  };
  matrix_summary?: CodifMatrixSummary | null;
  requires_confirmation: boolean;
};

export type CodifImportSelection = {
  match_id: string;
  strategy?: CodifConfigImportStrategy;
  note?: string;
};

export type CodifImportApplyResult = {
  ok: true;
  imported: CodifImportPreviewItem[];
  versioned: CodifImportPreviewItem[];
  skipped: string[];
  audit: {
    event: "coding_config_import";
    imported_at: string;
    file_name: string;
    schema_version: string;
    variables_imported: number;
    variables_versioned: number;
    variables_skipped: number;
    conflicts: number;
  };
  summary: {
    variables_imported: number;
    variables_versioned: number;
    variables_skipped: number;
    conflicts: number;
  };
};

export type CodifExcelCategorizationPreview = {
  ok: true;
  source_format: "categorization_excel" | "matrix_excel";
  bundle: CodifConfigBundle;
  preview: CodifImportPreview;
};

export type CodifMatrixMap = {
  ok: true;
  bases: Array<{
    base: string;
    variables: Array<{
      variable: string;
      variable_label?: string;
      variable_kind?: string;
      variable_kind_label?: string;
      n_categorias?: number;
      n_casos?: number;
      n_asignaciones?: number;
      n_observaciones?: number;
      categories: Array<{
        codigo: string;
        etiqueta: string;
        category_role?: "regular" | "otro" | "no_contesta" | string;
        category_role_label?: string;
        n_respuestas: number;
        n_casos: number;
        n_asignaciones?: number;
        n_observaciones?: number;
        cases?: Array<{
          id_caso: string;
          respuesta: string;
          codigo: string;
          etiqueta: string;
          obs?: string;
        }>;
      }>;
    }>;
  }>;
};

export type CodifMatrixExportResult = {
  ok: true;
  file_id: string;
  size: number;
  visibility: "work" | "internal" | "client" | string;
};

export async function apiCodifExportJson() {
  return handle<CodifConfigBundle>(
    await apiFetch("/api/codificacion/export-json", { headers: headers() })
  );
}

export async function apiCodifImportJsonPreview(bundle: unknown, fileName?: string) {
  return handle<CodifImportPreview>(
    await apiFetch("/api/codificacion/import-json/preview", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifImportJsonApply(bundle: unknown, selections: CodifImportSelection[], fileName?: string) {
  return handle<CodifImportApplyResult>(
    await apiFetch("/api/codificacion/import-json/apply", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, selections, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifImportExcelCategorizationPreview(fileId: string, fileName?: string) {
  return handle<CodifExcelCategorizationPreview>(
    await apiFetch("/api/codificacion/import-categorias-excel/preview", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifMatricesPreview(fileId: string, fileName?: string) {
  return handle<CodifExcelCategorizationPreview>(
    await apiFetch("/api/codificacion/matrices/preview", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifMatricesApply(bundle: unknown, selections: CodifImportSelection[], fileName?: string) {
  return handle<CodifImportApplyResult>(
    await apiFetch("/api/codificacion/matrices/apply", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle, selections, file_name: fileName ?? "" }),
    })
  );
}

export async function apiCodifMatricesMap(base?: string) {
  const query = base ? `?base=${encodeURIComponent(base)}` : "";
  return handle<CodifMatrixMap>(
    await apiFetch(`/api/codificacion/matrices/mapa${query}`, { headers: headers() })
  );
}

export async function apiCodifMatricesCasePatch(payload: {
  base: string;
  variable: string;
  id_caso: string;
  from_codigo?: string;
  codigo: string;
  etiqueta: string;
}) {
  return handle<{ ok: true; map: CodifMatrixMap }>(
    await apiFetch("/api/codificacion/matrices/caso", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function apiCodifMatricesExport(
  visibility: "work" | "internal" | "client",
  variables?: string[],
  base?: string,
) {
  return handle<CodifMatrixExportResult>(
    await apiFetch("/api/codificacion/matrices/export", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ visibility, variables: variables ?? [], base: base ?? "" }),
    })
  );
}

export async function apiCodifImportJson(bundle: unknown) {
  return handle<CodifImportPreview>(
    await apiFetch("/api/codificacion/import-json", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    })
  );
}

// =============================================================================
// Fase 2 v2 — Validación (scoped por base)
// =============================================================================
// Todas las llamadas viajan con header `X-Base-Nombre` cuando el usuario
// ya seleccionó una base explícita. Si viaja vacío, el backend resuelve
// a la primera base del estudio (o modo legacy single-base).
import type {
  LimpiezaSummary,
  LimpiezaDecision,
  LimpiezaBeforeAfterPreview,
  InstrumentoEstado,
  InstrumentoVariablesExcluidas,
  ExploradorVariablesList,
  ReglasCustomList,
} from "../features/validacion/types";

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
import type { ViewDescriptor } from "../features/validacion/types";

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

export type InstrumentoPlanResult = {
  ok: true;
  base_nombre: string | null;
  n_reglas: number;
  resumen: Array<Record<string, unknown>>;
  plan_preview: Array<Record<string, unknown>>;
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
) {
  return handle<InstrumentoPlanResult>(
    await apiFetch("/api/validacion/v2/instrumento/plan", {
      method: "POST",
      headers: v2Headers(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(incluir ? { incluir } : {}),
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
import type { ReglaCustom } from "../features/validacion/types";

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

export async function apiV2ReglasCustomEjecutar(baseNombre?: string | null) {
  return handle<{ ok: true; job_id: string; kind: string; n_custom: number }>(
    await apiFetch("/api/validacion/v2/reglas_custom/ejecutar", {
      method: "POST",
      headers: v2Headers(baseNombre),
    }),
  );
}

// ===========================================================================
// Proyecto .pulso — workspace persistente (Sprint Project)
// ===========================================================================
// El backend serializa el estado de la sesión a un archivo binario .pulso
// (zip con manifest.json + state.rds + files/). Estos endpoints exponen
// las operaciones save / open / close / status. Los path absolutos vienen
// del file picker nativo (window.prosecnurApi en Electron) o son tipeados
// por el user en navegador.

export type ProjectStatus = {
  has_project: boolean;
  path: string | null;
  name: string | null;
  dirty: boolean;
  last_saved_at: string | null;
};

export async function apiProjectStatus(): Promise<ProjectStatus> {
  return handle<ProjectStatus>(
    await apiFetch("/api/project/status", { headers: headers() })
  );
}

// Guarda el estado actual al .pulso. Si `path` es null, usa el project_path
// activo (save in place). Si no hay activo y no se pasa path → 400.
export async function apiProjectSave(path: string | null = null, projectName?: string) {
  const body: Record<string, unknown> = {};
  if (path) body.path = path;
  if (projectName) body.project_name = projectName;
  return handle<{ ok: true; path: string; size: number; saved_at: string }>(
    await apiFetch("/api/project/save", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
  );
}

export async function apiProjectDuplicate(payload: {
  source_path?: string | null;
  target_path: string;
  project_name?: string;
  open_copy?: boolean;
  overwrite?: boolean;
}) {
  return handle<{
    ok: true;
    duplicated: true;
    path: string;
    source_path: string;
    target_path: string;
    project_name: string;
    opened: boolean;
    session_id: string;
    size: number;
    saved_at: string;
  }>(
    await apiFetch("/api/project/duplicate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    })
  );
}

// Abre un .pulso. El backend devuelve el sid nuevo en el header
// X-Pulso-Session, que `handle()` captura y dispara `pulso:session-changed`
// para que SessionContext re-hidrate todo.
export async function apiProjectOpen(path: string) {
  return handle<{
    ok: true;
    session_id: string;
    project_path: string;
    manifest: Record<string, unknown>;
  }>(
    await apiFetch("/api/project/open", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ path }),
    })
  );
}

export async function apiProjectWarmup(options: { mode?: "full"; budget_ms?: number; modules?: string[] } = {}) {
  return handle<JobStart>(
    await apiFetch("/api/project/warmup", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        mode: options.mode ?? "full",
        budget_ms: options.budget_ms ?? 60000,
        ...(options.modules?.length ? { modules: options.modules } : {}),
      }),
    })
  );
}

// Cierra el proyecto activo. BootGate escucha el evento del hook de proyecto
// y desmonta la suite para que no haya rutas principales sin .pulso.
export async function apiProjectClose() {
  return handle<{ ok: true }>(
    await apiFetch("/api/project/close", {
      method: "POST",
      headers: headers(),
    })
  );
}

// Copia un archivo del file store del backend al directorio del .pulso
// activo, con un nombre limpio elegido por el analista.
export async function apiSaveEntregable(
  fileId: string,
  filename: string,
  options: { subdir?: string; overwrite?: boolean } = {}
) {
  return handle<{ ok: true; path: string; filename: string; size: number }>(
    await apiFetch("/api/fs/save-to-project", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: fileId,
        filename,
        subdir: options.subdir ?? null,
        overwrite: options.overwrite ?? false,
      }),
    })
  );
}

export async function apiSaveFileAs(
  fileId: string,
  path: string,
  options: { overwrite?: boolean } = {}
) {
  return handle<{ ok: true; path: string; filename: string; size: number }>(
    await apiFetch("/api/fs/save-file-as", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        file_id: fileId,
        path,
        overwrite: options.overwrite ?? true,
      }),
    })
  );
}

// Lista los archivos en el directorio del .pulso activo. Útil para que el
// FilenameInput detecte colisiones antes de pedir confirmación.
export async function apiListProjectDir() {
  return handle<{ ok: true; project_dir: string | null; files: string[] }>(
    await apiFetch("/api/fs/list-project-dir", { headers: headers() })
  );
}

// ============================================================================
// [DEPRECATED] Cálculo de muestra por aulas universitarias
// Reemplazado por `Calculador de Muestra` (calc-muestra). Las funciones
// `apiMuestraAulas*` apuntan a endpoints que ya no existen en el backend;
// ningún componente UI las consume. Se mantienen temporalmente sólo porque
// otros tipos exportados (MuestraAulasReporteMeta) podrían ser referenciados
// hasta el siguiente cleanup. Tree-shaking las elimina del bundle.
// ============================================================================

export type MuestraAulasFacultadRow = {
  facultad: string;
  N_total: number;
  N_hombres: number;
  N_mujeres: number;
  avg_matriculados_aula: number;
  tau: number;
};

export type MuestraAulasRedondeo = "arriba" | "cuadratura";
export type MuestraAulasTipoEstudio =
  | "universitario_aulas"
  | "universitario_online"
  | "universitario_mixto"
  | "acreditacion_egresados"
  | "territorial_hogares";

export type MuestraAulasGlobales = {
  z: number;
  p: number;
  tipo_estudio: MuestraAulasTipoEstudio;
  titulo_estudio: string;
  fecha_aplicacion: string;
  redondeo: MuestraAulasRedondeo;
};

export type MuestraAulasParamsA = {
  e: number;
  deff: number;
  oversample_pct: number;
};

export type MuestraAulasParamsB = {
  e: number;
  deff: number;
  cap_pct: number;
  oversample_pct: number;
};

export type MuestraAulasConfig = {
  version: 1;
  globales: MuestraAulasGlobales;
  escenario_A: MuestraAulasParamsA;
  escenario_B: MuestraAulasParamsB;
};

export type MuestraAulasDistribucionRow = {
  facultad: string;
  sexo: "Hombres" | "Mujeres";
  N: number;
  n: number;
};

export type MuestraAulasAulaRow = {
  facultad: string;
  cuota_total: number;
  aulas_base: number;
  aulas_reemplazo: number;
  aulas_total: number;
  tipo_aula: string;
};

export type MuestraAulasResultadoA = {
  n_bruto: number;
  n_ajustado_deff: number;
  n_redondeado: number;
  n_con_sobremuestra: number;
  precision_universidad: number;
  distribucion: MuestraAulasDistribucionRow[];
  aulas: MuestraAulasAulaRow[];
  N_universo: number;
};

export type MuestraAulasFacultadResB = {
  facultad: string;
  N_facultad: number;
  n_objetivo: number;
  n_final: number;
  cap_activo: boolean;
  precision_e: number;
  aulas_base: number;
  aulas_reemplazo: number;
  aulas_total: number;
  tipo_aula: string;
};

export type MuestraAulasResultadoB = {
  por_facultad: MuestraAulasFacultadResB[];
  distribucion: MuestraAulasDistribucionRow[];
  n_total: number;
  n_total_objetivo: number;
  n_con_sobremuestra: number;
  facultades_cap: string[];
  cap_pct: number;
};

export type MuestraAulasDecisionEntry = {
  nombre?: string;
  decision?: string;
  paso?: string;
  valor?: string;
  resultado?: string | number;
  justificacion?: string;
  nota?: string;
  z?: number;
};

export type MuestraAulasDecisionLog = {
  parametros: MuestraAulasDecisionEntry[];
  metodologicas: MuestraAulasDecisionEntry[];
  ajustes: MuestraAulasDecisionEntry[];
};

export type MuestraAulasReporteMeta = {
  disponible: boolean;
  generated_at?: string | null;
  formato?: "html" | "pdf" | null;
  hash_config?: string | null;
  job_id?: string | null;
};

export type MuestraAulasState = {
  config: MuestraAulasConfig;
  universo: MuestraAulasFacultadRow[];
  universo_n: number;
  resultados: {
    A?: MuestraAulasResultadoA | null;
    B?: MuestraAulasResultadoB | null;
  } | null;
  decision_log: MuestraAulasDecisionLog | null;
  computado_at: string | null;
  reporte: MuestraAulasReporteMeta;
  sample_disponible: boolean;
};

export const DEFAULT_MUESTRA_AULAS_CONFIG: MuestraAulasConfig = {
  version: 1,
  globales: {
    z: 1.96,
    p: 0.5,
    tipo_estudio: "universitario_aulas",
    titulo_estudio: "Estudio sin título",
    fecha_aplicacion: "",
    redondeo: "cuadratura",
  },
  escenario_A: { e: 0.025, deff: 2.0, oversample_pct: 0.10 },
  escenario_B: { e: 0.05, deff: 1.5, cap_pct: 0.50, oversample_pct: 0.10 },
};

export async function apiMuestraAulasState() {
  return handle<MuestraAulasState>(
    await apiFetch("/api/muestra-aulas/state", { headers: headers() }),
  );
}

export async function apiMuestraAulasConfigPut(config: MuestraAulasConfig) {
  return handle<{ ok: true; config: MuestraAulasConfig }>(
    await apiFetch("/api/muestra-aulas/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiMuestraAulasUniversoPut(rows: MuestraAulasFacultadRow[]) {
  return handle<{
    ok: true;
    universo: MuestraAulasFacultadRow[];
    warnings: string[];
  }>(
    await apiFetch("/api/muestra-aulas/universo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ universo: rows }),
    }),
  );
}

export async function apiMuestraAulasUniversoUpload(fileId: string) {
  return handle<{
    ok: true;
    universo: MuestraAulasFacultadRow[];
    warnings: string[];
  }>(
    await apiFetch("/api/muestra-aulas/universo/upload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id: fileId }),
    }),
  );
}

export function muestraAulasPlantillaUrl(): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const qs = sid ? `?sid=${encodeURIComponent(sid)}` : "";
  return apiPath(`/api/muestra-aulas/plantilla${qs}`);
}

export async function apiMuestraAulasCalcular(
  escenario: "A" | "B" | "ambos" = "ambos",
) {
  return handle<{
    ok: true;
    resultados: { A?: MuestraAulasResultadoA; B?: MuestraAulasResultadoB };
    decision_log: MuestraAulasDecisionLog;
    computado_at: string;
  }>(
    await apiFetch("/api/muestra-aulas/calcular", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ escenario }),
    }),
  );
}

export async function apiMuestraAulasReporteIniciar(
  formato: "html" | "pdf" = "html",
) {
  return handle<{ ok: true; job_id: string; formato: "html" | "pdf" }>(
    await apiFetch("/api/muestra-aulas/reporte", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    }),
  );
}

export function muestraAulasReporteDescargarUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/muestra-aulas/reporte/descargar${qs ? `?${qs}` : ""}`);
}

// ============================================================================
// Calculador de Muestra (nuevo módulo `calc-muestra`)
// ============================================================================
//
// Reemplazo de muestra-aulas y diseno-muestra. Multi-componente, basado en el
// blueprint canónico de PULSO PUCP (outputs/fuentes_metodologicas).
//
// Cobertura Fase 1: 4 metodologías (conglomerados, intención censal, cuotas,
// listado externo) con plantilla ACREDITACION PUCP multi-actor.

export type CalcMuestraTecnica =
  | "prob_aleatorio_simple"
  | "prob_estratificado"
  | "prob_estratificado_independiente"
  | "prob_conglomerado_multietapico"
  | "sistematico"
  | "medicion_recurrente"
  | "barrido"
  | "intencion_censal"
  | "listado_externo_meta_fija"
  | "no_prob_conveniencia"
  | "no_prob_cuotas";

export type CalcMuestraNaturaleza = "prob" | "operativo" | "no_prob";

export type CalcMuestraOrigenTamano =
  | "formula"
  | "meta_contractual"
  | "cobertura_esperada"
  | "matriz_perfiles_cualitativa";

// Modos de trabajo del calculador (alcance: PROPUESTA).
// El seguimiento de campo y el cierre con brechas viven en el módulo
// de Monitoreo, no acá.
export type CalcMuestraModoTrabajo =
  | "estimacion_preliminar"
  | "diseno_validado";

export type CalcMuestraMacroFamilia =
  | "acreditacion"
  | "encuesta_estudiantes"
  | "hsvg_universitario"
  | "territorial"
  | "listado_telefonico"
  | "linea_base_servicios"
  | "estudio_propio";

export type CalcMuestraNivelRespaldo =
  | "representatividad_estadistica"
  | "representatividad_operacional"
  | "representatividad_teorica_controlada"
  | "cobertura_balanceada"
  | "evidencia_descriptiva";

export type CalcMuestraEstadoMarco =
  | "no_definido"
  | "bruto"
  | "validado"
  | "contactable"
  | "listado_externo"
  | "operativo";

export type CalcMuestraEstrato = {
  id: string;
  label: string;
  N: number;
  N_a: number;
  N_b: number;
  sub_a_label: string;
  sub_b_label: string;
  e_facultad?: number;
  p_facultad?: number;
  confianza_facultad?: number;
  z_facultad?: number;
  cuota_fija?: number;
  sobremuestra_fija?: number;
  aulas_base_fijas?: number;
  aulas_extra_operativas?: number;
  promedio_conglomerado: number;
  tau: number;
};

export type CalcMuestraMatrizOperativaCelda = {
  id: string;
  territorio: string;
  servicio: string;
  N: number;
  notas: string;
};

export type CalcMuestraMarco = {
  universo_bruto: number;
  marco_validado: number;
  marco_contactable: number;
  estado: CalcMuestraEstadoMarco;
  notas: string;
  estratos?: CalcMuestraEstrato[];
  matriz_operativa?: CalcMuestraMatrizOperativaCelda[];
};

export type CalcMuestraParametros = {
  z: number;
  p: number;
  e: number;
  deff: number;
  tau: number;
  oversample_pct: number;
  tasa_contacto: number;
  tasa_elegibilidad: number;
  tasa_respuesta: number;
  cobertura_objetivo: number;
  promedio_conglomerado: number;
  n_minimo_estrato: number;
  tope_operativo: number;
};

export type CalcMuestraMeta = {
  tipo: "objetivo" | "cuota" | "cobertura" | "contractual";
  valor: number;
  variable_control: string;
  sub_cuotas: Record<string, number>;
};

export type CalcMuestraDistribucionEstrato = {
  estrato: string;
  N: number;
  n: number;
  p_e?: number;
  z_e?: number;
  confianza_e?: number;
  precision_e: number | null;
  regla?: string;
};

export type CalcMuestraDistribucionSub = {
  estrato: string;
  sub: string;
  N: number;
  n: number;
};

export type CalcMuestraAulasEstrato = {
  estrato: string;
  N: number;
  cuota: number;
  avg_conglomerado: number;
  tau: number;
  aulas_base: number;
  aulas_reemplazo: number;
  aulas_extra_operativas?: number;
  aulas_total: number;
  tipo_aula: string;
  precision_e: number | null;
};

export type CalcMuestraCuotaMatriz = {
  territorio: string;
  servicio: string;
  N: number;
  n: number;
  regla?: string;
};

export type CalcMuestraResultado = {
  n_bruto?: number;
  n_teorico: number | null;
  n_objetivo: number;
  n_operativo: number;
  unidades_operativas?: number | null;
  precision_alcanzada?: number | null;
  sobremuestra?: number;
  cobertura_objetivo?: number;
  tasa_respuesta_esperada?: number;
  universo_a_contactar?: number;
  variable_control?: string;
  sub_cuotas?: Record<string, number>;
  tasa_contacto?: number;
  tasa_elegibilidad?: number;
  tasa_respuesta?: number;
  registros_a_contactar?: number;
  origen_tamano: CalcMuestraOrigenTamano;
  advertencia?: string;
  tecnica: CalcMuestraTecnica;
  computado_at: string;
  inferencia: {
    permitido: boolean;
    motivos: string | null;
  };
  // Solo presente cuando el componente es conglomerados con marco estratificado.
  distribucion_estratos?: CalcMuestraDistribucionEstrato[];
  distribucion_sub?: CalcMuestraDistribucionSub[];
  aulas_por_estrato?: CalcMuestraAulasEstrato[];
  aulas_total?: number;
  aulas_base_total?: number;
  aulas_extra_total?: number;
  cuotas_matriz?: CalcMuestraCuotaMatriz[];
};

export type CalcMuestraActorCategoria =
  | "estudiantes"
  | "docentes"
  | "administrativos"
  | "egresados"
  | "empleadores"
  | "comite_consultivo"
  | "otros";

export type CalcMuestraCanalRecojo =
  | "aula_qr"
  | "telefonico"
  | "online_email"
  | "presencial"
  | "mixto"
  | "sin_definir";

export type CalcMuestraInferenciaAcreditacion = {
  tecnica: CalcMuestraTecnica | null;
  regla: string;
  justificacion: string;
  minimo_cobertura?: number;
  minimo_cuota?: number;
  minimo_n?: number;
  piso_n_minimo?: number;
  tope_operativo?: number;
  variable_control?: string;
  aulas_referencia?: number;
  params_canonicos?: Partial<CalcMuestraParametros>;
};

export type CalcMuestraComponente = {
  id: string;
  actor: string;
  actor_id: string;
  actor_categoria: CalcMuestraActorCategoria;
  canal_recojo: CalcMuestraCanalRecojo;
  tecnica: CalcMuestraTecnica;
  naturaleza: CalcMuestraNaturaleza;
  origen_tamano: CalcMuestraOrigenTamano;
  nivel_respaldo: CalcMuestraNivelRespaldo;
  marco: CalcMuestraMarco;
  parametros: CalcMuestraParametros;
  meta: CalcMuestraMeta;
  inferencia_acreditacion?: CalcMuestraInferenciaAcreditacion;
  resultado?: CalcMuestraResultado | null;
};

export type CalcMuestraDecisionLog = {
  estudio: {
    titulo: string;
    macro_familia: CalcMuestraMacroFamilia;
    modo_trabajo: CalcMuestraModoTrabajo;
    modo_sensible: boolean;
  };
  componentes: Array<{
    actor: string;
    tecnica: CalcMuestraTecnica;
    naturaleza: CalcMuestraNaturaleza;
    origen_tamano: CalcMuestraOrigenTamano;
    nivel_respaldo: CalcMuestraNivelRespaldo;
    marco: CalcMuestraMarco;
    decisiones: Array<{ decision: string; valor: string; justificacion: string }>;
  }>;
};

export type CalcMuestraWorkspaceFrameMode =
  | "sin_definir"
  | "acreditacion"
  | "opinion_universitaria"
  | "marco_disponible"
  | "territorial_handoff"
  | "legacy";

export type CalcMuestraWorkspaceProducto =
  | "muestra_probabilistica"
  | "cobertura_marco"
  | "matriz_cuotas"
  | "componentes_mixtos";

export type CalcMuestraWorkspaceVariableControl = {
  id: string;
  label: string;
  tipo: "estrato" | "cuota" | "filtro" | "segmento" | "otro";
  disponible: boolean;
  notas?: string;
};

export type CalcMuestraWorkspaceEscenario = {
  id: string;
  label: string;
  descripcion: string;
  activo: boolean;
  tecnica: CalcMuestraTecnica;
  producto: CalcMuestraWorkspaceProducto;
  component_id?: string;
  incluir_reporte?: boolean;
  redondeo_multiplo?: number;
  parametros: Partial<CalcMuestraParametros>;
};

export type CalcMuestraWorkspaceAulasModalidad =
  | "presencial_aula"
  | "mixto_aula"
  | "online_controlado";

export type CalcMuestraWorkspaceAulasSelector =
  | "pps_balanceado"
  | "cube_balanceado"
  | "local_pivotal_balanceado"
  | "pool_controlado"
  | "sistematico_pps"
  | "estratificado_aleatorio"
  | "manual_auditable";

export type CalcMuestraWorkspaceAulasSizeGroup = {
  id: string;
  label: string;
  min: number;
  max: number | null;
  descripcion: string;
};

export type CalcMuestraAulasObjectiveVariable = {
  dimension: string;
  label: string;
  aula_col: string;
  student_col?: string;
  weight: number;
  tolerance: number;
  source_preference?: "student" | "aula" | string;
};

export type CalcMuestraAulasObjectiveConfig = {
  schema: "calc_muestra_aulas_representativity_objective_v1" | string;
  primary_unit?: string;
  variables: CalcMuestraAulasObjectiveVariable[] | MonitoreoRow[];
  component_weights?: Record<string, number>;
  duplicate_loss_tolerance?: number;
  dispersion_tolerance?: number;
  weight_cv_warn?: number;
  weight_cv_critical?: number;
  reserve_depth_target?: number;
  missing_policy?: string;
};

export type CalcMuestraWorkspaceAulasConfig = {
  schema: "calc_muestra_workspace_aulas_v1" | string;
  modalidad: CalcMuestraWorkspaceAulasModalidad;
  selector: CalcMuestraWorkspaceAulasSelector;
  selector_engine?: CalcMuestraWorkspaceAulasSelector | string;
  method_family?: string;
  min_elegibles_aula: number;
  accepted_conditions?: string[];
  require_undergraduate?: boolean;
  require_adult?: boolean;
  min_age?: number;
  require_in_person?: boolean;
  usar_grupos_tamano: boolean;
  grupos_tamano: CalcMuestraWorkspaceAulasSizeGroup[];
  estratos_selector: string[];
  balance_vars?: string[];
  spread_vars?: string[];
  candidate_pool_size?: number;
  simulation_runs?: number;
  mos_strategy?: string;
  coordination_mode?: string;
  replacement_depth_strategy?: "max_complete_chains_by_cell" | string;
  min_replacements_per_titular?: number;
  max_replacements_per_titular?: number;
  extra_pool_policy?: "leftover_after_chains" | "none" | string;
  replacement_equivalence_vars?: string[];
  replacement_score_weights?: Record<string, number>;
  bolsas_reemplazo: number;
  aulas_extra_operativas_default: number;
  penalizacion_repetidos: number;
  pps_weight: number;
  coverage_weight: number;
  monte_carlo_n: number;
  semilla: number;
  objective?: CalcMuestraAulasObjectiveConfig;
  notas_metodologicas?: string;
};

export type CalcMuestraWorkspaceSourceMode =
  | "base_madre"
  | "dos_bases"
  | "seleccion_existente";

export type CalcMuestraWorkspaceSourceBinding = {
  id: string;
  role: "base_madre" | "estudiantes" | "catalogo_curso_horario" | "inscripciones" | "muestra_previa" | "agenda" | string;
  label: string;
  status?: "pendiente" | "declarada" | "cargada" | "validada" | "revisar" | string;
  file_id?: string;
  file_name?: string;
  spreadsheet_id?: string;
  sheet_name?: string;
  available_sheets?: string[];
  suggested_sheet?: string;
  detected_role?: string;
  compatibility_status?: string;
  sheet_diagnostics?: CalcMuestraAulasSheetInspectionSheet[];
  range?: string;
  rows?: number;
  columns?: number;
  notes?: string;
};

export type CalcMuestraAulasSheetInspectionSheet = {
  name: string;
  rows_preview?: number;
  columns?: number;
  columns_sample?: string[];
  role?: string;
  role_label?: string;
  confidence?: number;
};

export type CalcMuestraAulasFileInspection = {
  type?: "workbook" | "table" | string;
  sheets: CalcMuestraAulasSheetInspectionSheet[];
  suggested_sheet?: string;
  suggested_role?: string;
  has_base_madre?: boolean;
  sheet_names?: string[];
};

export type CalcMuestraWorkspaceVariableMapping = {
  role: string;
  label: string;
  required?: boolean;
  source_role?: string;
  column?: string;
  description?: string;
};

export type CalcMuestraWorkspaceCategoryValueMapping = {
  raw: string;
  label: string;
  include?: boolean;
  notes?: string;
};

export type CalcMuestraWorkspaceCategoryMapping = {
  role: string;
  label?: string;
  source_role?: string;
  column?: string;
  values: CalcMuestraWorkspaceCategoryValueMapping[];
};

export type CalcMuestraWorkspacePublicationConfig = {
  google_sheets_enabled?: boolean;
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  publication_mode?: "single_spreadsheet_multi_sheet" | "separate_outputs" | string;
  internal_sheet_name?: string;
  client_sheet_name?: string;
  frame_sheet_name?: string;
  sample_calculation_sheet_name?: string;
  classroom_selection_sheet_name?: string;
  replacement_sheet_name?: string;
  operational_routes_sheet_name?: string;
  agenda_sheet_name?: string;
  monitoring_handoff_sheet_name?: string;
  methodology_sheet_name?: string;
  include_workbook?: boolean;
  include_methodology?: boolean;
  include_frame_audit?: boolean;
  include_sample_calculation?: boolean;
  include_classroom_selection?: boolean;
  include_replacements?: boolean;
  pii_policy?: "sin_pii_cliente" | "interno_trazabilidad" | string;
};

export type CalcMuestraWorkspace = {
  version: 2;
  frame_mode: CalcMuestraWorkspaceFrameMode;
  marco_disponible: string;
  fuente_marco: string;
  unidad_observacion: string;
  unidad_muestreo: string;
  variables_control: CalcMuestraWorkspaceVariableControl[];
  escenarios: CalcMuestraWorkspaceEscenario[];
  notas_diseno: string;
  aulas_config?: CalcMuestraWorkspaceAulasConfig;
  source_mode?: CalcMuestraWorkspaceSourceMode;
  source_bindings?: CalcMuestraWorkspaceSourceBinding[];
  variable_mappings?: CalcMuestraWorkspaceVariableMapping[];
  category_mappings?: CalcMuestraWorkspaceCategoryMapping[];
  publication_config?: CalcMuestraWorkspacePublicationConfig;
};

export type CalcMuestraEstudio = {
  version: number;
  id: string;
  titulo: string;
  fecha_creacion: string;
  modo_trabajo: CalcMuestraModoTrabajo;
  macro_familia: CalcMuestraMacroFamilia;
  modo_sensible: boolean;
  contexto: {
    cliente: string;
    tipo_cliente: string;
    descripcion_libre: string;
  };
  componentes: CalcMuestraComponente[];
  workspace?: CalcMuestraWorkspace | null;
  decision_log?: CalcMuestraDecisionLog;
  computado_at?: string;
};

export type CalcMuestraReporteMeta = {
  disponible: boolean;
  generated_at?: string | null;
  formato?: "html" | "pdf" | null;
  job_id?: string | null;
};

export type CalcMuestraAulasFrame = {
  schema: "calc_muestra_aulas_frame_v1" | string;
  generated_at: string;
  input_mode: "base_madre" | "dos_bases" | string;
  config: Record<string, unknown>;
  frame_hash: string;
  population?: MonitoreoRow[];
  aula_frame: MonitoreoRow[];
  exclusions?: MonitoreoRow[];
  category_profiles?: MonitoreoRow[];
  audit: MonitoreoRow[];
  catalog_audit?: Record<string, unknown>;
  relation_audit?: Record<string, unknown>;
  warnings: string[];
  methodology?: Record<string, unknown>;
};

export type CalcMuestraAulasSelection = {
  schema: "calc_muestra_aulas_selection_v1" | string;
  selection_run_id: string;
  generated_at: string;
  frame_hash: string;
  seed: number;
  selector: Record<string, unknown>;
  selector_engine?: string;
  selector_engine_used?: string;
  method_family?: string;
  method_source?: string;
  official_reference?: string;
  academic_reference?: string;
  implementation_reference?: string;
  probability_source?: string;
  weight_source?: string;
  nonresponse_policy?: string;
  replacement_policy?: string;
  methodological_warning?: string[];
  methodological_sources?: MonitoreoRow[];
  objective_config?: CalcMuestraAulasObjectiveConfig;
  representativity?: CalcMuestraAulasRepresentativityResult;
  representativity_score?: number;
  representativity_distance?: number;
  selection: MonitoreoRow[];
  quotas: MonitoreoRow[];
  summary: MonitoreoRow[];
  diagnostics?: Record<string, MonitoreoRow[] | undefined>;
  methodology?: Record<string, unknown>;
  method_comparison?: CalcMuestraAulasMethodComparison;
  replacement_simulation?: CalcMuestraAulasReplacementSimulation;
};

export type CalcMuestraAulasProfileDistribution = {
  dimension: string;
  variable?: string;
  label?: string;
  category: string;
  source?: string;
  frame_n?: number;
  selected_n?: number;
  frame_prop?: number;
  selected_prop?: number;
  error_balance?: number;
  abs_error?: number;
  tolerance?: number;
  within_tolerance?: boolean;
  method_id?: string;
};

export type CalcMuestraAulasRepresentativityMetric = {
  metric_id: string;
  metric_group: string;
  label: string;
  base_weight?: number;
  normalized_weight?: number;
  active?: boolean;
  score?: number;
  distance?: number;
  avg_abs_error?: number;
  max_abs_error?: number;
  tolerance?: number;
  detail?: string;
  method_id?: string;
};

export type CalcMuestraAulasSimulationSummary = {
  method_id: string;
  requested_runs?: number;
  executed_runs?: number;
  score_mean?: number;
  score_sd?: number;
  score_p10?: number;
  score_p90?: number;
  coverage_mean?: number;
  duplicate_loss_mean?: number;
  note?: string;
};

export type CalcMuestraAulasRepresentativityResult = {
  schema: "calc_muestra_aulas_representativity_objective_v1" | string;
  generated_at?: string;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  overall_score?: number;
  representativity_score?: number;
  weighted_distance?: number;
  profile_distributions?: CalcMuestraAulasProfileDistribution[] | MonitoreoRow[];
  metrics?: CalcMuestraAulasRepresentativityMetric[] | MonitoreoRow[];
  coverage_overlap?: MonitoreoRow[];
  weight_stability?: MonitoreoRow[];
  reserve_depth?: MonitoreoRow[];
  warnings?: string[];
};

export type CalcMuestraAulasRiskFlag = {
  code: string;
  severity: "ok" | "baja" | "media" | "alta" | string;
  title: string;
  detail: string;
  method?: string;
};

export type CalcMuestraAulasMethodSummary = {
  method_id: CalcMuestraWorkspaceAulasSelector | string;
  method_label: string;
  engine_used?: string;
  probability_source?: string;
  balance_score?: number;
  repeated_students?: number;
  duplicate_loss?: number;
  repetition_score?: number;
  unique_students_covered?: number;
  coverage_unique_pct?: number;
  coverage_score?: number;
  schedule_concentration_delta?: number;
  concentration_score?: number;
  reserve_depth_ratio?: number;
  reserve_score?: number;
  weight_cv?: number;
  n_eff_ratio?: number;
  representativity_score?: number;
  representativity_distance?: number;
  overall_score?: number;
  warnings?: string;
  operational_reason?: string;
  methodological_reason?: string;
};

export type CalcMuestraAulasMethodComparison = {
  schema: "calc_muestra_aulas_method_comparison_v1" | string;
  generated_at: string;
  frame_hash: string;
  methods: CalcMuestraAulasMethodSummary[];
  recommendation?: {
    method_id?: string;
    method_label?: string;
    operational_reason?: string;
    methodological_reason?: string;
    overall_score?: number;
    representativity_score?: number;
    representativity_distance?: number;
  };
  objective_config?: CalcMuestraAulasObjectiveConfig;
  frame_profiles?: CalcMuestraAulasProfileDistribution[] | MonitoreoRow[];
  method_profiles?: CalcMuestraAulasProfileDistribution[] | MonitoreoRow[];
  representativity_metrics?: CalcMuestraAulasRepresentativityMetric[] | MonitoreoRow[];
  simulation_summary?: CalcMuestraAulasSimulationSummary[] | MonitoreoRow[];
  balance?: MonitoreoRow[];
  reserve_depth?: MonitoreoRow[];
  risk_flags?: CalcMuestraAulasRiskFlag[];
  simulation_runs?: number;
  notes?: string[];
};

export type CalcMuestraAulasReplacementSuggestion = {
  selection_slot_id?: string;
  titular_operational_code?: string;
  titular_classroom_id: string;
  titular_label?: string;
  reserve_operational_code?: string;
  replacement_chain_code?: string;
  reserve_classroom_id: string;
  reserve_label?: string;
  rank: number;
  wave: string;
  replacement_order?: number;
  match_level: "misma_celda" | "celda_equivalente" | "celda_cercana" | string;
  score: number;
  before_score?: number;
  after_score?: number;
  score_delta?: number;
  overlap_delta?: number;
  eligible_delta?: number;
  reason?: string;
  warning?: string;
};

export type CalcMuestraAulasReplacementImpact = {
  selection_slot_id?: string;
  titular_operational_code?: string;
  titular_classroom_id: string;
  replacement_operational_code?: string;
  suggested_replacement_id: string;
  before_score?: number;
  after_score?: number;
  score_delta?: number;
  before_faculty?: string;
  after_faculty?: string;
  before_program?: string;
  after_program?: string;
  eligible_delta?: number;
  overlap_delta?: number;
  balance_effect?: string;
  warning?: string;
};

export type CalcMuestraAulasReplacementSimulation = {
  schema: "calc_muestra_aulas_replacement_simulation_v1" | string;
  generated_at: string;
  selection_run_id: string;
  frame_hash: string;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  planned_representativity?: CalcMuestraAulasRepresentativityResult;
  suggestions: CalcMuestraAulasReplacementSuggestion[];
  impact: CalcMuestraAulasReplacementImpact[] | MonitoreoRow[];
  summary?: MonitoreoRow[];
};

export type CalcMuestraAulasState = {
  config?: Record<string, unknown>;
  frame?: CalcMuestraAulasFrame | null;
  selection?: CalcMuestraAulasSelection | null;
  method_comparison?: CalcMuestraAulasMethodComparison | null;
  replacement_simulation?: CalcMuestraAulasReplacementSimulation | null;
  export?: { ok?: true; file_id: string; filename: string; size: number } | null;
};

export type CalcMuestraState = {
  estudio: CalcMuestraEstudio;
  aulas?: CalcMuestraAulasState;
  reporte: CalcMuestraReporteMeta;
};

export const DEFAULT_CALC_MUESTRA_ESTUDIO: CalcMuestraEstudio = {
  version: 1,
  id: "",
  titulo: "Estudio sin título",
  fecha_creacion: new Date().toISOString(),
  modo_trabajo: "estimacion_preliminar",
  macro_familia: "estudio_propio",
  modo_sensible: false,
  contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" },
  componentes: [],
  workspace: null,
};

export type CalcMuestraDiagnostico = {
  buscaCenso?: boolean;
  universoPequeno?: boolean;
  poblacionOculta?: boolean;
  marcoEstado?: CalcMuestraEstadoMarco;
  probabilidadConocida?: boolean;
  buscaRepresentatividad?: boolean;
  controlaCuotas?: boolean;
  necesitaMargenError?: boolean;
  modoCampo?: "individual" | "por_grupos";
  tieneConglomerados?: boolean;
  marcoOrdenado?: boolean;
  tieneEstratos?: boolean;
  medicionRecurrente?: boolean;
  N_marco?: number;
};

export type CalcMuestraRecomendacion = {
  tecnica: CalcMuestraTecnica;
  naturaleza: CalcMuestraNaturaleza;
  nivel_respaldo: CalcMuestraNivelRespaldo;
  origen_tamano: CalcMuestraOrigenTamano;
  razon: string;
};

export type CalcMuestraMemoriaDecision = {
  paso: string;
  decision: string;
  motivo: string;
  fuente: string;
};

/** Memoria de cálculo del motor R (POST /api/calc-muestra/explicar). */
export type CalcMuestraMemoria = {
  modelo: "cochran_fpc_deff" | string;
  parametros: {
    confianza: number;
    z_usado: number;
    p: number;
    q: number;
    e: number;
    deff: number;
    N: number;
    oversample_pct: number;
  };
  terminos: {
    numerador: number;
    n0_sin_fpc: number;
    fpc_denominador: number;
    n_sin_deff: number;
  };
  n_teorico: number;
  n_objetivo: number;
  n_operativo: number;
  sobremuestra: number;
  unidades_operativas?: number | null;
  retrocalculo: {
    precision_alcanzada: number;
    e_objetivo: number;
    cumple: boolean;
  };
  decision_log: CalcMuestraMemoriaDecision[];
  fuentes: string[];
};

export type CalcMuestraExplicarInput = {
  N: number;
  p?: number;
  e?: number;
  deff?: number;
  confianza?: number;
  z?: number;
  oversample_pct?: number;
  meta_valor?: number;
  promedio_conglomerado?: number;
  tau?: number;
};

export async function apiCalcMuestraState() {
  return handle<CalcMuestraState>(
    await apiFetch("/api/calc-muestra/state", { headers: headers() }),
  );
}

export async function apiCalcMuestraEstudioPut(estudio: Partial<CalcMuestraEstudio>) {
  return handle<{ ok: true; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/estudio", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ estudio }),
    }),
  );
}

export async function apiCalcMuestraComponenteUpsert(
  componente: Partial<CalcMuestraComponente>,
  op: "add" | "update" = "update",
) {
  return handle<{ ok: true; componente: CalcMuestraComponente; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/componente", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ componente, op }),
    }),
  );
}

export async function apiCalcMuestraComponenteEliminar(id: string) {
  return handle<{ ok: true; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/componente", {
      method: "DELETE",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id }),
    }),
  );
}

export async function apiCalcMuestraCalcular() {
  return handle<{ ok: true; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/calcular", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
}

export async function apiCalcMuestraRecomendar(diagnostico: CalcMuestraDiagnostico) {
  return handle<{ ok: true; recomendacion: CalcMuestraRecomendacion }>(
    await apiFetch("/api/calc-muestra/recomendar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ diagnostico }),
    }),
  );
}

export async function apiCalcMuestraExplicar(parametros: CalcMuestraExplicarInput) {
  return handle<{ ok: true; memoria: CalcMuestraMemoria }>(
    await apiFetch("/api/calc-muestra/explicar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parametros }),
    }),
  );
}

export async function apiCalcMuestraMarcoConfig(config: Record<string, unknown>) {
  return handle<{ ok: true; config: Record<string, unknown>; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/marco/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiCalcMuestraMarcoInspeccionarArchivo(file_id: string) {
  return handle<{
    ok: true;
    file_id: string;
    original_name: string;
    inspection: CalcMuestraAulasFileInspection;
  }>(
    await apiFetch("/api/calc-muestra/marco/inspeccionar-archivo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ file_id }),
    }),
  );
}

export async function apiCalcMuestraMarcoConstruir(payload: {
  base_madre?: MonitoreoRow[];
  base_madre_file_id?: string;
  base_madre_sheet?: string;
  estudiantes?: MonitoreoRow[];
  estudiantes_file_id?: string;
  estudiantes_sheet?: string;
  catalogo_curso_horario?: MonitoreoRow[];
  catalogo_curso_horario_file_id?: string;
  catalogo_curso_horario_sheet?: string;
  inscripciones?: MonitoreoRow[];
  inscripciones_file_id?: string;
  inscripciones_sheet?: string;
  config?: Record<string, unknown>;
}) {
  return handle<{ ok: true; frame: CalcMuestraAulasFrame; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/marco/construir", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCalcMuestraAulasCompararMetodos(payload: {
  config?: Record<string, unknown>;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  frame?: CalcMuestraAulasFrame;
  methods?: string[];
  simulation_runs?: number;
} = {}) {
  return handle<{ ok: true; comparison: CalcMuestraAulasMethodComparison; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/aulas/comparar-metodos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCalcMuestraAulasSeleccionar(config?: Record<string, unknown>, frame?: CalcMuestraAulasFrame, methodId?: string, objectiveConfig?: CalcMuestraAulasObjectiveConfig) {
  return handle<{ ok: true; selection: CalcMuestraAulasSelection; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/aulas/seleccionar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ...(config ? { config } : {}), ...(frame ? { frame } : {}), ...(methodId ? { method_id: methodId } : {}), ...(objectiveConfig ? { objective_config: objectiveConfig } : {}) }),
    }),
  );
}

export async function apiCalcMuestraAulasSimularReemplazos(payload: {
  config?: Record<string, unknown>;
  objective_config?: CalcMuestraAulasObjectiveConfig;
  frame?: CalcMuestraAulasFrame;
  selection?: CalcMuestraAulasSelection;
} = {}) {
  return handle<{ ok: true; replacement_simulation: CalcMuestraAulasReplacementSimulation; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/aulas/simular-reemplazos", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  );
}

export async function apiCalcMuestraAulasExportar() {
  return handle<{ ok: true; export: { ok?: true; file_id: string; filename: string; size: number }; state: CalcMuestraState }>(
    await apiFetch("/api/calc-muestra/aulas/exportar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }),
  );
}

// ----------------------------------------------------------------------------
// Inicialización por tipo de estudio (reemplaza los antiguos presets).
//
// Cada tipo de estudio crea una estructura de componentes vacíos lista para
// que el usuario edite N, parámetros y metas por UI. El motor infiere técnicas
// y mínimos automáticamente al completar actor + canal + N.
//
// Variante:
//   - "vacio" (default): solo la estructura, sin datos. Aplica para todos.
//   - "plantilla_pucp" (legacy): conserva presets antiguos cuando se reabre
//     un estudio historico; la ruta activa es `encuesta_estudiantes`.
// ----------------------------------------------------------------------------

export type CalcMuestraVarianteEstudio = "vacio" | "plantilla_pucp";

export async function apiCalcMuestraIniciarEstudio(
  tipo: CalcMuestraMacroFamilia,
  variante: CalcMuestraVarianteEstudio = "vacio",
) {
  return handle<{ ok: true; estudio: CalcMuestraEstudio; state?: CalcMuestraState; demo_warning?: string | null }>(
    await apiFetch("/api/calc-muestra/iniciar-estudio", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ tipo, variante }),
    }),
  );
}

export async function apiCalcMuestraModoTrabajo(modo: CalcMuestraModoTrabajo) {
  return handle<{ ok: true; modo_trabajo: CalcMuestraModoTrabajo; estudio: CalcMuestraEstudio }>(
    await apiFetch("/api/calc-muestra/modo-trabajo", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ modo }),
    }),
  );
}

export async function apiCalcMuestraReporteIniciar(formato: "html" | "pdf" = "html") {
  return handle<{ ok: true; job_id: string; formato: "html" | "pdf" }>(
    await apiFetch("/api/calc-muestra/reporte", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    }),
  );
}

export function calcMuestraReporteDescargarUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/calc-muestra/reporte/descargar${qs ? `?${qs}` : ""}`);
}

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
  "activity" | "responsible" | "product" | "phase" | "start_date" | "end_date" | "status" | "notes"
>>;

export async function apiPlanTrabajoState() {
  return handle<PlanTrabajoState>(
    await apiFetch("/api/plan-trabajo/state", { headers: headers() }),
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

export type DisenoEstudioReadiness = {
  score: number;
  ready_count: number;
  total_count: number;
  pending_count: number;
  active_count: number;
  warning_count: number;
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

export type DisenoEstudioDecision = {
  title: string;
  detail: string;
  source: string;
  tone: string;
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
};

export type DisenoEstudioTimelineItem = DisenoEstudioBitacoraEntry & {
  kind: "manual" | "auto" | string;
  route: string;
  source: string;
};

export type DisenoEstudioLibrary = {
  available: boolean;
  methodologies_count: number;
  study_families_count: number;
  updated_at: string;
  source: string;
};

export type DisenoEstudioState = {
  ok: true;
  schema: "diseno_estudio_state_v1" | string;
  generated_at: string;
  protocol: DisenoEstudioProtocol;
  readiness: DisenoEstudioReadiness;
  sources: DisenoEstudioSource[];
  decisions: DisenoEstudioDecision[];
  risks: DisenoEstudioRisk[];
  next_actions: DisenoEstudioNextAction[];
  bitacora: DisenoEstudioBitacoraEntry[];
  timeline: DisenoEstudioTimelineItem[];
  library: DisenoEstudioLibrary;
};

export type DisenoEstudioBitacoraInput = {
  id?: string;
  module_id?: string;
  tone?: DisenoEstudioBitacoraTone;
  title: string;
  body: string;
  occurred_at?: string;
  tags?: string[];
};

export async function apiDisenoEstudioState() {
  return handle<DisenoEstudioState>(
    await apiFetch("/api/diseno-estudio/state", { headers: headers() }),
  );
}

export async function apiDisenoEstudioBitacoraUpsert(entry: DisenoEstudioBitacoraInput) {
  return handle<DisenoEstudioState>(
    await apiFetch("/api/diseno-estudio/bitacora", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ entry }),
    }),
  );
}

export async function apiDisenoEstudioBitacoraDelete(id: string) {
  return handle<DisenoEstudioState>(
    await apiFetch(`/api/diseno-estudio/bitacora/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    }),
  );
}

// ============================================================================
// Enciclopedia Metodológica
// ============================================================================

export type EnciclopediaFichaFormula = {
  expresion: string;
  descripcion: string;
  notas: string[];
};

export type EnciclopediaFichaParametro = {
  nombre: string;
  rango_recomendado: string;
  justificacion: string;
};

export type EnciclopediaFichaEscenario = {
  contexto: string;
  porque_aplica: string;
};

export type EnciclopediaFichaDecision = {
  titulo: string;
  detalle: string;
};

export type EnciclopediaFichaTradeOff = {
  ventaja: string;
  limitacion: string;
};

export type EnciclopediaFicha = {
  id: CalcMuestraTecnica;
  nombre_tecnico: string;
  abreviatura?: string;
  naturaleza: CalcMuestraNaturaleza;
  permite_margen_error: boolean;
  implementada_en_calculador: boolean;
  definicion: string;
  supuestos_formales: string[];
  formulas: EnciclopediaFichaFormula[];
  parametros_tipicos: EnciclopediaFichaParametro[];
  origen_tamano_aplicable: CalcMuestraOrigenTamano[];
  escenarios_de_uso: EnciclopediaFichaEscenario[];
  cuando_no_usar: string[];
  decisiones_tecnicas: EnciclopediaFichaDecision[];
  trade_offs: EnciclopediaFichaTradeOff[];
  salida_principal: string;
  referencias_bibliograficas: string[];
  aplicaciones_internas: string[];
};

export type EnciclopediaCatalogo = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  metodologias: EnciclopediaFicha[];
};

export type EnciclopediaTermino = {
  id: string;
  termino: string;
  nombre_completo: string;
  definicion: string;
  formula: string | null;
  metodologias_relacionadas: CalcMuestraTecnica[];
  campos_calculador_relacionados: string[];
};

export type EnciclopediaGlosario = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  terminos: EnciclopediaTermino[];
};

export type EnciclopediaFamiliaEstudio =
  | "acreditacion_programa"
  | "opinion_universitaria"
  | "territorial_hogares"
  | "servicios_establecimientos"
  | "listado_telefonico_programa"
  | "institucional_no_probabilistico";

export type EnciclopediaRequiereCalculoMuestra = "si" | "no" | "parcial";

export type EnciclopediaOrigenMuestra =
  | "por_calcular"
  | "muestra_historica_replicada"
  | "mixto_por_componente"
  | "meta_contractual"
  | "marco_total_barrido"
  | "cobertura_por_actor";

export type EnciclopediaAccionEvaluadorMuestra =
  | "calcular_muestra"
  | "calcular_marco_cobertura"
  | "calcular_cuotas"
  | "fuera_calculador"
  | "evaluar_por_componente";

export type EnciclopediaNivelEvidencia = "alto" | "medio" | "limitado";

export type EnciclopediaEstudio = {
  codigo: string;
  anio: number;
  familia_estudio: EnciclopediaFamiliaEstudio;
  metodologia_principal: CalcMuestraTecnica;
  metodologias_secundarias: CalcMuestraTecnica[];
  dominio: string;
  es_recurrente: boolean;
  requiere_calculo_muestra: EnciclopediaRequiereCalculoMuestra;
  origen_muestra: EnciclopediaOrigenMuestra;
  accion_evaluador_muestra: EnciclopediaAccionEvaluadorMuestra;
  elementos_comunes: string[];
  nivel_evidencia: EnciclopediaNivelEvidencia;
};

export type EnciclopediaTablaEstudios = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  nota_confidencialidad: string;
  rutas_evaluador_muestra?: Record<EnciclopediaAccionEvaluadorMuestra, string>;
  naturalezas_dominantes: Record<CalcMuestraNaturaleza, string>;
  estudios: EnciclopediaEstudio[];
};

export type EnciclopediaCatalogItem = {
  id: string;
  nombre: string;
  descripcion: string;
};

export type EnciclopediaTipoEstudio = EnciclopediaCatalogItem & {
  criterios: string[];
  acciones_evaluador_permitidas: EnciclopediaAccionEvaluadorMuestra[];
  elementos_comunes: string[];
  ejemplos: string[];
};

export type EnciclopediaTiposEstudioCatalogo = {
  version: number;
  actualizado_en: string;
  fuente_canonica: string;
  criterio_general: string;
  acciones_evaluador_muestra: Array<EnciclopediaCatalogItem & { salida_principal: string }>;
  origenes_muestra: EnciclopediaCatalogItem[];
  familias_estudio: EnciclopediaTipoEstudio[];
};

export type EnciclopediaComparador = {
  version: number;
  seleccionadas: EnciclopediaFicha[];
  ejes_comparacion: string[];
};

export async function apiEnciclopediaCatalogo() {
  return handle<EnciclopediaCatalogo>(
    await apiFetch("/api/enciclopedia/catalogo", { headers: headers() }),
  );
}

export async function apiEnciclopediaGlosario() {
  return handle<EnciclopediaGlosario>(
    await apiFetch("/api/enciclopedia/glosario", { headers: headers() }),
  );
}

export async function apiEnciclopediaEstudios() {
  return handle<EnciclopediaTablaEstudios>(
    await apiFetch("/api/enciclopedia/estudios", { headers: headers() }),
  );
}

export async function apiEnciclopediaTiposEstudio() {
  return handle<EnciclopediaTiposEstudioCatalogo>(
    await apiFetch("/api/enciclopedia/tipos-estudio", { headers: headers() }),
  );
}

export async function apiEnciclopediaComparador(ids: string[]) {
  const qs = new URLSearchParams({ ids: ids.join(",") }).toString();
  return handle<EnciclopediaComparador>(
    await apiFetch(`/api/enciclopedia/comparador?${qs}`, { headers: headers() }),
  );
}
import { normalizeGraficosConfigBundle } from "./graficosConfigNormalizer";

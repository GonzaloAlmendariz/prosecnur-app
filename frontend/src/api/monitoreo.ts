// monitoreo.ts — monitoreo digital (aulas, territorial, acreditación).
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import type { CalcMuestraAulasFrame, CalcMuestraAulasSelection, CalcMuestraEstudio } from "./calcMuestra";
import { ApiError, apiFetch, apiPath, downloadUrl, getSession, handle, headers, registerMonitoreoMutationInvalidator, SESSION_KEY } from "./core";
import { type AsyncJobStart, type FileJobResult, jobResultDomainError, type JobStart } from "./jobs";
import { type CargaMonitoreoHandoffValidity, normalizeKoboAssets } from "./xlsformEditor";
import { captureUrlOk } from "../lib/captureUrl";

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
  /** Formulario web de captura. Vacío cuando Kobo no expuso ninguno. */
  survey_url: string;
  /**
   * Pantalla administrativa del proyecto en Kobo. Sirve para abrir el proyecto,
   * nunca como URL de captura: no acepta `d[]`. Ver `lib/captureUrl`.
   */
  landing_url: string;
  base_url: string;
  version_id: string;
  deployment_active: boolean;
  /** `"deployment"` cuando hay formulario; `"unresolved"` cuando no. */
  resolved_from: string;
  capture_issue: string;
  capture_message: string;
};

/**
 * `meta` es el **mínimo a llegar**, no el objetivo: es el piso interno con el
 * que el estudio se cubre. Lo que se persigue depende del actor y del acuerdo
 * con el cliente, y eso lo declara `objetivo`:
 *
 * - `barrido`: el universo es barrible y se busca cubrirlo entero; el mínimo
 *   solo actúa como piso de seguridad.
 * - `minimo`: el universo no se puede barrer y el mínimo ES el acuerdo.
 *
 * Sin declaración, la lectura la sugiere el tamaño del universo.
 */
export type MonitoreoGoalObjetivo = "barrido" | "minimo";

export type MonitoreoGoal = {
  filters: Record<string, string>;
  meta: number;
  meta_pct?: number | null;
  objetivo?: MonitoreoGoalObjetivo | null;
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

/**
 * Reparto de una columna en categorías.
 *
 * `categorical` es `false` cuando la columna tiene demasiadas categorías
 * distintas para segmentar —un identificador, un nombre, texto libre—. En ese
 * caso `categories` viene vacío pero `distinct_count` sigue publicado, para que
 * la vista pueda explicar por qué no hay reparto en vez de callar.
 */
export type MonitoreoVariableDistribucion = {
  non_empty: number;
  distinct_count: number;
  categorical: boolean;
  categories: { value: string; count: number }[];
  /** Categorías que quedaron fuera del top, y cuántos casos representan. */
  otras_categorias: number;
  otras_casos: number;
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
  distribucion?: MonitoreoVariableDistribucion;
  /** `"anio"` cuando los valores parecen ciclos `AAAA-S` y conviene agrupar. */
  normalizacion_sugerida?: "ninguna" | "anio" | string;
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

/**
 * La variable con la que se segmenta el avance de un actor.
 *
 * Es POR ACTOR y no global: Egresados se sigue por ciclo de egreso y Docentes
 * por categoría. `normalization: "anio"` agrupa los semestres de una cohorte
 * (`2021-1` y `2021-2` cuentan como `2021`).
 */
export type MonitoreoInterestVariable = {
  actor: string;
  variable: string;
  normalization: "ninguna" | "anio";
  label?: string;
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
  /** Variable con la que se abre el avance de cada actor. Ver `interest_variables`. */
  interest_variables?: MonitoreoInterestVariable[];
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
  /** Las que llegan al reporte tras el corte de la fase. El motor las manda
      desde siempre; hasta 2026-08-16 no las leía nadie. */
  report_rows?: number | null;
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
  // Registro de campo: lo que sólo existe dentro del aula. `observed_students`
  // es cuántos ASISTIERON, no cuántos están matriculados (`eligible_n`), y sin
  // ese denominador no hay tasa de respuesta por aula. Los rechazos nunca tocan
  // el formulario, así que Kobo no los ve.
  observed_students?: number | null;
  applied_surveys?: number | null;
  refusals?: number | null;
  applied_by?: string;
  applied_at?: string;
  field_note?: string;
  collection_unit_id?: string;
  updated_at: string;
  [key: string]: string | number | boolean | null | undefined;
};

export type MonitoreoAulasConfig = {
  /** Cuantas unidades tiene el plan. Viaja en vez del plan entero en `state`. */
  plan_rows?: number;
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

import type { BancoDeExtras } from "../features/monitoreo/profiles/aulas/AulasBancoExtras";

export type MonitoreoAulasDashboard = {
  schema: "monitoreo_aulas_dashboard_v1" | string;
  generated_at: string;
  /**
   * El banco de reservas extra: las que NO cuelgan de ningún titular, agregadas
   * por facultad con su composición por sexo. Es el segundo nivel de respaldo
   * del diseño y no aparecía en el payload, así que cuando una cadena se
   * agotaba entera no había de dónde leer qué queda en ese estrato.
   */
  banco_extras?: BancoDeExtras | null;
  /**
   * Cuántos cursos-horario hay DE VERDAD. `course_status` viaja recortado por
   * el tamaño del payload —500 filas— y sin este campo un plan de 2 615 se leía
   * en pantalla como «el estudio tiene 500 aulas».
   */
  course_status_total?: number;
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
	  /** El parte de campo de cada aula, con su resta ya hecha por el motor. */
	  partes_campo?: MonitoreoRow[];
	  /**
	   * «Base de control»: el control de calidad por aula que el equipo lleva en
	   * su Excel. Los valores llegan tal como los trae la hoja —las fórmulas son
	   * del equipo— y el resumen dice qué grupo del control viene lleno, para
	   * distinguir un aula sin revisar de un aula con el control en cero.
	   */
	  /**
	   * El recibo del libro importado: cuándo se leyó y cuáles de las tres hojas
	   * trajo. Ausente cuando el estudio nunca importó uno, que no es lo mismo
	   * que un libro sin hojas.
	   */
	  libro?: {
	    importado_en: string;
	    hojas: Array<{ hoja: string; vino: boolean }>;
	    hojas_ausentes: number;
	    control_sin_nombre: number;
	    resumen?: Record<string, number>;
	  };
	  /** Serie temporal de la recolección: el eje que el perfil no tenía. */
	  ritmo_diario?: {
	    dias: Array<{ fecha: string; validas: number; acumulado: number }>;
	    dias_con_campo: number;
	    mejor_dia?: { fecha: string; validas: number } | null;
	    media_diaria: number;
	    meta: number;
	  };
	  control_calidad?: MonitoreoRow[];
	  control_calidad_resumen?: {
	    aulas: number;
	    grupos: Array<{ clave: string; etiqueta: string; campos: number; aulas_con_dato: number }>;
	    /**
	     * «Aula efectiva» = alcanzó el 70 % contra los DOS denominadores. Las
	     * cuatro cuentas son excluyentes y suman `aulas`; `indeterminadas` son
	     * las que el libro no permite evaluar, que no es lo mismo que fallar.
	     */
	    veredicto?: {
	      efectivas: number;
	      cumple_una: number;
	      /**
	       * El desglose de `cumple_una`, que suman entre los dos. No es un
	       * matiz: `solo_asistentes` es un aula a la que fue poca gente —el
	       * aplicador hizo su trabajo y volver a esa sesión no trae más
	       * alumnos— y `solo_poblacion` una con más presentes que elegibles
	       * donde parte no respondió.
	       */
	      solo_asistentes?: number;
	      solo_poblacion?: number;
	      no_efectivas: number;
	      indeterminadas: number;
	    };
	  };
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
  // Camino general (schema carga_monitoreo_handoff_general_v1): como se resolvio
  // "valido", fuente promovida y bases hija de repeat creadas.
  validity?: CargaMonitoreoHandoffValidity | string;
  source?: { source_id: string; label: string; kobo_asset_uid: string; validity: string };
  child_bases?: Array<{
    base?: string;
    repeat_group?: string;
    parent_base?: string;
    n_filas?: number;
    n_columnas?: number;
    link_key?: string;
  }>;
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

/**
 * Una señal sobre CÓMO se está recolectando, no sobre cuánto falta.
 *
 * Viven en un bloque aparte de `dashboard.alertas` a propósito: una brecha de
 * cuota se resuelve al cierre y un formulario desactualizado solo se puede
 * resolver hoy. Mezclarlas las haría leer igual.
 */
export type MonitoreoCalidadCampoAlerta = {
  severidad: "bloqueante" | "advertencia" | string;
  /** Quién está detrás del hallazgo. Vacío cuando el aviso no es de una persona. */
  actor: string;
  tipo:
    | "formulario_desactualizado"
    | "identidad_agente"
    | "envio_sin_padron"
    | "padron_sin_envio"
    | "cruce_identidad"
    | string;
  mensaje: string;
  detalle?: {
    /** Qué preguntarle a campo. Sin esto el aviso no es accionable. */
    pregunta?: string;
    n_casos?: number;
    casos?: string[];
    parecido_a?: string;
    probable_variante?: boolean;
    mismo_agente?: boolean;
    minutos_solape?: number;
    /** V4 de la vara: toda métrica de tiempo declara de dónde sale. */
    fuente_tiempo?: Record<string, string>;
    [key: string]: unknown;
  };
};

/**
 * `motivo` es la razón por la que no hay avisos, y es información: «no
 * declaraste quién recolecta» no significa lo mismo que «el campo está limpio».
 * Sin él la pantalla no puede contener su propio vacío (C3).
 */
export type MonitoreoCalidadCampo = {
  enabled: boolean;
  alertas: MonitoreoCalidadCampoAlerta[];
  resumen: { total: number; bloqueantes: number; por_tipo?: Record<string, number> };
  roles: { agente: string; llaves: string[] };
  motivo:
    | ""
    | "sin_datos"
    | "sin_rol_de_agente"
    | "sin_llaves_de_identidad"
    | "sin_hallazgos"
    | string;
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
  /** Señales de cómo se trabaja, separadas de las de avance a propósito. */
  calidad_campo?: MonitoreoCalidadCampo | null;
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

// El núcleo dispara este invalidador ante cualquier mutación de
// /api/monitoreo (ver registerMonitoreoMutationInvalidator en core).
registerMonitoreoMutationInvalidator(invalidateMonitoreoStateWarmCache);

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

/**
 * Una unidad del elenco de actores.
 *
 * `origin` distingue el actor que el estudio DECLARÓ del que Fuentes dedujo de
 * una fuente conectada. No es metadato decorativo: el backend recalcula los
 * derivados en cada normalización y solo respeta los declarados, así que
 * perder este campo al viajar es perder el elenco.
 */
export type MonitoreoActorUnit = {
  id: string;
  type: string;
  actor: string;
  label: string;
  segment: string;
  group: string;
  origin: "declarado" | "fuentes";
  phone: { enabled: boolean; role: string };
};

export type MonitoreoActorRosterResult = {
  ok: true;
  actores: MonitoreoActorUnit[];
  state: MonitoreoState;
  saved_project?: boolean;
};

/** Guarda el elenco completo. El orden que se envía es el orden que manda. */
export async function apiMonitoreoActores(units: Array<Partial<MonitoreoActorUnit>>) {
  return handle<MonitoreoActorRosterResult>(
    await apiFetch("/api/monitoreo/actores", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ units }),
    }),
  );
}

/**
 * Renombra un actor en el elenco y en todas sus fuentes, de forma atómica.
 *
 * No es lo mismo que guardar el elenco con el nombre cambiado: eso dejaría al
 * actor viejo vivo en las fuentes que lo nombran y el estudio acabaría con dos.
 */
export async function apiMonitoreoActorRename(from: string, to: string) {
  return handle<MonitoreoActorRosterResult & { from: string; to: string }>(
    await apiFetch("/api/monitoreo/actores/rename", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ from, to }),
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

/** Variante async del sync de Sheets (opt-in 3.8b): el fetch corre en un
 *  worker y el endpoint responde el handle del job de inmediato. El
 *  result_data del job al completar es el MISMO payload que la síncrona
 *  (léelo con normalizeMonitoreoSheetsSyncResult). */
export async function apiMonitoreoSheetsSyncAsync(sourceIds: string[] = []) {
  return handle<AsyncJobStart>(
    await apiFetch("/api/monitoreo/sheets/sync", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ source_ids: sourceIds, async: true }),
    }),
  );
}

/** Normalizador defensivo del result_data del job de sheets/sync: el payload
 *  alimenta onStateChange (decisión crítica), así que un resultado sin `state`
 *  o con error de dominio embebido se relanza como ApiError en vez de
 *  propagar un estado vacío a la vista. */
export function normalizeMonitoreoSheetsSyncResult(data: unknown): MonitoreoSheetsSyncResult {
  const domainError = jobResultDomainError(data);
  if (domainError) throw new ApiError(domainError.code, domainError.message);
  const raw = (data ?? {}) as Partial<MonitoreoSheetsSyncResult>;
  if (raw.ok !== true || !raw.state || typeof raw.state !== "object") {
    throw new ApiError(
      "E_SHEETS_SYNC_RESULT",
      "La sincronización terminó sin estado actualizado. Vuelve a actualizar la vista.",
    );
  }
  return {
    ok: true,
    synced_at: String(raw.synced_at ?? ""),
    n_rows: Number(raw.n_rows ?? 0),
    n_sources: Number(raw.n_sources ?? 0),
    state: raw.state,
  };
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
    // Normalizador defensivo: un backend viejo podía devolver la landing como
    // `survey_url`. Se descarta aquí para que ninguna vista la trate como URL de
    // captura aunque venga en el cable.
    survey_url: captureUrlOk(r.survey_url) ? String(r.survey_url) : "",
    landing_url: String(r.landing_url ?? ""),
    version_id: String(r.version_id ?? ""),
    deployment_active: r.deployment_active === true,
    resolved_from: captureUrlOk(r.survey_url) ? String(r.resolved_from ?? "deployment") : "unresolved",
    capture_issue: String(r.capture_issue ?? ""),
    capture_message: String(r.capture_message ?? ""),
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

/** Una columna real de la base, con lo mínimo para reconocerla sin abrirla. */
export type MonitoreoTerritorialColumna = {
  nombre: string;
  ejemplo: string;
  no_vacios: number;
  /** Proporción de filas con dato, 0–1. Una columna existente y vacía mapea sin error. */
  cobertura: number;
};

/**
 * Una variable de interés y la columna a la que apunta hoy.
 *
 * `resuelta` significa que la columna existe, **no** que sea la correcta: la
 * autodetección casa por subcadena y puede acertar el nombre y errar la
 * variable. Esa es la razón de ser del mapeo manual.
 */
export type MonitoreoTerritorialVariableMapeo = {
  campo: string;
  etiqueta: string;
  apunta_a: string;
  /** FALSE también cuando no hay base cargada: no hay contra qué comprobar. */
  resuelta: boolean;
  motivo: "" | "sin_mapear" | "columna_ausente";
};

export type MonitoreoTerritorialMapeo = {
  ok: true;
  fase: string;
  columnas: MonitoreoTerritorialColumna[];
  variables: MonitoreoTerritorialVariableMapeo[];
  aviso: { ok: boolean; n_pendientes: number; mensaje: string };
};

export async function apiMonitoreoTerritorialMapeo() {
  return handle<MonitoreoTerritorialMapeo>(await apiFetch("/api/monitoreo/territorial/mapeo", { headers: headers() }));
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

/**
 * Activa la siguiente reserva de un curso-horario caído.
 *
 * `agotada: true` significa que la cadena se acabó: la caída NO queda marcada
 * como reemplazada, porque no lo está, y su meta se queda sin cubrir.
 */
/**
 * Genera el libro operativo del estudio: las tres hojas que el equipo llena en
 * Excel, con lo que la app ya sabe y las columnas de cada rol vacías —o con lo
 * ya registrado, si el operativo está en marcha—.
 */
export async function apiMonitoreoAulasGenerarLibro() {
  const result = await handle<{
    ok: true; file_id: string; filename: string; unidades: number; partes: number;
  }>(
    await apiFetch("/api/monitoreo/aulas/generar-libro", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: "{}",
    }),
  );
  return { ...result, download_url: downloadUrl(result.file_id) };
}

/**
 * Relee el libro que alguien llenó. `hojas_ausentes` dice cuáles de las tres no
 * venían: el resultado no finge que estaban vacías.
 */
export async function apiMonitoreoAulasImportarLibro(origen: File | { file_id: string }) {
  const esArchivo = origen instanceof File;
  const cuerpo = esArchivo
    ? (() => { const fd = new FormData(); fd.append("file", origen); return fd; })()
    : JSON.stringify({ file_id: origen.file_id });
  return handle<{
    ok: true;
    resumen: {
      unidades: number; titulares: number; contactadas: number;
      partes_de_campo: number; filas_de_control: number;
    };
    hojas_ausentes: string[];
    control_sin_nombre: number[];
    state: MonitoreoState;
  }>(
    // Sin `Content-Type` cuando va `FormData`: el navegador pone el boundary.
    await apiFetch("/api/monitoreo/aulas/importar-libro", {
      method: "POST",
      headers: esArchivo ? headers() : headers({ "Content-Type": "application/json" }),
      body: cuerpo,
    }),
  );
}

export async function apiMonitoreoAulasActivarReemplazo(payload: {
  operational_code: string;
  motivo?: string;
}) {
  return handle<{
    ok: true;
    activada: string | null;
    reemplazada: string;
    agotada: boolean;
    mensaje: string;
    /**
     * La advertencia de ponderación de la reserva que entra, si el plan la
     * trae. La escribe Cálculo de muestra para el momento de la activación
     * —«usar peso analítico final sólo si se activa en campo»— y va aparte del
     * `mensaje` porque la consecuencia operativa y la metodológica son dos
     * lecturas distintas.
     */
    advertencia_peso?: string;
    state: MonitoreoState;
  }>(
    await apiFetch("/api/monitoreo/aulas/activar-reemplazo", {
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

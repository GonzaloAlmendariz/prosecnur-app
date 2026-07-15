// =============================================================================
// Tipos compartidos de Fase 2 — Validación v2
// =============================================================================
// Contratos estables entre backend (R) y frontend (React). El backend arma
// `ViewDescriptor` JSON que el frontend renderiza con react-plotly.js.
// `ReglaCustom` es el formato persistido de reglas definidas desde la UI
// (se compila a una fila del plan al ejecutar).

import type {
  ExplorerRepeatContext,
  ExplorerRepeatVariableCount,
  ExplorerRepeatVariableScope,
} from "../../lib/rosterExplorer";

/**
 * Tipo de visualización que el frontend sabe renderizar. Se mapea a una
 * configuración plotly concreta dentro de `plotly.data/layout` que el
 * backend ya deja lista.
 */
export type ViewKind =
  | "bar_stack"
  | "bar_h"
  | "half_donut"
  | "heatmap_semaforo"
  | "radar"
  | "chip_bars"
  | "kpi_card"
  | "scatterpolar"
  | "histogram"
  | "boxplot"
  | "table";

/**
 * Acción que el usuario puede disparar desde un chart (click en barra,
 * botón al pie, etc.). Las acciones pueden saltar a otra pestaña y
 * prefillear el store de esa pestaña con `payload`.
 */
export type ViewAction = {
  id: string;
  label: string;
  payload?: Record<string, unknown>;
  target_tab?: ValidacionTabId;
};

/**
 * Metadata útil para el header del chart (N válidos, N total, tipo de
 * variable detectado, empty_hint, etc.) — lo usa el wrapper `PlotlyView`
 * sin tocar el contenido del gráfico.
 */
export type ViewMeta = {
  var?: string;
  var_x?: string;
  var_y?: string;
  tipo?: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  n_total?: number;
  n_validos?: number;
  eyebrow?: string;
  note?: string;
  severidad?: "neutral" | "success" | "warn" | "danger";
  n_secciones?: number;
  n_tipos?: number;
  total_con_casos?: number;
  empty_hint?: string;
  [k: string]: unknown;
};

/**
 * Descriptor único que viaja por la red. El backend produce, el frontend
 * renderiza. `plotly.data/layout` ya viene con todo lo necesario para
 * `<Plot data={...} layout={...} />` de react-plotly.js.
 */
export type ViewDescriptor = {
  version: 1;
  kind: ViewKind;
  title: string;
  subtitle?: string;
  meta?: ViewMeta;
  plotly: {
    data: unknown[]; // plotly traces (sin tipo estricto — opaque al front)
    layout: Record<string, unknown>;
    config?: Record<string, unknown>;
  };
  actions?: ViewAction[];
};

// -----------------------------------------------------------------------------
// Reglas custom
// -----------------------------------------------------------------------------
export type ReglaCustomTipo =
  | "no_nulo"
  | "rango_num"
  | "rango_fecha"
  | "outliers_iqr"
  | "outliers_z"
  | "duplicados"
  | "coherencia_2v"
  | "fuera_catalogo"
  | "select_multiple_hierarchy"
  | "select_multiple_exclusive"
  | "select_multiple_cardinality"
  | "select_multiple_selection";

export type ReglaCustomSeveridad = "error" | "advertencia" | "info";
export type ReglaCustomHallazgoKind = "caso_validar" | "inconsistencia_usuario";
export type ReglaTreatmentActionType =
  | "ignore_rule"
  | "exclude_cases"
  | "replace_value"
  | "set_value"
  | "recode_map"
  | "complete_select_multiple_hierarchy"
  | "adjust_select_multiple"
  | "nullify_fields";
export type ReglaTreatmentScope = "all" | "selected" | "single";
export type ReglaGateCondition = {
  variable: string;
  op:
    | "=="
    | "!="
    | ">"
    | ">="
    | "<"
    | "<="
    | "in"
    | "not_in"
    | "contains"
    | "not_contains"
    | "contains_any"
    | "contains_all"
    | "contains_none";
  value: string | string[];
};

export type ReglaCustom = {
  id: string; // "RC_001"
  created_at: string; // ISO8601
  activa: boolean;
  nombre: string;
  tipo: ReglaCustomTipo;
  variables: string[]; // 1+ nombres de variables afectadas
  params: Record<string, unknown>;
  mensaje: string;
  severidad: ReglaCustomSeveridad;
  hallazgo_kind?: ReglaCustomHallazgoKind;
  planned_action_type?: ReglaTreatmentActionType;
  recommended_scope?: ReglaTreatmentScope;
  gate_expr?: string;
  gate_conditions?: ReglaGateCondition[];
};

// -----------------------------------------------------------------------------
// Limpieza y normalización (tab de cierre)
// -----------------------------------------------------------------------------
export type LimpiezaProgreso = {
  plan_construido: boolean;
  auditoria_corrida: boolean;
  n_reglas_custom: number;
};

export type LimpiezaDecisionActionType =
  | ReglaTreatmentActionType
  | "normalize_value"
  | "impute_value";

export type LimpiezaDecisionScope =
  | "rule"
  | "case_subset"
  | "variable"
  | "cell_subset";

export type LimpiezaDecision = {
  id: string;
  source_type: "instrument_rule" | "custom_rule";
  source_id: string;
  scope: LimpiezaDecisionScope;
  target_case_ids: string[];
  target_variable: string | null;
  action_type: LimpiezaDecisionActionType;
  action_params: Record<string, unknown>;
  rationale: string;
  status: "draft" | "ready";
  created_at: string;
  updated_at: string;
};

// Taxonomía tipada del motor AST (v3).
// - `tipo_regla` — técnico, enum cerrado. Determina cómo se evalúa.
// - `categoria_ux` — etiqueta legible para agrupar visualmente al usuario.
// - `fuente` — si la regla vino del XLSForm o fue creada desde la UI.
// - `tipo_variable` — el tipo ODK de la variable afectada (select_one,
//   integer, date, etc.). Renombra el confuso `tipo_observacion` legacy.
export type LimpiezaTipoRegla =
  | "required"
  | "skip"
  | "constraint"
  | "range"
  | "catalog"
  | "outlier"
  | "duplicate"
  | "coherence"
  | "select_multiple_cardinality"
  | "pattern"
  | "calculate_check"
  | "repeat_length"
  | "odk_raw";

export type LimpiezaFuente = "instrumento" | "custom";

export type LimpiezaQueueItem = {
  // Identificación
  source_type: "instrument_rule" | "custom_rule";
  source_id: string;
  nombre_regla: string;
  seccion: string | null;
  // Taxonomía tipada (contrato v3 — preferido)
  tipo_regla: LimpiezaTipoRegla;
  categoria_ux: string;       // etiqueta legible ("Completitud", "Saltos…")
  fuente: LimpiezaFuente;
  tipo_variable: string | null;  // tipo ODK de la variable (select_one, etc.)
  hallazgo_kind?: "inconsistencia_xlsform" | "caso_validar" | "inconsistencia_usuario";
  origen_detalle?: string;
  // --- Campos legacy (compatibilidad) — preferir los tipados de arriba ---
  /** @deprecated usar `fuente` */
  origen: string;
  /** @deprecated usar `categoria_ux` */
  categoria: string | null;
  /** @deprecated usar `tipo_variable` */
  tipo_observacion: string | null;
  // --- Estado y conteo ---
  severidad: string;
  variables: string[];
  n_casos: number;
  n_casos_cubiertos?: number;
  n_casos_pendientes?: number;
  porcentaje: number | null;
  decision_count: number;
  current_action: string | null;
  pending: boolean;
  impact_expected: string;
  planned_action_type?: ReglaTreatmentActionType | null;
  recommended_scope?: ReglaTreatmentScope | null;
  planned_action_params?: Record<string, unknown> | null;
};

export type LimpiezaDecisionSummary = {
  total_reglas_con_casos: number;
  total_reglas_automaticas: number;
  total_reglas_custom: number;
  total_casos_afectados: number;
  total_decisiones: number;
  decisiones_listas: number;
  pendientes: number;
  total_casos_excluidos: number;
  total_celdas_corregidas: number;
  total_reemplazos: number;
  total_imputaciones: number;
  total_transformaciones?: number;
  ready_to_finalize: boolean;
};

export type LimpiezaBeforeAfterPreview = {
  before: {
    total_inconsistencias: number;
    reglas_con_casos: number;
    reglas_total: number;
    filas_base: number;
  };
  after: {
    total_inconsistencias: number;
    reglas_con_casos: number;
    reglas_total: number;
    filas_base: number;
  };
  impact: {
    cases_excluded: number;
    cells_changed: number;
    replacements: number;
    normalizations: number;
    imputations: number;
    transformations?: number;
    rules_resolved: number;
  };
  residual_final: Array<Record<string, unknown>>;
  decisions_ready: number;
};

export type LimpiezaModuleStats = {
  limpieza: { decisiones: number; casos_excluidos: number };
  reemplazo: { decisiones: number; celdas: number };
  imputacion: { decisiones: number; celdas: number };
  transformacion?: { decisiones: number; celdas: number };
  decision_maker: { pendientes: number; listas: number };
};

export type LimpiezaArtifact = {
  kind: string;
  label: string;
  file_id: string;
  original_name: string;
  generated_at: string;
};

export type LimpiezaArtifactsBundle = {
  finalized_at?: string;
  recommended_file_id?: string;
  files: LimpiezaArtifact[];
};

export type LimpiezaSummary = {
  ok: true;
  base_nombre: string | null;
  progreso: LimpiezaProgreso;
  summary: LimpiezaDecisionSummary;
  kpis: ViewDescriptor[];
  top_reglas: ViewDescriptor | null;
  top_variables: ViewDescriptor | null;
  decision_queue: LimpiezaQueueItem[];
  decision_draft: LimpiezaDecision[];
  module_stats: LimpiezaModuleStats;
  before_after_preview: LimpiezaBeforeAfterPreview | null;
  artifacts: LimpiezaArtifactsBundle | Record<string, never>;
  actions: ViewAction[];
};

// -----------------------------------------------------------------------------
// Identificadores de pestañas (deep-links)
// -----------------------------------------------------------------------------
export type ValidacionTabId =
  | "limpieza"
  | "instrumento"
  | "explorar"
  | "reglas_custom";

export type InstrumentoEstado = {
  ok: true;
  base_nombre: string | null;
  plan_construido: boolean;
  auditoria_corrida: boolean;
  n_reglas: number;
  variables_excluidas?: string[];
  n_variables_excluidas?: number;
  operational_config?: InstrumentoOperationalConfig;
  upstream_universe?: InstrumentoUpstreamUniverseSummary;
  views: ViewDescriptor[];
};

export type InstrumentoOperationalConfig = {
  version: 2;
  field_period: {
    enabled: boolean;
    variable: string;
    start_date: string;
    end_date: string;
    timezone: string;
  };
  duplicates: {
    enabled: boolean;
    variables: string[];
    matching_method: "response_similarity";
    similarity_threshold: number;
    minimum_coverage: number;
  };
};

export type InstrumentoUpstreamUniverseSummary = {
  applied: boolean;
  variable: string;
  total: number;
  included: number;
  excluded_test: number;
  excluded_unclassified: number;
  inherited_from?: string | null;
  applied_at?: string | null;
};

export type InstrumentoVariableExclusionOption = {
  variable: string;
  label: string;
  n_reglas: number;
  n_reglas_con_casos: number;
  n_inconsistencias: number;
};

export type InstrumentoVariablesExcluidas = {
  ok: true;
  base_nombre: string | null;
  variables: string[];
  opciones: InstrumentoVariableExclusionOption[];
};

export type ExploradorVariable = {
  name: string;
  label: string;
  tipo: "so" | "sm" | "num" | "fecha" | "texto" | "mixto";
  n_validos: number;
  n_nulos: number;
  /** Instancias donde la variable es estructuralmente aplicable. */
  n_aplicables?: number;
  /** Papel de la variable dentro de una base hija repetible. */
  repeat_scope?: ExplorerRepeatVariableScope | null;
  /** Códigos de instancia para los que el relevant del instrumento aplica. */
  applicable_codes?: string[];
  /** Fuente usada para resolver la aplicabilidad (AST, instrumento o fallback). */
  applicability_source?: string | null;
  /** Conteos ya segmentados por la identidad de la instancia. */
  counts_by_code?: ExplorerRepeatVariableCount[];
};

export type ExploradorSeccion = {
  nombre: string;
  variables: ExploradorVariable[];
};

export type ExploradorVariablesList = {
  ok: true;
  base_nombre: string | null;
  secciones: ExploradorSeccion[];
  n_variables: number;
  /** Dimensión estructural que gobierna la repetición, ausente en bases normales. */
  repeat_context?: ExplorerRepeatContext | null;
};

export type ReglasCustomList = {
  ok: true;
  base_nombre: string | null;
  reglas: ReglaCustom[];
};
